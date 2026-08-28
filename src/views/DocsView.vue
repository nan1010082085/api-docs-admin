<template>
  <div class="app-layout">
    <AppHeader />
    <div class="app-body">
      <Sidebar
        :active-endpoint-id="selectedEndpoint?.id ?? ''"
        @select="onSelectEndpoint"
      />
      <main class="app-main">
        <EndpointDetail
          v-if="selectedEndpoint"
          :key="selectedEndpoint.id"
          :endpoint="selectedEndpoint"
        />
        <WelcomeView v-else />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useDocsStore } from '@/stores/docs'
import AppHeader from '@/components/AppHeader.vue'
import Sidebar from '@/components/Sidebar.vue'
import EndpointDetail from '@/components/EndpointDetail.vue'
import WelcomeView from '@/components/WelcomeView.vue'
import type { ApiEndpoint } from '@/types'

const store = useDocsStore()
const route = useRoute()
const router = useRouter()
const selectedEndpoint = ref<ApiEndpoint | null>(null)
const ready = ref(false)

onMounted(async () => {
  await store.loadAllProjects()
  // 深链 F5：优先用路由里的 projectId
  const routeProjectId = route.params.projectId as string | undefined
  if (routeProjectId && store.projects.some((p) => p.config.id === routeProjectId)) {
    store.setActiveProject(routeProjectId)
  }
  ready.value = true
  syncFromRoute()
})

function encodePath(path: string): string {
  return path.replace(/^\//, '')
}

function decodePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function onSelectEndpoint(ep: ApiEndpoint) {
  selectedEndpoint.value = ep
  const projectId = store.activeProjectId
  router.push({
    name: 'endpoint',
    params: {
      projectId,
      method: ep.method,
      endpointPath: encodePath(ep.path),
    },
  })
}

function syncFromRoute() {
  if (!ready.value || store.loading) return

  const projectId = (route.params.projectId as string) || store.activeProjectId
  if (projectId && projectId !== store.activeProjectId) {
    const exists = store.projects.some((p) => p.config.id === projectId)
    if (exists) store.setActiveProject(projectId)
  }

  const method = route.params.method as string | undefined
  const endpointPath = route.params.endpointPath as string | undefined
  if (method && endpointPath) {
    const path = decodePath(endpointPath)
    const ep = store.findEndpoint(method, path)
    if (ep) {
      selectedEndpoint.value = ep
    } else {
      selectedEndpoint.value = null
      ElMessage.warning(`接口不存在：${method.toUpperCase()} ${path}`)
      router.replace({ name: 'project', params: { projectId: store.activeProjectId } })
    }
  } else if (route.name === 'project' || route.name === 'home') {
    selectedEndpoint.value = null
  }
}

watch(() => route.fullPath, syncFromRoute)
watch(
  () => store.loading,
  (loading) => {
    if (!loading) syncFromRoute()
  },
)
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
