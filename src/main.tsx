import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/theme.css'

/**
 * Cambia este valor SOLO cuando quieras forzar un refresh puntual
 * a usuarios atascados en una versión vieja.
 * Después de que todos actualicen, NO lo vuelvas a cambiar.
 */
const BUILD_ID = '2026-10-08-b'

async function clearPwaCaches() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
  } catch {
    /* ignore */
  }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
    }
  } catch {
    /* ignore */
  }
}

function mountApp() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

const prev = localStorage.getItem('app_build_id')

if (prev && prev !== BUILD_ID) {
  // Una sola vez: limpia SW/caché PWA y recarga (no toca sesión ni cuenta)
  void (async () => {
    await clearPwaCaches()
    localStorage.setItem('app_build_id', BUILD_ID)
    // cache-buster en la URL por si el HTML quedó cacheado
    const url = new URL(window.location.href)
    url.searchParams.set('_v', BUILD_ID)
    window.location.replace(url.toString())
  })()
} else {
  if (!prev) {
    localStorage.setItem('app_build_id', BUILD_ID)
  }
  // Quita el ?_v= de la barra si venía del force refresh
  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has('_v')) {
      url.searchParams.delete('_v')
      window.history.replaceState({}, '', url.pathname + url.search + url.hash)
    }
  } catch {
    /* ignore */
  }
  mountApp()
}
