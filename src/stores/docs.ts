import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApiEndpoint, ProjectConfig, ProjectData } from '@/types'
import { parseSpec } from '@/utils/parser'
import projectConfigs from '@/config/projects'

export const useDocsStore = defineStore('docs', () => {
  // ── State ──
  const projects = ref<ProjectData[]>([])
  const activeProjectId = ref<string>('')
  const activeEnvIndex = ref<number>(0)
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Getters ──
  const activeProject = computed(() =>
    projects.value.find((p) => p.config.id === activeProjectId.value),
  )

  const activeEnvironment = computed(() => {
    const envs = activeProject.value?.config.environments
    if (!envs || activeEnvIndex.value < 0 || activeEnvIndex.value >= envs.length) return null
    return envs[activeEnvIndex.value]
  })

  const filteredGroups = computed(() => {
    const project = activeProject.value
    if (!project) return []
    const q = searchQuery.value.trim().toLowerCase()
    if (!q) return project.groups

    return project.groups
      .map((group) => ({
        ...group,
        endpoints: group.endpoints.filter(
          (ep) =>
            ep.path.toLowerCase().includes(q) ||
            ep.summary?.toLowerCase().includes(q) ||
            ep.method.includes(q) ||
            ep.description?.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.endpoints.length > 0)
  })

  const totalEndpoints = computed(() => {
    const project = activeProject.value
    return project?.endpoints.length ?? 0
  })

  // ── Actions ──
  async function loadAllProjects() {
    loading.value = true
    error.value = null
    try {
      const results = await Promise.allSettled(projectConfigs.map((c) => loadProject(c)))
      projects.value = results
        .filter((r): r is PromiseFulfilledResult<ProjectData> => r.status === 'fulfilled')
        .map((r) => r.value)

      if (projects.value.length > 0 && !activeProjectId.value) {
        activeProjectId.value = projects.value[0].config.id
      }

      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        console.warn('部分项目加载失败:', failed)
      }
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadProject(config: ProjectConfig): Promise<ProjectData> {
    return parseSpec(config)
  }

  function setActiveProject(id: string) {
    activeProjectId.value = id
    searchQuery.value = ''
  }

  function setSearch(query: string) {
    searchQuery.value = query
  }

  return {
    projects,
    activeProjectId,
    activeEnvIndex,
    activeProject,
    activeEnvironment,
    searchQuery,
    filteredGroups,
    totalEndpoints,
    loading,
    error,
    loadAllProjects,
    setActiveProject,
    setSearch,
  }
})
