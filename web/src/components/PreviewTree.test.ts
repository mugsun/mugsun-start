// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { api, ApiError } from '@/api'
import { i18n } from '@/i18n'
import * as s from '@/lib/store'
import PreviewTree from './PreviewTree.vue'

const ok = { requestId: 'r2', root: 'demo', fileCount: 1, dirCount: 0, truncated: false, tree: [{ name: 'pom.xml', path: 'pom.xml', type: 'file' as const, size: 1 }] }
const liveTexts = (w: ReturnType<typeof mount>) => w.findAll('[aria-live], [role="alert"], [role="status"]').map((n) => n.text())

beforeEach(() => {
  s.__resetForTest()
  vi.useFakeTimers()
  i18n.global.locale.value = 'zh-CN'
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
})
const mounted: ReturnType<typeof mount>[] = []
afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()); vi.useRealTimers(); vi.restoreAllMocks() })

async function mountLimited(retryAfter = 3) {
  const spy = vi.spyOn(api, 'preview').mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', 'x', 'r-9', [], retryAfter))
  const w = mount(PreviewTree, { global: { plugins: [i18n] } })
  mounted.push(w)
  s.metaState.value = 'ready'
  await flushPromises(); await nextTick()
  return { w, spy }
}
const btn = (w: ReturnType<typeof mount>) => w.find('.perr button')

describe('preview 429 panel', () => {
  it('message keeps the 429 value; only the button counts down (zh full-width brackets)', async () => {
    const { w } = await mountLimited(3)
    expect(w.find('.perr').text()).toContain('请求过于频繁，请在 3 秒后重试')
    expect(btn(w).text()).toBe('重试（3 秒）')
    expect(btn(w).attributes('disabled')).toBeDefined()
    await vi.advanceTimersByTimeAsync(1000); await nextTick()
    expect(btn(w).text()).toBe('重试（2 秒）')
    expect(w.find('.perr').text()).toContain('请在 3 秒后重试')
  })
  it('announces once on 429 and once when cooldown ends; countdown is not in a live region', async () => {
    const { w } = await mountLimited(3)
    await nextTick()
    expect(liveTexts(w)).toEqual(['请求过于频繁，请在 3 秒后重试'])
    for (const t of [1000, 1000]) {
      await vi.advanceTimersByTimeAsync(t); await nextTick()
      expect(liveTexts(w)).toEqual(['请求过于频繁，请在 3 秒后重试'])
      expect(liveTexts(w).join(' ')).not.toMatch(/秒）/)
    }
    expect(btn(w).element.closest('[aria-live], [role="alert"], [role="status"]')).toBeNull()
    await vi.advanceTimersByTimeAsync(1000); await nextTick()
    expect(liveTexts(w)).toEqual(['可以重试'])
    expect(btn(w).text()).toBe('重试')
    expect(btn(w).attributes('disabled')).toBeUndefined()
  })
  it('en: Retry (Ns)', async () => {
    i18n.global.locale.value = 'en'
    const { w } = await mountLimited(5)
    expect(btn(w).text()).toBe('Retry (5s)')
    await vi.advanceTimersByTimeAsync(5000); await nextTick()
    expect(liveTexts(w)).toEqual(['You can retry now'])
  })
  it('no form change during cooldown: no request when it ends; retry click sends one', async () => {
    const { w, spy } = await mountLimited(2)
    expect(spy).toHaveBeenCalledTimes(1)
    await s.loadPreview() // 例如加载时的默认值回填触发的调用，参数没变
    await vi.advanceTimersByTimeAsync(10_000); await nextTick()
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockResolvedValue(ok)
    await btn(w).trigger('click'); await flushPromises()
    expect(spy).toHaveBeenCalledTimes(2)
  })
  it('form changes during cooldown merge into one request sent when it ends', async () => {
    const { spy } = await mountLimited(2)
    spy.mockResolvedValue(ok)
    s.form.artifactId = 'a1'; await nextTick(); await vi.advanceTimersByTimeAsync(400)
    s.form.artifactId = 'a2'; await nextTick(); await vi.advanceTimersByTimeAsync(400)
    expect(spy).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(2000); await flushPromises()
    expect(spy).toHaveBeenCalledTimes(2)
    expect(spy.mock.calls[1][0].artifactId).toBe('a2')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(spy).toHaveBeenCalledTimes(2)
  })
})
