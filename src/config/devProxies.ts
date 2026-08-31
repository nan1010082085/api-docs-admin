/**
 * 开发态代理表（无路径别名，供 vite.config.ts 与 projects.ts 共用）
 * Schema Platform 路径已含 /api，继续用 vite 默认 /api → 3001，不在此表。
 */
export interface DevProxyEntry {
  prefix: string
  target: string
}

export const PROJECT_DEV_PROXIES = {
  salaryFlow: { prefix: '/__proxy/salary-flow', target: 'http://localhost:8000' },
  amberOfTime: { prefix: '/__proxy/amber-of-time', target: 'http://localhost:14091' },
  inspiration: { prefix: '/__proxy/inspiration', target: 'http://localhost:19071' },
  matrixApp: { prefix: '/__proxy/matrix-app', target: 'http://localhost:8001' },
  stockAnalysis: { prefix: '/__proxy/stock-analysis', target: 'http://localhost:5080' },
} as const satisfies Record<string, DevProxyEntry>

/** Vite 默认：Schema Platform */
export const SCHEMA_PLATFORM_API_TARGET = 'http://localhost:3001'
