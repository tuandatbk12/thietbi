// ════════════════════════════════════════════════════════════════
// Edge Function: bbtn-ocr-extract (v5 - higher accuracy)
//
// Mới so với v4:
//   + Nhận cả "Thí nghiệm" + "Kiểm định" trong tiêu đề BBTN
//   + Thêm field SFRA (boolean) cho MBA (Sweep Frequency Response Analysis)
//   + Phân biệt MBA vs MBATD chính xác hơn (theo điện áp + "trung thế")
//   + Thêm field tiet_dien cho Cáp (format "1x630 mm²")
// ════════════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// V89: import helpers fetch NAS (stream qua server, tránh browser load file lớn)
import { getNasConfig, nasUrl, nasAuthHeader, nasFetch, safeJoinPath, normalizeClientPath } from '../_shared/nas.ts';

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

const SYSTEM_PROMPT = `Bạn là chuyên gia OCR Biên Bản Thí Nghiệm (BBTN) thiết bị điện EVN Hà Nội.

NHIỆM VỤ: Đọc file BBTN và trả về JSON.

QUAN TRỌNG:
- TIÊU ĐỀ BBTN có thể bắt đầu bằng "BIÊN BẢN" rồi đến "Kiểm định ..." HOẶC "Thí nghiệm ..." 
  → CẢ HAI ĐỀU LÀ CÙNG LOẠI THIẾT BỊ (chỉ khác từ ngữ).
  VD: "Kiểm định máy biến áp" và "Thí nghiệm máy biến áp" → CẢ HAI đều là MBA
- 1 file PDF có thể chứa NHIỀU thiết bị → HÃY TRÍCH HẾT MỌI THIẾT BỊ + GHI NHẬN SỐ TRANG

ĐỊNH DẠNG TRẢ VỀ:
- 1 thiết bị → JSON OBJECT đơn lẻ
- 2+ thiết bị → JSON ARRAY các object

═══════════════════════════════════════════════════════════════
22 LOẠI BBTN (loai_thiet_bi)
═══════════════════════════════════════════════════════════════

NHÓM A: Thiết bị đơn lẻ (có Kiểu/Hãng/Serial):
| Code      | Tiêu đề BBTN (cả "Kiểm định" và "Thí nghiệm" đều OK) | Format ten_thiet_bi |
|-----------|---------------------------------------------------|---------------------|
| MC        | "máy cắt"                                          | MC <số>             |
| MBA       | "máy biến áp" (Test report of POWER transformer)  | MBA <ký hiệu>       |
| MBATD     | "máy biến áp tự dùng" / "máy biến áp trung thế"   | MBATD <số>          |
|           | (Test report of DISTRIBUTION transformer)         |                     |
| DCL       | "dao cách ly"                                      | DCL <số>            |
| TĐ        | "dao tiếp địa" (3 pha)                             | TĐ <số>             |
| TĐ1pha    | "dao tiếp địa 1 pha"                               | TĐ1pha <số>         |
| TI        | "máy biến dòng điện"                               | TI <số>             |
| TI0       | "máy biến dòng điện thứ tự không"                  | TI0 <số>            |
| TIchânsứ  | "máy biến dòng điện chân sứ" (KHÔNG có dấu cách!)  | TIchânsứ <kV>       |
| TU        | "máy biến điện áp"                                 | TU <số>             |
| CSV       | "chống sét van"                                    | CSV <số>            |
| Cáp       | "cáp lực" (Test report of power cable)             | Cáp <số>            |
| GIS       | "hợp bộ GIS"                                       | GIS <số>            |
| HGIS      | "hợp bộ HGIS"                                      | HGIS <số>           |
| TBN       | "tụ bù"                                            | TBN <số>            |
| TC        | "thanh cái" (Test report of bus bar)               | TC <ký hiệu>        |
| K         | "kháng điện"                                       | K <số>              |
| FCO       | "cầu chì tự rơi" / "FCO"                           | FCO <ký hiệu>       |

NHÓM B: BBTN tổng hợp (Kiểu/Hãng/Serial = null):
| RL    | "rơ le"                            | RL <số ngăn>            |
| THM   | "tổng hợp mạch ngăn lộ"             | THM <số ngăn>           |
| HTTĐ  | "hệ thống tiếp địa"                | HTTĐ trạm               |

NHÓM C: BBTN dầu/khí:
| Dầu   | "dầu cách điện" / "khí hòa tan trong dầu"  | "Dầu OLTC" hoặc "Dầu MBA Tx" |

═══════════════════════════════════════════════════════════════
QUY TẮC PHÂN BIỆT MBA vs MBATD (rất quan trọng):
═══════════════════════════════════════════════════════════════

MBA = Máy biến áp lực (Power transformer) cao thế:
- Tiêu đề tiếng Anh: "Test report of power transformer"
- Điện áp định mức ≥ 110kV (vd: 115/23/10.5 kV, 220kV)
- Công suất lớn (vd: 63000 kVA, 25000 kVA)
- Vị trí: "MBA T1", "MBA T3"
- LOẠI: "MBA"

MBATD = Máy biến áp tự dùng / Trung thế (Distribution transformer):
- Tiêu đề tiếng Anh: "Test report of distribution transformer"
- Tiêu đề tiếng Việt: "máy biến áp trung thế" / "máy biến áp tự dùng"
- Điện áp định mức < 110kV (vd: 23-22-20-21.45-22 kV, 22/0.4 kV)
- Công suất nhỏ (vd: 250 kVA, 100 kVA)
- Vị trí: "MBA TD42", "MBATD 42"
- LOẠI: "MBATD"

═══════════════════════════════════════════════════════════════
17 TRƯỜNG CẦN TRÍCH (mỗi thiết bị):
═══════════════════════════════════════════════════════════════

1. **loai_thiet_bi** (text): 1 trong 22 mã (MC, MBA, MBATD, ...).

2. **tram** (text): Chỉ ký hiệu (E1.20, E1.8). Bỏ "TBA", "Trạm", "110kV".

3. **ten_thiet_bi** (text): LẤY TỪ "Vị trí lắp đặt".
   - "MBA T2-TBA E1.20" → "MBA T2"
   - "MBA TD42-TBA E1.20" → "MBATD 42"
   - "Từ Tủ C42 đến Tủ TU C42-TBA E1.20" → "Cáp C42-TU C42"
   - DTĐ → "TĐ <số>" (bỏ chữ D)
   - TIchânsứ, TĐ1pha KHÔNG có dấu cách
   - CSV (Chống sét van): LẤY TỪ vị trí, KHÔNG dùng serial. VD "4T2- TBA E1.1 Đông Anh" → "CSV 4T2"; "TU C44- TBA E1.9" → "CSV C44".
   - ⚠️ QUY TẮC SỐ RECORDS CHO CSV:
     • Nếu trường "Số chế tạo (Serial number):" ở đầu BBTN TRỐNG → CHỈ TẠO 1 RECORD DUY NHẤT (so_che_tao=null). KHÔNG tách 3 pha. KHÔNG bịa số.
     • Nếu trường serial ghi 1 số DUY NHẤT → CHỈ 1 record với serial đó.
     • CHỈ tạo 3 records (cho 3 pha) khi BBTN ghi RÕ RÀNG 3 serial KHÁC NHAU cho 3 pha riêng biệt (vd "Pha A: SN001, Pha B: SN002, Pha C: SN003" hoặc bảng có cột Pha với 3 serial khác nhau).
     • TUYỆT ĐỐI KHÔNG lấy số từ bảng đo (MΩ, μA, kV) làm serial pha.

4. **kieu** (text): Kiểu/model. NULL cho THM/HTTĐ/RL/Dầu.

5. **so_che_tao** (text): Serial number CỦA THIẾT BỊ. ⚠️⚠️⚠️ QUAN TRỌNG:
    - CHỈ đọc từ trường "Số chế tạo (Serial number):" trong PHẦN THÔNG TIN THIẾT BỊ ở ĐẦU BBTN (cùng phần với Hãng SX, Năm SX, Kiểu).
    - TUYỆT ĐỐI KHÔNG đọc số từ các BẢNG ĐO (vd "Đo điện trở cách điện", "Đo dòng rò", "Điện áp tham chiếu"...).
    - Trong các bảng đo, cột tiêu đề có thể ghi "Số chế tạo" nhưng các Ô bên dưới là GIÁ TRỊ ĐO (MΩ, μA, kV...), KHÔNG phải serial.
    - Nếu trường "Số chế tạo" ở phần thông tin TRỐNG → trả NULL. KHÔNG bịa, KHÔNG đoán, KHÔNG lấy giá trị từ bảng đo.
    - VD: Bảng "Điện trở cách điện" cột "Trước Irò 31000" → 31000 là MΩ, KHÔNG phải serial.
    - Giữ nguyên số 0 đầu nếu có serial thật.

6. **hang_san_xuat** (text): Hãng (EEMC, HANAKA, ABB, SIEMENS...). NULL cho THM/HTTĐ/RL/Dầu.

7. **nuoc_san_xuat** (text): Nước (Việt Nam, Germany...). NULL nếu trống.

8. **nam_san_xuat** (number): Năm SX dạng NUMBER.

9. **dien_ap** (text): Điện áp định mức. VD: "115/23/10.5 kV", "23-22-20-21.45-22 kV", "22 kV".

10. **dong_dien** (text): Dòng điện định mức.
    - NULL cho: CSV, Tụ bù, Cáp, Dầu, HTTĐ, THM, RL, TĐ.

11. **ngay_kiem_dinh** (text YYYY-MM-DD):
    - LẤY TỪ "Ngày kiểm định" HOẶC "Ngày thí nghiệm" (cả 2 đều OK)
    - Chuyển DD/MM/YYYY → YYYY-MM-DD

12. **dang_kiem_dinh** (text):
    - LẤY TỪ "Dạng kiểm định" HOẶC "Dạng thí nghiệm" (cả 2 đều OK)
    - Giá trị: "Lần đầu" / "Định kỳ" / "Kiểm tra chất lượng" / "Đột xuất" / "Sửa chữa" / "CBM"

13. **vi_tri_lap_dat** (text): Full text "Vị trí lắp đặt (Site):".

14. **page_start** (number): Trang bắt đầu BBTN (file ảnh = 1).
15. **page_end** (number): Trang kết thúc. BBTN 1 trang → page_end = page_start.

═══════════════════════════════════════════════════════════════
16. **sfra** (boolean): CHỈ ÁP DỤNG cho MBA (NULL cho mọi loại khác)
═══════════════════════════════════════════════════════════════
- Tìm mục "Đo đáp ứng tần số quét (Sweep frequency response analysis)" trong "II. HẠNG MỤC KIỂM TRA"
- Kiểm tra cột "Phạm vi (Scope)" và "Kết quả (Result)":
  • Có dấu X (Đạt/Pass) trong cột → sfra = true
  • Cột trống → sfra = false
- Với MBATD, Cáp, MC, DCL, v.v. → sfra = null (vì không có mục này)

VÍ DỤ:
- BBTN có dòng "10 | Đo đáp ứng tần số quét | X | X" → sfra = true
- BBTN có dòng "10 | Đo đáp ứng tần số quét | (trống) | (trống)" → sfra = false
- BBTN không phải MBA → sfra = null

═══════════════════════════════════════════════════════════════
17. **tiet_dien** (text): CHỈ ÁP DỤNG cho Cáp (NULL cho mọi loại khác)
═══════════════════════════════════════════════════════════════
- Tìm mục "Tiết diện (Section):"
- Format: "<số sợi>x<diện tích> mm²"
- VÍ DỤ:
  • "1x630 mm²" → tiet_dien = "1x630 mm²"
  • "3x50 mm²" → tiet_dien = "3x50 mm²"
  • Không có → null
- Với MBA, MC, DCL, v.v. → tiet_dien = null

═══════════════════════════════════════════════════════════════
QUY TẮC CHUNG:
═══════════════════════════════════════════════════════════════
- Trả về CHỈ JSON, KHÔNG markdown, KHÔNG \`\`\`json wrapper
- Trường không đọc được → null
- KHÔNG tự suy đoán/sửa giá trị
- KHÔNG dịch ngôn ngữ
- Ngày luôn YYYY-MM-DD

Trả về JSON với 17 trường trên.`;

