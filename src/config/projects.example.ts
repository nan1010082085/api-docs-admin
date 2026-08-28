import type { ProjectConfig } from '@/types'

/**
 * 项目配置列表（示例文件）
 *
 * 使用方式：
 * 1. 复制此文件为 projects.ts
 * 2. 修改为你的实际项目配置
 * 3. projects.ts 已被 .gitignore 排除，不会提交到 GitHub
 *
 * specUrl 支持：
 *   - 本地文件：'specs/xxx.json'（放在 public/specs/ 目录下）
 *   - 远程 URL：'http://server:port/openapi.json'（浏览器实时获取）
 *
 * environments: 测试环境列表，每个环境可配置 baseUrl、默认 headers、cookie
 */
const projects: ProjectConfig[] = [
  // ── 示例项目 1：本地 spec 文件 ──
  {
    id: 'my-api',
    name: 'My API',
    specUrl: 'specs/my-api.json',
    description: '我的后端 API',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:3000' },
      { name: '测试环境', baseUrl: 'https://test.example.com' },
      { name: '生产环境', baseUrl: 'https://api.example.com' },
    ],
  },

  // ── 示例项目 2：远程 spec URL ──
  {
    id: 'another-api',
    name: 'Another API',
    specUrl: 'http://your-server:8080/openapi.json',
    description: '另一个项目的 API（远程获取 spec）',
    environments: [
      { name: '生产环境', baseUrl: 'http://your-server:8080' },
    ],
  },

  // ── 在此追加更多项目 ──
]

export default projects
