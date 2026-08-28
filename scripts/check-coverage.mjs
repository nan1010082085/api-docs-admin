#!/usr/bin/env node

/**
 * 对照 routes-report.json 与打包后的 OpenAPI，输出覆盖率缺口
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPECS = join(__dirname, '../public/specs')
const reportPath = join(SPECS, 'routes-report.json')
const specPath = join(SPECS, 'schema-platform.yaml')

if (!existsSync(reportPath) || !existsSync(specPath)) {
  console.error('缺少 routes-report.json 或 schema-platform.yaml，请先 pnpm bundle')
  process.exit(1)
}

const report = JSON.parse(readFileSync(reportPath, 'utf-8'))
const spec = yaml.load(readFileSync(specPath, 'utf-8'))

function norm(path) {
  return path.replace(/:([A-Za-z0-9_]+)/g, '{$1}').replace(/\/$/, '') || '/'
}

const ALIASES = [
  [/^\/api\/flow\/definitions/, '/api/flows'],
  [/^\/api\/flow\/instances/, '/api/flow-instances'],
  [/^\/api\/flow\/tasks/, '/api/flow-tasks'],
]

function aliasPath(path) {
  let p = path
  for (const [re, repl] of ALIASES) {
    if (re.test(p)) {
      p = p.replace(re, repl)
      break
    }
  }
  return p
}

function softKey(method, path) {
  return `${method} ${aliasPath(path)}`.replace(/\{[^}]+\}/g, '{*}')
}

const reportRoutes = []
for (const mod of report.modules) {
  for (const router of mod.routers) {
    for (const r of router.routes) {
      const path = norm(r.path)
      // 过滤 report 双前缀噪声
      if (path.includes('/api/') && path.indexOf('/api/') !== path.lastIndexOf('/api/')) continue
      reportRoutes.push({
        method: r.method.toLowerCase(),
        path,
        module: mod.name,
      })
    }
  }
}

const specKeys = new Set()
for (const [path, methods] of Object.entries(spec.paths || {})) {
  for (const method of Object.keys(methods)) {
    if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue
    specKeys.add(softKey(method, norm(path)))
  }
}

const missing = reportRoutes.filter((r) => !specKeys.has(softKey(r.method, r.path)))
const byMod = {}
for (const m of missing) {
  ;(byMod[m.module] ||= []).push(`${m.method.toUpperCase()} ${m.path}`)
}

console.log(`Server routes: ${reportRoutes.length}`)
console.log(`OpenAPI ops:   ${specKeys.size}`)
console.log(`Missing:       ${missing.length}`)
for (const [mod, list] of Object.entries(byMod)) {
  console.log(`\n[${mod}] ${list.length}`)
  for (const line of list.slice(0, 20)) console.log(' ', line)
  if (list.length > 20) console.log(`  ... +${list.length - 20} more`)
}

if (missing.length > 0) process.exitCode = 0
