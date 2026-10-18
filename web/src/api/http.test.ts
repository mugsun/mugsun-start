import { describe, it, expect, vi } from 'vitest'
import { toFormParams, parseRetryAfter, parseContentDisposition, toApiError, createHttpApi, type FetchLike } from './http'
import { ApiError, type ProjectRequest } from './types'

const req: ProjectRequest = {
  type: 'mugsun-fullstack', groupId: 'com.example', artifactId: 'demo', name: 'demo', description: '中文 描述',
  packageName: 'com.example.demo', dependencies: ['gis', 'ai'], baseDir: 'demo'
}
const zipRes = (headers: Record<string, string> = {}) =>
  new Response('PK', { status: 200, headers: { 'Content-Type': 'application/zip', 'X-Request-Id': 'rid-1', ...headers } })

describe('serialize', () => {
  it('form params: comma deps, drops empty/undefined', () => {
    const q = toFormParams({ ...req, description: '', dependencies: ['gis', 'ai'] })
    expect(q.get('dependencies')).toBe('gis,ai')
    expect(q.has('description')).toBe(false)
    expect(q.get('baseDir')).toBe('demo')
    expect(toFormParams({ ...req, dependencies: [] }).has('dependencies')).toBe(false)
  })
  it('only sends contract fields; fixed options are never sent', () => {
    const keys = [...toFormParams(req).keys()].sort()
    expect(keys).toEqual(['artifactId', 'baseDir', 'dependencies', 'description', 'groupId', 'name', 'packageName', 'type'])
  })
})

describe('headers', () => {
  it('Retry-After: integer seconds only; anything else is undefined (default message)', () => {
    expect(parseRetryAfter('30')).toBe(30)
    expect(parseRetryAfter(' 5 ')).toBe(5)
    expect(parseRetryAfter('0')).toBe(0)
    for (const bad of [null, '', 'soon', '-1', '1.5', '30s', 'Wed, 21 Oct 2026 07:28:00 GMT']) expect(parseRetryAfter(bad)).toBeUndefined()
  })
  it('Content-Disposition', () => {
    expect(parseContentDisposition('attachment; filename="demo.zip"')).toBe('demo.zip')
    expect(parseContentDisposition('attachment; filename=demo.zip')).toBe('demo.zip')
    expect(parseContentDisposition("attachment; filename=\"x.zip\"; filename*=UTF-8''%E6%BC%94%E7%A4%BA.zip")).toBe('演示.zip')
    expect(parseContentDisposition('attachment; filename="../../etc.zip"')).toBe('.._.._etc.zip')
    expect(parseContentDisposition(null)).toBeUndefined()
  })
})

describe('error body (§4.4)', () => {
  it('parses code/message/requestId/details', async () => {
    const e = await toApiError(new Response(JSON.stringify({ code: 'INVALID_PARAMETER', message: 'm', requestId: '01J', details: [{ field: 'groupId', message: 'x' }] }), { status: 400, headers: { 'Content-Type': 'application/json' } }))
    expect([e.status, e.code, e.message, e.requestId, e.details[0].field]).toEqual([400, 'INVALID_PARAMETER', 'm', '01J', 'groupId'])
  })
  it('falls back to header requestId and HTTP code for non-JSON', async () => {
    const e = await toApiError(new Response('<html>', { status: 502, statusText: 'Bad Gateway', headers: { 'X-Request-Id': 'h-1' } }))
    expect([e.code, e.requestId, e.details]).toEqual(['HTTP_502', 'h-1', []])
  })
  it('429 with invalid Retry-After falls back to undefined', async () => {
    const e = await toApiError(new Response('{"code":"RATE_LIMITED","message":""}', { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': 'later' } }))
    expect(e.retryAfter).toBeUndefined()
  })
  it('429 reads Retry-After', async () => {
    const e = await toApiError(new Response(JSON.stringify({ code: 'RATE_LIMITED', message: '' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '30' } }))
    expect([e.code, e.retryAfter]).toEqual(['RATE_LIMITED', 30])
  })
})

describe('http api', () => {
  it('metadata: GET /api/v1/metadata with Accept-Language', async () => {
    const f = vi.fn<FetchLike>(async () => new Response('{"version":"x"}', { headers: { 'Content-Type': 'application/json' } }))
    await createHttpApi('https://s.test/', f).getMetadata({ locale: 'zh-CN' })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://s.test/api/v1/metadata')
    expect(new Headers(init!.headers).get('Accept-Language')).toBe('zh')
  })
  it('preview: POST JSON with array deps', async () => {
    const f = vi.fn<FetchLike>(async () => new Response('{"tree":[]}', { headers: { 'Content-Type': 'application/json' } }))
    await createHttpApi('https://s.test', f).preview(req, { locale: 'en' })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://s.test/api/v1/preview')
    expect(init!.method).toBe('POST')
    expect(JSON.parse(String(init!.body)).dependencies).toEqual(['gis', 'ai'])
  })
  it('generate: form body, filename from Content-Disposition', async () => {
    const f = vi.fn<FetchLike>(async () => zipRes({ 'Content-Disposition': 'attachment; filename="my.zip"' }))
    const r = await createHttpApi('https://s.test', f).generate(req, { locale: 'en' })
    expect(r.fileName).toBe('my.zip')
    expect(r.requestId).toBe('rid-1')
    expect(new URLSearchParams(String(f.mock.calls[0][1]!.body)).get('dependencies')).toBe('gis,ai')
  })
  it('generate: falls back to baseDir.zip; rejects non-zip content type', async () => {
    expect((await createHttpApi('', async () => zipRes()).generate(req, { locale: 'en' })).fileName).toBe('demo.zip')
    await expect(createHttpApi('', async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } })).generate(req, { locale: 'en' }))
      .rejects.toMatchObject({ code: 'BAD_RESPONSE' })
  })
  it('timeout aborts the request and throws TIMEOUT', async () => {
    let seen: AbortSignal | undefined
    const f: FetchLike = (_u, init) => new Promise((_r, rej) => { seen = init!.signal!; seen.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))) })
    await expect(createHttpApi('', f).generate(req, { locale: 'en', timeoutMs: 20 })).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(seen!.aborted).toBe(true)
  })
  it('external cancel throws AbortError, not ApiError', async () => {
    const ctrl = new AbortController()
    const f: FetchLike = (_u, init) => new Promise((_r, rej) => init!.signal!.addEventListener('abort', () => rej(new DOMException('a', 'AbortError'))))
    const p = createHttpApi('', f).getMetadata({ locale: 'en', signal: ctrl.signal })
    ctrl.abort()
    const e = await p.catch((x) => x)
    expect(e).toBeInstanceOf(DOMException)
    expect(e).not.toBeInstanceOf(ApiError)
  })
  it('network failure becomes NETWORK', async () => {
    await expect(createHttpApi('', async () => { throw new TypeError('Failed to fetch') }).getMetadata({ locale: 'en' })).rejects.toMatchObject({ code: 'NETWORK' })
  })
})
