import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

const profileKeys = ['currentUser', 'username', 'email', 'age', 'profilePic', 'role']
let snapshot: { ready: boolean; session: Session | null; recovery: boolean } = {
  ready: !supabase, session: null, recovery: /type=(password_)?recovery/.test(location.hash),
}
const listeners = new Set<() => void>()
let revision = 0

function emit() {
  listeners.forEach((listener) => listener())
  window.dispatchEvent(new Event('profileUpdated'))
}

function clearProfile() {
  profileKeys.forEach((key) => localStorage.removeItem(key))
}

function acceptSession(session: Session | null, recovery = snapshot.recovery) {
  const previousId = snapshot.session?.user.id
  if (previousId !== session?.user.id) revision++
  const currentRevision = revision
  snapshot = { ready: true, session, recovery }
  if (!session) clearProfile()
  else {
    localStorage.removeItem('guestMode')
    let cached: Record<string, unknown> = {}
    try { cached = JSON.parse(localStorage.getItem('currentUser') || '{}') } catch { /* invalid old cache */ }
    if (cached.id !== session.user.id) {
      clearProfile()
      const user = { id: session.user.id, email: session.user.email || '',
        username: session.user.user_metadata?.username || '', profilePic: '/loguito.png', role: 'user' }
      localStorage.setItem('currentUser', JSON.stringify(user))
      localStorage.setItem('email', user.email)
    }
    // Never await Supabase calls inside onAuthStateChange: the auth lock is held there.
    if (previousId !== session.user.id) setTimeout(async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
      if (error || !data || currentRevision !== revision || snapshot.session?.user.id !== data.id) return
      const user = { ...data, profilePic: data.avatar_url || '/loguito.png', showAge: data.show_age !== false }
      localStorage.setItem('currentUser', JSON.stringify(user))
      for (const [key, value] of Object.entries({ username: data.username, email: data.email || session.user.email,
        age: data.age, profilePic: user.profilePic, role: data.role || 'user' })) {
        localStorage.setItem(key, String(value ?? ''))
      }
      emit()
    }, 0)
  }
  emit()
}

if (supabase) {
  supabase.auth.onAuthStateChange((event: string, session: Session | null) => {
    acceptSession(session, event === 'PASSWORD_RECOVERY' || (event !== 'SIGNED_OUT' && snapshot.recovery))
  })
}

export function useAuth() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => snapshot)
}

export function hasSession() {
  return Boolean(snapshot.session) && localStorage.getItem('guestMode') !== 'true'
}

export async function logout() {
  try {
    if (supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
    }
  } finally {
    // Only this app's auth cache; preserve downloads, preferences and reading data.
    if (supabase) {
      const project = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
      localStorage.removeItem(`sb-${project}-auth-token`)
      localStorage.removeItem(`sb-${project}-auth-token-code-verifier`)
    }
    localStorage.removeItem('guestMode')
    acceptSession(null, false)
  }
}
