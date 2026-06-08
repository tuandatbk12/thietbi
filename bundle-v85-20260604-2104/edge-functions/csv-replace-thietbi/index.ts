// ════════════════════════════════════════════════════════════════
// Edge Function: csv-replace-thietbi
//
// Replace data trong bảng TongHopThietBi từ JSON array.
// Frontend parse CSV ở client → POST JSON lên đây.
// Function này:
//   1. Verify admin
//   2. Validate input (rows array, cột bắt buộc)
//   3. Call DB function archive_and_replace_thietbi() (atomic)
//   4. Trả kết quả: version_id mới, số rows
//
// Request:
//   POST { rows: [...], note: "Q1 2026", csv_file_name: "data.csv", csv_size: 123456 }
//   Header: Authorization: Bearer <admin_jwt>
//
// Response:
//   200 { success: true, version_id: 25, archived: 14725, inserted: 15032, pruned: 1 }
//   401/403/500 { error: "..." }
// ════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'admin@example.com';

const REQUIRED_COLUMNS = ['Tram', 'Ngan_thiet_bi', 'Ten_thiet_bi', 'Phan_loai_thiet_bi'];
const ALL_COLUMNS = [
  'Id', 'Tram', 'Ngan_thiet_bi', 'Ten_thiet_bi', 'Phan_loai_thiet_bi',
  'Cap_dien_ap', 'So_luong', 'Don_vi_tinh', 'Ly_lich', 'Hang_san_xuat',
  'Kieu', 'Thong_so', 'Dien_ap', 'Cong_suat', 'Nam_san_xuat',
  'Nam_van_hanh', 'Serial', 'Doi', 'Chung_loai_DCL', 'Loai_ngan_lo',
];

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
  throw new Error('Không có service role key trong env');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Chỉ chấp nhận POST' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const rows = body.rows;
    const note = (body.note || '').toString().slice(0, 500);
    const csvFileName = (body.csv_file_name || '').toString().slice(0, 200);
    const csvSize = Number(body.csv_size || 0);

    // ── Validate input ──
    if (!Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'rows phải là array' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows rỗng — không có gì để import' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (rows.length > 30000) {
      return new Response(JSON.stringify({ error: 'Tối đa 30,000 rows mỗi lần upload' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Verify cột bắt buộc trong row đầu
    const firstRow = rows[0];
    if (typeof firstRow !== 'object' || firstRow === null) {
      return new Response(JSON.stringify({ error: 'rows[0] không phải object' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const missingCols = REQUIRED_COLUMNS.filter(c => !(c in firstRow));
    if (missingCols.length > 0) {
      return new Response(JSON.stringify({ 
        error: `Thiếu cột bắt buộc: ${missingCols.join(', ')}`,
        required_columns: REQUIRED_COLUMNS,
        sample_received: Object.keys(firstRow).slice(0, 10),
      }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Auth check ──
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cần đăng nhập admin' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      getServiceRoleKey(),
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Phiên hết hạn' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin
    const isAdminEmail = user.email === ADMIN_EMAIL;
    let isAdminRole = user.user_metadata?.role === 'admin';
    if (!isAdminEmail && !isAdminRole) {
      const { data: profile } = await supabase
        .from('evn_user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      isAdminRole = profile?.role === 'admin';
    }

    if (!isAdminEmail && !isAdminRole) {
      return new Response(JSON.stringify({ error: 'Chỉ admin được upload CSV' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── Clean rows: chỉ giữ cột hợp lệ, convert empty → null ──
    const cleanedRows = rows.map((r: any) => {
      const clean: Record<string, any> = {};
      for (const col of ALL_COLUMNS) {
        if (col in r) {
          const v = r[col];
          // Empty string → null cho cột non-text? Để DB function handle (toàn text-safe)
          clean[col] = v === '' ? null : v;
        }
      }
      return clean;
    });

    // ── Call DB function ──
    const { data, error } = await supabase.rpc('archive_and_replace_thietbi', {
      p_new_data: cleanedRows,
      p_note: note || null,
      p_csv_file_name: csvFileName || null,
      p_csv_size: csvSize || null,
      p_uploaded_by: user.id,
      p_uploaded_email: user.email,
    });

    if (error) {
      console.error('archive_and_replace_thietbi error:', error);

      // Log failed import
      try {
        await supabase.from('csv_imports_log').insert({
          table_name: 'TongHopThietBi',
          uploaded_by: user.id,
          uploaded_email: user.email,
          file_name: csvFileName,
          file_size_bytes: csvSize,
          row_count: rows.length,
          status: 'failed',
          error_message: error.message,
        });
      } catch (_) { /* */ }

      return new Response(JSON.stringify({ 
        error: 'Lỗi DB: ' + error.message,
        hint: 'Xem csv_imports_log để biết chi tiết',
      }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const result = data?.[0] || {};

    return new Response(JSON.stringify({
      success: true,
      message: `Đã thay thế dữ liệu — version ${result.new_version_id}. Archive ${result.archived_rows} rows cũ, insert ${result.inserted_rows} rows mới.`,
      version_id: result.new_version_id,
      archived_rows: result.archived_rows,
      inserted_rows: result.inserted_rows,
      pruned_versions: result.pruned_versions,
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('csv-replace-thietbi error:', err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
