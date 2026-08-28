<template>
  <div class="try-it-out">
    <div class="try-title">
      <el-icon><Promotion /></el-icon>
      <span>在线测试</span>
    </div>

    <!-- 环境 + URL + 发送 -->
    <div class="try-url-bar">
      <el-select v-model="envIndex" placeholder="环境" class="env-select">
        <el-option
          v-for="(env, idx) in environments"
          :key="idx"
          :label="env.name"
          :value="idx"
        />
        <el-option label="自定义" :value="-1" />
      </el-select>

      <el-input v-model="baseUrl" placeholder="请求前缀" class="base-url-input">
        <template #prepend>
          <span class="method-text" :class="`method-${endpoint.method}`">{{ endpoint.method.toUpperCase() }}</span>
        </template>
      </el-input>

      <el-button type="primary" :loading="sending" @click="sendRequest" class="send-btn">
        发送
      </el-button>
    </div>

    <!-- 完整 URL -->
    <div class="url-preview">
      <code>{{ fullUrl }}</code>
    </div>

    <!-- Tabs -->
    <el-tabs v-model="activeTab" class="try-tabs">
      <!-- 路径参数 -->
      <el-tab-pane v-if="pathParams.length" label="路径参数" name="path">
        <div class="params-table">
          <div class="params-header">
            <span class="col-name">参数名</span>
            <span class="col-value">值</span>
            <span class="col-type">类型</span>
            <span class="col-desc">说明</span>
          </div>
          <div v-for="param in pathParams" :key="param.name" class="params-row">
            <span class="col-name">
              {{ param.name }}
              <span v-if="param.required" class="required">*</span>
            </span>
            <div class="col-value">
              <el-input v-model="paramValues.path[param.name]" :placeholder="param.schema?.type ?? 'string'" />
            </div>
            <span class="col-type">{{ param.schema?.type ?? 'string' }}</span>
            <span class="col-desc">{{ param.description }}</span>
          </div>
        </div>
      </el-tab-pane>

      <!-- Query 参数 -->
      <el-tab-pane v-if="queryParams.length" label="Query 参数" name="query">
        <div class="params-table">
          <div class="params-header">
            <span class="col-name">参数名</span>
            <span class="col-value">值</span>
            <span class="col-type">类型</span>
            <span class="col-desc">说明</span>
          </div>
          <div v-for="param in queryParams" :key="param.name" class="params-row">
            <span class="col-name">
              {{ param.name }}
              <span v-if="param.required" class="required">*</span>
            </span>
            <div class="col-value">
              <el-input v-model="paramValues.query[param.name]" :placeholder="param.schema?.type ?? 'string'" />
            </div>
            <span class="col-type">{{ param.schema?.type ?? 'string' }}</span>
            <span class="col-desc">{{ param.description }}</span>
          </div>
        </div>
      </el-tab-pane>

      <!-- 请求头 -->
      <el-tab-pane label="请求头" name="headers">
        <div class="kv-table">
          <div v-for="(_, idx) in headerRows" :key="idx" class="kv-row">
            <el-input v-model="headerRows[idx][0]" placeholder="Header Name" />
            <el-input v-model="headerRows[idx][1]" placeholder="Value" />
            <el-button :icon="Delete" circle @click="headerRows.splice(idx, 1)" />
          </div>
          <el-button class="add-btn" @click="headerRows.push(['', ''])">+ 添加请求头</el-button>
        </div>
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
        <p class="field-hint">输入完整的 Cookie 字符串，会附加到请求头</p>
      </el-tab-pane>

      <!-- 请求体 -->
      <el-tab-pane v-if="hasBody" label="请求体" name="body">
        <div class="body-toolbar">
          <el-select v-model="selectedContentType" size="small" class="content-type-select">
            <el-option label="application/json" value="application/json" />
            <el-option label="multipart/form-data" value="multipart/form-data" />
            <el-option label="application/x-www-form-urlencoded" value="application/x-www-form-urlencoded" />
            <el-option label="text/plain" value="text/plain" />
            <el-option label="application/xml" value="application/xml" />
          </el-select>
          <el-button size="small" @click="fillExample">填入示例</el-button>
        </div>

        <!-- form-data 文件上传 -->
        <div v-if="selectedContentType === 'multipart/form-data'" class="form-data-section">
          <div v-for="(field, idx) in formDataFields" :key="idx" class="form-data-row">
            <el-input v-model="field.name" placeholder="字段名" size="small" class="field-name" />
            <el-select v-model="field.type" size="small" class="field-type" style="width: 80px">
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
              :on-change="(f: any) => handleFileChange(idx, f)"
              class="file-upload"
            >
              <el-button size="small">{{ field.fileName || '选择文件' }}</el-button>
            </el-upload>
            <el-button :icon="Delete" circle size="small" @click="formDataFields.splice(idx, 1)" />
          </div>
          <el-button class="add-btn" size="small" @click="formDataFields.push({ name: '', type: 'text', value: '', fileName: '', file: null })">+ 添加字段</el-button>
        </div>

        <!-- 其他类型用 textarea -->
        <el-input
          v-else
          v-model="bodyValue"
          type="textarea"
          :rows="12"
          :placeholder="bodyPlaceholder"
          class="body-editor"
        />
        <p v-if="bodyError" class="field-error">{{ bodyError }}</p>
      </el-tab-pane>
    </el-tabs>

    <!-- 响应 -->
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

    <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { Delete, Promotion } from '@element-plus/icons-vue'
