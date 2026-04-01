import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // base path for GitHub Pages project site
      base: '/associate-gce-exam-prep/',
      server: {
        port: 3000,
        host: '0.0.0.0',
        // fail if port is in use instead of automatically picking another port
        strictPort: true,
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          includeAssets: ['icons/*.svg'],
          manifest: false, // using our own public/manifest.json
          workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
            navigateFallback: 'index.html',
            navigateFallbackDenylist: [/^\/api/],
            runtimeCaching: [
              {
                // Google Fonts stylesheets
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'google-fonts-stylesheets',
                },
              },
              {
                // Google Fonts webfonts
                urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-webfonts',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                  },
                },
              },
            ],
          },
          devOptions: {
            enabled: true,
            type: 'module',
            navigateFallback: 'index.html',
          },
        }),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
