// ════════════════════════════════════════════════════════════════
// Edge Function: bbtn-ocr-extract (v5.1 - fix 502 + accuracy)
// 
// Fix v5 → v5.1:
//   - Giảm prompt size (gây boot timeout)
//   - Wrap toàn bộ trong try/catch để log lỗi rõ
//   - Giữ 4 cải tiến: Thí nghiệm prompt, SFRA, MBA/MBATD, tiet_dien
// ════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_FILE_UPLOAD_URL = `https://generativelanguage.googleapis.com/upload/v1beta/files`;
const GEMINI_FILE_GET_URL = `https://generativelanguage.googleapis.com/v1beta`;

const INLINE_LIMIT_B64 = 27_000_000;
const FILE_API_LIMIT_B64 = 67_000_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Bạn là OCR Biên Bản Thí Nghiệm (BBTN) thiết bị điện EVN Hà Nội.

QUAN TRỌNG:
- Tiêu đề BBTN có thể là "Kiểm định ..." HOẶC "Thí nghiệm ..." → CẢ HAI đều cùng loại thiết bị
- 1 file có thể có nhiều thiết bị → trả ARRAY, 1 thiết bị → OBJECT

22 LOẠI THIẾT BỊ (loai_thiet_bi):
- MC: máy cắt
- MBA: máy biến áp (≥110kV, "power transformer", 63MVA, 25MVA) → vị trí "MBA T1/T2/T3"
- MBATD: máy biến áp trung thế / tự dùng (<110kV, "distribution transformer", 250kVA) → "MBATD <số>" / "MBA TD<số>"
- DCL: dao cách ly
- TĐ: dao tiếp địa (3 pha) | TĐ1pha: dao tiếp địa 1 pha (KHÔNG cách)
- TI: máy biến dòng | TI0: TI thứ tự không | TIchânsứ: TI chân sứ (KHÔNG cách)
- TU: máy biến điện áp | CSV: chống sét van | Cáp: cáp lực
- GIS, HGIS: hợp bộ | TBN: tụ bù | TC: thanh cái | K: kháng điện | FCO: cầu chì tự rơi
- RL: rơ le | THM: tổng hợp mạch ngăn lộ | HTTĐ: hệ thống tiếp địa | Dầu: dầu/khí

PHÂN BIỆT MBA vs MBATD:
- MBA = "power transformer" hoặc ≥110kV (vd 115/23/10.5kV, 63MVA) → loai="MBA"
- MBATD = "distribution transformer" hoặc <110kV (vd 23/0.4kV, 250kVA) hoặc tiêu đề có "trung thế"/"tự dùng" → loai="MBATD"

TRƯỜNG (mỗi thiết bị):
1. loai_thiet_bi: 1 trong 22 mã trên
2. tram: ký hiệu trạm (E1.20, E1.8) - bỏ "TBA"/"Trạm"
3. ten_thiet_bi: LẤY TỪ "Vị trí lắp đặt" (vd "MBA T2-TBA E1.20" → "MBA T2"; "MBA TD42-TBA E1.20" → "MBATD 42")
4. kieu: kiểu/model (null cho THM/HTTĐ/RL/Dầu)
5. so_che_tao: serial - giữ nguyên số 0 đầu
6. hang_san_xuat: hãng (EEMC, HANAKA, ABB...) null cho THM/HTTĐ/RL/Dầu
7. nuoc_san_xuat: Việt Nam, Germany... null nếu trống
8. nam_san_xuat: NUMBER (vd 2020)
9. dien_ap: vd "115/23/10.5 kV"
10. dong_dien: null cho CSV/Cáp/Dầu/HTTĐ/THM/RL/TĐ
11. ngay_kiem_dinh: YYYY-MM-DD (chuyển từ DD/MM/YYYY) - lấy từ "Ngày kiểm định" HOẶC "Ngày thí nghiệm"
12. dang_kiem_dinh: "Lần đầu"/"Định kỳ"/"Kiểm tra chất lượng"/"Đột xuất"/"Sửa chữa"/"CBM"
13. vi_tri_lap_dat: full text "Vị trí lắp đặt"
14. page_start: số trang bắt đầu BBTN (file ảnh = 1)
15. page_end: số trang kết thúc
16. sfra: CHỈ cho MBA (loại khác null)
    - Tìm trong "II. HẠNG MỤC KIỂM TRA" mục "Đo đáp ứng tần số quét"
    - Cột Phạm vi/Kết quả có X → true; trống → false
