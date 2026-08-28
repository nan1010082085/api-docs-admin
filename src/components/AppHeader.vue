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
      title="环境认证"
      width="480px"
      :show-fullscreen-btn="false"
      @confirm="saveAuth"
    >
      <el-form label-width="100px">
        <el-form-item label="认证方式">
          <el-radio-group v-model="authForm.authType" size="small">
            <el-radio-button value="bearer">Bearer Token</el-radio-button>
            <el-radio-button value="apiKey">API Key</el-radio-button>
            <el-radio-button value="none">无</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="authForm.authType === 'bearer'" label="Token">
          <el-input
            v-model="authForm.token"
            type="password"
            show-password
            placeholder="粘贴 JWT（不含 Bearer 前缀）"
          />
        </el-form-item>
        <el-form-item v-if="authForm.authType === 'apiKey'" label="API Key">
          <el-input
            v-model="authForm.apiKey"
            type="password"
            show-password
            placeholder="sk-xxx"
          />
        </el-form-item>
        <el-form-item label="Cookie">
          <el-input
            v-model="authForm.cookie"
            type="textarea"
            :rows="2"
            placeholder="可选，key=value; ..."
          />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="登录接口发送成功后会自动写入 Token。推荐使用「本地代理」环境避免 CORS。"
        />
      </el-form>
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
import AppDialog from '@schema-platform/platform-shared/components/common/AppDialog.vue'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import { useDocsStore } from '@/stores/docs'
import { downloadOpenApiJson } from '@/utils/export'
import type { AuthType } from '@/types'

const store = useDocsStore()
const router = useRouter()
const route = useRoute()
const search = ref('')
const authVisible = ref(false)

const environments = computed(() => store.activeProject?.config.environments ?? [])

const authForm = ref({
  authType: 'bearer' as AuthType,
  token: '',
  apiKey: '',
  cookie: '',
})

const authSummary = computed(() => {
  const env = store.activeEnvironment
  if (!env) return ''
  const type = env.authType ?? 'bearer'
  if (type === 'bearer' && env.token) return 'Token 已配置'
  if (type === 'apiKey' && env.apiKey) return 'API Key 已配置'
  return ''
})

watch(authVisible, (open) => {
  if (!open) return
  const env = store.activeEnvironment
  authForm.value = {
    authType: env?.authType ?? 'bearer',
    token: env?.token ?? '',
    apiKey: env?.apiKey ?? '',
    cookie: env?.cookie ?? '',
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
    authType: authForm.value.authType,
    token: authForm.value.token,
    apiKey: authForm.value.apiKey,
    cookie: authForm.value.cookie,
  })
  authVisible.value = false
  ElMessage.success('认证已保存到当前环境')
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
</style>
