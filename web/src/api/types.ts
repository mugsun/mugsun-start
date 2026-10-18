/**
 * metadata 结构贴近 Spring Initializr v2.2（Accept: application/vnd.initializr.v2.2+json）。
 * 以 `x-` 注释标出的字段是 mugsun 扩展，需要和平台后端对齐。
 */
export interface Link { href: string; templated?: boolean }

export interface SelectOption { id: string; name: string; description?: string }

export interface SingleSelect<T extends SelectOption = SelectOption> {
  type: 'single-select'
  default: string
  values: T[]
}

export interface TextField { type: 'text'; default?: string }

/** initializr 的 type 字段（action 类型）；mugsun 用它表达「生成范围」 */
export interface ProjectType extends SelectOption {
  action: string
  tags: Record<string, string>
}

export interface Dependency extends SelectOption {
  /** initializr 原生：可用的 Boot 版本范围 */
  versionRange?: string
  _links?: { reference?: Link; guide?: Link }
  /** x-mugsun 扩展：常驻模块，不可取消 */
  required?: boolean
  /** x-mugsun 扩展：Element Plus 图标名 */
  icon?: string
  /** x-mugsun 扩展：适用的生成范围（type id）；缺省为全部 */
  types?: string[]
  /** 后端可能追加的字段，前端暂时忽略 */
  alwaysOn?: boolean
  removableIn?: string[]
}

export interface DependencyGroup { name: string; values: Dependency[] }

export interface Metadata {
  _links?: Record<string, Link>
  dependencies: { type: 'hierarchical-multi-select'; values: DependencyGroup[] }
  type: { type: 'action'; default: string; values: ProjectType[] }
  packaging: SingleSelect
  javaVersion: SingleSelect
  language: SingleSelect
  bootVersion: SingleSelect
  groupId: TextField
  artifactId: TextField
  version: TextField
  name: TextField
  description: TextField
  packageName: TextField
  /** x-mugsun 扩展：数据库，一期只有 postgresql */
  database: SingleSelect
}

/** 发往 /starter.zip 的参数，与 initializr 的 query 参数同名 */
export interface ProjectRequest {
  type: string
  groupId: string
  artifactId: string
  name: string
  packageName: string
  description: string
  dependencies: string[]
  bootVersion?: string
  javaVersion?: string
  packaging?: string
  language?: string
  /** x-mugsun 扩展 */
  database: string
}

export interface GenerateResult { blob: Blob; fileName: string; requestId: string }

export class ApiError extends Error {
  constructor(message: string, public status: number, public requestId?: string) {
    super(message)
  }
}

export interface StartApi {
  getMetadata(locale: string): Promise<Metadata>
  generate(req: ProjectRequest): Promise<GenerateResult>
}
