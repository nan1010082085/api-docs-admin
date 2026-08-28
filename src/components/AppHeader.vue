<template>
  <header class="app-header">
    <div class="header-left">
      <h1 class="logo">📖 API Docs</h1>
      <el-select
        v-model="store.activeProjectId"
        class="project-select"
        placeholder="选择项目"
        @change="store.setActiveProject"
      >
        <el-option
          v-for="p in store.projects"
          :key="p.config.id"
          :label="p.config.name"
          :value="p.config.id"
        />
      </el-select>
      <el-select
        v-model="store.activeEnvIndex"
        class="env-select"
        placeholder="测试环境"
      >
        <el-option
          v-for="(env, idx) in environments"
          :key="idx"
          :label="env.name"
          :value="idx"
        />
        <el-option label="自定义" :value="-1" />
      </el-select>
      <el-tag v-if="store.totalEndpoints" type="info" size="small">
        {{ store.totalEndpoints }} 个接口
      </el-tag>
    </div>
    <div class="header-right">
      <el-input
        v-model="search"
        placeholder="搜索接口路径或描述..."
        clearable
        prefix-icon="Search"
        class="search-input"
        @input="onSearch"
      />
      <el-button @click="handleExport" :icon="Download">导出 JSON</el-button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Download } from '@element-plus/icons-vue'
import { useDocsStore } from '@/stores/docs'
import { downloadOpenApiJson } from '@/utils/export'

const store = useDocsStore()
const search = ref('')

const environments = computed(() => store.activeProject?.config.environments ?? [])

let timer: ReturnType<typeof setTimeout> | null = null
function onSearch(val: string) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => store.setSearch(val), 200)
}

function handleExport() {
  const project = store.activeProject
  if (project) downloadOpenApiJson(project)
}
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
}

.logo {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

.project-select {
  width: 200px;
}

.env-select {
  width: 140px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.search-input {
  width: 280px;
}
</style>
