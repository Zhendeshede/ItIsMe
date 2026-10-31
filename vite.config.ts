import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [react(), cesium()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 8080,
  },
  build: {
    outDir: 'dist',
  },
})
