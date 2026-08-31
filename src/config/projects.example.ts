import type { ProjectConfig } from '@/types'

/**
 * 项目配置列表（示例文件）
 *
 * 使用方式：
 * 1. 复制此文件为 projects.ts
 * 2. 将 OpenAPI spec 放到 public/specs/
 * 3. 修改下方配置（specUrl 只支持本地相对路径，不支持远程 URL）
 * 4. 需要「本地代理」时配置 devProxy，并把环境 baseUrl 设为 prefix
 * 5. pnpm build 构建部署
 */
const projects: ProjectConfig[] = [
  {
    id: 'my-api',
    name: 'My API',
    specUrl: 'specs/my-api.json',
    description: '我的后端 API',
    devProxy: { prefix: '/__proxy/my-api', target: 'http://localhost:3000' },
    environments: [
      { name: '本地代理', baseUrl: '/__proxy/my-api' },
      { name: '本地开发', baseUrl: 'http://localhost:3000' },
      { name: '生产环境', baseUrl: 'https://api.example.com' },
    ],
  },
  // ── 在此追加更多项目 ──
]

export default projects
