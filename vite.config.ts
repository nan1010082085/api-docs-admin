import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  base: '/schema-platform/api-docs/',
  appType: 'spa',
  css: {
    preprocessorOptions: {
      scss: { api: 'modern-compiler' } as Record<string, string>,
    },
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
    dedupe: ['vue', 'vue-router', 'pinia', 'element-plus'],
  },
  server: {
    port: 5500,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
