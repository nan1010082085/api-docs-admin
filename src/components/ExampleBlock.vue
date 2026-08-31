<template>
  <div class="example-block">
    <div class="example-header">
      <h5>{{ title }}</h5>
      <el-button size="small" :disabled="!exampleText" @click="onCopy">
        <AppIcon name="document-copy" :size="14" style="margin-right: 4px" />
        复制
      </el-button>
    </div>
    <pre v-if="exampleText"><code>{{ exampleText }}</code></pre>
    <p v-else class="example-empty">无法根据 Schema 生成示例</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import { copyText } from '@/utils/clipboard'
import { getMediaExampleText, type MediaContent } from '@/utils/example'

const props = withDefaults(
  defineProps<{
    media?: MediaContent
    contentType?: string
    title?: string
  }>(),
  {
    contentType: 'application/json',
    title: '示例',
  },
)

const exampleText = computed(() => getMediaExampleText(props.media, props.contentType))

async function onCopy() {
  await copyText(exampleText.value, '示例已复制')
}
</script>

<style lang="scss" scoped>
.example-block {
  margin-top: 12px;
}

.example-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  h5 {
    font-size: 13px;
    color: #909399;
    margin: 0;
  }
}

pre {
  background: #f6f8fa;
  padding: 16px;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.example-empty {
  font-size: 13px;
  color: #c0c4cc;
  margin: 0;
}
</style>
