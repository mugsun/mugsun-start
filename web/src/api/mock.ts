/**
 * 前端 mock：模拟平台后端 §4 的 HTTP 响应（mockFetch），让 http.ts 在 mock 与真接口下走同一条路径。
 * 场景用 URL 参数 ?mock=xxx（或测试里的 setMockMode）切换：
 *   meta-error    metadata 返回 503 TEMPLATE_UNAVAILABLE
 *   meta-timeout  metadata 不返回（由 10s 超时兜底）
 *   meta-loading  metadata 不返回（看骨架屏）
 *   preview-error 预览返回 500 GENERATION_FAILED
 *   gen-fail      生成返回 500 GENERATION_FAILED
 *   gen-slow      生成不返回（看「正在生成…」）
 *   gen-429       生成返回 429 RATE_LIMITED，Retry-After: 30
 *   gen-invalid   生成返回 400 INVALID_PARAMETER（groupId 与 packageName）
 *   gen-unsupported 生成返回 400 UNSUPPORTED_OPTION
 *   gen-unknown-dep 生成返回 400 UNKNOWN_DEPENDENCY
 *   gen-stack     生成返回 400 INVALID_PARAMETER（field=request），message 是英文 Java 堆栈（看前端守卫）
 *   gen-invalid-noreason 生成返回 INVALID_PARAMETER，details 只有 reason、message 为空
 *   gen-invalid-other 生成返回 400 INVALID_PARAMETER，但 field 不在表单里（baseDir）
 *   preview-body-invalid 预览返回 400 INVALID_PARAMETER，details [{field:"body",reason:"invalid"}]（#5：JSON 解析失败）
 *   gen-406 / gen-415 生成返回 406 NOT_ACCEPTABLE / 415 UNSUPPORTED_MEDIA_TYPE（#10）
 *   preview-429   预览返回 429 RATE_LIMITED，Retry-After: 30（#9 并发名额等待超时）
 *   download-429  下载返回 429 RATE_LIMITED，Retry-After: 2（#9：zip/tgz 与预览共用并发名额）
 *   preview-429-short 同上，Retry-After: 2（看倒计时结束）
 *   preview-modules 预览节点带 module（S4 计划字段，#5 不返回；默认不带）
 *   请求里出现非默认的 bootVersion/javaVersion/packaging/language/configurationFileFormat 也返回 UNSUPPORTED_OPTION
 */
import { isReservedSegment } from '../lib/validate'
import type { ErrorBody, ErrorDetail, Fields, L10n, Metadata, PreviewNode, PreviewResult, ProjectRequest } from './types'

export const MOCK_BASE = 'mock://start.mugsun.com'
let override: string | null = null
export function setMockMode(m: string | null) { override = m }
export function mockMode(): string {
  if (override !== null) return override
  if (typeof location === 'undefined') return ''
  return new URLSearchParams(location.search).get('mock') ?? ''
}

const l = (zh: string, en: string): L10n => ({ zh, en })
const DOCS = 'https://docs.mugsun.com'
const BOTH = ['mugsun-backend', 'mugsun-fullstack']

const fields: Fields = {
  groupId: { default: 'com.example', pattern: '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$', required: true },
  artifactId: { default: 'demo', pattern: '^[a-z][a-z0-9-]*$', maxLength: 50, required: true },
  name: { default: 'demo', maxLength: 50, required: true, follows: 'artifactId' },
  packageName: { default: 'com.example.demo', pattern: '^[a-z_][a-z0-9_]*(\\.[a-z_][a-z0-9_]*)*$', follows: 'groupId+artifactId' },
  description: { default: l('基于 mugsun 的管理系统', 'An admin system built on mugsun'), maxLength: 200 },
  version: { default: '0.0.1-SNAPSHOT' }
}

/** 与后端 server/src/main/resources/application.yml（mugsun-start PR #1 @e5512f5）一致 */
const pcRemove: Record<string, string[]> = { gis: ['cesium', 'ol', 'gcoord'], track: ['@mugsun/track-web', 'rrweb-player', 'source-map-js'], ai: ['vue-element-plus-x', '@vue-flow/core'] }
const refLink: Record<string, string> = { gis: `${DOCS}/boot/`, track: `${DOCS}/track/`, ai: `${DOCS}/boot/` }

