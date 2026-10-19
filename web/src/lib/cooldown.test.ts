// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref, nextTick } from 'vue'
import { ApiError } from '@/api'
import { i18n } from '@/i18n'
import { createCooldown, useCooldownView, COOLDOWN_DEFAULT_S } from './cooldown'
import * as s from './store'

const t = (k: string, v?: Record<string, unknown>) => String(i18n.global.t(k, v ?? {}))
beforeEach(() => { vi.useFakeTimers(); i18n.global.locale.value = 'zh-CN'; s.__resetForTest() })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe('createCooldown', () => {
  it('default is 1s when Retry-After is missing (matches backend)', async () => {
    expect(COOLDOWN_DEFAULT_S).toBe(1)
    const cd = createCooldown()
    cd.start(undefined)
    expect(cd.remaining.value).toBe(1)
    await vi.advanceTimersByTimeAsync(1000)
    expect(cd.active.value).toBe(false)
  })
})

describe('useCooldownView', () => {
  it('text keeps N, switches once to ready; live written only on arrival and end', async () => {
    const cd = createCooldown(); const err = ref<ApiError | null>(null); const live = ref('')
    const v = useCooldownView(cd, err, live, t)
    const writes: string[] = []
    const { watch } = await import('vue'); watch(live, (x) => writes.push(x), { flush: 'sync' })
    err.value = new ApiError(429, 'RATE_LIMITED', 'x', 'r', [], 3); cd.start(3); await nextTick()
    expect(v.text.value).toBe('请求过于频繁，请在 3 秒后重试')
    expect(v.button.value).toBe('重试（3 秒）')
    await vi.advanceTimersByTimeAsync(1000); await nextTick()
    expect(v.text.value).toBe('请求过于频繁，请在 3 秒后重试')
    expect(v.button.value).toBe('重试（2 秒）')
    await vi.advanceTimersByTimeAsync(2000); await nextTick()
    expect(v.text.value).toBe('请求过于频繁，现在可以重试')
    await vi.advanceTimersByTimeAsync(5000); await nextTick()
    expect(writes).toEqual(['请求过于频繁，请在 3 秒后重试', '可以重试'])
  })
})

describe('preview and download cooldowns are independent', () => {
  it('download cooldown does not block preview, and vice versa', async () => {
    s.onDownloadRateLimited(new ApiError(429, 'RATE_LIMITED', 'x', 'r', [], 2))
    expect(s.downloadCooldown.active.value).toBe(true)
    expect(s.previewCooldown.active.value).toBe(false)
    const { api } = await import('@/api')
    const spy = vi.spyOn(api, 'preview').mockRejectedValueOnce(new ApiError(429, 'RATE_LIMITED', 'x', 'r', [], 5))
    await s.loadPreview()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(s.previewCooldown.remaining.value).toBe(5)
    expect(s.downloadCooldown.remaining.value).toBe(2)
    await vi.advanceTimersByTimeAsync(2000)
    expect(s.downloadCooldown.active.value).toBe(false)
    expect(s.previewCooldown.active.value).toBe(true)
  })
})
