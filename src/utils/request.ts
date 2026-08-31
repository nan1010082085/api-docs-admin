import type { TryResponse } from '@/types'

/** 默认请求超时（毫秒） */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000

/** 默认响应体大小上限（字节） */
export const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024

/** 执行 HTTP 请求的纯函数（从 TryItOut 抽出，便于复用与测试） */
export interface FetchRequestInput {
  method: string
  url: string
  headers: Record<string, string>
  body?: BodyInit
  credentials: RequestCredentials
  /** 超时毫秒，默认 30s */
  timeoutMs?: number
  /** 响应体上限字节，默认 2MB */
  maxBodyBytes?: number
}

/**
 * 合并 Uint8Array 分片
 */
function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

/**
 * 带超时与响应体大小上限的 fetch
 */
export async function performFetch(req: FetchRequestInput): Promise<TryResponse> {
  const timeoutMs = req.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const maxBodyBytes = req.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const startTime = performance.now()

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: req.headers,
      mode: 'cors',
      credentials: req.credentials,
      signal: controller.signal,
    }
    if (req.body !== undefined) fetchOptions.body = req.body

    const resp = await fetch(req.url, fetchOptions)
    const contentLength = resp.headers.get('content-length')
    if (contentLength) {
      const n = Number(contentLength)
      if (Number.isFinite(n) && n > maxBodyBytes) {
        controller.abort()
        throw new Error(`响应体过大（Content-Length ${n}，上限 ${maxBodyBytes} 字节）`)
      }
    }

    const text = await readBodyWithLimit(resp, maxBodyBytes)
    const endTime = performance.now()
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
  } catch (e) {
    const err = e as Error
    if (err.name === 'AbortError') {
      throw new Error(`请求超时（${timeoutMs}ms）`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 流式读取响应体，超过上限则中止
 */
async function readBodyWithLimit(resp: Response, maxBodyBytes: number): Promise<string> {
  const reader = resp.body?.getReader()
  if (!reader) {
    const text = await resp.text()
    if (new TextEncoder().encode(text).length > maxBodyBytes) {
      throw new Error(`响应体超过上限 ${maxBodyBytes} 字节`)
    }
    return text
  }

  const chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    received += value.byteLength
    if (received > maxBodyBytes) {
      await reader.cancel()
      throw new Error(`响应体超过上限 ${maxBodyBytes} 字节`)
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(concatChunks(chunks, received))
}
