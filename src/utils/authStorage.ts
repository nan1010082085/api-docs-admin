/**
 * 认证数据持久化策略：
 * - memory：仅内存，刷新丢失
 * - session：sessionStorage，关标签清除（默认）
 * - local：localStorage；可选口令 AES-GCM 加密
 */
import {
  decryptJson,
  encryptJson,
  tryParseEncryptedBlob,
  type EncryptedBlob,
} from '@/utils/authCrypto'

export type AuthPersistMode = 'memory' | 'session' | 'local'

export interface AuthStoragePrefs {
  mode: AuthPersistMode
  /** 仅 local 模式有效：是否口令加密 */
  encrypt: boolean
}

/** 与 docs store 对齐的持久化结构 */
export interface PersistedAuthData {
  [projectId: string]: {
    envIndex: number
    customBaseUrl?: string
    envs: Record<string, unknown>
  }
}

const DATA_KEY = 'api-docs:env-auth'
const PREFS_KEY = 'api-docs:auth-storage-prefs'

/** memory 模式的进程内缓存 */
let memoryStore: PersistedAuthData = {}

/** 内存中的会话口令（永不写入 storage） */
let sessionPassphrase: string | null = null

const DEFAULT_PREFS: AuthStoragePrefs = {
  mode: 'session',
  encrypt: false,
}

export function getSessionPassphrase(): string | null {
  return sessionPassphrase
}

export function setSessionPassphrase(passphrase: string | null) {
  sessionPassphrase = passphrase && passphrase.length > 0 ? passphrase : null
}

export function clearSessionPassphrase() {
  sessionPassphrase = null
}

export function loadPrefs(): AuthStoragePrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    const parsed = JSON.parse(raw) as Partial<AuthStoragePrefs>
    const mode: AuthPersistMode =
      parsed.mode === 'memory' || parsed.mode === 'session' || parsed.mode === 'local'
        ? parsed.mode
        : 'session'
    return {
      mode,
      encrypt: mode === 'local' ? Boolean(parsed.encrypt) : false,
    }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

export function savePrefs(prefs: AuthStoragePrefs) {
  const normalized: AuthStoragePrefs = {
    mode: prefs.mode,
    encrypt: prefs.mode === 'local' ? Boolean(prefs.encrypt) : false,
  }
  localStorage.setItem(PREFS_KEY, JSON.stringify(normalized))
}

function readRawFromBackend(mode: AuthPersistMode): string | null {
  if (mode === 'memory') {
    return Object.keys(memoryStore).length ? JSON.stringify(memoryStore) : null
  }
  if (mode === 'session') return sessionStorage.getItem(DATA_KEY)
  return localStorage.getItem(DATA_KEY)
}

function writeRawToBackend(mode: AuthPersistMode, raw: string | null) {
  if (mode === 'memory') {
    if (!raw) {
      memoryStore = {}
      return
    }
    memoryStore = JSON.parse(raw) as PersistedAuthData
    return
  }
  const store = mode === 'session' ? sessionStorage : localStorage
  if (!raw) store.removeItem(DATA_KEY)
  else store.setItem(DATA_KEY, raw)
}

function clearBackend(mode: AuthPersistMode) {
  writeRawToBackend(mode, null)
}

/**
 * 迁移旧版明文 localStorage：拷到 session，并清掉 local 明文
 * @returns 是否发生了迁移
 */
export function migrateLegacyPlainLocal(): boolean {
  const prefsExist = localStorage.getItem(PREFS_KEY) !== null
  if (prefsExist) return false

  const raw = localStorage.getItem(DATA_KEY)
  if (!raw) {
    savePrefs(DEFAULT_PREFS)
    return false
  }

  // 已是密文信封：保留在 local，偏好改为 local+encrypt，需用户解锁
  const blob = tryParseEncryptedBlob(raw)
  if (blob) {
    savePrefs({ mode: 'local', encrypt: true })
    return false
  }

  // 明文 → 默认升为 session
  try {
    JSON.parse(raw)
  } catch {
    localStorage.removeItem(DATA_KEY)
    savePrefs(DEFAULT_PREFS)
    return false
  }

  sessionStorage.setItem(DATA_KEY, raw)
  localStorage.removeItem(DATA_KEY)
  savePrefs(DEFAULT_PREFS)
  return true
}

