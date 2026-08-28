<template>
  <div class="try-it-out">
    <div class="try-title">
      <AppIcon name="promotion" :size="18" />
      <span>在线测试</span>
      <div class="try-actions">
        <el-button size="small" @click="copyCurl">
          <AppIcon name="document-copy" :size="14" style="margin-right: 4px" />
          复制 cURL
        </el-button>
      </div>
    </div>

    <div class="try-url-bar">
      <el-input
        :model-value="displayBaseUrl"
        size="small"
        placeholder="请求前缀（空=同源代理）"
        class="base-url-input"
        @update:model-value="onBaseUrlChange"
      >
        <template #prepend>
          <span class="method-text" :class="`method-${endpoint.method}`">{{ endpoint.method.toUpperCase() }}</span>
        </template>
      </el-input>
      <el-button type="primary" size="small" :loading="sending" class="send-btn" @click="sendRequest">发送</el-button>
    </div>

    <div class="url-preview">
      <code>{{ fullUrl }}</code>
    </div>

    <el-tabs v-model="activeTab" class="try-tabs">
      <!-- Params：Path + Query（Apifox 风格） -->
      <el-tab-pane name="params">
        <template #label>
          Params
          <el-badge v-if="enabledParamCount" :value="enabledParamCount" type="primary" class="tab-badge" />
        </template>

        <div v-if="pathRows.length" class="param-block">
          <div class="param-block-title">Path 参数</div>
          <div class="params-table">
            <div class="params-header">
              <span class="col-check" />
              <span class="col-name">参数名</span>
              <span class="col-value">参数值</span>
              <span class="col-type">类型</span>
              <span class="col-desc">说明</span>
            </div>
            <div v-for="row in pathRows" :key="row.id" class="params-row">
              <span class="col-check">
                <el-checkbox v-model="row.enabled" :disabled="row.required" />
              </span>
              <span class="col-name">
                {{ row.name }}
                <span v-if="row.required" class="required">*</span>
              </span>
              <div class="col-value">
                <el-input v-model="row.value" size="small" :placeholder="row.type || 'string'" />
              </div>
              <span class="col-type">{{ row.type }}</span>
              <span class="col-desc">{{ row.description }}</span>
            </div>
          </div>
        </div>

        <div class="param-block">
          <div class="param-block-title">
            <span>Query 参数</span>
            <el-button text type="primary" size="small" @click="addQueryRow">+ 添加</el-button>
          </div>
          <div class="params-table query-table">
            <div class="params-header">
              <span class="col-check" />
              <span class="col-name">参数名</span>
              <span class="col-value">参数值</span>
              <span class="col-type">类型</span>
              <span class="col-desc">说明</span>
              <span class="col-action" />
            </div>
            <div v-if="!queryRows.length" class="params-empty">暂无 Query 参数，可点击添加</div>
            <div v-for="(row, idx) in queryRows" :key="row.id" class="params-row">
              <span class="col-check">
                <el-checkbox v-model="row.enabled" />
              </span>
              <div class="col-name">
                <el-input
                  v-if="!row.fromSpec"
                  v-model="row.name"
                  size="small"
                  placeholder="参数名"
                />
                <template v-else>
                  {{ row.name }}
                  <span v-if="row.required" class="required">*</span>
                </template>
              </div>
              <div class="col-value">
                <el-input v-model="row.value" size="small" :placeholder="row.type || '参数值'" />
              </div>
              <span class="col-type">{{ row.type || 'string' }}</span>
              <span class="col-desc">{{ row.description }}</span>
              <span class="col-action">
                <el-button
                  v-if="!row.fromSpec || !row.required"
                  circle
                  size="small"
                  @click="queryRows.splice(idx, 1)"
                >
                  <AppIcon name="delete" :size="14" />
                </el-button>
              </span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Body：none / 表单 / Raw / form-data 同一组切换 -->
      <el-tab-pane name="body">
        <template #label>
          Body
          <el-badge v-if="hasRequestBody && bodyMode !== 'none'" is-dot class="tab-badge" />
        </template>

        <div class="body-toolbar">
          <el-radio-group v-model="bodyMode" size="small">
            <el-radio-button value="none">none</el-radio-button>
            <el-radio-button value="form" :disabled="!canUseFormMode">表单</el-radio-button>
            <el-radio-button value="raw">JSON / Raw</el-radio-button>
            <el-radio-button value="formdata">form-data</el-radio-button>
          </el-radio-group>
          <template v-if="bodyMode !== 'none'">
            <el-select v-model="selectedContentType" size="small" class="content-type-select">
              <el-option label="application/json" value="application/json" />
              <el-option label="multipart/form-data" value="multipart/form-data" />
              <el-option label="application/x-www-form-urlencoded" value="application/x-www-form-urlencoded" />
              <el-option label="text/plain" value="text/plain" />
            </el-select>
            <el-button size="small" @click="fillExample">填入示例</el-button>
          </template>
        </div>

        <div v-if="bodyMode === 'none'" class="body-empty">
          此请求不发送 Body。需要时可切换到 JSON / Raw 或 form-data。
        </div>

        <!-- 表单模式：按 schema properties 逐项录入 -->
        <div v-else-if="bodyMode === 'form'" class="params-table">
          <div class="params-header form-header">
            <span class="col-check" />
            <span class="col-name">字段名</span>
            <span class="col-value">字段值</span>
            <span class="col-type">类型</span>
            <span class="col-desc">说明</span>
          </div>
          <div v-if="!bodyFields.length" class="params-empty">
            无可用 schema 字段，请切换到 JSON / Raw 编辑
          </div>
          <div v-for="field in bodyFields" :key="field.name" class="params-row form-row">
            <span class="col-check">
              <el-checkbox v-model="field.enabled" :disabled="field.required" />
            </span>
            <span class="col-name">
              {{ field.name }}
              <span v-if="field.required" class="required">*</span>
            </span>
            <div class="col-value">
              <el-switch
                v-if="field.type === 'boolean'"
                v-model="field.boolValue"
                inline-prompt
                active-text="true"
                inactive-text="false"
              />
              <el-input
                v-else
                v-model="field.value"
                size="small"
                :placeholder="field.placeholder"
                :type="field.type === 'object' || field.type === 'array' ? 'textarea' : 'text'"
                :rows="field.type === 'object' || field.type === 'array' ? 3 : 1"
              />
            </div>
            <span class="col-type">{{ field.type }}</span>
            <span class="col-desc">{{ field.description }}</span>
          </div>
        </div>

        <!-- Raw JSON -->
        <el-input
          v-else-if="bodyMode === 'raw'"
          v-model="bodyValue"
          type="textarea"
          :rows="12"
          :placeholder="bodyPlaceholder"
          class="body-editor"
        />

        <!-- form-data：支持文本 / 文件 / 图片预览，按 OpenAPI schema 预填 -->
        <div v-else class="form-data-section">
          <div class="params-table formdata-table">
            <div class="params-header">
              <span class="col-check" />
              <span class="col-name">字段名</span>
              <span class="col-kind">类型</span>
              <span class="col-value">字段值</span>
              <span class="col-desc">说明</span>
              <span class="col-action" />
            </div>
            <div v-if="!formDataFields.length" class="params-empty">
              暂无字段，可点击添加；binary 字段会自动识别为文件
            </div>
            <div v-for="(field, idx) in formDataFields" :key="field.id" class="params-row formdata-row">
              <span class="col-check">
                <el-checkbox v-model="field.enabled" :disabled="field.required && field.fromSpec" />
              </span>
              <div class="col-name">
                <el-input
                  v-if="!field.fromSpec"
                  v-model="field.name"
                  size="small"
                  placeholder="字段名"
                />
                <template v-else>
                  {{ field.name }}
                  <span v-if="field.required" class="required">*</span>
                </template>
              </div>
              <div class="col-kind">
                <el-select v-model="field.type" size="small" class="kind-select" @change="onFormDataTypeChange(field)">
                  <el-option label="文本" value="text" />
                  <el-option label="文件" value="file" />
                </el-select>
              </div>
              <div class="col-value">
                <el-input
                  v-if="field.type === 'text'"
                  v-model="field.value"
                  size="small"
                  placeholder="字段值"
                />
                <div v-else class="file-field">
                  <el-upload
                    :auto-upload="false"
                    :show-file-list="false"
                    :accept="field.accept || undefined"
                    :on-change="(f: UploadFile) => handleFileChange(idx, f)"
                  >
                    <el-button size="small">
                      {{ field.fileName || (field.accept.startsWith('image') ? '选择图片' : '选择文件') }}
                    </el-button>
                  </el-upload>
                  <div v-if="field.file" class="file-meta">
                    <img
                      v-if="field.previewUrl"
                      :src="field.previewUrl"
                      alt="preview"
                      class="file-preview"
                    />
                    <div class="file-info">
                      <span class="file-name" :title="field.fileName">{{ field.fileName }}</span>
                      <span class="file-size">{{ formatSize(field.file.size) }}</span>
                    </div>
                    <el-button text type="danger" size="small" @click="clearFormDataFile(idx)">清除</el-button>
                  </div>
                </div>
              </div>
              <span class="col-desc">{{ field.description }}</span>
              <span class="col-action">
                <el-button
                  v-if="!field.fromSpec || !field.required"
                  circle
                  size="small"
                  @click="removeFormDataField(idx)"
                >
                  <AppIcon name="delete" :size="14" />
                </el-button>
              </span>
            </div>
          </div>
          <el-button class="add-btn" size="small" @click="addFormDataField">+ 添加字段</el-button>
          <p class="field-hint">multipart 发送时由浏览器自动带 boundary，不会手写 Content-Type。</p>
        </div>

        <p v-if="bodyError" class="field-error">{{ bodyError }}</p>
      </el-tab-pane>

      <!-- Headers -->
      <el-tab-pane label="Headers" name="headers">
        <div class="kv-table">
          <div v-for="(row, idx) in headerRows" :key="idx" class="kv-row">
            <el-checkbox v-model="row.enabled" />
            <el-input v-model="row.name" size="small" placeholder="Header Name" />
            <el-input v-model="row.value" size="small" placeholder="Value" />
            <el-button circle size="small" @click="headerRows.splice(idx, 1)">
              <AppIcon name="delete" :size="14" />
            </el-button>
          </div>
          <el-button class="add-btn" size="small" @click="headerRows.push({ enabled: true, name: '', value: '' })">
            + 添加请求头
          </el-button>
        </div>
        <p class="field-hint">Authorization / X-API-Key 会从顶部「认证」自动注入，也可在此覆盖。</p>
      </el-tab-pane>

      <!-- Cookie -->
      <el-tab-pane label="Cookie" name="cookie">
        <el-input
          v-model="cookieValue"
          type="textarea"
          :rows="4"
          placeholder="key1=value1; key2=value2"
          class="cookie-input"
        />
        <el-checkbox v-model="withCredentials" class="cred-check">携带浏览器 Cookie（credentials: include）</el-checkbox>
        <p class="field-hint">跨域时手写 Cookie 头可能被浏览器拦截；同源代理下可勾选携带 Cookie。</p>
      </el-tab-pane>
    </el-tabs>

    <div v-if="response" class="response-section">
      <div class="response-status">
        <span :class="statusClass(response.status)">{{ response.status }} {{ response.statusText }}</span>
        <span class="response-meta">{{ response.time }}ms · {{ formatSize(response.size) }}</span>
      </div>
      <el-tabs v-model="respTab" class="resp-tabs" size="small">
        <el-tab-pane label="响应体" name="body">
          <pre class="response-body"><code>{{ responseBodyFormatted }}</code></pre>
        </el-tab-pane>
        <el-tab-pane label="响应头" name="headers">
          <div v-for="(val, key) in response.headers" :key="key" class="resp-header-item">
            <code>{{ key }}</code>: {{ val }}
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-alert v-if="error" :title="error" type="error" show-icon closable class="try-error" @close="error = ''" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
import AppIcon from '@/components/AppIcon.vue'
import { useDocsStore } from '@/stores/docs'
import { buildCurlCommand } from '@/utils/curl'
import {
  exampleToInputValue,
  generateExample,
  parseInputBySchema,
} from '@/utils/example'
import type { ApiEndpoint, ApiParameter, JsonSchema, TryResponse } from '@/types'

