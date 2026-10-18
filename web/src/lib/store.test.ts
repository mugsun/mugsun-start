import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { api } from '@/api'
import { buildMockMetadata } from '@/api/mock'
import * as s from './store'
import { ApiError } from '@/api'
import { i18n } from '@/i18n'

const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); await nextTick() }

beforeEach(() => s.__resetForTest())
afterEach(() => vi.restoreAllMocks())

describe('auto follow', () => {
  it('name and package follow artifact/group until edited', async () => {
    s.form.artifactId = 'my-app'
    await nextTick()
    expect(s.form.name).toBe('my-app')
    expect(s.form.packageName).toBe('com.example.myapp')
    s.manual.packageName = true
    s.form.packageName = 'org.custom'
    s.form.groupId = 'org.x'
    await nextTick()
    expect(s.form.packageName).toBe('org.custom')
    s.restorePackage()
    expect(s.form.packageName).toBe('org.x.myapp')
  })
  it('editing a field clears its server error', async () => {
    s.serverErrors.groupId = 'bad'
    s.form.groupId = 'com.y'
    await nextTick()
    expect(s.serverErrors.groupId).toBeUndefined()
  })
})

describe('applyQuery', () => {
  it('applies valid params, drops invalid ones', () => {
    s.applyQuery('?type=mugsun-backend&groupId=Bad&artifactId=shop&packageName=com.class&dependencies=gis,EVIL')
    expect(s.form.type).toBe('mugsun-backend')
    expect(s.form.groupId).toBe('com.example')
    expect(s.form.artifactId).toBe('shop')
    expect(s.form.packageName).toBe('com.example.demo')
    expect(s.form.dependencies).toEqual(['gis'])
  })
})

describe('loadMetadata', () => {
  it('success: defaults from metadata, unknown deps filtered, no always-on in request', async () => {
    vi.spyOn(api, 'getMetadata').mockResolvedValue(buildMockMetadata())
    s.applyQuery('?dependencies=gis,nope')
    await s.loadMetadata()
    expect(s.metaState.value).toBe('ready')
    expect(s.form.dependencies).toEqual(['gis'])
    const r = s.toRequest()
    expect(r.dependencies).toEqual(['gis'])
    expect(r.baseDir).toBe('demo')
    for (const k of ['bootVersion', 'javaVersion', 'packaging', 'language', 'configurationFileFormat', 'database', 'version']) expect(r).not.toHaveProperty(k)
  })
  it('failure: error state, scope types and defaults still available', async () => {
    vi.spyOn(api, 'getMetadata').mockRejectedValue(new Error('boom'))
    await s.loadMetadata()
    expect(s.metaState.value).toBe('error')
    expect(s.scopeTypes.value.map((x) => x.id)).toEqual(['mugsun-backend', 'mugsun-fullstack'])
    expect(s.form.description).not.toBe('')
    expect(s.toRequest().type).toBe('mugsun-fullstack')
  })
  it('race: only the latest result is applied; previous request is aborted', async () => {
    const signals: AbortSignal[] = []
    const resolvers: ((v: ReturnType<typeof buildMockMetadata>) => void)[] = []
    vi.spyOn(api, 'getMetadata').mockImplementation((o) => { signals.push(o.signal!); return new Promise((r) => resolvers.push(r)) })
    const p1 = s.loadMetadata()
    const p2 = s.loadMetadata()
    expect(signals[0].aborted).toBe(true)
    const second = buildMockMetadata(); second.version = 'second'
    resolvers[1](second); await p2
    resolvers[0](buildMockMetadata()); await p1
    await settle()
    expect(s.metadata.value?.version).toBe('second')
  })
})

describe('loadPreview', () => {
  it('keeps latest; error keeps previous tree', async () => {
    const spy = vi.spyOn(api, 'preview')
    spy.mockResolvedValueOnce({ requestId: 'a', root: 'demo', fileCount: 1, dirCount: 1, truncated: false, tree: [] })
    await s.loadPreview()
    expect(s.previewState.value).toBe('ready')
    spy.mockRejectedValueOnce(new Error('x'))
    await s.loadPreview()
    expect(s.previewState.value).toBe('error')
    expect(s.preview.value?.requestId).toBe('a')
  })
})

