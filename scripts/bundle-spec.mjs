#!/usr/bin/env node

/**
 * 将 server/openapi/ 下的多文件 OpenAPI spec 打包成单个 YAML 文件
 * 输出到 public/specs/schema-platform.yaml
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import yaml from 'js-yaml'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const SPECS_DIR = join(ROOT, 'public/specs')
const OUTPUT = join(SPECS_DIR, 'schema-platform.yaml')

// 读取各模块 YAML
function loadYaml(filename) {
  const path = join(SPECS_DIR, filename)
  if (!existsSync(path)) {
    console.warn(`⚠️  跳过不存在的文件: ${filename}`)
    return null
  }
  return yaml.load(readFileSync(path, 'utf-8'))
}

const index = loadYaml('index.yaml')
if (!index) {
  console.error('❌ index.yaml 不存在')
  process.exit(1)
}

// 读取各模块
const system = loadYaml('system.yaml')
const formDesigner = loadYaml('form-designer.yaml')
const flowEngine = loadYaml('flow-engine.yaml')
const aiCapabilities = loadYaml('ai-capabilities.yaml')
const platformExtensions = loadYaml('platform-extensions.yaml')
const components = loadYaml('components/schemas.yaml')
const security = loadYaml('components/security.yaml')
const parameters = loadYaml('components/parameters.yaml')

// 合并 paths
const paths = {}
const modules = [
  { data: system, name: 'system' },
  { data: formDesigner, name: 'form-designer' },
  { data: flowEngine, name: 'flow-engine' },
  { data: aiCapabilities, name: 'ai-capabilities' },
  { data: platformExtensions, name: 'platform-extensions' },
]

for (const mod of modules) {
  if (mod.data?.paths) {
    Object.assign(paths, mod.data.paths)
  }
}

// 合并 components
const mergedComponents = {}
if (components?.schemas) {
  mergedComponents.schemas = components.schemas
}
if (security?.securitySchemes) {
  mergedComponents.securitySchemes = security.securitySchemes
}
if (parameters?.parameters) {
  mergedComponents.parameters = parameters.parameters
}

// 组装最终 spec
const spec = {
  openapi: index.openapi || '3.0.3',
  info: index.info || { title: 'API', version: '1.0.0' },
  servers: index.servers || [],
  tags: index.tags || [],
  paths,
  components: mergedComponents,
  security: index.security || [],
}

// 写入
const output = yaml.dump(spec, { lineWidth: 120, noRefs: true })
writeFileSync(OUTPUT, output, 'utf-8')

const pathCount = Object.keys(paths).length
console.log(`✅ 打包完成: ${pathCount} 个路径 → ${OUTPUT}`)
