import yaml from 'js-yaml'
import type {
  ApiEndpoint,
  ApiParameter,
  ApiTagGroup,
  HttpMethod,
  JsonSchema,
  ProjectConfig,
  ProjectData,
  RequestBody,
  ApiResponse,
  SecurityScheme,
} from '@/types'
import { convertSwagger2ToOpenAPI3 } from '@/utils/swagger2to3'

/** 完整的 OpenAPI root，用于 $ref 解析 */
interface OpenApiRoot {
  components?: {
    parameters?: Record<string, unknown>
    schemas?: Record<string, unknown>
    securitySchemes?: Record<string, unknown>
    requestBodies?: Record<string, unknown>
    responses?: Record<string, unknown>
  }
  [key: string]: unknown
}

/**
 * 解析 OpenAPI spec（YAML 或 JSON）为 ProjectData
 * 自动兼容 Swagger 2.0：检测到 swagger: "2.0" 时先转换为 OpenAPI 3
 */
export async function parseSpec(config: ProjectConfig): Promise<ProjectData> {
  const text = await fetchSpec(config.specUrl)
  const parsed: unknown = text.trim().startsWith('{') ? JSON.parse(text) : yaml.load(text)

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('无法解析 spec: ' + config.specUrl)
  }

  // Swagger 2.0 -> OpenAPI 3 自动转换（如果不是 2.0 则原样返回）
  const raw: OpenApiRoot = convertSwagger2ToOpenAPI3(parsed) as OpenApiRoot

  const info = (raw as Record<string, unknown>).info as Record<string, unknown> ?? {}
  const servers = (raw as Record<string, unknown>).servers as Array<Record<string, unknown>> ?? []
  const baseUrl = (servers[0]?.url as string) ?? ''
  const paths: Record<string, Record<string, unknown>> = (raw as Record<string, unknown>).paths as Record<string, Record<string, unknown>> ?? {}

  // 收集所有 tag 描述
  const tagDescriptions = new Map<string, string>()
  const rawTags = (raw as Record<string, unknown>).tags as Array<Record<string, unknown>> | undefined
  if (Array.isArray(rawTags)) {
    for (const tag of rawTags) {
      if (tag.name) tagDescriptions.set(tag.name as string, (tag.description as string) ?? '')
    }
  }

  // 解析所有端点（合并 path 级与 operation 级 parameters）
  const refMemo = new Map<string, unknown>()
  const endpoints: ApiEndpoint[] = []
  for (const [path, rawPathItem] of Object.entries(paths)) {
    // Path Item 可能是 { $ref: '#/...' }
    const pathItem = resolveRef(rawPathItem, raw, 0, refMemo) as Record<string, unknown>
    if (!pathItem || typeof pathItem !== 'object') continue
    const pathParams = parseParameters(
      pathItem.parameters as unknown[],
      raw,
      refMemo,
    )
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!isHttpMethod(method)) continue
      const op = resolveRef(operation, raw, 0, refMemo) as Record<string, unknown>
      const opParams = parseParameters(op.parameters as unknown[], raw, refMemo)
      const endpoint: ApiEndpoint = {
        id: `${method}-${path}`,
        method,
        path,
        summary: op.summary as string | undefined,
        description: op.description as string | undefined,
        tags: (op.tags as string[]) ?? [],
        deprecated: op.deprecated as boolean | undefined,
        parameters: mergeParameters(pathParams, opParams),
        requestBody: parseRequestBody(op.requestBody, raw, refMemo),
        responses: parseResponses(op.responses as Record<string, unknown>, raw, refMemo),
        security: op.security as unknown[] | undefined,
      }
      endpoints.push(endpoint)
    }
  }

  // 按 tag 分组
  const groups = groupByTag(endpoints, tagDescriptions)

  // 解析项目级安全方案
  const securitySchemes = parseSecuritySchemes(
    (raw as Record<string, unknown>).components as Record<string, unknown> | undefined,
    raw,
    refMemo,
  )

  return {
    config,
    title: info.title as string,
    description: info.description as string,
    version: info.version as string,
    baseUrl,
    groups,
    endpoints,
    securitySchemes,
  }
}

