// ═══════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════
// MODULE: ASSET ATTACHMENTS (Ảnh & Tài liệu thiết bị)
// 
// Tích hợp vào panel _tbShowLyLich:
//   - Hiển thị gallery ảnh + danh sách tài liệu của thiết bị
//   - Form upload ảnh hoặc tài liệu
//   - Xóa file (user: trong 3 ngày + của mình, admin: bất kỳ lúc nào)
//
// Phụ thuộc:
//   - _AUTH_SB_URL, _AUTH_SB_KEY (Supabase config — đã có)
//   - _authGetToken() (lấy JWT — đã có)
//   - _authGetSession() (lấy user info — đã có)
//   - window._sbClient (Supabase client — đã có)
//   - _tbFiltered (mảng device đang hiển thị — đã có)
// ═══════════════════════════════════════════════════════════════

/** Tạo asset_key (định danh thiết bị) từ 5 trường */
function makeAssetKey(r) {
  return [
    r.Tram,
    r.Cap_dien_ap,
    r.Phan_loai_thiet_bi,
    r.Ten_thiet_bi,
    r.Ngan_thiet_bi
  ]
    .map(v => String(v || '').trim().replace(/\s+/g, '_').replace(/[^\w.\-]/g, ''))
    .join('__');
}

/** Section HTML cho ảnh & tài liệu (inject vào _tbShowLyLich) */
function _assetSectionHtml(idx) {
  return `
  <div id="_assetSection_${idx}" style="margin-top:14px;border-top:1px solid rgba(255,255,255,.07);padding-top:14px">
    <div style="font-size:9px;color:var(--text-muted);margin-bottom:8px;font-weight:700;letter-spacing:.5px">
      ẢNH & TÀI LIỆU ĐÍNH KÈM
    </div>
    <div id="_assetGallery_${idx}" style="margin-bottom:12px">
      <div style="font-size:10px;color:var(--text-muted);text-align:center;padding:8px 0">
        <i class="fas fa-spinner fa-spin" style="margin-right:5px"></i>Đang tải...
      </div>
    </div>

    <!-- Form upload -->
    <div style="background:rgba(0,230,118,.04);border:1px dashed rgba(0,230,118,.3);
                border-radius:7px;padding:10px;margin-top:8px">
      <input type="file" id="_assetFile_${idx}" style="display:none"
             accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
             onchange="_assetFileChosen(${idx})">
      <button onclick="document.getElementById('_assetFile_${idx}').click()"
        style="width:100%;padding:8px;border-radius:6px;border:1px solid rgba(0,230,118,.3);
               background:rgba(0,230,118,.08);color:#00e676;cursor:pointer;font-size:11px;
               margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px">
        <i class="fas fa-paperclip"></i> Chọn ảnh hoặc tài liệu
      </button>
      <div id="_assetFileLbl_${idx}" style="font-size:10px;color:rgba(180,200,220,.6);
                                            text-align:center;margin-bottom:6px;min-height:14px">
        Chưa chọn file
      </div>
      <input id="_assetNote_${idx}" type="text" placeholder="Ghi chú (vd: Ảnh tem MBA, Biên bản TN T6/2025...)"
        style="width:100%;padding:7px 9px;border-radius:6px;border:1px solid rgba(255,255,255,.12);
               background:rgba(255,255,255,.04);color:rgba(235,248,255,.9);font-size:10.5px;
               outline:none;box-sizing:border-box;margin-bottom:6px">
      <button id="_assetBtn_${idx}" onclick="_assetDoUpload(${idx})"
        style="width:100%;padding:8px;border-radius:6px;border:none;background:#00e676;
               color:#000;font-weight:700;cursor:pointer;font-size:11px;
               display:flex;align-items:center;justify-content:center;gap:6px">
        <i class="fas fa-upload"></i> Tải lên NAS
      </button>
      <div id="_assetStatus_${idx}" style="font-size:10px;margin-top:6px;
                                            min-height:14px;text-align:center"></div>
    </div>
  </div>`;
}

