// ════════════════════════════════════════════════════════════════
// Edge Function: chat-query (v3 — Gemini + History)
//
// Chatbot AI tra cứu dữ liệu EVN với Google Gemini 2.5 Flash.
// Pattern: Function Calling (LLM chỉ gọi tools predefined, KHÔNG free SQL)
//
// Tools (9):
//   1. search_devices_current   — Tìm thiết bị trong TongHopThietBi (live)
//   2. search_devices_history   — Tìm thiết bị qua version cũ (history)
//   3. get_device_versions      — Liệt kê lịch sử thay đổi 1 thiết bị
//   4. get_devices_at_location  — Liệt kê thiết bị tại 1 trạm
//   5. count_aggregations       — Đếm group by (Tram, Hang, Loai...)
//   6. list_data_versions       — Xem các snapshot đã upload
//   7. search_test_schedule     — Tìm trong CongTacThiNghiem (live)
//   8. search_test_history      — CongTacThiNghiem history
//   9. get_nas_health_status    — Tình trạng NAS
//
// Auth: admin only
// ════════════════════════════════════════════════════════════════

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_TOOL_ITERATIONS = 6;
const ADMIN_EMAIL = 'admin@example.com';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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
  throw new Error('Không có service role key');
}

// ── System prompt ─────────────────────────────────────
const SYSTEM_PROMPT = `Bạn là Trợ lý AI của hệ thống Quản lý Thiết bị EVN Hà Nội.

NHIỆM VỤ:
- Trả lời câu hỏi admin về thiết bị điện và lịch công tác thí nghiệm
- Tra cứu cả dữ liệu HIỆN TẠI và LỊCH SỬ qua tool đã cung cấp
- Trả lời tiếng Việt, ngắn gọn, rõ ràng

DỮ LIỆU:
- TongHopThietBi: snapshot thiết bị hiện tại (~15,000 rows)
  Cột chính: Tram (E1.24), Ngan_thiet_bi (Ngăn MBA T1), Ten_thiet_bi, 
             Phan_loai_thiet_bi (MBA/TU/TI/MC/DCL/RL/CSV/TĐ...), 
             Cap_dien_ap (1=110kV, 2=220kV, 3=35kV, 4=22kV),
             Hang_san_xuat, Kieu, Cong_suat, Nam_san_xuat, Nam_van_hanh, Serial, Doi
- CongTacThiNghiem: lịch công tác thí nghiệm hiện tại
- *_history: snapshot CŨ của 2 bảng, mỗi version có version_id và thông tin upload
- data_versions: metadata mỗi lần upload (version_number, note, uploaded_at, row_count)

QUY TẮC:
1. Trả lời ngắn gọn, dùng bullet/bảng nếu nhiều dữ liệu
2. KHÔNG bịa số liệu — chỉ dựa trên kết quả tool
3. Nếu user hỏi về quá khứ ("trước đây", "tháng trước", "version 5"...) → dùng tool history
4. Nếu hỏi về hiện tại → dùng tool _current
5. Khi báo lịch sử, ghi rõ "ở version XX, upload ngày DD/MM/YYYY"
6. Out-of-scope → "Tôi chỉ tra cứu dữ liệu EVN Hà Nội"
7. Cap_dien_ap: '1' = 110kV, '2' = 220kV, '3' = 35kV, '4' = 22kV
8. Khi user dùng từ chung "MBA" → hiểu là Phan_loai_thiet_bi='MBA'
`;

