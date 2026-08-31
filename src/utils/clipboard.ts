import { ElMessage } from 'element-plus'

/**
 * 复制文本到剪贴板
 * @returns 是否复制成功
 */
export async function copyText(text: string, successMessage = '已复制'): Promise<boolean> {
  if (!text.trim()) {
    ElMessage.warning('无可复制内容')
    return false
  }
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(successMessage)
    return true
  } catch {
    ElMessage.error('复制失败')
    return false
  }
}