/** Khi user chọn file → hiện tên + size */
function _assetFileChosen(idx) {
  const inp = document.getElementById('_assetFile_' + idx);
  const lbl = document.getElementById('_assetFileLbl_' + idx);
  const f = inp?.files?.[0];
  if (!f || !lbl) return;
  const mb = (f.size / 1024 / 1024).toFixed(1);
  const max = f.type.startsWith('image/') ? 10 : 20;
  if (parseFloat(mb) > max) {
    lbl.innerHTML = `<span style="color:#ff5252">⚠ File quá lớn (${mb}MB) — tối đa ${max}MB</span>`;
    inp.value = '';
    return;
  }
  const isImg = f.type.startsWith('image/');
  lbl.innerHTML = `<span style="color:${isImg ? '#00e676' : '#0096ff'}">
    <i class="fas fa-${isImg ? 'image' : 'file-alt'}"></i> ${f.name}</span>
    <span style="color:rgba(180,200,220,.5)"> · ${mb}MB</span>`;
}

/** Load gallery (ảnh + tài liệu đã có) từ Supabase */
async function _assetLoadGallery(idx) {
  const r = _tbFiltered[idx];
  if (!r) return;
  const gEl = document.getElementById('_assetGallery_' + idx);
  if (!gEl || !window._sbClient) return;

  const assetKey = makeAssetKey(r);

  try {
    const { data, error } = await window._sbClient
      .from('equipment_attachments')
      .select('*')
      .eq('asset_key', assetKey)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      gEl.innerHTML = `<div style="font-size:10px;color:var(--text-muted);text-align:center;padding:8px 0">
        <i class="fas fa-folder-open" style="margin-right:5px"></i>Chưa có ảnh/tài liệu nào
      </div>`;
      return;
    }

    const photos = data.filter(d => d.file_type === 'image');
    const docs   = data.filter(d => d.file_type === 'document');
    const sess   = (typeof _authGetSession === 'function') ? _authGetSession() : null;
    const isAdmin = sess?.role === 'admin';
    const myEmail = sess?.email;
    const now = Date.now();
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

    // Check user có thể xóa file nào không (in 3 days + của mình)
    const canDeleteFile = (f) => {
      if (isAdmin) return true;
      if (f.uploaded_by_email !== myEmail) return false;
      const created = new Date(f.created_at).getTime();
      return (now - created) < THREE_DAYS;
    };

    let html = '';

    // ── Section: Ảnh ──
    if (photos.length) {
      html += `<div style="font-size:10px;color:rgba(0,230,118,.7);margin-bottom:5px;font-weight:600">
        <i class="fas fa-camera" style="margin-right:4px"></i>Ảnh hiện trường (${photos.length})
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">`;
      photos.forEach(p => {
        const canDel = canDeleteFile(p);
        const tooltip = `${p.file_name}\n${p.note ? p.note + '\n' : ''}Upload: ${p.uploaded_by_email || '?'}\n${new Date(p.created_at).toLocaleString('vi-VN')}`;
        html += `<div style="position:relative;width:78px;border:1px solid rgba(0,230,118,.2);
                             border-radius:6px;overflow:hidden;background:rgba(0,0,0,.3)"
                      title="${tooltip.replace(/"/g, '&quot;')}">
          <div style="width:78px;height:60px;background:rgba(0,230,118,.05);
                      display:flex;align-items:center;justify-content:center;cursor:pointer"
               onclick="_assetView(${p.id})">
            <i class="fas fa-image" style="font-size:18px;color:rgba(0,230,118,.4)"></i>
          </div>
          <div style="padding:3px 4px;font-size:8.5px;color:rgba(180,200,220,.65);
                      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer"
               onclick="_assetView(${p.id})">${p.file_name}</div>
          ${canDel ? `<button onclick="event.stopPropagation();_assetDelete(${p.id},${idx})"
                              title="Xóa"
                              style="position:absolute;top:2px;right:2px;width:18px;height:18px;
                                     border-radius:50%;border:none;background:rgba(255,82,82,.85);
                                     color:#fff;font-size:9px;cursor:pointer;line-height:1;padding:0;
                                     display:flex;align-items:center;justify-content:center">✕</button>` : ''}
        </div>`;
      });
      html += '</div>';
    }

    // ── Section: Tài liệu ──
    if (docs.length) {
      html += `<div style="font-size:10px;color:rgba(0,150,255,.7);margin-bottom:5px;font-weight:600">
        <i class="fas fa-file-alt" style="margin-right:4px"></i>Tài liệu (${docs.length})
      </div>`;
      docs.forEach(d => {
        const canDel = canDeleteFile(d);
        const ext = (d.file_name.match(/\.[^.]+$/) || [''])[0].toLowerCase();
        const icon = ext === '.pdf' ? 'fa-file-pdf'
                   : ext.match(/\.docx?$/) ? 'fa-file-word'
                   : ext.match(/\.xlsx?$/) ? 'fa-file-excel'
                   : ext.match(/\.pptx?$/) ? 'fa-file-powerpoint' : 'fa-file';
        const tooltip = `${d.file_name}\n${d.note ? d.note + '\n' : ''}Upload: ${d.uploaded_by_email || '?'}\n${new Date(d.created_at).toLocaleString('vi-VN')}`;
        html += `<div style="display:flex;align-items:center;gap:7px;padding:6px 8px;
                             border-radius:6px;border:1px solid rgba(0,150,255,.15);
                             background:rgba(0,150,255,.04);margin-bottom:4px"
                      title="${tooltip.replace(/"/g, '&quot;')}">
          <i class="fas ${icon}" style="color:#0096ff;font-size:13px;flex-shrink:0"></i>
          <div style="flex:1;overflow:hidden;cursor:pointer" onclick="_assetView(${d.id})">
            <div style="font-size:10.5px;color:rgba(235,248,255,.9);
                        white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.file_name}</div>
            ${d.note ? `<div style="font-size:9px;color:rgba(180,200,220,.55);
                          white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.note}</div>` : ''}
          </div>
          <button onclick="_assetView(${d.id})" title="Mở"
            style="background:none;border:none;color:rgba(0,150,255,.7);cursor:pointer;font-size:11px;padding:2px 5px">
            <i class="fas fa-external-link-alt"></i>
          </button>
          ${canDel ? `<button onclick="_assetDelete(${d.id},${idx})" title="Xóa"
            style="background:none;border:none;color:rgba(255,82,82,.7);cursor:pointer;font-size:11px;padding:2px 5px">
            <i class="fas fa-trash"></i></button>` : ''}
        </div>`;
      });
    }

    gEl.innerHTML = html;

  } catch (e) {
    console.error('[_assetLoadGallery]', e);
    gEl.innerHTML = `<div style="font-size:10px;color:#ff5252;text-align:center;padding:8px 0">
      ✗ Lỗi tải dữ liệu: ${e.message}
    </div>`;
  }
}

/** Upload file (ảnh hoặc tài liệu) */
async function _assetDoUpload(idx) {
  const r = _tbFiltered[idx];
  if (!r) return;
  const inp = document.getElementById('_assetFile_' + idx);
  const note = document.getElementById('_assetNote_' + idx)?.value?.trim() || '';
  const statusEl = document.getElementById('_assetStatus_' + idx);
  const btn = document.getElementById('_assetBtn_' + idx);

  if (!inp?.files?.length) {
    if (statusEl) { statusEl.style.color = '#ff9100'; statusEl.textContent = '⚠ Chưa chọn file'; }
    return;
  }
  const file = inp.files[0];
  const fileType = file.type.startsWith('image/') ? 'image' : 'document';

  // UI: disable + show progress
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
  if (statusEl) { statusEl.style.color = '#ffd740'; statusEl.textContent = 'Đang mã hóa file...'; }

  try {
    // ── 1. Encode Base64 ──
    const fileBase64 = await new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () => res(reader.result.split(',')[1]);
      reader.onerror = rej;
      reader.readAsDataURL(file);
    });

    if (statusEl) statusEl.textContent = 'Đang upload lên NAS...';

    // ── 2. Lấy JWT ──
    const token = await _authGetToken();
    if (!token) throw new Error('Chưa đăng nhập — vui lòng login lại');

    // ── 3. Gọi Edge Function asset-upload ──
    const url = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/asset-upload';
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'apikey': _AUTH_SB_KEY,
      },
      body: JSON.stringify({
        assetKey:    makeAssetKey(r),
        tram:        r.Tram,
        capDienAp:   r.Cap_dien_ap,
        loaiThietBi: r.Phan_loai_thiet_bi,
        tenThietBi:  r.Ten_thiet_bi,
        nganThietBi: r.Ngan_thiet_bi,
        fileName:    file.name,
        mimeType:    file.type,
        fileSize:    file.size,
        fileType,
        note,
        fileBase64,
      }),
    });

    const result = await resp.json();
    if (!result.success) throw new Error(result.error || `HTTP ${resp.status}`);

    // ── 4. Thành công ──
    if (statusEl) {
      statusEl.style.color = '#00e676';
      statusEl.textContent = `✅ Upload thành công! ${fileType === 'image' ? 'Ảnh' : 'Tài liệu'} đã lưu trên NAS.`;
    }

    // Reset form
    inp.value = '';
    document.getElementById('_assetFileLbl_' + idx).textContent = 'Chưa chọn file';
    document.getElementById('_assetNote_' + idx).value = '';

    // Refresh gallery sau 300ms
    setTimeout(() => _assetLoadGallery(idx), 300);

  } catch (e) {
    if (statusEl) { statusEl.style.color = '#ff5252'; statusEl.textContent = '✗ ' + e.message; }
    console.error('[_assetDoUpload]', e);
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="fas fa-upload"></i> Tải lên NAS';
}

/** Xem/tải file qua proxy asset-download */
async function _assetView(id) {
  try {
    const token = await _authGetToken();
    if (!token) {
      alert('Chưa đăng nhập');
      return;
    }
    const url = _AUTH_SB_URL.replace(/\/$/, '') + '/functions/v1/asset-download?id=' + id;
    const resp = await fetch(url, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'apikey': _AUTH_SB_KEY,
      },
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${txt.slice(0,100)}`);
    }
    const blob = await resp.blob();
    const blobUrl = URL.createObjectURL(blob);
    window.open(blobUrl, '_blank');
    // Cleanup sau 1 phút
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } catch (e) {
    alert('Không mở được file: ' + e.message);
    console.error('[_assetView]', e);
  }
}

/** Soft delete file (set active=false) */
async function _assetDelete(id, idx) {
  if (!confirm('Xóa file này?\n\nLưu ý: Sau khi xóa, file vẫn còn trên NAS nhưng sẽ ẩn khỏi dashboard.')) return;
  try {
    const sess = (typeof _authGetSession === 'function') ? _authGetSession() : null;
    const { error } = await window._sbClient
      .from('equipment_attachments')
      .update({
        active: false,
        deleted_at: new Date().toISOString(),
        deleted_by: sess?.id || null,
      })
      .eq('id', id);
    if (error) throw error;
    _assetLoadGallery(idx);
  } catch (e) {
    alert('Lỗi xóa: ' + e.message);
    console.error('[_assetDelete]', e);
  }
}

// ── Expose globally cho inline handlers ──
window.makeAssetKey      = makeAssetKey;
window._assetSectionHtml = _assetSectionHtml;
window._assetFileChosen  = _assetFileChosen;
window._assetLoadGallery = _assetLoadGallery;
window._assetDoUpload    = _assetDoUpload;
window._assetView        = _assetView;
window._assetDelete      = _assetDelete;
