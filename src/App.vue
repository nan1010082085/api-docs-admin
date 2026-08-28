<template>
  <ElConfigProvider :size="'small'" :z-index="2000">
    <RouterView />
  </ElConfigProvider>
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import { ElConfigProvider } from 'element-plus'
</script>
