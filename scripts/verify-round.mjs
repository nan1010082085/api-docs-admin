#!/usr/bin/env node
/**
 * 单轮项目验证：冒烟 + bundle + tsc + build + coverage
 * 用法：node scripts/verify-round.mjs [roundNo]
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const round = process.argv[2] || '?'

/** @type {{ name: string, ok: boolean, detail?: string, ms: number }[]} */
const steps = []

function record(name, fn) {
  const t0 = performance.now()
  try {
    const detail = fn()
    steps.push({ name, ok: true, detail: detail || undefined, ms: Math.round(performance.now() - t0) })
  } catch (e) {
    steps.push({
      name,
      ok: false,
      detail: (e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, ' | ').slice(0, 500),
      ms: Math.round(performance.now() - t0),
    })
  }
}

async function recordAsync(name, fn) {
  const t0 = performance.now()
  try {
    const detail = await fn()
    steps.push({ name, ok: true, detail: detail || undefined, ms: Math.round(performance.now() - t0) })
  } catch (e) {
    steps.push({
      name,
      ok: false,
      detail: (e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, ' | ').slice(0, 500),
      ms: Math.round(performance.now() - t0),
    })
  }
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts,
  })
  if (r.status !== 0) {
    const err = (r.stderr || r.stdout || '').trim().split('\n').slice(-8).join('\n')
    throw new Error(`${cmd} ${args.join(' ')} exit ${r.status}\n${err}`)
  }
  return (r.stdout || '').trim()
}

function toBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}
function fromBase64(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

/** 与 authCrypto 对齐的加解密冒烟 */
async function smokeCrypto() {
  const subtle = webcrypto.subtle
  const passphrase = 'verify-round-passphrase'
  const salt = webcrypto.getRandomValues(new Uint8Array(16))
  const iv = webcrypto.getRandomValues(new Uint8Array(12))
  const baseKey = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ])
  const key = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  const payload = { token: 'secret-token', project: 'schema-platform' }
  const cipher = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  )
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
  const decoded = JSON.parse(new TextDecoder().decode(plain))
  if (decoded.token !== payload.token) throw new Error('decrypt mismatch')
  // 错误口令应失败
  const badKey = await subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 210_000, hash: 'SHA-256' },
    await subtle.importKey('raw', new TextEncoder().encode('wrong'), 'PBKDF2', false, ['deriveKey']),
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
  let rejected = false
  try {
    await subtle.decrypt({ name: 'AES-GCM', iv }, badKey, cipher)
  } catch {
    rejected = true
  }
  if (!rejected) throw new Error('wrong passphrase should fail')
  return `envelope ok salt=${toBase64(salt).slice(0, 8)}…`
}

function smokeUrlEncoded() {
  const params = new URLSearchParams()
  params.append('a', '1')
  params.append('b', 'x y')
  const s = params.toString()
  if (!s.includes('a=1') || !s.includes('b=x')) throw new Error(`bad urlencoded: ${s}`)
  return s
}

function smokeJsonPointerDecode() {
  const ref = '#/components/schemas/Foo~1Bar~0Baz'
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (parts.join(',') !== 'components,schemas,Foo/Bar~Baz') {
    throw new Error(`pointer decode fail: ${parts.join(',')}`)
  }
  return parts.join('/')
}

function smokeSpecsPresent() {
  const specsDir = join(root, 'public/specs')
  const need = [
    'schema-platform.yaml',
    'salary-flow.json',
    'amber-of-time.json',
    'inspiration.json',
    'matrix-app.json',
    'stock-analysis.json',
  ]
  const missing = need.filter((f) => !existsSync(join(specsDir, f)))
  if (missing.length) throw new Error(`missing specs: ${missing.join(', ')}`)
  const files = readdirSync(specsDir)
  return `${need.length} required present (${files.length} files)`
}

function smokeDevProxies() {
  const src = readFileSync(join(root, 'src/config/devProxies.ts'), 'utf8')
  for (const key of ['salaryFlow', 'amberOfTime', 'inspiration', 'matrixApp', 'stockAnalysis']) {
    if (!src.includes(key)) throw new Error(`devProxies missing ${key}`)
  }
  if (!src.includes('/__proxy/')) throw new Error('devProxies missing prefix')
  return '5 project proxies'
}

