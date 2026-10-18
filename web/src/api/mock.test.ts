import { describe, it, expect } from 'vitest'
import { buildMockMetadata } from './mock'

describe('mock metadata', () => {
  it('initializr shape', () => {
    const m = buildMockMetadata('zh-CN')
    expect(m.dependencies.type).toBe('hierarchical-multi-select')
    const all = m.dependencies.values.flatMap((g) => g.values)
    expect(all.filter((d) => d.required).length).toBe(4)
    expect(all.filter((d) => !d.required).map((d) => d.id)).toEqual(['mugsun-gis', 'mugsun-track', 'mugsun-ai'])
    expect(m.type.values.map((t) => t.id)).toContain(m.type.default)
    expect(m.groupId.default).toBe('com.example')
  })
  it('localized', () => {
    expect(buildMockMetadata('en').dependencies.values[1].values[0].description).toMatch(/Maps/)
  })
})
