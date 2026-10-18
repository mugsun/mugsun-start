import { describe, it, expect, afterEach } from 'vitest'
import { buildMockMetadata, buildPreview, mockFetch, setMockMode, MOCK_BASE } from './mock'
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
  it('fullstack: module dirs tagged; dirs first', () => {
    const p = buildPreview({ ...base, dependencies: ['gis'] }, 'r')
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
  it('UNKNOWN_DEPENDENCY and an INVALID_PARAMETER field outside the form', async () => {
    expect(await api.generate({ ...base, dependencies: ['legacy'] }, { locale: 'zh-CN' }).catch((x) => x)).toMatchObject({ code: 'UNKNOWN_DEPENDENCY', message: '模块 legacy 不存在。' })
    setMockMode('gen-unknown-dep')
    expect(await api.generate(base, { locale: 'en' }).catch((x) => x)).toMatchObject({ code: 'UNKNOWN_DEPENDENCY' })
    setMockMode('gen-invalid-other')
    const e = await api.generate(base, { locale: 'en' }).catch((x) => x)
    expect(e.code).toBe('INVALID_PARAMETER')
    expect(e.details[0].field).toBe('baseDir')
    expect(e.message).toContain('baseDir')
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
