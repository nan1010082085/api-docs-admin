import type { ProjectConfig } from '@/types'
import { PROJECT_DEV_PROXIES } from './devProxies'

/**
 * 项目配置列表（示例文件）
 *
 * 复制此文件为 projects.ts 并填入实际值
 * 添加新项目：
 * 1. 将 OpenAPI/Swagger 文件放到 public/specs/
 * 2. 在本数组增加一项（specUrl 仅支持本地相对路径，如 specs/xxx.json）
 * 3. 若需「本地代理」：在 devProxies.ts 登记 prefix/target，并把环境 baseUrl 设为该 prefix
 *    （Schema Platform 路径已含 /api，可继续用空 baseUrl + vite 默认 /api → 3001）
 *
 * 不支持浏览器直接拉取远程 http(s) spec（CORS）；请先下载到 public/specs/
 */
const projects: ProjectConfig[] = [
  {
    id: 'schema-platform',
    name: 'Schema Platform',
    specUrl: 'specs/schema-platform.yaml',
    description: '可视化表单设计器后端 API',
    environments: [
      { name: '本地代理', baseUrl: '' },
      { name: '本地开发', baseUrl: 'http://localhost:3001' },
      { name: '线上环境', baseUrl: 'https://your-domain.com/schema-platform' },
    ],
  },
  {
    id: 'salary-flow',
    name: 'Salary Flow',
    specUrl: 'specs/salary-flow.json',
    description: '工资流程管理系统 API',
    devProxy: PROJECT_DEV_PROXIES.salaryFlow,
    environments: [
      { name: '本地代理', baseUrl: PROJECT_DEV_PROXIES.salaryFlow.prefix },
      { name: '本地开发', baseUrl: 'http://localhost:8000' },
      { name: '线上环境', baseUrl: 'https://your-domain.com/salary' },
    ],
  },
  {
    id: 'amber-of-time',
    name: 'Amber of Time',
    specUrl: 'specs/amber-of-time.json',
    description: 'AI 网关，兼容 OpenAI API 格式',
    devProxy: PROJECT_DEV_PROXIES.amberOfTime,
    environments: [
      { name: '本地代理', baseUrl: PROJECT_DEV_PROXIES.amberOfTime.prefix },
      { name: '本地开发', baseUrl: 'http://localhost:14091' },
      { name: '线上环境', baseUrl: 'https://your-domain.com/amber-of-time' },
    ],
  },
  {
    id: 'inspiration',
    name: '灵感ing',
    specUrl: 'specs/inspiration.json',
    description: '灵感卡片应用（Docker 容器）',
    devProxy: PROJECT_DEV_PROXIES.inspiration,
    environments: [
      { name: '本地代理', baseUrl: PROJECT_DEV_PROXIES.inspiration.prefix },
      { name: '本地开发', baseUrl: 'http://localhost:19071' },
      { name: '线上环境', baseUrl: 'https://your-domain.com' },
    ],
  },
  {
    id: 'matrix-app',
    name: 'Matrix Studio',
    specUrl: 'specs/matrix-app.json',
    description: '矩阵 Matrix Studio AI 应用',
    devProxy: PROJECT_DEV_PROXIES.matrixApp,
    environments: [
      { name: '本地代理', baseUrl: PROJECT_DEV_PROXIES.matrixApp.prefix },
      { name: '本地开发', baseUrl: 'http://localhost:8001' },
      { name: '线上环境', baseUrl: 'https://your-domain.com/matrix-app/api' },
    ],
  },
  {
    id: 'stock-analysis',
    name: 'Stock Analysis',
    specUrl: 'specs/stock-analysis.json',
    description: '股票/期货四维分析盯盘工具',
    devProxy: PROJECT_DEV_PROXIES.stockAnalysis,
    environments: [
      { name: '本地代理', baseUrl: PROJECT_DEV_PROXIES.stockAnalysis.prefix },
      { name: '本地开发', baseUrl: 'http://localhost:5080' },
      { name: '线上环境', baseUrl: 'https://your-domain.com/stock-analysis' },
    ],
  },
]

export default projects