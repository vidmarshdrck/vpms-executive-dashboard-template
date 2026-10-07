import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  // GitHub Pages serves this under /VPMS_ExecutiveDashboards/. Any other
  // target (IIS, another host) sets VITE_BASE_PATH — e.g. "/VPMS/" for an
  // IIS virtual application, or "/" for a dedicated site/binding at the
  // domain root. main.jsx's <BrowserRouter basename> reads this same value
  // via import.meta.env.BASE_URL, so routing follows automatically.
  base: process.env.VITE_BASE_PATH || (process.env.GITHUB_ACTIONS ? '/VPMS_ExecutiveDashboards/' : '/'),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 4300,
    host: '0.0.0.0',
  },
  preview: {
    port: 4300,
    host: '0.0.0.0',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          recharts: ['recharts'],
        },
      },
    },
  },
})
