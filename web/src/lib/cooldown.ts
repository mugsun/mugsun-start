import { ref, computed, watch, type Ref } from 'vue'
import type { ApiError } from '@/api'

/** 后端每个 429 都带 Retry-After，缺省 1 秒（#10 ErrorResponses.DEFAULT_RETRY_AFTER_SECONDS）；没收到时前端也按 1 秒 */
export const COOLDOWN_DEFAULT_S = 1

/**
 * 429 冷却（预览、下载各建一个，互不影响）。
 * until：截止时间戳；remaining：剩余整秒（每 250ms 刷新，只给按钮读秒用）；seconds：收到 429 时的 Retry-After，之后不变。
 */
export function createCooldown() {
  const until = ref(0)
  const now = ref(Date.now())
  const seconds = ref<number | undefined>()
  let tick: ReturnType<typeof setInterval> | undefined
  const stopTick = () => { clearInterval(tick); tick = undefined }
  function start(retryAfter?: number) {
    stopTick()
    seconds.value = retryAfter
    now.value = Date.now()
    until.value = now.value + (retryAfter ?? COOLDOWN_DEFAULT_S) * 1000
    tick = setInterval(() => { now.value = Date.now(); if (now.value >= until.value) stopTick() }, 250)
  }
  function reset() { stopTick(); until.value = 0; seconds.value = undefined; now.value = Date.now() }
  const remaining = computed(() => Math.max(0, Math.ceil((until.value - now.value) / 1000)))
  const active = computed(() => remaining.value > 0)
  return { until, seconds, remaining, active, start, reset }
}
export type Cooldown = ReturnType<typeof createCooldown>

type T = (key: string, values?: Record<string, unknown>) => string

/**
 * 冷却的界面文案与读屏播报（预览面板、底栏下载共用）：
 * - text：冷却中「请在 N 秒后重试」（N 固定为收到 429 时的值），结束后切换一次为「现在可以重试」。text 不放进 live region；
 * - button：冷却中「重试（N 秒）」，只有它读秒；
 * - live：polite live region 的内容，只在收到 429 时（text）和冷却结束时（「可以重试」）各写一次。
 */
export function useCooldownView(cd: Cooldown, error: Ref<ApiError | null>, live: Ref<string>, t: T) {
  const limited = computed(() => error.value?.code === 'RATE_LIMITED')
  const text = computed(() => !cd.active.value ? t('cooldown.ready')
    : cd.seconds.value !== undefined ? t('bar.rateLimited', { s: cd.seconds.value }) : t('bar.rateLimitedNoWait'))
  const button = computed(() => t('cooldown.retryIn', { s: cd.remaining.value }))
  watch(cd.until, (u) => { if (u > Date.now()) live.value = text.value })
  watch(cd.active, (a, was) => { if (was && !a && cd.until.value > 0) live.value = t('cooldown.canRetry') })
  return { limited, text, button }
}