export function buildMockMetadata(): Metadata {
  const opt = (id: string, group: string, icon: string, name: L10n, description: L10n, backendOnly: L10n) => ({
    id, group, icon, name, description, default: false, appliesTo: BOTH, requires: [], conflicts: [],
    notes: { backendOnly }, links: { reference: refLink[id] },
    maven: { groupId: 'com.mugsun', artifactId: `mugsun-boot-${id}` },
    pc: { dir: `modules/${id}`, npmRemove: pcRemove[id] }
  })
  const on = (id: string, icon: string, name: L10n, description: L10n, removableIn: string | null) => ({ id, icon, name, description, removableIn })
  return {
    version: '2026.10.1',
    templates: { boot: '0.1.x(tag)', pc: '0.x(tag)' },
    types: [
      { id: 'mugsun-backend', name: l('仅后端', 'Backend only'), description: l('mugsun-boot，Spring Boot 3.5、JDK 21。', 'mugsun-boot, Spring Boot 3.5, JDK 21.'), action: '/starter.zip', tags: { build: 'maven', format: 'project', scope: 'backend' } },
      { id: 'mugsun-fullstack', name: l('前后端', 'Full stack'), description: l('后端 + mugsun-pc 管理台（Vue 3）。', 'Backend plus the mugsun-pc admin console (Vue 3).'), action: '/starter.zip', tags: { build: 'maven', format: 'project', scope: 'fullstack' }, default: true }
    ],
    fields,
    bootVersion: { default: '3.5.13', values: [{ id: '3.5.13', name: '3.5.13' }], readOnly: true },
    javaVersion: { default: '21', values: [{ id: '21', name: '21' }], readOnly: true },
    packaging: { default: 'jar', values: [{ id: 'jar', name: 'Jar' }], readOnly: true },
    database: { default: 'postgresql', values: [{ id: 'postgresql', name: 'PostgreSQL' }], readOnly: true, note: l('一期仅支持 PostgreSQL', 'Phase 1 supports PostgreSQL only') },
    modules: {
      alwaysOn: [
        on('core-system', 'system', l('系统管理与多租户', 'System administration and multi-tenancy'), l('用户、角色、菜单、部门、岗位、多租户、字典与参数。', 'Users, roles, menus, departments, positions, multi-tenancy, dictionaries and parameters.'), null),
        on('core-security', 'security', l('认证与安全', 'Authentication and security'), l('登录、验证码、双因子、密码策略、国密与数据脱敏。', 'Sign-in, captcha, two-factor authentication, password policies, SM cryptography and data masking.'), null),
        on('core-audit', 'audit', l('日志与审计', 'Logging and auditing'), l('操作日志防篡改、登录日志与访问日志留存。', 'Tamper-evident operation logs, sign-in logs and access log retention.'), null),
        on('core-file-msg', 'file', l('文件与消息', 'Files and messaging'), l('文件与对象存储、短信、邮件、通知与站内信。', 'File and object storage, SMS, email, notices and in-app messages.'), null),
        on('core-workflow', 'flow', l('工作流', 'Workflow'), l('基于 warm-flow 的流程设计、审批与待办。', 'Process design, approval and to-do lists based on warm-flow.'), 'phase-2'),
        on('core-lowcode', 'lowcode', l('低代码与代码生成', 'Low-code and code generation'), l('代码生成、在线表单与表单设计器。', 'Code generation, online forms and a form designer.'), 'phase-2'),
        on('core-open', 'open', l('开放平台与社交登录', 'Open platform and social sign-in'), l('OAuth2 客户端、API Key、调用日志与第三方登录。', 'OAuth2 clients, API keys, call logs and third-party sign-in.'), 'phase-2'),
        on('core-ops', 'ops', l('定时任务与监控', 'Scheduled jobs and monitoring'), l('PowerJob 定时任务、健康检查与指标、在线用户。', 'PowerJob scheduled jobs, health checks and metrics, and online users.'), 'phase-3')
      ],
      optional: [
        opt('gis', 'geo', 'map', l('GIS', 'GIS'), l('地图、图层、地理围栏。', 'Maps, layers and geofences.'), l('仅后端时只含 REST 接口。', 'Backend only includes the REST API.')),
        opt('track', 'analytics', 'track', l('埋点', 'Analytics'), l('浏览器埋点 SDK 与分析看板。', 'A browser tracking SDK and an analytics dashboard.'), l('仅后端时只含采集与查询接口，看板需要前后端或自建前端。', 'Backend only includes the collection and query APIs. The dashboard requires the full stack or your own frontend.')),
        opt('ai', 'ai', 'ai', l('AI', 'AI'), l('模型接入、对话、知识库。', 'Model integration, chat and knowledge bases.'), l('仅后端时只含 REST 接口。', 'Backend only includes the REST API.'))
      ]
    },
    postGenerate: {
      requirements: { 'mugsun-backend': ['JDK 21', 'Maven 3.9+', 'Docker'], 'mugsun-fullstack': ['JDK 21', 'Maven 3.9+', 'Docker', 'Node.js 22.13+', 'pnpm 11+'] },
      commands: {
        'mugsun-backend': ['unzip {artifactId}.zip && cd {artifactId}', 'docker compose up -d', './mvnw spring-boot:run'],
        'mugsun-fullstack': ['unzip {artifactId}.zip && cd {artifactId}', 'docker compose up -d', './mvnw spring-boot:run', 'cd {artifactId}-pc && pnpm install && pnpm dev']
      },
      docs: `${DOCS}/guide/quick-start`
    }
  }
}

