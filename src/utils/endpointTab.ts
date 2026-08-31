import type { ApiEndpoint, HttpMethod } from '@/types'

/** 通常携带请求体的 HTTP 方法 */
const BODY_PREFERRED_METHODS: HttpMethod[] = ['post', 'put', 'patch']

/**
 * 根据 method 与端点定义，决定默认展示「请求参数」或「请求体」
 */
export function resolveDefaultRequestTab(endpoint: ApiEndpoint): 'params' | 'body' {
  const { method, requestBody, parameters } = endpoint
  const hasBody = !!requestBody
  const hasParams = (parameters ?? []).length > 0

  if (BODY_PREFERRED_METHODS.includes(method)) {
    if (hasBody) return 'body'
    return hasParams ? 'params' : 'body'
  }

  if (method === 'delete' && hasBody) return 'body'

  return 'params'
}
