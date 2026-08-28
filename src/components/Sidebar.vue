<template>
  <aside class="sidebar">
    <el-scrollbar>
      <div v-if="store.loading" class="sidebar-loading">
        <AppIcon name="loading" :size="16" class="is-loading" />
        <span>加载中...</span>
      </div>

      <div v-else-if="store.error" class="sidebar-error">
        <el-alert :title="store.error" type="error" show-icon :closable="false" />
      </div>

      <div v-else class="sidebar-groups">
        <div v-for="group in store.filteredGroups" :key="group.name" class="group">
          <div class="group-header" @click="toggleGroup(group.name)">
            <AppIcon :name="expanded[group.name] ? 'arrow-down' : 'arrow-right'" :size="12" />
            <span class="group-name">{{ group.name }}</span>
            <el-tag size="small" type="info">{{ group.endpoints.length }}</el-tag>
          </div>

          <div v-show="expanded[group.name]" class="group-endpoints">
            <div
              v-for="ep in group.endpoints"
              :key="ep.id"
              class="endpoint-item"
              :class="{ active: activeEndpointId === ep.id }"
              @click="emit('select', ep)"
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
import { reactive, watch } from 'vue'
import AppIcon from '@schema-platform/platform-shared/components/common/AppIcon.vue'
import { useDocsStore } from '@/stores/docs'
import MethodBadge from './MethodBadge.vue'
import type { ApiEndpoint } from '@/types'

const props = defineProps<{
  activeEndpointId: string
}>()

const emit = defineEmits<{
  select: [ep: ApiEndpoint]
}>()

const store = useDocsStore()
const expanded = reactive<Record<string, boolean>>({})

function toggleGroup(name: string) {
  expanded[name] = !expanded[name]
}

watch(
  () => store.filteredGroups,
  (groups) => {
    if (groups.length > 0 && Object.keys(expanded).length === 0) {
      for (const g of groups) {
        expanded[g.name] = true
      }
    }
  },
  { immediate: true },
)

/** 深链选中时展开对应分组 */
watch(
  () => props.activeEndpointId,
  (id) => {
    if (!id) return
    for (const g of store.filteredGroups) {
      if (g.endpoints.some((ep) => ep.id === id)) {
        expanded[g.name] = true
        break
      }
    }
  },
)
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

.sidebar-loading,
.sidebar-error {
  padding: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;

  .is-loading {
    animation: rotating 1.5s linear infinite;
  }
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
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