/* ---------- 预览：与 §4.2 zip 目录结构一致 ---------- */
function pascal(s: string) {
  return s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('') || 'Demo'
}

/** 返回 [路径, 来源模块] 列表 */
export function previewPaths(req: ProjectRequest): [string, string | null][] {
  const root = req.baseDir || req.artifactId || 'demo'
  const pkg = (req.packageName || 'com.example.demo').replace(/\./g, '/')
  const app = `${pascal(req.artifactId || 'demo')}Application`
  const out: [string, string | null][] = [
    'pom.xml', 'mvnw', 'mvnw.cmd', '.mvn/wrapper/maven-wrapper.properties',
    `src/main/java/${pkg}/${app}.java`, 'src/main/resources/application.yml', `src/test/java/${pkg}/${app}Tests.java`,
    'config/application-local.yml.example', 'docker-compose.yml', 'docker/postgres/init.sql',
    'README.md', 'README_EN.md', '.gitignore', 'LICENSE-THIRD-PARTY.md'
  ].map((p) => [`${root}/${p}`, null])
  if (req.type === 'mugsun-fullstack') {
    const pc = `${root}/${req.artifactId || 'demo'}-pc`
    for (const p of ['package.json', 'index.html', 'vite.config.ts', 'tsconfig.json', '.env', '.env.production',
      'src/main.ts', 'src/App.vue', 'src/router/index.ts', 'src/router/modules/system.ts', 'src/modules/flags.ts',
      'src/views/system/user/index.vue', 'src/views/system/role/index.vue', 'src/views/system/menu/index.vue',
      'src/views/system/flow-def/index.vue', 'src/views/system/gen/index.vue', 'src/locales/langs/zh.json', 'src/locales/langs/en.json']) out.push([`${pc}/${p}`, null])
    for (const m of req.dependencies) for (const p of ['routes.ts', 'api.ts', 'views/index.vue']) out.push([`${pc}/modules/${m}/${p}`, m])
  }
  return out
}

/** 路径列表 → §4.3 的树（目录在前，同类按名称升序） */
export function toTree(entries: [string, string | null][], withModules = false): PreviewNode[] {
  const root: PreviewNode = { name: '', path: '', type: 'dir', children: [] }
  for (const [p, mod] of entries) {
    const parts = p.split('/')
    let cur = root
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/')
      const isFile = i === parts.length - 1
      let next = cur.children!.find((c) => c.name === name)
      if (!next) {
        next = isFile ? { name, path, type: 'file', size: 1024, ...(withModules && mod ? { module: mod } : {}) } : { name, path, type: 'dir', children: [] }
        cur.children!.push(next)
      }
      // 模块独占目录（modules/<f>）标上模块
      if (withModules && !isFile && mod && path.endsWith(`/modules/${mod}`)) next.module = mod
      cur = next
    })
  }
  const sort = (n: PreviewNode[]) => {
    n.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
    n.forEach((c) => c.children && sort(c.children))
  }
  sort(root.children!)
  return root.children!
}

