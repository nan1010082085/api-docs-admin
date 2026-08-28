import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

/**
 * 高亮代码片段（用于响应体 / cURL 预览等非 markdown 场景）
 * @param code 原始代码
 * @param lang 语言（json / xml / html / text...），空则自动检测
 */
export function highlightCode(code: string, lang?: string): string {
  if (!code) return ''
  try {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value
    }
    return hljs.highlightAuto(code).value
  } catch {
    return code
  }
}

/** 根据 Content-Type 推断语言 */
export function langFromContentType(contentType: string): string {
  if (!contentType) return ''
  if (contentType.includes('json')) return 'json'
  if (contentType.includes('xml')) return 'xml'
  if (contentType.includes('html')) return 'html'
  if (contentType.includes('text/plain')) return 'text'
  return ''
}

/** 美化 JSON 字符串（失败则原样返回） */
export function tryFormatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2)
  } catch {
    return text
  }
}
