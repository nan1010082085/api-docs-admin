<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Sidebar />
      <main class="app-main">
        <EndpointDetail v-if="selectedEndpoint" :endpoint="selectedEndpoint" />
        <WelcomeView v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDocsStore } from '@/stores/docs'
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import EndpointDetail from '@/components/EndpointDetail.vue'
import WelcomeView from '@/components/WelcomeView.vue'

const store = useDocsStore()
const selectedEndpoint = ref<import('@/types').ApiEndpoint | null>(null)

onMounted(() => {
  store.loadAllProjects()
})

// 监听 sidebar 选中事件
window.addEventListener('endpoint-select', ((e: CustomEvent) => {
  selectedEndpoint.value = e.detail
}) as EventListener)
</script>

<style lang="scss" scoped>
.app-layout {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  background: #fafbfc;
}
</style>
