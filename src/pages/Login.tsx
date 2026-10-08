import { useState, FormEvent, ChangeEvent, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

type Screen =
  | 'register'
  | 'login'
  | 'recover-choose'
  | 'recover-user'
  | 'recover-email'
  | 'recover-password'
  | 'recover-new-pass'

export default function Login() {
  const [screen, setScreen] = useState<Screen>('register')
  const [preview, setPreview] = useState('/loguito.png')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [guestBubble, setGuestBubble] = useState(false)
  const navigate = useNavigate()

  const [showCropper, setShowCropper] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [originalWidth, setOriginalWidth] = useState(0)
  const [originalHeight, setOriginalHeight] = useState(0)
  const [resizeWidth, setResizeWidth] = useState(0)
  const [resizeHeight, setResizeHeight] = useState(0)
  const [livePreview, setLivePreview] = useState<string | null>(null)

  const [recoverEmail, setRecoverEmail] = useState('')
  const [recoverUsername, setRecoverUsername] = useState('')
  const [recoverResult, setRecoverResult] = useState('')
  const [newPass, setNewPass] = useState('')
  const [newPass2, setNewPass2] = useState('')
  const [resetProfile, setResetProfile] = useState<{
    username?: string
    email?: string
    avatar_url?: string
  } | null>(null)
  const [askLogin, setAskLogin] = useState(false)

  const validatePassword = (password: string) =>
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)

  const onCropComplete = useCallback((_: Area, area: Area) => {
    setCroppedAreaPixels(area)
  }, [])

  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.src = imageSrc
    img.onload = () => {
      setOriginalWidth(img.width)
      setOriginalHeight(img.height)
      setResizeWidth(img.width)
      setResizeHeight(img.height)
    }
  }, [imageSrc])

  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels || resizeWidth <= 0 || resizeHeight <= 0) {
      setLivePreview(null)
      return
    }
    const generatePreview = async () => {
      const image = new Image()
      image.src = imageSrc
      await new Promise((resolve) => (image.onload = resolve))
      const cropSize = Math.min(croppedAreaPixels.width, croppedAreaPixels.height)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = cropSize
      tempCanvas.height = cropSize
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) return
      tempCtx.beginPath()
      tempCtx.arc(cropSize / 2, cropSize / 2, cropSize / 2, 0, Math.PI * 2)
      tempCtx.closePath()
      tempCtx.clip()
      tempCtx.drawImage(
        image,
        croppedAreaPixels.x,
        croppedAreaPixels.y,
        croppedAreaPixels.width,
        croppedAreaPixels.height,
        0,
        0,
        cropSize,
        cropSize
      )
      const finalCanvas = document.createElement('canvas')
      finalCanvas.width = resizeWidth
      finalCanvas.height = resizeHeight
      const finalCtx = finalCanvas.getContext('2d')
      if (!finalCtx) return
      finalCtx.drawImage(tempCanvas, 0, 0, resizeWidth, resizeHeight)
      setLivePreview(finalCanvas.toDataURL('image/jpeg', 0.9))
    }
    generatePreview()
  }, [imageSrc, croppedAreaPixels, resizeWidth, resizeHeight, zoom])

  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('type=password_recovery')) {
      setScreen('recover-new-pass')
      setInfo('Enlace verificado. Escribe tu nueva contraseña.')
      ;(async () => {
        if (!supabase) return
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) {
          const { data: p } = await supabase
            .from('profiles')
            .select('username, avatar_url, email')
            .eq('id', user.id)
            .maybeSingle()
          setResetProfile({
            username: p?.username || '',
            email: p?.email || user.email || '',
            avatar_url: p?.avatar_url || '/loguito.png',
          })
        }
      })()
    }
  }, [])

  useEffect(() => {
    if (screen !== 'register') setGuestBubble(false)
  }, [screen])

  const handleApply = () => {
    if (livePreview) setPreview(livePreview)
    setShowCropper(false)
    setImageSrc(null)
    setLivePreview(null)
  }

  const handleAutoAdjust = () => {
    setCrop({ x: 0, y: 0 })
    setZoom(1.15)
    setResizeWidth(originalWidth)
    setResizeHeight(originalHeight)
  }

  const handleProfilePic = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageSrc(reader.result)
        setShowCropper(true)
        setZoom(1)
        setCrop({ x: 0, y: 0 })
        setLivePreview(null)
      }
    }
    reader.readAsDataURL(file)
  }

  const uploadAvatarIfNeeded = async (userId: string, pic: string): Promise<string> => {
    if (!pic) return '/loguito.png'
    if (!pic.startsWith('data:')) return pic
    if (!supabase) return pic
    try {
      const res = await fetch(pic)
      const blob = await res.blob()
      const ext = blob.type.includes('png') ? 'png' : 'jpg'
      const path = `avatars/${userId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('comics')
        .upload(path, blob, { upsert: true, contentType: blob.type || 'image/jpeg' })
      if (upErr) {
        console.warn('Avatar upload:', upErr.message)
        return pic
      }
      return supabase.storage.from('comics').getPublicUrl(path).data.publicUrl
    } catch {
      return pic
    }
  }

  const clearGuestMode = () => {
    localStorage.removeItem('guestMode')
  }

  const persistSession = (profile: {
    id?: string
    username?: string | null
    email?: string | null
    age?: string | number | null
    avatar_url?: string | null
    role?: string | null
    description?: string | null
    banner?: string | null
    show_age?: boolean | null
  }) => {
    clearGuestMode()
    const username = profile.username || ''
    const email = profile.email || ''
    const age = profile.age != null ? String(profile.age) : ''
    const profilePic = profile.avatar_url || '/loguito.png'
    const role = profile.role || 'user'
    const currentUser = {
      id: profile.id,
      username,
      email,
      age,
      profilePic,
      banner: profile.banner || '',
      description: profile.description || '',
      showAge: profile.show_age !== false,
      role,
    }
    localStorage.setItem('currentUser', JSON.stringify(currentUser))
    localStorage.setItem('username', username)
    localStorage.setItem('email', email)
    localStorage.setItem('age', age)
    localStorage.setItem('profilePic', profilePic)
    localStorage.setItem('role', role)
    window.dispatchEvent(new Event('profileUpdated'))
  }

  const enterAsGuest = () => {
    localStorage.setItem('guestMode', 'true')
    localStorage.removeItem('currentUser')
    localStorage.removeItem('username')
    localStorage.removeItem('email')
    localStorage.removeItem('age')
    localStorage.removeItem('profilePic')
    localStorage.removeItem('role')
    window.dispatchEvent(new Event('profileUpdated'))
    setGuestBubble(false)
    navigate('/home')
  }

  const go = (s: Screen) => {
    setScreen(s)
    setError('')
    setInfo('')
    setRecoverResult('')
  }

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = e.target as HTMLFormElement
    const username = (form.elements.namedItem('username') as HTMLInputElement).value.trim()
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim().toLowerCase()
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const confirm = (form.elements.namedItem('confirm_password') as HTMLInputElement).value
    const age = (form.elements.namedItem('age') as HTMLSelectElement).value

    if (!username || !email || !password || !confirm || !age) {
      setError('Por favor completa todos los campos.')
      setLoading(false)
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      setLoading(false)
      return
    }
    if (!validatePassword(password)) {
      setError('La contraseña debe tener mínimo 8 caracteres, 1 mayúscula, 1 minúscula y 1 número.')
      setLoading(false)
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no está configurado. Revisa el archivo .env y reinicia el servidor.')
      setLoading(false)
      return
    }
    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle()
      if (existing) {
        setError('Ese nombre de usuario ya está en uso. Elige otro.')
        setLoading(false)
        return
      }
      const { data: authData, error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username, age: Number(age) || age } },
      })
      if (signUpErr) {
        setError(signUpErr.message)
        setLoading(false)
        return
      }
      const user = authData.user
      if (!user) {
        setError('No se pudo crear la cuenta. Revisa si el correo ya está registrado.')
        setLoading(false)
        return
      }
      const avatarUrl = await uploadAvatarIfNeeded(user.id, preview)
      await supabase.from('profiles').upsert(
        {
          id: user.id,
          email,
          username,
          age: Number(age) || age,
          avatar_url: avatarUrl,
          role: 'user',
          show_age: true,
          description: '',
          banner: '',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      if (authData.session) {
        persistSession({
          id: user.id,
          username,
          email,
          age,
          avatar_url: avatarUrl,
          role: 'user',
          show_age: true,
        })
        setLoading(false)
        navigate('/home')
        return
      }
      setLoading(false)
      go('login')
      setInfo('Cuenta creada. Si hace falta, confirma el correo e inicia sesión.')
    } catch (err: any) {
      setError(err?.message || 'Error al registrar.')
      setLoading(false)
    }
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = e.target as HTMLFormElement
    const identifier = (form.elements.namedItem('email') as HTMLInputElement).value.trim()
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    if (!identifier || !password) {
      setError('Introduce usuario o correo, y la contraseña.')
      setLoading(false)
      return
    }
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase no está configurado.')
      setLoading(false)
      return
    }
    try {
      let email = identifier.toLowerCase()
      if (!identifier.includes('@')) {
        const { data: byUser } = await supabase
          .from('profiles')
          .select('email')
          .ilike('username', identifier)
          .maybeSingle()
        if (!byUser?.email) {
          setError('No existe una cuenta con ese nombre de usuario.')
          setLoading(false)
          return
        }
        email = byUser.email
      }
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({ email, password })
      if (signInErr) {
        setError(
          signInErr.message.includes('Invalid login')
            ? 'Usuario/correo o contraseña incorrectos.'
            : signInErr.message
        )
        setLoading(false)
        return
      }
      const user = data.user
      if (!user) {
        setError('No se pudo iniciar sesión.')
        setLoading(false)
        return
      }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) persistSession(profile)
      else {
        const username = (user.user_metadata?.username as string) || email.split('@')[0] || 'Usuario'
        persistSession({
          id: user.id,
          email: user.email || email,
          username,
          role: 'user',
          avatar_url: '/loguito.png',
        })
      }
      setLoading(false)
      navigate('/home')
    } catch (err: any) {
      setError(err?.message || 'Error al iniciar sesión.')
      setLoading(false)
    }
  }

  const recoverUsernameByEmail = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setRecoverResult('')
    if (!recoverEmail.trim() || !supabase) {
      setError('Escribe tu correo.')
      return
    }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .ilike('email', recoverEmail.trim().toLowerCase())
        .maybeSingle()
      setRecoverResult(
        data?.username
          ? `El usuario vinculado a ese correo es: ${data.username}`
          : 'No encontramos un usuario con ese correo.'
      )
    } finally {
      setLoading(false)
    }
  }

  const recoverEmailByUsername = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setRecoverResult('')
    if (!recoverUsername.trim() || !supabase) {
      setError('Escribe tu usuario.')
      return
    }
    setLoading(true)
    try {
      const { data } = await supabase
        .from('profiles')
        .select('email')
        .ilike('username', recoverUsername.trim())
        .maybeSingle()
      if (data?.email) {
        const [local, domain] = data.email.split('@')
        const masked =
          (local && local.length > 2 ? local[0] + '***' + local.slice(-1) : '***') +
          '@' +
          (domain || '***')
        setRecoverResult(`El correo vinculado es: ${masked}`)
      } else {
        setRecoverResult('No encontramos un correo para ese usuario.')
      }
    } finally {
      setLoading(false)
    }
  }

  const sendPasswordReset = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    if (!recoverEmail.trim() || !supabase) {
      setError('Escribe tu correo.')
      return
    }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        recoverEmail.trim().toLowerCase(),
        { redirectTo: window.location.origin + '/login' }
      )
      if (err) setError(err.message)
      else {
        setInfo('Te enviamos un enlace a tu correo. Ábrelo para elegir una nueva contraseña.')
        const { data: p } = await supabase
          .from('profiles')
          .select('username, email, avatar_url')
          .ilike('email', recoverEmail.trim().toLowerCase())
          .maybeSingle()
        if (p) {
          setResetProfile({
            username: p.username || '',
            email: p.email || recoverEmail,
            avatar_url: p.avatar_url || '/loguito.png',
          })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validatePassword(newPass)) {
      setError('La contraseña debe tener mínimo 8 caracteres, 1 mayúscula, 1 minúscula y 1 número.')
      return
    }
    if (newPass !== newPass2) {
      setError('Las contraseñas no coinciden.')
      return
    }
    if (!supabase) return
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: newPass })
      if (err) {
        setError(err.message + ' — Abre primero el enlace del correo.')
        setLoading(false)
        return
      }
      setInfo('Contraseña actualizada correctamente.')
      setAskLogin(true)
    } finally {
      setLoading(false)
    }
  }

  const goHomeAfterReset = async () => {
    if (!supabase) {
      go('login')
      return
    }
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (profile) persistSession(profile)
      navigate('/home')
    } else {
      go('login')
      setInfo('Inicia sesión con tu nueva contraseña.')
    }
  }

  return (
    <>
      <style>{`
        @font-face {
          font-family: 'Laffayette Comic Pro';
          src: url('/Laffayette_Comic_Pro.woff') format('woff');
          font-weight: normal;
          font-style: normal;
        }
        * { box-sizing: border-box; }
        html, body, #root {
          margin: 0;
          padding: 0;
          min-height: 100%;
          width: 100%;
        }
        body {
          background-image: url('/Fondodeweb.png');
          background-position: center;
          background-size: cover;
          background-attachment: fixed;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          color: white;
        }
        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.72);
          z-index: 0;
          pointer-events: none;
        }
        .auth-wrapper {
          position: relative;
          z-index: 1;
          width: 100%;
          min-height: 100vh;
          min-height: 100dvh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 12px 10px;
          box-sizing: border-box;
        }
        .registration-container,
        .login-container {
          background-color: rgba(255, 255, 255, 0.92);
          padding: 18px 18px 16px;
          box-shadow: 0 0 28px rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          border: 5px solid #FFFF00;
          backdrop-filter: blur(12px);
          animation: slideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
          width: 100%;
          max-width: 380px;
          margin: 0 auto;
          max-height: min(92vh, 720px);
          overflow-y: auto;
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        h1 {
          text-align: center;
          color: rgb(128, 129, 212);
          text-shadow: 0 0 10px #FFFF00, 0 0 18px #FFFF00, 0 0 28px #FF8500;
          animation: neonGlow 1.5s infinite alternate;
          font-size: 1.4rem;
          margin: 0 0 12px 0;
        }
        @keyframes neonGlow {
          from { text-shadow: 0 0 12px #FFFF00, 0 0 20px #FF8500; }
          to { text-shadow: 0 0 20px #FFFF00, 0 0 32px #FF8500; }
        }
        .input-group { margin-bottom: 10px; }
        label {
          display: block;
          margin-bottom: 3px;
          color: #0a0a0a;
          font-size: 12px;
        }
        input[type="text"],
        input[type="email"],
        input[type="password"],
        select {
          width: 100%;
          padding: 8px 10px;
          border: 3px solid #494949;
          background: rgb(102, 99, 120);
          color: #0a0a0a;
          font-size: 14px;
          border-radius: 7px;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
        }
        input:focus, select:focus {
          outline: none;
          background: rgb(82, 80, 97);
          border-color: #222;
        }
        .profile-pic-group { text-align: center; margin-bottom: 10px; }
        .profile-pic-wrapper {
          position: relative;
          width: 84px;
          height: 84px;
          margin: 0 auto;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid #FFFF00;
          box-shadow: 0 0 10px #FFFF00;
          cursor: pointer;
        }
        #profile-pic-preview { width: 100%; height: 100%; object-fit: cover; }
        .profile-pic-wrapper input[type="file"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
          height: 100%;
        }
        form button[type="submit"],
        .toggle-button,
        .guest-button {
          width: 100%;
          padding: 10px 12px;
          margin-top: 6px;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
        }
        form button[type="submit"] {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          box-shadow: 0 0 10px #FFFF00;
          margin-top: 8px;
        }
        form button[type="submit"]:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .toggle-button {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: #111;
          margin-top: 8px;
        }
        .toggle-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .guest-button {
          background: rgba(255,255,255,0.85);
          border: 3px solid #494949;
          color: #222;
          margin-top: 6px;
        }
        .guest-button:hover {
          border-color: #FFFF00;
          background: rgba(255, 255, 0, 0.12);
          transform: scale(1.02);
        }
        .guest-hint {
          text-align: center;
          color: #555;
          font-size: 11px;
          margin: 6px 0 4px 0;
          line-height: 1.35;
        }
        .guest-float {
          position: fixed;
          top: 14px;
          left: 14px;
          z-index: 50;
        }
        .guest-float-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid #FFFF00;
          background: rgba(255,255,255,0.95);
          color: #222;
          font-size: 20px;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(0,0,0,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }
        .guest-float-btn:hover { transform: scale(1.08); }
        .guest-bubble {
          position: absolute;
          top: 56px;
          left: 0;
          width: 240px;
          background: rgba(255,255,255,0.97);
          border: 4px solid #FFFF00;
          border-radius: 14px;
          padding: 14px;
          color: #222;
          box-shadow: 0 8px 24px rgba(0,0,0,0.35);
          animation: slideIn 0.25s ease;
        }
        .guest-bubble h3 {
          margin: 0 0 6px;
          font-size: 1rem;
          color: rgb(128, 129, 212);
          text-align: center;
        }
        .guest-bubble p {
          margin: 0 0 10px;
          font-size: 12px;
          line-height: 1.35;
          color: #333;
          text-align: center;
        }
        .error-message {
          background: #ff4d4d; color: white; padding: 8px 10px;
          border-radius: 8px; margin-bottom: 10px; font-size: 12px; text-align: center;
        }
        .info-message {
          background: #2d6a4f; color: white; padding: 8px 10px;
          border-radius: 8px; margin-bottom: 10px; font-size: 12px; text-align: center;
        }
        .recover-link {
          display: block;
          width: 100%;
          text-align: center;
          margin-top: 4px;
          margin-bottom: 2px;
          background: none;
          border: none;
          color: #555;
          font-size: 12px;
          font-family: inherit;
          text-decoration: underline;
          cursor: pointer;
          padding: 6px;
        }
        .recover-link:hover { color: #222; }
        .recover-option {
          width: 100%;
          padding: 10px;
          margin-bottom: 8px;
          border: 3px solid #494949;
          border-radius: 8px;
          background: rgb(102, 99, 120);
          color: #0a0a0a;
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
          text-align: left;
        }
        .recover-option:hover { border-color: #FFFF00; }
        .reset-header { text-align: center; margin-bottom: 10px; }
        .reset-header img {
          width: 72px; height: 72px; border-radius: 50%;
          border: 3px solid #FFFF00; object-fit: cover; margin-bottom: 6px;
        }
        .reset-header .name { color: #222; font-weight: bold; font-size: 1.05rem; }
        .reset-header .mail { color: #555; font-size: 12px; }
        .cropper-overlay {
          position: fixed; inset: 0; background: rgba(0, 0, 0, 0.88);
          z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 12px;
        }
        .cropper-modal {
          background: rgba(255, 255, 255, 0.96);
          border: 5px solid #FFFF00; border-radius: 16px;
          width: 100%; max-width: 420px; overflow: hidden;
        }
        .cropper-header {
          padding: 12px 14px; background: #333; color: white;
          font-size: 1.05rem; text-align: center; border-bottom: 4px solid #FFFF00;
        }
        .cropper-area { position: relative; width: 100%; height: 200px; background: #111; }
        .cropper-controls { padding: 12px 14px 4px; display: flex; flex-direction: column; gap: 10px; }
        .cropper-controls label { color: #222; font-size: 12px; margin-bottom: 2px; display: block; }
        .cropper-controls input[type="range"] { width: 100%; accent-color: #FFD700; }
        .pixel-inputs { display: flex; gap: 8px; }
        .pixel-inputs > div { flex: 1; }
        .pixel-inputs input[type="number"] {
          width: 100%; padding: 7px; border: 3px solid #494949; border-radius: 6px;
          background: rgb(102, 99, 120); color: #0a0a0a; font-size: 13px; font-family: inherit;
        }
        .live-preview-box { text-align: center; padding: 8px 0 2px; }
        .live-preview-box img {
          width: 80px; height: 80px; border-radius: 50%; border: 3px solid #FFFF00; object-fit: cover;
        }
        .cropper-actions {
          display: flex; gap: 8px; padding: 8px 14px 14px; flex-wrap: wrap;
        }
        .cropper-actions button {
          flex: 1; min-width: 90px; padding: 10px 6px; border: none; border-radius: 8px;
          font-family: inherit; font-size: 12px; cursor: pointer;
        }
        .btn-cancel { background: #666; color: white; }
        .btn-auto { background: #4a4a8a; color: white; }
        .btn-apply {
          background: linear-gradient(135deg, #FFFF00, #FFD700); color: black;
          box-shadow: 0 0 10px #FFFF00;
        }
        @media (max-width: 480px) {
          .auth-wrapper {
            padding: 8px;
            align-items: flex-start;
            padding-top: 20px;
          }
          .registration-container, .login-container {
            max-height: none;
            padding: 16px 12px;
          }
          h1 { font-size: 1.3rem; }
          .cropper-area { height: 180px; }
          .guest-bubble { width: 220px; }
        }
      `}</style>

      {screen === 'register' && (
        <div className="guest-float">
          <button
            type="button"
            className="guest-float-btn"
            onClick={() => setGuestBubble((v) => !v)}
            aria-label="Modo visita"
            title="Entrar como visita"
          >
            👁
          </button>
          {guestBubble && (
            <div className="guest-bubble">
              <h3>Modo visita</h3>
              <p>
                Puedes leer arcos y capítulos sin cuenta. Likes, comentarios y perfil requieren
                registro.
              </p>
              <button
                type="button"
                className="guest-button"
                onClick={enterAsGuest}
                style={{ marginBottom: 0 }}
              >
                Entrar como visita
              </button>
            </div>
          )}
        </div>
      )}

      <div className="auth-wrapper">
        {screen === 'register' && (
          <div className="registration-container" key="register">
            <h1>Popu-Club</h1>
            {error && <div className="error-message">{error}</div>}
            {info && <div className="info-message">{info}</div>}
            <form onSubmit={handleRegister}>
              <div className="profile-pic-group">
                <div className="profile-pic-wrapper">
                  <img id="profile-pic-preview" src={preview} alt="Foto de perfil" />
                  <input type="file" accept="image/*" onChange={handleProfilePic} disabled={loading} />
                </div>
              </div>
              <div className="input-group">
                <label htmlFor="age">Selecciona tu edad:</label>
                <select id="age" name="age" required disabled={loading}>
                  <option value="">Selecciona...</option>
                  {Array.from({ length: 35 }, (_, i) => i + 11).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label htmlFor="username">Nombre de usuario:</label>
                <input type="text" id="username" name="username" required disabled={loading} />
              </div>
              <div className="input-group">
                <label htmlFor="email">Correo electrónico:</label>
                <input type="email" id="email" name="email" required disabled={loading} />
              </div>
              <div className="input-group">
                <label htmlFor="password">Contraseña:</label>
                <input type="password" id="password" name="password" required disabled={loading} />
              </div>
              <div className="input-group">
                <label htmlFor="confirm_password">Confirmar contraseña:</label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Creando cuenta…' : 'Registrar'}
              </button>
              <button type="button" className="toggle-button" disabled={loading} onClick={() => go('login')}>
                ¡Ya tengo cuenta!
              </button>
            </form>
          </div>
        )}

        {screen === 'login' && (
          <div className="login-container" key="login">
            <h1>Iniciar Sesión</h1>
            {error && <div className="error-message">{error}</div>}
            {info && <div className="info-message">{info}</div>}
            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label htmlFor="login-email">Usuario o correo:</label>
                <input
                  type="text"
                  id="login-email"
                  name="email"
                  required
                  disabled={loading}
                  placeholder="nombre de usuario o correo"
                  autoComplete="username"
                />
              </div>
              <div className="input-group">
                <label htmlFor="login-password">Contraseña:</label>
                <input type="password" id="login-password" name="password" required disabled={loading} />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Entrando…' : 'Iniciar Sesión'}
              </button>
              <button type="button" className="toggle-button" disabled={loading} onClick={() => go('register')}>
                ¡No tengo cuenta!
              </button>
            </form>
            <p className="guest-hint">Puedes leer arcos y capítulos sin registrarte.</p>
            <button type="button" className="guest-button" disabled={loading} onClick={enterAsGuest}>
              👁 Entrar como visita
            </button>
            <button type="button" className="recover-link" onClick={() => go('recover-choose')}>
              ¿Olvidaste usuario, correo o contraseña?
            </button>
          </div>
        )}

        {screen === 'recover-choose' && (
          <div className="login-container" key="recover-choose">
            <h1>¿Qué quieres recordar?</h1>
            {error && <div className="error-message">{error}</div>}
            <button type="button" className="recover-option" onClick={() => go('recover-user')}>
              👤 Usuario — tengo el correo
            </button>
            <button type="button" className="recover-option" onClick={() => go('recover-email')}>
              ✉️ Correo — tengo el usuario
            </button>
            <button type="button" className="recover-option" onClick={() => go('recover-password')}>
              🔑 Contraseña — enviarme enlace
            </button>
            <button type="button" className="toggle-button" onClick={() => go('login')}>
              Volver a iniciar sesión
            </button>
          </div>
        )}

        {screen === 'recover-user' && (
          <div className="login-container" key="recover-user">
            <h1>Recordar usuario</h1>
            {error && <div className="error-message">{error}</div>}
            {recoverResult && <div className="info-message">{recoverResult}</div>}
            <form onSubmit={recoverUsernameByEmail}>
              <div className="input-group">
                <label>Correo de tu cuenta</label>
                <input
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Buscando…' : 'Buscar usuario'}
              </button>
            </form>
            <button type="button" className="toggle-button" onClick={() => go('recover-choose')}>
              Otras opciones
            </button>
            <button type="button" className="recover-link" onClick={() => go('login')}>
              Volver a iniciar sesión
            </button>
          </div>
        )}

        {screen === 'recover-email' && (
          <div className="login-container" key="recover-email">
            <h1>Recordar correo</h1>
            {error && <div className="error-message">{error}</div>}
            {recoverResult && <div className="info-message">{recoverResult}</div>}
            <form onSubmit={recoverEmailByUsername}>
              <div className="input-group">
                <label>Nombre de usuario</label>
                <input
                  type="text"
                  value={recoverUsername}
                  onChange={(e) => setRecoverUsername(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Buscando…' : 'Buscar correo'}
              </button>
            </form>
            <button type="button" className="toggle-button" onClick={() => go('recover-choose')}>
              Otras opciones
            </button>
            <button type="button" className="recover-link" onClick={() => go('login')}>
              Volver a iniciar sesión
            </button>
          </div>
        )}

        {screen === 'recover-password' && (
          <div className="login-container" key="recover-password">
            <h1>Nueva contraseña</h1>
            {error && <div className="error-message">{error}</div>}
            {info && <div className="info-message">{info}</div>}
            <form onSubmit={sendPasswordReset}>
              <div className="input-group">
                <label>Correo de la cuenta</label>
                <input
                  type="email"
                  value={recoverEmail}
                  onChange={(e) => setRecoverEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <button type="submit" disabled={loading}>
                {loading ? 'Enviando…' : 'Enviar enlace'}
              </button>
            </form>
            <button type="button" className="toggle-button" onClick={() => go('recover-choose')}>
              Otras opciones
            </button>
            <button type="button" className="recover-link" onClick={() => go('login')}>
              Volver a iniciar sesión
            </button>
          </div>
        )}

        {screen === 'recover-new-pass' && (
          <div className="login-container" key="recover-new-pass">
            <h1>Elige nueva contraseña</h1>
            {resetProfile && (
              <div className="reset-header">
                <img src={resetProfile.avatar_url || '/loguito.png'} alt="" />
                <div className="name">{resetProfile.username || 'Usuario'}</div>
                <div className="mail">{resetProfile.email}</div>
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            {info && <div className="info-message">{info}</div>}
            {!askLogin ? (
              <form onSubmit={updatePassword}>
                <div className="input-group">
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <label>Confirmar contraseña</label>
                  <input
                    type="password"
                    value={newPass2}
                    onChange={(e) => setNewPass2(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
                <button type="submit" disabled={loading}>
                  {loading ? 'Guardando…' : 'Continuar'}
                </button>
              </form>
            ) : (
              <>
                <p style={{ color: '#333', textAlign: 'center', fontSize: 14 }}>
                  ¿Quieres iniciar sesión ahora?
                </p>
                <button type="button" onClick={goHomeAfterReset}>
                  Sí, ir al inicio
                </button>
                <button type="button" className="toggle-button" onClick={() => go('login')}>
                  Más tarde
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {showCropper && imageSrc && (
        <div className="cropper-overlay">
          <div className="cropper-modal">
            <div className="cropper-header">Ajusta tu foto de perfil</div>
            <div className="cropper-area">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="cropper-controls">
              <div>
                <label>Zoom (acercar / alejar)</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                />
              </div>
              <div>
                <label>Redimensionar (píxeles)</label>
                <div className="pixel-inputs">
                  <div>
                    <label style={{ fontSize: 11 }}>Ancho</label>
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      value={resizeWidth}
                      onChange={(e) => setResizeWidth(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11 }}>Alto</label>
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      value={resizeHeight}
                      onChange={(e) => setResizeHeight(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <small style={{ color: '#555', fontSize: 11 }}>
                  Original: {originalWidth} × {originalHeight} px
                </small>
              </div>
            </div>
            {livePreview && (
              <div className="live-preview-box">
                <img src={livePreview} alt="Vista previa" />
                <div style={{ fontSize: 12, color: '#333', marginTop: 4 }}>
                  Vista previa ({resizeWidth}×{resizeHeight})
                </div>
              </div>
            )}
            <div className="cropper-actions">
              <button className="btn-cancel" onClick={() => setShowCropper(false)}>
                Cancelar
              </button>
              <button className="btn-auto" onClick={handleAutoAdjust}>
                Auto ajustar
              </button>
              <button className="btn-apply" onClick={handleApply}>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
