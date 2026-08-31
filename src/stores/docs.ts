import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApiEndpoint, AuthType, EnvKvRow, Environment, ProjectConfig, ProjectData, SecurityScheme } from '@/types'
import { parseSpec } from '@/utils/parser'
import projectConfigs from '@/config/projects'
import { buildAuthPayload } from '@/utils/auth'

const STORAGE_KEY = 'api-docs:env-auth'

interface EnvAuthPatch {
  token?: string
  apiKey?: string
  authType?: AuthType
  cookie?: string
  headers?: Record<string, string>
  headerRows?: EnvKvRow[]
  queryRows?: EnvKvRow[]
  bodyRows?: EnvKvRow[]
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

/** 启用中的键值行 → Record */
function rowsToRecord(rows?: EnvKvRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  if (!rows) return out
  for (const row of rows) {
    if (row.enabled && row.key.trim()) out[row.key.trim()] = row.value
  }
  return out
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
    const ov = getOverride(base.name)
    return {
      ...base,
      ...ov,
      headers: {
        ...(base.headers ?? {}),
        ...(ov.headers ?? {}),
      },
      headerRows: ov.headerRows ?? base.headerRows ?? [],
      queryRows: ov.queryRows ?? base.queryRows ?? [],
      bodyRows: ov.bodyRows ?? base.bodyRows ?? [],
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

  /** 当前项目的安全方案列表 */
  const activeSecuritySchemes = computed<SecurityScheme[]>(() => {
    const project = activeProject.value
    if (!project) return []
    return project.securitySchemes ?? []
  })

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
    if (!saved) {
      // 无持久化时必须重置，避免沿用上一项目的 envIndex / customBaseUrl
      activeEnvIndex.value = 0
      customBaseUrl.value = ''
      return
    }
    activeEnvIndex.value = saved.envIndex ?? 0
    customBaseUrl.value = saved.customBaseUrl ?? ''
    envOverrides.value = {
      ...envOverrides.value,
      [projectId]: saved.envs ?? {},
    }
    clampEnvIndex(projectId)
  }

  /** 将 envIndex 钳制到当前项目 environments 范围内（保留 -1 自定义） */
  function clampEnvIndex(projectId: string) {
    if (activeEnvIndex.value === -1) return
    const project = projects.value.find((p) => p.config.id === projectId)
    const len = project?.config.environments?.length ?? 0
    if (len === 0 || activeEnvIndex.value < 0 || activeEnvIndex.value >= len) {
      activeEnvIndex.value = 0
    }
  }

  /**
   * 更新当前环境的认证 / Cookie / 自定义字段
   */
  function updateActiveEnv(patch: EnvAuthPatch) {
    const env = activeEnvironment.value
    if (!env) return
    const pid = activeProjectId.value
    if (!envOverrides.value[pid]) envOverrides.value[pid] = {}
    const prev = envOverrides.value[pid][env.name] ?? {}
    envOverrides.value[pid][env.name] = {
      ...prev,
      ...patch,
      // 显式传入时整表替换，避免残留已删行
      headers: patch.headers !== undefined ? patch.headers : prev.headers,
      headerRows: patch.headerRows !== undefined ? patch.headerRows : prev.headerRows,
      queryRows: patch.queryRows !== undefined ? patch.queryRows : prev.queryRows,
      bodyRows: patch.bodyRows !== undefined ? patch.bodyRows : prev.bodyRows,
    }
    if (patch.baseUrl !== undefined && activeEnvIndex.value === -1) {
      customBaseUrl.value = patch.baseUrl
    }
    persistNow()
  }

  /**
   * 根据当前环境 + 安全方案拼装认证相关请求头
   */
  function getAuthHeaders(): Record<string, string> {
    return buildAuthPayload(activeEnvironment.value, activeSecuritySchemes.value).headers
  }

  /** 环境级固定 Query + apiKey(query) */
  function getAuthQuery(): Record<string, string> {
    return buildAuthPayload(activeEnvironment.value, activeSecuritySchemes.value).queryParams
  }

  /** 环境级固定 Body 字段 */
  function getAuthBodyFields(): Record<string, string> {
    return rowsToRecord(activeEnvironment.value?.bodyRows)
  }

  async function loadAllProjects() {
    loading.value = true
    error.value = null
    try {
      const results = await Promise.allSettled(projectConfigs.map((c) => loadProject(c)))
      projects.value = results
        .filter((r): r is PromiseFulfilledResult<ProjectData> => r.status === 'fulfilled')
        .map((r) => r.value)

      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      if (failed.length > 0) {
        console.warn(
          '部分项目加载失败:',
          failed.map((f) => f.reason),
        )
      }

      if (projects.value.length === 0) {
        error.value =
          failed[0]?.reason instanceof Error
            ? failed[0].reason.message
            : '全部项目加载失败，请检查 specs 路径与 BASE_URL'
        return
      }

      if (!activeProjectId.value || !projects.value.some((p) => p.config.id === activeProjectId.value)) {
        activeProjectId.value = projects.value[0].config.id
      }

      restoreForProject(activeProjectId.value)
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
    activeSecuritySchemes,
    loading,
    error,
    loadAllProjects,
    setActiveProject,
    setSearch,
    setActiveEnvIndex,
    updateActiveEnv,
    getAuthHeaders,
    getAuthQuery,
    getAuthBodyFields,
    findEndpoint,
    persistNow,
  }
})
