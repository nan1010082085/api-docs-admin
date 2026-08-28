<template>
  <div class="try-it-out">
    <div class="try-title">
      <el-icon><Promotion /></el-icon>
      <span>在线测试</span>
      <div class="try-actions">
        <el-button size="small" :icon="DocumentCopy" @click="copyCurl">复制 cURL</el-button>
      </div>
    </div>

    <div class="try-url-bar">
      <el-input :model-value="displayBaseUrl" placeholder="请求前缀（空=同源代理）" class="base-url-input" @update:model-value="onBaseUrlChange">
        <template #prepend>
          <span class="method-text" :class="`method-${endpoint.method}`">{{ endpoint.method.toUpperCase() }}</span>
        </template>
      </el-input>
      <el-button type="primary" :loading="sending" class="send-btn" @click="sendRequest">发送</el-button>
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
                <el-input v-model="row.value" :placeholder="row.type || 'string'" size="small" />
              </div>
              <span class="col-type">{{ row.type }}</span>
              <span class="col-desc">{{ row.description }}</span>
            </div>
          </div>
        </div>

        <div class="param-block">
          <div class="param-block-title">
            <span>Query 参数</span>
            <el-button size="small" text type="primary" @click="addQueryRow">+ 添加</el-button>
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
                  placeholder="name"
                  size="small"
                />
                <template v-else>
                  {{ row.name }}
                  <span v-if="row.required" class="required">*</span>
                </template>
              </div>
              <div class="col-value">
                <el-input v-model="row.value" :placeholder="row.type || 'value'" size="small" />
              </div>
              <span class="col-type">{{ row.type || 'string' }}</span>
              <span class="col-desc">{{ row.description }}</span>
              <span class="col-action">
                <el-button
                  v-if="!row.fromSpec || !row.required"
                  :icon="Delete"
                  circle
                  size="small"
                  @click="queryRows.splice(idx, 1)"
                />
              </span>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- Body -->
      <el-tab-pane name="body">
        <template #label>
          Body
          <el-badge v-if="hasRequestBody" is-dot class="tab-badge" />
        </template>

        <div v-if="!supportsBody && !hasRequestBody" class="body-none">
          <el-radio-group v-model="bodyNone" size="small">
            <el-radio-button :value="true">none</el-radio-button>
          </el-radio-group>
          <p class="field-hint">当前方法默认无请求体。如需自定义可切换 Content-Type 后编辑。</p>
          <el-button size="small" @click="forceEnableBody">启用 Body</el-button>
        </div>

        <template v-else>
          <div class="body-toolbar">
            <el-radio-group v-model="bodyMode" size="small">
              <el-radio-button value="form" :disabled="!canUseFormMode">表单</el-radio-button>
              <el-radio-button value="raw">JSON / Raw</el-radio-button>
              <el-radio-button value="formdata">form-data</el-radio-button>
            </el-radio-group>
            <el-select v-model="selectedContentType" size="small" class="content-type-select">
              <el-option label="application/json" value="application/json" />
              <el-option label="multipart/form-data" value="multipart/form-data" />
              <el-option label="application/x-www-form-urlencoded" value="application/x-www-form-urlencoded" />
              <el-option label="text/plain" value="text/plain" />
            </el-select>
            <el-button size="small" @click="fillExample">填入示例</el-button>
          </div>

          <!-- 表单模式：按 schema properties 逐项录入 -->
          <div v-if="bodyMode === 'form'" class="params-table">
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
                  :placeholder="field.placeholder"
                  size="small"
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

          <!-- form-data -->
          <div v-else class="form-data-section">
            <div v-for="(field, idx) in formDataFields" :key="idx" class="form-data-row">
              <el-input v-model="field.name" placeholder="字段名" size="small" class="field-name" />
              <el-select v-model="field.type" size="small" style="width: 80px">
                <el-option label="文本" value="text" />
                <el-option label="文件" value="file" />
              </el-select>
              <el-input
                v-if="field.type === 'text'"
                v-model="field.value"
                placeholder="值"
                size="small"
                class="field-value"
              />
              <el-upload
                v-else
                :auto-upload="false"
                :show-file-list="false"
                :on-change="(f: UploadFile) => handleFileChange(idx, f)"
                class="file-upload"
              >
                <el-button size="small">{{ field.fileName || '选择文件' }}</el-button>
              </el-upload>
              <el-button :icon="Delete" circle size="small" @click="formDataFields.splice(idx, 1)" />
            </div>
            <el-button class="add-btn" size="small" @click="addFormDataField">+ 添加字段</el-button>
          </div>

          <p v-if="bodyError" class="field-error">{{ bodyError }}</p>
        </template>
      </el-tab-pane>

      <!-- Headers -->
      <el-tab-pane label="Headers" name="headers">
        <div class="kv-table">
          <div v-for="(row, idx) in headerRows" :key="idx" class="kv-row">
            <el-checkbox v-model="row.enabled" />
            <el-input v-model="row.name" placeholder="Header Name" size="small" />
            <el-input v-model="row.value" placeholder="Value" size="small" />
            <el-button :icon="Delete" circle size="small" @click="headerRows.splice(idx, 1)" />
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
import { ref, computed, watch } from 'vue'
import { Delete, Promotion, DocumentCopy } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { UploadFile } from 'element-plus'
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

interface HeaderRow {
  enabled: boolean
  name: string
  value: string
}

