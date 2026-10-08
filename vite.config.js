import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // './' = funciona en Electron (file://), Capacitor y Vercel
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['loguito.png', 'favicon.svg'],
      manifest: {
        name: 'Popu-Club',
        short_name: 'PopuClub',
        theme_color: '#242424',
        background_color: '#f3f4f6',
        display: 'standalone',
        start_url: './',
        icons: [
          {
            src: './loguito.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './loguito.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
})