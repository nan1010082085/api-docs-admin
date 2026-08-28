<template>
  <div class="welcome">
    <div class="welcome-content">
      <h2>📖 API 接口文档</h2>
      <p class="subtitle">从左侧选择一个接口查看详情</p>

      <template v-if="project">
        <div class="project-info">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="项目">{{ project.title ?? project.config.name }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ project.version ?? '-' }}</el-descriptions-item>
            <el-descriptions-item label="Base URL">
              <code>{{ project.baseUrl ?? '-' }}</code>
            </el-descriptions-item>
            <el-descriptions-item label="接口总数">
              <el-tag>{{ project.endpoints.length }}</el-tag>
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="project.description" class="project-desc markdown-body" v-html="renderMarkdown(project.description)" />
        </div>

        <div class="groups-overview">
          <h3>模块概览</h3>
          <div class="group-cards">
            <el-card
              v-for="group in project.groups"
              :key="group.name"
              shadow="hover"
              class="group-card"
            >
              <template #header>
                <div class="card-header">
                  <span class="card-title">{{ group.name }}</span>
                  <el-tag size="small" type="info">{{ group.endpoints.length }} 个接口</el-tag>
                </div>
              </template>
              <p v-if="group.description" class="card-desc">{{ group.description }}</p>
              <div class="method-stats">
                <span v-for="(count, method) in methodStats(group.endpoints)" :key="method" class="stat">
                  <MethodBadge :method="method as HttpMethod" /> {{ count }}
                </span>
              </div>
            </el-card>
          </div>
        </div>
      </template>

      <el-empty v-else-if="!store.loading" description="暂无项目数据" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDocsStore } from '@/stores/docs'
import MethodBadge from './MethodBadge.vue'
import { renderMarkdown } from '@/utils/markdown'
import type { ApiEndpoint, HttpMethod } from '@/types'

const store = useDocsStore()
const project = computed(() => store.activeProject)

function methodStats(endpoints: ApiEndpoint[]): Record<string, number> {
  const stats: Record<string, number> = {}
  for (const ep of endpoints) {
    stats[ep.method] = (stats[ep.method] ?? 0) + 1
  }
  return stats
}
</script>

<style lang="scss" scoped>
.welcome {
  display: flex;
  justify-content: center;
  padding-top: 40px;
}

.welcome-content {
  max-width: 800px;
  width: 100%;
}

h2 {
  font-size: 24px;
  color: #303133;
  margin-bottom: 8px;
}

.subtitle {
  color: #909399;
  margin-bottom: 32px;
}

.project-info {
  margin-bottom: 32px;
}

.project-desc {
  margin-top: 16px;
  font-size: 14px;
  color: #606266;
}

.groups-overview {
  h3 {
    font-size: 18px;
    color: #303133;
    margin-bottom: 16px;
  }
}

.group-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

.group-card {
  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-title {
    font-weight: 600;
  }

  .card-desc {
    font-size: 13px;
    color: #909399;
    margin-bottom: 12px;
  }
}

.method-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;

  .stat {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: #606266;
  }
}
</style>
