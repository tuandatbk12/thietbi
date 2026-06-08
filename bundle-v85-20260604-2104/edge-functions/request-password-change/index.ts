// supabase/functions/request-password-change/index.ts
// User submit yêu cầu đổi pass → lưu DB + gửi email cho admin duyệt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAIL = 'mtuandat@gmail.com'
const APP_URL = 'https://thietbi.vercel.app'  // Sửa nếu deploy khác

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    // ── 1. Xác thực JWT ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // ── 2. Validate input ──
    const body = await req.json()
    const { current_password, new_password } = body

    if (!current_password || !new_password) {
      return new Response(JSON.stringify({ error: 'Thiếu mật khẩu cũ hoặc mới' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }
    if (new_password.length < 6) {
      return new Response(JSON.stringify({ error: 'Mật khẩu mới phải >= 6 ký tự' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }
    if (new_password === current_password) {
      return new Response(JSON.stringify({ error: 'Mật khẩu mới phải khác mật khẩu cũ' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // ── 3. Verify current password bằng cách signIn ──
    const tempClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!,
    )
    const { error: signInErr } = await tempClient.auth.signInWithPassword({
      email: user.email!,
      password: current_password,
    })
    if (signInErr) {
      return new Response(JSON.stringify({ error: 'Mật khẩu hiện tại không đúng' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // ── 4. Tạo token random ──
    const token = crypto.randomUUID() + '-' + crypto.randomUUID().replaceAll('-','').slice(0, 16)

    // Xoá pending request cũ của user này (nếu có)
    await supabase.from('pending_password_changes')
      .delete()
      .eq('user_id', user.id)
      .eq('status', 'pending')

    // ── 5. Insert vào DB ──
    const userMeta = user.user_metadata || {}
    const userName = userMeta.name || userMeta.full_name || user.email?.split('@')[0] || 'User'
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    const { error: insertErr } = await supabase.from('pending_password_changes').insert({
      user_id: user.id,
      user_email: user.email,
      user_name: userName,
      new_password,    // plain text, sẽ xoá ngay sau approve/reject
      token,
      client_ip: clientIp,
      user_agent: userAgent,
    })

    if (insertErr) {
      console.error('DB insert error:', insertErr)
      return new Response(JSON.stringify({ error: 'Lỗi lưu yêu cầu: ' + insertErr.message }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // ── 6. Gửi email cho admin qua Resend ──
    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY chưa cấu hình' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const approveUrl = `${APP_URL}/?approve_pwd=${token}&action=approve`
    const rejectUrl = `${APP_URL}/?approve_pwd=${token}&action=reject`
    const requestTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })

    const emailBody = {
      from: 'EVNHANOI <onboarding@resend.dev>',
      to: [ADMIN_EMAIL],
      subject: `[EVNHANOI] Yêu cầu đổi mật khẩu — ${userName}`,
      html: `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f5f7fa;padding:24px;color:#1a202c">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <div style="background:#0066cc;padding:20px 24px;color:#fff">
      <h2 style="margin:0;font-size:18px">⚡ EVNHANOI — Yêu cầu đổi mật khẩu</h2>
    </div>
    <div style="padding:24px">
      <p style="margin:0 0 14px;font-size:14px;line-height:1.6">
        Có yêu cầu đổi mật khẩu mới, cần xác nhận của bạn:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
        <tr><td style="padding:8px 0;color:#718096;width:120px">Người yêu cầu</td><td style="padding:8px 0"><b>${userName}</b></td></tr>
        <tr><td style="padding:8px 0;color:#718096">Email</td><td style="padding:8px 0">${user.email}</td></tr>
        <tr><td style="padding:8px 0;color:#718096">Thời gian</td><td style="padding:8px 0">${requestTime}</td></tr>
        <tr><td style="padding:8px 0;color:#718096">IP</td><td style="padding:8px 0;font-family:monospace;font-size:12px">${clientIp}</td></tr>
      </table>
      <p style="margin:20px 0 12px;font-size:14px;line-height:1.6">Hãy xác nhận yêu cầu này:</p>
      <div style="text-align:center;margin:24px 0">
        <a href="${approveUrl}" style="display:inline-block;background:#00a86b;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;margin-right:8px">✓ Duyệt đổi mật khẩu</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#e53e3e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">✗ Từ chối</a>
      </div>
      <p style="margin:20px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11.5px;color:#718096;line-height:1.6">
        Yêu cầu này hết hạn sau 24h. Nếu bạn KHÔNG yêu cầu đổi mật khẩu, hãy nhấn "Từ chối" để hủy bỏ.
      </p>
    </div>
  </div>
</body>
</html>`,
    }

    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailBody),
    })

    if (!resendResp.ok) {
      const errTxt = await resendResp.text()
      console.error('Resend error:', errTxt)
      // Vẫn trả success vì DB đã ghi, admin có thể duyệt thủ công nếu cần
      return new Response(JSON.stringify({
        warn: 'Gửi email lỗi nhưng yêu cầu đã ghi nhận, liên hệ admin trực tiếp',
        error_detail: errTxt,
      }), {
        status: 207, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    return new Response(JSON.stringify({
      success: true,
      message: 'Đã gửi yêu cầu đổi mật khẩu cho admin. Vui lòng đợi xác nhận qua email.',
    }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('request-password-change error:', err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