const props = defineProps<{
  endpoint: ApiEndpoint
}>()

const store = useDocsStore()

interface ParamRow {
  id: string
  enabled: boolean
  name: string
  value: string
  type: string
  description: string
  required: boolean
  fromSpec: boolean
  schema?: JsonSchema
}

interface BodyField {
  name: string
  value: string
  boolValue: boolean
  type: string
  description: string
  required: boolean
  enabled: boolean
  placeholder: string
  schema?: JsonSchema
}

interface FormDataField {
  id: string
  enabled: boolean
  name: string
  type: 'text' | 'file'
  value: string
  fileName: string
  file: File | null
  /** 图片预览 ObjectURL */
  previewUrl: string | null
  /** input accept，如 image/* */
  accept: string
  required: boolean
  fromSpec: boolean
  description: string
}

interface HeaderRow {
  enabled: boolean
  name: string
  value: string
}

let rowSeq = 0
function nextId() {
  rowSeq += 1
  return `r-${rowSeq}`
}

const pathRows = ref<ParamRow[]>([])
const queryRows = ref<ParamRow[]>([])
const headerRows = ref<HeaderRow[]>([])
const bodyFields = ref<BodyField[]>([])
const formDataFields = ref<FormDataField[]>([])

const bodyMode = ref<'none' | 'form' | 'raw' | 'formdata'>('none')
const selectedContentType = ref('application/json')
const bodyValue = ref('')
const bodyError = ref('')
const cookieValue = ref('')
const withCredentials = ref(false)
const activeTab = ref('params')
const respTab = ref('body')
const sending = ref(false)
const response = ref<TryResponse | null>(null)
const error = ref('')
const localBaseUrl = ref('')

