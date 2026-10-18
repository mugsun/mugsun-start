import { describe, it, expect } from 'vitest'
import { resolveScopeTypes, defaultType, BACKEND, FULLSTACK } from './scope'
import type { ProjectType } from '@/api'

describe('scope types', () => {
  it('always two fallback types without api', () => {
    const r = resolveScopeTypes('zh-CN')
    expect(r.map((x) => x.id)).toEqual([BACKEND, FULLSTACK])
    expect(r[1].name).toBe('前后端')
    expect(resolveScopeTypes('en')[0].name).toBe('Backend only')
  })
  it('api text overrides; unknown ids ignored; empty falls back', () => {
    const api: ProjectType[] = [
      { id: FULLSTACK, name: { zh: '全栈', en: 'Full' }, description: { zh: '', en: '' }, action: '/starter.zip', tags: {} },
      { id: 'other', name: { zh: 'X', en: 'X' }, description: { zh: '', en: '' }, action: '/x', tags: {} }
    ]
    const r = resolveScopeTypes('zh-CN', api)
    expect(r.length).toBe(2)
    expect(r[1].name).toBe('全栈')
    expect(r[1].description).toBe('后端 + mugsun-pc 管理台（Vue 3）。')
  })
  it('default type', () => {
    expect(defaultType()).toBe(FULLSTACK)
    expect(defaultType([{ id: BACKEND, default: true, name: { zh: '', en: '' }, description: { zh: '', en: '' }, action: '', tags: {} }])).toBe(BACKEND)
  })
})