/** 对齐 #5 PreviewController：{requestId, root, fileCount, dirCount, truncated, tree}；节点 name/path/type/size，无 module */
export function buildPreview(req: ProjectRequest, requestId: string, withModules = false): PreviewResult {
  const entries = previewPaths(req)
  const tree = toTree(entries, withModules)
  let dirs = 0
  const walk = (n: PreviewNode[]) => n.forEach((x) => { if (x.type === 'dir') { dirs++; walk(x.children ?? []) } })
  walk(tree)
  return { requestId, root: req.baseDir || req.artifactId, fileCount: entries.length, dirCount: dirs, truncated: false, tree }
}

/* ---------- 服务端校验（模拟 S3，对齐 mugsun-start PR #4 @ff7a5a6 的 ProjectRequestValidator 与 messages*.properties） ---------- */
/** detail 文案：先找 detail.<field>.<reason>，再找 detail.<reason>；{0} {1} 为参数 */
const DETAIL: Record<string, L10n> = {
  required: l('此项为必填项。', 'This field is required.'),
  maxLength: l('最长 {0} 个字符。', 'Up to {0} characters.'),
  pattern: l('格式不正确。', 'The format is invalid.'),
  unsupported: l('一期不支持取值 {0}。', 'The value {0} is not supported in phase 1.'),
  unknown: l('未知的模块 {0}。', 'Unknown module {0}.'),
  notApplicable: l('模块 {0} 不适用于生成范围 {1}。', 'The module {0} does not apply to the project type {1}.'),
  'groupId.required': l('Group 为必填项。', 'The group is required.'),
  'groupId.pattern': l('Group 只能包含小写字母、数字、下划线和点，且不能以数字开头。', 'The group can only contain lowercase letters, digits, underscores and dots, and cannot start with a digit.'),
  'artifactId.required': l('Artifact 为必填项。', 'The artifact is required.'),
  'artifactId.pattern': l('Artifact 只能包含小写字母、数字和连字符，且须以字母开头，最长 50 个字符。', 'The artifact can only contain lowercase letters, digits and hyphens, must start with a letter and can be up to 50 characters.'),
  'artifactId.maxLength': l('Artifact 只能包含小写字母、数字和连字符，且须以字母开头，最长 50 个字符。', 'The artifact can only contain lowercase letters, digits and hyphens, must start with a letter and can be up to 50 characters.'),
  'name.required': l('项目名称为必填项，最长 50 个字符。', 'The project name is required and can be up to 50 characters.'),
  'name.maxLength': l('项目名称为必填项，最长 50 个字符。', 'The project name is required and can be up to 50 characters.'),
  'packageName.pattern': l('包名须由小写字母、数字和下划线组成的段以点连接，各段不能以数字开头。', 'The package name must be dot-separated segments of lowercase letters, digits and underscores that do not start with a digit.'),
  'packageName.keyword': l('包名中的 {0} 是 Java 关键字或保留字面量，不能用作包名的一段。', 'The segment {0} is a Java keyword or literal and cannot be used in a package name.'),
  'description.maxLength': l('描述最长 200 个字符。', 'The description can be up to 200 characters.'),
  'baseDir.pattern': l('根目录名只能包含字母、数字、点、下划线和连字符，最长 64 个字符。', 'The root folder name can only contain letters, digits, dots, underscores and hyphens, up to 64 characters.'),
  'body.invalid': l('请求体不是有效的 JSON，或字段类型不正确。', 'The request body is not valid JSON, or a field has the wrong type.')
}
const ERROR: Record<string, L10n> = {
  INVALID_PARAMETER: l('请求参数不符合要求，请检查标出的字段。', 'Some parameters are invalid. Check the fields listed in details.'),
  UNKNOWN_DEPENDENCY: l('未知的模块：{0}。', 'Unknown module: {0}.'),
  UNSUPPORTED_OPTION: l('一期不支持该选项：{0}。', 'This option is not supported in phase 1: {0}.'),
  DEPENDENCY_NOT_APPLICABLE: l('所选模块不适用于当前生成范围：{0}。', 'The selected module does not apply to this project type: {0}.'),
  RATE_LIMITED: l('请求过于频繁，请在 {0} 秒后重试。', 'Too many requests. Try again in {0} seconds.'),
  GENERATION_FAILED: l('生成失败，请稍后重试。反馈问题时请附上请求编号。', 'Generation failed. Try again later, and include the request ID if you report the problem.'),
  TEMPLATE_UNAVAILABLE: l('模板暂不可用，请稍后重试。', 'The template is unavailable. Try again later.'),
  NOT_FOUND: l('请求的地址不存在。', 'The requested resource does not exist.'),
  NOT_ACCEPTABLE: l('无法按请求的格式返回结果，请接受 JSON 格式的响应。', "The response can't be returned in the requested format. Accept a JSON response."),
  UNSUPPORTED_MEDIA_TYPE: l('不支持该请求体格式。', "This request body format isn't supported.")
}
const fmt = (s: string, args: unknown[]) => s.replace(/\{(\d)\}/g, (_m, i) => String(args[Number(i)] ?? ''))
type Problem = { field: string; reason: string; args?: unknown[] }
function detail(p: Problem, lang: 'zh' | 'en'): ErrorDetail {
  const tpl = DETAIL[`${p.field}.${p.reason}`] ?? DETAIL[p.reason]
  return { field: p.field, reason: p.reason, message: tpl ? fmt(tpl[lang], p.args ?? []) : p.reason }
}
/** 与后端 ErrorResponses#body 一致：INVALID_PARAMETER 只有一项时 message 取该项，否则取错误码文案 */
function problemResponse(status: number, code: string, problems: Problem[], lang: 'zh' | 'en', id: string, extra: Record<string, string> = {}) {
  // #10：每个 429 都带 Retry-After，缺省 1 秒
  if (status === 429 && extra['Retry-After'] === undefined) extra = { ...extra, 'Retry-After': '1' }
  const details = problems.map((p) => detail(p, lang))
  const joined = [...new Set(problems.map((p) => String(p.args?.[0] ?? p.field)))].join(', ')
  const message = code === 'INVALID_PARAMETER' && details.length === 1 ? (details[0].message ?? '') : fmt((ERROR[code] ?? l(code, code))[lang], [extra['Retry-After'] ?? joined])
  const body: ErrorBody = { code, message, requestId: id, timestamp: new Date().toISOString(), details }
  return json(status, body, id, extra)
}