const displayBaseUrl = computed(() => localBaseUrl.value)

const hasRequestBody = computed(() => !!props.endpoint.requestBody)

const bodySchema = computed((): JsonSchema | undefined => {
  const content = props.endpoint.requestBody?.content
  if (!content) return undefined
  // form-data 模式优先取 multipart schema，避免仍指向 json 导致预填失败
  if (bodyMode.value === 'formdata' || selectedContentType.value === 'multipart/form-data') {
    return (content['multipart/form-data'] ?? Object.values(content)[0])?.schema
  }
  const media =
    content[selectedContentType.value] ??
    content['application/json'] ??
    Object.values(content)[0]
  return media?.schema
})

/** multipart schema（不依赖 bodyMode，避免初始化竞态） */
function getMultipartSchema(): JsonSchema | undefined {
  const content = props.endpoint.requestBody?.content
  if (!content) return undefined
  return (content['multipart/form-data'] ?? Object.values(content)[0])?.schema
}

const canUseFormMode = computed(() => {
  const schema = bodySchema.value
  return !!(schema && (schema.type === 'object' || schema.properties))
})

const enabledParamCount = computed(() => {
  const path = pathRows.value.filter((r) => r.enabled && r.value !== '').length
  const query = queryRows.value.filter((r) => r.enabled && r.name && r.value !== '').length
  return path + query
})

