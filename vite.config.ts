import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
              return 'vendor-react';
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase';
            }
            if (id.includes('@sentry')) {
              return 'vendor-sentry';
            }
            if (id.includes('i18next')) {
              return 'vendor-i18n';
            }
          }
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Only the app shell (JS/CSS/icons/fonts) is precached — deliberately
      // no runtimeCaching for Supabase or PayFast. This is a live
      // marketplace (request statuses, payments, messages, notifications)
      // where a cached API response would be actively misleading, not
      // just stale. The service worker's job here is "load the app
      // instantly and offer a real app icon", not "work fully offline" —
      // that would need a very different, request-flow-aware caching
      // strategy this data doesn't fit.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/admin/],
      },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'ChatSched',
        short_name: 'ChatSched',
        description: 'Connect with trusted South African publishers and creators across social media, influencer, website, podcast and radio channels.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FAF9F5',
        theme_color: '#1A1712',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
