import type { FieldSpec } from '@/api'

/**
 * 与后端一致：javax.lang.model.SourceVersion.isKeyword(s, RELEASE_21)。
 * 即 JLS 21 §3.9 的 51 个保留关键字（含 const、goto、strictfp 和 Java 9 起的 _）；
 * 上下文关键字（var、record、yield、sealed、permits、module 等）不算，可以作包名段。
 */
export const JAVA_KEYWORDS: ReadonlySet<string> = new Set(
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while _'.split(' ')
)
/** 字面量（isKeyword 对它们同样返回 true），不能作包名段 */
export const JAVA_LITERALS: ReadonlySet<string> = new Set(['true', 'false', 'null'])
export const isReservedSegment = (s: string) => JAVA_KEYWORDS.has(s) || JAVA_LITERALS.has(s)

export type FieldError = 'required' | 'maxLength' | 'pattern' | 'keyword' | null

/** 按 metadata 下发的 FieldSpec 校验；包名额外检查 Java 关键字（后端约定未覆盖，前端加严） */
export function checkField(v: string, spec: FieldSpec | undefined, opts: { javaPackage?: boolean } = {}): FieldError {
  if (!spec) return null
  if (!v) return spec.required ? 'required' : null
  if (spec.maxLength !== undefined && v.length > spec.maxLength) return 'maxLength'
  if (spec.pattern) {
    let re: RegExp | null = null
    try { re = new RegExp(spec.pattern) } catch { re = null }
    if (re && !re.test(v)) return 'pattern'
  }
  if (opts.javaPackage && v.split('.').some(isReservedSegment)) return 'keyword'
  return null
}

/**
 * 包名 = Group + "." + Artifact，连字符换成 _，整体转小写。
 * 与后端 ProjectRequestValidator.derivedPackageName（#10 @206b946）逐字一致：只做这两步，不清理其他字符
 * （Group/Artifact 的非法字符、数字开头由各自字段校验拦下）。shop-admin → shop_admin，in-t → in_t。
 */
export function derivePackage(group: string, artifact: string) {
  return [group, artifact].filter(Boolean).join('.').replace(/-/g, '_').toLowerCase()
}
