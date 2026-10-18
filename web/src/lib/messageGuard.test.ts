import { describe, it, expect, vi, afterEach } from 'vitest'
import { guardMessage, safeServerMessage, MAX_SERVER_MESSAGE } from './messageGuard'

const zh = { locale: 'zh-CN', status: 400 }
const en = { locale: 'en', status: 400 }
afterEach(() => vi.restoreAllMocks())

describe('server message guard', () => {
  it('passes normal localized messages', () => {
    expect(guardMessage('未知的模块：legacy。', zh)).toBeNull()
    expect(guardMessage('Unknown module: legacy.', en)).toBeNull()
    expect(guardMessage('Check the fields that are marked.', en)).toBeNull()
    expect(guardMessage('Try again at a later time', en)).toBeNull()
    expect(guardMessage('失败 at com.mugsun.X', zh)).toBeNull() // 没有 "(" 不算堆栈行
    expect(guardMessage('Group 只能包含小写字母', zh)).toBeNull()
  })
  it('1) empty or whitespace', () => {
    for (const m of ['', '   ', '\t', null, undefined]) expect(guardMessage(m, zh)).toBe('empty')
  })
  it('2) too long (> MAX_SERVER_MESSAGE)', () => {
    expect(MAX_SERVER_MESSAGE).toBe(200)
    expect(guardMessage('错'.repeat(200), zh)).toBeNull()
    expect(guardMessage('错'.repeat(201), zh)).toBe('tooLong')
  })
  it('3) language mismatch', () => {
    expect(guardMessage('Unknown module: legacy.', zh)).toBe('language')
    expect(guardMessage('未知的模块：legacy。', en)).toBe('language')
    expect(guardMessage('Bad value（x）', en)).toBe('language') // 全角标点也算
  })
  it('4) HTTP 5xx and INTERNAL_ERROR', () => {
    expect(guardMessage('生成失败，请稍后重试。', { locale: 'zh-CN', status: 500 })).toBe('serverError')
    expect(guardMessage('模板暂不可用。', { locale: 'zh-CN', status: 503 })).toBe('serverError')
    expect(guardMessage('服务出错', { locale: 'zh-CN', status: 400, code: 'INTERNAL_ERROR' })).toBe('serverError')
  })
  it('5) stack-like: newline, "at ", Exception', () => {
    expect(guardMessage('第一行\n第二行', zh)).toBe('stack')
    expect(guardMessage('失败 at com.mugsun.Foo.bar(Foo.java:12)', zh)).toBe('stack')
    expect(guardMessage('at com.mugsun.Foo.bar(Foo.java:12)', en)).toBe('stack')
    expect(guardMessage('at Foo$Inner.run(Foo.java:3)', en)).toBe('stack')
    expect(guardMessage('NullPointerException 空指针', zh)).toBe('stack')
    expect(guardMessage('java.lang.IllegalStateException: boom\n\tat com.x.Y(Y.java:1)', en)).toBe('stack')
  })
  it('hidden message goes to console with code and requestId, not returned', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(safeServerMessage('Boom Exception', { ...en, code: 'INVALID_PARAMETER', requestId: 'r-1' })).toBeNull()
    expect(warn).toHaveBeenCalledWith('[start] server message hidden', expect.objectContaining({ code: 'INVALID_PARAMETER', requestId: 'r-1', message: 'Boom Exception', reason: 'stack' }))
    expect(safeServerMessage('  OK message.  ', en)).toBe('OK message.')
  })
})
