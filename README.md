# API Docs

独立运行的 API 接口文档平台，基于 Vue 3 + Element Plus 构建。

## 特性

- 📖 读取 OpenAPI 3.0 YAML/JSON spec
- 🔍 接口搜索与分类浏览
- 📋 参数表格、Schema 展示
- 📥 导出标准 OpenAPI JSON（兼容 Apifox / Swagger 导入）
- 🔌 支持多项目配置，可接入不同项目的文档
- 🚀 独立部署，不依赖后端服务

## 快速开始

```bash
pnpm install
pnpm dev
```

访问 http://localhost:5500

## 添加新项目

编辑 `src/config/projects.ts`：

```ts
const projects: ProjectConfig[] = [
  {
    id: 'my-project',
    name: 'My Project',
    specUrl: '/specs/my-project.yaml',  // 放在 public/specs/ 下
    description: '项目描述',
  },
]
```

## 导出接口文档

点击右上角「导出 JSON」按钮，下载标准 OpenAPI 3.0 JSON 文件，可直接导入：
- Apifox
- Swagger Editor
- Postman

## 构建部署

```bash
pnpm build
```

产物在 `dist/` 目录，可部署到任何静态服务器。

## 目录结构

```
api-docs/
├── public/specs/          # OpenAPI spec 文件
├── scripts/bundle-spec.mjs # 打包多文件 spec 为单文件
├── src/
│   ├── config/projects.ts  # 多项目配置
│   ├── components/         # Vue 组件
│   ├── stores/docs.ts      # Pinia 状态管理
│   ├── utils/parser.ts     # OpenAPI 解析器
│   └── utils/export.ts     # 导出工具
└── package.json
```