export type LoadAuthResult =
  | { status: 'ok'; data: PersistedAuthData }
  | { status: 'empty'; data: PersistedAuthData }
  | { status: 'locked'; data: PersistedAuthData }
  | { status: 'error'; data: PersistedAuthData; message: string }

/**
 * 按当前偏好加载认证数据
 */
export async function loadAuthData(prefs: AuthStoragePrefs): Promise<LoadAuthResult> {
  const empty: PersistedAuthData = {}
  const raw = readRawFromBackend(prefs.mode)
  if (!raw) return { status: 'empty', data: empty }

  if (prefs.mode === 'local' && prefs.encrypt) {
    const blob = tryParseEncryptedBlob(raw)
    if (!blob) {
      // 明文残留：可读，但提示用户开启加密后应重存
      try {
        return { status: 'ok', data: JSON.parse(raw) as PersistedAuthData }
      } catch {
        return { status: 'error', data: empty, message: '本地凭证数据损坏' }
      }
    }
    if (!sessionPassphrase) return { status: 'locked', data: empty }
    try {
      const data = await decryptJson<PersistedAuthData>(blob, sessionPassphrase)
      return { status: 'ok', data: data ?? empty }
    } catch (e) {
      return { status: 'error', data: empty, message: (e as Error).message }
    }
  }

  // session / memory / local 明文
  try {
    const parsed = JSON.parse(raw) as PersistedAuthData | EncryptedBlob
    if (tryParseEncryptedBlob(raw)) {
      // 偏好是明文但磁盘是密文
      if (!sessionPassphrase) return { status: 'locked', data: empty }
      const data = await decryptJson<PersistedAuthData>(parsed as EncryptedBlob, sessionPassphrase)
      return { status: 'ok', data: data ?? empty }
    }
    return { status: 'ok', data: parsed as PersistedAuthData }
  } catch {
    return { status: 'error', data: empty, message: '凭证数据解析失败' }
  }
}

/**
 * 按当前偏好写入认证数据
 */
export async function saveAuthData(prefs: AuthStoragePrefs, data: PersistedAuthData): Promise<void> {
  if (prefs.mode === 'memory') {
    memoryStore = structuredClone(data)
    // 确保不把凭证留在其它后端
    sessionStorage.removeItem(DATA_KEY)
    // local 仅在用户明确不用时清理？切换模式时由 applyPrefs 清理
    return
  }

  if (prefs.mode === 'session') {
    sessionStorage.setItem(DATA_KEY, JSON.stringify(data))
    return
  }

  // local
  if (prefs.encrypt) {
    if (!sessionPassphrase) {
      throw new Error('已启用口令加密，请先设置口令')
    }
    const blob = await encryptJson(data, sessionPassphrase)
    localStorage.setItem(DATA_KEY, JSON.stringify(blob))
    return
  }
  localStorage.setItem(DATA_KEY, JSON.stringify(data))
}

/**
 * 切换存储偏好时迁移数据并清理其它后端
 */
export async function applyPrefsChange(
  next: AuthStoragePrefs,
  data: PersistedAuthData,
): Promise<void> {
  if (next.mode === 'local' && next.encrypt && !sessionPassphrase) {
    throw new Error('启用本地加密前请先设置口令')
  }

  await saveAuthData(next, data)
  savePrefs(next)

  // 清理非目标后端中的凭证明文/密文，避免残留
  if (next.mode !== 'session') sessionStorage.removeItem(DATA_KEY)
  if (next.mode !== 'local') localStorage.removeItem(DATA_KEY)
  if (next.mode !== 'memory') {
    // memory 已在 save 时写入；其它模式不保留 memory 敏感副本也可保留作当前会话——保持 memoryStore 与 data 同步
    memoryStore = structuredClone(data)
  }
}

/** 清除所有后端中的凭证数据（保留偏好） */
export function clearAllAuthData() {
  memoryStore = {}
  sessionStorage.removeItem(DATA_KEY)
  localStorage.removeItem(DATA_KEY)
  clearSessionPassphrase()
}

export function getDataKey(): string {
  return DATA_KEY
}
