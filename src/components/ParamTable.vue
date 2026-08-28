<template>
  <div class="param-table">
    <h4 class="table-title">{{ title }}</h4>
    <div class="table-wrapper">
      <div class="table-header">
        <span class="col-name">参数名</span>
        <span class="col-value">类型</span>
        <span class="col-required">必填</span>
        <span class="col-desc">说明</span>
      </div>
      <div v-for="param in params" :key="param.name" class="table-row">
        <span class="col-name">
          {{ param.name }}
          <span v-if="param.required" class="required">*</span>
        </span>
        <span class="col-value">
          <code>{{ param.schema?.type ?? 'any' }}</code>
          <span v-if="param.schema?.format" class="format">({{ param.schema.format }})</span>
        </span>
        <span class="col-required">
          <el-tag v-if="param.required" type="danger" size="small">是</el-tag>
          <span v-else class="optional">否</span>
        </span>
        <span class="col-desc">
          {{ param.description }}
          <el-tag v-if="param.deprecated" type="warning" size="small" style="margin-left: 8px">废弃</el-tag>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ApiParameter } from '@/types'

defineProps<{
  title: string
  params: ApiParameter[]
}>()
</script>

<style lang="scss" scoped>
.param-table {
  margin-bottom: 20px;
}

.table-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}

.table-wrapper {
  border: 1px solid #e4e7ed;
  border-radius: 6px;
  overflow: hidden;
}

.table-header {
  display: grid;
  grid-template-columns: 140px 120px 70px 1fr;
  background: #f5f7fa;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  border-bottom: 1px solid #e4e7ed;
}

.table-row {
  display: grid;
  grid-template-columns: 140px 120px 70px 1fr;
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
  code {
    font-family: 'SFMono-Regular', Consolas, monospace;
    font-size: 13px;
    color: #6f42c1;
  }

  .format {
    font-size: 12px;
    color: #909399;
    margin-left: 4px;
  }
}

.col-required {
  text-align: center;

  .optional {
    font-size: 12px;
    color: #c0c4cc;
  }
}

.col-desc {
  font-size: 13px;
  color: #606266;
}
</style>
