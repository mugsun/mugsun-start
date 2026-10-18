import type { Metadata, ProjectRequest, GenerateResult, StartApi } from './types'
import { ApiError } from './types'

/**
 * 前端 mock 数据。换成真接口后本文件只用于开发和截图。
 * 场景通过 URL 参数 ?mock=xxx 切换：
 *   meta-error   metadata 返回 500
 *   meta-timeout metadata 超时（由 api/index.ts 的 10s 超时兜底）
 *   meta-loading metadata 一直不返回（看骨架屏）
 *   gen-fail     生成返回 500
 *   gen-slow     生成一直不返回（看「正在生成…」和 10s 提示）
 */
export function mockMode(): string {
  if (typeof location === 'undefined') return ''
  return new URLSearchParams(location.search).get('mock') ?? ''
}

const DOCS = 'https://docs.mugsun.com'

const text = {
  zh: {
    required: '常驻模块',
    optional: '可选模块',
    backend: ['仅后端', 'mugsun-boot，Spring Boot 3.5、JDK 21。'],
    fullstack: ['前后端', '后端 + mugsun-pc 管理台（Vue 3）。'],
    system: ['系统管理', '用户、角色、菜单、部门、多租户。'],
    audit: ['权限与审计', '数据权限、操作日志与登录日志。'],
    codegen: ['代码生成', '按数据表生成前后端增删改查代码。'],
    workflow: ['工作流', '流程设计、待办、流程实例与审批记录。'],
    gis: ['GIS', '地图、图层、地理围栏。'],
    track: ['埋点', '浏览器埋点 SDK 与分析看板。'],
    ai: ['AI', '模型接入、对话、知识库。'],
    desc: '基于 mugsun 的管理系统'
  },
  en: {
    required: 'Included modules',
    optional: 'Optional modules',
    backend: ['Backend only', 'mugsun-boot, Spring Boot 3.5, JDK 21.'],
    fullstack: ['Full stack', 'Backend plus the mugsun-pc admin console (Vue 3).'],
    system: ['System administration', 'Users, roles, menus, departments and multi-tenancy.'],
    audit: ['Permissions and auditing', 'Data permissions, operation logs and sign-in logs.'],
    codegen: ['Code generator', 'Generates CRUD code for the backend and frontend from database tables.'],
    workflow: ['Workflow', 'Process design, to-do lists, process instances and approval history.'],
    gis: ['GIS', 'Maps, layers and geofences, with support for vector tiles and 3D globe rendering.'],
    track: ['Analytics', 'A browser tracking SDK with session replay and an analytics dashboard for events and funnels.'],
    ai: ['AI', 'Model integration, chat and knowledge bases, with retrieval-augmented generation over your own documents.'],
    desc: 'An admin system built on mugsun'
  }
} as const

export function buildMockMetadata(locale: string): Metadata {
  const x = locale.startsWith('en') ? text.en : text.zh
  const dep = (id: keyof typeof x, icon: string, required: boolean, doc: string) => {
    const [name, description] = x[id] as readonly string[]
    return {
      id: required ? id : `mugsun-${id}`,
      name,
      description,
      icon,
      required,
      versionRange: '[3.5.0,3.6.0)',
      _links: { reference: { href: `${DOCS}${doc}` } }
    }
  }
  return {
    _links: { 'maven-project': { href: '/starter.zip?type=maven-project{&dependencies,packaging,javaVersion,language,bootVersion,groupId,artifactId,version,name,description,packageName}', templated: true } },
    dependencies: {
      type: 'hierarchical-multi-select',
      values: [
        {
          name: x.required,
          values: [
            dep('system', 'Setting', true, '/guide/system'),
            dep('audit', 'Lock', true, '/guide/permission'),
            dep('codegen', 'EditPen', true, '/guide/codegen'),
            dep('workflow', 'Share', true, '/guide/workflow')
          ]
        },
        {
          name: x.optional,
          values: [
            dep('gis', 'MapLocation', false, '/guide/gis'),
            dep('track', 'DataAnalysis', false, '/guide/track'),
            dep('ai', 'MagicStick', false, '/guide/ai')
          ]
        }
      ]
    },
    type: {
      type: 'action',
      default: 'mugsun-fullstack',
      values: [
        { id: 'maven-project', name: x.backend[0], description: x.backend[1], action: '/starter.zip', tags: { build: 'maven', format: 'project' } },
        { id: 'mugsun-fullstack', name: x.fullstack[0], description: x.fullstack[1], action: '/starter.zip', tags: { build: 'maven', format: 'project', pc: 'true' } }
      ]
    },
    packaging: { type: 'single-select', default: 'jar', values: [{ id: 'jar', name: 'Jar' }] },
    javaVersion: { type: 'single-select', default: '21', values: [{ id: '21', name: '21' }] },
    language: { type: 'single-select', default: 'java', values: [{ id: 'java', name: 'Java' }] },
    bootVersion: { type: 'single-select', default: '3.5.6', values: [{ id: '3.5.6', name: '3.5.6' }] },
    groupId: { type: 'text', default: 'com.example' },
    artifactId: { type: 'text', default: 'demo' },
    version: { type: 'text', default: '0.0.1-SNAPSHOT' },
    name: { type: 'text', default: 'demo' },
    description: { type: 'text', default: x.desc },
    packageName: { type: 'text', default: 'com.example.demo' },
    database: { type: 'single-select', default: 'postgresql', values: [{ id: 'postgresql', name: 'PostgreSQL' }] }
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const never = () => new Promise<never>(() => {})
const rid = () => Math.random().toString(16).slice(2, 10)

export const mockApi: StartApi = {
  async getMetadata(locale) {
    const mode = mockMode()
    if (mode === 'meta-loading' || mode === 'meta-timeout') return never()
    await wait(400)
    if (mode === 'meta-error') throw new ApiError('Internal Server Error', 500, rid())
    return buildMockMetadata(locale)
  },
  async generate(req: ProjectRequest): Promise<GenerateResult> {
    const mode = mockMode()
    if (mode === 'gen-slow') return never()
    await wait(800)
    if (mode === 'gen-fail') throw new ApiError('Internal Server Error', 500, `req-${rid()}`)
    const body = `前端 mock 数据：真实接口接入前不生成工程。\n${JSON.stringify(req, null, 2)}\n`
    return { blob: new Blob([body], { type: 'application/zip' }), fileName: `${req.artifactId}.zip`, requestId: `req-${rid()}` }
  }
}
