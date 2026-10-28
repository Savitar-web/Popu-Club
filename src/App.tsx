import { lazy, Suspense } from 'react'
import { useAuth } from './lib/auth'
import {
  HashRouter,
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Profile = lazy(() => import('./pages/Profile'))
const Arcos = lazy(() => import('./pages/Arcos'))
const ComicDetail = lazy(() => import('./pages/ComicDetail'))
const ChapterReader = lazy(() => import('./pages/ChapterReader'))
const Admin = lazy(() => import('./pages/Admin'))
const Profiles = lazy(() => import('./pages/Profiles'))

function useHashRouter() {
  if (typeof window === 'undefined') return false
  // Electron (file://) y WebView de Capacitor se comportan mejor con hash
  const isFile = window.location.protocol === 'file:'
  const isElectron = /electron/i.test(navigator.userAgent || '')
  const isCapacitor =
    !!(window as any).Capacitor ||
    /capacitor/i.test(navigator.userAgent || '')
  return isFile || isElectron || isCapacitor
}

function AppRoutes() {
  const { ready, session, recovery } = useAuth()
  const isLoggedIn = Boolean(session)
  if (!ready) return <p role="status" style={{ padding: 32, textAlign: 'center' }}>Cargando sesión…</p>

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isLoggedIn ? '/home' : '/login'} replace />}
      />
      <Route
        path="/login"
        element={isLoggedIn && !recovery ? <Navigate to="/home" replace /> : <Login />}
      />
      <Route path="/profiles/:userId" element={<Profiles />} />
      <Route path="/home" element={<Home />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/arcos" element={<Arcos />} />
      <Route path="/comic/:comicId" element={<ComicDetail />} />
      <Route
        path="/comic/:comicId/chapter/:chapterId"
        element={<ChapterReader />}
      />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  const hash = useHashRouter()
  const Router = hash ? HashRouter : BrowserRouter

  return (
    <Router>
      <Suspense fallback={<p role="status" style={{ padding: 32, textAlign: 'center' }}>Cargando…</p>}><AppRoutes /></Suspense>
    </Router>
  )
}