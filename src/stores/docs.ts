import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApiEndpoint, AuthType, Environment, ProjectConfig, ProjectData } from '@/types'
import { parseSpec } from '@/utils/parser'
import projectConfigs from '@/config/projects'

const STORAGE_KEY = 'api-docs:env-auth'

interface EnvAuthPatch {
  token?: string
  apiKey?: string
  authType?: AuthType
  cookie?: string
  headers?: Record<string, string>
  baseUrl?: string
}

interface PersistedAuth {
  [projectId: string]: {
    envIndex: number
    customBaseUrl?: string
    envs: Record<string, EnvAuthPatch>
  }
}

function loadPersisted(): PersistedAuth {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PersistedAuth
  } catch {
    return {}
  }
}

function savePersisted(data: PersistedAuth) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export const useDocsStore = defineStore('docs', () => {
  const projects = ref<ProjectData[]>([])
  const activeProjectId = ref<string>('')
  const activeEnvIndex = ref<number>(0)
  const customBaseUrl = ref<string>('')
  const searchQuery = ref('')
  const loading = ref(false)
  const error = ref<string | null>(null)
  /** 运行时覆盖的环境认证信息（按项目+环境名） */
  const envOverrides = ref<Record<string, Record<string, EnvAuthPatch>>>({})

  const activeProject = computed(() =>
    projects.value.find((p) => p.config.id === activeProjectId.value),
  )

  const activeEnvironment = computed((): Environment | null => {
    if (activeEnvIndex.value === -1) {
      return {
        name: '自定义',
        baseUrl: customBaseUrl.value,
        authType: 'bearer',
        ...getOverride('自定义'),
      }
    }
    const envs = activeProject.value?.config.environments
    if (!envs || activeEnvIndex.value < 0 || activeEnvIndex.value >= envs.length) return null
    const base = envs[activeEnvIndex.value]
    return {
      ...base,
      ...getOverride(base.name),
      headers: {
        ...(base.headers ?? {}),
        ...(getOverride(base.name).headers ?? {}),
      },
    }
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

  const totalEndpoints = computed(() => activeProject.value?.endpoints.length ?? 0)

  function getOverride(envName: string): EnvAuthPatch {
    const pid = activeProjectId.value
    return envOverrides.value[pid]?.[envName] ?? {}
  }

  function persistNow() {
    const pid = activeProjectId.value
    if (!pid) return
    const all = loadPersisted()
    all[pid] = {
      envIndex: activeEnvIndex.value,
      customBaseUrl: customBaseUrl.value,
      envs: envOverrides.value[pid] ?? {},
    }
    savePersisted(all)
  }

  function restoreForProject(projectId: string) {
    const all = loadPersisted()
    const saved = all[projectId]
    if (!saved) return
    activeEnvIndex.value = saved.envIndex ?? 0
    customBaseUrl.value = saved.customBaseUrl ?? ''
    envOverrides.value = {
      ...envOverrides.value,
      [projectId]: saved.envs ?? {},
    }
  }

  /**
   * 更新当前环境的认证 / Cookie / 自定义头
   */
  function updateActiveEnv(patch: EnvAuthPatch) {
    const env = activeEnvironment.value
    if (!env) return
    const pid = activeProjectId.value
    if (!envOverrides.value[pid]) envOverrides.value[pid] = {}
    envOverrides.value[pid][env.name] = {
      ...envOverrides.value[pid][env.name],
      ...patch,
      headers: {
        ...(envOverrides.value[pid][env.name]?.headers ?? {}),
        ...(patch.headers ?? {}),
      },
    }
    if (patch.baseUrl !== undefined && activeEnvIndex.value === -1) {
      customBaseUrl.value = patch.baseUrl
    }
    persistNow()
  }

  /**
   * 根据当前环境拼装认证相关请求头
   */
  function getAuthHeaders(): Record<string, string> {
    const env = activeEnvironment.value
    if (!env) return {}
    const headers: Record<string, string> = { ...(env.headers ?? {}) }
    const authType = env.authType ?? 'bearer'
    if (authType === 'bearer' && env.token?.trim()) {
      headers['Authorization'] = `Bearer ${env.token.trim()}`
    } else if (authType === 'apiKey' && env.apiKey?.trim()) {
      headers['X-API-Key'] = env.apiKey.trim()
    }
    return headers
  }

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

      if (activeProjectId.value) {
        restoreForProject(activeProjectId.value)
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
    restoreForProject(id)
  }

  function setSearch(query: string) {
    searchQuery.value = query
  }

  function setActiveEnvIndex(index: number) {
    activeEnvIndex.value = index
    persistNow()
  }

  function findEndpoint(method: string, path: string): ApiEndpoint | undefined {
    const project = activeProject.value
    if (!project) return undefined
    const m = method.toLowerCase()
    return project.endpoints.find((ep) => ep.method === m && ep.path === path)
  }

  return {
    projects,
    activeProjectId,
    activeEnvIndex,
    customBaseUrl,
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
    setActiveEnvIndex,
    updateActiveEnv,
    getAuthHeaders,
    findEndpoint,
    persistNow,
  }
})
