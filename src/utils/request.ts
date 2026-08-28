import type { TryResponse } from '@/types'

/** 执行 HTTP 请求的纯函数（从 TryItOut 抽出，便于复用与测试） */
export interface FetchRequestInput {
  method: string
  url: string
  headers: Record<string, string>
  body?: BodyInit
  credentials: RequestCredentials
}

export async function performFetch(req: FetchRequestInput): Promise<TryResponse> {
  const startTime = performance.now()
  const fetchOptions: RequestInit = {
    method: req.method,
    headers: req.headers,
    mode: 'cors',
    credentials: req.credentials,
  }
  if (req.body !== undefined) fetchOptions.body = req.body

  const resp = await fetch(req.url, fetchOptions)
  const endTime = performance.now()
  const text = await resp.text()
  const respHeaders: Record<string, string> = {}
  resp.headers.forEach((v, k) => {
    respHeaders[k] = v
  })

  return {
    status: resp.status,
    statusText: resp.statusText,
    headers: respHeaders,
    body: text,
    time: Math.round(endTime - startTime),
    size: new TextEncoder().encode(text).length,
  }
}
