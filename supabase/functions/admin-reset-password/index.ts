// ════════════════════════════════════════════════════════════════
// Edge Function: admin-reset-password
//
// Admin gọi để đổi mật khẩu cho user khác — KHÔNG cần workflow approve.
// Sau khi đổi pass:
//   1. Update password trong auth.users qua supabase.auth.admin.updateUserById
//   2. Sign out user khỏi MỌI session (kill refresh tokens)
//      → user buộc phải login lại với pass mới
//      → KHÔNG còn lỗi "pass cũ vẫn dùng được"
//   3. Log vào pending_password_changes (audit trail)
//   4. Gửi email thông báo cho user (qua Resend)
//
// Request:
//   POST { target_user_id: uuid, new_password: string }
//   Header: Authorization: Bearer <admin_jwt>
//
// Response:
//   200 { success: true, message: "...", user_email: "..." }
//   401/403/500 { error: "..." }
// ════════════════════════════════════════════════════════════════

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ADMIN_EMAIL = 'mtuandat@gmail.com';

/** Lấy service-role / secret key từ env (hỗ trợ cả format mới và cũ) */
function getServiceRoleKey(): string {
  // Format mới (2026+): SUPABASE_SECRET_KEYS = JSON dict
  const secretsJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretsJson) {
    try {
      const parsed = JSON.parse(secretsJson);
      // Try various keys that might exist
      for (const k of ['secret', 'service_role', 'admin']) {
        if (parsed[k]) return parsed[k];
      }
      // First value if object has any
      const values = Object.values(parsed) as string[];
      if (values.length > 0) return values[0];
    } catch (_) { /* fall through */ }
  }
  // Format cũ
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (legacy) return legacy;
  throw new Error('Không tìm thấy service-role key trong env');
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
    const targetUserId = (body.target_user_id || '').trim();
    const newPassword = body.new_password || '';

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'Thiếu target_user_id' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    if (!newPassword || newPassword.length < 6) {
      return new Response(JSON.stringify({ error: 'Mật khẩu mới tối thiểu 6 ký tự' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Xác thực admin qua JWT ──
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

    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Phiên đăng nhập hết hạn' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 2. Verify caller có role admin ──
    const isAdminEmail = adminUser.email === ADMIN_EMAIL;
    let isAdminRole = adminUser.user_metadata?.role === 'admin';
    if (!isAdminEmail && !isAdminRole) {
      // Double-check qua profile table (source of truth)
      const { data: profile } = await supabase
        .from('evn_user_profiles')
        .select('role')
        .eq('id', adminUser.id)
        .single();
      isAdminRole = profile?.role === 'admin';
    }

    if (!isAdminEmail && !isAdminRole) {
      return new Response(JSON.stringify({ error: 'Chỉ admin được đổi mật khẩu user khác' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Lấy thông tin target user (để log + email) ──
    const { data: { user: targetUser }, error: getErr } = await supabase.auth.admin.getUserById(targetUserId);
    if (getErr || !targetUser) {
      return new Response(JSON.stringify({ error: 'User cần đổi pass không tồn tại' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // Lấy tên hiển thị từ profile
    const { data: targetProfile } = await supabase
      .from('evn_user_profiles')
      .select('name, email')
      .eq('id', targetUserId)
      .single();
    const targetName = targetProfile?.name || targetUser.email?.split('@')[0] || 'User';
    const targetEmail = targetUser.email || targetProfile?.email || '';

    // ── 4. UPDATE PASSWORD ──
    const { error: updateErr } = await supabase.auth.admin.updateUserById(
      targetUserId,
      { password: newPassword }
    );

    if (updateErr) {
      console.error('updateUserById error:', updateErr);
      return new Response(JSON.stringify({ error: 'Lỗi đổi pass: ' + updateErr.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ── 5. KILL ALL SESSIONS của target user ──
    // QUAN TRỌNG: Sau khi đổi pass, refresh token cũ vẫn valid theo mặc định
    // → user vẫn truy cập được dashboard cho tới khi token hết hạn (~1 giờ)
    // → SIGNOUT để invalidate mọi refresh token NGAY LẬP TỨC
    const { error: signOutErr } = await supabase.auth.admin.signOut(targetUserId, 'global');
    if (signOutErr) {
      console.warn('signOut warning (không critical):', signOutErr.message);
      // Không return error vì password đã đổi thành công
    }

    // ── 6. Audit log vào pending_password_changes (status='admin_set') ──
    try {
      await supabase.from('pending_password_changes').insert({
        user_id: targetUserId,
        user_email: targetEmail,
        user_name: targetName,
        token: 'admin_set_' + Date.now(),
        new_password: '',  // KHÔNG lưu plain text
        status: 'admin_set',  // marker phân biệt với 'approved' (qua workflow request)
        processed_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      });
    } catch (logErr) {
      console.warn('Audit log failed (non-critical):', logErr);
    }

    // ── 7. Gửi email thông báo cho user ──
    try {
      await sendNotifyEmail(targetEmail, targetName, adminUser.email || '');
    } catch (mailErr) {
      console.warn('Email notify failed (non-critical):', mailErr);
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Đã đổi mật khẩu cho ${targetName} (${targetEmail}). Mọi session cũ đã bị xoá, user phải login lại.`,
      user_email: targetEmail,
      user_name: targetName,
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('admin-reset-password error:', err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

/** Gửi email thông báo */
async function sendNotifyEmail(toEmail: string, userName: string, byAdmin: string): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey || !toEmail) return;

  const html = `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#f5f7fa;padding:24px;color:#1a202c">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <h2 style="margin:0 0 12px;color:#0066cc;font-size:17px">🔑 Mật khẩu đã được cập nhật</h2>
    <p style="font-size:14px;line-height:1.6">Xin chào <b>${userName}</b>,</p>
    <p style="font-size:14px;line-height:1.6">
      Mật khẩu tài khoản của bạn đã được admin <b>${byAdmin}</b> cập nhật.
      Vui lòng liên hệ admin để nhận mật khẩu mới và đăng nhập lại.
    </p>
    <p style="font-size:14px;line-height:1.6;background:#fff3cd;padding:10px;border-radius:6px;border-left:3px solid #ffc107">
      ⚠️ <b>Lưu ý</b>: Mọi phiên đăng nhập cũ của bạn đã bị huỷ. Bạn cần đăng nhập lại bằng mật khẩu mới.
    </p>
    <p style="margin-top:20px;font-size:11.5px;color:#718096;border-top:1px solid #e2e8f0;padding-top:16px">
      Thời gian: ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}<br>
      Nếu bạn KHÔNG yêu cầu việc này hoặc nghi ngờ có truy cập trái phép, liên hệ admin ngay.
    </p>
  </div>
</body></html>`;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'EVNHANOI <onboarding@resend.dev>',
      to: [toEmail],
      subject: '[EVNHANOI] Mật khẩu đã được cập nhật bởi Admin',
      html,
    }),
  });
}
