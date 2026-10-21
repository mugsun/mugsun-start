import { describe, it, expect, afterEach } from 'vitest'
import { buildMockMetadata, buildPreview, mockFetch, setMockMode, MOCK_BASE, mockRequestId } from './mock'
import { createHttpApi } from './http'
import type { PreviewNode, ProjectRequest } from './types'

const api = createHttpApi(MOCK_BASE, mockFetch)
const base: ProjectRequest = { type: 'mugsun-fullstack', groupId: 'com.example', artifactId: 'demo', name: 'demo', description: '', packageName: 'com.example.demo', dependencies: [], baseDir: 'demo' }
const flat = (n: PreviewNode[], out: PreviewNode[] = []) => { for (const x of n) { out.push(x); if (x.children) flat(x.children, out) } return out }
afterEach(() => setMockMode(null))

describe('mock metadata (§4.1)', () => {
  it('shape and enums', () => {
    const m = buildMockMetadata()
    expect(m.types.map((t) => t.id)).toEqual(['mugsun-backend', 'mugsun-fullstack'])
    expect(m.types.find((t) => t.default)?.id).toBe('mugsun-fullstack')
    expect(m.types[0].name).toEqual({ zh: '仅后端', en: 'Backend only' })
    expect(m.bootVersion.default).toBe('3.5.13')
    expect(m.fields.name?.follows).toBe('artifactId')
    expect(m.fields.packageName?.follows).toBe('groupId+artifactId')
    expect(m.modules.optional.map((d) => d.id)).toEqual(['gis', 'track', 'ai'])
    expect(m.modules.optional.every((d) => d.appliesTo.length === 2 && Array.isArray(d.requires))).toBe(true)
    expect(m.modules.alwaysOn.every((d) => d.removableIn === null || typeof d.removableIn === 'string')).toBe(true)
    expect(m.postGenerate.commands['mugsun-fullstack'].at(-1)).toContain('{artifactId}-pc')
  })
  it('8 always-on modules in slices order; optional defaults false', () => {
    const m = buildMockMetadata()
    expect(m.modules.alwaysOn.map((d) => d.id)).toEqual(['core-system', 'core-security', 'core-audit', 'core-file-msg', 'core-workflow', 'core-lowcode', 'core-open', 'core-ops'])
    expect(m.modules.optional.map((d) => d.default)).toEqual([false, false, false])
  })
  it('matches backend application.yml (PR #1 @e5512f5)', () => {
    const m = buildMockMetadata()
    expect(m.modules.alwaysOn.map((d) => d.icon)).toEqual(['system', 'security', 'audit', 'file', 'flow', 'lowcode', 'open', 'ops'])
    expect(m.modules.alwaysOn.map((d) => d.removableIn)).toEqual([null, null, null, null, 'phase-2', 'phase-2', 'phase-2', 'phase-3'])
    expect(m.modules.alwaysOn[3].name).toEqual({ zh: '文件与消息', en: 'Files and messaging' })
    expect(m.modules.optional.map((d) => d.pc?.npmRemove)).toEqual([['cesium', 'ol', 'gcoord'], ['@mugsun/track-web', 'rrweb-player', 'source-map-js'], ['vue-element-plus-x', '@vue-flow/core']])
    expect(m.modules.optional.map((d) => d.links?.reference)).toEqual(['https://docs.mugsun.com/boot/', 'https://docs.mugsun.com/track/', 'https://docs.mugsun.com/boot/'])
    expect(m.modules.optional[1].description.en).toBe('A browser tracking SDK and an analytics dashboard.')
  })
  it('served via GET with ETag', async () => {
    const r = await mockFetch(`${MOCK_BASE}/api/v1/metadata`, { headers: { 'Accept-Language': 'zh' } })
    expect(r.headers.get('ETag')).toBeTruthy()
    expect(r.headers.get('X-Request-Id')).toBeTruthy()
  })
})