// ── $ref 解析 ──

/** 环检测标记：同一 $ref 递归展开中再次遇到则停止，避免死循环 */
const REF_VISITING = Symbol('ref-visiting')

/**
 * 递归解析 $ref（root 随调用传入，避免并行解析时串项目）
 * memo 按 pointer 缓存已展开结果，同 schema 多处引用只展开一次
 */
function resolveRef(
  obj: unknown,
  root: OpenApiRoot,
  depth = 0,
  memo: Map<string, unknown> = new Map(),
): unknown {
  if (depth > 40) return obj
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveRef(item, root, depth + 1, memo))
  }

  const record = obj as Record<string, unknown>

  if (record['$ref'] && typeof record['$ref'] === 'string') {
    const refStr = record['$ref']
    if (memo.has(refStr)) {
      const cached = memo.get(refStr)
      // 环：返回未展开的 $ref，避免无限递归
      if (cached === REF_VISITING) return { $ref: refStr }
      return cached
    }
    memo.set(refStr, REF_VISITING)
    const resolved = resolveJsonPointer(refStr, root)
    if (resolved === undefined) {
      memo.delete(refStr)
      return record
    }
    const expanded = resolveRef(resolved, root, depth + 1, memo)
    memo.set(refStr, expanded)
    return expanded
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    result[key] = resolveRef(value, root, depth + 1, memo)
  }
  return result
}

/**
 * 解析 JSON Pointer（#/components/schemas/Foo~1Bar）
 * 按 RFC 6901 解码 ~1 → /、~0 → ~
 */
