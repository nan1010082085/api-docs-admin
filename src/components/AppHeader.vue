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
        <el-alert
          v-if="store.authLocked"
          type="warning"
          :closable="false"
          show-icon
          class="auth-alert"
          title="本地加密凭证已锁定"
          description="请到「存储」页输入口令解锁后才能使用已保存的 Token / API Key。"
        />
        <el-alert
          v-else-if="store.authStorageMessage"
          type="info"
          :closable="true"
          show-icon
          class="auth-alert"
          :title="store.authStorageMessage"
          @close="store.authStorageMessage = null"
        />
        <el-tabs v-model="authTab" class="auth-tabs">
          <el-tab-pane label="常用" name="preset">
            <el-form label-width="88px" label-position="right">
              <el-form-item label="Token">
                <el-input
                  v-model="authForm.token"
                  size="small"
                  type="password"
                  show-password
                  :disabled="store.authLocked"
                  placeholder="有值则自动带 Authorization: Bearer …"
                />
              </el-form-item>
              <el-form-item label="API Key">
                <el-input
                  v-model="authForm.apiKey"
                  size="small"
                  type="password"
                  show-password
                  :disabled="store.authLocked"
                  placeholder="有值则自动带 X-API-Key"
                />
              </el-form-item>
              <el-form-item label="Cookie">
                <el-input
                  v-model="authForm.cookie"
                  size="small"
                  type="textarea"
                  :rows="2"
                  :disabled="store.authLocked"
                  placeholder="可选；仅写入 cURL，浏览器试调请用「携带 Cookie」"
                />
              </el-form-item>
            </el-form>
            <p class="auth-hint">填了什么就固定传什么，可同时启用。更多自定义字段用 Header / Query / Body。</p>
            <p class="auth-hint">{{ storageHint }}</p>
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

          <el-tab-pane label="存储" name="storage">
            <el-form label-width="100px" label-position="right" class="storage-form">
              <el-form-item label="保存位置">
                <el-radio-group v-model="storageForm.mode" size="small" @change="onStorageModeChange">
                  <el-radio-button value="memory">仅内存</el-radio-button>
                  <el-radio-button value="session">会话</el-radio-button>
                  <el-radio-button value="local">本地</el-radio-button>
                </el-radio-group>
              </el-form-item>
              <p class="auth-hint storage-desc">{{ modeDescription }}</p>

              <el-form-item v-if="storageForm.mode === 'local'" label="口令加密">
                <el-switch v-model="storageForm.encrypt" @change="onEncryptToggle" />
                <span class="switch-label">AES-GCM（PBKDF2 派生密钥）</span>
              </el-form-item>

              <template v-if="storageForm.mode === 'local' && storageForm.encrypt">
                <el-form-item :label="store.authLocked ? '解锁口令' : '加密口令'">
                  <el-input
                    v-model="storageForm.passphrase"
                    size="small"
                    type="password"
                    show-password
                    placeholder="口令只在本标签页内存，刷新需重输"
                    @keyup.enter="onUnlockOrSetPassphrase"
                  />
                </el-form-item>
                <el-form-item v-if="!store.authLocked" label="确认口令">
                  <el-input
                    v-model="storageForm.passphraseConfirm"
                    size="small"
                    type="password"
                    show-password
                    placeholder="再次输入口令"
                  />
                </el-form-item>
                <el-form-item>
                  <el-button
                    type="primary"
                    size="small"
                    :loading="storageBusy"
                    @click="onUnlockOrSetPassphrase"
                  >
                    {{ store.authLocked ? '解锁' : store.hasAuthPassphrase ? '更新口令并重加密' : '设置口令' }}
                  </el-button>
                </el-form-item>
              </template>

              <el-form-item label="危险操作">
                <el-button type="danger" plain size="small" @click="onClearCredentials">
                  清除全部已存凭证
                </el-button>
              </el-form-item>
            </el-form>
            <p class="auth-hint">
              Hash / MD5 无法还原，不能用于试调发请求。本地加密使用口令派生密钥；口令本身永不写入磁盘。
            </p>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import AppDialog from '@/components/AppDialog.vue'
import AppIcon from '@/components/AppIcon.vue'
import { useDocsStore } from '@/stores/docs'
import { downloadOpenApiJson } from '@/utils/export'
import type { EnvKvRow } from '@/types'
import type { AuthPersistMode } from '@/utils/authStorage'
import EnvKvTable from './EnvKvTable.vue'

const store = useDocsStore()
const router = useRouter()
const route = useRoute()
const search = ref('')
const authVisible = ref(false)
const authTab = ref('preset')
const storageBusy = ref(false)

const environments = computed(() => store.activeProject?.config.environments ?? [])

const authForm = ref({
  token: '',
  apiKey: '',
  cookie: '',
  headerRows: [] as EnvKvRow[],
  queryRows: [] as EnvKvRow[],
  bodyRows: [] as EnvKvRow[],
})

