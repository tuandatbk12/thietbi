// ════════════════════════════════════════════════════════════════
// Edge Function: csv-replace-congtactn
//
// Replace data trong bảng CongTacThiNghiem từ JSON array.
// Tương tự csv-replace-thietbi nhưng cho CongTacThiNghiem.
// 
// Lưu ý: schema CongTacThiNghiem khác TongHopThietBi và mình KHÔNG hard-code cột,
//        DB function tự dùng dynamic SQL theo information_schema.
// ════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'admin@example.com';

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

    if (!Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: 'rows phải là array' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (rows.length === 0) {
      return new Response(JSON.stringify({ error: 'rows rỗng' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (rows.length > 30000) {
      return new Response(JSON.stringify({ error: 'Tối đa 30,000 rows' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cần đăng nhập' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, getServiceRoleKey());

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Phiên hết hạn' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

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
      return new Response(JSON.stringify({ error: 'Chỉ admin được upload' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Get list of valid columns from DB
    const { data: cols, error: colsErr } = await supabase
      .from('information_schema.columns' as any)
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'CongTacThiNghiem');
    
    // Fallback: dùng cột từ row đầu
    let validCols: string[] = [];
    if (!colsErr && cols && Array.isArray(cols)) {
      validCols = (cols as Array<{column_name: string}>).map(c => c.column_name);
    } else {
      validCols = Object.keys(rows[0]);
    }

    // Clean rows
    const cleanedRows = rows.map((r: any) => {
      const clean: Record<string, any> = {};
      for (const col of validCols) {
        if (col in r) {
          const v = r[col];
          clean[col] = v === '' ? null : v;
        }
      }
      return clean;
    });

    const { data, error } = await supabase.rpc('archive_and_replace_congtactn', {
      p_new_data: cleanedRows,
      p_note: note || null,
      p_csv_file_name: csvFileName || null,
      p_csv_size: csvSize || null,
      p_uploaded_by: user.id,
      p_uploaded_email: user.email,
    });

    if (error) {
      console.error('archive_and_replace_congtactn error:', error);
      try {
        await supabase.from('csv_imports_log').insert({
          table_name: 'CongTacThiNghiem',
          uploaded_by: user.id,
          uploaded_email: user.email,
          file_name: csvFileName,
          file_size_bytes: csvSize,
          row_count: rows.length,
          status: 'failed',
          error_message: error.message,
        });
      } catch (_) { /* */ }
      return new Response(JSON.stringify({ error: 'Lỗi DB: ' + error.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const result = data?.[0] || {};

    return new Response(JSON.stringify({
      success: true,
      message: `Đã thay thế dữ liệu CongTacThiNghiem — version ${result.new_version_id}.`,
      version_id: result.new_version_id,
      archived_rows: result.archived_rows,
      inserted_rows: result.inserted_rows,
      pruned_versions: result.pruned_versions,
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('csv-replace-congtactn error:', err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
