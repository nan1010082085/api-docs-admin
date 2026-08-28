/**
 * 将 HTTP 请求拼成可复制的 cURL 命令
 */
export function buildCurlCommand(opts: {
  method: string
  url: string
  headers: Record<string, string>
  body?: string | null
  contentType?: string
}): string {
  const parts: string[] = [`curl -X ${opts.method.toUpperCase()}`]
  parts.push(`'${opts.url.replace(/'/g, "'\\''")}'`)

  for (const [k, v] of Object.entries(opts.headers)) {
    if (!k.trim()) continue
    // multipart 时不要手写 Content-Type（含 boundary）
    if (k.toLowerCase() === 'content-type' && opts.contentType === 'multipart/form-data') continue
    parts.push(`  -H '${k}: ${String(v).replace(/'/g, "'\\''")}'`)
  }

  if (opts.body && opts.body.trim() && opts.method.toUpperCase() !== 'GET') {
    parts.push(`  -d '${opts.body.replace(/'/g, "'\\''")}'`)
  }

  return parts.join(' \\\n')
}
