// ════════════════════════════════════════════════════════════════
// BBTN Smart Split v3 — Memory-safe
// 
// Fix v2 → v3:
//   - Concurrency 1 thay vì 3 (tránh OOM)
//   - Release PDF.js document ngay sau pre-scan
//   - Clear arrayBuffer references sau khi dùng
//   - Process từng chunk → upload → release ngay
//   - Warn nếu PDF > 100 trang
// ════════════════════════════════════════════════════════════════
(function() {
  if (window._bbtnSmartSplitV3Installed) return;
  window._bbtnSmartSplitV3Installed = true;

  const MAX_PAGES_PER_CHUNK = 4;
  const MAX_CONCURRENT = 1; // ✅ v3: tuần tự để tránh OOM
  const WARN_PAGES_THRESHOLD = 80;

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
  // Detect BBTN boundaries + type — release PDF.js doc ngay sau khi xong
  // ────────────────────────────────────────────────────────────
  async function _detectBbtns(file) {
    await _ensureLibs();
    const arrayBuffer = await file.arrayBuffer();
    let pdf = await window.pdfjsLib.getDocument({ 
      data: arrayBuffer,
      disableFontFace: true,        // ✅ Tiết kiệm RAM (không render font)
      disableRange: true,
      disableStream: true,
    }).promise;
    const totalPages = pdf.numPages;

    const bbtns = [];
    for (let i = 1; i <= totalPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const text = content.items.map(it => it.str).join(' ');
      const textUpper = text.toUpperCase();

      if (textUpper.includes('TỔNG CÔNG TY') || textUpper.includes('TONG CONG TY')) {
        let type = 'Unknown';
        if (text.includes('Kiểm định') || text.includes('Kiem dinh') || text.includes('Kiểm tra')) {
          type = 'Kiểm định';
        } else if (text.includes('Thí nghiệm') || text.includes('Thi nghiem')) {
          type = 'Thí nghiệm';
        }
        bbtns.push({ startPage: i - 1, type, pageNum: i });
      }
      
      // ✅ Release page memory immediately
      page.cleanup();
    }

    // ✅ Destroy PDF document
    await pdf.destroy();
    pdf = null;

    return { bbtns, totalPages };
  }

  function _filterBbtns(bbtns) {
    const filtered = bbtns.filter(b => b.type !== 'Kiểm định');
    if (filtered.length === 0) {
      console.warn('[SmartSplit v3] No "Thí nghiệm" found, fallback to all BBTNs');
      return bbtns;
    }
    return filtered;
  }

  function _buildChunks(filteredBbtns, allBbtns, totalPages) {
    const bbtnRanges = filteredBbtns.map(bbtn => {
      const idxAll = allBbtns.findIndex(b => b.startPage === bbtn.startPage);
      const nextStart = idxAll + 1 < allBbtns.length ? allBbtns[idxAll + 1].startPage : totalPages;
      return { start: bbtn.startPage, end: nextStart - 1, pages: nextStart - bbtn.startPage };
    });

    const chunks = [];
    let curStart = bbtnRanges[0].start;
    let curEnd = bbtnRanges[0].end;

    for (let i = 1; i < bbtnRanges.length; i++) {
      const r = bbtnRanges[i];
      const newTotal = r.end - curStart + 1;
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

  // ────────────────────────────────────────────────────────────
  // Split + OCR 1 chunk tại 1 thời điểm (memory-safe)
  // ────────────────────────────────────────────────────────────
  async function _splitAndOcrSingleChunk(srcArrayBuffer, chunk, fileName, token, SB_URL, SB_KEY) {
    // Load source PDF
    let srcPdf = await window.PDFLib.PDFDocument.load(srcArrayBuffer);
    let newPdf = await window.PDFLib.PDFDocument.create();

    const indices = [];
    for (let i = chunk.startPage; i <= chunk.endPage; i++) indices.push(i);
    
    const copiedPages = await newPdf.copyPages(srcPdf, indices);
    copiedPages.forEach(p => newPdf.addPage(p));
    
    let pdfBytes = await newPdf.save();
    
    // ✅ Release PDF objects ngay
    srcPdf = null;
    newPdf = null;

    // Convert to base64
    let blob = new Blob([pdfBytes], { type: 'application/pdf' });
    pdfBytes = null;
    
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    blob = null; // ✅ Release blob

    // Send to Edge Function
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
    
    if (!res.ok) throw new Error(`Chunk OCR fail ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    if (!data.success || !Array.isArray(data.items)) {
      throw new Error(`Invalid response: ${JSON.stringify(data).slice(0, 200)}`);
    }
    
    // Adjust page numbers
    data.items.forEach(it => {
      if (it.page_start != null) it.page_start = it.page_start + chunk.startPage;
      if (it.page_end != null) it.page_end = it.page_end + chunk.startPage;
    });
    
    return data.items;
  }

  // ────────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────────
  window._bbtnSmartOcrFile = async function(file, token, SB_URL, SB_KEY, onProgress) {
    // File ảnh
    if (!file.type.includes('pdf')) {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch(`${SB_URL}/functions/v1/bbtn-ocr-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ file_base64: base64, mime_type: file.type, file_name: file.name }),
      });
      if (!res.ok) throw new Error(`OCR fail ${res.status}`);
      return await res.json();
    }

    if (onProgress) onProgress(0, 1, 'Đang phân tích PDF...');
    const { bbtns, totalPages } = await _detectBbtns(file);
    console.log(`[SmartSplit v3] PDF ${file.name}: ${totalPages} pages, ${bbtns.length} BBTN(s)`);

    if (totalPages > WARN_PAGES_THRESHOLD) {
      console.warn(`[SmartSplit v3] Large PDF (${totalPages} pages), processing sequentially to avoid OOM`);
    }

    const filtered = _filterBbtns(bbtns);
    console.log(`[SmartSplit v3] After filter (skip Kiểm định): ${filtered.length} BBTN(s)`);

    // Fallback: no BBTN detected → upload nguyên
    if (filtered.length === 0) {
      console.warn('[SmartSplit v3] No BBTN detected, upload original');
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const res = await fetch(`${SB_URL}/functions/v1/bbtn-ocr-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ file_base64: base64, mime_type: file.type, file_name: file.name }),
      });
      if (!res.ok) throw new Error(`OCR fail ${res.status}`);
      return await res.json();
    }

    // PDF nhỏ + 1 BBTN → upload nguyên
    if (totalPages <= MAX_PAGES_PER_CHUNK && filtered.length === 1) {
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const res = await fetch(`${SB_URL}/functions/v1/bbtn-ocr-extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': SB_KEY, 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ file_base64: base64, mime_type: file.type, file_name: file.name }),
      });
      if (!res.ok) throw new Error(`OCR fail ${res.status}`);
      return await res.json();
    }

    // Smart split
    const chunks = _buildChunks(filtered, bbtns, totalPages);
    console.log(`[SmartSplit v3] Split thành ${chunks.length} chunks:`, 
      chunks.map(c => `${c.startPage + 1}-${c.endPage + 1}`).join(', '));

    // ✅ Load source PDF arrayBuffer ONCE (giữ nguyên cho tất cả chunks)
    if (onProgress) onProgress(0, chunks.length, `Đang chuẩn bị...`);
    const srcArrayBuffer = await file.arrayBuffer();

    // Process từng chunk tuần tự (memory-safe)
    const allItems = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (onProgress) onProgress(i, chunks.length, `OCR phần ${i + 1}/${chunks.length} (trang ${chunk.startPage + 1}-${chunk.endPage + 1})...`);
      
      try {
        const items = await _splitAndOcrSingleChunk(srcArrayBuffer, chunk, file.name, token, SB_URL, SB_KEY);
        allItems.push(...items);
        console.log(`[SmartSplit v3] Chunk ${i + 1}/${chunks.length} OK: ${items.length} items`);
      } catch (err) {
        console.error(`[SmartSplit v3] Chunk ${i + 1}/${chunks.length} FAIL:`, err.message);
      }
    }

    if (onProgress) onProgress(chunks.length, chunks.length, `Hoàn thành ${allItems.length} thiết bị`);

    return {
      success: true,
      items: allItems,
      item_count: allItems.length,
      mode: 'smart_split_v3',
      total_pages: totalPages,
      bbtns_detected: bbtns.length,
      bbtns_ocred: filtered.length,
      chunks: chunks.length,
    };
  };

  console.log('[SmartSplit v3] Loaded (memory-safe, sequential)');
})();
