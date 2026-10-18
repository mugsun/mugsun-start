import type { FieldSpec } from '@/api'

/** Java 关键字（含 var/record/yield 等上下文关键字，作包名段同样不可用） */
export const JAVA_KEYWORDS: ReadonlySet<string> = new Set(
  'abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while var record yield'.split(' ')
)
/** 字面量，同样不能作包名段 */
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

/** 包名 = Group + "." + Artifact（去掉连字符） */
export function derivePackage(group: string, artifact: string) {
  return [group, artifact.replace(/-/g, '')].filter(Boolean).join('.')
}
