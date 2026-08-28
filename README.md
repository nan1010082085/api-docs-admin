# API Docs Admin

Portal 全项目 API 接口文档管理平台。

## 接入的项目

| 项目 | 端口 | 接口数 | 说明 |
|------|------|--------|------|
| Schema Platform | 30001 | 202 | 可视化表单设计器 |
| Salary Flow | 8000 | 36 | 工资流程管理 |
| Amber of Time | 14091 | 3 | AI 网关（OpenAI 兼容） |
| 灵感ing | 19071 | 15 | 灵感卡片应用 |
| Matrix Studio | 8001 | 4 | 矩阵 AI 应用 |
| Stock Analysis | 5080 | 14 | 股票四维分析 |

## 快速开始

```bash
pnpm install
pnpm dev
```

访问 http://localhost:5500

## 接入新项目

### 方式一：本地文件

1. 将 OpenAPI spec 文件（`.yaml` 或 `.json`，支持 OpenAPI 3.x 和 Swagger 2.0）放到 `public/specs/`
2. 编辑 `src/config/projects.ts`：

```ts
{
  id: 'your-project',
  name: 'Your Project',
  specUrl: 'specs/your-api.json',
  description: '项目描述',
  environments: [
    { name: '本地开发', baseUrl: 'http://localhost:3000' },
    { name: '线上环境', baseUrl: 'https://your-domain.com' },
  ],
}
```

3. 构建部署：

```bash
pnpm build
scp -r dist/* user@server:/var/www/api-docs/
```

### 方式二：远程 URL

`specUrl` 直接指向远程地址，浏览器实时获取：

```ts
{
  id: 'your-project',
  name: 'Your Project',
  specUrl: 'http://your-server:3000/openapi.json',
  // ...
}
```

## 构建部署

```bash
# 构建
pnpm build

# 部署到服务器
scp -r dist/* ubuntu@server:~/schema-platform/apps/api-docs/
```

nginx 配置：

```nginx
location /api-docs/ {
    alias /var/www/api-docs/;
    try_files $uri $uri/ /api-docs/index.html;
}
```

## 功能

- 接口分类浏览（按 tag 分组）
- 参数表格 + Schema 展示
- Markdown 渲染（代码高亮，DOMPurify 防 XSS）
- 在线测试（环境切换、参数填充、文件上传、响应高亮、请求历史）
- 多源认证（Bearer / API Key / Basic / Cookie，自动识别 spec securitySchemes）
- 登录响应自动提取 Token（可配置 JSON 路径）
- 兼容 OpenAPI 3.x + Swagger 2.0（自动转换）
- 导出 OpenAPI JSON（兼容 Apifox / Swagger / Postman）
- 多项目切换
- 左右分栏 / 全宽测试视图

## 技术栈

- Vue 3 + TypeScript
- Element Plus 2.14.2
- Vite
- Pinia
- js-yaml + marked + marked-highlight + highlight.js + DOMPurify

## 目录结构

```
api-docs/
├── public/specs/           # OpenAPI spec 文件
├── scripts/bundle-spec.mjs # 多文件 YAML 合并脚本
├── src/
│   ├── components/         # Vue 组件
│   ├── config/projects.ts  # 多项目配置
│   ├── stores/docs.ts      # Pinia 状态管理
│   ├── utils/              # 工具函数（parser、markdown、export）
│   └── types/              # TypeScript 类型定义
└── package.json
```

## License

MIT
