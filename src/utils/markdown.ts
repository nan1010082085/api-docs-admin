import { marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import 'highlight.js/styles/github.css'

// 配置 marked：使用 marked-highlight 扩展（marked v18 不再支持 setOptions.highlight）
marked.use(
  markedHighlight({
    langPrefix: 'hljs language-',
    highlight(code: string, lang: string) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value
      }
      return hljs.highlightAuto(code).value
    },
  }),
)

marked.setOptions({
  breaks: true,
  gfm: true,
})

/**
 * 渲染 markdown 为 HTML（经 DOMPurify 清洗，防止 XSS）
 */
export function renderMarkdown(text: string | undefined): string {
  if (!text) return ''
  try {
    const raw = marked.parse(text) as string
    return DOMPurify.sanitize(raw, {
      ADD_ATTR: ['target'],
      ADD_TAGS: [],
    })
  } catch {
    return DOMPurify.sanitize(text)
  }
}