const bodyPlaceholder = computed(() => {
  switch (selectedContentType.value) {
    case 'application/json':
      return '{\n  "key": "value"\n}'
    case 'text/plain':
      return '纯文本内容'
    default:
      return '请求体内容'
  }
})

const fullUrl = computed(() => {
  const base = localBaseUrl.value.replace(/\/$/, '')
  let url = base + props.endpoint.path
  for (const row of pathRows.value) {
    if (row.enabled && row.value !== '') {
      url = url.replace(`{${row.name}}`, encodeURIComponent(row.value))
    }
  }
  const queryParts = collectQueryParts()
  if (queryParts.length) url += (url.includes('?') ? '&' : '?') + queryParts.join('&')

  // 相对路径时补全当前 origin，方便预览
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`
  }
  return url
})

/**
 * 接口 Query + 环境固定 Query（同名以接口行优先）
 */
function collectQueryParts(): string[] {
  const parts: string[] = []
  const seen = new Set<string>()
  for (const r of queryRows.value) {
    if (!r.enabled || !r.name.trim() || r.value === '') continue
    const key = r.name.trim()
    seen.add(key)
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(r.value)}`)
  }
  for (const [key, value] of Object.entries(store.getAuthQuery())) {
    if (seen.has(key)) continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
  }
  return parts
}

const responseBodyFormatted = computed(() => {
  if (!response.value) return ''
  try {
    return JSON.stringify(JSON.parse(response.value.body), null, 2)
  } catch {
    return response.value.body
  }
})

function paramDefaultValue(p: ApiParameter): string {
  if (p.example !== undefined) return exampleToInputValue(p.example)
  if (p.schema?.default !== undefined) return exampleToInputValue(p.schema.default)
  if (p.schema?.example !== undefined) return exampleToInputValue(p.schema.example)
  return ''
}

function toParamRow(p: ApiParameter): ParamRow {
  return {
    id: nextId(),
    enabled: true,
    name: p.name,
    value: paramDefaultValue(p),
    type: p.schema?.type ?? 'string',
    description: p.description ?? '',
    required: !!p.required || p.in === 'path',
    fromSpec: true,
    schema: p.schema,
  }
}

function rebuildBodyFields() {
  const schema = bodySchema.value
  const propsMap = schema?.properties
  if (!propsMap) {
    bodyFields.value = []
    return
  }
  const required = new Set(schema?.required ?? [])
  bodyFields.value = Object.entries(propsMap).map(([name, prop]) => {
    const example = generateExample(prop)
    return {
      name,
      value: prop.type === 'boolean' ? '' : exampleToInputValue(example),
      boolValue: prop.type === 'boolean' ? Boolean(example) : false,
      type: prop.type ?? (prop.properties ? 'object' : prop.items ? 'array' : 'string'),
      description: prop.description ?? '',
      required: required.has(name),
      enabled: true,
      placeholder: prop.type ?? 'value',
      schema: prop,
    }
  })
}

function syncHeadersFromEnv() {
  const env = store.activeEnvironment
  const authHeaders = store.getAuthHeaders()
  const rows: HeaderRow[] = []

  // OpenAPI header 参数
  for (const p of (props.endpoint.parameters ?? []).filter((x) => x.in === 'header')) {
    rows.push({
      enabled: true,
      name: p.name,
      value: paramDefaultValue(p) || (p.schema?.default !== undefined ? String(p.schema.default) : ''),
    })
  }

  for (const [k, v] of Object.entries(authHeaders)) {
    const existing = rows.find((r) => r.name.toLowerCase() === k.toLowerCase())
    if (existing) existing.value = v
    else rows.push({ enabled: true, name: k, value: v })
  }

  if (env?.headers) {
    for (const [k, v] of Object.entries(env.headers)) {
      if (authHeaders[k] !== undefined) continue
      const existing = rows.find((r) => r.name.toLowerCase() === k.toLowerCase())
      if (existing) existing.value = v
      else rows.push({ enabled: true, name: k, value: v })
    }
  }

  if (!rows.some((r) => r.name.toLowerCase() === 'content-type') && hasRequestBody.value) {
    rows.unshift({ enabled: true, name: 'Content-Type', value: selectedContentType.value })
  }

  if (!rows.length) {
    rows.push({ enabled: true, name: 'Content-Type', value: 'application/json' })
  }

  headerRows.value = rows
  cookieValue.value = env?.cookie ?? ''
}

