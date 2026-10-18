import { ApiError } from '@/api'

type T = (key: string, values?: Record<string, unknown>) => string

/** 这些错误优先显示服务端 message（已按 Accept-Language 本地化），没有再用前端文案 */
const SERVER_MESSAGE_CODES = new Set(['UNKNOWN_DEPENDENCY', 'UNSUPPORTED_OPTION', 'INVALID_PARAMETER', 'DEPENDENCY_NOT_APPLICABLE', 'DEPENDENCY_CONFLICT', 'DEPENDENCY_REQUIRES'])
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
 */
export function generateErrorMessage(e: unknown, t: T): string {
  const err = e instanceof ApiError ? e : null
  const id = err?.requestId || '-'
  if (!err) return t('bar.failed', { id })
  if (err.code === 'RATE_LIMITED') return err.retryAfter !== undefined ? t('bar.rateLimited', { s: err.retryAfter }) : t('bar.rateLimitedNoWait')
  if (err.code === 'TIMEOUT') return t('bar.timeout')
  if (SERVER_MESSAGE_CODES.has(err.code)) {
    const msg = err.message?.trim()
    return msg ? t('bar.serverMessage', { msg, id }) : t(FALLBACK_KEY[err.code], { id })
  }
  return t('bar.failed', { id })
}
