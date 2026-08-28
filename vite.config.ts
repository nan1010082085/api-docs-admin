import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import { fileURLToPath } from 'url'
import { createSharedSourceAliases, sharedOptimizeDepsExclude } from '../scripts/vite-shared-source.mjs'

const __dirname = resolve(fileURLToPath(import.meta.url), '..')

export default defineConfig({
  plugins: [vue()],
  base: '/schema-platform/api-docs/',
  css: {
    preprocessorOptions: {
      scss: {
        // Vite 8 + sass modern API
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  resolve: {
    alias: [
      { find: '@', replacement: resolve(__dirname, 'src') },
      ...createSharedSourceAliases(import.meta.url, { platformShared: true }),
    ],
  },
  optimizeDeps: {
    exclude: sharedOptimizeDepsExclude({ platformShared: true }),
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
