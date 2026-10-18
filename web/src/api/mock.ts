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

const pcRemove: Record<string, string[]> = { gis: ['ol', 'cesium', 'gcoord'], track: ['@mugsun/track-web', 'rrweb-player'], ai: ['vue-element-plus-x', '@vue-flow/core'] }

export function buildMockMetadata(): Metadata {
  const opt = (id: string, group: string, icon: string, name: L10n, description: L10n, backendOnly: L10n) => ({
    id, group, icon, name, description, default: false, appliesTo: BOTH, requires: [], conflicts: [],
    notes: { backendOnly }, links: { reference: `${DOCS}/boot/${id}` },
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
        on('core-system', 'system', l('系统管理与多租户', 'System administration and multi-tenancy'), l('用户、角色、菜单、部门、多租户。', 'Users, roles, menus, departments and multi-tenancy.'), null),
        on('core-security', 'security', l('认证与安全', 'Authentication and security'), l('登录、验证码、双因子、密码策略与数据脱敏。', 'Sign-in, captcha, two-factor authentication, password policies and data masking.'), null),
        on('core-audit', 'audit', l('日志与审计', 'Logging and auditing'), l('操作日志防篡改与登录日志。', 'Tamper-evident operation logs and sign-in logs.'), null),
        on('core-file-msg', 'message', l('文件、短信与消息', 'Files, SMS and messaging'), l('文件存储、短信、邮件、通知与站内消息。', 'File storage, SMS, email, notifications and in-app messages.'), null),
        on('core-workflow', 'flow', l('工作流', 'Workflow'), l('基于 warm-flow 的流程设计与审批。', 'Process design and approval based on warm-flow.'), 'phase-2'),
        on('core-lowcode', 'lowcode', l('低代码与代码生成', 'Low-code and code generation'), l('代码生成、在线表单与表单设计器。', 'Code generation, online forms and a form designer.'), 'phase-2'),
        on('core-open', 'open', l('开放平台与社交登录', 'Open platform and social sign-in'), l('OAuth2 客户端、API Key、调用日志与第三方登录。', 'OAuth2 clients, API keys, call logs and third-party sign-in.'), 'phase-2'),
        on('core-ops', 'ops', l('定时任务与监控', 'Scheduled jobs and monitoring'), l('PowerJob 定时任务、运行监控与在线用户。', 'PowerJob scheduling, runtime monitoring and online users.'), null)
      ],
      optional: [
        opt('gis', 'geo', 'map', l('GIS', 'GIS'), l('地图、图层、地理围栏。', 'Maps, layers and geofences, with support for vector tiles and 3D globe rendering.'), l('仅后端时只含 REST 接口。', 'Backend only includes the REST API.')),
        opt('track', 'analytics', 'track', l('埋点', 'Analytics'), l('浏览器埋点 SDK 与分析看板。', 'A browser tracking SDK with session replay and an analytics dashboard for events and funnels.'), l('仅后端时只含采集与查询接口，看板需要前后端或自建前端。', 'Backend only includes the collection and query APIs. The dashboard requires the full stack or your own frontend.')),
        opt('ai', 'ai', 'ai', l('AI', 'AI'), l('模型接入、对话、知识库。', 'Model integration, chat and knowledge bases, with retrieval-augmented generation over your own documents.'), l('仅后端时只含 REST 接口。', 'Backend only includes the REST API.'))
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
export function toTree(entries: [string, string | null][]): PreviewNode[] {
  const root: PreviewNode = { name: '', path: '', type: 'dir', children: [] }
  for (const [p, mod] of entries) {
    const parts = p.split('/')
    let cur = root
    parts.forEach((name, i) => {
      const path = parts.slice(0, i + 1).join('/')
      const isFile = i === parts.length - 1
      let next = cur.children!.find((c) => c.name === name)
      if (!next) {
        next = isFile ? { name, path, type: 'file', size: 1024, module: mod } : { name, path, type: 'dir', module: null, children: [] }
        cur.children!.push(next)
      }
      // 模块独占目录（modules/<f>）标上模块
      if (!isFile && mod && path.endsWith(`/modules/${mod}`)) next.module = mod
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

export function buildPreview(req: ProjectRequest, requestId: string): PreviewResult {
  const entries = previewPaths(req)
  const tree = toTree(entries)
  let dirs = 0
  const walk = (n: PreviewNode[]) => n.forEach((x) => { if (x.type === 'dir') { dirs++; walk(x.children ?? []) } })
  walk(tree)
  return { requestId, root: req.baseDir || req.artifactId, fileCount: entries.length, dirCount: dirs, truncated: false, tree }
}

/* ---------- 服务端校验（模拟 S3） ---------- */
const MSG: Record<string, L10n> = {
  groupId: l('Group 只能包含小写字母、数字、下划线和点，且不能以数字开头。', 'The group can only contain lowercase letters, digits, underscores and dots, and cannot start with a digit.'),
  artifactId: l('Artifact 只能包含小写字母、数字和连字符，且须以字母开头，最长 50 个字符。', 'The artifact can only contain lowercase letters, digits and hyphens, must start with a letter and can be up to 50 characters.'),
  name: l('项目名称为必填项，最长 50 个字符。', 'The project name is required and can be up to 50 characters.'),
  packageName: l('包名须由小写字母、数字和下划线组成的段以点连接，各段不能以数字开头，不能是 Java 关键字或 true/false/null。', 'The package name must be dot-separated segments of lowercase letters, digits and underscores. Segments cannot start with a digit, be a Java keyword or be true, false or null.'),
  description: l('描述最长 200 个字符。', 'The description can be up to 200 characters.')
}
export function validateRequest(req: ProjectRequest, lang: 'zh' | 'en'): ErrorDetail[] {
  const out: ErrorDetail[] = []
  for (const [f, spec] of Object.entries(fields)) {
    if (f === 'version') continue
    const v = String((req as unknown as Record<string, unknown>)[f] ?? '')
    const bad = (spec.required && !v) || (spec.maxLength !== undefined && v.length > spec.maxLength) || (spec.pattern && v && !new RegExp(spec.pattern).test(v))
    const reserved = f === 'packageName' && v.split('.').some(isReservedSegment)
    if (bad || reserved) out.push({ field: f, message: MSG[f][lang] })
  }
  return out
}

/* ---------- mockFetch ---------- */
const rid = () => `01MOCK${Math.random().toString(36).slice(2, 12).toUpperCase()}`
const wait = (ms: number, signal?: AbortSignal | null) => new Promise<void>((resolve, reject) => {
  const t = setTimeout(resolve, ms)
  signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
})
const hang = (signal?: AbortSignal | null) => wait(1e9, signal)

function json(status: number, body: unknown, id: string, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'X-Request-Id': id, ...extra } })
}
function err(status: number, code: string, message: L10n, lang: 'zh' | 'en', id: string, details: ErrorDetail[] = [], extra: Record<string, string> = {}) {
  const body: ErrorBody = { code, message: message[lang], requestId: id, timestamp: new Date().toISOString(), details }
  return json(status, body, id, extra)
}
const FAILED = l('生成失败，请稍后重试。', 'Generation failed. Try again later.')

function readRequest(init?: RequestInit): ProjectRequest {
  const body = init?.body
  if (typeof body !== 'string') return {} as ProjectRequest
  if (body.trim().startsWith('{')) return JSON.parse(body) as ProjectRequest
  const q = new URLSearchParams(body)
  const o: Record<string, unknown> = Object.fromEntries(q)
  o.dependencies = (q.get('dependencies') ?? '').split(',').filter(Boolean)
  return o as unknown as ProjectRequest
}

/** 一期只接受默认值的参数（§4.2）；传了非默认值返回 UNSUPPORTED_OPTION */
const FIXED_OPTIONS: Record<string, string> = { bootVersion: '3.5.13', javaVersion: '21', packaging: 'jar', language: 'java', configurationFileFormat: 'yaml', database: 'postgresql' }
export function unsupportedOptions(req: ProjectRequest): ErrorDetail[] {
  const r = req as unknown as Record<string, unknown>
  return Object.entries(FIXED_OPTIONS).filter(([k, v]) => r[k] !== undefined && r[k] !== v).map(([k]) => ({ field: k, message: `${k} 一期只接受 ${FIXED_OPTIONS[k]}` }))
}
const UNSUPPORTED = l('包含一期不支持的选项。', 'The request contains an option that is not supported yet.')

export async function mockFetch(url: string, init?: RequestInit): Promise<Response> {
  const path = url.replace(MOCK_BASE, '').split('?')[0]
  const signal = init?.signal
  const lang = new Headers(init?.headers).get('Accept-Language') === 'zh' ? 'zh' : 'en'
  const mode = mockMode()
  const id = rid()
  if (path === '/api/v1/metadata') {
    if (mode === 'meta-loading' || mode === 'meta-timeout') await hang(signal)
    await wait(300, signal)
    if (mode === 'meta-error') return err(503, 'TEMPLATE_UNAVAILABLE', l('模板暂不可用，请稍后重试。', 'Templates are temporarily unavailable. Try again later.'), lang, id)
    return json(200, buildMockMetadata(), id, { ETag: '"mock-2026.10.1"', 'Cache-Control': 'max-age=300' })
  }
  if (path === '/api/v1/preview') {
    await wait(120, signal)
    if (mode === 'preview-error') return err(500, 'GENERATION_FAILED', FAILED, lang, id)
    const req = readRequest(init)
    const unsupported = unsupportedOptions(req)
    if (unsupported.length) return err(400, 'UNSUPPORTED_OPTION', UNSUPPORTED, lang, id, unsupported)
    const details = validateRequest(req, lang)
    if (details.length) return err(400, 'INVALID_PARAMETER', l(details[0].message, details[0].message), lang, id, details)
    return json(200, buildPreview(req, id), id)
  }
  if (path === '/starter.zip') {
    if (mode === 'gen-slow') await hang(signal)
    await wait(600, signal)
    if (mode === 'gen-fail') return err(500, 'GENERATION_FAILED', FAILED, lang, id)
    if (mode === 'gen-429') return err(429, 'RATE_LIMITED', l('请求过于频繁。', 'Too many requests.'), lang, id, [], { 'Retry-After': '30' })
    const req = readRequest(init)
    const unsupported = mode === 'gen-unsupported' ? [{ field: 'bootVersion', message: 'bootVersion 一期只接受 3.5.13' }] : unsupportedOptions(req)
    if (unsupported.length) return err(400, 'UNSUPPORTED_OPTION', UNSUPPORTED, lang, id, unsupported)
    const details = mode === 'gen-invalid'
      ? [{ field: 'groupId', message: MSG.groupId[lang] }, { field: 'packageName', message: MSG.packageName[lang] }]
      : validateRequest(req, lang)
    if (details.length) return err(400, 'INVALID_PARAMETER', l(details[0].message, details[0].message), lang, id, details)
    const root = req.baseDir || req.artifactId
    const text = `前端 mock 数据：真实接口接入前不生成工程。\n${JSON.stringify(req, null, 2)}\n`
    return new Response(text, { status: 200, headers: { 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="${root}.zip"`, 'X-Request-Id': id, 'X-Mugsun-Template': 'boot=mock;pc=mock' } })
  }
  return err(404, 'NOT_FOUND', l('接口不存在。', 'Not found.'), lang, id)
}
