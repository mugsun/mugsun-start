import type { Fields } from '@/api'
import { checkField } from './validate'

export interface ShareState {
  type: string
  groupId: string
  artifactId: string
  name: string
  packageName: string
  description: string
  dependencies: string[]
}

const KEYS: (keyof ShareState)[] = ['type', 'groupId', 'artifactId', 'name', 'packageName', 'description', 'dependencies']

/** 与 §4.3 GET /api/v1/preview、§4.2 GET /starter.zip 的 query 同名，可直接复用 */
export function toQuery(s: ShareState): string {
  const q = new URLSearchParams()
  for (const k of KEYS) {
    const v = s[k]
    q.set(k, Array.isArray(v) ? v.join(',') : v)
  }
  return q.toString()
}

/**
 * 解析分享链接并校验：类型须在 allowedTypes 里，字段按 fields 规则，依赖只保留形如 id 的值。
 * 不合法的参数直接丢弃，回退为默认值。
 */
export function fromQuery(search: string, opts: { fields: Fields; allowedTypes: string[] }): Partial<ShareState> {
  const q = new URLSearchParams(search)
  const out: Partial<ShareState> = {}
  const t = q.get('type')
  if (t && opts.allowedTypes.includes(t)) out.type = t
  for (const k of ['groupId', 'artifactId', 'name', 'description'] as const) {
    const v = q.get(k)
    if (v !== null && checkField(v, opts.fields[k]) === null && (k === 'description' || v !== '')) out[k] = v
  }
  const p = q.get('packageName')
  if (p && checkField(p, opts.fields.packageName, { javaPackage: true }) === null) out.packageName = p
  const d = q.get('dependencies')
  if (d !== null) out.dependencies = [...new Set(d.split(',').map((s) => s.trim()).filter((s) => /^[a-z][a-z0-9-]{0,49}$/.test(s)))]
  return out
}
