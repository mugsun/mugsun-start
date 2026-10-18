// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
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
