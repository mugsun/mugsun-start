import { describe, it, expect } from 'vitest'
import { resolveScopeTypes, BACKEND, FULLSTACK } from './scope'

const t = (k: string) => `T(${k})`

describe('scope types', () => {
  it('always two constants without api', () => {
    const r = resolveScopeTypes(t)
    expect(r.map((x) => x.id)).toEqual([BACKEND, FULLSTACK])
    expect(r[1].name).toBe('T(scope.fullstack.name)')
  })
  it('api text overrides, unknown ids ignored, empty text falls back', () => {
    const r = resolveScopeTypes(t, [
      { id: FULLSTACK, name: 'Full', description: '', action: '/starter.zip', tags: {} },
      { id: 'other', name: 'X', action: '/x', tags: {} }
    ])
    expect(r.length).toBe(2)
    expect(r[1].name).toBe('Full')
    expect(r[1].description).toBe('T(scope.fullstack.desc)')
  })
})
