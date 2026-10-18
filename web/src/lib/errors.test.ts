// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError } from '@/api'
import { i18n, setLocale } from '@/i18n'
import { generateErrorMessage } from './errors'

const t = (k: string, v?: Record<string, unknown>) => i18n.global.t(k, v ?? {})
const e = (code: string, message = '', status = 400, details: { field: string; reason?: string; message?: string }[] = []) => new ApiError(status, code, message, 'r-1', details)
const zh = (err: unknown) => { setLocale('zh-CN'); return generateErrorMessage(err, t, 'zh-CN') }
const en = (err: unknown) => { setLocale('en'); return generateErrorMessage(err, t, 'en') }

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('generate error message', () => {
  it('server message shown by default (with requestId)', () => {
    expect(zh(e('UNKNOWN_DEPENDENCY', '未知的模块：x。'))).toBe('未知的模块：x。（错误编号：r-1）')
    expect(zh(e('DEPENDENCY_CONFLICT', '所选模块之间存在冲突：gis。', 409))).toBe('所选模块之间存在冲突：gis。（错误编号：r-1）')
    expect(en(e('UNSUPPORTED_OPTION', 'This option is not supported in phase 1: 3.4.0.'))).toBe('This option is not supported in phase 1: 3.4.0. (Error ID: r-1)')
  })
  it('field="request" shows the server message as a generic error (guarded)', () => {
    const req = (m: string) => e('INVALID_PARAMETER', m, 400, [{ field: 'request', reason: 'invalid', message: m }])
    expect(zh(req('请求参数不正确。'))).toBe('请求参数不正确。（错误编号：r-1）')
    expect(zh(req('java.lang.IllegalStateException: x\n\tat a.B'))).toBe('请求参数有误，请检查项目信息后重试（错误编号：r-1）')
  })
  it('guard failures fall back to frontend text by code', () => {
    expect(zh(e('UNKNOWN_DEPENDENCY', '  '))).toBe('包含不存在的模块，请刷新页面后重试（错误编号：r-1）')
    expect(zh(e('UNSUPPORTED_OPTION', 'Not supported.'))).toBe('请求包含一期不支持的选项，请刷新页面后重试（错误编号：r-1）')
    expect(en(e('UNSUPPORTED_OPTION', '一期不支持'))).toContain('not supported yet')
    expect(en(e('INVALID_PARAMETER', 'x'.repeat(201)))).toContain('Invalid request. Check the project details')
    expect(en(e('INVALID_PARAMETER', 'Boom Exception'))).toContain('Invalid request. Check the project details')
  })
  it('5xx and INTERNAL_ERROR never show server text', () => {
    expect(zh(e('GENERATION_FAILED', '生成失败，请稍后重试。', 500))).toBe('生成失败，请稍后重试（错误编号：r-1）')
    expect(zh(e('INTERNAL_ERROR', '服务暂时出现问题', 500))).toBe('生成失败，请稍后重试（错误编号：r-1）')
    expect(en(e('TEMPLATE_UNAVAILABLE', 'The template is unavailable.', 503))).toBe('Generation failed. Try again later. (Error ID: r-1)')
  })
  it('unmapped codes fall back to the generic text; hidden text goes to console', () => {
    const warn = vi.mocked(console.warn)
    expect(en(e('NOT_FOUND', '请求的地址不存在。', 404))).toBe('Generation failed. Try again later. (Error ID: r-1)')
    expect(warn).toHaveBeenCalledWith('[start] server message hidden', expect.objectContaining({ code: 'NOT_FOUND', requestId: 'r-1', reason: 'language' }))
  })
  it('rate limit / timeout / non-ApiError keep frontend text', () => {
    expect(en(new ApiError(429, 'RATE_LIMITED', '', 'r', [], 12))).toBe('Too many requests. Try again in 12 seconds.')
    expect(en(new ApiError(0, 'TIMEOUT', 'Timeout'))).toContain('')
    expect(en(new Error('x'))).toBe('Generation failed. Try again later. (Error ID: -)')
  })
})