function resolveJsonPointer(ref: string, root: OpenApiRoot): unknown {
  if (!ref.startsWith('#/')) return undefined
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let current: unknown = root
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// ── 获取 spec 文本 ──

/**
 * 解析 spec URL：只支持本地文件路径，不支持远程 URL（CORS 限制）
 * 相对路径基于 Vite BASE_URL，避免深链 F5 时相对当前路径拼接错误
 */
function resolveSpecUrl(url: string): string {
  if (/^https?:\/\//i.test(url) || url.startsWith('//')) {
    throw new Error('不支持远程 URL，请将 spec 文件放到 public/specs/ 目录')
  }
  if (url.startsWith('/')) return url
  const base = import.meta.env.BASE_URL || '/'
  const normalizedBase = base.endsWith('/') ? base : `${base}/`
  return `${normalizedBase}${url.replace(/^\.\//, '')}`
}

async function fetchSpec(url: string): Promise<string> {
  const resolved = resolveSpecUrl(url)
  const resp = await fetch(resolved)
  if (!resp.ok) throw new Error(`获取 spec 失败: ${resp.status} ${resp.statusText} (${resolved})`)
  return resp.text()
}

// ── 工具函数 ──

function isHttpMethod(s: string): s is HttpMethod {
  return ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(s)
}

function parseParameters(
  raw: unknown[],
  root: OpenApiRoot,
  memo: Map<string, unknown>,
): ApiParameter[] {
  if (!Array.isArray(raw)) return []
  const result: ApiParameter[] = []
  for (const p of raw) {
    const param = resolveRef(p, root, 0, memo) as Record<string, unknown>
    if (!param?.name || !param?.in) continue
    result.push({
      name: param.name as string,
      in: param.in as ApiParameter['in'],
      description: param.description as string | undefined,
      required: param.required as boolean | undefined,
      deprecated: param.deprecated as boolean | undefined,
      schema: resolveRef(param.schema, root, 0, memo) as JsonSchema | undefined,
      example: param.example ?? (param.schema as JsonSchema | undefined)?.example,
    })
  }
  return result
}

/** operation 参数覆盖同名 path 参数 */
function mergeParameters(pathParams: ApiParameter[], opParams: ApiParameter[]): ApiParameter[] {
  const map = new Map<string, ApiParameter>()
  for (const p of pathParams) map.set(`${p.in}:${p.name}`, p)
  for (const p of opParams) map.set(`${p.in}:${p.name}`, p)
  return [...map.values()]
}

function parseRequestBody(
  raw: unknown,
  root: OpenApiRoot,
  memo: Map<string, unknown>,
): RequestBody | undefined {
  const resolved = resolveRef(raw, root, 0, memo) as Record<string, unknown> | undefined
  if (!resolved) return undefined
  const content: Record<string, { schema?: JsonSchema; example?: unknown }> = {}
  const rawContent = resolved.content as Record<string, Record<string, unknown>> | undefined
  if (rawContent) {
    for (const [mediaType, mediaObj] of Object.entries(rawContent)) {
      content[mediaType] = {
        schema: resolveRef(mediaObj.schema, root, 0, memo) as JsonSchema | undefined,
        example: mediaObj.example,
      }
    }
  }
  return {
    description: resolved.description as string | undefined,
    required: resolved.required as boolean | undefined,
    content,
  }
}

function parseResponses(
  raw: Record<string, unknown> | undefined,
  root: OpenApiRoot,
  memo: Map<string, unknown>,
): Record<string, ApiResponse> | undefined {
  if (!raw) return undefined
  const result: Record<string, ApiResponse> = {}
  for (const [statusCode, resp] of Object.entries(raw)) {
    const r = resolveRef(resp, root, 0, memo) as Record<string, unknown>
    const content: Record<string, { schema?: JsonSchema; example?: unknown }> = {}
    const rawContent = r.content as Record<string, Record<string, unknown>> | undefined
    if (rawContent) {
      for (const [mediaType, mediaObj] of Object.entries(rawContent)) {
        content[mediaType] = {
          schema: resolveRef(mediaObj.schema, root, 0, memo) as JsonSchema | undefined,
          example: mediaObj.example,
        }
      }
    }
    result[statusCode] = {
      description: r.description as string | undefined,
      content: Object.keys(content).length > 0 ? content : undefined,
    }
  }
  return result
}

/** 解析 components.securitySchemes -> SecurityScheme[] */
function parseSecuritySchemes(
  components: Record<string, unknown> | undefined,
  root: OpenApiRoot,
  memo: Map<string, unknown>,
): SecurityScheme[] {
  if (!components) return []
  const rawSchemes = components.securitySchemes as Record<string, Record<string, unknown>> | undefined
  if (!rawSchemes) return []
  const result: SecurityScheme[] = []
  for (const [name, scheme] of Object.entries(rawSchemes)) {
    const s = resolveRef(scheme, root, 0, memo) as Record<string, unknown>
    const type = s.type as string
    if (!type) continue
    const ss: SecurityScheme = { name, type: 'none', description: s.description as string | undefined }
    if (type === 'http') {
      const sch = (s.scheme as string) ?? 'bearer'
      ss.type = sch === 'basic' ? 'basic' : 'bearer'
      ss.scheme = sch
    } else if (type === 'apiKey') {
      ss.type = 'apiKey'
      ss.in = s.in as 'header' | 'query' | 'cookie'
      ss.fieldName = s.name as string
    } else if (type === 'oauth2') {
      ss.type = 'oauth2'
    } else if (type === 'openIdConnect') {
      ss.type = 'openIdConnect'
    }
    result.push(ss)
  }
  return result
}

function groupByTag(
  endpoints: ApiEndpoint[],
  tagDescriptions: Map<string, string>,
): ApiTagGroup[] {
  const map = new Map<string, ApiEndpoint[]>()

  for (const ep of endpoints) {
    const tags = ep.tags?.length ? ep.tags : ['未分类']
    for (const tag of tags) {
      if (!map.has(tag)) map.set(tag, [])
      map.get(tag)!.push(ep)
    }
  }

  const groups: ApiTagGroup[] = []
  for (const [name, eps] of map) {
    groups.push({
      name,
      description: tagDescriptions.get(name),
      endpoints: eps,
    })
  }

  return groups.sort((a, b) => {
    const aHas = tagDescriptions.has(a.name) ? 0 : 1
    const bHas = tagDescriptions.has(b.name) ? 0 : 1
    return aHas - bHas
  })
}