/** 字段校验（INVALID_PARAMETER），顺序与后端一致 */
export function validateRequest(req: ProjectRequest, lang: 'zh' | 'en'): ErrorDetail[] {
  return fieldProblems(req).map((p) => detail(p, lang))
}
function fieldProblems(req: ProjectRequest): Problem[] {
  const out: Problem[] = []
  const r = req as unknown as Record<string, unknown>
  for (const f of ['groupId', 'artifactId', 'name', 'description'] as const) {
    const spec = fields[f]!
    const v = String(r[f] ?? '')
    if (!v.trim()) { if (spec.required) out.push({ field: f, reason: 'required' }); continue }
    if (spec.maxLength !== undefined && v.length > spec.maxLength) out.push({ field: f, reason: 'maxLength', args: [spec.maxLength] })
    else if (spec.pattern && !new RegExp(spec.pattern).test(v)) out.push({ field: f, reason: 'pattern' })
  }
  const pkg = String(r.packageName ?? '')
  if (pkg) {
    if (!new RegExp(fields.packageName!.pattern!).test(pkg)) out.push({ field: 'packageName', reason: 'pattern' })
    else { const seg = pkg.split('.').find(isReservedSegment); if (seg) out.push({ field: 'packageName', reason: 'keyword', args: [seg] }) }
  }
  const base = String(r.baseDir ?? '')
  if (base && (!/^[A-Za-z0-9._-]{1,64}$/.test(base) || base.includes('..'))) out.push({ field: 'baseDir', reason: 'pattern' })
  return out
}

