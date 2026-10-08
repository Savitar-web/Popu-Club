import {
  HashRouter,
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import Profile from './pages/Profile'
import Arcos from './pages/Arcos'
import ComicDetail from './pages/ComicDetail'
import ChapterReader from './pages/ChapterReader'
import Admin from './pages/Admin'
import Profiles from './pages/Profiles'

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
  const isLoggedIn = !!localStorage.getItem('currentUser')

  return (
    <Routes>
      <Route
        path="/"
        element={<Navigate to={isLoggedIn ? '/home' : '/login'} replace />}
      />
      <Route
        path="/login"
        element={isLoggedIn ? <Navigate to="/home" replace /> : <Login />}
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
      <AppRoutes />
    </Router>
  )
}