function resetFromEndpoint() {
  response.value = null
  error.value = ''
  bodyError.value = ''

  const params = props.endpoint.parameters ?? []
  pathRows.value = params.filter((p) => p.in === 'path').map(toParamRow)
  queryRows.value = params.filter((p) => p.in === 'query').map(toParamRow)

  const content = props.endpoint.requestBody?.content
  selectedContentType.value = content
    ? (Object.keys(content)[0] ?? 'application/json')
    : 'application/json'

  if (!hasRequestBody.value) {
    bodyMode.value = 'none'
    bodyFields.value = []
    formDataFields.value = []
    bodyValue.value = ''
  } else if (selectedContentType.value === 'multipart/form-data') {
    bodyMode.value = 'formdata'
    rebuildFormDataFields()
  } else if (canUseFormMode.value || (content && Object.values(content)[0]?.schema?.properties)) {
    bodyMode.value = 'form'
    rebuildBodyFields()
    bodyValue.value = JSON.stringify(generateExample(bodySchema.value) ?? {}, null, 2)
  } else {
    bodyMode.value = 'raw'
    bodyFields.value = []
    const media = content ? Object.values(content)[0] : undefined
    if (media?.example) {
      bodyValue.value = JSON.stringify(media.example, null, 2)
    } else if (media?.schema) {
      bodyValue.value = JSON.stringify(generateExample(media.schema) ?? {}, null, 2)
    } else {
      bodyValue.value = ''
    }
  }

  // canUseFormMode depends on selectedContentType; rebuild after setting it
  if (bodyMode.value === 'form') {
    rebuildBodyFields()
    if (!bodyFields.value.length) {
      bodyMode.value = 'raw'
      bodyValue.value = JSON.stringify(generateExample(bodySchema.value) ?? {}, null, 2)
    }
  }

  localBaseUrl.value = store.activeEnvironment?.baseUrl ?? ''
  syncHeadersFromEnv()
  activeTab.value = 'params'
}

function addQueryRow() {
  queryRows.value.push({
    id: nextId(),
    enabled: true,
    name: '',
    value: '',
    type: 'string',
    description: '',
    required: false,
    fromSpec: false,
  })
}

function isBinarySchema(schema?: JsonSchema): boolean {
  if (!schema) return false
  return schema.format === 'binary' || schema.format === 'byte' || (schema as { type?: string }).type === 'file'
}

function isImageLikeField(name: string, schema?: JsonSchema): boolean {
  const hay = `${name} ${schema?.description ?? ''}`.toLowerCase()
  return /image|img|avatar|photo|picture|封面|图片|头像|icon/.test(hay)
}

function clearFormDataPreview(field: FormDataField) {
  if (field.previewUrl) {
    URL.revokeObjectURL(field.previewUrl)
    field.previewUrl = null
  }
}

/** 按 OpenAPI multipart schema 预填 form-data 字段 */
function rebuildFormDataFields() {
  for (const field of formDataFields.value) clearFormDataPreview(field)

  const schema = getMultipartSchema() ?? bodySchema.value
  const propsMap = schema?.properties
  if (!propsMap || !Object.keys(propsMap).length) {
    formDataFields.value = []
    addFormDataField()
    return
  }

  const required = new Set(schema?.required ?? [])
  formDataFields.value = Object.entries(propsMap).map(([name, prop]) => {
    const binary = isBinarySchema(prop)
    const image = binary && isImageLikeField(name, prop)
    return {
      id: nextId(),
      enabled: true,
      name,
      type: binary ? 'file' as const : 'text' as const,
      value: binary ? '' : exampleToInputValue(generateExample(prop)),
      fileName: '',
      file: null,
      previewUrl: null,
      accept: image ? 'image/*' : '',
      required: required.has(name),
      fromSpec: true,
      description: prop.description ?? (binary ? '文件' : ''),
    }
  })
}

function addFormDataField() {
  formDataFields.value.push({
    id: nextId(),
    enabled: true,
    name: '',
    type: 'text',
    value: '',
    fileName: '',
    file: null,
    previewUrl: null,
    accept: '',
    required: false,
    fromSpec: false,
    description: '',
  })
}

function removeFormDataField(idx: number) {
  const field = formDataFields.value[idx]
  if (field) clearFormDataPreview(field)
  formDataFields.value.splice(idx, 1)
}

function clearFormDataFile(idx: number) {
  const field = formDataFields.value[idx]
  if (!field) return
  clearFormDataPreview(field)
  field.file = null
  field.fileName = ''
}