/** 一期只接受默认值的参数（§4.2）；传了非默认值返回 UNSUPPORTED_OPTION */
const FIXED_OPTIONS: Record<string, string> = { language: 'java', configurationFileFormat: 'yaml', bootVersion: '3.5.13', javaVersion: '21', packaging: 'jar', database: 'postgresql' }
export function unsupportedOptions(req: ProjectRequest): Problem[] {
  const r = req as unknown as Record<string, unknown>
  const out: Problem[] = []
  if (r.type && !BOTH.includes(String(r.type))) out.push({ field: 'type', reason: 'unsupported', args: [r.type] })
  for (const [k, v] of Object.entries(FIXED_OPTIONS)) if (r[k] !== undefined && r[k] !== '' && r[k] !== v) out.push({ field: k, reason: 'unsupported', args: [r[k]] })
  return out
}
function dependencyProblems(req: ProjectRequest): [string, Problem[]] | null {
  const m = buildMockMetadata()
  const always = new Set(m.modules.alwaysOn.map((d) => d.id))
  const opt = new Map(m.modules.optional.map((d) => [d.id, d]))
  const ids = req.dependencies.map((d) => d.trim()).filter((d) => d && !always.has(d))
  const unknown = ids.filter((d) => !opt.has(d))
  if (unknown.length) return ['UNKNOWN_DEPENDENCY', unknown.map((d) => ({ field: 'dependencies', reason: 'unknown', args: [d] }))]
  const type = req.type || 'mugsun-fullstack'
  const na = ids.filter((d) => !opt.get(d)!.appliesTo.includes(type))
  if (na.length) return ['DEPENDENCY_NOT_APPLICABLE', na.map((d) => ({ field: 'dependencies', reason: 'notApplicable', args: [d, type] }))]
  return null
}
/** 后端顺序：INVALID_PARAMETER → UNSUPPORTED_OPTION → UNKNOWN_DEPENDENCY → DEPENDENCY_NOT_APPLICABLE */
function serverCheck(req: ProjectRequest, lang: 'zh' | 'en', id: string): Response | null {
  const invalid = fieldProblems(req)
  if (invalid.length) return problemResponse(400, 'INVALID_PARAMETER', invalid, lang, id)
  const unsupported = unsupportedOptions(req)
  if (unsupported.length) return problemResponse(400, 'UNSUPPORTED_OPTION', unsupported, lang, id)
  const dep = dependencyProblems(req)
  if (dep) return problemResponse(400, dep[0], dep[1], lang, id)
  return null
}

/* ---------- mockFetch ---------- */
// 固定 10 位（Crockford base32），与 e2e 断言 01MOCK[0-9A-Z]{10} 一致。
// 不要用 Math.random().toString(36).slice(…)：小数位不足时会少于 10 位。
const RID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const mockRequestId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(10))
  return `01MOCK${Array.from(bytes, (b) => RID_ALPHABET[b & 31]).join('')}`
}
const rid = mockRequestId
const wait = (ms: number, signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
})
const hang = (signal?: AbortSignal | null) => wait(1e9, signal)

function json(status: number, body: unknown, id: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Request-Id': id, ...extra } })
}

function readRequest(init?: RequestInit): ProjectRequest {
  const body = init?.body
  if (typeof body !== 'string') return {} as ProjectRequest
  if (body.trim().startsWith('{')) { const j = JSON.parse(body) as ProjectRequest; return { ...j, dependencies: j.dependencies ?? [] } }
  const q = new URLSearchParams(body)
  const o: Record<string, unknown> = Object.fromEntries(q)
  o.dependencies = (q.get('dependencies') ?? '').split(',').filter(Boolean)
  return o as unknown as ProjectRequest
}

