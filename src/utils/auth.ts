import type { SecurityScheme, Environment, EnvKvRow } from '@/types'

/**
 * 根据安全方案 + 环境配置，构建请求时需附加的 Header / Query
 * 支持：bearer (Authorization)、basic (Authorization Basic)、apiKey (header/query/cookie)
 */
export interface AuthPayload {
  headers: Record<string, string>
  queryParams: Record<string, string>
}

function rowsToRecord(rows?: EnvKvRow[]): Record<string, string> {
  const out: Record<string, string> = {}
  if (!rows) return out
  for (const row of rows) {
    if (row.enabled && row.key.trim()) out[row.key.trim()] = row.value
  }
  return out
}

/**
 * 根据环境 + 安全方案组装认证 Header / Query
 * 优先级：环境 headerRows > 环境 token/apiKey > securitySchemes
 */
export function buildAuthPayload(
  env: Environment | null,
  schemes: SecurityScheme[] | undefined,
): AuthPayload {
  const headers: Record<string, string> = {}
  const queryParams: Record<string, string> = {}

  if (!env) return { headers, queryParams }

  // 1. 环境固定 headers + headerRows
  Object.assign(headers, env.headers ?? {})
  Object.assign(headers, rowsToRecord(env.headerRows))

  // 2. Bearer Token（环境.token）
  if (env.token?.trim()) {
    headers['Authorization'] = 'Bearer ' + env.token.trim()
  }

  // 3. Basic Auth（环境.username + 环境密码）
  const basicUser = (env as any).basicUser as string | undefined
  const basicPass = (env as any).basicPassword as string | undefined
  if (basicUser !== undefined && basicPass !== undefined) {
    headers['Authorization'] = 'Basic ' + btoa(basicUser + ':' + basicPass)
  }

  // 4. API Key（环境.apiKey -> X-API-Key 默认，或匹配 scheme）
  if (env.apiKey?.trim() && !headers['X-API-Key']) {
    headers['X-API-Key'] = env.apiKey.trim()
  }

  // 5. 根据 securitySchemes 补充 apiKey 类型的认证
  if (schemes) {
    for (const scheme of schemes) {
      if (scheme.type === 'apiKey' && scheme.in && scheme.fieldName) {
        // 环境已有值则不覆盖
        if (scheme.in === 'header' && !headers[scheme.fieldName]) {
          // 查找 apiKey 行 / token
          const val = env.apiKey?.trim() || rowsToRecord(env.headerRows)[scheme.fieldName]
          if (val) headers[scheme.fieldName] = val
        } else if (scheme.in === 'query' && !queryParams[scheme.fieldName]) {
          const val = env.apiKey?.trim()
          if (val) queryParams[scheme.fieldName] = val
        }
      }
    }
  }

  // 6. 环境固定 Query
  Object.assign(queryParams, rowsToRecord(env.queryRows))

  return { headers, queryParams }
}

/**
 * 从登录响应体中提取 token
 * @param body 响应体文本
 * @param fieldPath JSON 路径，如 access_token / data.token / token（支持 dot 路径）
 * @returns 提取到的 token 字符串，或 null
 */
export function extractTokenFromBody(body: string, fieldPath: string): string | null {
  if (!fieldPath || !body) return null
  try {
    const json = JSON.parse(body)
    const parts = fieldPath.split('.').filter(Boolean)
    let current: unknown = json
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return null
      current = (current as Record<string, unknown>)[part]
    }
    if (typeof current === 'string' && current) return current
    if (typeof current === 'number') return String(current)
    return null
  } catch {
    return null
  }
}

/** 默认尝试的 token 字段名（从登录响应中提取） */
export const COMMON_TOKEN_FIELDS = [
  'access_token',
  'token',
  'accessToken',
  'data.access_token',
  'data.token',
  'data.accessToken',
  'result.token',
  'result.access_token',
]

/**
 * 自动从登录响应中提取 token：遍历常见字段
 */
export function autoExtractToken(body: string): string | null {
  for (const field of COMMON_TOKEN_FIELDS) {
    const token = extractTokenFromBody(body, field)
    if (token) return token
  }
  return null
}