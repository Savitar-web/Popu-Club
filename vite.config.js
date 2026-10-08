import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'loguito.png',
        'favicon.svg',
        'pwa-192.png',
        'pwa-512.png',
        'Fondodeweb.png',
        'Laffayette_Comic_Pro.woff',
      ],
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Solo fallar si un archivo a precachear supera esto
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Precachear app shell + assets ligeros (incluye png/webp de public raíz)
        globPatterns: [
          '**/*.{js,css,html,ico,svg,woff,woff2,webp,png,jpg,jpeg}',
        ],
        // NO precachear carpetas pesadas de portadas (sí se cachean al visitarlas)
        globIgnores: [
          '**/iconitos/portadas*/**',
          '**/iconitos/nubes*/**',
          '**/node_modules/**',
        ],
        // Runtime: imágenes remotas (Supabase) y resto de public
        runtimeCaching: [
          {
            // Storage de Supabase (portadas, páginas, avatares)
            urlPattern: ({ url }) =>
              url.hostname.endsWith('supabase.co') &&
              (url.pathname.includes('/storage/') ||
                url.pathname.includes('/object/public/')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-images',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // API REST de Supabase (listas de arcos, etc.) — network first
            urlPattern: ({ url }) =>
              url.hostname.endsWith('supabase.co') &&
              url.pathname.includes('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 80,
                maxAgeSeconds: 60 * 60 * 24, // 1 día
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Imágenes estáticas del propio dominio (public/)
            urlPattern: ({ request, url }) =>
              request.destination === 'image' &&
              (url.origin === self.location.origin ||
                url.pathname.startsWith('/')),
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Fuentes
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
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
