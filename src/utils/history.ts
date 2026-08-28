/** 请求历史记录（localStorage 持久化，按项目隔离） */

export interface HistoryEntry {
  id: string
  projectId: string
  endpointId: string
  method: string
  path: string
  url: string
  status: number
  statusText: string
  time: number
  size: number
  requestTime: number
}

const STORAGE_PREFIX = 'api-docs:history:'
const MAX_ENTRIES = 50

export function getHistory(projectId: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + projectId)
    if (!raw) return []
    return JSON.parse(raw) as HistoryEntry[]
  } catch {
    return []
  }
}

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'requestTime'>): void {
  const list = getHistory(entry.projectId)
  const full: HistoryEntry = {
    ...entry,
    id: 'h-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    requestTime: Date.now(),
  }
  list.unshift(full)
  if (list.length > MAX_ENTRIES) list.length = MAX_ENTRIES
  localStorage.setItem(STORAGE_PREFIX + entry.projectId, JSON.stringify(list))
}

export function clearHistory(projectId: string): void {
  localStorage.removeItem(STORAGE_PREFIX + projectId)
}

export function removeHistory(projectId: string, id: string): void {
  const list = getHistory(projectId).filter((e) => e.id !== id)
  localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify(list))
}