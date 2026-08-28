import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSharedSourceAliases, sharedOptimizeDepsExclude } from '../scripts/vite-shared-source.mjs'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [vue()],
  base: '/schema-platform/api-docs/',
  css: {
    preprocessorOptions: {
      // Vite 8 类型尚未包含 api 字段，与 editor 同源配置
      scss: { api: 'modern-compiler' } as Record<string, string>,
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(rootDir, 'src') },
      ...createSharedSourceAliases(import.meta.url, { platformShared: true }),
    ],
    dedupe: ['vue', 'vue-router', 'pinia', 'element-plus'],
  },
  optimizeDeps: {
    exclude: sharedOptimizeDepsExclude({ platformShared: true }),
  },
  server: {
    port: 5500,
    // 深链 F5 回退到 index.html
    appType: 'spa',
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