function smokeAuthStorageModules() {
  for (const f of ['src/utils/authCrypto.ts', 'src/utils/authStorage.ts', 'src/stores/docs.ts']) {
    if (!existsSync(join(root, f))) throw new Error(`missing ${f}`)
  }
  const storage = readFileSync(join(root, 'src/utils/authStorage.ts'), 'utf8')
  if (!storage.includes("mode: 'session'")) throw new Error('default mode should be session')
  if (!storage.includes('migrateLegacyPlainLocal')) throw new Error('missing migrate')
  return 'auth modules ok'
}

function smokeParserRefMemo() {
  const src = readFileSync(join(root, 'src/utils/parser.ts'), 'utf8')
  if (!src.includes('REF_VISITING')) throw new Error('missing REF_VISITING memo')
  if (!src.includes('~1')) throw new Error('missing JSON Pointer unescape')
  if (!src.includes('resolveRef(rawPathItem')) throw new Error('missing Path Item resolve')
  return 'parser guards ok'
}

function smokeRequestGuards() {
  const src = readFileSync(join(root, 'src/utils/request.ts'), 'utf8')
  if (!src.includes('DEFAULT_FETCH_TIMEOUT_MS')) throw new Error('missing timeout')
  if (!src.includes('DEFAULT_MAX_BODY_BYTES')) throw new Error('missing body limit')
  if (!src.includes('AbortController')) throw new Error('missing AbortController')
  return 'request guards ok'
}

function smokeYamlSpecParsable() {
  const specPath = join(root, 'public/specs/schema-platform.yaml')
  if (!existsSync(specPath)) throw new Error('run bundle first')
  const doc = yaml.load(readFileSync(specPath, 'utf8'))
  const paths = Object.keys(doc.paths || {})
  if (paths.length < 50) throw new Error(`too few paths: ${paths.length}`)
  return `${paths.length} paths`
}

// ── run ──
console.log(`\n══ Round ${round} ══`)

await recordAsync('smoke:crypto-aes-gcm', smokeCrypto)
record('smoke:urlencoded', smokeUrlEncoded)
record('smoke:json-pointer', smokeJsonPointerDecode)
record('smoke:specs-files', smokeSpecsPresent)
record('smoke:dev-proxies', smokeDevProxies)
record('smoke:auth-modules', smokeAuthStorageModules)
record('smoke:parser-ref', smokeParserRefMemo)
record('smoke:request-guards', smokeRequestGuards)

record('cmd:bundle', () => {
  run('pnpm', ['bundle'])
  return 'ok'
})
record('smoke:yaml-paths', smokeYamlSpecParsable)

record('cmd:vue-tsc', () => {
  run('pnpm', ['exec', 'vue-tsc', '-b', '--pretty', 'false'])
  return 'ok'
})

record('cmd:vite-build', () => {
  const args = ['exec', 'vite', 'build']
  const env = { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true' }
  try {
    run('pnpm', args, { env })
    return 'ok'
  } catch (e) {
    // 连续多轮构建偶发 rolldown 竞态，自动重试一次
    run('pnpm', args, { env })
    return 'ok (retry)'
  }
})

record('cmd:check-coverage', () => {
  const reportPath = join(root, 'public/specs/routes-report.json')
  if (!existsSync(reportPath)) {
    return 'SKIP: no routes-report.json（需 pnpm sync:openapi）'
  }
  const out = run('pnpm', ['exec', 'node', 'scripts/check-coverage.mjs'])
  const line = out.split('\n').filter(Boolean).slice(-1)[0] || out
  return line.replace(/[\r\n]+/g, ' ').slice(0, 120)
})

const failed = steps.filter((s) => !s.ok)
for (const s of steps) {
  const mark = s.ok ? '✓' : '✗'
  const detail = s.detail ? ` — ${s.detail.replace(/\n/g, ' | ')}` : ''
  console.log(`  ${mark} ${s.name} (${s.ms}ms)${detail}`)
}

const summary = {
  round: Number(round) || round,
  ok: failed.length === 0,
  passed: steps.filter((s) => s.ok).length,
  failed: failed.length,
  total: steps.length,
  failures: failed.map((f) => ({ name: f.name, detail: f.detail })),
}

console.log(
  `  → Round ${round}: ${summary.ok ? 'PASS' : 'FAIL'} (${summary.passed}/${summary.total})`,
)

process.stdout.write('\n__VERIFY_JSON__' + JSON.stringify(summary) + '\n')
process.exit(summary.ok ? 0 : 1)
