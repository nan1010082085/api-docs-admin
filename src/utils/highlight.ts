import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import 'highlight.js/styles/github.css'

/**
 * 高亮代码片段（用于响应体 / cURL 预览等非 markdown 场景）
 * 返回经 DOMPurify 清洗的安全 HTML；失败时返回空字符串，调用方应回退纯文本插值
 *
 * @param code 原始代码
 * @param lang 语言（json / xml / html / text...），空则自动检测
 */
export function highlightCode(code: string, lang?: string): string {
  if (!code) return ''
  try {
    const raw = lang && hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang }).value
      : hljs.highlightAuto(code).value
    // hljs 输出本身已转义 HTML 特殊字符，这里再做一层 DOMPurify 防御
    return DOMPurify.sanitize(raw)
  } catch {
    return ''
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
