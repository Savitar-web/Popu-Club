import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

export default function ProfileButton() {
  const [showDetails, setShowDetails] = useState(false)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [profilePic, setProfilePic] = useState('/loguito.png')
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const menuRef = useRef<HTMLDivElement>(null)

  const loadUserData = () => {
    const storedUsername = localStorage.getItem('username')
    const storedEmail = localStorage.getItem('email')
    const storedAge = localStorage.getItem('age')
    const storedPic = localStorage.getItem('profilePic')
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark') || 'light'

    if (storedUsername) setUsername(storedUsername)
    if (storedEmail) setEmail(storedEmail)
    if (storedAge) setAge(storedAge)
    if (storedPic) setProfilePic(storedPic)

    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)
  }

  useEffect(() => {
    loadUserData()

    const onProfileUpdate = () => loadUserData()
    window.addEventListener('profileUpdated', onProfileUpdate)
    window.addEventListener('storage', onProfileUpdate)

    return () => {
      window.removeEventListener('profileUpdated', onProfileUpdate)
      window.removeEventListener('storage', onProfileUpdate)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDetails(false)
      }
    }
    if (showDetails) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDetails])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
  }

  return (
    <div ref={menuRef} style={{ position: 'fixed', top: 15, right: 15, zIndex: 1000 }}>
      <button
        onClick={() => setShowDetails(!showDetails)}
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
      >
        <img
          src={profilePic}
          alt="Foto de perfil"
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: '3px solid #fff',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            objectFit: 'cover',
            transition: 'box-shadow 0.25s ease',
          }}
        />
      </button>

      {showDetails && (
        <div
          style={{
            position: 'absolute',
            top: 70,
            right: 0,
            width: 250,
            backgroundColor: theme === 'light' ? '#e0e0e0' : '#2a2a2a',
            color: theme === 'light' ? '#222' : '#f0f0f0',
            padding: 16,
            borderRadius: 10,
            boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
            fontSize: '0.95rem',
            border: '1px solid #999',
            animation: 'bubbleIn 0.2s ease',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.4)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)'
          }}
        >
          <style>{`
            @keyframes bubbleIn {
              from { opacity: 0; transform: translateY(-8px) scale(0.96); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Mi perfil</p>
          <p style={{ margin: '4px 0' }}>Usuario: {username || '—'}</p>
          <p style={{ margin: '4px 0' }}>Email: {email || '—'}</p>
          <p style={{ margin: '4px 0' }}>Edad: {age || '—'}</p>

          <button
            onClick={toggleTheme}
            style={{
              width: '100%',
              marginTop: 12,
              padding: '9px 0',
              background: 'linear-gradient(135deg, #FFFF00, #FFD700)',
              border: 'none',
              borderRadius: 8,
              fontWeight: 'bold',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: '#111',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.03)'
              e.currentTarget.style.boxShadow = '0 0 12px #FFD700'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {theme === 'light' ? '🌙 Modo oscuro' : '☀️ Modo claro'}
          </button>

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
              textShadow: theme === 'light'
                ? '0 0 1px #000, 1px 0 0 #000, -1px 0 0 #000, 0 1px 0 #000, 0 -1px 0 #000'
                : 'none',
            }}
          >
            Mi cuenta
          </Link>
        </div>
      )}
    </div>
  )
}