interface FormDataField {
  name: string
  type: 'text' | 'file'
  value: string
  fileName: string
  file: File | null
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

const bodyMode = ref<'form' | 'raw' | 'formdata'>('form')
const bodyNone = ref(true)
const bodyForced = ref(false)
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
const supportsBody = computed(() =>
  ['post', 'put', 'patch', 'delete'].includes(props.endpoint.method) || bodyForced.value,
)

const bodySchema = computed((): JsonSchema | undefined => {
  const content = props.endpoint.requestBody?.content
  if (!content) return undefined
  const media = content[selectedContentType.value] ?? content['application/json'] ?? Object.values(content)[0]
  return media?.schema
})

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
  const queryParts = queryRows.value
    .filter((r) => r.enabled && r.name.trim() && r.value !== '')
    .map((r) => `${encodeURIComponent(r.name.trim())}=${encodeURIComponent(r.value)}`)
  if (queryParts.length) url += (url.includes('?') ? '&' : '?') + queryParts.join('&')

  // 相对路径时补全当前 origin，方便预览
  if (url.startsWith('/')) {
    return `${window.location.origin}${url}`
  }
  return url
})

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
  bodyForced.value = false
  bodyNone.value = !hasRequestBody.value

  const params = props.endpoint.parameters ?? []
  pathRows.value = params.filter((p) => p.in === 'path').map(toParamRow)
  queryRows.value = params.filter((p) => p.in === 'query').map(toParamRow)

  const content = props.endpoint.requestBody?.content
  selectedContentType.value = content
    ? (Object.keys(content)[0] ?? 'application/json')
    : 'application/json'

  if (selectedContentType.value === 'multipart/form-data') {
    bodyMode.value = 'formdata'
    formDataFields.value = []
    addFormDataField()
  } else if (canUseFormMode.value || (content && Object.values(content)[0]?.schema?.properties)) {
    bodyMode.value = 'form'
    rebuildBodyFields()
    bodyValue.value = JSON.stringify(generateExample(bodySchema.value) ?? {}, null, 2)
  } else if (hasRequestBody.value) {
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
  } else {
    bodyMode.value = 'raw'
    bodyFields.value = []
    bodyValue.value = ''
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

function addFormDataField() {
  formDataFields.value.push({ name: '', type: 'text', value: '', fileName: '', file: null })
}

function handleFileChange(idx: number, file: UploadFile) {
  if (formDataFields.value[idx]) {
    formDataFields.value[idx].file = (file.raw as File) ?? null
    formDataFields.value[idx].fileName = file.name
  }
}

function forceEnableBody() {
  bodyForced.value = true
  bodyNone.value = false
  bodyMode.value = 'raw'
  if (!headerRows.value.some((r) => r.name.toLowerCase() === 'content-type')) {
    headerRows.value.unshift({ enabled: true, name: 'Content-Type', value: 'application/json' })
  }
}

function fillExample() {
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
  return JSON.stringify(obj, null, 2)
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

  if (!supportsBody.value && !hasRequestBody.value) {
    return { body: undefined, headers }
  }

  if (bodyMode.value === 'formdata' || selectedContentType.value === 'multipart/form-data') {
    const formData = new FormData()
    for (const field of formDataFields.value) {
      if (!field.name.trim()) continue
      if (field.type === 'file' && field.file) formData.append(field.name, field.file)
      else formData.append(field.name, field.value)
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
  }

  if (!raw.trim()) return { body: undefined, headers }

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
  const queryParts = queryRows.value
    .filter((r) => r.enabled && r.name.trim() && r.value !== '')
    .map((r) => `${encodeURIComponent(r.name.trim())}=${encodeURIComponent(r.value)}`)
  if (queryParts.length) url += '?' + queryParts.join('&')
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
      store.updateActiveEnv({ token, authType: 'bearer' })
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
  if (mode === 'form') {
    selectedContentType.value = 'application/json'
    rebuildBodyFields()
  } else if (mode === 'formdata') {
    selectedContentType.value = 'multipart/form-data'
    if (!formDataFields.value.length) addFormDataField()
  } else if (mode === 'raw' && !bodyValue.value && bodyFields.value.length) {
    bodyValue.value = buildJsonBodyFromForm()
  }
})
</script>

<style lang="scss" scoped>
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
  align-items: stretch;
  margin-bottom: 8px;

  :deep(.el-input__wrapper),
  :deep(.el-input-group__prepend) {
    height: 40px;
  }
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
  height: 40px;
  min-width: 80px;
}

.url-preview {
  background: #f6f8fa;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  padding: 10px 14px;
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
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 8px;
}

.params-table {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.params-header,
.params-row {
  display: grid;
  grid-template-columns: 36px 120px 1fr 72px 1fr;
  gap: 8px;
  padding: 8px 12px;
  align-items: center;
}

.query-table .params-header,
.query-table .params-row {
  grid-template-columns: 36px 120px 1fr 72px 1fr 36px;
}

.form-header,
.form-row {
  grid-template-columns: 36px 120px 1fr 72px 1fr;
}

.params-header {
  background: #f5f7fa;
  font-size: 12px;
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
  padding: 16px;
  text-align: center;
  color: #909399;
  font-size: 13px;
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

.col-type {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: #909399;
}

.col-desc {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.body-none {
  padding: 8px 0;
}

.form-data-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-data-row {
  display: flex;
  gap: 8px;
  align-items: center;

  .field-name {
    width: 140px;
  }

  .field-value,
  .file-upload {
    flex: 1;
  }
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
