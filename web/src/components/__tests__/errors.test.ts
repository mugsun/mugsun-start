// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import { i18n, setLocale } from '@/i18n'
import ModuleList from '../ModuleList.vue'
import PreviewTree from '../PreviewTree.vue'
import * as s from '@/lib/store'
import { ApiError } from '@/api'
import { buildMockMetadata } from '@/api/mock'

const opts = { global: { plugins: [i18n, ElementPlus] } }
beforeEach(() => { s.__resetForTest(); setLocale('zh-CN') })

describe('component error paths', () => {
  it('ModuleList: load error shows message and retry emits', async () => {
    s.metaState.value = 'error'
    const w = mount(ModuleList, opts)
    await nextTick()
    expect(w.text()).toContain('模块列表加载失败')
    await w.find('button.retry').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })
  it('PreviewTree: preview error shows requestId; invalid params get dedicated text', async () => {
    s.metaState.value = 'ready'
    s.previewState.value = 'error'
    s.previewError.value = new ApiError(500, 'GENERATION_FAILED', 'x', 'req-9')
    const w = mount(PreviewTree, opts)
    await nextTick()
    expect(w.text()).toContain('预览加载失败')
    expect(w.text()).toContain('req-9')
    s.previewError.value = new ApiError(400, 'INVALID_PARAMETER', 'x', 'req-1', [{ field: 'groupId', message: 'm' }])
    await nextTick()
    expect(w.text()).toContain('项目信息有误')
  })
})

describe('ModuleList with metadata', () => {
  const ready = () => { s.metadata.value = buildMockMetadata(); s.metaState.value = 'ready' }
  it('renders every always-on module in returned order; unknown icon does not break', async () => {
    ready()
    s.metadata.value!.modules.alwaysOn[0].icon = 'not-an-icon'
    const w = mount(ModuleList, opts)
    await nextTick()
    const names = s.metadata.value!.modules.alwaysOn.map((d) => d.name.zh)
    const text = w.text()
    const pos = names.map((n) => text.indexOf(n))
    expect(pos.every((p) => p >= 0)).toBe(true)
    expect([...pos].sort((a, b) => a - b)).toEqual(pos)
  })
  it('backendOnly note only shows for mugsun-backend', async () => {
    ready()
    const note = s.metadata.value!.modules.optional[0].notes!.backendOnly!.zh
    s.form.type = 'mugsun-fullstack'
    const w = mount(ModuleList, opts)
    await nextTick()
    expect(w.text()).not.toContain(note)
    s.form.type = 'mugsun-backend'
    await nextTick()
    expect(w.text()).toContain(note)
  })
})

describe('429 messages', () => {
  it('zh / en text with and without Retry-After', () => {
    const t = i18n.global.t
    setLocale('zh-CN')
    expect(t('bar.rateLimited', { s: 30 })).toBe('请求过于频繁，请在 30 秒后重试')
    expect(t('bar.rateLimitedNoWait')).toBe('请求过于频繁，请稍后重试')
    setLocale('en')
    expect(t('bar.rateLimited', { s: 30 })).toBe('Too many requests. Try again in 30 seconds.')
    expect(t('bar.rateLimitedNoWait')).toBe('Too many requests. Try again later.')
  })
})

describe('ModuleList collapse (<1024px)', () => {
  const setWidth = (narrow: boolean) => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: narrow && q.includes('max-width: 1023px'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }))
    window.matchMedia = globalThis.matchMedia
  }
  afterEach(() => vi.unstubAllGlobals())
  const ready = (n?: number) => {
    const m = buildMockMetadata()
    if (n !== undefined) m.modules.alwaysOn = m.modules.alwaysOn.slice(0, n)
    s.metadata.value = m; s.metaState.value = 'ready'
  }
  it('optional modules come before always-on modules', async () => {
    setWidth(false); ready()
    const w = mount(ModuleList, opts); await nextTick()
    const titles = w.findAll('h3').map((h) => h.text())
    expect(titles).toEqual(['可选模块', '常驻模块'])
  })
  it('wide: all 8 shown, no toggle', async () => {
    setWidth(false); ready()
    const w = mount(ModuleList, opts); await nextTick()
    expect(w.findAll('#always-on-list li')).toHaveLength(8)
    expect(w.find('.more').exists()).toBe(false)
  })
  it('narrow: 4 shown, toggle with aria, count from metadata', async () => {
    setWidth(true); ready(6)
    const w = mount(ModuleList, opts); await flushPromises()
    expect(w.findAll('#always-on-list li')).toHaveLength(4)
    const b = w.find('.more')
    expect(b.text()).toBe('展开全部（共 6 个）')
    expect(b.attributes('aria-expanded')).toBe('false')
    expect(b.attributes('aria-controls')).toBe('always-on-list')
    await b.trigger('click'); await flushPromises()
    expect(w.findAll('#always-on-list li')).toHaveLength(6)
    expect(w.find('.more').text()).toBe('收起')
    expect(w.find('.more').attributes('aria-expanded')).toBe('true')
    setLocale('en'); await nextTick()
    expect(w.find('.more').text()).toBe('Show less')
    await w.find('.more').trigger('click'); await flushPromises()
    expect(w.find('.more').text()).toBe('Show all (6)')
  })
  it('narrow with ≤ 4 modules: no toggle', async () => {
    setWidth(true); ready(4)
    const w = mount(ModuleList, opts); await flushPromises()
    expect(w.findAll('#always-on-list li')).toHaveLength(4)
    expect(w.find('.more').exists()).toBe(false)
  })
})
