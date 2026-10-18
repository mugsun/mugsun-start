import { describe, it, expect } from 'vitest'
import { canCollapse, visibleAlwaysOn, COLLAPSED_COUNT } from './collapse'

describe('always-on collapse', () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => i)
  it('wide screens show everything', () => {
    expect(visibleAlwaysOn(list(8), false, false)).toHaveLength(8)
  })
  it('narrow: first 4 until expanded', () => {
    expect(COLLAPSED_COUNT).toBe(4)
    expect(visibleAlwaysOn(list(8), true, false)).toEqual([0, 1, 2, 3])
    expect(visibleAlwaysOn(list(8), true, true)).toHaveLength(8)
    expect(visibleAlwaysOn(list(6), true, true)).toHaveLength(6)
  })
  it('no toggle when ≤ 4', () => {
    expect(canCollapse(4, true)).toBe(false)
    expect(canCollapse(5, true)).toBe(true)
    expect(visibleAlwaysOn(list(3), true, false)).toHaveLength(3)
  })
})
