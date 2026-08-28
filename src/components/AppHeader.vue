<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="logo">API Docs</h1>
      <el-select
        :model-value="store.activeProjectId"
        size="small"
        class="project-select"
        placeholder="选择项目"
        @change="onProjectChange"
      >
        <el-option
          v-for="p in store.projects"
          :key="p.config.id"
          :label="p.config.name"
          :value="p.config.id"
        />
      </el-select>
      <el-select
        :model-value="store.activeEnvIndex"
        size="small"
        class="env-select"
        placeholder="测试环境"
        @change="onEnvChange"
      >
        <el-option
          v-for="(env, idx) in environments"
          :key="idx"
          :label="env.name"
          :value="idx"
        />
        <el-option label="自定义" :value="-1" />
      </el-select>
      <el-input
        v-if="store.activeEnvIndex === -1"
        v-model="store.customBaseUrl"
        size="small"
        placeholder="自定义地址，如 http://localhost:3001"
        class="custom-url-input"
        clearable
        @change="store.persistNow()"
      />
      <el-button size="small" @click="authVisible = true">认证</el-button>
      <el-tag v-if="authSummary" type="success" size="small" effect="plain">{{ authSummary }}</el-tag>
      <el-tag v-if="store.totalEndpoints" type="info" size="small">
        {{ store.totalEndpoints }} 个接口
      </el-tag>
    </div>
    <div class="header-right">
      <el-input
        v-model="search"
        size="small"
        placeholder="搜索接口路径或描述..."
        clearable
        class="search-input"
        @input="onSearch"
      >
        <template #prefix>
          <AppIcon name="search" :size="14" />
        </template>
      </el-input>
      <el-button size="small" @click="handleExport">
        <AppIcon name="download" :size="14" style="margin-right: 4px" />
        导出 JSON
      </el-button>
    </div>

    <AppDialog
      v-model="authVisible"
      title="环境变量 / 认证"
      width="640px"
      :show-fullscreen-btn="false"
      @confirm="saveAuth"
    >
      <div class="auth-form">
        <el-tabs v-model="authTab" class="auth-tabs">
          <el-tab-pane label="常用" name="preset">
            <el-form label-width="88px" label-position="right">
              <el-form-item label="Token">
                <el-input
                  v-model="authForm.token"
                  size="small"
                  type="password"
                  show-password
                  placeholder="有值则自动带 Authorization: Bearer …"
                />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input
                  v-model="authForm.apiKey"
                  size="small"
                  type="password"
                  show-password
                  placeholder="有值则自动带 X-API-Key"
                />
              </el-form-item>
              <el-form-item label="Cookie">
                <el-input
                  v-model="authForm.cookie"
                  size="small"
                  type="textarea"
                  :rows="2"
                  placeholder="可选，key=value; ..."
                />
              </el-form-item>
            </el-form>
            <p class="auth-hint">填了什么就固定传什么，可同时启用。更多自定义字段用 Header / Query / Body。</p>
          </el-tab-pane>

          <el-tab-pane label="Header" name="header">
            <EnvKvTable v-model="authForm.headerRows" key-placeholder="Header 名" value-placeholder="值" />
            <p class="auth-hint">发送时自动附加到请求头（可与快捷认证叠加）。</p>
          </el-tab-pane>

          <el-tab-pane label="Query" name="query">
            <EnvKvTable v-model="authForm.queryRows" key-placeholder="参数名" value-placeholder="参数值" />
            <p class="auth-hint">作为当前环境的固定 Query，合并进每个请求的 URL。</p>
          </el-tab-pane>

          <el-tab-pane label="Body" name="body">
            <EnvKvTable v-model="authForm.bodyRows" key-placeholder="字段名" value-placeholder="字段值" />
            <p class="auth-hint">作为 Body 固定字段：JSON 会 merge 进对象；form / form-data 会作为字段预填。</p>
          </el-tab-pane>
        </el-tabs>
      </div>
      <template #footer>
        <el-button @click="authVisible = false">取消</el-button>
        <el-button type="primary" @click="saveAuth">保存</el-button>
      </template>
    </AppDialog>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppDialog from '@/components/AppDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useDocsStore } from '@/stores/docs'
