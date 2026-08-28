import type { ProjectData } from '@/types'

/**
 * 将 ProjectData 导出为 OpenAPI 3.0 JSON
 * 可直接导入 Apifox / Swagger / Postman
 */
export function exportToOpenApiJson(project: ProjectData): object {
  const paths: Record<string, Record<string, unknown>> = {}

  for (const ep of project.endpoints) {
    if (!paths[ep.path]) paths[ep.path] = {}

    const operation: Record<string, unknown> = {
      summary: ep.summary,
      description: ep.description,
      tags: ep.tags,
      deprecated: ep.deprecated || undefined,
      parameters: ep.parameters?.length ? ep.parameters : undefined,
      requestBody: ep.requestBody,
      responses: ep.responses,
      security: ep.security,
    }

    // 清理 undefined
    for (const key of Object.keys(operation)) {
      if (operation[key] === undefined) delete operation[key]
    }

    paths[ep.path][ep.method] = operation
  }

  return {
    openapi: '3.0.3',
    info: {
      title: project.title ?? project.config.name,
      description: project.description ?? project.config.description,
      version: project.version ?? '1.0.0',
    },
    servers: project.baseUrl ? [{ url: project.baseUrl }] : [],
    paths,
  }
}

/** 触发浏览器下载 JSON 文件 */
export function downloadOpenApiJson(project: ProjectData): void {
  const spec = exportToOpenApiJson(project)
  const blob = new Blob([JSON.stringify(spec, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.config.id}-openapi.json`
  a.click()
  URL.revokeObjectURL(url)
}
