import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/ASSET/',
  cacheDir: '/tmp/vite-cache',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
