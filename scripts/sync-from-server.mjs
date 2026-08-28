#!/usr/bin/env node

/**
 * 从 sibling server/openapi 同步 YAML 到 public/specs
 */
import { cpSync, existsSync, readdirSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SRC = join(ROOT, '../server/openapi')
const DEST = join(ROOT, 'public/specs')

if (!existsSync(SRC)) {
  console.error(`找不到 server/openapi: ${SRC}`)
  process.exit(1)
}

function copyRecursive(from, to) {
  const st = statSync(from)
  if (st.isDirectory()) {
    for (const name of readdirSync(from)) {
      if (name === 'schema-platform.yaml') continue
      copyRecursive(join(from, name), join(to, name))
    }
  } else {
    cpSync(from, to)
  }
}

copyRecursive(SRC, DEST)
console.log(`✅ 已从 server/openapi 同步到 public/specs`)
console.log('   请执行 pnpm bundle 重新打包')