import type { ApiEndpoint, Environment, JsonSchema, TryResponse } from '@/types'

const props = defineProps<{
  endpoint: ApiEndpoint
  environments?: Environment[]
}>()

// ── 环境 ──
const envIndex = ref(props.environments?.length ? 0 : -1)
const baseUrl = ref(props.environments?.[0]?.baseUrl ?? '')

watch(envIndex, (idx) => {
  if (idx >= 0 && props.environments?.[idx]) {
    baseUrl.value = props.environments[idx].baseUrl
    const envHeaders = props.environments[idx].headers ?? {}
    for (const [k, v] of Object.entries(envHeaders)) {
      const existing = headerRows.value.find(([name]) => name === k)
      if (existing) existing[1] = v
      else headerRows.value.push([k, v])
    }
    if (props.environments[idx].cookie) cookieValue.value = props.environments[idx].cookie
  }
})

// ── 参数 ──
const pathParams = computed(() => (props.endpoint.parameters ?? []).filter((p) => p.in === 'path'))
const queryParams = computed(() => (props.endpoint.parameters ?? []).filter((p) => p.in === 'query'))

const paramValues = reactive({
  path: {} as Record<string, string>,
  query: {} as Record<string, string>,
})

for (const p of pathParams.value) {
  paramValues.path[p.name] = p.example !== undefined ? String(p.example) : p.schema?.default !== undefined ? String(p.schema.default) : ''
}
for (const p of queryParams.value) {
  paramValues.query[p.name] = p.example !== undefined ? String(p.example) : p.schema?.default !== undefined ? String(p.schema.default) : ''
}

// ── 请求头 / Cookie ──
const headerRows = ref<[string, string][]>([['Content-Type', 'application/json']])
const cookieValue = ref('')

// ── 请求体 ──
const hasBody = computed(() => ['post', 'put', 'patch'].includes(props.endpoint.method) && props.endpoint.requestBody)
const bodyMediaType = computed(() => {
  if (!props.endpoint.requestBody?.content) return 'application/json'
  return Object.keys(props.endpoint.requestBody.content)[0] ?? 'application/json'
})
const selectedContentType = ref(bodyMediaType.value)
const bodyValue = ref('')
const bodyError = ref('')

// Content-Type 变化时同步 header
watch(selectedContentType, (ct) => {
  const existing = headerRows.value.find(([k]) => k === 'Content-Type')
  if (existing) existing[1] = ct
  else headerRows.value.unshift(['Content-Type', ct])

  // multipart/form-data 时移除 Content-Type（浏览器自动设置 boundary）
  if (ct === 'multipart/form-data') {
    const idx = headerRows.value.findIndex(([k]) => k === 'Content-Type')
    if (idx >= 0) headerRows.value.splice(idx, 1)
  }
})

const bodyPlaceholder = computed(() => {
  switch (selectedContentType.value) {
    case 'application/json': return '{\n  "key": "value"\n}'
    case 'application/xml': return '<?xml version="1.0"?>\n<root>\n  <item>value</item>\n</root>'
    case 'text/plain': return '纯文本内容'
    default: return '请求体内容'
  }
})

// ── form-data ──
interface FormDataField {
  name: string
  type: 'text' | 'file'
  value: string
  fileName: string
  file: File | null
}
const formDataFields = ref<FormDataField[]>([])

function handleFileChange(idx: number, file: any) {
  if (formDataFields.value[idx]) {
    formDataFields.value[idx].file = file.raw
    formDataFields.value[idx].fileName = file.name
  }
}

function fillExample() {
  const content = props.endpoint.requestBody?.content
  if (!content) return
  const media = content[bodyMediaType.value]
  if (!media) return
  if (media.example) {
    bodyValue.value = JSON.stringify(media.example, null, 2)
    return
  }
  if (media.schema) {
    bodyValue.value = JSON.stringify(generateExample(media.schema as unknown as Record<string, unknown>), null, 2)
  }
}

function generateExample(schema: Record<string, unknown>): unknown {
  if (schema.example) return schema.example
  if (schema.default) return schema.default
  const type = schema.type as string
  if (type === 'object' && schema.properties) {
    const obj: Record<string, unknown> = {}
    for (const [key, prop] of Object.entries(schema.properties as Record<string, unknown>)) {
      obj[key] = generateExample(prop as Record<string, unknown>)
    }
    return obj
  }
  if (type === 'array' && schema.items) return [generateExample(schema.items as Record<string, unknown>)]
  if (type === 'string') return schema.example ?? 'string'
  if (type === 'integer' || type === 'number') return schema.example ?? 0
  if (type === 'boolean') return schema.example ?? false
  return null
}

