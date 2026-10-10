import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The API runs on :5080. In dev, /api/* is proxied so the app and API share an origin.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  // Both apps read web/.env and web/.env.production — the single place for the API URL.
  envDir: '../..',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL ?? 'http://localhost:5080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
