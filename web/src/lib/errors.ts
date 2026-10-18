import { ApiError } from '@/api'
import { safeServerMessage } from './messageGuard'

type T = (key: string, values?: Record<string, unknown>) => string

/**
 * 错误码 → 前端文案。服务端 message 过不了守卫（lib/messageGuard.ts）时使用；
 * 映射不到的错误码用「生成失败，请稍后重试」。
 */
const FALLBACK_KEY: Record<string, string> = {
  UNKNOWN_DEPENDENCY: 'bar.unknownDependency',
  UNSUPPORTED_OPTION: 'bar.unsupported',
  INVALID_PARAMETER: 'bar.invalidOther',
  DEPENDENCY_NOT_APPLICABLE: 'bar.invalidOther',
  DEPENDENCY_CONFLICT: 'bar.invalidOther',
  DEPENDENCY_REQUIRES: 'bar.invalidOther'
}

/**
 * 生成失败时的提示文案（字段能映射回表单的 INVALID_PARAMETER 由调用方先处理）。
 * INVALID_PARAMETER 走到这里说明字段不在表单里（body、request、baseDir…）：服务端 message 是「请检查标出的字段」，
 * 页面上没有可标的字段，所以一律用前端通用文案 bar.invalidOther。
 * 其他错误码：服务端 message 默认显示，过不了守卫时按错误码用前端文案，都附 requestId。
 */
export function generateErrorMessage(e: unknown, t: T, locale: string): string {
  const err = e instanceof ApiError ? e : null
  const id = err?.requestId || '-'
  if (!err) return t('bar.failed', { id })
  if (err.code === 'RATE_LIMITED') return err.retryAfter !== undefined ? t('bar.rateLimited', { s: err.retryAfter }) : t('bar.rateLimitedNoWait')
  if (err.code === 'TIMEOUT') return t('bar.timeout')
  if (err.code === 'NETWORK' || err.code === 'BAD_RESPONSE' || err.status === 0) return t('bar.failed', { id })
  if (err.code === 'INVALID_PARAMETER') return t('bar.invalidOther', { id })
  const msg = safeServerMessage(err.message, { locale, status: err.status, code: err.code, requestId: err.requestId })
  if (msg) return t('bar.serverMessage', { msg, id })
  return t(FALLBACK_KEY[err.code] ?? 'bar.failed', { id })
}