import { downloadOpenApiJson } from '@/utils/export'
import type { EnvKvRow } from '@/types'
import EnvKvTable from './EnvKvTable.vue'

const store = useDocsStore()
const router = useRouter()
const route = useRoute()
const search = ref('')
const authVisible = ref(false)
const authTab = ref('preset')

const environments = computed(() => store.activeProject?.config.environments ?? [])

const authForm = ref({
  token: '',
  apiKey: '',
  cookie: '',
  headerRows: [] as EnvKvRow[],
  queryRows: [] as EnvKvRow[],
  bodyRows: [] as EnvKvRow[],
})

const authSummary = computed(() => {
  const env = store.activeEnvironment
  if (!env) return ''
  const parts: string[] = []
  if (env.token?.trim()) parts.push('Token')
  if (env.apiKey?.trim()) parts.push('API Key')
  if (env.cookie?.trim()) parts.push('Cookie')
  const extra =
    (env.headerRows?.filter((r) => r.enabled && r.key).length ?? 0) +
    (env.queryRows?.filter((r) => r.enabled && r.key).length ?? 0) +
    (env.bodyRows?.filter((r) => r.enabled && r.key).length ?? 0)
  if (extra) parts.push(`${extra} 自定义`)
  return parts.length ? parts.join(' · ') : ''
})

watch(authVisible, (open) => {
  if (!open) return
  const env = store.activeEnvironment
  authTab.value = 'preset'
  authForm.value = {
    token: env?.token ?? '',
    apiKey: env?.apiKey ?? '',
    cookie: env?.cookie ?? '',
    headerRows: structuredClone(env?.headerRows ?? []),
    queryRows: structuredClone(env?.queryRows ?? []),
    bodyRows: structuredClone(env?.bodyRows ?? []),
  }
})

let timer: ReturnType<typeof setTimeout> | null = null
function onSearch(val: string) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => store.setSearch(val), 200)
}

function onProjectChange(id: string) {
  store.setActiveProject(id)
  router.push({ name: 'project', params: { projectId: id } })
}

function onEnvChange(index: number) {
  store.setActiveEnvIndex(index)
}

function saveAuth() {
  store.updateActiveEnv({
    token: authForm.value.token,
    apiKey: authForm.value.apiKey,
    cookie: authForm.value.cookie,
    headerRows: authForm.value.headerRows,
    queryRows: authForm.value.queryRows,
    bodyRows: authForm.value.bodyRows,
  })
  authVisible.value = false
  ElMessage.success('已保存到当前环境')
}

function handleExport() {
  const project = store.activeProject
  if (project) downloadOpenApiJson(project)
}

watch(
  () => route.query.q,
  (q) => {
    if (typeof q === 'string' && q !== search.value) {
      search.value = q
      store.setSearch(q)
    }
  },
)
</script>

<style lang="scss" scoped>
.app-header {
  height: 56px;
  border-bottom: 1px solid #e4e7ed;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

.project-select {
  width: 180px;
  flex-shrink: 0;
}

.env-select {
  width: 120px;
  flex-shrink: 0;
}

.custom-url-input {
  width: 260px;
  flex-shrink: 0;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.search-input {
  width: 240px;
}

.auth-form {
  width: 100%;
  /* 避免 dialog overflow 裁掉控件顶边框 */
  padding: 2px;
}

.auth-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }

  :deep(.el-form-item__content) {
    flex: 1;
    min-width: 0;
  }

  :deep(.el-input),
  :deep(.el-textarea) {
    width: 100%;
  }
}

.auth-hint {
  margin-top: 10px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}
</style>
