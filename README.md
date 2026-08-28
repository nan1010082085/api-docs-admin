# API Docs

独立运行的 API 接口文档平台，基于 Vue 3 + Element Plus 构建。

## 特性

- 读取 OpenAPI 3.0 YAML/JSON spec
- 接口搜索与分类浏览、URL 深链
- 参数表格、Schema 展示
- **在线测试（Apifox 风格）**：Path / Query 参数表、Body 表单与 Raw、Headers、Cookie
- 环境认证（Bearer / API Key），登录成功自动写入 Token
- 本地 Vite 代理 `/api` → `localhost:3001`，避免 CORS
- 复制 cURL、导出 OpenAPI JSON（Apifox / Swagger / Postman）
- 多项目 / 多环境配置

## 快速开始

```bash
pnpm install
pnpm dev
```

访问 http://localhost:5500/schema-platform/api-docs/

默认测试环境选 **本地代理**（baseUrl 为空，请求走 Vite 代理）。

## 在线测试

1. 顶部选择环境，点击 **认证** 配置 Token / API Key（或先调登录接口自动写入）
2. 左侧选中接口后，在右侧 **Params** 填 Query/Path，**Body** 用「表单」或「JSON / Raw」
3. 发送；需要可点 **复制 cURL**

## Spec 维护

```bash
# 从 sibling server/openapi 同步
pnpm sync:openapi
pnpm bundle

# 对照 routes-report 检查文档覆盖率
pnpm check:coverage
```

## 添加新项目

编辑 `src/config/projects.ts`：

```ts
{
  id: 'my-project',
  name: 'My Project',
  specUrl: 'specs/my-project.yaml',
  description: '项目描述',
  environments: [
    { name: '本地代理', baseUrl: '', authType: 'bearer' },
  ],
}
```

## 构建部署

```bash
pnpm build
```
