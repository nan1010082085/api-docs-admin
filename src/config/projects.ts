import type { ProjectConfig } from '@/types'

/**
 * 项目配置列表
 *
 * environments: 测试环境列表，可配置 baseUrl、认证、headers、cookie
 * baseUrl 为空字符串时走同源 Vite 代理（/api → localhost:3001，仅 schema-platform）
 */
const projects: ProjectConfig[] = [
  {
    id: 'schema-platform',
    name: 'Schema Platform',
    specUrl: 'specs/schema-platform.yaml',
    description: '可视化表单设计器后端 API',
    environments: [
      { name: '本地代理', baseUrl: '', authType: 'bearer' },
      { name: '本地直连', baseUrl: 'http://localhost:3001', authType: 'bearer' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/schema-platform', authType: 'bearer' },
    ],
  },
  {
    id: 'salary-flow',
    name: 'Salary Flow',
    specUrl: 'specs/salary-flow.json',
    description: '工资流程管理系统 API',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:8000', authType: 'bearer' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/salary', authType: 'bearer' },
    ],
  },
  {
    id: 'amber-of-time',
    name: 'Amber of Time',
    specUrl: 'specs/amber-of-time.json',
    description: 'AI 网关，兼容 OpenAI API 格式',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:14091', authType: 'bearer' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/amber-of-time', authType: 'bearer' },
    ],
  },
  {
    id: 'inspiration',
    name: '灵感ing',
    specUrl: 'specs/inspiration.json',
    description: '灵感卡片应用（服务未运行）',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:19071', authType: 'bearer' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/inspiration', authType: 'bearer' },
    ],
  },
  {
    id: 'matrix-app',
    name: 'Matrix Studio',
    specUrl: 'specs/matrix-app.json',
    description: 'Matrix Studio 应用（服务未运行）',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:5001', authType: 'bearer' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/matrix-app', authType: 'bearer' },
    ],
  },
  {
    id: 'stock-analysis',
    name: 'Stock Analysis',
    specUrl: 'specs/stock-analysis.json',
    description: '股票分析应用（服务异常）',
    environments: [
      { name: '本地开发', baseUrl: 'http://localhost:5080', authType: 'bearer' },
      { name: '线上环境', baseUrl: 'https://pyflow.icu/stock-analysis', authType: 'bearer' },
    ],
  },
]

export default projects
