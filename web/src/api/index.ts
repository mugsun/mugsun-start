import type { StartApi, ProjectRequest, Metadata } from './types'
import { ApiError } from './types'
import { mockApi } from './mock'

export * from './types'

export const METADATA_TIMEOUT_MS = 10_000

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ApiError('Timeout', 0)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })
}

/** 真接口（initializr 兼容）。接口定稿后只需核对这里。 */
function httpApi(base: string): StartApi {
  return {
    async getMetadata(locale) {
      const res = await fetch(`${base}/`, { headers: { Accept: 'application/vnd.initializr.v2.2+json', 'Accept-Language': locale } })
      if (!res.ok) throw new ApiError(res.statusText, res.status, res.headers.get('X-Request-Id') ?? undefined)
      return (await res.json()) as Metadata
    },
    async generate(req: ProjectRequest) {
      const q = new URLSearchParams()
      for (const [k, v] of Object.entries(req)) q.set(k, Array.isArray(v) ? v.join(',') : String(v ?? ''))
      const res = await fetch(`${base}/starter.zip?${q}`)
      const requestId = res.headers.get('X-Request-Id') ?? ''
      if (!res.ok) throw new ApiError(res.statusText, res.status, requestId)
      return { blob: await res.blob(), fileName: `${req.artifactId}.zip`, requestId }
    }
  }
}

const base = import.meta.env.VITE_API_BASE
/** 全站唯一的接口入口：换成真接口只需设置 VITE_API_BASE */
export const api: StartApi = base ? httpApi(base) : mockApi
export const usingMock = !base
