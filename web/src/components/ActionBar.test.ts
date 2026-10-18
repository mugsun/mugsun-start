// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { ApiError } from '@/api'
import { i18n } from '@/i18n'
import * as s from '@/lib/store'
import ActionBar from './ActionBar.vue'

const mounted: ReturnType<typeof mount>[] = []
beforeEach(() => { s.__resetForTest(); s.metaState.value = 'ready'; vi.useFakeTimers(); i18n.global.locale.value = 'zh-CN' })
afterEach(() => { mounted.splice(0).forEach((w) => w.unmount()); vi.useRealTimers() })
const props = { narrow: false, generating: false, slow: false, invalidCount: 0, showGuide: false }
function bar() { const w = mount(ActionBar, { props, global: { plugins: [i18n] } }); mounted.push(w); return w }
const dl = (w: ReturnType<typeof mount>) => w.find('.tipwrap button')
const lives = (w: ReturnType<typeof mount>) => w.findAll('[aria-live], [role="alert"]')

describe('download 429 cooldown in the bar', () => {
  it('button counts down; hint keeps N + error ID; switches once at the end; announced once each', async () => {
    const w = bar()
    const live = w.find('[aria-live]').element
    const announced: string[] = []
    new MutationObserver(() => announced.push(live.textContent ?? '')).observe(live, { childList: true, characterData: true, subtree: true })
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r-7', [], 2)); await nextTick()
    expect(dl(w).text()).toBe('下载 ZIP（2 秒）')
    expect(dl(w).attributes('disabled')).toBeDefined()
    expect(w.find('.rate').text()).toBe('请求过于频繁，请在 2 秒后重试（错误编号：r-7）')
    expect(w.find('.rate').attributes('role')).toBeUndefined()
    expect(w.find('.rate .rid').text()).toBe('（错误编号：r-7）')
    expect(w.find('.rate').html()).not.toContain('v-html')
    expect(lives(w).map((n) => n.text())).toEqual(['请求过于频繁，请在 2 秒后重试'])
    await vi.advanceTimersByTimeAsync(1000); await nextTick()
    expect(dl(w).text()).toBe('下载 ZIP（1 秒）')
    expect(w.find('.rate').text()).toContain('请在 2 秒后重试')
    await vi.advanceTimersByTimeAsync(1000); await nextTick()
    expect(dl(w).text()).toBe('下载 ZIP')
    expect(dl(w).attributes('disabled')).toBeUndefined()
    expect(w.find('.rate').text()).toBe('请求过于频繁，现在可以重试（错误编号：r-7）')
    await vi.advanceTimersByTimeAsync(5000); await nextTick()
    expect(announced).toEqual(['请求过于频繁，请在 2 秒后重试', '可以重试'])
    expect(dl(w).element.closest('[aria-live], [role="alert"], [role="status"]')).toBeNull()
  })
  it('en labels', async () => {
    i18n.global.locale.value = 'en'
    const w = bar()
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r-8', [], 2)); await nextTick()
    expect(dl(w).text()).toBe('Download ZIP (2s)')
    await vi.advanceTimersByTimeAsync(2000); await nextTick()
    expect(w.find('.rate').text()).toBe('Too many requests. You can retry now. (Error ID: r-8)')
    expect(w.find('.rate .rid').text()).toBe('(Error ID: r-8)')
  })
  it('preview cooldown leaves the download button alone', async () => {
    const w = bar()
    s.previewCooldown.start(5); await nextTick()
    expect(dl(w).text()).toBe('下载 ZIP')
    expect(dl(w).attributes('disabled')).toBeUndefined()
    expect(w.find('.rate').exists()).toBe(false)
  })
  it('tooltip is disabled while cooling, back afterwards', async () => {
    const w = bar()
    const tip = () => w.findComponent({ name: 'ElTooltip' }).props('disabled')
    expect(tip()).toBe(false)
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r', [], 2)); await nextTick()
    expect(tip()).toBe(true)
    await vi.advanceTimersByTimeAsync(2000); await nextTick()
    expect(tip()).toBe(false)
  })
  it('shortcut/click during cooldown: beginDownload refuses and the countdown is not reset', async () => {
    const w = bar()
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r', [], 2)); await nextTick()
    await vi.advanceTimersByTimeAsync(1000)
    const until = s.downloadCooldown.until.value
    expect(s.beginDownload()).toBe(false)
    expect(s.downloadCooldown.until.value).toBe(until)
    expect(s.downloadError.value?.requestId).toBe('r')
    await nextTick()
    expect(dl(w).text()).toBe('下载 ZIP（1 秒）')
  })
  it('ready hint clears on next download, on form change, without extra announcements', async () => {
    const w = bar()
    const live = w.find('[aria-live]').element
    const announced: string[] = []
    new MutationObserver(() => announced.push(live.textContent ?? '')).observe(live, { childList: true, characterData: true, subtree: true })
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r', [], 1)); await nextTick()
    s.form.description = 'changed during cooldown'; await nextTick()
    expect(w.find('.rate').exists()).toBe(true) // 冷却中改表单不清
    await vi.advanceTimersByTimeAsync(1000); await nextTick()
    expect(w.find('.rate').text()).toContain('现在可以重试')
    s.form.description = 'changed again'; await nextTick(); await nextTick()
    expect(w.find('.rate').exists()).toBe(false)
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r2', [], 1)); await nextTick()
    await vi.advanceTimersByTimeAsync(1000); await nextTick()
    expect(s.beginDownload()).toBe(true); await nextTick()
    expect(w.find('.rate').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(3000); await nextTick()
    expect(announced).toEqual(['请求过于频繁，请在 1 秒后重试', '可以重试', '请求过于频繁，请在 1 秒后重试', '可以重试'])
  })
  it('narrow: hint is its own line above the buttons', async () => {
    const w = mount(ActionBar, { props: { ...props, narrow: true }, global: { plugins: [i18n] } }); mounted.push(w)
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r-11', [], 2)); await nextTick()
    const inner = w.find('.inner').element
    const kids = [...inner.children].map((c) => c.className)
    expect(kids.indexOf('rate rate-narrow')).toBeLessThan(kids.indexOf('btns'))
    expect(kids.indexOf('rate rate-narrow')).toBeGreaterThan(-1)
  })
})
