// supabase/functions/approve-password-change/index.ts
// Admin nhấn link Approve/Reject trong email → endpoint này xử lý

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ADMIN_EMAIL = 'mtuandat@gmail.com'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const url = new URL(req.url)
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const token = body.token || url.searchParams.get('token')
    const action = body.action || url.searchParams.get('action')

    if (!token || !['approve','reject'].includes(action)) {
      return new Response(JSON.stringify({ error: 'Thiếu token hoặc action không hợp lệ' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // ── 1. Xác thực admin qua JWT ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Cần đăng nhập admin để xác nhận' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !adminUser) {
      return new Response(JSON.stringify({ error: 'Phiên hết hạn — đăng nhập lại với admin' }), {
        status: 401, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // Chỉ admin email được phép (mtuandat@gmail.com hoặc role admin)
    const adminMeta = adminUser.user_metadata || {}
    const isAdmin = adminUser.email === ADMIN_EMAIL || adminMeta.role === 'admin'
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Chỉ admin được duyệt yêu cầu này' }), {
        status: 403, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // ── 2. Tìm pending request ──
    const { data: pending, error: queryErr } = await supabase
      .from('pending_password_changes')
      .select('*')
      .eq('token', token)
      .single()

    if (queryErr || !pending) {
      return new Response(JSON.stringify({ error: 'Token không tồn tại hoặc đã được xử lý' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    if (pending.status !== 'pending') {
      return new Response(JSON.stringify({ error: `Yêu cầu này đã được ${pending.status}` }), {
        status: 410, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    if (new Date(pending.expires_at) < new Date()) {
      await supabase.from('pending_password_changes')
        .update({ status: 'expired', processed_at: new Date().toISOString() })
        .eq('id', pending.id)
      return new Response(JSON.stringify({ error: 'Yêu cầu đã hết hạn (>24h)' }), {
        status: 410, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    // ── 3. Apply hoặc reject ──
    if (action === 'approve') {
      // Update password trong auth.users qua admin API
      const { error: updateErr } = await supabase.auth.admin.updateUserById(
        pending.user_id,
        { password: pending.new_password }
      )

      if (updateErr) {
        console.error('Update password error:', updateErr)
        return new Response(JSON.stringify({ error: 'Lỗi đổi pass: ' + updateErr.message }), {
          status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
        })
      }

      // Xoá password plain text + đánh dấu approved
      await supabase.from('pending_password_changes')
        .update({
          status: 'approved',
          processed_at: new Date().toISOString(),
          new_password: '',  // xoá ngay sau khi apply
        })
        .eq('id', pending.id)

      // Gửi email xác nhận cho user
      await sendNotifyEmail(pending.user_email, pending.user_name, 'approved')

      return new Response(JSON.stringify({
        success: true,
        message: `Đã đổi mật khẩu cho ${pending.user_name} (${pending.user_email})`,
        user_email: pending.user_email,
      }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
      })

    } else {
      // Reject
      await supabase.from('pending_password_changes')
        .update({
          status: 'rejected',
          processed_at: new Date().toISOString(),
          new_password: '',
        })
        .eq('id', pending.id)

      await sendNotifyEmail(pending.user_email, pending.user_name, 'rejected')

      return new Response(JSON.stringify({
        success: true,
        message: `Đã từ chối yêu cầu đổi mật khẩu của ${pending.user_name}`,
        user_email: pending.user_email,
      }), {
        status: 200, headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('approve-password-change error:', err)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})

/** Gửi email thông báo cho user khi yêu cầu được approve/reject */
async function sendNotifyEmail(toEmail: string, userName: string, status: 'approved' | 'rejected') {
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return

  const isApproved = status === 'approved'
  const subject = isApproved
    ? '[EVNHANOI] Mật khẩu đã được cập nhật'
    : '[EVNHANOI] Yêu cầu đổi mật khẩu bị từ chối'

  const html = `
<!DOCTYPE html>
<html><body style="font-family:sans-serif;background:#f5f7fa;padding:24px;color:#1a202c">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,.1)">
    <h2 style="margin:0 0 12px;color:${isApproved ? '#00a86b' : '#e53e3e'};font-size:17px">
      ${isApproved ? '✓ Mật khẩu đã được cập nhật' : '✗ Yêu cầu đổi mật khẩu bị từ chối'}
    </h2>
    <p style="font-size:14px;line-height:1.6">Xin chào <b>${userName}</b>,</p>
    <p style="font-size:14px;line-height:1.6">
      ${isApproved
        ? 'Yêu cầu đổi mật khẩu của bạn đã được admin duyệt. Bạn có thể đăng nhập với mật khẩu mới.'
        : 'Yêu cầu đổi mật khẩu của bạn đã bị từ chối. Liên hệ admin để biết thêm chi tiết.'
      }
    </p>
    <p style="margin-top:20px;font-size:11.5px;color:#718096;border-top:1px solid #e2e8f0;padding-top:16px">
      Nếu không phải bạn yêu cầu, vui lòng liên hệ admin ngay.
    </p>
  </div>
</body></html>`

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'EVNHANOI <onboarding@resend.dev>',
      to: [toEmail],
      subject,
      html,
    }),
  }).catch(e => console.warn('Notify email failed:', e))
}
