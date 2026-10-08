import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // '/' funciona con el servidor HTTP de Electron y con Vercel / PWA
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['loguito.png', 'favicon.svg', 'pwa-192.png', 'pwa-512.png'],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Evita que PNGs enormes de portadas rompan el build
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MiB
        globPatterns: ['**/*.{js,css,html,ico,svg,woff,woff2,webp}'],
        // No precachear carpetas pesadas de portadas / iconitos grandes
        globIgnores: [
          '**/iconitos/**',
          '**/portadas*/**',
          '**/*.png',
          '**/*.jpg',
          '**/*.jpeg',
        ],
      },
      manifest: {
        name: 'Popu-Club',
        short_name: 'PopuClub',
        description: 'Plataforma de comics Popu-Club',
        theme_color: '#242424',
        background_color: '#f3f4f6',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 900,
  },
})