describe('optional[].default', () => {
  it('phase 1 defaults are all false → nothing preselected', async () => {
    vi.spyOn(api, 'getMetadata').mockResolvedValue(buildMockMetadata())
    await s.loadMetadata()
    expect(s.form.dependencies).toEqual([])
  })
  it('preselects modules whose default is true', async () => {
    const m = buildMockMetadata()
    m.modules.optional[0].default = true; m.modules.optional[2].default = true
    vi.spyOn(api, 'getMetadata').mockResolvedValue(m)
    await s.loadMetadata()
    expect(s.form.dependencies).toEqual(['gis', 'ai'])
  })
  it('share link dependencies win over defaults', async () => {
    const m = buildMockMetadata(); m.modules.optional[0].default = true
    vi.spyOn(api, 'getMetadata').mockResolvedValue(m)
    s.applyQuery('?dependencies=track')
    await s.loadMetadata()
    expect(s.form.dependencies).toEqual(['track'])
  })
})

describe('server field errors', () => {
  const invalid = (fields: string[]) => new ApiError(400, 'INVALID_PARAMETER', 'm', 'r', fields.map((field) => ({ field, message: `bad ${field}` })))
  it('preview INVALID_PARAMETER maps details to form fields', async () => {
    vi.spyOn(api, 'preview').mockRejectedValue(invalid(['groupId', 'packageName']))
    await s.loadPreview()
    expect(s.serverErrors.groupId).toBe('bad groupId')
    expect(s.serverErrors.packageName).toBe('bad packageName')
  })
  it('ignores unknown fields and other codes', () => {
    expect(s.applyServerErrors(invalid(['bootVersion']))).toBe(0)
    expect(s.applyServerErrors(invalid(['body']))).toBe(0)
    expect(s.applyServerErrors(invalid(['request', 'baseDir']))).toBe(0)
    expect(s.applyServerErrors(new ApiError(400, 'UNSUPPORTED_OPTION', 'm', 'r', [{ field: 'packageName', message: 'x' }]))).toBe(0)
    expect(s.serverErrors.packageName).toBeUndefined()
    expect(s.applyServerErrors(invalid(['packageName']))).toBe(1)
  })
})

describe('details {field, reason, message} (PR #4)', () => {
  const inv = (details: { field: string; reason?: string; message?: string }[]) => new ApiError(400, 'INVALID_PARAMETER', '', 'r', details)
  it('server message wins over reason', () => {
    i18n.global.locale.value = 'zh-CN'
    s.applyServerErrors(inv([{ field: 'groupId', reason: 'pattern', message: '服务端的 Group 文案' }]))
    expect(s.serverErrors.groupId).toBe('服务端的 Group 文案')
  })
  it('falls back to frontend text by reason when message is missing or blank', () => {
    i18n.global.locale.value = 'zh-CN'
    s.applyServerErrors(inv([{ field: 'groupId', reason: 'required', message: '' }, { field: 'packageName', reason: 'keyword' }, { field: 'artifactId', reason: 'weird' }]))
    expect(s.serverErrors.groupId).toBe('请填写 Group。')
    expect(s.serverErrors.packageName).toContain('Java 关键字')
    expect(s.serverErrors.artifactId).toContain('Artifact 只能包含')
  })
})

describe('details messages pass the same guard', () => {
  const inv = (message: string) => new ApiError(400, 'INVALID_PARAMETER', '', 'r', [{ field: 'groupId', reason: 'pattern', message }])
  it('stack / wrong language / too long fall back to field+reason text', () => {
    i18n.global.locale.value = 'zh-CN'
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const m of ['java.lang.IllegalStateException\n\tat x', 'The group is invalid.', '错'.repeat(201)]) {
      s.applyServerErrors(inv(m))
      expect(s.serverErrors.groupId).toBe('Group 只能包含小写字母、数字、下划线和点，且不能以数字开头。')
    }
    s.applyServerErrors(inv('服务端的 Group 文案'))
    expect(s.serverErrors.groupId).toBe('服务端的 Group 文案')
  })
})
