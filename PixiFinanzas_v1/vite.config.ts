import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo-app.png'],
      manifest: {
        name: 'PixiFinanzas v1',
        short_name: 'PixiFinanzas',
        description: 'Gestión personal de finanzas — gastos e inversiones',
        theme_color: '#1565d8',
        background_color: '#f3f2f2',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/logo-app.png', sizes: '512x512', type: 'image/png' },
          { src: '/logo-app.png', sizes: '192x192', type: 'image/png' },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8788',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
});
