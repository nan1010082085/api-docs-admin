/**
 * Swagger 2.0 -> OpenAPI 3.0.x 转换器
 *
 * Swagger 2.0 与 OpenAPI 3 的主要差异：
 *  - swagger: "2.0" -> openapi: "3.0.3"
 *  - host + basePath + schemes -> servers[].url
 *  - definitions -> components/schemas
 *  - parameters (top-level) -> components/parameters
 *  - responses (top-level) -> components/responses
 *  - securityDefinitions -> components/securitySchemes
 *  - body 参数 (in: body) -> requestBody
 *  - formData 参数 -> requestBody (multipart/form-data 或 urlencoded)
 *  - produces/consumes -> content 包装
 *  - response.schema -> content.application/json.schema
 *  - $ref: #/definitions/X -> #/components/schemas/X
 *  - $ref: #/parameters/X -> #/components/parameters/X
 *  - $ref: #/responses/X -> #/components/responses/X
 */

type Obj = Record<string, any>

/** 深度遍历对象，对所有 $ref 字符串做替换 */
function rewriteRefs(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj
  if (Array.isArray(obj)) return obj.map(rewriteRefs)

  const result: Obj = {}
  for (const [key, value] of Object.entries(obj)) {
    if (key === '$ref' && typeof value === 'string') {
      result[key] = (value as string)
        .replace(/^#\/definitions\//, '#/components/schemas/')
        .replace(/^#\/parameters\//, '#/components/parameters/')
        .replace(/^#\/responses\//, '#/components/responses/')
        .replace(/^#\/securityDefinitions\//, '#/components/securitySchemes/')
    } else {
      result[key] = rewriteRefs(value)
    }
  }
  return result
}

/** 构建 servers */
function buildServers(swagger: Obj): Obj[] {
  const servers: Obj[] = []
  const host = swagger.host
  if (host) {
    const schemes = (swagger.schemes as string[]) ?? ['http']
    const basePath = swagger.basePath ?? ''
    // Swagger 2.0 可有多 scheme，每个生成一个 server
    for (const scheme of schemes) {
      servers.push({ url: `${scheme}://${host}${basePath}` })
    }
  }
  return servers
}

/** 转换 securityDefinitions -> components.securitySchemes */
function convertSecurityDefs(defs: Obj | undefined): Obj | undefined {
  if (!defs) return undefined
  const result: Obj = {}
  for (const [name, def] of Object.entries(defs)) {
    const d = def as Obj
    const scheme: Obj = { description: d.description }
    if (d.type === 'basic') {
      scheme.type = 'http'
      scheme.scheme = 'basic'
    } else if (d.type === 'apiKey') {
      scheme.type = 'apiKey'
      scheme.in = d.in // header / query / (cookie in 3.x)
      scheme.name = d.name
    } else if (d.type === 'oauth2') {
      scheme.type = 'oauth2'
      if (d.flow === 'implicit' || d.flow === 'accessCode' || d.flow === 'password' || d.flow === 'application') {
        const flowName = d.flow === 'accessCode' ? 'authorizationCode' : d.flow
        const flow: Obj = {
          authorizationUrl: d.authorizationUrl,
          tokenUrl: d.tokenUrl,
          scopes: d.scopes ?? {},
        }
        scheme.flows = { [flowName]: flow }
      }
    }
    result[name] = scheme
  }
  return Object.keys(result).length ? result : undefined
}

/** 将 Swagger 2.0 operation parameters 转换为 OpenAPI 3 operation parameters + requestBody */
function convertOperation(swagger: Obj, op: Obj): Obj {
  const params: Obj[] = []
  let bodyParam: Obj | null = null
  const formDataParams: Obj[] = []

  for (const p of (op.parameters as Obj[]) ?? []) {
    const param = rewriteRefs(p) as Obj
    if (param.in === 'body') {
      bodyParam = param
    } else if (param.in === 'formData') {
      formDataParams.push(param)
    } else if (param.in === 'formData' || param.in === 'body') {
      // skip, handled above
    } else {
      // path / query / header / cookie - same structure in 3.x
      params.push(param)
    }
  }

  const result: Obj = {}
  // 复制非 parameters 字段
  for (const [key, value] of Object.entries(op)) {
    if (key === 'parameters') continue
    if (key === 'consumes') continue
    if (key === 'produces') continue
    if (key === 'responses') continue
    if (key === 'security') continue
    result[key] = value
  }

  result.parameters = params.length ? params : undefined

  // 构造 requestBody
  const consumes = (op.consumes as string[]) ?? (swagger.consumes as string[]) ?? []
  if (bodyParam) {
    const content: Obj = {}
    const mediaTypes = consumes.length ? consumes : ['application/json']
    for (const mt of mediaTypes) {
      content[mt] = { schema: bodyParam.schema ?? {} }
    }
    result.requestBody = {
      description: bodyParam.description,
      required: bodyParam.required,
      content,
    }
  } else if (formDataParams.length) {
    const content: Obj = {}
    // formData -> multipart/form-data 或 urlencoded
    const isFile = formDataParams.some((p) => p.type === 'file')
    const mediaTypes = consumes.length ? consumes : (isFile ? ['multipart/form-data'] : ['application/x-www-form-urlencoded'])
    for (const mt of mediaTypes) {
      const props: Obj = {}
      const required: string[] = []
      for (const fp of formDataParams) {
        const schema: Obj = {
          type: fp.type === 'file' ? 'string' : fp.type,
          format: fp.type === 'file' ? 'binary' : fp.format,
          description: fp.description,
          default: fp.default,
          enum: fp.enum,
        }
        // 清理 undefined
        for (const k of Object.keys(schema)) if (schema[k] === undefined) delete schema[k]
        props[fp.name] = schema
        if (fp.required) required.push(fp.name)
      }
      content[mt] = {
        schema: {
          type: 'object',
          properties: props,
          required: required.length ? required : undefined,
        },
      }
    }
    result.requestBody = { content }
  }

  // 转换 responses
  const produces = (op.produces as string[]) ?? (swagger.produces as string[]) ?? []
  const responses: Obj = {}
  for (const [code, resp] of Object.entries(op.responses ?? {})) {
    const r = rewriteRefs(resp) as Obj
    const newResp: Obj = { description: r.description ?? '' }
    if (r.schema) {
      const mediaTypes = produces.length ? produces : ['application/json']
      const content: Obj = {}
      for (const mt of mediaTypes) {
        content[mt] = { schema: r.schema }
      }
      newResp.content = content
    }
    // headers
    if (r.headers) newResp.headers = r.headers
    responses[code] = newResp
  }
  result.responses = responses

  // security 直接保留（结构兼容，只需 rewriteRefs 但 security 里无 $ref）
  result.security = op.security

  return result
}

/**
 * 主入口：检测并转换 Swagger 2.0 -> OpenAPI 3
 * 如果不是 Swagger 2.0，原样返回
 */
export function convertSwagger2ToOpenAPI3(raw: any): any {
  if (!raw || typeof raw !== 'object') return raw
  if (raw.swagger !== '2.0' && !(raw.swagger && String(raw.swagger).startsWith('2'))) {
    return raw // 已经是 OpenAPI 3.x
  }

  const swagger = raw as Obj
  const paths: Obj = {}
  const rawPaths = (swagger.paths ?? {}) as Obj

  for (const [path, pathItem] of Object.entries(rawPaths)) {
    const pi = pathItem as Obj
    const newPathItem: Obj = {}

    // path 级 parameters
    if (pi.parameters) {
      const pathLevelParams: Obj[] = []
      for (const p of pi.parameters as Obj[]) {
        const param = rewriteRefs(p) as Obj
        if (param.in !== 'body' && param.in !== 'formData') {
          pathLevelParams.push(param)
        }
      }
      if (pathLevelParams.length) newPathItem.parameters = pathLevelParams
    }

    for (const [method, op] of Object.entries(pi)) {
      if (method === 'parameters') continue
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue
      newPathItem[method] = convertOperation(swagger, op as Obj)
    }

    paths[path] = newPathItem
  }

  // 构建 components
  const components: Obj = {}
  if (swagger.definitions) {
    components.schemas = rewriteRefs(swagger.definitions)
  }
  if (swagger.parameters) {
    components.parameters = rewriteRefs(swagger.parameters)
  }
  if (swagger.responses) {
    components.responses = rewriteRefs(swagger.responses)
  }
  const secSchemes = convertSecurityDefs(swagger.securityDefinitions)
  if (secSchemes) components.securitySchemes = secSchemes

  const result: Obj = {
    openapi: '3.0.3',
    info: swagger.info ?? { title: 'API', version: '1.0.0' },
    servers: buildServers(swagger),
    tags: swagger.tags,
    paths,
    components: Object.keys(components).length ? components : undefined,
    security: swagger.security,
  }

  // 清理 undefined
  for (const k of Object.keys(result)) if (result[k] === undefined) delete result[k]

  return result
}