function onFormDataTypeChange(field: FormDataField) {
  if (field.type === 'text') {
    clearFormDataPreview(field)
    field.file = null
    field.fileName = ''
    field.accept = ''
  } else if (!field.accept) {
    field.accept = isImageLikeField(field.name) ? 'image/*' : '*/*'
  }
}

function handleFileChange(idx: number, file: UploadFile) {
  const field = formDataFields.value[idx]
  if (!field) return
  clearFormDataPreview(field)
  const raw = (file.raw as File) ?? null
  field.file = raw
  field.fileName = file.name
  if (raw && raw.type.startsWith('image/')) {
    field.previewUrl = URL.createObjectURL(raw)
    if (!field.accept) field.accept = 'image/*'
  }
}

function fillExample() {
  if (bodyMode.value === 'none') return
  const schema = bodySchema.value
  const content = props.endpoint.requestBody?.content
  const media = content?.[selectedContentType.value] ?? content?.['application/json']
  const example = media?.example ?? generateExample(schema)
  bodyValue.value = JSON.stringify(example ?? {}, null, 2)
  if (bodyMode.value === 'form') {
    rebuildBodyFields()
  }
}

function buildJsonBodyFromForm(): string {
  const obj: Record<string, unknown> = {}
  for (const field of bodyFields.value) {
    if (!field.enabled) continue
    if (field.type === 'boolean') {
      obj[field.name] = field.boolValue
      continue
    }
    if (field.value === '' && !field.required) continue
    obj[field.name] = parseInputBySchema(field.value, field.schema)
  }
  // 环境固定 Body 字段（同名以表单优先）
  for (const [k, v] of Object.entries(store.getAuthBodyFields())) {
    if (!(k in obj)) obj[k] = coerceEnvBodyValue(v)
  }
  return JSON.stringify(obj, null, 2)
}

/** 环境 Body 字符串尝试按 JSON 字面量解析 */
function coerceEnvBodyValue(raw: string): unknown {
  const t = raw.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null') return null
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
    try {
      return JSON.parse(t)
    } catch {
      return raw
    }
  }
  return raw
}

/**
 * 把环境固定 Body 字段 merge 进 JSON 字符串
 */
function mergeAuthBodyIntoJson(raw: string): string {
  const extras = store.getAuthBodyFields()
  if (!Object.keys(extras).length) return raw
  try {
    const base = raw.trim() ? (JSON.parse(raw) as Record<string, unknown>) : {}
    if (base === null || typeof base !== 'object' || Array.isArray(base)) return raw
    for (const [k, v] of Object.entries(extras)) {
      if (!(k in base)) base[k] = coerceEnvBodyValue(v)
    }
    return JSON.stringify(base, null, 2)
  } catch {
    return raw
  }
}

function getOutgoingBody(): { body: BodyInit | undefined; headers: Record<string, string> } {
  const headers: Record<string, string> = {}
  for (const row of headerRows.value) {
    if (row.enabled && row.name.trim()) headers[row.name.trim()] = row.value
  }

  // 环境认证：未手动覆盖时注入
  const auth = store.getAuthHeaders()
  for (const [k, v] of Object.entries(auth)) {
    const has = Object.keys(headers).some((h) => h.toLowerCase() === k.toLowerCase())
    if (!has) headers[k] = v
  }

  if (cookieValue.value.trim() && !withCredentials.value) {
    headers['Cookie'] = cookieValue.value.trim()
  }

  if (bodyMode.value === 'none') {
    return { body: undefined, headers }
  }

  if (bodyMode.value === 'formdata' || selectedContentType.value === 'multipart/form-data') {
    const formData = new FormData()
    const seen = new Set<string>()
    for (const field of formDataFields.value) {
      if (!field.enabled || !field.name.trim()) continue
      seen.add(field.name.trim())
      if (field.type === 'file') {
        if (field.file) formData.append(field.name, field.file, field.fileName || field.file.name)
      } else {
        formData.append(field.name, field.value)
      }
    }
    for (const [k, v] of Object.entries(store.getAuthBodyFields())) {
      if (seen.has(k)) continue
      formData.append(k, v)
    }
    // 让浏览器自动带 boundary
    delete headers['Content-Type']
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() === 'content-type') delete headers[key]
    }
    return { body: formData, headers }
  }

  let raw = bodyValue.value
  if (bodyMode.value === 'form') {
    raw = buildJsonBodyFromForm()
  } else if (bodyMode.value === 'raw' && selectedContentType.value.includes('json')) {
    raw = mergeAuthBodyIntoJson(raw)
  }

  if (!raw.trim()) {
    // 仅环境 Body、无本地内容时仍可发送
    const extras = store.getAuthBodyFields()
    if (Object.keys(extras).length && selectedContentType.value.includes('json')) {
      raw = JSON.stringify(
        Object.fromEntries(Object.entries(extras).map(([k, v]) => [k, coerceEnvBodyValue(v)])),
        null,
        2,
      )
    } else {
      return { body: undefined, headers }
    }
  }

  if (!Object.keys(headers).some((h) => h.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = selectedContentType.value
  }

  return { body: raw, headers }
}

