<template>
  <div class="endpoint-detail">
    <!-- 标题行 -->
    <div class="detail-header">
      <div class="method-path">
        <MethodBadge :method="endpoint.method" />
        <code class="path">{{ endpoint.path }}</code>
      </div>
      <p v-if="endpoint.summary" class="summary">{{ endpoint.summary }}</p>
      <div v-if="endpoint.description" class="description markdown-body" v-html="renderMarkdown(endpoint.description)" />
      <el-tag v-if="endpoint.deprecated" type="danger" size="small">已废弃</el-tag>
    </div>

    <!-- 左右栅格：参数 + 在线测试 -->
    <div class="detail-grid">
      <!-- 左侧：参数/请求体/响应/认证 -->
      <div class="detail-card">
        <div class="card-header" @click="leftCollapsed = !leftCollapsed">
          <span>请求参数</span>
          <el-icon><ArrowDown v-if="leftCollapsed" /><ArrowUp v-else /></el-icon>
        </div>
        <div v-show="!leftCollapsed" class="card-body">
          <el-tabs v-model="activeTab" class="detail-tabs">
            <el-tab-pane label="请求参数" name="params">
              <ParamTable
                v-if="pathParams.length"
                title="路径参数"
                :params="pathParams"
              />
              <ParamTable
                v-if="queryParams.length"
                title="查询参数"
                :params="queryParams"
              />
              <ParamTable
                v-if="headerParams.length"
                title="请求头"
                :params="headerParams"
              />
              <el-empty v-if="!pathParams.length && !queryParams.length && !headerParams.length" description="无参数" :image-size="48" />
            </el-tab-pane>

            <el-tab-pane label="请求体" name="body">
              <div v-if="endpoint.requestBody" class="body-section">
                <div v-if="endpoint.requestBody.description" class="markdown-body" v-html="renderMarkdown(endpoint.requestBody.description)" />
                <div v-for="(media, mediaType) in endpoint.requestBody.content" :key="mediaType" class="media-section">
                  <el-tag size="small" type="info">{{ mediaType }}</el-tag>
                  <SchemaViewer v-if="media.schema" :schema="media.schema" />
                  <div v-if="media.example" class="example-block">
                    <h5>示例</h5>
                    <pre><code>{{ formatJson(media.example) }}</code></pre>
                  </div>
                </div>
              </div>
              <el-empty v-else description="无请求体" :image-size="48" />
            </el-tab-pane>

            <el-tab-pane label="响应" name="responses">
              <div v-if="endpoint.responses && Object.keys(endpoint.responses).length">
                <div v-for="(resp, statusCode) in endpoint.responses" :key="statusCode" class="response-section">
                  <h4>
                    <span :class="statusClass(statusCode)">{{ statusCode }}</span>
                    <span v-if="resp.description" class="resp-desc">{{ resp.description }}</span>
                  </h4>
                  <div v-if="resp.content">
                    <div v-for="(media, mediaType) in resp.content" :key="mediaType" class="media-section">
                      <el-tag size="small" type="info">{{ mediaType }}</el-tag>
                      <SchemaViewer v-if="media.schema" :schema="media.schema" />
                      <div v-if="media.example" class="example-block">
                        <h5>示例</h5>
                        <pre><code>{{ formatJson(media.example) }}</code></pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <el-empty v-else description="无响应定义" :image-size="48" />
            </el-tab-pane>

            <el-tab-pane v-if="endpoint.security?.length" label="认证" name="auth">
              <p class="auth-info">此接口需要认证。支持：</p>
              <ul>
                <li v-for="(_, idx) in endpoint.security" :key="idx">
                  <el-tag size="small">Bearer Token</el-tag> 或 <el-tag size="small">API Key</el-tag>
                </li>
              </ul>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>

      <!-- 右侧：在线测试 -->
      <div class="detail-card">
        <div class="card-header" @click="rightCollapsed = !rightCollapsed">
          <span>在线测试</span>
          <el-icon><ArrowDown v-if="rightCollapsed" /><ArrowUp v-else /></el-icon>
        </div>
        <div v-show="!rightCollapsed" class="card-body card-body-fill">
          <TryItOut :endpoint="endpoint" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import type { ApiEndpoint } from '@/types'
import { useDocsStore } from '@/stores/docs'
import { renderMarkdown } from '@/utils/markdown'
import MethodBadge from './MethodBadge.vue'
import ParamTable from './ParamTable.vue'
import SchemaViewer from './SchemaViewer.vue'
import TryItOut from './TryItOut.vue'

const props = defineProps<{
  endpoint: ApiEndpoint
}>()

const store = useDocsStore()
const activeTab = ref('params')
const leftCollapsed = ref(false)
const rightCollapsed = ref(false)

const pathParams = computed(() =>
  (props.endpoint.parameters ?? []).filter((p) => p.in === 'path'),
)
const queryParams = computed(() =>
  (props.endpoint.parameters ?? []).filter((p) => p.in === 'query'),
)
const headerParams = computed(() =>
  (props.endpoint.parameters ?? []).filter((p) => p.in === 'header'),
)

function statusClass(code: string) {
  const n = parseInt(code, 10)
  if (n >= 200 && n < 300) return 'status-2xx'
  if (n >= 300 && n < 400) return 'status-3xx'
  if (n >= 400 && n < 500) return 'status-4xx'
  return 'status-5xx'
}

function formatJson(val: unknown): string {
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}
</script>

<style lang="scss" scoped>
.endpoint-detail {
  width: 100%;
}

.detail-header {
  margin-bottom: 20px;
}

.method-path {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;

  .path {
    font-size: 18px;
    font-family: 'SFMono-Regular', Consolas, monospace;
    color: #303133;
  }
}

.summary {
  font-size: 16px;
  color: #606266;
  margin-bottom: 4px;
}

.description {
  font-size: 14px;
  color: #606266;
  margin-bottom: 8px;
}

// 栅格布局
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: stretch;
}

.detail-card {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #f5f7fa;
  border-bottom: 1px solid #e4e7ed;
  cursor: pointer;
  user-select: none;
  font-weight: 600;
  font-size: 14px;
  color: #303133;

  &:hover {
    background: #ecf5ff;
  }

  .el-icon {
    font-size: 14px;
    color: #909399;
  }
}

.card-body {
  padding: 16px;
  flex: 1;
  overflow: auto;
}

.card-body-fill {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.detail-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 12px;
  }
}

.body-section, .response-section {
  margin-bottom: 20px;
}

.media-section {
  margin-top: 12px;
}

.example-block {
  margin-top: 12px;

  h5 {
    font-size: 13px;
    color: #909399;
    margin-bottom: 8px;
  }

  pre {
    background: #f6f8fa;
    padding: 16px;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
  }
}

.response-section {
  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    span:first-child {
      font-family: 'SFMono-Regular', Consolas, monospace;
      font-weight: 700;
      font-size: 15px;
    }

    .resp-desc {
      font-weight: 400;
      color: #606266;
      font-size: 14px;
    }
  }
}

.auth-info {
  margin-bottom: 8px;
  color: #606266;
}
</style>
