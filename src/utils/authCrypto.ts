/**
 * 基于 Web Crypto 的口令加密（PBKDF2 + AES-GCM）
 * 口令仅存在于内存，不落盘；用于保护 localStorage 中的凭证密文。
 */

const PBKDF2_ITERATIONS = 210_000
const SALT_BYTES = 16
const IV_BYTES = 12

/** 落盘密文信封 */
export interface EncryptedBlob {
  v: 1
  alg: 'AES-GCM'
  kdf: 'PBKDF2'
  iterations: number
  salt: string
  iv: string
  ciphertext: string
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== 'object') return false
  const o = value as Record<string, unknown>
  return (
    o.v === 1 &&
    o.alg === 'AES-GCM' &&
    typeof o.salt === 'string' &&
    typeof o.iv === 'string' &&
    typeof o.ciphertext === 'string'
  )
}

/**
 * 从口令派生 AES-GCM 密钥
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * 用口令加密任意 JSON 可序列化对象
 */
export async function encryptJson(data: unknown, passphrase: string): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt)
  const plain = new TextEncoder().encode(JSON.stringify(data))
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain)
  return {
    v: 1,
    alg: 'AES-GCM',
    kdf: 'PBKDF2',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(cipherBuf)),
  }
}

/**
 * 用口令解密信封；口令错误时抛出
 */
export async function decryptJson<T>(blob: EncryptedBlob, passphrase: string): Promise<T> {
  const salt = fromBase64(blob.salt)
  const iv = fromBase64(blob.iv)
  const key = await deriveKey(passphrase, salt)
  const cipher = fromBase64(blob.ciphertext)
  try {
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipher as BufferSource,
    )
    return JSON.parse(new TextDecoder().decode(plainBuf)) as T
  } catch {
    throw new Error('口令错误或密文已损坏')
  }
}

/** 判断字符串是否为加密信封 JSON */
export function tryParseEncryptedBlob(raw: string): EncryptedBlob | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    return isEncryptedBlob(parsed) ? parsed : null
  } catch {
    return null
  }
}
