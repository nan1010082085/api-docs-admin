import type { ProjectConfig } from '@/types'

/**
 * 项目配置列表
 *
 * 添加新项目：在数组中增加一项即可。
 * specUrl 支持：
 *   - 本地文件：'specs/xxx.json'（放在 public/specs/ 目录下）
 *   - 远程 URL：'http://server:port/openapi.json'
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
      { name: '本地开发', baseUrl: 'http://localhost:3001' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/schema-platform' },
    ],
  },
  {
    id: 'salary-flow',
    name: 'Salary Flow',
    specUrl: 'specs/salary-flow.json',
    description: '工资流程管理系统 API',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:8000' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/salary' },
    ],
  },
  {
    id: 'amber-of-time',
    name: 'Amber of Time',
    specUrl: 'specs/amber-of-time.json',
    description: 'AI 网关，兼容 OpenAI API 格式',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:14091' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/amber-of-time' },
    ],
  },
  {
    id: 'inspiration',
    name: '灵感ing',
    specUrl: 'specs/inspiration.json',
    description: '灵感卡片应用（Docker 容器）',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:19071/inspiration/api' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/inspiration/api' },
    ],
  },
  {
    id: 'matrix-app',
    name: 'Matrix Studio',
    specUrl: 'specs/matrix-app.json',
    description: '矩阵 Matrix Studio AI 应用',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:8001' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/matrix-app/api' },
    ],
  },
  {
    id: 'stock-analysis',
    name: 'Stock Analysis',
    specUrl: 'specs/stock-analysis.json',
    description: '股票/期货四维分析盯盘工具',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:5080' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/stock-analysis' },
    ],
  },
]

export default projects
