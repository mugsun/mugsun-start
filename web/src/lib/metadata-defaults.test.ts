// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { api, type Metadata } from '@/api'
import raw from '@/api/__fixtures__/metadata-alt.json?raw'
import * as s from './store'
import { buildMockMetadata } from '@/api/mock'
import { setLocale } from '@/i18n'

/** 与 mock 取值不同的 §4.1 夹具，证明默认值来自 metadata 而不是前端兜底 */
const fixture = () => JSON.parse(raw) as Metadata

beforeEach(() => { s.__resetForTest(); setLocale('zh-CN') })
afterEach(() => vi.restoreAllMocks())

describe('defaults come from metadata', () => {
  it('fixture differs from mock values', () => {
    const m = buildMockMetadata()
    expect(fixture().fields.groupId?.default).not.toBe(m.fields.groupId?.default)
    expect(fixture().fields.description?.default).not.toEqual(m.fields.description?.default)
  })
  it('groupId / artifactId / name / packageName / description / type / modules', async () => {
    vi.spyOn(api, 'getMetadata').mockResolvedValue(fixture())
    await s.loadMetadata()
    await nextTick()
    expect(s.form).toMatchObject({ type: 'mugsun-backend', groupId: 'org.acme', artifactId: 'shop', name: 'shop', packageName: 'org.acme.shop', description: 'Acme 商城后台' })
    expect(s.form.dependencies).toEqual(['ai'])
    expect(s.fields.value.artifactId?.maxLength).toBe(30)
    expect(s.postGenerate.value.docs).toBe('https://example.test/docs')
    expect(s.toRequest().baseDir).toBe('shop')
  })
  it('description follows locale from metadata', async () => {
    vi.spyOn(api, 'getMetadata').mockResolvedValue(fixture())
    await s.loadMetadata()
    setLocale('en')
    await nextTick()
    expect(s.form.description).toBe('Acme shop admin')
  })
  it('values from a share link or edited by hand are kept', async () => {
    vi.spyOn(api, 'getMetadata').mockResolvedValue(fixture())
    s.applyQuery('?groupId=io.mine')
    s.manual.description = true
    s.form.description = 'mine'
    await s.loadMetadata()
    await nextTick()
    expect(s.form.groupId).toBe('io.mine')
    expect(s.form.description).toBe('mine')
    expect(s.form.artifactId).toBe('shop')
    expect(s.form.packageName).toBe('io.mine.shop')
  })
})