17. tiet_dien: CHỈ cho Cáp (loại khác null)
    - Format "<số>x<diện tích> mm²" (vd "1x630 mm²", "3x50 mm²")

Trả CHỈ JSON, KHÔNG markdown, KHÔNG \`\`\`json wrapper. Trường không đọc được = null.`;

async function uploadToGeminiFileAPI(base64Data: string, mimeType: string, fileName: string): Promise<string> {
  console.log(`[FileAPI] Uploading ${fileName}...`);
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const fileSize = bytes.length;

  const initRes = await fetch(`${GEMINI_FILE_UPLOAD_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(fileSize),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: fileName } }),
  });
  if (!initRes.ok) throw new Error(`FileAPI init fail: ${initRes.status}`);
  const uploadUrl = initRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("No upload URL");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(fileSize),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });
  if (!uploadRes.ok) throw new Error(`FileAPI upload fail: ${uploadRes.status}`);

  const uploadData = await uploadRes.json();
  const fileUri = uploadData?.file?.uri;
  const fileName_ = uploadData?.file?.name;
  if (!fileUri) throw new Error("No file URI");

  let state = uploadData?.file?.state || "PROCESSING";
  let attempts = 0;
  while (state === "PROCESSING" && attempts < 12) {
    await new Promise(r => setTimeout(r, 2000));
    attempts++;
    const statusRes = await fetch(`${GEMINI_FILE_GET_URL}/${fileName_}?key=${GEMINI_API_KEY}`);
    if (statusRes.ok) {
      const statusData = await statusRes.json();
      state = statusData.state;
    }
  }
  if (state !== "ACTIVE") throw new Error(`File not ACTIVE, state=${state}`);
  return fileUri;
}

async function callGeminiOcr(parts: any[]): Promise<{ text: string; elapsed: number; retries: number }> {
  const geminiBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1, topP: 0.95, topK: 40,
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
    },
  };
  const startTime = Date.now();
  let geminiRes: Response;
  let retryCount = 0;
  while (true) {
    geminiRes = await fetch(`${GEMINI_GENERATE_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
    if ((geminiRes.status !== 503 && geminiRes.status !== 429) || retryCount >= 3) break;
    retryCount++;
    console.log(`[Gemini] ${geminiRes.status}, retry ${retryCount}/3`);
    await new Promise(r => setTimeout(r, 2000 * retryCount));
  }
  const elapsed = Date.now() - startTime;
  if (!geminiRes.ok) {
    const errText = await geminiRes.text();
    throw new Error(`Gemini ${geminiRes.status}: ${errText.slice(0, 300)}`);
  }
  const geminiData = await geminiRes.json();
  const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  if (!text) {
    console.error(`[Gemini] Empty response, full data:`, JSON.stringify(geminiData).slice(0, 500));
    throw new Error("Gemini empty response");
  }
  return { text, elapsed, retries: retryCount };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!GEMINI_API_KEY) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);

  let body: any;
  try { body = await req.json(); }
  catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  const { file_base64, mime_type, file_name } = body;
  if (!file_base64 || !mime_type) return jsonResponse({ error: "Missing fields" }, 400);

  const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  if (!ALLOWED_MIMES.includes(mime_type)) return jsonResponse({ error: `Unsupported MIME: ${mime_type}` }, 400);

  const b64Size = file_base64.length;
  const rawSizeMB = (b64Size * 0.75 / 1024 / 1024).toFixed(1);
  if (b64Size > FILE_API_LIMIT_B64) {
    return jsonResponse({ error: `File too large: ${rawSizeMB}MB. Max 50MB.` }, 413);
  }

  const useFileAPI = b64Size > INLINE_LIMIT_B64;
  console.log(`[OCR] File: ${file_name}, ${rawSizeMB}MB, mode: ${useFileAPI ? 'FILE_API' : 'INLINE'}`);

  try {
    let parts: any[];
    if (useFileAPI) {
      const fileUri = await uploadToGeminiFileAPI(file_base64, mime_type, file_name || "bbtn.pdf");
      console.log(`[OCR] Uploaded, URI: ${fileUri}`);
      parts = [{ text: SYSTEM_PROMPT }, { file_data: { mime_type, file_uri: fileUri } }];
    } else {
      parts = [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type, data: file_base64 } }];
    }

    console.log(`[OCR] Calling Gemini...`);
    const { text, elapsed, retries } = await callGeminiOcr(parts);
    console.log(`[OCR] Gemini OK, ${elapsed}ms, text length: ${text.length}`);

    let parsed: any;
    try {
      const cleanText = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleanText);
    } catch (parseErr: any) {
      console.error(`[OCR] JSON parse fail: ${parseErr.message}, text: ${text.slice(0, 500)}`);
      return jsonResponse({ error: "Gemini returned non-JSON", raw_text: text.slice(0, 1000) }, 502);
    }

    let items: any[];
    if (Array.isArray(parsed)) items = parsed;
    else if (typeof parsed === "object" && parsed !== null) items = [parsed];
    else return jsonResponse({ error: "Invalid format" }, 502);

    items = items.map((item: any) => {
      if (typeof item.nam_san_xuat === "string") {
        const yearMatch = item.nam_san_xuat.match(/\d{4}/);
        item.nam_san_xuat = yearMatch ? parseInt(yearMatch[0]) : null;
      }
      if (typeof item.page_start === "string") {
        const n = parseInt(item.page_start);
        item.page_start = isNaN(n) ? null : n;
      }
      if (typeof item.page_end === "string") {
        const n = parseInt(item.page_end);
        item.page_end = isNaN(n) ? null : n;
      }
      if (item.page_start == null) item.page_start = 1;
      if (item.page_end == null) item.page_end = item.page_start;

      // Normalize sfra
      if (item.sfra === "true" || item.sfra === "X" || item.sfra === "x") item.sfra = true;
      else if (item.sfra === "false" || item.sfra === "") item.sfra = false;
      if (item.loai_thiet_bi !== "MBA") item.sfra = null;

      // tiet_dien: null cho non-Cáp
      if (item.loai_thiet_bi !== "Cáp") item.tiet_dien = null;

      return item;
    });

    const expectedKeys = [
      "loai_thiet_bi", "tram", "ten_thiet_bi", "kieu", "so_che_tao",
      "hang_san_xuat", "nuoc_san_xuat", "nam_san_xuat",
      "dien_ap", "dong_dien", "ngay_kiem_dinh",
      "dang_kiem_dinh", "vi_tri_lap_dat"
    ];

    let totalFilled = 0, totalExpected = 0;
    for (const item of items) {
      totalExpected += expectedKeys.length;
      totalFilled += expectedKeys.filter(k => item[k] !== null && item[k] !== undefined && item[k] !== "").length;
    }
    const avgConfidence = totalExpected > 0 ? totalFilled / totalExpected : 0;

    console.log(`[OCR] Done: ${items.length} item(s), conf: ${avgConfidence.toFixed(2)}, retries: ${retries}`);

    return jsonResponse({
      success: true,
      items,
      item_count: items.length,
      fields: items.length === 1 ? items[0] : null,
      avg_confidence: avgConfidence,
      total_fields_expected: expectedKeys.length,
      elapsed_ms: elapsed,
      retries,
      mode: useFileAPI ? "file_api" : "inline",
      file_size_mb: parseFloat(rawSizeMB),
      model: GEMINI_MODEL,
    }, 200);

  } catch (err: any) {
    console.error(`[OCR] Exception: ${err.message}`);
    return jsonResponse({ error: "OCR failed", detail: err.message }, 502);
  }
});

function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
