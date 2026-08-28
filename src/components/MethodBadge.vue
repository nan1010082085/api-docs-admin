<template>
  <span class="method-badge" :class="`tag-${method}`">
    {{ method.toUpperCase() }}
  </span>
</template>

<script setup lang="ts">
import type { HttpMethod } from '@/types'

defineProps<{
  method: HttpMethod
}>()
</script>

<style lang="scss" scoped>
.method-badge {
  display: inline-block;
  min-width: 52px;
  text-align: center;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  font-family: 'SFMono-Regular', Consolas, monospace;
  text-transform: uppercase;
}
</style>
