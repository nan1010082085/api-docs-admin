import type { ProjectConfig } from '@/types'

/**
 * 项目配置列表
 *
 * 添加新项目：在数组中增加一项即可。
 * specUrl 支持：
 *   - 本地文件：'specs/schema-platform.yaml'（放在 public/ 目录下）
 *   - 远程 URL：'http://server:3001/api/docs.json'
 *
 * environments: 测试环境列表，每个环境可配置 baseUrl、默认 headers、cookie
 */
const projects: ProjectConfig[] = [
  {
    id: 'schema-platform',
    name: 'Schema Platform',
    specUrl: 'specs/schema-platform.yaml',
    description: '可视化表单设计器后端 API',
    environments: [
      {
        name: '本地开发',
        baseUrl: 'http://localhost:3001',
      },
      {
        name: '线上环境',
        baseUrl: 'https://pyflow.icu/schema-platform',
      },
    ],
  },
  {
    id: 'salary-flow',
    name: 'Salary Flow',
    specUrl: 'specs/salary-flow.json',
    description: '工资流程管理系统 API',
    environments: [
      {
        name: '本地开发',
        baseUrl: 'http://localhost:8000',
      },
      {
        name: '线上环境',
        baseUrl: 'https://pyflow.icu/salary',
      },
    ],
  },
  // ── 在此追加更多项目 ──
]

export default projects
