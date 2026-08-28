<template>
  <div class="schema-viewer">
    <div class="table-wrapper">
      <div class="table-header">
        <span class="col-name">字段</span>
        <span class="col-value">类型</span>
        <span class="col-required">必填</span>
        <span class="col-desc">说明</span>
      </div>
      <div v-for="row in rows" :key="row.name + row.depth" class="table-row">
        <span class="col-name">
          <span :style="{ paddingLeft: `${row.depth * 16}px` }">
            <span v-if="row.depth > 0" class="tree-connector">├─ </span>
            <code>{{ row.name }}</code>
          </span>
        </span>
        <span class="col-value">
          <code>{{ row.type }}</code>
          <span v-if="row.format" class="format">({{ row.format }})</span>
        </span>
        <span class="col-required">
          <span v-if="row.required" class="required">*</span>
        </span>
        <span class="col-desc">
          {{ row.description }}
          <span v-if="row.enum" class="enum">可选: {{ row.enum.join(', ') }}</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { JsonSchema } from '@/types'

const props = defineProps<{
  schema: JsonSchema
}>()

interface SchemaRow {
  name: string
  type: string
  format?: string
  description?: string
  required: boolean
  depth: number
  example?: unknown
  default?: unknown
  enum?: unknown[]
}

const rows = computed(() => flattenSchema(props.schema, '', 0, new Set(props.schema.required)))

function flattenSchema(
  schema: JsonSchema | undefined,
  prefix: string,
  depth: number,
  requiredFields: Set<string>,
): SchemaRow[] {
  if (!schema) return []

  if (schema.$ref) {
    return [{ name: prefix || '$ref', type: schema.$ref, required: false, depth }]
  }

  if (schema.type === 'array' && schema.items) {
    const itemRows = flattenSchema(schema.items, `${prefix}[]`, depth, new Set(schema.items.required))
    return [
      {
        name: prefix || '[]',
        type: 'array',
        description: schema.description,
        required: requiredFields.has(prefix),
        depth,
        example: schema.example,
      },
      ...itemRows,
    ]
  }

  if (schema.properties) {
    const result: SchemaRow[] = []
    for (const [key, prop] of Object.entries(schema.properties)) {
      const fieldName = prefix ? `${prefix}.${key}` : key
      result.push({
        name: key,
        type: prop.type ?? 'object',
        format: prop.format,
        description: prop.description,
        required: requiredFields.has(key),
        depth,
        example: prop.example,
        default: prop.default,
        enum: prop.enum,
      })
      if (prop.properties || (prop.type === 'array' && prop.items?.properties)) {
        result.push(...flattenSchema(prop, fieldName, depth + 1, new Set(prop.required)))
      }
    }
    return result
  }

  return [
    {
      name: prefix || schema.type || 'unknown',
      type: schema.type ?? 'any',
      format: schema.format,
      description: schema.description,
      required: false,
      depth,
      example: schema.example,
      default: schema.default,
      enum: schema.enum,
    },
  ]
}
</script>

<style lang="scss" scoped>
.schema-viewer {
  margin-top: 8px;
}

.table-wrapper {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 180px 120px 60px 1fr;
  background: #f5f7fa;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.table-row {
  display: grid;
  grid-template-columns: 180px 120px 60px 1fr;
  padding: 10px 16px;
  align-items: center;
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.col-name {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  color: #d73a49;

  .tree-connector {
    color: #c0c4cc;
  }
}

.col-value {
  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    color: #6f42c1;
  }

  .format {
    font-size: 12px;
    color: #909399;
    margin-left: 4px;
  }
}

.col-required {
  text-align: center;

  .required {
    color: #f56c6c;
    font-weight: 700;
  }
}

.col-desc {
  font-size: 13px;
  color: #606266;

  .enum {
    display: block;
    font-size: 12px;
    color: #909399;
    margin-top: 2px;
  }
}
</style>