function requestUrl(): string {
  const base = localBaseUrl.value.replace(/\/$/, '')
  let url = base + props.endpoint.path
  for (const row of pathRows.value) {
    if (row.enabled && row.value !== '') {
      url = url.replace(`{${row.name}}`, encodeURIComponent(row.value))
    }
  }
  const queryParts = collectQueryParts()
  if (queryParts.length) url += (url.includes('?') ? '&' : '?') + queryParts.join('&')
  return url
}

async function sendRequest() {
  error.value = ''
  bodyError.value = ''
  response.value = null

  for (const row of pathRows.value) {
    if (row.required && row.enabled && !row.value) {
      error.value = `路径参数 ${row.name} 为必填项`
      activeTab.value = 'params'
      return
    }
  }
  for (const row of queryRows.value) {
    if (row.required && row.enabled && !row.value) {
      error.value = `Query 参数 ${row.name} 为必填项`
      activeTab.value = 'params'
      return
    }
  }

  if (bodyMode.value === 'formdata') {
    for (const field of formDataFields.value) {
      if (!field.enabled) continue
      if (field.required && field.type === 'file' && !field.file) {
        error.value = `form-data 文件字段 ${field.name || '(未命名)'} 为必填项`
        activeTab.value = 'body'
        return
      }
      if (field.required && field.type === 'text' && !field.value) {
        error.value = `form-data 字段 ${field.name || '(未命名)'} 为必填项`
        activeTab.value = 'body'
        return
      }
    }
  }

  const { body, headers } = getOutgoingBody()
  if (
    body &&
    typeof body === 'string' &&
    selectedContentType.value === 'application/json' &&
    bodyMode.value !== 'formdata'
  ) {
    try {
      JSON.parse(body)
    } catch {
      bodyError.value = 'JSON 格式错误'
      activeTab.value = 'body'
      return
    }
  }

  sending.value = true
  const startTime = performance.now()
  try {
    const fetchOptions: RequestInit = {
      method: props.endpoint.method.toUpperCase(),
      headers,
      mode: 'cors',
      credentials: withCredentials.value ? 'include' : 'same-origin',
    }
    if (body !== undefined) fetchOptions.body = body

    const resp = await fetch(requestUrl(), fetchOptions)
    const endTime = performance.now()
    const text = await resp.text()
    const respHeaders: Record<string, string> = {}
    resp.headers.forEach((v, k) => {
      respHeaders[k] = v
    })
    response.value = {
      status: resp.status,
      statusText: resp.statusText,
      headers: respHeaders,
      body: text,
      time: Math.round(endTime - startTime),
      size: new TextEncoder().encode(text).length,
    }

    // 登录成功时尝试回写 token
    tryAutoSaveToken(text)
  } catch (e) {
    error.value = `请求失败: ${(e as Error).message}。若跨域失败，请切换到「本地代理」环境。`
  } finally {
    sending.value = false
  }
}

function tryAutoSaveToken(text: string) {
  if (!props.endpoint.path.includes('/auth/login')) return
  try {
    const json = JSON.parse(text) as { success?: boolean; data?: { token?: string; accessToken?: string } }
    const token = json.data?.token ?? json.data?.accessToken
    if (json.success && token) {
      store.updateActiveEnv({ token })
      ElMessage.success('已自动保存 Token 到当前环境')
      syncHeadersFromEnv()
    }
  } catch {
    // ignore
  }
}

async function copyCurl() {
  const { body, headers } = getOutgoingBody()
  const curl = buildCurlCommand({
    method: props.endpoint.method,
    url: fullUrl.value,
    headers,
    body: typeof body === 'string' ? body : bodyMode.value === 'form' ? buildJsonBodyFromForm() : null,
    contentType: selectedContentType.value,
  })
  try {
    await navigator.clipboard.writeText(curl)
    ElMessage.success('cURL 已复制')
  } catch {
    ElMessage.error('复制失败')
  }
}

function onBaseUrlChange(val: string) {
  localBaseUrl.value = val
}

