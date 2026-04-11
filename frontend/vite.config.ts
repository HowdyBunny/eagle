import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // The frontend now calls the backend directly at http://127.0.0.1:52777
  // (CORS is wide-open), so no vite proxy is needed. Kept `server` empty
  // as a placeholder if we ever need to reintroduce it.
})
