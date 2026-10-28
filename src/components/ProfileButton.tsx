import { hasSession, logout } from '../lib/auth'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const LocalNotifications = registerPlugin<any>('LocalNotifications')
const PushNotifications = registerPlugin<any>('PushNotifications')

async function ensureNativeChannel() {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.createChannel({
      id: 'popu_club_default',
      name: 'Avisos de Popu-Club',
      description: 'Capítulos, arcos y respuestas',
      importance: 5,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* el plugin nativo se añade con cap sync */
  }
}

async function showSystemNotification(n: {
  title: string
  body?: string | null
  image_url?: string | null
  link?: string | null
}) {
  if (Capacitor.isNativePlatform()) {
    try {
      await ensureNativeChannel()
      let perm = await LocalNotifications.checkPermissions()
      if (perm.display !== 'granted') perm = await LocalNotifications.requestPermissions()
      if (perm.display === 'granted') {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() % 2147483647) || 1,
              title: n.title,
              body: n.body || '',
              channelId: 'popu_club_default',
              extra: { link: n.link || '/home' },
            },
          ],
        })
        return
      }
    } catch (e) {
      console.warn('Aviso nativo', e)
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  try {
    const note = new Notification(n.title, {
      body: n.body || '',
      icon: n.image_url || '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: n.link || n.title,
      data: { url: n.link || '/home' },
    })
    note.onclick = () => {
      window.focus()
      if (n.link) window.location.href = n.link
      note.close()
    }
  } catch (e) {
    console.warn('Notification', e)
  }
}

async function registerWebPush(userId: string) {
  if (Capacitor.isNativePlatform() || !supabase) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
  if (!vapid) return
  try {
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      const padding = '='.repeat((4 - (vapid.length % 4)) % 4)
      const base64 = (vapid + padding).replace(/-/g, '+').replace(/_/g, '/')
      const raw = atob(base64)
      const key = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) key[i] = raw.charCodeAt(i)
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      })
    }
    const json = sub.toJSON()
    await supabase.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh || '',
        auth: json.keys?.auth || '',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )
  } catch (e) {
    console.warn('Web Push', e)
  }
}

async function registerClosedAppPush(userId: string) {
  if (!Capacitor.isNativePlatform() || !supabase) return
  try {
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive !== 'granted') perm = await PushNotifications.requestPermissions()
    if (perm.receive !== 'granted') return
    await PushNotifications.register()
    await PushNotifications.addListener('registration', async (tok: { value: string }) => {
      if (!tok?.value) return
      await supabase!.from('push_devices').upsert(
        {
          user_id: userId,
          platform: 'android',
          token: tok.value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      )
    })
  } catch (e) {
    console.warn('Registro de avisos con la app cerrada', e)
  }
}

type Noti = {
  id: string
  type: string
  title: string
  body: string
  image_url: string | null
  link: string | null
  read: boolean
  created_at: string
}