const storageForm = ref({
  mode: 'session' as AuthPersistMode,
  encrypt: false,
  passphrase: '',
  passphraseConfirm: '',
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

const storageHint = computed(() => {
  if (store.authPersistMode === 'memory') {
    return '当前：仅内存保存，刷新页面后凭证清空。'
  }
  if (store.authPersistMode === 'session') {
    return '当前：会话存储（sessionStorage），关闭标签页后清除。'
  }
  if (store.authEncrypt) {
    return store.hasAuthPassphrase
      ? '当前：本地加密存储（AES-GCM），口令仅在本标签页内存。'
      : '当前：本地加密存储，需在「存储」页设置口令后才会写入磁盘。'
  }
  return '⚠️ 当前：本地明文 localStorage，请勿在共享设备上保存敏感凭证；建议开启口令加密。'
})

const modeDescription = computed(() => {
  if (storageForm.value.mode === 'memory') return '不写入浏览器存储，刷新或关掉页面即丢失。'
  if (storageForm.value.mode === 'session') return '写入 sessionStorage，仅当前标签页有效，关闭即清除（推荐默认）。'
  return '写入 localStorage，跨会话保留。强烈建议开启口令加密。'
})

watch(authVisible, (open) => {
  if (!open) return
  const env = store.activeEnvironment
  authTab.value = store.authLocked ? 'storage' : 'preset'
  authForm.value = {
    token: env?.token ?? '',
    apiKey: env?.apiKey ?? '',
    cookie: env?.cookie ?? '',
    headerRows: structuredClone(env?.headerRows ?? []),
    queryRows: structuredClone(env?.queryRows ?? []),
    bodyRows: structuredClone(env?.bodyRows ?? []),
  }
  storageForm.value = {
    mode: store.authPersistMode,
    encrypt: store.authEncrypt,
    passphrase: '',
    passphraseConfirm: '',
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
  if (store.authLocked) {
    ElMessage.warning('请先在「存储」页解锁凭证')
    authTab.value = 'storage'
    return
  }
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

async function applyStoragePrefs() {
  storageBusy.value = true
  try {
    await store.updateAuthPersistPrefs({
      mode: storageForm.value.mode,
      encrypt: storageForm.value.encrypt,
    })
    ElMessage.success('存储偏好已更新')
  } catch (e) {
    ElMessage.error((e as Error).message)
    // 回滚表单到 store 实际值
    storageForm.value.mode = store.authPersistMode
    storageForm.value.encrypt = store.authEncrypt
  } finally {
    storageBusy.value = false
  }
}

async function onStorageModeChange() {
  if (storageForm.value.mode !== 'local') {
    storageForm.value.encrypt = false
  }
  // 本地 + 加密且尚无会话口令：先落到「本地明文」偏好无效；保持表单，提示设口令
  if (storageForm.value.mode === 'local' && storageForm.value.encrypt && !store.hasAuthPassphrase) {
    ElMessage.info('请先设置加密口令，再保存为本地加密')
    return
  }
  await applyStoragePrefs()
}

async function onEncryptToggle(enabled: string | number | boolean) {
  const on = Boolean(enabled)
  if (storageForm.value.mode !== 'local') return
  if (on) {
    if (!store.hasAuthPassphrase && !storageForm.value.passphrase.trim()) {
      storageForm.value.encrypt = false
      ElMessage.info('请先填写口令并点击「设置口令」')
      return
    }
    if (storageForm.value.passphrase) {
      if (storageForm.value.passphrase !== storageForm.value.passphraseConfirm) {
        storageForm.value.encrypt = false
        ElMessage.error('两次口令不一致')
        return
      }
      try {
        await store.setAuthPassphrase(storageForm.value.passphrase)
      } catch (e) {
        storageForm.value.encrypt = false
        ElMessage.error((e as Error).message)
        return
      }
    }
  }
  await applyStoragePrefs()
}

async function onUnlockOrSetPassphrase() {
  const pass = storageForm.value.passphrase.trim()
  if (!pass) {
    ElMessage.warning('请输入口令')
    return
  }
  storageBusy.value = true
  try {
    if (store.authLocked) {
      await store.unlockAuth(pass)
      ElMessage.success('已解锁')
      storageForm.value.passphrase = ''
      storageForm.value.passphraseConfirm = ''
      // 重新灌入表单
      const env = store.activeEnvironment
      authForm.value = {
        token: env?.token ?? '',
        apiKey: env?.apiKey ?? '',
        cookie: env?.cookie ?? '',
        headerRows: structuredClone(env?.headerRows ?? []),
        queryRows: structuredClone(env?.queryRows ?? []),
        bodyRows: structuredClone(env?.bodyRows ?? []),
      }
      return
    }
    if (pass !== storageForm.value.passphraseConfirm.trim()) {
      ElMessage.error('两次口令不一致')
      return
    }
    await store.setAuthPassphrase(pass)
    storageForm.value.encrypt = true
    storageForm.value.mode = 'local'
    await store.updateAuthPersistPrefs({ mode: 'local', encrypt: true })
    ElMessage.success('口令已设置，凭证将以密文写入 localStorage')
    storageForm.value.passphrase = ''
    storageForm.value.passphraseConfirm = ''
  } catch (e) {
    ElMessage.error((e as Error).message)
  } finally {
    storageBusy.value = false
  }
}

async function onClearCredentials() {
  try {
    await ElMessageBox.confirm('将清除内存 / 会话 / 本地中的全部认证数据，且无法恢复。', '清除凭证', {
      type: 'warning',
      confirmButtonText: '清除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  store.clearAuthCredentials()
  authForm.value = {
    token: '',
    apiKey: '',
    cookie: '',
    headerRows: [],
    queryRows: [],
    bodyRows: [],
  }
  storageForm.value.passphrase = ''
  storageForm.value.passphraseConfirm = ''
  ElMessage.success('已清除全部凭证')
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

.auth-alert {
  margin-bottom: 12px;
}

.storage-form {
  :deep(.el-form-item) {
    margin-bottom: 14px;
  }
}

.storage-desc {
  margin: -4px 0 12px 100px;
}

.switch-label {
  margin-left: 8px;
  font-size: 12px;
  color: #606266;
}
</style>
