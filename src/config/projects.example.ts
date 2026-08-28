import type { ProjectConfig } from '@/types'

/**
 * 项目配置列表（示例文件）
 *
 * 使用方式：
 * 1. 复制此文件为 projects.ts
 * 2. 将 OpenAPI spec 文件放到 public/specs/ 目录
 * 3. 修改下方配置指向你的 spec 文件
 * 4. pnpm build 构建部署
 *
 * 注意：specUrl 只支持本地文件（public/specs/ 下），不支持远程 URL
 */
const projects: ProjectConfig[] = [
  {
    id: 'my-api',
    name: 'My API',
    specUrl: 'specs/my-api.json',
    description: '我的后端 API',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:3000' },
      { name: '生产环境', baseUrl: 'https://api.example.com' },
    ],
  },
  // ── 在此追加更多项目 ──
]

export default projects
