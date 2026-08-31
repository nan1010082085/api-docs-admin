import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ApiEndpoint, AuthType, EnvKvRow, Environment, ProjectConfig, ProjectData, SecurityScheme } from '@/types'
import { parseSpec } from '@/utils/parser'
import projectConfigs from '@/config/projects'
import { buildAuthPayload } from '@/utils/auth'
import {
  applyPrefsChange,
  clearAllAuthData,
  clearSessionPassphrase,
  getSessionPassphrase,
  loadAuthData,
  loadPrefs,
  migrateLegacyPlainLocal,
  saveAuthData,
  savePrefs,
  setSessionPassphrase,
  type AuthPersistMode,
  type AuthStoragePrefs,
  type PersistedAuthData,
} from '@/utils/authStorage'

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

  /** 凭证存储偏好 */
  const authPersistMode = ref<AuthPersistMode>('session')
  const authEncrypt = ref(false)
  /** 本地加密数据已加载但未解锁 */
  const authLocked = ref(false)
  /** 最近一次存储相关提示 */
  const authStorageMessage = ref<string | null>(null)

  /** 内存中完整快照（含未激活项目），用于切换偏好时不丢数据 */
  let cachedPersisted: PersistedAuthData = {}

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

  const activeSecuritySchemes = computed<SecurityScheme[]>(() => {
    const project = activeProject.value
    if (!project) return []
    return project.securitySchemes ?? []
  })

  const authPersistPrefs = computed<AuthStoragePrefs>(() => ({
    mode: authPersistMode.value,
    encrypt: authEncrypt.value,
  }))

  const hasAuthPassphrase = computed(() => Boolean(getSessionPassphrase()))

  function getOverride(envName: string): EnvAuthPatch {
    const pid = activeProjectId.value
    return envOverrides.value[pid]?.[envName] ?? {}
  }

  function buildSnapshot(): PersistedAuthData {
    const snap = { ...cachedPersisted }
    const pid = activeProjectId.value
    if (pid) {
      snap[pid] = {
        envIndex: activeEnvIndex.value,
        customBaseUrl: customBaseUrl.value,
        envs: (envOverrides.value[pid] ?? {}) as Record<string, unknown>,
      }
    }
    // 同步其它已在内存中的项目 overrides
    for (const [id, envs] of Object.entries(envOverrides.value)) {
      if (id === pid) continue
      snap[id] = {
        envIndex: snap[id]?.envIndex ?? 0,
        customBaseUrl: snap[id]?.customBaseUrl ?? '',
        envs: envs as Record<string, unknown>,
      }
    }
    cachedPersisted = snap
    return snap
  }

  /**
   * 按当前偏好写回存储（加密模式为 async；失败时写入 authStorageMessage）
   */
  function persistNow() {
    if (authLocked.value) return
    const prefs = authPersistPrefs.value
    const data = buildSnapshot()
    void saveAuthData(prefs, data).catch((e: Error) => {
      authStorageMessage.value = e.message
      console.warn('[authStorage] persist failed:', e)
    })
  }

  function applyLoadedData(data: PersistedAuthData) {
    cachedPersisted = data
    for (const [pid, saved] of Object.entries(data)) {
      envOverrides.value[pid] = (saved.envs ?? {}) as Record<string, EnvAuthPatch>
    }
  }

  function restoreForProject(projectId: string) {
    const saved = cachedPersisted[projectId]
    if (!saved) {
      activeEnvIndex.value = 0
      customBaseUrl.value = ''
      return
    }
    activeEnvIndex.value = saved.envIndex ?? 0
    customBaseUrl.value = saved.customBaseUrl ?? ''
    envOverrides.value = {
      ...envOverrides.value,
      [projectId]: (saved.envs ?? {}) as Record<string, EnvAuthPatch>,
    }
    clampEnvIndex(projectId)
  }

  function clampEnvIndex(projectId: string) {
    if (activeEnvIndex.value === -1) return
    const project = projects.value.find((p) => p.config.id === projectId)
    const len = project?.config.environments?.length ?? 0
    if (len === 0 || activeEnvIndex.value < 0 || activeEnvIndex.value >= len) {
      activeEnvIndex.value = 0
    }
  }

  /**
   * 初始化偏好、迁移旧明文、加载凭证
   */
  async function initAuthStorage() {
    const migrated = migrateLegacyPlainLocal()
    if (migrated) {
      authStorageMessage.value = '已将旧版明文 localStorage 凭证迁移为会话存储（关标签即清除）'
    }

    const prefs = loadPrefs()
    authPersistMode.value = prefs.mode
    authEncrypt.value = prefs.encrypt

    const result = await loadAuthData(prefs)
    authLocked.value = result.status === 'locked'
    if (result.status === 'error') {
      authStorageMessage.value = result.message
    }
    if (result.status === 'ok' || result.status === 'empty') {
      applyLoadedData(result.data)
    }
  }

  /**
   * 用口令解锁本地加密凭证
   */
  async function unlockAuth(passphrase: string): Promise<void> {
    setSessionPassphrase(passphrase)
    const result = await loadAuthData(authPersistPrefs.value)
    if (result.status === 'error') {
      clearSessionPassphrase()
      throw new Error(result.message)
    }
    if (result.status === 'locked') {
      clearSessionPassphrase()
      throw new Error('解锁失败')
    }
    authLocked.value = false
    applyLoadedData(result.data)
    if (activeProjectId.value) restoreForProject(activeProjectId.value)
  }

  /**
   * 设置 / 更换会话口令（启用加密时必填；不落盘）
   */
  async function setAuthPassphrase(passphrase: string): Promise<void> {
    if (!passphrase.trim()) throw new Error('口令不能为空')
    setSessionPassphrase(passphrase.trim())
    if (authPersistMode.value === 'local' && authEncrypt.value) {
      await saveAuthData(authPersistPrefs.value, buildSnapshot())
    }
  }

  /**
   * 更新存储偏好并迁移数据
   */
  async function updateAuthPersistPrefs(next: AuthStoragePrefs): Promise<void> {
    const normalized: AuthStoragePrefs = {
      mode: next.mode,
      encrypt: next.mode === 'local' ? Boolean(next.encrypt) : false,
    }
    await applyPrefsChange(normalized, buildSnapshot())
    authPersistMode.value = normalized.mode
    authEncrypt.value = normalized.encrypt
    authLocked.value = false
    authStorageMessage.value = null
  }

  /** 清除全部已存凭证（含密文），保留偏好 */
  function clearAuthCredentials() {
    clearAllAuthData()
    cachedPersisted = {}
    envOverrides.value = {}
    authLocked.value = false
    // 偏好仍在：若仍是 local+encrypt，下次保存需重新设口令
    savePrefs(authPersistPrefs.value)
  }

  function updateActiveEnv(patch: EnvAuthPatch) {
    const env = activeEnvironment.value
    if (!env) return
    const pid = activeProjectId.value
    if (!envOverrides.value[pid]) envOverrides.value[pid] = {}
    const prev = envOverrides.value[pid][env.name] ?? {}
    envOverrides.value[pid][env.name] = {
      ...prev,
      ...patch,
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

  function getAuthHeaders(): Record<string, string> {
    return buildAuthPayload(activeEnvironment.value, activeSecuritySchemes.value).headers
  }

  function getAuthQuery(): Record<string, string> {
    return buildAuthPayload(activeEnvironment.value, activeSecuritySchemes.value).queryParams
  }

  function getAuthBodyFields(): Record<string, string> {
    return rowsToRecord(activeEnvironment.value?.bodyRows)
  }

  async function loadAllProjects() {
    loading.value = true
    error.value = null
    try {
      await initAuthStorage()

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
    // 先把当前项目写入快照，再切换
    buildSnapshot()
    activeProjectId.value = id
    searchQuery.value = ''
    restoreForProject(id)
    persistNow()
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
    authPersistMode,
    authEncrypt,
    authLocked,
    authStorageMessage,
    hasAuthPassphrase,
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
    unlockAuth,
    setAuthPassphrase,
    updateAuthPersistPrefs,
    clearAuthCredentials,
  }
})