describe('mock preview (§4.3, structure = §4.2 zip)', () => {
  it('backend: no -pc dir; core files present', () => {
    const p = buildPreview({ ...base, type: 'mugsun-backend', dependencies: ['gis'] }, 'r')
    const paths = flat(p.tree).map((n) => n.path)
    expect(p.root).toBe('demo')
    expect(paths).toContain('demo/config/application-local.yml.example')
    expect(paths).toContain('demo/src/main/java/com/example/demo/DemoApplication.java')
    expect(paths.some((x) => x.includes('demo-pc'))).toBe(false)
    expect(p.fileCount).toBe(flat(p.tree).filter((n) => n.type === 'file').length)
    expect(p.truncated).toBe(false)
  })
  it('default nodes match #5 (name/path/type[/size], no module); dirs first', () => {
    const p = buildPreview({ ...base, dependencies: ['gis'] }, 'r')
    expect(Object.keys(p)).toEqual(['requestId', 'root', 'fileCount', 'dirCount', 'truncated', 'tree'])
    const nodes = flat(p.tree)
    expect(nodes.every((n) => !('module' in n))).toBe(true)
    for (const n of nodes) expect(Object.keys(n)).toEqual(n.type === 'file' ? ['name', 'path', 'type', 'size'] : ['name', 'path', 'type', 'children'])
    expect(p.tree[0].children![0].type).toBe('dir')
  })
  it('preview-modules mode: module dirs tagged (S4 plan, optional)', () => {
    const p = buildPreview({ ...base, dependencies: ['gis'] }, 'r', true)
    const nodes = flat(p.tree)
    expect(nodes.find((n) => n.path === 'demo/demo-pc/modules/gis')?.module).toBe('gis')
    expect(nodes.find((n) => n.path === 'demo/demo-pc/modules/gis/routes.ts')?.module).toBe('gis')
    expect(p.tree[0].children![0].type).toBe('dir')
  })
  it('baseDir changes root', () => {
    expect(buildPreview({ ...base, baseDir: 'x' }, 'r').tree[0].path).toBe('x')
  })
})

