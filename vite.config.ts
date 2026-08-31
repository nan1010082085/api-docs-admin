import { defineConfig, type ProxyOptions } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROJECT_DEV_PROXIES, SCHEMA_PLATFORM_API_TARGET } from './src/config/devProxies.ts'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

/**
 * Schema Platform 接口路径以 /api 开头，保留默认代理。
 * 其它项目通过独立前缀转发，避免互抢 /api。
 */
function buildDevProxy(): Record<string, ProxyOptions> {
  const proxy: Record<string, ProxyOptions> = {
    '/api': {
      target: SCHEMA_PLATFORM_API_TARGET,
      changeOrigin: true,
    },
  }
  for (const dp of Object.values(PROJECT_DEV_PROXIES)) {
    const prefix = dp.prefix.replace(/\/$/, '')
    proxy[prefix] = {
      target: dp.target,
      changeOrigin: true,
      rewrite: (path) => {
        const stripped = path.startsWith(prefix) ? path.slice(prefix.length) : path
        return stripped || '/'
      },
    }
  }
  return proxy
}

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
    proxy: buildDevProxy(),
  },
  build: {
    outDir: 'dist',
  },
})
