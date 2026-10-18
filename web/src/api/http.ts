import type { CallOptions, ErrorBody, GenerateResult, Metadata, PreviewResult, ProjectRequest, StartApi } from './types'
import { ApiError } from './types'

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export const TIMEOUT = { metadata: 10_000, preview: 10_000, generate: 60_000 }

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

/** zh-CN → zh，其余 → en（与 §4.4 Accept-Language 约定一致） */
export const acceptLanguage = (locale: string) => (locale.toLowerCase().startsWith('zh') ? 'zh' : 'en')

/** §4.2：form-urlencoded，dependencies 逗号分隔，空值不传 */
export function toFormParams(req: ProjectRequest): URLSearchParams {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(req)) {
    if (v === undefined || v === null) continue
    if (Array.isArray(v)) { if (v.length) q.set(k, v.join(',')) } else if (v !== '') q.set(k, String(v))
  }
  return q
}

/** Retry-After：秒数或 HTTP 日期 */
/** Retry-After：后端只发整数秒；非法值返回 undefined，界面走默认提示 */
export function parseRetryAfter(v: string | null): number | undefined {
  const s = v?.trim() ?? ''
  return /^\d{1,6}$/.test(s) ? Number(s) : undefined
}

/** Content-Disposition 文件名：优先 filename*（RFC 5987），否则 filename */
export function parseContentDisposition(v: string | null): string | undefined {
  if (!v) return undefined
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(v)
  if (star) { try { return decodeURIComponent(star[2].trim().replace(/^"|"$/g, '')) } catch { /* 落到 filename */ } }
  const plain = /filename\s*=\s*("([^"]*)"|[^;]+)/i.exec(v)
  const name = plain ? (plain[2] ?? plain[1]).trim() : undefined
  return name ? name.replace(/[/\\]/g, '_') : undefined
}

/** 把非 2xx 响应解析为 ApiError（§4.4），容忍非 JSON 体 */
export async function toApiError(res: Response): Promise<ApiError> {
  const headerId = res.headers.get('X-Request-Id') ?? undefined
  let body: Partial<ErrorBody> = {}
  try {
    if ((res.headers.get('Content-Type') ?? '').includes('json')) body = (await res.json()) as Partial<ErrorBody>
  } catch { /* 非法 JSON 时用兜底 */ }
  return new ApiError(
    res.status,
    body.code ?? (res.status === 429 ? 'RATE_LIMITED' : `HTTP_${res.status}`),
    body.message ?? res.statusText ?? '',
    body.requestId ?? headerId,
    Array.isArray(body.details) ? body.details : [],
    res.status === 429 ? parseRetryAfter(res.headers.get('Retry-After')) : undefined
  )
}

/** 带超时和外部取消的 fetch。外部取消抛 AbortError；超时抛 ApiError(TIMEOUT) */
export async function call(fetchFn: FetchLike, url: string, init: RequestInit, o: CallOptions, defTimeout: number): Promise<Response> {
  const ctrl = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; ctrl.abort() }, o.timeoutMs ?? defTimeout)
  const onAbort = () => ctrl.abort()
  if (o.signal?.aborted) ctrl.abort()
  o.signal?.addEventListener('abort', onAbort)
  try {
    const headers = new Headers(init.headers)
    headers.set('Accept-Language', acceptLanguage(o.locale))
    const res = await fetchFn(url, { ...init, headers, signal: ctrl.signal })
    if (!res.ok) throw await toApiError(res)
    return res
  } catch (e) {
    if (e instanceof ApiError) throw e
    if (timedOut) throw new ApiError(0, 'TIMEOUT', 'Timeout')
    if (isAbort(e) || o.signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    throw new ApiError(0, 'NETWORK', e instanceof Error ? e.message : 'Network error')
  } finally {
    clearTimeout(timer)
    o.signal?.removeEventListener('abort', onAbort)
  }
}

export function createHttpApi(base: string, fetchFn: FetchLike): StartApi {
  const b = base.replace(/\/$/, '')
  return {
    async getMetadata(o) {
      const res = await call(fetchFn, `${b}/api/v1/metadata`, { headers: { Accept: 'application/json' } }, o, TIMEOUT.metadata)
      return (await res.json()) as Metadata
    },
    async preview(req, o) {
      const res = await call(fetchFn, `${b}/api/v1/preview`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(req)
      }, o, TIMEOUT.preview)
      return (await res.json()) as PreviewResult
    },
    async generate(req, o): Promise<GenerateResult> {
      const res = await call(fetchFn, `${b}/starter.zip`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/zip' }, body: toFormParams(req).toString()
      }, o, TIMEOUT.generate)
      const requestId = res.headers.get('X-Request-Id') ?? ''
      const ct = res.headers.get('Content-Type') ?? ''
      if (!ct.toLowerCase().startsWith('application/zip')) throw new ApiError(res.status, 'BAD_RESPONSE', `Unexpected Content-Type: ${ct}`, requestId)
      const fileName = parseContentDisposition(res.headers.get('Content-Disposition')) ?? `${req.baseDir || req.artifactId}.zip`
      return { blob: await res.blob(), fileName, requestId }
    }
  }
}
