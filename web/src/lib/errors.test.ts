// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { ApiError } from '@/api'
import { i18n, setLocale } from '@/i18n'
import { generateErrorMessage } from './errors'

const t = (k: string, v?: Record<string, unknown>) => i18n.global.t(k, v ?? {})
const e = (code: string, message = '', details: { field: string; message: string }[] = []) => new ApiError(400, code, message, 'r-1', details)

describe('generate error message', () => {
  it('shows server message for UNKNOWN_DEPENDENCY / UNSUPPORTED_OPTION / unmapped INVALID_PARAMETER', () => {
    setLocale('zh-CN')
    expect(generateErrorMessage(e('UNKNOWN_DEPENDENCY', '模块 x 不存在。'), t)).toBe('模块 x 不存在。（错误编号：r-1）')
    expect(generateErrorMessage(e('UNSUPPORTED_OPTION', 'bootVersion 不支持'), t)).toBe('bootVersion 不支持（错误编号：r-1）')
    expect(generateErrorMessage(e('INVALID_PARAMETER', 'baseDir 有误', [{ field: 'baseDir', message: 'x' }]), t)).toBe('baseDir 有误（错误编号：r-1）')
  })
  it('falls back to frontend text when message is empty', () => {
    setLocale('en')
    expect(generateErrorMessage(e('UNKNOWN_DEPENDENCY'), t)).toContain('module that does not exist')
    expect(generateErrorMessage(e('UNSUPPORTED_OPTION', '  '), t)).toContain('not supported yet')
    expect(generateErrorMessage(e('INVALID_PARAMETER'), t)).toContain('The request is invalid')
  })
  it('other codes keep frontend text', () => {
    setLocale('en')
    expect(generateErrorMessage(new ApiError(500, 'GENERATION_FAILED', 'stack trace…', 'r-2'), t)).not.toContain('stack trace')
    expect(generateErrorMessage(new ApiError(429, 'RATE_LIMITED', '', 'r', [], 12), t)).toBe('Too many requests. Try again in 12 seconds.')
    expect(generateErrorMessage(new Error('x'), t)).toContain('-')
  })
})
