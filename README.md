# API Docs Admin

Portal 全项目 API 接口文档管理平台（包名 `@api-docs`）。

## 接入的项目

| 项目 | 本地端口 | 本地代理前缀 | 说明 |
|------|----------|--------------|------|
| Schema Platform | 3001 | 空 baseUrl（路径含 `/api`） | 可视化表单设计器 |
| Salary Flow | 8000 | `/__proxy/salary-flow` | 工资流程管理 |
| Amber of Time | 14091 | `/__proxy/amber-of-time` | AI 网关（OpenAI 兼容） |
| 灵感ing | 19071 | `/__proxy/inspiration` | 灵感卡片应用 |
| Matrix Studio | 8001 | `/__proxy/matrix-app` | 矩阵 AI 应用 |
| Stock Analysis | 5080 | `/__proxy/stock-analysis` | 股票四维分析 |

## 快速开始

```bash
pnpm install
pnpm dev
```

访问 http://localhost:5500/schema-platform/api-docs/（Vite `base` 为 `/schema-platform/api-docs/`）。

开发态代理由 `src/config/projects.ts` 的 `devProxy` + `vite.config.ts` 自动注册；Schema Platform 额外保留 `/api → localhost:3001`。

## 接入新项目

1. 将 OpenAPI / Swagger 文件放到 `public/specs/`（仅支持本地文件，**不支持**浏览器直接拉远程 URL）
2. 编辑 `src/config/projects.ts`：

```ts
{
  id: 'your-project',
  name: 'Your Project',
  specUrl: 'specs/your-api.json',
  description: '项目描述',
  // 若路径会与其它项目的 /api 冲突，务必配置独立前缀
  devProxy: { prefix: '/__proxy/your-project', target: 'http://localhost:3000' },
  environments: [
    { name: '本地代理', baseUrl: '/__proxy/your-project' },
    { name: '本地开发', baseUrl: 'http://localhost:3000' },
    { name: '线上环境', baseUrl: 'https://your-domain.com' },
  ],
}
```

远程 OpenAPI 请先下载：

```bash
curl -o public/specs/your-api.json http://your-server:3000/openapi.json
```

## 构建部署

```bash
pnpm build
# 产物同步到线上静态目录（示例）
rsync -avz --delete dist/ ubuntu@pyflow.icu:~/schema-platform/apps/api-docs/
```

Vite `base` 为 `/schema-platform/api-docs/`，nginx 需与之对齐。`alias` + `try_files` 深链易 404，推荐 `root` + SPA fallback，或命名 location：

```nginx
location /schema-platform/api-docs/ {
    alias /home/ubuntu/schema-platform/apps/api-docs/;
    try_files $uri $uri/ @api_docs_spa;
}

location @api_docs_spa {
    rewrite ^ /schema-platform/api-docs/index.html last;
}
```

若使用 `root`（文件位于 `.../apps/api-docs/`）：

```nginx
location /schema-platform/api-docs/ {
    root /home/ubuntu/schema-platform/apps;
    try_files $uri $uri/ /schema-platform/api-docs/index.html;
}
```

## 功能

- 接口分类浏览（按 tag 分组）
- 参数表格 + Schema 展示
- Markdown 渲染（代码高亮，DOMPurify 防 XSS）
- 在线测试（环境切换、参数填充、文件上传、响应高亮、请求历史）
- 多源认证（Bearer / API Key / Cookie 说明见下）
- 登录响应自动提取 Token（可配置 JSON 路径，仅 2xx）
- 兼容 OpenAPI 3.x + Swagger 2.0（自动转换）
- 导出 OpenAPI JSON
- 多项目切换；试调超时与响应体大小上限

### Cookie 说明

浏览器禁止通过 `fetch` 设置 `Cookie` 请求头。环境 / 试调里填写的 Cookie **仅写入「复制 cURL」**；浏览器试调请勾选「携带浏览器 Cookie」，并尽量使用同源「本地代理」。

## 技术栈

- Vue 3 + TypeScript
- Element Plus
- Vite + Pinia
- js-yaml + marked + highlight.js + DOMPurify

## 安全说明

- Markdown 与响应体高亮均经 DOMPurify 清洗。
- **Token / API Key / Cookie 以明文存储在浏览器 localStorage**（键 `api-docs:env-auth`），
  仅建议在受信任的内部环境使用。

## License

MIT
