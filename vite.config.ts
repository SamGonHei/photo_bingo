import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // 상대 경로로 지정하여 GitHub Pages 및 로컬 어디서나 에셋 완벽 로드
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,
    port: 3000,
  },
})
