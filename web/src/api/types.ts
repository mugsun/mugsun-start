/**
 * 接口类型，按平台后端约定 v1（start-mugsun-slices-2026-10-18.md §4）。
 * Web UI 只调用 /api/v1/* 与 /starter.zip。
 */
export type TypeId = 'mugsun-backend' | 'mugsun-fullstack' | (string & {})

/** 中英文文案对象 */
export interface L10n { zh: string; en: string }

export interface ProjectType {
  id: TypeId
  name: L10n
  description: L10n
  action: string
  tags: Record<string, string>
  default?: boolean
}

export interface FieldSpec {
  default?: string | L10n
  pattern?: string
  maxLength?: number
  required?: boolean
  /** 例如 "artifactId"、"groupId+artifactId" */
  follows?: string
}

export type FieldName = 'groupId' | 'artifactId' | 'name' | 'packageName' | 'description' | 'version'
export type Fields = Partial<Record<FieldName, FieldSpec>>

export interface Option { id: string; name: string }
export interface ReadOnlySelect { default: string; values: Option[]; readOnly?: boolean; note?: L10n }

export interface AlwaysOnModule {
  id: string
  icon?: string
  name: L10n
  description: L10n
  removableIn: string | null
}

export interface OptionalModule {
  id: string
  group?: string
  icon?: string
  name: L10n
  description: L10n
  default?: boolean
  appliesTo: TypeId[]
  requires: string[]
  conflicts: string[]
  notes?: { backendOnly?: L10n }
  links?: { reference?: string }
  maven?: { groupId: string; artifactId: string }
  pc?: { dir: string; npmRemove?: string[] }
}

export interface PostGenerate {
  requirements: Record<string, string[]>
  /** 命令中的 {artifactId} 由前端替换 */
  commands: Record<string, string[]>
  docs: string
}

export interface Metadata {
  version: string
  templates?: { boot?: string; pc?: string }
  types: ProjectType[]
  fields: Fields
  bootVersion: ReadOnlySelect
  javaVersion: ReadOnlySelect
  packaging: ReadOnlySelect
  database: ReadOnlySelect
  modules: { alwaysOn: AlwaysOnModule[]; optional: OptionalModule[] }
  postGenerate: PostGenerate
}

/** §4.2 生成参数；preview 的 JSON body 字段相同 */
export interface ProjectRequest {
  type: TypeId
  groupId: string
  artifactId: string
  name: string
  description: string
  packageName: string
  /** 可选，后端默认 0.0.1-SNAPSHOT；界面没有该输入项，因此不传 */
  version?: string
  /** 只放可选模块（gis/track/ai），常驻项不传 */
  dependencies: string[]
  baseDir?: string
  /* bootVersion/javaVersion/packaging/language/configurationFileFormat/database 一期只接受默认值，前端不传（非默认会 400 UNSUPPORTED_OPTION） */
}

/** §4.3 预览 */
export interface PreviewNode {
  name: string
  path: string
  type: 'dir' | 'file'
  size?: number
  /** S4 才有（#5 未返回）：前端只作可选装饰，不依赖 */
  module?: string | null
  /** truncated 时目录节点只给数量，不给 children */
  childCount?: number
  children?: PreviewNode[]
}

export interface PreviewResult {
  requestId: string
  root: string
  fileCount: number
  dirCount: number
  /** 始终返回，默认 false */
  truncated: boolean
  tree: PreviewNode[]
}

export interface GenerateResult { blob: Blob; fileName: string; requestId: string }

/** §4.4 错误体 */
/** §4.4 / PR #4：reason 为稳定机器码，message 已按 Accept-Language 本地化 */
export type ErrorReason = 'required' | 'pattern' | 'maxLength' | 'keyword' | 'unsupported' | 'unknown' | 'notApplicable' | 'requires' | 'conflicts' | 'invalid'
export interface ErrorDetail { field: string; reason?: ErrorReason | string; message?: string }
export interface ErrorBody { code: string; message: string; requestId?: string; timestamp?: string; details?: ErrorDetail[] }

export type ErrorCode =
  | 'INVALID_PARAMETER' | 'UNKNOWN_DEPENDENCY' | 'UNSUPPORTED_OPTION' | 'DEPENDENCY_NOT_APPLICABLE'
  | 'DEPENDENCY_CONFLICT' | 'DEPENDENCY_REQUIRES' | 'NOT_FOUND' | 'METHOD_NOT_ALLOWED' | 'RATE_LIMITED'
  | 'GENERATION_FAILED' | 'INTERNAL_ERROR' | 'TEMPLATE_UNAVAILABLE'
  /** 以下为前端自定义 */
  | 'TIMEOUT' | 'NETWORK' | 'BAD_RESPONSE' | (string & {})

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public requestId?: string,
    public details: ErrorDetail[] = [],
    /** 429 时 Retry-After 换算的秒数 */
    public retryAfter?: number
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export interface CallOptions { locale: string; signal?: AbortSignal; timeoutMs?: number }

export interface StartApi {
  getMetadata(o: CallOptions): Promise<Metadata>
  preview(req: ProjectRequest, o: CallOptions): Promise<PreviewResult>
  generate(req: ProjectRequest, o: CallOptions): Promise<GenerateResult>
}
