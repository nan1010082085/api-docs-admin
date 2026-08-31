import type { JsonSchema } from '@/types'

/** OpenAPI media content（schema + example） */
export interface MediaContent {
  schema?: JsonSchema
  example?: unknown
}

/**
 * 合并 allOf 各分支 schema（用于生成示例）
 */
function mergeAllOfSchemas(parts: JsonSchema[]): JsonSchema {
  const merged: JsonSchema = { properties: {}, required: [] }
  for (const part of parts) {
    if (part.type) merged.type = part.type
    if (part.properties) {
      merged.properties = { ...(merged.properties ?? {}), ...part.properties }
    }
    if (part.required) {
      merged.required = [...(merged.required ?? []), ...part.required]
    }
    if (part.items && !merged.items) merged.items = part.items
  }
  if (!merged.type && merged.properties && Object.keys(merged.properties).length > 0) {
    merged.type = 'object'
  }
  return merged
}

/**
 * 根据 JSON Schema 生成示例值（优先 example / default / enum）
 */
export function generateExample(schema: JsonSchema | undefined): unknown {
  if (!schema) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.enum?.length) return schema.enum[0]
  if (schema.oneOf?.length) return generateExample(schema.oneOf[0])
  if (schema.anyOf?.length) return generateExample(schema.anyOf[0])
  if (schema.allOf?.length) return generateExample(mergeAllOfSchemas(schema.allOf))

  const type = schema.type
  if (type === 'object' || schema.properties) {
    const obj: Record<string, unknown> = {}
    for (const [key, prop] of Object.entries(schema.properties ?? {})) {
      obj[key] = generateExample(prop)
    }
    return obj
  }
  if (type === 'array') {
    return schema.items ? [generateExample(schema.items)] : []
  }
  if (type === 'string') {
    if (schema.format === 'date-time') return new Date().toISOString()
    if (schema.format === 'date') return new Date().toISOString().slice(0, 10)
    if (schema.format === 'email') return 'user@example.com'
    if (schema.format === 'uri' || schema.format === 'url') return 'https://example.com'
    return ''
  }
  if (type === 'integer' || type === 'number') return 0
  if (type === 'boolean') return false
  return null
}

/**
 * 将示例值转为表单字符串
 */
export function exampleToInputValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return JSON.stringify(value)
}

/**
 * 按 schema 类型解析表单字符串
 */
export function parseInputBySchema(raw: string, schema?: JsonSchema): unknown {
  if (raw === '') return undefined
  const type = schema?.type
  if (type === 'integer') {
    const n = parseInt(raw, 10)
    return Number.isNaN(n) ? raw : n
  }
  if (type === 'number') {
    const n = Number(raw)
    return Number.isNaN(n) ? raw : n
  }
  if (type === 'boolean') {
    if (raw === 'true') return true
    if (raw === 'false') return false
    return raw
  }
  if (type === 'object' || type === 'array') {
    try {
      return JSON.parse(raw)
    } catch {
      return raw
    }
  }
  return raw
}

/**
 * 解析 media 示例值：显式 example 优先，否则按 schema 生成
 */
export function resolveMediaExample(media?: MediaContent): unknown {
  if (!media) return null
  if (media.example !== undefined) return media.example
  return generateExample(media.schema)
}

/**
 * 将示例值格式化为可复制文本（按 Content-Type）
 */
export function formatExampleText(value: unknown, contentType = 'application/json'): string {
  if (value === null || value === undefined) return ''
  if (contentType === 'application/x-www-form-urlencoded') {
    if (typeof value === 'object' && !Array.isArray(value)) {
      const params = new URLSearchParams()
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (v === undefined || v === null) continue
        params.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v))
      }
      return params.toString()
    }
  }
  if (contentType.includes('json') || typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  if (typeof value === 'string') return value
  return String(value)
}

/**
 * 获取符合 JSON Schema 的可复制示例文本
 */
export function getMediaExampleText(media?: MediaContent, contentType = 'application/json'): string {
  return formatExampleText(resolveMediaExample(media), contentType)
}
