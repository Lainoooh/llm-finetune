import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 30000,
    open: true,
    historyApiFallback: true,
    proxy: {
      '/api': 'http://127.0.0.1:30001'
    }
  }
})
