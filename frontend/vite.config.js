import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    // Forward /api to the FastAPI backend so dev needs no CORS setup.
    proxy: {
      '/api': process.env.VITE_API_PROXY ?? 'http://localhost:8000',
    },
  }
})
