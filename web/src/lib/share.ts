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

export function toQuery(s: ShareState): string {
  const q = new URLSearchParams()
  for (const k of KEYS) {
    const v = s[k]
    q.set(k, Array.isArray(v) ? v.join(',') : v)
  }
  return q.toString()
}

export function fromQuery(search: string): Partial<ShareState> {
  const q = new URLSearchParams(search)
  const out: Partial<ShareState> = {}
  for (const k of KEYS) {
    const v = q.get(k)
    if (v === null) continue
    if (k === 'dependencies') out.dependencies = v ? v.split(',').filter(Boolean) : []
    else out[k] = v
  }
  return out
}
