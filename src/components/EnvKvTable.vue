<template>
  <div class="env-kv-table">
    <div class="env-kv-header">
      <span class="col-check" />
      <span class="col-key">名称</span>
      <span class="col-value">值</span>
      <span class="col-action" />
    </div>
    <div v-if="!modelValue.length" class="env-kv-empty">暂无字段，点击下方添加</div>
    <div v-for="(row, idx) in modelValue" :key="row.id" class="env-kv-row">
      <span class="col-check">
        <el-checkbox v-model="row.enabled" />
      </span>
      <div class="col-key">
        <el-input v-model="row.key" size="small" :placeholder="keyPlaceholder" />
      </div>
      <div class="col-value">
        <el-input v-model="row.value" size="small" :placeholder="valuePlaceholder" />
      </div>
      <span class="col-action">
        <el-button circle size="small" @click="remove(idx)">
          <AppIcon name="delete" :size="14" />
        </el-button>
      </span>
    </div>
    <el-button class="add-btn" size="small" @click="add">+ 添加字段</el-button>
  </div>
</template>

<script setup lang="ts">
/**
 * 环境变量键值表：Header / Query / Body 固定参数共用
 */
import AppIcon from '@/components/AppIcon.vue'
import type { EnvKvRow } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: EnvKvRow[]
    keyPlaceholder?: string
    valuePlaceholder?: string
  }>(),
  {
    keyPlaceholder: '名称',
    valuePlaceholder: '值',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: EnvKvRow[]]
}>()

let seq = 0
function nextId() {
  seq += 1
  return `kv-${Date.now()}-${seq}`
}

function add() {
  emit('update:modelValue', [
    ...props.modelValue,
    { id: nextId(), enabled: true, key: '', value: '' },
  ])
}

function remove(idx: number) {
  const next = props.modelValue.slice()
  next.splice(idx, 1)
  emit('update:modelValue', next)
}
</script>

<style lang="scss" scoped>
.env-kv-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.env-kv-header,
.env-kv-row {
  display: grid;
  grid-template-columns: 36px 1fr 1.4fr 36px;
  gap: 8px;
  align-items: center;
}

.env-kv-header {
  color: #909399;
  font-size: 12px;
  padding: 0 2px;
}

.env-kv-empty {
  color: #909399;
  font-size: 13px;
  padding: 12px 0;
}

.add-btn {
  align-self: flex-start;
}

.col-check,
.col-action {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