describe('mock via http api', () => {
  it('server-side INVALID_PARAMETER with details', async () => {
    const e = await api.preview({ ...base, groupId: 'Bad' }, { locale: 'zh-CN' }).catch((x) => x)
    expect(e.code).toBe('INVALID_PARAMETER')
    expect(e.details[0].field).toBe('groupId')
  })
  it('truncated is always present', async () => {
    expect((await api.preview(base, { locale: 'en' })).truncated).toBe(false)
  })
  it('keywords follow the backend: com.record.x ok, com._ rejected', async () => {
    expect((await api.preview({ ...base, packageName: 'com.record.x' }, { locale: 'en' })).truncated).toBe(false)
    const e = await api.preview({ ...base, packageName: 'com._' }, { locale: 'en' }).catch((x) => x)
    expect(e.details[0]).toMatchObject({ field: 'packageName', reason: 'keyword' })
  })
  it('gen-stack returns an English stack trace on field=request', async () => {
    setMockMode('gen-stack')
    const e = await api.generate(base, { locale: 'zh-CN' }).catch((x) => x)
    expect(e.code).toBe('INVALID_PARAMETER')
    expect(e.details[0].field).toBe('request')
    expect(e.message).toContain('\tat ')
  })
  it('package keyword/literal → INVALID_PARAMETER on packageName', async () => {
    for (const p of ['com.class', 'com.null']) {
      const e = await api.preview({ ...base, packageName: p }, { locale: 'en' }).catch((x) => x)
      expect(e.details.map((d: { field: string }) => d.field)).toEqual(['packageName'])
    }
  })
  it('non-default fixed option → UNSUPPORTED_OPTION', async () => {
    const e = await api.generate({ ...base, bootVersion: '3.4.0' } as typeof base, { locale: 'en' }).catch((x) => x)
    expect(e).toMatchObject({ status: 400, code: 'UNSUPPORTED_OPTION' })
    setMockMode('gen-unsupported')
    expect(await api.generate(base, { locale: 'en' }).catch((x) => x)).toMatchObject({ code: 'UNSUPPORTED_OPTION' })
  })
  it('preview-body-invalid: 400 INVALID_PARAMETER with details [{field:"body",reason:"invalid"}] (#5 JSON parse error)', async () => {
    setMockMode('preview-body-invalid')
    const e = await api.preview(base, { locale: 'zh-CN' }).catch((x) => x)
    expect(e).toMatchObject({ status: 400, code: 'INVALID_PARAMETER' })
    expect(e.details).toEqual([{ field: 'body', reason: 'invalid', message: '请求体不是有效的 JSON，或字段类型不正确。' }])
  })
  it('preview-429 carries Retry-After; gen-406/gen-415 return the #10 codes', async () => {
    setMockMode('preview-429')
    expect(await api.preview(base, { locale: 'en' }).catch((x) => x)).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 30 })
    setMockMode('gen-406')
    expect(await api.generate(base, { locale: 'zh-CN' }).catch((x) => x)).toMatchObject({ status: 406, code: 'NOT_ACCEPTABLE', message: '无法按请求的格式返回结果，请接受 JSON 格式的响应。' })
    setMockMode('gen-415')
    expect(await api.generate(base, { locale: 'en' }).catch((x) => x)).toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE', message: "This request body format isn't supported." })
  })
  it('download-429: Retry-After 2; every 429 carries Retry-After; zip name = baseDir.zip', async () => {
    setMockMode('download-429')
    expect(await api.generate(base, { locale: 'zh-CN' }).catch((x) => x)).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 2, message: '请求过于频繁，请在 2 秒后重试。' })
    setMockMode(null)
    const g = await api.generate({ ...base, baseDir: 'shop-root', artifactId: 'shop' }, { locale: 'en' })
    expect(g.fileName).toBe('shop-root.zip')
    const g2 = await api.generate({ ...base, baseDir: '', artifactId: 'shop' }, { locale: 'en' })
    expect(g2.fileName).toBe('shop.zip')
  })
  it('preview root falls back to artifactId when baseDir is empty (#10)', () => {
    expect(buildPreview({ ...base, baseDir: '' }, 'r').root).toBe('demo')
    expect(buildPreview({ ...base, baseDir: undefined }, 'r').root).toBe('demo')
  })
  it('UNKNOWN_DEPENDENCY and an INVALID_PARAMETER field outside the form', async () => {
    expect(await api.generate({ ...base, dependencies: ['legacy'] }, { locale: 'zh-CN' }).catch((x) => x)).toMatchObject({ code: 'UNKNOWN_DEPENDENCY', message: '未知的模块：legacy。' })
    setMockMode('gen-unknown-dep')
    expect(await api.generate(base, { locale: 'en' }).catch((x) => x)).toMatchObject({ code: 'UNKNOWN_DEPENDENCY' })
    setMockMode('gen-invalid-other')
    const e = await api.generate(base, { locale: 'en' }).catch((x) => x)
    expect(e.code).toBe('INVALID_PARAMETER')
    expect(e.details[0].field).toBe('baseDir')
    expect(e.message).toContain('root folder')
  })
  it('details carry field, reason and message; single-detail message = detail message', async () => {
    const e = await api.preview({ ...base, packageName: 'com.class' }, { locale: 'en' }).catch((x) => x)
    expect(e.details).toEqual([{ field: 'packageName', reason: 'keyword', message: 'The segment class is a Java keyword or literal and cannot be used in a package name.' }])
    expect(e.message).toBe(e.details[0].message)
    const two = await api.preview({ ...base, groupId: 'Bad', artifactId: '' }, { locale: 'zh-CN' }).catch((x) => x)
    expect(two.details.map((d: { reason: string }) => d.reason)).toEqual(['pattern', 'required'])
    expect(two.message).toBe('请求参数不符合要求，请检查标出的字段。')
  })
  it('backend check order: invalid before unsupported before unknown dependency', async () => {
    const e = await api.generate({ ...base, groupId: 'Bad', dependencies: ['nope'], bootVersion: '1' } as typeof base, { locale: 'en' }).catch((x) => x)
    expect(e.code).toBe('INVALID_PARAMETER')
    const u = await api.generate({ ...base, dependencies: ['nope'], bootVersion: '1' } as typeof base, { locale: 'en' }).catch((x) => x)
    expect(u.code).toBe('UNSUPPORTED_OPTION')
    expect(u.details[0]).toMatchObject({ field: 'bootVersion', reason: 'unsupported' })
  })
  it('scenarios', async () => {
    setMockMode('gen-429')
    expect(await api.generate(base, { locale: 'en' }).catch((x) => x)).toMatchObject({ status: 429, code: 'RATE_LIMITED', retryAfter: 30 })
    setMockMode('meta-error')
    expect(await api.getMetadata({ locale: 'en' }).catch((x) => x)).toMatchObject({ status: 503, code: 'TEMPLATE_UNAVAILABLE' })
    setMockMode('gen-invalid')
    expect((await api.generate(base, { locale: 'en' }).catch((x) => x)).details.map((d: { field: string }) => d.field)).toEqual(['groupId', 'packageName'])
    setMockMode('')
    const r = await api.generate(base, { locale: 'en' })
    expect(r.fileName).toBe('demo.zip')
  })
})

describe('mockRequestId', () => {
  it('always has a fixed 10-char suffix', () => {
    for (let i = 0; i < 20000; i++) expect(mockRequestId()).toMatch(/^01MOCK[0-9A-Z]{10}$/)
  })
})