// ── Tool definitions ────────────────────────────────
const TOOLS = [
  {
    name: 'search_devices_current',
    description: 'Tìm thiết bị HIỆN TẠI trong TongHopThietBi theo nhiều tiêu chí. Trả về tối đa 50 kết quả.',
    parameters: {
      type: 'object',
      properties: {
        tram_filter:         { type: 'string', description: 'Trạm (vd "E1.24")' },
        phan_loai_filter:    { type: 'string', description: 'Loại thiết bị (MBA, TU, TI, MC...)' },
        hang_filter:         { type: 'string', description: 'Hãng (EEMC, ABB...)' },
        cap_dien_ap_filter:  { type: 'string', description: 'Cấp điện áp: 1, 2, 3, 4' },
        nam_van_hanh_min:    { type: 'integer', description: 'Năm vận hành tối thiểu' },
        nam_van_hanh_max:    { type: 'integer', description: 'Năm vận hành tối đa' },
        keyword:             { type: 'string', description: 'Keyword trong Ten_thiet_bi/Kieu/Serial' },
      },
    },
  },
  {
    name: 'search_devices_history',
    description: 'Tìm thiết bị trong LỊCH SỬ — qua các version cũ của TongHopThietBi. Cần version_id (lấy từ list_data_versions trước nếu chưa biết).',
    parameters: {
      type: 'object',
      properties: {
        version_id:          { type: 'integer', description: 'ID của version cần tra cứu (lấy từ list_data_versions)' },
        tram_filter:         { type: 'string', description: 'Trạm (tùy chọn)' },
        phan_loai_filter:    { type: 'string', description: 'Loại (tùy chọn)' },
        keyword:             { type: 'string', description: 'Keyword trong Ten/Kieu/Serial (tùy chọn)' },
      },
      required: ['version_id'],
    },
  },
  {
    name: 'get_device_versions',
    description: 'Liệt kê các version có data của 1 thiết bị (tìm theo Serial hoặc Tram+Ten). Hữu ích khi user hỏi "MBA X đã thay đổi gì từ trước tới giờ"',
    parameters: {
      type: 'object',
      properties: {
        serial:              { type: 'string', description: 'Serial number (ưu tiên)' },
        tram:                { type: 'string', description: 'Trạm (nếu không có serial)' },
        ten_thiet_bi:        { type: 'string', description: 'Tên thiết bị (kèm tram nếu không có serial)' },
      },
    },
  },
  {
    name: 'get_devices_at_location',
    description: 'Liệt kê tất cả thiết bị HIỆN TẠI tại 1 trạm hoặc ngăn.',
    parameters: {
      type: 'object',
      properties: {
        tram:           { type: 'string', description: 'Tên trạm' },
        ngan_thiet_bi:  { type: 'string', description: 'Tên ngăn (tùy chọn)' },
      },
      required: ['tram'],
    },
  },
  {
    name: 'count_aggregations',
    description: 'Đếm thiết bị HIỆN TẠI theo group by. Dùng cho "Có bao nhiêu...", "Trạm nào có nhiều...".',
    parameters: {
      type: 'object',
      properties: {
        group_by: {
          type: 'string',
          enum: ['Tram', 'Phan_loai_thiet_bi', 'Hang_san_xuat', 'Cap_dien_ap', 'Doi', 'Nam_van_hanh'],
        },
        phan_loai_filter: { type: 'string' },
        tram_filter:      { type: 'string' },
        limit:            { type: 'integer' },
      },
      required: ['group_by'],
    },
  },
  {
    name: 'list_data_versions',
    description: 'Liệt kê các snapshot đã upload (versions). Dùng khi user muốn biết "lịch sử upload", "có những version nào".',
    parameters: {
      type: 'object',
      properties: {
        table_name: { 
          type: 'string', 
          enum: ['TongHopThietBi', 'CongTacThiNghiem', 'all'],
          description: 'Tên bảng hoặc "all" cho cả 2',
        },
      },
    },
  },
  {
    name: 'search_test_schedule',
    description: 'Tìm trong CongTacThiNghiem HIỆN TẠI. Lịch công tác thí nghiệm.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: 'Từ khóa tìm chung' },
        limit:   { type: 'integer', description: 'Tối đa kết quả (mặc định 30)' },
      },
    },
  },
  {
    name: 'search_test_history',
    description: 'Tìm trong CongTacThiNghiem_history (version cũ).',
    parameters: {
      type: 'object',
      properties: {
        version_id: { type: 'integer' },
        keyword:    { type: 'string' },
      },
      required: ['version_id'],
    },
  },
  {
    name: 'get_nas_health_status',
    description: 'Tình trạng kết nối NAS gần nhất + tỷ lệ uptime 24h.',
    parameters: { type: 'object', properties: {} },
  },
];

