import { useState, FormEvent, ChangeEvent, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Cropper from 'react-easy-crop'
import type { Area } from 'react-easy-crop'

export default function Login() {
  const [isLogin, setIsLogin] = useState(false)
  const [preview, setPreview] = useState('/loguito.png')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  // Cropper
  const [showCropper, setShowCropper] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  // Redimensionar por píxeles
  const [originalWidth, setOriginalWidth] = useState(0)
  const [originalHeight, setOriginalHeight] = useState(0)
  const [resizeWidth, setResizeWidth] = useState(0)
  const [resizeHeight, setResizeHeight] = useState(0)

  // Preview en vivo
  const [livePreview, setLivePreview] = useState<string | null>(null)

  const validatePassword = (password: string) => {
    return (
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password)
    )
  }

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // Cargar dimensiones originales
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

  // Generar preview en vivo cada vez que cambian zoom, crop o dimensiones
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

      // Canvas temporal con el recorte circular
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

      // Canvas final redimensionado
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

  const handleApply = () => {
    if (livePreview) {
      setPreview(livePreview)
    }
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
    if (file) {
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
  }

  const handleRegister = (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const form = e.target as HTMLFormElement
    const username = (form.elements.namedItem('username') as HTMLInputElement).value.trim()
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim().toLowerCase()
    const password = (form.elements.namedItem('password') as HTMLInputElement).value
    const confirm = (form.elements.namedItem('confirm_password') as HTMLInputElement).value
    const age = (form.elements.namedItem('age') as HTMLSelectElement).value

    if (!username || !email || !password || !confirm || !age) {
      setError('Por favor completa todos los campos.')
      return
    }

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    if (!validatePassword(password)) {
      setError('La contraseña debe tener mínimo 8 caracteres, 1 mayúscula, 1 minúscula y 1 número.')
      return
    }

    const existingUsers = JSON.parse(localStorage.getItem('users') || '[]')
    if (existingUsers.some((u: any) => u.email === email)) {
      setError('Este correo ya está registrado.')
      return
    }

    const newUser = {
      username,
      email,
      age,
      profilePic: preview,
      banner: '',
      description: '',
      showAge: true,
      role: 'user',
      createdAt: new Date().toISOString(),
    }

    existingUsers.push(newUser)
    localStorage.setItem('users', JSON.stringify(existingUsers))
    localStorage.setItem('currentUser', JSON.stringify(newUser))
    localStorage.setItem('username', username)
    localStorage.setItem('email', email)
    localStorage.setItem('age', age)
    localStorage.setItem('profilePic', preview)

    navigate('/home')
  }

  const handleLogin = (e: FormEvent) => {
    e.preventDefault()
    setError('')

    const form = e.target as HTMLFormElement
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim().toLowerCase()

    const existingUsers = JSON.parse(localStorage.getItem('users') || '[]')
    const user = existingUsers.find((u: any) => u.email === email)

    if (!user) {
      setError('Correo o contraseña incorrectos.')
      return
    }

    localStorage.setItem('currentUser', JSON.stringify(user))
    localStorage.setItem('username', user.username)
    localStorage.setItem('email', user.email)
    localStorage.setItem('age', user.age || '')
    localStorage.setItem('profilePic', user.profilePic || '/loguito.png')

    navigate('/home')
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

        html, body {
          margin: 0;
          padding: 0;
          height: 100%;
          overflow: hidden;
        }

        body {
          background-image: url('/Fondodeweb.png');
          background-position: center;
          background-size: cover;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
          color: white;
        }

        body::before {
          content: '';
          position: fixed;
          inset: 0;
          background-color: rgba(0, 0, 0, 0.72);
          z-index: 0;
        }

        .auth-wrapper {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 400px;
          padding: 12px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }

        .registration-container,
        .login-container {
          background-color: rgba(255, 255, 255, 0.92);
          padding: 26px 22px;
          box-shadow: 0 0 28px rgba(255, 255, 255, 0.18);
          border-radius: 16px;
          border: 5px solid #FFFF00;
          backdrop-filter: blur(12px);
          animation: slideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1);
          width: 100%;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        h1 {
          text-align: center;
          color: rgb(128, 129, 212);
          text-shadow: 0 0 10px #FFFF00, 0 0 18px #FFFF00, 0 0 28px #FF8500;
          animation: neonGlow 1.5s infinite alternate;
          font-size: 1.55rem;
          margin: 0 0 18px 0;
        }

        @keyframes neonGlow {
          from { text-shadow: 0 0 12px #FFFF00, 0 0 20px #FF8500; }
          to { text-shadow: 0 0 20px #FFFF00, 0 0 32px #FF8500; }
        }

        .input-group { margin-bottom: 13px; }

        label {
          display: block;
          margin-bottom: 4px;
          color: #0a0a0a;
          font-size: 13px;
        }

        input[type="text"],
        input[type="email"],
        input[type="password"],
        select {
          width: 100%;
          padding: 10px 12px;
          border: 4px solid #494949;
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

        .profile-pic-group {
          text-align: center;
          margin-bottom: 14px;
        }

        .profile-pic-wrapper {
          position: relative;
          width: 100px;
          height: 100px;
          margin: 0 auto;
          border-radius: 50%;
          overflow: hidden;
          border: 4px solid #FFFF00;
          box-shadow: 0 0 12px #FFFF00;
          cursor: pointer;
          transition: box-shadow 0.3s;
        }

        .profile-pic-wrapper:hover {
          box-shadow: 0 0 18px #FFFF00, 0 0 28px #FF8500;
        }

        #profile-pic-preview {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        input[type="file"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
        }

        button[type="submit"],
        .toggle-button {
          width: 100%;
          padding: 12px;
          border: none;
          background: linear-gradient(135deg, #FFFF00, #FFD700, #FFEA00);
          color: black;
          font-size: 15px;
          cursor: pointer;
          border-radius: 8px;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          box-shadow: 0 0 10px #FFFF00;
          transition: all 0.25s;
        }

        button[type="submit"] {
          margin-top: 8px;
          margin-bottom: 14px;
        }

        .toggle-button {
          margin-top: 0;
        }

        button[type="submit"]:hover,
        .toggle-button:hover {
          transform: scale(1.025);
          box-shadow: 0 0 18px #FFFF00, 0 0 26px #FFD700;
        }

        .error-message {
          background: #ff4d4d;
          color: white;
          padding: 10px 12px;
          border-radius: 8px;
          margin-bottom: 12px;
          font-size: 13px;
          text-align: center;
        }

        /* ===== MODAL CROPPER ===== */
        .cropper-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.88);
          z-index: 1000;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 12px;
        }

        .cropper-modal {
          background: rgba(255, 255, 255, 0.96);
          border: 5px solid #FFFF00;
          border-radius: 16px;
          width: 100%;
          max-width: 420px;
          overflow: hidden;
          box-shadow: 0 0 35px rgba(255, 255, 0, 0.25);
        }

        .cropper-header {
          padding: 14px 16px;
          background: #333;
          color: white;
          font-size: 1.15rem;
          text-align: center;
          border-bottom: 4px solid #FFFF00;
        }

        .cropper-area {
          position: relative;
          width: 100%;
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

        .cropper-controls input[type="range"] {
          width: 100%;
          accent-color: #FFD700;
        }

        .pixel-inputs {
          display: flex;
          gap: 10px;
        }

        .pixel-inputs > div {
          flex: 1;
        }

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
          padding: 10px 0 4px;
        }

        .live-preview-box img {
          width: 90px;
          height: 90px;
          border-radius: 50%;
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
          padding: 11px 8px;
          border: none;
          border-radius: 8px;
          font-family: 'Laffayette Comic Pro', cursive, Arial, sans-serif;
          font-size: 13px;
          cursor: pointer;
        }

        .btn-cancel { background: #666; color: white; }
        .btn-auto { background: #4a4a8a; color: white; }
        .btn-apply {
          background: linear-gradient(135deg, #FFFF00, #FFD700);
          color: black;
          box-shadow: 0 0 10px #FFFF00;
        }

        @media (max-width: 480px) {
          .auth-wrapper { max-width: 100%; padding: 8px; }
          .registration-container, .login-container { padding: 20px 14px; }
          h1 { font-size: 1.35rem; }
          .cropper-area { height: 180px; }
        }
      `}</style>

      <div className="auth-wrapper">
        {!isLogin ? (
          <div className="registration-container" key="register">
            <h1>Popu-Club</h1>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleRegister}>
              <div className="profile-pic-group">
                <div className="profile-pic-wrapper">
                  <img id="profile-pic-preview" src={preview} alt="Foto de perfil" />
                  <input type="file" accept="image/*" onChange={handleProfilePic} />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="age">Selecciona tu edad:</label>
                <select id="age" name="age" required>
                  <option value="">Selecciona...</option>
                  {Array.from({ length: 35 }, (_, i) => i + 11).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="username">Nombre de usuario:</label>
                <input type="text" id="username" name="username" required />
              </div>

              <div className="input-group">
                <label htmlFor="email">Correo electrónico:</label>
                <input type="email" id="email" name="email" required />
              </div>

              <div className="input-group">
                <label htmlFor="password">Contraseña:</label>
                <input type="password" id="password" name="password" required />
              </div>

              <div className="input-group">
                <label htmlFor="confirm_password">Confirmar contraseña:</label>
                <input type="password" id="confirm_password" name="confirm_password" required />
              </div>

              <button type="submit">Registrar</button>

              <button
                type="button"
                className="toggle-button"
                onClick={() => {
                  setIsLogin(true)
                  setError('')
                }}
              >
                ¡Ya tengo cuenta!
              </button>
            </form>
          </div>
        ) : (
          <div className="login-container" key="login">
            <h1>Iniciar Sesión</h1>

            {error && <div className="error-message">{error}</div>}

            <form onSubmit={handleLogin}>
              <div className="input-group">
                <label htmlFor="login-email">Correo electrónico:</label>
                <input type="email" id="login-email" name="email" required />
              </div>

              <div className="input-group">
                <label htmlFor="login-password">Contraseña:</label>
                <input type="password" id="login-password" name="password" required />
              </div>

              <button type="submit">Iniciar Sesión</button>

              <button
                type="button"
                className="toggle-button"
                onClick={() => {
                  setIsLogin(false)
                  setError('')
                }}
              >
                ¡No tengo cuenta!
              </button>
            </form>
          </div>
        )}
      </div>

      {/* MODAL */}
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

            {/* PREVIEW EN VIVO */}
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