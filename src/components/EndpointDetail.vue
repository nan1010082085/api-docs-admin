<template>
  <div class="endpoint-detail">
    <!-- 标题行 -->
    <div class="detail-header">
      <div class="header-top">
        <div class="method-path">
          <MethodBadge :method="endpoint.method" />
          <code class="path">{{ endpoint.path }}</code>
        </div>
        <div class="view-toggle">
          <el-tooltip content="分栏视图" placement="top">
            <el-button
              :type="viewMode === 'split' ? 'primary' : 'default'"
              circle
              size="small"
              @click="viewMode = 'split'"
            >
              <AppIcon name="grid" :size="14" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="测试视图" placement="top">
            <el-button
              :type="viewMode === 'test' ? 'primary' : 'default'"
              circle
              size="small"
              @click="viewMode = 'test'"
            >
              <AppIcon name="promotion" :size="14" />
            </el-button>
          </el-tooltip>
        </div>
      </div>
      <p v-if="endpoint.summary" class="summary">{{ endpoint.summary }}</p>
      <div v-if="endpoint.description" class="description markdown-body" v-html="renderMarkdown(endpoint.description)" />
      <el-tag v-if="endpoint.deprecated" type="danger" size="small">已废弃</el-tag>
    </div>

    <!-- 分栏视图：单层面板，不再套多余 card-header -->
    <div v-if="viewMode === 'split'" class="detail-grid">
      <div class="detail-panel">
        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="请求参数" name="params">
            <ParamTable v-if="pathParams.length" title="路径参数" :params="pathParams" />
            <ParamTable v-if="queryParams.length" title="查询参数" :params="queryParams" />
            <ParamTable v-if="headerParams.length" title="请求头" :params="headerParams" />
            <el-empty v-if="!pathParams.length && !queryParams.length && !headerParams.length" description="无参数" :image-size="48" />
          </el-tab-pane>

          <el-tab-pane label="请求体" name="body">
            <div v-if="endpoint.requestBody" class="body-section">
              <div v-if="endpoint.requestBody.description" class="markdown-body" v-html="renderMarkdown(endpoint.requestBody.description)" />
              <div v-for="(media, mediaType) in endpoint.requestBody.content" :key="mediaType" class="media-section">
                <el-tag size="small" type="info">{{ mediaType }}</el-tag>
                <SchemaViewer v-if="media.schema" :schema="media.schema" />
                <ExampleBlock
                  v-if="media.schema || media.example !== undefined"
                  :media="media"
                  :content-type="String(mediaType)"
                />
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
                    <ExampleBlock
                      v-if="media.schema || media.example !== undefined"
                      :media="media"
                      :content-type="String(mediaType)"
                    />
                  </div>
                </div>
              </div>
            </div>
            <el-empty v-else description="无响应定义" :image-size="48" />
          </el-tab-pane>

          <el-tab-pane v-if="endpoint.security?.length || securitySchemes.length" label="认证" name="auth">
            <p class="auth-info">此接口需要认证，支持以下方案：</p>
            <div v-if="securitySchemes.length" class="auth-schemes">
              <div v-for="scheme in securitySchemes" :key="scheme.name" class="auth-scheme-item">
                <el-tag size="small" :type="schemeTagType(scheme.type)">{{ scheme.type }}</el-tag>
                <code class="scheme-name">{{ scheme.name }}</code>
                <span v-if="scheme.fieldName" class="scheme-field">字段: <code>{{ scheme.fieldName }}</code></span>
                <span v-if="scheme.in" class="scheme-in">位置: {{ scheme.in }}</span>
                <p v-if="scheme.description" class="scheme-desc">{{ scheme.description }}</p>
              </div>
            </div>
            <div v-else>
              <ul>
                <li v-for="(_, idx) in endpoint.security" :key="idx">
                  <el-tag size="small">Bearer Token</el-tag> 或 <el-tag size="small">API Key</el-tag>
                </li>
              </ul>
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>

      <div class="detail-panel">
        <TryItOut :endpoint="endpoint" />
      </div>
    </div>

    <!-- 测试视图（全宽） -->
    <div v-else class="detail-panel detail-full">
      <TryItOut :endpoint="endpoint" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { ApiEndpoint } from '@/types'
import { renderMarkdown } from '@/utils/markdown'
import { useDocsStore } from '@/stores/docs'
import MethodBadge from './MethodBadge.vue'
import ParamTable from './ParamTable.vue'
import SchemaViewer from './SchemaViewer.vue'
import ExampleBlock from './ExampleBlock.vue'
import TryItOut from './TryItOut.vue'

const props = defineProps<{
  endpoint: ApiEndpoint
}>()

const store = useDocsStore()

const activeTab = ref('params')
const viewMode = ref<'split' | 'test'>('split')

const pathParams = computed(() =>
  (props.endpoint.parameters ?? []).filter((p) => p.in === 'path'),
)
const queryParams = computed(() =>
  (props.endpoint.parameters ?? []).filter((p) => p.in === 'query'),
)
const headerParams = computed(() =>
  (props.endpoint.parameters ?? []).filter((p) => p.in === 'header'),
)

/** 项目级安全方案 */
const securitySchemes = computed(() => store.activeSecuritySchemes)

function schemeTagType(type: string) {
  switch (type) {
    case 'bearer': return 'warning'
    case 'apiKey': return 'info'
    case 'basic': return 'danger'
    default: return 'success'
  }
}

function statusClass(code: string) {
  const n = parseInt(code, 10)
  if (n >= 200 && n < 300) return 'status-2xx'
  if (n >= 300 && n < 400) return 'status-3xx'
  if (n >= 400 && n < 500) return 'status-4xx'
  return 'status-5xx'
}
</script>

<style lang="scss" scoped>
.endpoint-detail {
  width: 100%;
}

.detail-header {
  margin-bottom: 20px;
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.method-path {
  display: flex;
  align-items: center;
  gap: 12px;
}

.path {
  font-size: 18px;
  font-family: 'SFMono-Regular', Consolas, monospace;
  color: #303133;
}

.view-toggle {
  display: flex;
  gap: 4px;
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

// 分栏布局
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: stretch;
}

// 全宽布局
.detail-full {
  width: 100%;
}

/** 单层面板：白底描边，不再套 card-header */
.detail-panel {
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: auto;
  min-height: 0;
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

.auth-schemes {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-scheme-item {
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  background: #f5f7fa;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;

  .scheme-name {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    color: #303133;
    font-weight: 600;
  }

  .scheme-field, .scheme-in {
    font-size: 12px;
    color: #606266;

    code {
      color: #d73a49;
    }
  }

  .scheme-desc {
    width: 100%;
    font-size: 12px;
    color: #909399;
    margin: 4px 0 0;
  }
}
</style>
