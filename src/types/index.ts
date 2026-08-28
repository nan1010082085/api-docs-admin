/** HTTP 方法 */
export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options'

/** 参数位置 */
export type ParamIn = 'query' | 'path' | 'header' | 'cookie'

/** 单个参数 */
export interface ApiParameter {
  name: string
  in: ParamIn
  description?: string
  required?: boolean
  deprecated?: boolean
  schema?: JsonSchema
  example?: unknown
}

/** JSON Schema（简化版） */
export interface JsonSchema {
  type?: string
  format?: string
  description?: string
  default?: unknown
  enum?: unknown[]
  items?: JsonSchema
  properties?: Record<string, JsonSchema>
  required?: string[]
  oneOf?: JsonSchema[]
  anyOf?: JsonSchema[]
  allOf?: JsonSchema[]
  $ref?: string
  nullable?: boolean
  example?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  pattern?: string
  additionalProperties?: boolean | JsonSchema
}

/** Request Body */
export interface RequestBody {
  description?: string
  required?: boolean
  content?: Record<string, { schema?: JsonSchema; example?: unknown }>
}

/** Response */
export interface ApiResponse {
  description?: string
  content?: Record<string, { schema?: JsonSchema; example?: unknown }>
  headers?: Record<string, { description?: string; schema?: JsonSchema }>
}

/** 单个 API 端点 */
export interface ApiEndpoint {
  id: string
  method: HttpMethod
  path: string
  summary?: string
  description?: string
  tags?: string[]
  deprecated?: boolean
  parameters?: ApiParameter[]
  requestBody?: RequestBody
  responses?: Record<string, ApiResponse>
  security?: unknown[]
}

/** 按 tag 分组的端点 */
export interface ApiTagGroup {
  name: string
  description?: string
  endpoints: ApiEndpoint[]
}

/** @deprecated 已改为填了就传，保留类型仅兼容旧 localStorage */
export type AuthType = 'bearer' | 'apiKey' | 'none'

/** 环境级键值行（Header / Query / Body 固定参数） */
export interface EnvKvRow {
  id: string
  enabled: boolean
  key: string
  value: string
}

/** 测试环境配置 */
export interface Environment {
  /** 环境名称 */
  name: string
  /** 请求前缀，如 http://localhost:3001；空字符串表示同源（走 Vite 代理） */
  baseUrl: string
  /** 默认请求头 */
  headers?: Record<string, string>
  /** 可编辑的额外 Header 行 */
  headerRows?: EnvKvRow[]
  /** 环境级固定 Query */
  queryRows?: EnvKvRow[]
  /** 环境级固定 Body 字段（合并进 JSON / 表单） */
  bodyRows?: EnvKvRow[]
  /** 默认 Cookie */
  cookie?: string
  /** Bearer Token（不含 Bearer 前缀） */
  token?: string
  /** API Key（X-API-Key） */
  apiKey?: string
  /** 认证方式 */
  authType?: AuthType
}

/** 项目配置 */
export interface ProjectConfig {
  /** 唯一标识 */
  id: string
  /** 显示名称 */
  name: string
  /** OpenAPI spec 来源：本地文件路径或远程 URL */
  specUrl: string
  /** 描述 */
  description?: string
  /** 版本 */
  version?: string
  /** 测试环境列表 */
  environments?: Environment[]
}

/** 解析后的项目数据 */
export interface ProjectData {
  config: ProjectConfig
  title?: string
  description?: string
  version?: string
  baseUrl?: string
  groups: ApiTagGroup[]
  endpoints: ApiEndpoint[]
}

/** Try-it-out 请求配置 */
export interface TryRequest {
  method: HttpMethod
  url: string
  headers: Record<string, string>
  query: Record<string, string>
  body: string
  cookie: string
}

/** Try-it-out 响应 */
export interface TryResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  time: number
  size: number
}
