<template>
  <aside class="sidebar">
    <el-scrollbar>
      <div v-if="store.loading" class="sidebar-loading">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>加载中...</span>
      </div>

      <div v-else-if="store.error" class="sidebar-error">
        <el-alert :title="store.error" type="error" show-icon :closable="false" />
      </div>

      <div v-else class="sidebar-groups">
        <div v-for="group in store.filteredGroups" :key="group.name" class="group">
          <div class="group-header" @click="toggleGroup(group.name)">
            <el-icon><ArrowRight v-if="!expanded[group.name]" /><ArrowDown v-else /></el-icon>
            <span class="group-name">{{ group.name }}</span>
            <el-tag size="small" type="info">{{ group.endpoints.length }}</el-tag>
          </div>

          <div v-show="expanded[group.name]" class="group-endpoints">
            <div
              v-for="ep in group.endpoints"
              :key="ep.id"
              class="endpoint-item"
              :class="{ active: activeEndpointId === ep.id }"
              @click="selectEndpoint(ep)"
            >
              <MethodBadge :method="ep.method" />
              <div class="endpoint-info">
                <span class="endpoint-name" :title="ep.summary || ep.path">{{ ep.summary || ep.path }}</span>
                <span class="endpoint-path" :title="ep.path">{{ ep.path }}</span>
              </div>
            </div>
          </div>
        </div>

        <el-empty
          v-if="store.filteredGroups.length === 0 && store.searchQuery"
          description="未找到匹配的接口"
          :image-size="60"
        />
      </div>
    </el-scrollbar>
  </aside>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { Loading, ArrowRight, ArrowDown } from '@element-plus/icons-vue'
import { useDocsStore } from '@/stores/docs'
import MethodBadge from './MethodBadge.vue'
import type { ApiEndpoint, ApiTagGroup } from '@/types'

const store = useDocsStore()
const expanded = reactive<Record<string, boolean>>({})
const activeEndpointId = ref('')

function toggleGroup(name: string) {
  expanded[name] = !expanded[name]
}

function selectEndpoint(ep: ApiEndpoint) {
  activeEndpointId.value = ep.id
  window.dispatchEvent(new CustomEvent('endpoint-select', { detail: ep }))
}

// 默认展开第一组
store.$subscribe(() => {
  if (store.filteredGroups.length > 0 && Object.keys(expanded).length === 0) {
    for (const g of store.filteredGroups) {
      expanded[g.name] = true
    }
  }
})
</script>

<style lang="scss" scoped>
.sidebar {
  width: 320px;
  min-width: 320px;
  border-right: 1px solid #e4e7ed;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.sidebar-loading, .sidebar-error {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
}

.sidebar-groups {
  padding: 8px 0;
}

.group {
  margin-bottom: 4px;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
  font-size: 14px;
  color: #303133;

  &:hover {
    background: #f5f7fa;
  }

  .el-icon {
    font-size: 12px;
    color: #909399;
  }
}

.group-name {
  flex: 1;
}

.group-endpoints {
  padding-left: 8px;
}

.endpoint-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 16px;
  cursor: pointer;
  border-radius: 4px;
  margin: 2px 8px;

  &:hover {
    background: #f5f7fa;
  }

  &.active {
    background: #ecf5ff;

    .endpoint-name {
      color: #409eff;
    }
  }
}

.endpoint-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.endpoint-name {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.endpoint-path {
  font-family: 'SFMono-Regular', Consolas, monospace;
  font-size: 11px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
