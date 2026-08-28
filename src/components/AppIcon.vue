<script setup lang="ts">
/**
 * AppIcon — 从 platform-shared fork，仅保留 api-docs 用到的图标
 */
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowRight,
  Delete,
  DocumentCopy,
  Download,
  Grid,
  Loading,
  Promotion,
  Search,
} from '@element-plus/icons-vue'

const ICON_MAP = {
  'arrow-down': ArrowDown,
  'arrow-right': ArrowRight,
  delete: Delete,
  'document-copy': DocumentCopy,
  download: Download,
  grid: Grid,
  loading: Loading,
  promotion: Promotion,
  search: Search,
} as const

type IconName = keyof typeof ICON_MAP

const props = defineProps<{
  /** 图标名称（kebab-case） */
  name: IconName | string
  /** 图标大小（px） */
  size?: number | string
  /** 图标颜色 */
  color?: string
}>()

const icon = computed(() => ICON_MAP[props.name as IconName] ?? null)
const iconSize = computed(() => {
  if (typeof props.size === 'number') return props.size
  if (typeof props.size === 'string' && props.size.endsWith('px')) {
    return Number.parseInt(props.size, 10)
  }
  return props.size ? Number(props.size) || 16 : 16
})
</script>

<template>
  <el-icon v-if="icon" :size="iconSize" :color="color">
    <component :is="icon" />
  </el-icon>
  <span
    v-else
    :style="{
      fontSize: `${iconSize}px`,
      color,
      width: `${iconSize}px`,
      height: `${iconSize}px`,
      display: 'inline-block',
    }"
    aria-hidden="true"
  />
</template>
