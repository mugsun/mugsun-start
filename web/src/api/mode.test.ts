import { describe, expect, it } from 'vitest'
import { API_BASE_MISSING_MESSAGE, resolveApiMode } from './mode'

describe('resolveApiMode（生产构建）', () => {
  it('设了 VITE_API_BASE、未设 VITE_USE_MOCK → 真接口', () => {
    expect(resolveApiMode({ production: true, apiBase: 'https://start.mugsun.com' })).toEqual({ mock: false, base: 'https://start.mugsun.com' })
  })
  it('同源部署 VITE_API_BASE=/ → 真接口', () => {
    expect(resolveApiMode({ production: true, apiBase: '/' })).toEqual({ mock: false, base: '/' })
  })
  it('未设 VITE_API_BASE、显式 VITE_USE_MOCK=1 → mock', () => {
    expect(resolveApiMode({ production: true, useMock: '1' })).toEqual({ mock: true })
  })
  it('两者都设 → VITE_USE_MOCK=1 优先，走 mock', () => {
    expect(resolveApiMode({ production: true, apiBase: '/', useMock: '1' })).toEqual({ mock: true })
  })
  it('两者都没设 → 报错并给出修复方法，不回落 mock', () => {
    expect(() => resolveApiMode({ production: true })).toThrow(API_BASE_MISSING_MESSAGE)
    expect(API_BASE_MISSING_MESSAGE).toContain('VITE_API_BASE=/')
    expect(API_BASE_MISSING_MESSAGE).toContain('VITE_USE_MOCK=1')
    expect(API_BASE_MISSING_MESSAGE).toContain('构建时缺少 VITE_API_BASE')
    expect(API_BASE_MISSING_MESSAGE).toContain('missing at build time')
  })
  it('空白值与 VITE_USE_MOCK≠1 视为未设', () => {
    expect(() => resolveApiMode({ production: true, apiBase: '  ', useMock: '0' })).toThrow(API_BASE_MISSING_MESSAGE)
    expect(() => resolveApiMode({ production: true, useMock: 'true' })).toThrow(API_BASE_MISSING_MESSAGE)
  })
})

describe('resolveApiMode（开发）', () => {
  it('未设 VITE_API_BASE → 默认 mock，便于本地开发', () => {
    expect(resolveApiMode({ production: false })).toEqual({ mock: true })
  })
  it('设了 VITE_API_BASE → 真接口', () => {
    expect(resolveApiMode({ production: false, apiBase: 'http://127.0.0.1:8081' })).toEqual({ mock: false, base: 'http://127.0.0.1:8081' })
  })
})