function statusClass(status: number) {
  if (status >= 200 && status < 300) return 'status-2xx'
  if (status >= 300 && status < 400) return 'status-3xx'
  return 'status-4xx'
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

watch(
  () => props.endpoint.id,
  () => resetFromEndpoint(),
  { immediate: true },
)

watch(
  () => store.activeEnvironment,
  () => {
    localBaseUrl.value = store.activeEnvironment?.baseUrl ?? ''
    syncHeadersFromEnv()
  },
)

watch(selectedContentType, (ct) => {
  const existing = headerRows.value.find((r) => r.name.toLowerCase() === 'content-type')
  if (ct === 'multipart/form-data') {
    if (existing) {
      const idx = headerRows.value.indexOf(existing)
      if (idx >= 0) headerRows.value.splice(idx, 1)
    }
    bodyMode.value = 'formdata'
  } else if (existing) {
    existing.value = ct
  } else {
    headerRows.value.unshift({ enabled: true, name: 'Content-Type', value: ct })
  }
})

watch(bodyMode, (mode) => {
  if (mode === 'none') return
  if (mode === 'form') {
    selectedContentType.value = 'application/json'
    rebuildBodyFields()
  } else if (mode === 'formdata') {
    selectedContentType.value = 'multipart/form-data'
    rebuildFormDataFields()
  } else if (mode === 'raw' && !bodyValue.value && bodyFields.value.length) {
    bodyValue.value = buildJsonBodyFromForm()
  }
  if (!headerRows.value.some((r) => r.name.toLowerCase() === 'content-type')) {
    headerRows.value.unshift({
      enabled: true,
      name: 'Content-Type',
      value: selectedContentType.value,
    })
  }
})

onBeforeUnmount(() => {
  for (const field of formDataFields.value) clearFormDataPreview(field)
})
</script>

<style lang="scss" scoped>
/**
 * 控件统一走 Element Plus size="small"。
 * 平台 theme 将 small 统一为 32px，与 editor/flow 一致，禁止再硬编码高度覆盖。
 */
.try-it-out {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.try-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;

  .try-actions {
    margin-left: auto;
  }
}

.try-url-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.base-url-input {
  flex: 1;

  :deep(.el-input-group__prepend) {
    padding: 0 12px;
  }
}

.method-text {
  font-weight: 700;
  font-size: 13px;
  font-family: 'SFMono-Regular', Consolas, monospace;
}

.send-btn {
  min-width: 80px;
}

.url-preview {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 16px;
  margin-bottom: 16px;

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    color: #303133;
    word-break: break-all;
  }
}

.try-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }

  :deep(.el-tabs__item) {
    height: 36px;
    line-height: 36px;
    font-size: 13px;
  }
}

.tab-badge {
  margin-left: 4px;

  :deep(.el-badge__content) {
    position: relative;
    transform: none;
    top: -1px;
  }
}

.param-block {
  margin-bottom: 16px;
}

.param-block-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

/* 与左侧 ParamTable 同款表格 */
.params-table {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.params-header,
.params-row {
  display: grid;
  grid-template-columns: 40px 140px 1fr 80px 1fr;
  gap: 8px;
  padding: 10px 16px;
  align-items: center;
}

.query-table .params-header,
.query-table .params-row {
  grid-template-columns: 40px 140px 1fr 80px 1fr 36px;
}

.formdata-table .params-header,
.formdata-table .params-row {
  grid-template-columns: 40px 140px 100px 1fr 1fr 36px;
}

.form-header,
.form-row {
  grid-template-columns: 40px 140px 1fr 80px 1fr;
}

.params-header {
  background: #f5f7fa;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.params-row {
  border-bottom: 1px solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }
}

.params-empty {
  padding: 20px 16px;
  text-align: center;
  color: #909399;
  font-size: 13px;
}

.col-check {
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-name {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  font-weight: 500;
  color: #303133;
  min-width: 0;

  .required {
    color: #f56c6c;
    margin-left: 2px;
  }
}

.col-kind {
  min-width: 0;
}

.kind-select {
  width: 100%;
}

.col-type {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: #909399;
}

.col-desc {
  font-size: 13px;
  color: #606266;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-action {
  display: flex;
  align-items: center;
  justify-content: center;
}

.body-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.content-type-select {
  width: 220px;
}

.body-editor {
  :deep(textarea) {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
  }
}

.body-empty {
  padding: 24px 0;
  color: #909399;
  font-size: 13px;
}

.form-data-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #f5f7fa;
  border-radius: 6px;
  border: 1px solid #e4e7ed;
}

.file-preview {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.file-name {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #909399;
}

.kv-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.add-btn {
  align-self: flex-start;
  margin-top: 4px;
}

.cookie-input {
  :deep(textarea) {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
  }
}

.cred-check {
  margin-top: 12px;
}

.field-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 8px;
  line-height: 1.5;
}

.field-error {
  color: #f56c6c;
  font-size: 13px;
  margin-top: 8px;
}

.response-section {
  margin-top: 20px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.response-status {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;

  span:first-child {
    font-weight: 700;
    font-size: 15px;
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
}

.response-meta {
  font-size: 12px;
  color: #909399;
}

.resp-tabs {
  padding: 12px 16px;
}

.response-body {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow: auto;
  font-size: 13px;
  line-height: 1.5;
  max-height: 400px;

  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
  }
}

.resp-header-item {
  font-size: 13px;
  margin-bottom: 4px;

  code {
    font-weight: 500;
    color: #d73a49;
  }
}

.try-error {
  margin-top: 12px;
}

.status-2xx {
  color: #49cc90;
}
.status-3xx {
  color: #fca130;
}
.status-4xx {
  color: #f93e3e;
}
</style>
