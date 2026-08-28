/**
 * Element Plus 全局注册（从 platform-shared fork）
 * 注意：icons 不在此全量注册，统一由 AppIcon.vue 按需 import
 */
import type { App } from 'vue'
import ElementPlus from 'element-plus'

export function setupElementPlus(app: App): void {
  app.use(ElementPlus)
}
