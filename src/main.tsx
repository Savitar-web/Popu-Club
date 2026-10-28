import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import './styles/theme.css'

// PWA upgrades manage their own versioned assets. Keep offline downloads intact.
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
