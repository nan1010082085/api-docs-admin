import type { JsonSchema } from '@/types'

/**
 * 根据 JSON Schema 生成示例值（优先 example / default / enum）
 */
export function generateExample(schema: JsonSchema | undefined): unknown {
  if (!schema) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default
  if (schema.enum?.length) return schema.enum[0]

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