export default function ProfileButton() {
  const [showDetails, setShowDetails] = useState(false)
  const [showNotifs, setShowNotifs] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [profilePic, setProfilePic] = useState('/loguito.png')
  const [role, setRole] = useState('user')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [isGuest, setIsGuest] = useState(false)
  const [notifs, setNotifs] = useState<Noti[]>([])
  const [unread, setUnread] = useState(0)
  const [visible, setVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const location = useLocation()

  const isReader = /\/chapter\//.test(location.pathname)

  const loadUserData = () => {
    const guest = localStorage.getItem('guestMode') === 'true'
    const hasUser = hasSession()
    setIsGuest(guest || !hasUser)

    if (guest || !hasUser) {
      setUsername('')
      setEmail('')
      setAge('')
      setProfilePic('/loguito.png')
      setRole('user')
      setNotifs([])
      setUnread(0)
    } else {
      const storedUsername = localStorage.getItem('username')
      const storedEmail = localStorage.getItem('email')
      const storedAge = localStorage.getItem('age')
      const storedPic = localStorage.getItem('profilePic')
      const storedRole = localStorage.getItem('role') || 'user'

      try {
        const raw = localStorage.getItem('currentUser')
        if (raw) {
          const u = JSON.parse(raw)
          if (u.username) setUsername(u.username)
          if (u.email) setEmail(u.email)
          if (u.age) setAge(String(u.age))
          if (u.profilePic) setProfilePic(u.profilePic)
          if (u.role) setRole(u.role)
        }
      } catch {
        /* ignore */
      }

      if (storedUsername) setUsername(storedUsername)
      if (storedEmail) setEmail(storedEmail)
      if (storedAge) setAge(storedAge)
      if (storedPic) setProfilePic(storedPic)
      if (storedRole) setRole(storedRole)
    }

    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }

  const loadNotifs = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) return
    if (localStorage.getItem('guestMode') === 'true' || !localStorage.getItem('currentUser')) {
      setNotifs([])
      setUnread(0)
      return
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('notifications')
        .select('id, type, title, body, image_url, link, read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(40)

      const list = (data as Noti[]) || []
      setNotifs(list)
      setUnread(list.filter((n) => !n.read).length)
    } catch (e) {
      console.warn('notifs', e)
    }
  }, [])

  const showBrowserNotification = (n: {
    title: string
    body?: string
    image_url?: string | null
    link?: string | null
  }) => {
    void showSystemNotification(n)
  }

  const requestPushPermission = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await ensureNativeChannel()
        const perm = await LocalNotifications.checkPermissions()
        if (perm.display !== 'granted') await LocalNotifications.requestPermissions()
        await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (ev: { notification?: { extra?: { link?: string } } }) => {
            const link = ev?.notification?.extra?.link
            if (link) window.location.href = link
          }
        )
      } catch {
        /* plugin aún no sincronizado */
      }
    }
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return
    try {
      await Notification.requestPermission()
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadUserData()
    loadNotifs()
    requestPushPermission()

    const onProfileUpdate = () => {
      loadUserData()
      loadNotifs()
    }
    window.addEventListener('profileUpdated', onProfileUpdate)
    window.addEventListener('storage', onProfileUpdate)

    return () => {
      window.removeEventListener('profileUpdated', onProfileUpdate)
      window.removeEventListener('storage', onProfileUpdate)
    }
  }, [loadNotifs])

  // Realtime: nuevas notificaciones → lista + push del navegador
  useEffect(() => {
    if (!supabase || isGuest) return

    let channel: ReturnType<typeof supabase.channel> | null = null
    let cancelled = false

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || cancelled) return
      void registerClosedAppPush(user.id)
      void registerWebPush(user.id)

      channel = supabase
        .channel(`my-notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload: { new: Noti }) => {
            const row = payload.new
            setNotifs((prev) => [row, ...prev].slice(0, 40))
            setUnread((u) => u + 1)
            showBrowserNotification({
              title: row.title,
              body: row.body,
              image_url: row.image_url,
              link: row.link,
            })
          }        )
        .subscribe()
    })()

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [isGuest])

  // Auto-ocultar en el lector de capítulos
  useEffect(() => {
    if (!isReader) {
      setVisible(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      return
    }

    setVisible(false)

    const onTap = () => {
      setVisible(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setVisible(false), 3000)
    }

    window.addEventListener('click', onTap)
    window.addEventListener('touchstart', onTap)

    return () => {
      window.removeEventListener('click', onTap)
      window.removeEventListener('touchstart', onTap)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [isReader, location.pathname])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDetails(false)
        setShowNotifs(false)
      }
    }
    if (showDetails || showNotifs) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDetails, showNotifs])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  const goRegister = () => {
    localStorage.removeItem('guestMode')
    setShowDetails(false)
    navigate('/login')
  }

  const openNoti = async (n: Noti) => {
    if (supabase && !n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id)
      setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      setUnread((u) => Math.max(0, u - 1))
    }
    setShowNotifs(false)
    setShowDetails(false)
    if (n.link) navigate(n.link)
  }

  const markAllRead = async () => {
    if (!supabase) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnread(0)
  }

  const deleteNoti = async (id: string) => {
    if (!supabase) return
    const wasUnread = notifs.some((n) => n.id === id && !n.read)
    await supabase.from('notifications').delete().eq('id', id)
    setNotifs((prev) => prev.filter((n) => n.id !== id))
    if (wasUnread) setUnread((u) => Math.max(0, u - 1))
  }

  const deleteAll = async () => {
    if (!supabase || notifs.length === 0) return
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').delete().eq('user_id', user.id)
    setNotifs([])
    setUnread(0)
  }

  const panelBg = theme === 'light' ? '#e0e0e0' : '#2a2a2a'
  const panelFg = theme === 'light' ? '#222' : '#f0f0f0'

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: 15,
        right: 15,
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
        transition: 'opacity 0.45s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {!isGuest && (
          <button
            type="button"
            onClick={() => {
              setShowNotifs((v) => !v)
              setShowDetails(false)
              loadNotifs()
            }}
            aria-label="Avisos"
            style={{
              position: 'relative',
              width: 44,
              height: 44,
              borderRadius: '50%',
              border: '2px solid #fff',
              background: theme === 'light' ? '#333' : '#444',
              color: '#FFD700',
              fontSize: 20,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
            }}
          >
            🔔
            {unread > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -4,
                  right: -4,
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 999,
                  background: '#e74c3c',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #fff',
                }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => {
            setShowDetails(!showDetails)
            setShowNotifs(false)
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            transition: 'transform 0.25s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
          }}
          aria-label={isGuest ? 'Menú visita' : 'Menú de perfil'}
        >
          <img
            src={isGuest ? '/loguito.png' : profilePic}
            alt="Foto de perfil"
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: isGuest ? '3px solid #aaa' : '3px solid #fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
              objectFit: 'cover',
              opacity: isGuest ? 0.92 : 1,
            }}
          />
        </button>
      </div>

      {showNotifs && !isGuest && (
        <div
          className="popu-noti-list"
          style={{
            position: 'absolute',
            top: 70,
            right: 0,
            width: 320,
            maxHeight: 420,
            overflowY: 'auto',
            backgroundColor: panelBg,
            color: panelFg,
            padding: '12px 8px 12px 12px',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            border: '1px solid #999',
            fontSize: 13,
          }}
        >
          <style>{`
            .popu-noti-list {
              scrollbar-width: thin;
              scrollbar-color: #9a9a9a transparent;
            }
            .popu-noti-list::-webkit-scrollbar { width: 6px; }
            .popu-noti-list::-webkit-scrollbar-track { background: transparent; margin: 6px 0; }
            .popu-noti-list::-webkit-scrollbar-thumb {
              background: #9a9a9a;
              border-radius: 999px;
            }
            .popu-noti-list::-webkit-scrollbar-thumb:hover { background: #6e6e6e; }
            .noti-x:hover { background: #e74c3c !important; color: #fff !important; }
          `}</style>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 10,
              paddingRight: 4,
            }}
          >
            <strong style={{ fontSize: 15 }}>Avisos</strong>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: panelFg,
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  Marcar leídos
                </button>
              )}
              {notifs.length > 0 && (
                <button
                  type="button"
                  onClick={deleteAll}
                  style={{
                    border: '1px solid #c0392b',
                    background: 'transparent',
                    color: '#c0392b',
                    borderRadius: 999,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    padding: '3px 8px',
                  }}
                >
                  Borrar todas
                </button>
              )}
            </span>
          </div>
          {notifs.length === 0 && (
            <p style={{ margin: 0, opacity: 0.75, textAlign: 'center', padding: 16 }}>
              No tienes avisos todavía.
            </p>
          )}
          {notifs.map((n) => (
            <div
              key={n.id}
              style={{
                display: 'flex',
                gap: 8,
                width: '100%',
                textAlign: 'left',
                padding: '8px 6px 8px 10px',
                marginBottom: 6,
                borderRadius: 8,
                border: n.read ? '1px solid transparent' : '1px solid #FFD700',
                background: n.read ? 'transparent' : 'rgba(255,215,0,0.12)',
                color: panelFg,
                fontFamily: 'inherit',
                alignItems: 'flex-start',
                boxSizing: 'border-box',
              }}
            >
              <button
                type="button"
                onClick={() => openNoti(n)}
                style={{
                  display: 'flex',
                  gap: 10,
                  flex: 1,
                  minWidth: 0,
                  textAlign: 'left',
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'inherit',
                  fontFamily: 'inherit',
                }}
              >
                {n.image_url ? (
                  <img
                    src={n.image_url}
                    alt=""
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      objectFit: 'cover',
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 22, width: 40, textAlign: 'center' }}>📌</span>
                )}
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ display: 'block', fontSize: 13 }}>{n.title}</strong>
                  <span style={{ fontSize: 12, opacity: 0.85, display: 'block' }}>{n.body}</span>
                  <span style={{ fontSize: 11, opacity: 0.6 }}>
                    {new Date(n.created_at).toLocaleString('es-ES')}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="noti-x"
                aria-label="Eliminar aviso"
                onClick={() => deleteNoti(n.id)}
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: 'none',
                  background: 'rgba(128,128,128,0.18)',
                  color: panelFg,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  lineHeight: 1,
                  flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            right: 0,
            width: isGuest ? 260 : 250,
            backgroundColor: panelBg,
            color: panelFg,
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            fontSize: '0.95rem',
            border: '1px solid #999',
            animation: 'bubbleIn 0.2s ease',
          }}
        >
          <style>{`
            @keyframes bubbleIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          {isGuest ? (
            <>
              <p
                style={{
                  margin: '8px 0 14px',
                  textAlign: 'center',
                  fontWeight: 900,
                  fontSize: '1.45rem',
                  color: '#e74c3c',
                  letterSpacing: '0.5px',
                  lineHeight: 1.2,
                }}
              >
                ¡Regístrate!
              </p>
              <p
                style={{
                  margin: '0 0 14px',
                  textAlign: 'center',
                  fontSize: 13,
                  lineHeight: 1.4,
                  opacity: 0.9,
                }}
              >
                Estás en modo lector. Puedes leer, pero para dar like y comentar necesitas una
                cuenta.
              </p>
              <button
                type="button"
                onClick={goRegister}
                style={{
                  width: '100%',
                  padding: '12px 0',
                  background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: '#fff',
                  fontSize: 15,
                }}
              >
                Crear cuenta
              </button>
              <button
                type="button"
                onClick={toggleTheme}
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: '9px 0',
                  background: 'linear-gradient(135deg, #FFFF00, #FFD700)',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: '#111',
                }}
              >
                {theme === 'light' ? '🌙 Modo oscuro' : '☀️ Modo claro'}
              </button>
            </>
          ) : (
            <>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Mi perfil</p>
              <p style={{ margin: '4px 0' }}>Usuario: {username || '—'}</p>
              <p style={{ margin: '4px 0' }}>Email: {email || '—'}</p>
              <p style={{ margin: '4px 0' }}>Edad: {age || '—'}</p>
              {role === 'admin' && (
                <p style={{ margin: '4px 0', color: '#c0392b', fontWeight: 'bold', fontSize: 12 }}>
                  🛡 Admin
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setShowNotifs(true)
                  setShowDetails(false)
                  loadNotifs()
                }}
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: '9px 0',
                  background: unread > 0 ? '#e74c3c' : 'linear-gradient(135deg, #FFFF00, #FFD700)',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: unread > 0 ? '#fff' : '#111',
                }}
              >
                🔔 Avisos{unread > 0 ? ` (${unread})` : ''}
              </button>

              <button
                onClick={toggleTheme}
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: '9px 0',
                  background: 'linear-gradient(135deg, #FFFF00, #FFD700)',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: '#111',
                }}
              >
                {theme === 'light' ? '🌙 Modo oscuro' : '☀️ Modo claro'}
              </button>

              {role === 'admin' && (
                <Link
                  to="/admin"
                  onClick={() => setShowDetails(false)}
                  style={{
                    display: 'block',
                    marginTop: 12,
                    padding: '10px 0',
                    textAlign: 'center',
                    background: 'linear-gradient(135deg, #2c3e50, #34495e)',
                    color: '#FFD700',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    borderRadius: 8,
                    border: '2px solid #FFD700',
                  }}
                >
                  ⚙️ Panel admin
                </Link>
              )}

              <Link
                to="/profile"
                onClick={() => setShowDetails(false)}
                style={{
                  display: 'block',
                  marginTop: 12,
                  padding: '8px 0',
                  color: '#f0f500',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  borderTop: '1px solid #999',
                  paddingTop: 10,
                  textShadow:
                    theme === 'light'
                      ? '0 0 1px #000, 1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000'
                      : 'none',
                }}
              >
                Mi cuenta
              </Link>
              <button type="button" onClick={async () => {
                try { await logout() } catch { /* session cleared locally */ }
                window.location.reload()
              }} style={{ width: '100%', marginTop: 10, padding: 10, border: '1px solid #999', borderRadius: 8, background: 'transparent', color: panelFg, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar sesión</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
