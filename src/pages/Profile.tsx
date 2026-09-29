import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Footer from '../components/Footer'
import ProfileButton from '../components/ProfileButton'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

export default function Profile() {
  const navigate = useNavigate()
  const [user, setUser] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  const [form, setForm] = useState({
    username: '',
    age: '',
    showAge: true,
    description: '',
    banner: '',
    profilePic: '/loguito.png',
  })

  const [showCropper, setShowCropper] = useState(false)
  const [cropType, setCropType] = useState<'avatar' | 'banner'>('avatar')
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const [originalWidth, setOriginalWidth] = useState(0)
  const [originalHeight, setOriginalHeight] = useState(0)
  const [resizeWidth, setResizeWidth] = useState(0)
  const [resizeHeight, setResizeHeight] = useState(0)
  const [livePreview, setLivePreview] = useState<string | null>(null)

  const persistUser = (updated: any) => {
    localStorage.setItem('currentUser', JSON.stringify(updated))
    localStorage.setItem('username', updated.username || '')
    localStorage.setItem('age', updated.age || '')
    localStorage.setItem('profilePic', updated.profilePic || '/loguito.png')

    const users = JSON.parse(localStorage.getItem('users') || '[]')
    const idx = users.findIndex((u: any) => u.email === updated.email)
    if (idx !== -1) {
      users[idx] = updated
      localStorage.setItem('users', JSON.stringify(users))
    }

    window.dispatchEvent(new Event('profileUpdated'))
  }

  useEffect(() => {
    const current = localStorage.getItem('currentUser')
    if (!current) {
      navigate('/login')
      return
    }
    const parsed = JSON.parse(current)
    setUser(parsed)
    setForm({
      username: parsed.username || '',
      age: parsed.age || '',
      showAge: parsed.showAge !== false,
      description: parsed.description || '',
      banner: parsed.banner || '',
      profilePic: parsed.profilePic || '/loguito.png',
    })

    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [navigate])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    if (!imageSrc) return
    const img = new Image()
    img.src = imageSrc
    img.onload = () => {
      setOriginalWidth(img.width)
      setOriginalHeight(img.height)

      if (cropType === 'banner') {
        setResizeWidth(1200)
        setResizeHeight(300)
      } else {
        const side = Math.max(512, Math.min(img.width, img.height))
        setResizeWidth(side)
        setResizeHeight(side)
      }
    }
  }, [imageSrc, cropType])

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels)
  }, [])

  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels || resizeWidth <= 0 || resizeHeight <= 0) {
      setLivePreview(null)
      return
    }

    const generate = async () => {
      const image = new Image()
      image.src = imageSrc
      await new Promise((r) => (image.onload = r))

      const cropW = croppedAreaPixels.width
      const cropH = croppedAreaPixels.height

      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) return

      if (cropType === 'avatar') {
        const size = Math.min(cropW, cropH)
        tempCanvas.width = size
        tempCanvas.height = size
        tempCtx.beginPath()
        tempCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        tempCtx.closePath()
        tempCtx.clip()
        tempCtx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          cropW,
          cropH,
          0, 0, size, size
        )
      } else {
        tempCanvas.width = cropW
        tempCanvas.height = cropH
        tempCtx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          cropW,
          cropH,
          0, 0, cropW, cropH
        )
      }

      let finalW = resizeWidth
      let finalH = resizeHeight

      if (cropType === 'avatar') {
        finalW = Math.max(resizeWidth, 512)
        finalH = Math.max(resizeHeight, 512)
      } else {
        finalW = Math.max(resizeWidth, 1200)
        finalH = Math.round(finalW / 4)
      }

      const finalCanvas = document.createElement('canvas')
      finalCanvas.width = finalW
      finalCanvas.height = finalH
      const finalCtx = finalCanvas.getContext('2d')
      if (!finalCtx) return

      finalCtx.imageSmoothingEnabled = true
      finalCtx.imageSmoothingQuality = 'high'
      finalCtx.drawImage(tempCanvas, 0, 0, finalW, finalH)

      setLivePreview(finalCanvas.toDataURL('image/jpeg', 0.95))
    }

    generate()
  }, [imageSrc, croppedAreaPixels, resizeWidth, resizeHeight, cropType])

  const handleApply = () => {
    if (!livePreview || !user) return

    const updated = {
      ...user,
      ...form,
      profilePic: cropType === 'avatar' ? livePreview : form.profilePic,
      banner: cropType === 'banner' ? livePreview : form.banner,
    }

    if (cropType === 'avatar') {
      setForm((f) => ({ ...f, profilePic: livePreview }))
    } else {
      setForm((f) => ({ ...f, banner: livePreview }))
    }

    setUser(updated)
    persistUser(updated)

    setShowCropper(false)
    setImageSrc(null)
    setLivePreview(null)
  }

  const openCropper = (type: 'avatar' | 'banner', file?: File) => {
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setCropType(type)
          setImageSrc(reader.result)
          setShowCropper(true)
          setZoom(1)
          setCrop({ x: 0, y: 0 })
        }
      }
      reader.readAsDataURL(file)
    } else {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = (e) => {
        const f = (e.target as HTMLInputElement).files?.[0]
        if (f) openCropper(type, f)
      }
      input.click()
    }
  }

  const handleSave = () => {
    const updated = { ...user, ...form }
    setUser(updated)
    persistUser(updated)
    setEditMode(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('currentUser')
    localStorage.removeItem('username')
    localStorage.removeItem('email')
    localStorage.removeItem('age')
    localStorage.removeItem('profilePic')
    navigate('/login')
  }

  if (!user) return null

  return (
    <>
      <style>{`
        .profile-page {
          max-width: 960px;
          margin: 0 auto;
          padding: 20px 16px 40px;
        }
        .banner {
          height: 200px;
          background: #333;
          border-radius: 14px;
          background-size: cover;
          background-position: center;
          position: relative;
          margin-bottom: 80px;
          cursor: pointer;
        }
        .banner-upload-hint {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.45);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.25s;
          border-radius: 14px;
          font-size: 15px;
        }
        .banner:hover .banner-upload-hint { opacity: 1; }
        .avatar-big {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          border: 5px solid #fff;
          position: absolute;
          bottom: -55px;
          left: 24px;
          object-fit: cover;
          box-shadow: 0 8px 20px rgba(0,0,0,0.35);
          background: #222;
          z-index: 3;
          cursor: pointer;
          transition: transform 0.25s;
        }
        .avatar-big:hover { transform: scale(1.05); }
        .profile-info {
          padding-left: 24px;
          margin-top: 10px;
          margin-bottom: 28px;
        }
        .profile-info h1 {
          margin: 0 0 6px 0;
          font-size: 1.9rem;
          word-break: break-word;
        }
        .profile-info p {
          margin: 4px 0;
          word-break: break-word;
        }
        .section {
          background: var(--card);
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 22px;
          box-shadow: 0 6px 15px rgba(0,0,0,0.1);
        }
        .section h2 {
          margin-top: 0;
          border-bottom: 3px solid #FFFF00;
          padding-bottom: 8px;
        }
        .edit-btn, .logout-btn {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          border: none;
          padding: 10px 18px;
          border-radius: 8px;
          font-family: inherit;
          cursor: pointer;
          font-weight: bold;
          margin-right: 10px;
          margin-top: 8px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .edit-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 14px #FFD700;
        }
        .logout-btn {
          background: #ff4d4d;
          color: white;
        }
        .logout-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 0 14px #ff4d4d;
        }
        .profile-input,
        .profile-textarea {
          width: 100%;
          max-width: 400px;
          padding: 11px 14px;
          border-radius: 8px;
          border: 3px solid #494949;
          background: #666378;
          color: #0a0a0a;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .profile-input:focus,
        .profile-textarea:focus {
          border-color: #222;
          background: #525061;
          box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.25);
        }
        .profile-textarea {
          resize: vertical;
          min-height: 90px;
        }
        .switch {
          position: relative;
          display: inline-block;
          width: 52px;
          height: 28px;
        }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 28px;
          border: 2px solid #999;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 2px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }
        input:checked + .slider {
          background-color: #FFD700;
          border-color: #e6c200;
        }
        input:checked + .slider:before {
          transform: translateX(24px);
        }
        .cropper-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.88);
          z-index: 1000;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 12px;
        }
        .cropper-modal {
          background: rgba(255,255,255,0.96);
          border: 5px solid #FFFF00;
          border-radius: 16px;
          width: 100%;
          max-width: 440px;
          overflow: hidden;
        }
        .cropper-header {
          padding: 14px;
          background: #333;
          color: white;
          text-align: center;
          border-bottom: 4px solid #FFFF00;
        }
        .cropper-area {
          position: relative;
          height: 220px;
          background: #111;
        }
        .cropper-controls {
          padding: 14px 16px 6px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cropper-controls label {
          color: #222;
          font-size: 13px;
          margin-bottom: 2px;
          display: block;
        }
        .pixel-inputs {
          display: flex;
          gap: 10px;
        }
        .pixel-inputs > div { flex: 1; }
        .pixel-inputs input[type="number"] {
          width: 100%;
          padding: 8px;
          border: 3px solid #494949;
          border-radius: 6px;
          background: rgb(102, 99, 120);
          color: #0a0a0a;
          font-size: 14px;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
        }
        .live-preview-box {
          text-align: center;
          padding: 8px 0 4px;
        }
        .live-preview-box img {
          border: 3px solid #FFFF00;
          object-fit: cover;
          box-shadow: 0 0 10px #FFFF00;
        }
        .cropper-actions {
          display: flex;
          gap: 8px;
          padding: 8px 16px 16px;
          flex-wrap: wrap;
        }
        .cropper-actions button {
          flex: 1;
          min-width: 100px;
          padding: 11px;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          cursor: pointer;
        }
        .btn-cancel { background: #666; color: white; }
        .btn-auto { background: #4a4a8a; color: white; }
        .btn-apply {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: black;
        }

        .logout-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          z-index: 2000;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px;
        }
        .logout-modal {
          background: var(--card);
          border: 4px solid #FFFF00;
          border-radius: 16px;
          padding: 28px 24px;
          max-width: 360px;
          width: 100%;
          text-align: center;
          box-shadow: 0 12px 40px rgba(0,0,0,0.4);
          animation: modalPop 0.25s ease;
        }
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.92) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .logout-modal h3 {
          margin: 0 0 10px 0;
          font-size: 1.35rem;
          color: var(--text);
        }
        .logout-modal p {
          margin: 0 0 22px 0;
          color: var(--muted);
          font-size: 0.95rem;
        }
        .logout-modal-actions {
          display: flex;
          gap: 10px;
          justify-content: center;
        }
        .logout-modal-actions button {
          flex: 1;
          padding: 11px 16px;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-weight: bold;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .logout-modal-actions button:hover {
          transform: scale(1.03);
        }
        .btn-logout-cancel {
          background: #888;
          color: white;
        }
        .btn-logout-confirm {
          background: #ff4d4d;
          color: white;
        }

        @media (max-width: 600px) {
          .profile-info { padding-left: 16px; }
          .avatar-big {
            width: 100px;
            height: 100px;
            bottom: -45px;
            left: 16px;
          }
          .banner { margin-bottom: 60px; }
        }
      `}</style>

      <Header />
      <ProfileButton />

      <div className="profile-page">
        <div
          className="banner"
          style={{
            backgroundImage: form.banner
              ? `url(${form.banner})`
              : 'linear-gradient(135deg, #333, #555)',
          }}
          onClick={() => openCropper('banner')}
        >
          <div className="banner-upload-hint">Cambiar banner</div>
          <img
            src={form.profilePic}
            className="avatar-big"
            alt="Avatar"
            onClick={(e) => {
              e.stopPropagation()
              openCropper('avatar')
            }}
          />
        </div>

        <div className="profile-info">
          {editMode ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
                  Nombre de usuario
                </label>
                <input
                  className="profile-input"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', marginBottom: 4, fontSize: 13 }}>
                  Descripción
                </label>
                <textarea
                  className="profile-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span>Mostrar edad</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={form.showAge}
                    onChange={(e) => setForm({ ...form, showAge: e.target.checked })}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {form.showAge && (
                <input
                  className="profile-input"
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="Edad"
                  style={{ width: 110, marginBottom: 14 }}
                />
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <span>Modo oscuro</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={theme === 'dark'}
                    onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
                  />
                  <span className="slider"></span>
                </label>
              </div>

              <button className="edit-btn" onClick={handleSave}>
                Guardar cambios
              </button>
              <button
                className="edit-btn"
                style={{ background: '#ccc' }}
                onClick={() => setEditMode(false)}
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <h1>{form.username}</h1>
              {form.showAge && <p>Edad: {form.age}</p>}
              <p style={{ whiteSpace: 'pre-wrap', color: 'var(--muted)' }}>
                {form.description || 'Sin descripción todavía.'}
              </p>
              <button className="edit-btn" onClick={() => setEditMode(true)}>
                Editar perfil
              </button>
              <button className="logout-btn" onClick={() => setConfirmLogout(true)}>
                Cerrar sesión
              </button>
            </>
          )}
        </div>

        <div className="section">
          <h2>❤️ Mis Likes</h2>
          <p style={{ color: 'var(--muted)' }}>
            Aquí aparecerán los cómics que hayas marcado como favoritos.
          </p>
        </div>

        <div className="section">
          <h2>💬 Mis Comentarios</h2>
          <p style={{ color: 'var(--muted)' }}>
            Aquí aparecerán tus comentarios.
          </p>
        </div>
      </div>

      <Footer />


      {confirmLogout && (
        <div className="logout-modal-overlay" onClick={() => setConfirmLogout(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()}>
            <h3>¿Cerrar sesión?</h3>
            <p>¿Estás seguro de que quieres salir de tu cuenta?</p>
            <div className="logout-modal-actions">
              <button className="btn-logout-cancel" onClick={() => setConfirmLogout(false)}>
                Cancelar
              </button>
              <button className="btn-logout-confirm" onClick={handleLogout}>
                Sí, cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {showCropper && imageSrc && (
        <div className="cropper-overlay">
          <div className="cropper-modal">
            <div className="cropper-header">
              {cropType === 'avatar'
                ? 'Ajusta tu foto de perfil'
                : 'Ajusta el banner (recomendado 1200×300)'}
            </div>

            <div className="cropper-area">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={cropType === 'avatar' ? 1 : 4}
                cropShape={cropType === 'avatar' ? 'round' : 'rect'}
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

            <div className="cropper-controls">
              <div>
                <label>Zoom</label>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  style={{ width: '100%', accentColor: '#FFD700' }}
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
                      max={2500}
                      value={resizeWidth}
                      onChange={(e) => {
                        const w = Number(e.target.value) || 0
                        setResizeWidth(w)
                        if (cropType === 'banner') {
                          setResizeHeight(Math.round(w / 4))
                        } else {
                          setResizeHeight(w)
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11 }}>Alto</label>
                    <input
                      type="number"
                      min={50}
                      max={2500}
                      value={resizeHeight}
                      onChange={(e) => {
                        const h = Number(e.target.value) || 0
                        setResizeHeight(h)
                        if (cropType === 'banner') {
                          setResizeWidth(Math.round(h * 4))
                        } else {
                          setResizeWidth(h)
                        }
                      }}
                    />
                  </div>
                </div>
                <small style={{ color: '#555', fontSize: 11 }}>
                  {cropType === 'banner'
                    ? `Banner 4:1 · Original: ${originalWidth}×${originalHeight} px`
                    : `Original: ${originalWidth}×${originalHeight} px`}
                </small>
              </div>
            </div>

            {livePreview && (
              <div className="live-preview-box">
                <img
                  src={livePreview}
                  alt="Vista previa"
                  style={{
                    width: cropType === 'avatar' ? 90 : 180,
                    height: cropType === 'avatar' ? 90 : 45,
                    borderRadius: cropType === 'avatar' ? '50%' : 8,
                  }}
                />
                <div style={{ fontSize: 12, color: '#333', marginTop: 4 }}>
                  Vista previa ({resizeWidth}×{resizeHeight})
                </div>
              </div>
            )}

            <div className="cropper-actions">
              <button className="btn-cancel" onClick={() => setShowCropper(false)}>
                Cancelar
              </button>
              <button
                className="btn-auto"
                onClick={() => {
                  setCrop({ x: 0, y: 0 })
                  setZoom(1.1)
                  if (cropType === 'banner') {
                    setResizeWidth(1200)
                    setResizeHeight(300)
                  } else {
                    const side = Math.max(512, Math.min(originalWidth, originalHeight))
                    setResizeWidth(side)
                    setResizeHeight(side)
                  }
                }}
              >
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