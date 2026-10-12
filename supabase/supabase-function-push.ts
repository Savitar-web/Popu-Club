// supabase/functions/push/index.ts
// Se dispara con un Database Webhook al INSERT de public.notifications.
// Despliegue: verify_jwt = false (el webhook usa la service key).
import webpush from 'npm:web-push@3.6.7'

const pub = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const priv = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@popu.club'

if (pub && priv) webpush.setVapidDetails(subject, pub, priv)

Deno.serve(async (req) => {
  if (!pub || !priv) {
    return new Response('Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY', { status: 500 })
  }

  const payload = await req.json().catch(() => null)
  const row = payload?.record
  if (!row?.user_id) return Response.json({ ok: true, skipped: true })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const res = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?user_id=eq.${row.user_id}&select=endpoint,p256dh,auth`,
    {
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
      },
    }
  )
  const subs = await res.json()
  const body = JSON.stringify({
    title: row.title || 'Popu-Club',
    body: row.body || '',
    link: row.link || '/home',
    icon: row.image_url || '/pwa-192.png',
  })

  let sent = 0
  for (const s of Array.isArray(subs) ? subs : []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body
      )
      sent++
    } catch {
      /* suscripción caducada */
    }
  }

  return Response.json({ ok: true, sent })
})
