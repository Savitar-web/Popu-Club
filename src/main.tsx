import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/theme.css'

// Si en el futuro quiero forzar una actualización puntual, sólo debo cambiar el valor.
// Después de este deploy el caché offline sigue normal.
const BUILD_ID = '2026-10-08-a'

const prev = localStorage.getItem('app_build_id')

if (prev && prev !== BUILD_ID) {
  // Solo limpia cachés del Service Worker / HTTP cache de la PWA.
  // NO borra sesión, currentUser ni nada de la cuenta.
  const clearAndReload = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
    } catch {
      // Coloco un build por si falla el clear, 
    }
    localStorage.setItem('app_build_id', BUILD_ID)
    window.location.reload()
  }
  void clearAndReload()
} else {
  if (!prev) {
    localStorage.setItem('app_build_id', BUILD_ID)
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}