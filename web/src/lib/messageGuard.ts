/**
 * 服务端 message 守卫：不可信或不适合直接给用户看的文案改用前端 i18n。
 * 原始 message 只写 console（带 code、requestId），不显示。
 */

/**
 * message 最长字符数。后端 messages*.properties 最长一条约 130 字符（英文 artifactId 规则），
 * 加上参数后正常文案不会超过 200；超过基本是拼接了异常或调试信息，而且在 1440 宽的提示框里会超过两行。
 */
export const MAX_SERVER_MESSAGE = 200

/** CJK 统一表意文字（含扩展 A 和兼容区） */
const CJK_IDEOGRAPH = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/
/** 英文界面下出现即视为语言不一致：表意文字 + 中文标点 + 全角符号 */
const CJK_ANY = /[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/
/** 像堆栈：换行；堆栈行格式 at 包.类.方法(（如 "at com.mugsun.Foo.bar(Foo.java:12)"，不误伤 "Try again at a later time"）；Exception */
const STACK = [/[\r\n]/, /\bat [\w.$]+\(/, /Exception/]

export type GuardFail = 'empty' | 'tooLong' | 'language' | 'serverError' | 'stack'

export interface GuardContext { locale: string; status?: number; code?: string }

/** 返回不通过的原因；通过返回 null */
export function guardMessage(message: string | null | undefined, ctx: GuardContext): GuardFail | null {
  if ((ctx.status ?? 0) >= 500 || ctx.code === 'INTERNAL_ERROR') return 'serverError'
  const m = message ?? ''
  if (!m.trim()) return 'empty'
  if (STACK.some((r) => r.test(m))) return 'stack'
  if (m.length > MAX_SERVER_MESSAGE) return 'tooLong'
  const zh = ctx.locale.toLowerCase().startsWith('zh')
  if (zh ? !CJK_IDEOGRAPH.test(m) : CJK_ANY.test(m)) return 'language'
  return null
}

/** 不通过时把原文写进 console，界面不显示 */
export function logHidden(fail: GuardFail, message: string | null | undefined, meta: { code?: string; requestId?: string; field?: string }) {
  if (fail === 'empty') return
  console.warn('[start] server message hidden', { reason: fail, code: meta.code, requestId: meta.requestId, field: meta.field, message })
}

/** 通过返回去掉首尾空白的 message，否则返回 null（并记录日志） */
export function safeServerMessage(message: string | null | undefined, ctx: GuardContext & { requestId?: string; field?: string }): string | null {
  const fail = guardMessage(message, ctx)
  if (fail) { logHidden(fail, message, ctx); return null }
  return (message ?? '').trim()
}
