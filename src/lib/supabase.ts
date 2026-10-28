/**
 * Cliente de Supabase.
 *
 * 1. Crea un archivo `.env` en la raíz del proyecto con:
 *    VITE_SUPABASE_URL=https://xxxx.supabase.co
 *    VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
 *
 * 2. Reinicia `npm run dev` después de crear el .env
 *
 * Mientras no pongas esas claves, la app puede seguir usando datos de ejemplo.
 */

import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      global: { fetch: async (input, init) => {
        const controller = new AbortController()
        const onAbort = () => controller.abort(init?.signal?.reason)
        const timer = setTimeout(() => controller.abort(new DOMException('La petición tardó demasiado', 'TimeoutError')), 20000)
        if (init?.signal?.aborted) onAbort()
        else init?.signal?.addEventListener('abort', onAbort, { once: true })
        try { return await fetch(input, { ...init, signal: controller.signal }) }
        finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', onAbort) }
      } },
    })
  : (null as any)

/** Lee el perfil del usuario logueado (incluye role: user | admin) */
export async function getMyProfile() {
  if (!isSupabaseConfigured) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  if (error) {
    console.warn('getMyProfile:', error.message)
    return null
  }
  return data
}

export async function isAdmin() {
  const profile = await getMyProfile()
  return profile?.role === 'admin'
}