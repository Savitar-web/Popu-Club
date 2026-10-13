// Envía un aviso por Firebase Cloud Messaging (APK cerrado).
// Secreto: FIREBASE_SERVICE_ACCOUNT = el JSON de la service account, en una sola línea o con \n.
//
// POST { "user_ids": ["uuid", ...], "title": "...", "body": "...", "url": "/home" }
// Authorization: Bearer <service_role o anon si quieres restringirlo a admin>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

type ServiceAccount = {
  project_id: string
  client_email: string
  private_key: string
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function b64url(input: string | ArrayBuffer) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : new Uint8Array(input)
  let str = ""
  for (const b of bytes) str += String.fromCharCode(b)
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function pemToArrayBuffer(pem: string) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\\n/g, "")
    .replace(/\s/g, "")
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

async function getAccessToken(sa: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))
  const unsigned = `${header}.${payload}`
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  )
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned))
  const jwt = `${unsigned}.${b64url(sig)}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!res.ok || !data.access_token) {
    throw new Error(`No se pudo obtener token FCM: ${JSON.stringify(data)}`)
  }
  return data.access_token as string
}

async function sendFcm(projectId: string, accessToken: string, token: string, title: string, body: string, url: string) {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { url, title, body },
        android: {
          priority: "HIGH",
          notification: {
            channel_id: "popu_club_default",
            sound: "default",
            default_vibrate_timings: true,
          },
        },
      },
    }),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

  try {
    const { user_ids, title, body, url = "/" } = await req.json()
    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: "user_ids vacío" }), { status: 400, headers: cors })
    }
    if (!title || !body) {
      return new Response(JSON.stringify({ error: "faltan title o body" }), { status: 400, headers: cors })
    }

    const saRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT")
    if (!saRaw) {
      return new Response(JSON.stringify({ error: "Falta el secreto FIREBASE_SERVICE_ACCOUNT" }), { status: 500, headers: cors })
    }
    const sa = JSON.parse(saRaw) as ServiceAccount

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    const { data: devices, error } = await supabase
      .from("push_devices")
      .select("token, user_id")
      .in("user_id", user_ids)

    if (error) throw error
    if (!devices?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "sin tokens" }), { headers: { ...cors, "Content-Type": "application/json" } })
    }

    const accessToken = await getAccessToken(sa)
    const results = []
    for (const device of devices) {
      const result = await sendFcm(sa.project_id, accessToken, device.token, title, body, url)
      results.push({ user_id: device.user_id, ...result })
      // Token inválido: el teléfono lo desinstaló o rotó el token.
      if (!result.ok && result.status === 404) {
        await supabase.from("push_devices").delete().eq("token", device.token)
      }
    }

    const sent = results.filter((r) => r.ok).length
    return new Response(JSON.stringify({ sent, total: results.length, results }), {
      headers: { ...cors, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    })
  }
})
