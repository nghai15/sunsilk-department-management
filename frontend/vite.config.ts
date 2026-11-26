import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
  return {
  server: {
    host: '0.0.0.0',
    proxy: {
      '/supabase': {
        target: backendUrl,
        changeOrigin: true,
        ws: true,
        rewrite: path => path.replace(/^\/supabase/, ''),
      },
    },
  },
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: { input: { main: 'index.html', billing: 'kiem-thu-tv4.html' } },
  },
  }
})