// ── Tool execution ────────────────────────────────────
async function executeToolCall(name: string, args: any): Promise<any> {
  const sbUrl = Deno.env.get('SUPABASE_URL')!;
  const srvKey = getServiceRoleKey();
  const restBase = `${sbUrl.replace(/\/+$/, '')}/rest/v1`;
  const authHeaders = {
    'Authorization': `Bearer ${srvKey}`,
    'apikey': srvKey,
  };

  async function pgRest(path: string): Promise<any> {
    const resp = await fetch(`${restBase}/${path}`, { headers: authHeaders });
    if (!resp.ok) {
      const txt = await resp.text();
      throw new Error(`PG REST ${resp.status}: ${txt.slice(0, 200)}`);
    }
    return resp.json();
  }

  switch (name) {
    case 'search_devices_current': {
      const params = new URLSearchParams();
      params.set('select', 'Id,Tram,Ngan_thiet_bi,Ten_thiet_bi,Phan_loai_thiet_bi,Cap_dien_ap,Hang_san_xuat,Kieu,Cong_suat,Nam_van_hanh,Serial,Doi');
      if (args.tram_filter)         params.set('Tram', `eq.${args.tram_filter}`);
      if (args.phan_loai_filter)    params.set('Phan_loai_thiet_bi', `eq.${args.phan_loai_filter}`);
      if (args.hang_filter)         params.set('Hang_san_xuat', `eq.${args.hang_filter}`);
      if (args.cap_dien_ap_filter)  params.set('Cap_dien_ap', `eq.${args.cap_dien_ap_filter}`);
      if (args.nam_van_hanh_min)    params.set('Nam_van_hanh', `gte.${args.nam_van_hanh_min}`);
      if (args.nam_van_hanh_max)    params.append('Nam_van_hanh', `lte.${args.nam_van_hanh_max}`);
      if (args.keyword) {
        params.set('or', `(Ten_thiet_bi.ilike.*${args.keyword}*,Kieu.ilike.*${args.keyword}*,Serial.ilike.*${args.keyword}*)`);
      }
      params.set('limit', '50');
      const rows = await pgRest(`TongHopThietBi?${params}`);
      return { count: rows.length, rows };
    }

    case 'search_devices_history': {
      const params = new URLSearchParams();
      params.set('select', 'Id,Tram,Ngan_thiet_bi,Ten_thiet_bi,Phan_loai_thiet_bi,Hang_san_xuat,Kieu,Serial');
      params.set('version_id', `eq.${args.version_id}`);
      if (args.tram_filter)      params.set('Tram', `eq.${args.tram_filter}`);
      if (args.phan_loai_filter) params.set('Phan_loai_thiet_bi', `eq.${args.phan_loai_filter}`);
      if (args.keyword) {
        params.set('or', `(Ten_thiet_bi.ilike.*${args.keyword}*,Kieu.ilike.*${args.keyword}*,Serial.ilike.*${args.keyword}*)`);
      }
      params.set('limit', '50');
      const rows = await pgRest(`TongHopThietBi_history?${params}`);
      const versionInfo = await pgRest(`data_versions?id=eq.${args.version_id}&select=version_number,note,created_at,row_count`);
      return { 
        version_info: versionInfo[0] || null, 
        count: rows.length, 
        rows,
      };
    }

    case 'get_device_versions': {
      let filter = '';
      if (args.serial) {
        filter = `Serial=eq.${encodeURIComponent(args.serial)}`;
      } else if (args.tram && args.ten_thiet_bi) {
        filter = `Tram=eq.${encodeURIComponent(args.tram)}&Ten_thiet_bi=eq.${encodeURIComponent(args.ten_thiet_bi)}`;
      } else {
        return { error: 'Cần cung cấp serial HOẶC tram+ten_thiet_bi' };
      }
      
      // Tìm trong history
      const historyRows = await pgRest(`TongHopThietBi_history?${filter}&select=version_id,Tram,Ngan_thiet_bi,Ten_thiet_bi,Hang_san_xuat,Kieu,Cong_suat,Nam_van_hanh,Serial,Doi&order=version_id.desc&limit=50`);
      
      // Lấy version metadata
      const versionIds = [...new Set(historyRows.map((r: any) => r.version_id))];
      let versionsMeta: any[] = [];
      if (versionIds.length > 0) {
        versionsMeta = await pgRest(`data_versions?id=in.(${versionIds.join(',')})&select=id,version_number,created_at,note`);
      }
      
      // Tìm trong current
      const currentRows = await pgRest(`TongHopThietBi?${filter}&select=Tram,Ngan_thiet_bi,Ten_thiet_bi,Hang_san_xuat,Kieu,Cong_suat,Nam_van_hanh,Serial,Doi`);
      
      return {
        current: currentRows,
        history_count: historyRows.length,
        history_rows: historyRows,
        versions_meta: versionsMeta,
      };
    }

    case 'get_devices_at_location': {
      const params = new URLSearchParams();
      params.set('select', 'Id,Ngan_thiet_bi,Ten_thiet_bi,Phan_loai_thiet_bi,Cap_dien_ap,Hang_san_xuat,Serial,Nam_van_hanh');
      params.set('Tram', `eq.${args.tram}`);
      if (args.ngan_thiet_bi) params.set('Ngan_thiet_bi', `eq.${args.ngan_thiet_bi}`);
      params.set('order', 'Cap_dien_ap.asc,Ngan_thiet_bi.asc');
      params.set('limit', '200');
      const rows = await pgRest(`TongHopThietBi?${params}`);
      return { tram: args.tram, count: rows.length, rows };
    }

    case 'count_aggregations': {
      const params = new URLSearchParams();
      params.set('select', `${args.group_by}`);
      if (args.phan_loai_filter) params.set('Phan_loai_thiet_bi', `eq.${args.phan_loai_filter}`);
      if (args.tram_filter)      params.set('Tram', `eq.${args.tram_filter}`);
      params.set('limit', '20000');
      const rows = await pgRest(`TongHopThietBi?${params}`);
      const counter: Record<string, number> = {};
      for (const r of rows) {
        const k = String(r[args.group_by] ?? '(rỗng)');
        counter[k] = (counter[k] ?? 0) + 1;
      }
      const sorted = Object.entries(counter)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .slice(0, args.limit ?? 20);
      return { 
        group_by: args.group_by, 
        total: rows.length, 
        top: sorted.map(([k, v]) => ({ value: k, count: v })),
      };
    }

    case 'list_data_versions': {
      let filter = '';
      if (args.table_name && args.table_name !== 'all') {
        filter = `&table_name=eq.${args.table_name}`;
      }
      const rows = await pgRest(`data_versions?select=id,table_name,version_number,row_count,note,csv_file_name,uploaded_email,created_at&order=created_at.desc${filter}&limit=20`);
      return { count: rows.length, versions: rows };
    }

    case 'search_test_schedule': {
      const limit = args.limit || 30;
      let url = `CongTacThiNghiem?limit=${limit}&order=id.desc`;
      if (args.keyword) {
        // Tìm trong tất cả cột text (PostgREST limit, dùng RPC sẽ tốt hơn)
        url = `CongTacThiNghiem?or=(*.ilike.*${args.keyword}*)&limit=${limit}`;
      }
      try {
        const rows = await pgRest(url);
        return { count: rows.length, rows: rows.slice(0, limit) };
      } catch (e) {
        return { error: 'Bảng CongTacThiNghiem chưa có data hoặc lỗi truy vấn: ' + (e as Error).message };
      }
    }

    case 'search_test_history': {
      const params = new URLSearchParams();
      params.set('version_id', `eq.${args.version_id}`);
      params.set('limit', '30');
      const rows = await pgRest(`CongTacThiNghiem_history?${params}`);
      return { count: rows.length, rows };
    }

    case 'get_nas_health_status': {
      const latest = await pgRest(`nas_health_log?order=id.desc&limit=1`);
      const recent = await pgRest(`nas_health_log?checked_at=gte.${new Date(Date.now() - 24*60*60*1000).toISOString()}&select=status`);
      const okCount = recent.filter((r: any) => r.status === 'ok').length;
      const total = recent.length;
      return {
        latest_status: latest[0]?.status ?? null,
        latest_at: latest[0]?.checked_at ?? null,
        latest_detail: latest[0]?.detail ?? null,
        last_response_ms: latest[0]?.response_ms ?? null,
        uptime_24h_pct: total > 0 ? Math.round((okCount * 100 / total) * 10) / 10 : null,
        total_checks_24h: total,
      };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── Gemini API ─────────────────────────────────────
async function callGemini(messages: any[], apiKey: string): Promise<any> {
  const resp = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: messages,
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      tools: [{ functionDeclarations: TOOLS }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1500,
      },
    }),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Gemini API ${resp.status}: ${txt.slice(0, 300)}`);
  }
  return resp.json();
}

async function logChat(payload: any): Promise<void> {
  try {
    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const srvKey = getServiceRoleKey();
    await fetch(`${sbUrl.replace(/\/+$/, '')}/rest/v1/chat_history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${srvKey}`,
        'apikey': srvKey,
        'Prefer': 'return=minimal',
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.warn('Log failed:', e);
  }
}

// ════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ════════════════════════════════════════════════════════════════

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CACHE HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function hashQuestion(q: string): Promise<string> {
  const norm = q.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  const buf = new TextEncoder().encode(norm);
  const hashBuf = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

async function lookupCache(supabase: any, hash: string) {
  const { data, error } = await supabase.rpc('lookup_chat_cache', { p_hash: hash });
  if (error || !data || data.length === 0) return null;
  return data[0];
}

async function saveCache(supabase: any, hash: string, question: string, answer: string, toolCalls: any[]) {
  const referencesHistory = toolCalls.some((tc: any) => 
    tc.name === 'search_devices_history' || 
    tc.name === 'search_test_history' || 
    tc.name === 'get_device_versions' ||
    tc.name === 'list_data_versions'
  );
  
  await supabase.rpc('save_chat_cache', {
    p_hash: hash,
    p_question: question,
    p_answer: answer,
    p_tool_calls: toolCalls,
    p_references_history: referencesHistory,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Chỉ POST' }), {
      status: 405, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const t0 = Date.now();
  let user: any = null;
  let question = '';
  const toolCalls: any[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cần đăng nhập' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const sbUrl = Deno.env.get('SUPABASE_URL')!;
    const srvKey = getServiceRoleKey();

    // Verify user
    const userResp = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: { 'Authorization': authHeader, 'apikey': srvKey },
    });
    if (!userResp.ok) {
      return new Response(JSON.stringify({ error: 'Phiên hết hạn' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    user = await userResp.json();

    // Check admin
    const profileResp = await fetch(
      `${sbUrl}/rest/v1/evn_user_profiles?id=eq.${user.id}&select=role`,
      { headers: { 'Authorization': `Bearer ${srvKey}`, 'apikey': srvKey } }
    );
    const profiles = await profileResp.json();
    const isAdmin = user.email === ADMIN_EMAIL || profiles[0]?.role === 'admin';
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Chỉ admin được dùng chatbot' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Parse body
    const body = await req.json();
    question = (body.message ?? '').trim();
    if (!question) throw new Error('Thiếu message');
    if (question.length > 2000) throw new Error('Câu hỏi quá dài');

    // ━━ CACHE LOOKUP ━━
    const qHash = await hashQuestion(question);
    const cached = await lookupCache(supabase, qHash);
    if (cached) {
      console.log('[chat-query] Cache HIT (hit_count:', cached.hit_count, ')');
      
      // Log to chat_history (so analytics still work)
      await logChat({
        user_id: user.id,
        user_email: user.email,
        question,
        answer: cached.answer,
        tool_calls: cached.tool_calls ?? [],
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - t0,
      });
      
      return new Response(JSON.stringify({
        answer: cached.answer,
        toolCalls: cached.tool_calls ?? [],
        usage: { input_tokens: 0, output_tokens: 0, duration_ms: Date.now() - t0 },
        from_cache: true,
        cached_at: cached.cached_at,
        cache_hits: cached.hit_count,
      }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    console.log('[chat-query] Cache MISS');

    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY chưa set');

    // Multi-turn tool calling
    let messages: any[] = [{ role: 'user', parts: [{ text: question }] }];
    let finalAnswer = '';

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      const result = await callGemini(messages, geminiKey);
      const usage = result.usageMetadata ?? {};
      inputTokens += usage.promptTokenCount ?? 0;
      outputTokens += usage.candidatesTokenCount ?? 0;

      const candidate = result.candidates?.[0];
      if (!candidate) throw new Error('Gemini không trả candidate');

      const parts = candidate.content?.parts ?? [];
      const functionCalls = parts.filter((p: any) => p.functionCall);
      const textParts = parts.filter((p: any) => p.text);

      if (functionCalls.length === 0 && textParts.length > 0) {
        finalAnswer = textParts.map((p: any) => p.text).join('\n').trim();
        break;
      }
      if (functionCalls.length === 0) {
        finalAnswer = '(Không có response)';
        break;
      }

      messages.push({ role: 'model', parts });

      const functionResponses = [];
      for (const fc of functionCalls) {
        const fName = fc.functionCall.name;
        const fArgs = fc.functionCall.args ?? {};
        console.log(`[chat-query] Tool: ${fName}(${JSON.stringify(fArgs).slice(0, 200)})`);
        toolCalls.push({ name: fName, args: fArgs });

        let toolResult;
        try {
          toolResult = await executeToolCall(fName, fArgs);
        } catch (e) {
          toolResult = { error: (e as Error).message };
        }

        functionResponses.push({
          functionResponse: { name: fName, response: toolResult },
        });
      }

      messages.push({ role: 'function', parts: functionResponses });
    }

    if (!finalAnswer) finalAnswer = 'Tôi không trả lời được câu này. Vui lòng thử câu khác.';

    const duration = Date.now() - t0;

    await logChat({
      user_id: user.id,
      user_email: user.email,
      question,
      answer: finalAnswer,
      tool_calls: toolCalls,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      duration_ms: duration,
    });

    // ━━ SAVE TO CACHE ━━
    try {
      await saveCache(supabase, qHash, question, finalAnswer, toolCalls);
      console.log('[chat-query] Saved to cache');
    } catch (e) {
      console.warn('[chat-query] Save cache failed:', e);
      // Non-fatal — continue
    }

    return new Response(JSON.stringify({
      answer: finalAnswer,
      toolCalls,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, duration_ms: duration },
    }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });

  } catch (err) {
    const e = err as any;
    const status = e?.status ?? 500;
    const msg = e?.message ?? String(err);
    console.error('[chat-query]', status, msg);

    if (user) {
      await logChat({
        user_id: user.id,
        user_email: user.email,
        question,
        tool_calls: toolCalls,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        duration_ms: Date.now() - t0,
        error: msg,
      });
    }

    return new Response(JSON.stringify({ error: msg }), { 
      status: status >= 400 && status < 500 ? status : 500, 
      headers: { ...CORS, 'Content-Type': 'application/json' } 
    });
  }
});
