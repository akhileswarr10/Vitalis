import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // PWA manifest – fleshed out in Prompt 9
      manifest: {
        name: 'Vitalis – Crew Health Monitor',
        short_name: 'Vitalis',
        description: 'Decision-support health monitor for astronauts. Not a medical device.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        icons: [],
      },
      workbox: {
        // Cache the app shell, icons and fonts for offline functionality
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'vitalis-api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 86400, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
  // Expose VITE_API_URL from .env to the browser
  envDir: '../',
  envPrefix: 'VITE_',
  test: {
    // Vitest config inlined here so a separate vitest.config.ts isn't needed
    globals: false,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});

