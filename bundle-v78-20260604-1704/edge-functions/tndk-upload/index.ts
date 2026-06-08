// ════════════════════════════════════════════════════════════════
// Edge Function: tndk-upload
//
// Tạo record TNĐK + upload ảnh atomic.
// Workflow:
//   1. Auth (authenticated user)
//   2. Validate input (tram, ngay_tn, photos)
//   3. INSERT tndk_records → get record_id
//   4. Upload ảnh lên Storage bucket 'tndk-photos'
//   5. INSERT tndk_photos metadata
//   6. Nếu lỗi giữa chừng → rollback record + delete uploaded photos
//
// Request format (multipart/form-data):
//   - tram: string
//   - ngay_tn: YYYY-MM-DD
//   - ghi_chu: string (optional)
//   - photo_0, photo_1, ... : File (image)
// ════════════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'tndk-photos';
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;   // 10 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

function getServiceRoleKey(): string {
  const secretsJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretsJson) {
    try {
      const parsed = JSON.parse(secretsJson);
      for (const k of ['secret', 'service_role', 'admin']) {
        if (parsed[k]) return parsed[k];
      }
      const values = Object.values(parsed) as string[];
      if (values.length > 0) return values[0];
    } catch (_) { /* */ }
  }
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('Service role key missing');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Chỉ chấp nhận POST' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const sbUrl = Deno.env.get('SUPABASE_URL')!;
  const srvKey = getServiceRoleKey();

  let recordId: number | null = null;
  const uploadedPaths: string[] = [];

  try {
    // ── Auth ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cần đăng nhập' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const userResp = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': srvKey },
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: 'Phiên hết hạn' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const user = await userResp.json();

    // ── Parse multipart form ──
    const formData = await req.formData();
    const tram = (formData.get('tram') as string || '').trim();
    const ngay_tn = (formData.get('ngay_tn') as string || '').trim();
    const ghi_chu = (formData.get('ghi_chu') as string || '').trim();

    // ── Validate ──
    if (!tram) {
      return new Response(JSON.stringify({ error: 'Thiếu trạm' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!ngay_tn || !/^\d{4}-\d{2}-\d{2}$/.test(ngay_tn)) {
      return new Response(JSON.stringify({ error: 'Ngày TN phải dạng YYYY-MM-DD' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Collect photos
    const photoFiles: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (key.startsWith('photo_') && value instanceof File && value.size > 0) {
        // Validate size + mime
        if (value.size > MAX_PHOTO_SIZE) {
          return new Response(JSON.stringify({ 
            error: `Ảnh ${value.name} quá 10 MB` 
          }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        if (!ALLOWED_MIME.includes(value.type)) {
          return new Response(JSON.stringify({ 
            error: `Ảnh ${value.name} sai định dạng (chỉ JPG/PNG/WebP/HEIC)` 
          }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
        }
        photoFiles.push(value);
      }
    }

    console.log(`[tndk-upload] User ${user.email} | ${tram} | ${ngay_tn} | ${photoFiles.length} photos`);

    // ── Step 1: INSERT tndk_records ──
    const recordResp = await fetch(`${sbUrl}/rest/v1/tndk_records`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${srvKey}`,
        'apikey': srvKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        tram,
        ngay_tn,
        ghi_chu: ghi_chu || null,
        uploaded_by: user.id,
        uploaded_email: user.email,
      }),
    });

    if (!recordResp.ok) {
      const err = await recordResp.text();
      console.error('[tndk-upload] Insert record failed:', err);
      return new Response(JSON.stringify({ 
        error: 'Không tạo được record: ' + err.substring(0, 200)
      }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const records = await recordResp.json();
    recordId = records[0].id;
    console.log(`[tndk-upload] Created record id=${recordId}`);

    // ── Step 2: Upload photos to Storage ──
    const photoMetadata: any[] = [];
    
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      // Path: tndk-photos/YYYY-MM/record_{id}/photo_{i}_{timestamp}.{ext}
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const yearMonth = ngay_tn.substring(0, 7);   // "2026-05"
      const timestamp = Date.now();
      const path = `${yearMonth}/record_${recordId}/photo_${i}_${timestamp}.${ext}`;
      
      const arrayBuffer = await file.arrayBuffer();
      
      const uploadResp = await fetch(
        `${sbUrl}/storage/v1/object/${BUCKET}/${path}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${srvKey}`,
            'apikey': srvKey,
            'Content-Type': file.type,
          },
          body: arrayBuffer,
        }
      );

      if (!uploadResp.ok) {
        const err = await uploadResp.text();
        console.error(`[tndk-upload] Upload photo ${i} failed:`, err);
        throw new Error('Upload ảnh thất bại: ' + err.substring(0, 200));
      }

      const publicUrl = `${sbUrl}/storage/v1/object/public/${BUCKET}/${path}`;
      
      uploadedPaths.push(path);
      photoMetadata.push({
        record_id: recordId,
        photo_url: publicUrl,
        photo_path: path,
        file_name: file.name,
        file_size: file.size,
        mime_type: file.type,
      });
      
      console.log(`[tndk-upload] Uploaded photo ${i+1}/${photoFiles.length}: ${path}`);
    }

    // ── Step 3: INSERT tndk_photos metadata ──
    if (photoMetadata.length > 0) {
      const photosResp = await fetch(`${sbUrl}/rest/v1/tndk_photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${srvKey}`,
          'apikey': srvKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(photoMetadata),
      });

      if (!photosResp.ok) {
        const err = await photosResp.text();
        console.error('[tndk-upload] Insert photos meta failed:', err);
        throw new Error('Lưu metadata ảnh thất bại: ' + err.substring(0, 200));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      record_id: recordId,
      uploaded_photos: photoMetadata.length,
      message: `Đã tạo record TNĐK ${tram} - ${ngay_tn} với ${photoMetadata.length} ảnh.`,
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[tndk-upload] Error:', msg);

    // ── ROLLBACK ──
    // Delete uploaded photos from Storage
    if (uploadedPaths.length > 0) {
      console.log(`[tndk-upload] Rolling back ${uploadedPaths.length} uploaded photos...`);
      try {
        await fetch(`${sbUrl}/storage/v1/object/${BUCKET}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${srvKey}`,
            'apikey': srvKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prefixes: uploadedPaths }),
        });
      } catch (e) { console.warn('Rollback photos failed:', e); }
    }

    // Delete record if created
    if (recordId) {
      console.log(`[tndk-upload] Rolling back record ${recordId}...`);
      try {
        await fetch(`${sbUrl}/rest/v1/tndk_records?id=eq.${recordId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${srvKey}`, 'apikey': srvKey },
        });
      } catch (e) { console.warn('Rollback record failed:', e); }
    }

    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
