// ════════════════════════════════════════════════════════════════
// BBTN Smart Split v2 — Cải tiến từ v1
// 
// v2 fixes:
//   1. Detect boundary bằng "TỔNG CÔNG TY" (ASCII, không sợ Unicode)
//   2. Detect type: "Kiểm định" vs "Thí nghiệm" cho mỗi BBTN
//   3. Skip BBTN "Kiểm định" (chỉ OCR "Thí nghiệm")
//   4. Build chunks chỉ với BBTN cần OCR
// ════════════════════════════════════════════════════════════════
(function() {
  if (window._bbtnSmartSplitV2Installed) return;
  window._bbtnSmartSplitV2Installed = true;

  const MAX_PAGES_PER_CHUNK = 4;
  const MAX_CONCURRENT = 3;

  async function _loadLib(name, url) {
    if (window[name]) return window[name];
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = url;
      s.onload = () => resolve(window[name]);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function _ensureLibs() {
    if (!window.pdfjsLib) {
      await _loadLib('pdfjsLib', 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    }
    if (!window.PDFLib) {
      await _loadLib('PDFLib', 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js');
    }
  }

  // ────────────────────────────────────────────────────────────
  // Detect BBTN boundaries + type
  // Returns: [ { startPage (0-based), type: 'Kiểm định'|'Thí nghiệm'|'Unknown' } ]
  // ────────────────────────────────────────────────────────────
  async function _detectBbtns(file) {
    await _ensureLibs();
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = pdf.numPages;

    const bbtns = [];
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');
      const textUpper = text.toUpperCase();

      // Check trang đầu BBTN: phải có "TỔNG CÔNG TY" (header EVN Hanoi)
      // ASCII match đảm bảo không sợ Unicode encoding
      if (textUpper.includes('TỔNG CÔNG TY') || textUpper.includes('TONG CONG TY')) {
        // Identify type: "Kiểm định" hay "Thí nghiệm"
        let type = 'Unknown';
        if (text.includes('Kiểm định') || text.includes('Kiem dinh') || text.includes('Kiểm tra')) {
          type = 'Kiểm định';
        } else if (text.includes('Thí nghiệm') || text.includes('Thi nghiem')) {
          type = 'Thí nghiệm';
        }
        bbtns.push({ startPage: i - 1, type, pageNum: i });
      }
    }

    return { bbtns, totalPages };
  }

  // ────────────────────────────────────────────────────────────
  // Filter: skip "Kiểm định" nếu có "Thí nghiệm" gần đó
  // Logic: Với mỗi cặp Kiểm định + Thí nghiệm liên tiếp → giữ Thí nghiệm
  // ────────────────────────────────────────────────────────────
  function _filterBbtns(bbtns) {
    const filtered = [];
    for (const bbtn of bbtns) {
      // Bỏ qua "Kiểm định" nếu có
      if (bbtn.type === 'Kiểm định') {
        continue;
      }
      filtered.push(bbtn);
    }
    // Nếu không có "Thí nghiệm" nào (toàn Kiểm định) → giữ all
    if (filtered.length === 0) {
      console.warn('[SmartSplit v2] No "Thí nghiệm" found, falling back to all BBTNs');
      return bbtns;
    }
    return filtered;
  }

  // ────────────────────────────────────────────────────────────
  // Build chunks từ BBTNs đã filter
  // Mỗi chunk: { startPage, endPage } (0-based, inclusive), ≤ MAX_PAGES_PER_CHUNK
  // ────────────────────────────────────────────────────────────
  function _buildChunks(filteredBbtns, allBbtns, totalPages) {
    // Tính phạm vi từng BBTN: từ startPage đến (start của BBTN kế tiếp - 1)
    // Phạm vi tính theo allBbtns để có endPage chính xác
    const bbtnRanges = filteredBbtns.map(bbtn => {
      // Tìm vị trí trong allBbtns
      const idxAll = allBbtns.findIndex(b => b.startPage === bbtn.startPage);
      const nextStart = idxAll + 1 < allBbtns.length ? allBbtns[idxAll + 1].startPage : totalPages;
      return {
        start: bbtn.startPage,
        end: nextStart - 1,
        pages: nextStart - bbtn.startPage,
        type: bbtn.type,
      };
    });

    // Gom các BBTN gần nhau thành chunks ≤ MAX_PAGES_PER_CHUNK
    const chunks = [];
    let curStart = bbtnRanges[0].start;
    let curEnd = bbtnRanges[0].end;

    for (let i = 1; i < bbtnRanges.length; i++) {
      const r = bbtnRanges[i];
      const newTotal = r.end - curStart + 1;

      // Chỉ gộp nếu liên tiếp + dưới limit
      if (r.start === curEnd + 1 && newTotal <= MAX_PAGES_PER_CHUNK) {
        curEnd = r.end;
      } else {
        chunks.push({ startPage: curStart, endPage: curEnd });
        curStart = r.start;
        curEnd = r.end;
      }
    }
    chunks.push({ startPage: curStart, endPage: curEnd });

    return chunks;
  }

  async function _splitPdf(file, chunks) {
    await _ensureLibs();
    const arrayBuffer = await file.arrayBuffer();
    const srcPdf = await window.PDFLib.PDFDocument.load(arrayBuffer);

    const results = [];
    for (const chunk of chunks) {
      const newPdf = await window.PDFLib.PDFDocument.create();
      const indices = [];
      for (let i = chunk.startPage; i <= chunk.endPage; i++) indices.push(i);
      const copiedPages = await newPdf.copyPages(srcPdf, indices);
      copiedPages.forEach(p => newPdf.addPage(p));
      const pdfBytes = await newPdf.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      results.push({
        blob,
        startPage: chunk.startPage + 1,
        endPage: chunk.endPage + 1,
      });
    }
    return results;
  }

  function _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function _ocrChunk(chunkBlob, startPageOffset, fileName, token, SB_URL, SB_KEY) {
    const base64 = await _blobToBase64(chunkBlob);
    const res = await fetch(`${SB_URL}/functions/v1/bbtn-ocr-extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SB_KEY,
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        file_base64: base64,
        mime_type: 'application/pdf',
        file_name: fileName,
      }),
    });
    if (!res.ok) throw new Error(`Chunk OCR fail ${res.status}`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.items)) {
      throw new Error(`Invalid response: ${JSON.stringify(data).slice(0, 200)}`);
    }
    // Adjust page_start về PDF gốc
    data.items.forEach(it => {
      if (it.page_start != null) it.page_start = it.page_start + startPageOffset - 1;
      if (it.page_end != null) it.page_end = it.page_end + startPageOffset - 1;
    });
    return data;
  }

  async function _processChunksParallel(chunks, fileName, token, SB_URL, SB_KEY, onProgress) {
    const allItems = [];
    let done = 0;

    async function _process(chunk) {
      try {
        const result = await _ocrChunk(chunk.blob, chunk.startPage, fileName, token, SB_URL, SB_KEY);
        allItems.push(...result.items);
      } catch (err) {
        console.error(`[SmartSplit v2] Chunk ${chunk.startPage}-${chunk.endPage} fail:`, err.message);
      } finally {
        done++;
        if (onProgress) onProgress(done, chunks.length);
      }
    }

    for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
      const batch = chunks.slice(i, i + MAX_CONCURRENT);
      await Promise.all(batch.map(_process));
    }
    return allItems;
  }

  // ────────────────────────────────────────────────────────────
  // PUBLIC API: Smart OCR cho 1 file
  // ────────────────────────────────────────────────────────────
  window._bbtnSmartOcrFile = async function(file, token, SB_URL, SB_KEY, onProgress) {
    // File ảnh → upload nguyên
    if (!file.type.includes('pdf')) {
      const base64 = await _blobToBase64(file);
      const res = await fetch(`${SB_URL}/functions/v1/bbtn-ocr-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          file_base64: base64,
          mime_type: file.type,
          file_name: file.name,
        }),
      });
      if (!res.ok) throw new Error(`OCR fail ${res.status}`);
      return await res.json();
    }

    // PDF: scan boundaries
    if (onProgress) onProgress(0, 1, 'Đang phân tích PDF...');
    const { bbtns, totalPages } = await _detectBbtns(file);
    console.log(`[SmartSplit v2] PDF ${file.name}: ${totalPages} pages, ${bbtns.length} BBTN(s)`);
    console.log('[SmartSplit v2] All BBTNs:', bbtns.map(b => `p${b.pageNum}=${b.type}`).join(', '));

    // Filter: skip Kiểm định
    const filtered = _filterBbtns(bbtns);
    console.log(`[SmartSplit v2] After filter (skip Kiểm định): ${filtered.length} BBTN(s)`);
    console.log('[SmartSplit v2] Will OCR:', filtered.map(b => `p${b.pageNum}=${b.type}`).join(', '));

    // Nếu không có BBTN nào detect → upload nguyên (fallback)
    if (filtered.length === 0) {
      console.warn('[SmartSplit v2] No BBTN detected, upload original file');
      const base64 = await _blobToBase64(file);
      const res = await fetch(`${SB_URL}/functions/v1/bbtn-ocr-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          file_base64: base64,
          mime_type: file.type,
          file_name: file.name,
        }),
      });
      if (!res.ok) throw new Error(`OCR fail ${res.status}`);
      return await res.json();
    }

    // File nhỏ ≤ 4 trang + chỉ 1 BBTN → upload nguyên
    if (totalPages <= MAX_PAGES_PER_CHUNK && filtered.length === 1) {
      console.log(`[SmartSplit v2] PDF ≤ ${MAX_PAGES_PER_CHUNK} pages, upload nguyên`);
      const base64 = await _blobToBase64(file);
      const res = await fetch(`${SB_URL}/functions/v1/bbtn-ocr-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SB_KEY,
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          file_base64: base64,
          mime_type: file.type,
          file_name: file.name,
        }),
      });
      if (!res.ok) throw new Error(`OCR fail ${res.status}`);
      return await res.json();
    }

    // Smart split
    const chunks = _buildChunks(filtered, bbtns, totalPages);
    console.log(`[SmartSplit v2] Split thành ${chunks.length} chunks:`, 
      chunks.map(c => `${c.startPage + 1}-${c.endPage + 1}`).join(', '));

    if (onProgress) onProgress(0, chunks.length, `Tách PDF thành ${chunks.length} phần...`);
    const splitFiles = await _splitPdf(file, chunks);

    if (onProgress) onProgress(0, chunks.length, `OCR ${chunks.length} phần song song...`);
    const items = await _processChunksParallel(
      splitFiles, file.name, token, SB_URL, SB_KEY,
      (done, total) => {
        if (onProgress) onProgress(done, total, `Đã OCR ${done}/${total} phần`);
      }
    );

    return {
      success: true,
      items,
      item_count: items.length,
      mode: 'smart_split_v2',
      total_pages: totalPages,
      bbtns_detected: bbtns.length,
      bbtns_ocred: filtered.length,
      chunks: chunks.length,
    };
  };

  console.log('[SmartSplit v2] Loaded');
})();