export async function mockFetch(url: string, init?: RequestInit): Promise<Response> {
  const path = url.replace(MOCK_BASE, '').split('?')[0]
  const signal = init?.signal
  const lang = new Headers(init?.headers).get('Accept-Language') === 'zh' ? 'zh' : 'en'
  const mode = mockMode()
  const id = rid()
  if (path === '/api/v1/metadata') {
    if (mode === 'meta-loading' || mode === 'meta-timeout') await hang(signal)
    await wait(300, signal)
    if (mode === 'meta-error') return problemResponse(503, 'TEMPLATE_UNAVAILABLE', [], lang, id)
    return json(200, buildMockMetadata(), id, { ETag: '"mock-2026.10.1"', 'Cache-Control': 'max-age=300' })
  }
  if (path === '/api/v1/preview') {
    await wait(120, signal)
    if (mode === 'preview-error') return problemResponse(500, 'GENERATION_FAILED', [], lang, id)
    if (mode === 'preview-429' || mode === 'preview-429-short') return problemResponse(429, 'RATE_LIMITED', [], lang, id, { 'Retry-After': mode === 'preview-429' ? '30' : '2' })
    if (mode === 'preview-body-invalid') return problemResponse(400, 'INVALID_PARAMETER', [{ field: 'body', reason: 'invalid' }], lang, id)
    const req = readRequest(init)
    const bad = serverCheck(req, lang, id)
    if (bad) return bad
    return json(200, buildPreview(req, id, mode === 'preview-modules'), id)
  }
  if (path === '/starter.zip') {
    if (mode === 'gen-slow') await hang(signal)
    await wait(600, signal)
    if (mode === 'gen-fail') return problemResponse(500, 'GENERATION_FAILED', [], lang, id)
    if (mode === 'gen-406') return problemResponse(406, 'NOT_ACCEPTABLE', [], lang, id)
    if (mode === 'gen-415') return problemResponse(415, 'UNSUPPORTED_MEDIA_TYPE', [], lang, id)
    if (mode === 'download-429') return problemResponse(429, 'RATE_LIMITED', [], lang, id, { 'Retry-After': '2' })
    if (mode === 'gen-429') return problemResponse(429, 'RATE_LIMITED', [], lang, id, { 'Retry-After': '30' })
    const req = readRequest(init)
    if (mode === 'gen-unknown-dep') return problemResponse(400, 'UNKNOWN_DEPENDENCY', [{ field: 'dependencies', reason: 'unknown', args: ['legacy-report'] }], lang, id)
    if (mode === 'gen-invalid-other') return problemResponse(400, 'INVALID_PARAMETER', [{ field: 'baseDir', reason: 'pattern' }], lang, id)
    if (mode === 'gen-unsupported') return problemResponse(400, 'UNSUPPORTED_OPTION', [{ field: 'bootVersion', reason: 'unsupported', args: ['3.4.0'] }], lang, id)
    if (mode === 'gen-invalid') return problemResponse(400, 'INVALID_PARAMETER', [{ field: 'groupId', reason: 'pattern' }, { field: 'packageName', reason: 'keyword', args: ['class'] }], lang, id)
    if (mode === 'gen-stack') {
      const stack = 'java.lang.IllegalStateException: Cannot parse request body\n\tat com.mugsun.start.web.MugsunProjectRequestConverter.convert(MugsunProjectRequestConverter.java:24)\n\tat org.springframework.web.servlet.FrameworkServlet.service(FrameworkServlet.java:885)'
      const body: ErrorBody = { code: 'INVALID_PARAMETER', message: stack, requestId: id, details: [{ field: 'request', reason: 'invalid', message: stack }] }
      return json(400, body, id)
    }
    if (mode === 'gen-invalid-noreason') {
      // 服务端没给 message 时，前端按 reason 显示自己的文案
      const body: ErrorBody = { code: 'INVALID_PARAMETER', message: '', requestId: id, details: [{ field: 'groupId', reason: 'required', message: '' }] }
      return json(400, body, id)
    }
    const bad = serverCheck(req, lang, id)
    if (bad) return bad
    const root = req.baseDir?.trim() || req.artifactId
    const text = `前端 mock 数据：真实接口接入前不生成工程。\n${JSON.stringify(req, null, 2)}\n`
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${root}.zip"`, 'X-Request-Id': id, 'X-Mugsun-Template': 'boot=mock;pc=mock' } })
  }
  return problemResponse(404, 'NOT_FOUND', [], lang, id)
}