async function uploadBytesToGeminiFileAPI(bytes: Uint8Array, mimeType: string, fileName: string): Promise<string> {
  // V97: nhan bytes truc tiep, KHONG decode base64 (tiet kiem RAM tranh OOM 546)
  console.log(`[File API] Uploading ${fileName} (${(bytes.length/1024/1024).toFixed(2)}MB raw)...`);
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
  if (!initRes.ok) throw new Error(`File API init fail: ${initRes.status} ${await initRes.text()}`);
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
  if (!uploadRes.ok) throw new Error(`File API upload fail: ${uploadRes.status}`);

  const uploadData = await uploadRes.json();
  const fileUri = uploadData?.file?.uri;
  const fileName_ = uploadData?.file?.name;
  if (!fileUri) throw new Error("No file URI returned");

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

// V103: loi rieng khi Gemini het quota (429) / qua tai (503) sau khi het retry
class GeminiBusyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "GeminiBusyError";
    this.status = status;
  }
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
  // V99: gioi han retry de KHONG vuot 60s wall-clock free tier (tranh shutdown -> HTTP 546)
  const MAX_RETRIES = 3;
  while (true) {
    geminiRes = await fetch(`${GEMINI_GENERATE_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });
    if ((geminiRes.status !== 503 && geminiRes.status !== 429) || retryCount >= MAX_RETRIES) break;
    retryCount++;
    // V99: 503 backoff nhe (2/3/4s) thay vi 2/4/6...; 429 quota van doc retry-in nhung cap 10s
    let waitMs = 1000 * (retryCount + 1); // 2s, 3s, 4s
    if (geminiRes.status === 429) {
      const errText = await geminiRes.clone().text();
      const m = errText.match(/retry in (\d+(?:\.\d+)?)s/i);
      // V102: 429 = het quota, retry it va nhanh (cap 5s) vi retry lau cung vo ich khi quota can
      if (m) waitMs = Math.min((Math.ceil(parseFloat(m[1])) + 1) * 1000, 5000); // cap 5s
      else waitMs = 4000;
      console.log(`[Gemini] 429 quota, wait ${waitMs/1000}s (retry ${retryCount}/${MAX_RETRIES})`);
    } else {
      console.log(`[Gemini] 503, wait ${waitMs/1000}s (retry ${retryCount}/${MAX_RETRIES})`);
    }
    await new Promise(r => setTimeout(r, waitMs));
  }
  // V99: het retry van 503/429 -> tra loi ro rang, KHONG de Edge Function chay tiep roi shutdown
  if (geminiRes.status === 503 || geminiRes.status === 429) {
    const busyMsg = geminiRes.status === 429 ? 'Gemini het quota (429)' : 'Gemini qua tai (503)';
    console.error(`[Gemini] Het ${MAX_RETRIES} retry, van ${geminiRes.status} -> tra loi`);
    // V103: throw (truoc day return Response -> caller destructure sai -> text.replace loi -> 502)
    throw new GeminiBusyError(`${busyMsg} sau ${MAX_RETRIES} lan thu. Thu lai sau vai phut.`, geminiRes.status);
  }
  const elapsed = Date.now() - startTime;
  if (!geminiRes.ok) throw new Error(`Gemini ${geminiRes.status}: ${(await geminiRes.text()).slice(0, 500)}`);
  const geminiData = await geminiRes.json();
  // V102: dam bao text luon la string (Gemini doi khi tra parts khong chuan -> .slice loi)
  let text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    text = text == null ? "" : (typeof text === "object" ? JSON.stringify(text) : String(text));
  }
  if (!text) throw new Error("Gemini empty response");
  return { text, elapsed, retries: retryCount };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  if (!GEMINI_API_KEY) return jsonResponse({ error: "GEMINI_API_KEY not configured" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return jsonResponse({ error: "Invalid JSON body" }, 400); }

  // V89: hỗ trợ INPUT mới {nas_path} - server fetch file từ NAS, tránh browser load file lớn
  let { file_base64, mime_type, file_name } = body;
  const nas_path = body.nas_path;
  let nasBytes: Uint8Array | null = null; // V97: giu bytes cho file lon (upload thang FILE_API)
  
  if (nas_path && !file_base64) {
    // Stream-from-NAS mode
    console.log(`[OCR-V89] Stream from NAS: ${nas_path}`);
    try {
      const cfg = getNasConfig();
      // Normalize path để tránh path traversal
      const safePath = normalizeClientPath(nas_path, cfg.bbtnRoot);
      const remoteUrl = nasUrl(cfg, safePath);
      const t0 = Date.now();
      const upstream = await nasFetch(remoteUrl, {
        headers: nasAuthHeader(cfg),
        timeoutMs: 90000, // 90s cho file lớn
      });
      if (!upstream.ok) {
        console.error(`[OCR-V89] NAS fetch ${upstream.status}: ${nas_path}`);
        return jsonResponse({ error: `NAS fetch failed: HTTP ${upstream.status}`, nas_path }, 502);
      }
      const bytes = new Uint8Array(await upstream.arrayBuffer());
      const fetchMs = Date.now() - t0;
      console.log(`[OCR-V97] Fetched ${(bytes.length/1024/1024).toFixed(2)}MB in ${fetchMs}ms`);
      mime_type = mime_type || 'application/pdf';
      file_name = file_name || nas_path.split('/').pop() || 'bbtn.pdf';
      // V97: GIU bytes - chi encode base64 neu file NHO (INLINE). File lon upload bytes thang -> tranh OOM 546
      const INLINE_RAW_LIMIT = 10 * 1024 * 1024;
      if (bytes.length <= INLINE_RAW_LIMIT) {
        const CHUNK = 0x8000;
        let bin = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
        }
        file_base64 = btoa(bin);
        bin = '';
        console.log(`[OCR-V97] INLINE base64 ${(file_base64.length/1024/1024).toFixed(2)}MB`);
      } else {
        nasBytes = bytes;
        console.log(`[OCR-V97] LARGE ${(bytes.length/1024/1024).toFixed(2)}MB -> upload bytes thang (no base64)`);
      }
    } catch (e) {
      console.error('[OCR-V89] Stream error:', e);
      return jsonResponse({ error: `NAS stream failed: ${(e as Error).message}`, nas_path }, 502);
    }
  }
  
  if ((!file_base64 && !nasBytes) || !mime_type) return jsonResponse({ error: "Missing fields (need file_base64 OR nas_path)" }, 400);

  const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];
  if (!ALLOWED_MIMES.includes(mime_type)) return jsonResponse({ error: `Unsupported MIME: ${mime_type}` }, 400);

  const hasBytes = nasBytes !== null;
  const b64Size = file_base64 ? file_base64.length : (nasBytes ? nasBytes.length * 1.34 : 0);
  const rawSizeMB = (b64Size * 0.75 / 1024 / 1024).toFixed(1);
  if (b64Size > FILE_API_LIMIT_B64) {
    return jsonResponse({ error: `File too large: ${rawSizeMB}MB. Max 50MB.` }, 413);
  }

  const useFileAPI = hasBytes || b64Size > INLINE_LIMIT_B64;
  console.log(`[OCR] File: ${file_name}, ${rawSizeMB}MB, mode: ${useFileAPI ? 'FILE_API' : 'INLINE'}${hasBytes ? ' (bytes thang)' : ''}`);

  try {
    let parts: any[];
    if (useFileAPI) {
      let uploadBytes: Uint8Array;
      if (hasBytes && nasBytes) {
        uploadBytes = nasBytes;
      } else {
        const binStr = atob(file_base64);
        uploadBytes = new Uint8Array(binStr.length);
        for (let i = 0; i < binStr.length; i++) uploadBytes[i] = binStr.charCodeAt(i);
      }
      const fileUri = await uploadBytesToGeminiFileAPI(uploadBytes, mime_type, file_name || "bbtn.pdf");
      parts = [{ text: SYSTEM_PROMPT }, { file_data: { mime_type, file_uri: fileUri } }];
    } else {
      parts = [{ text: SYSTEM_PROMPT }, { inline_data: { mime_type, data: file_base64 } }];
    }

    const { text, elapsed, retries } = await callGeminiOcr(parts);

    let parsed: any;
    try {
      const cleanText = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
      parsed = JSON.parse(cleanText);
    } catch {
      return jsonResponse({ error: "Gemini returned non-JSON", raw_text: String(text).slice(0, 1000) }, 502);
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

      // Normalize sfra to boolean or null
      if (item.sfra === "true" || item.sfra === "X" || item.sfra === "x") item.sfra = true;
      else if (item.sfra === "false" || item.sfra === "") item.sfra = false;
      // Force null for non-MBA
      if (item.loai_thiet_bi !== "MBA") item.sfra = null;

      // Force null tiet_dien for non-Cáp
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

    console.log(`[OCR] ${items.length} device(s), conf: ${avgConfidence.toFixed(2)}, retries: ${retries}`);

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
    // V103: het quota/qua tai -> 503 ro rang thay vi 502 mu mo
    if (err instanceof GeminiBusyError) {
      return jsonResponse({ error: err.message, gemini_status: err.status }, 503);
    }
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
