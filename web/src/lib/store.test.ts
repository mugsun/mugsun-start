import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { api } from '@/api'
import { buildMockMetadata } from '@/api/mock'
import * as s from './store'

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
    s.form.dependencies = ['gis', 'nope']
    await s.loadMetadata()
    expect(s.metaState.value).toBe('ready')
    expect(s.form.dependencies).toEqual(['gis'])
    const r = s.toRequest()
    expect(r.dependencies).toEqual(['gis'])
    expect(r.bootVersion).toBe('3.5.13')
    expect(r.baseDir).toBe('demo')
  })
  it('failure: error state, scope types and defaults still available', async () => {
    vi.spyOn(api, 'getMetadata').mockRejectedValue(new Error('boom'))
    await s.loadMetadata()
    expect(s.metaState.value).toBe('error')
    expect(s.scopeTypes.value.map((x) => x.id)).toEqual(['mugsun-backend', 'mugsun-fullstack'])
    expect(s.form.description).not.toBe('')
    expect(s.toRequest().bootVersion).toBe('3.5.13')
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
    spy.mockResolvedValueOnce({ requestId: 'a', root: 'demo', fileCount: 1, dirCount: 1, tree: [] })
    await s.loadPreview()
    expect(s.previewState.value).toBe('ready')
    spy.mockRejectedValueOnce(new Error('x'))
    await s.loadPreview()
    expect(s.previewState.value).toBe('error')
    expect(s.preview.value?.requestId).toBe('a')
  })
})