// ── 完整 URL ──
const fullUrl = computed(() => {
  let url = baseUrl.value.replace(/\/$/, '') + props.endpoint.path
  for (const [name, value] of Object.entries(paramValues.path)) {
    if (value) url = url.replace(`{${name}}`, encodeURIComponent(value))
  }
  const queryParts = Object.entries(paramValues.query)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  if (queryParts.length) url += '?' + queryParts.join('&')
  return url
})

// ── 发送请求 ──
const activeTab = ref(pathParams.value.length ? 'path' : queryParams.value.length ? 'query' : 'headers')
const respTab = ref('body')
const sending = ref(false)
const response = ref<TryResponse | null>(null)
const error = ref('')

const responseBodyFormatted = computed(() => {
  if (!response.value) return ''
  try { return JSON.stringify(JSON.parse(response.value.body), null, 2) }
  catch { return response.value.body }
})

async function sendRequest() {
  error.value = ''
  bodyError.value = ''
  response.value = null

  for (const p of pathParams.value) {
    if (p.required && !paramValues.path[p.name]) { error.value = `路径参数 ${p.name} 为必填项`; return }
  }
  for (const p of queryParams.value) {
    if (p.required && !paramValues.query[p.name]) { error.value = `Query 参数 ${p.name} 为必填项`; return }
  }
  if (hasBody.value && selectedContentType.value === 'application/json' && bodyValue.value.trim()) {
    try { JSON.parse(bodyValue.value) } catch { bodyError.value = 'JSON 格式错误'; return }
  }

  sending.value = true
  const startTime = performance.now()
  try {
    const headers: Record<string, string> = {}
    for (const [k, v] of headerRows.value) { if (k.trim()) headers[k.trim()] = v }
    if (cookieValue.value.trim()) headers['Cookie'] = cookieValue.value.trim()

    const fetchOptions: RequestInit = { method: props.endpoint.method.toUpperCase(), headers, mode: 'cors' }

    // 构建请求体
    if (hasBody.value) {
      if (selectedContentType.value === 'multipart/form-data') {
        const formData = new FormData()
        for (const field of formDataFields.value) {
          if (!field.name.trim()) continue
          if (field.type === 'file' && field.file) {
            formData.append(field.name, field.file)
          } else {
            formData.append(field.name, field.value)
          }
        }
        fetchOptions.body = formData
      } else if (bodyValue.value.trim()) {
        fetchOptions.body = bodyValue.value
      }
    }

    const resp = await fetch(fullUrl.value, fetchOptions)
    const endTime = performance.now()
    const text = await resp.text()
    const respHeaders: Record<string, string> = {}
    resp.headers.forEach((v, k) => { respHeaders[k] = v })
    response.value = { status: resp.status, statusText: resp.statusText, headers: respHeaders, body: text, time: Math.round(endTime - startTime), size: new TextEncoder().encode(text).length }
  } catch (e) {
    error.value = `请求失败: ${(e as Error).message}`
  } finally {
    sending.value = false
  }
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
</script>

<style lang="scss" scoped>
.try-it-out {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px 24px;
  margin-top: 24px;
}

.try-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 16px;
}

// URL 栏
.try-url-bar {
  display: flex;
  gap: 8px;
  align-items: stretch;
  margin-bottom: 8px;
}

.env-select {
  width: 130px;
  flex-shrink: 0;
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

// URL 预览
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

// Tabs
.try-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 16px;
  }

  :deep(.el-tabs__content) {
    padding: 0;
  }
}

// 参数表格
.params-table {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.params-header {
  display: grid;
  grid-template-columns: 140px 1fr 100px 1fr;
  background: #f5f7fa;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.params-row {
  display: grid;
  grid-template-columns: 140px 1fr 100px 1fr;
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
  font-weight: 500;
  color: #303133;

  .required {
    color: #f56c6c;
    margin-left: 2px;
  }
}

.col-value {
  padding-right: 16px;

  :deep(.el-input__wrapper) {
    box-shadow: 0 0 0 1px #dcdfe6 inset;
  }
}

.col-type {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 12px;
  color: #909399;
}

.col-desc {
  font-size: 13px;
  color: #909399;
}

// KV 表格（请求头）
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

// Cookie
.cookie-input {
  :deep(textarea) {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
  }
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

// 请求体
.body-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.content-type-select {
  width: 240px;
}

.body-editor {
  :deep(textarea) {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
  }
}

// form-data
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

  .field-value {
    flex: 1;
  }

  .file-upload {
    flex: 1;
  }
}

// 响应
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

.status-2xx { color: #49cc90; }
.status-3xx { color: #fca130; }
.status-4xx { color: #f93e3e; }
.status-5xx { color: #f93e3e; }
</style>
