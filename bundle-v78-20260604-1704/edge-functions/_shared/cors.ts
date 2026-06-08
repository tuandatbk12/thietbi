// CORS headers chung cho mọi Edge Function của EVNHANOI
// Đặt origin = '*' để dùng được cả từ github.io, localhost dev, và mọi domain.
// Nếu cần lock chặt, đổi sang origin cụ thể.
export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin'  : '*',
  'Access-Control-Allow-Methods' : 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers' : 'authorization, x-client-info, apikey, content-type, ngrok-skip-browser-warning',
  'Access-Control-Max-Age'       : '86400',
};

export function jsonResponse(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json; charset=utf-8',
      ...(extraHeaders as Record<string, string>),
    },
  });
}

export function errorResponse(message: string, status = 500, code?: string): Response {
  return jsonResponse({ error: message, code: code ?? null }, status);
}

export function handlePreflight(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  return null;
}
