import { describe, it, expect } from 'vitest'
import { moduleIcon, MODULE_ICONS, DEFAULT_MODULE_ICON } from './moduleIcons'
import { buildMockMetadata } from '@/api/mock'

const NAMES = ['system', 'security', 'audit', 'file', 'flow', 'lowcode', 'open', 'ops', 'map', 'track', 'ai']

describe('module icons', () => {
  it('all 11 fixed names have an icon', () => {
    expect(Object.keys(MODULE_ICONS).sort()).toEqual([...NAMES].sort())
    for (const n of NAMES) expect(moduleIcon(n)).not.toBe(DEFAULT_MODULE_ICON)
  })
  it('icons are all different', () => {
    const icons = NAMES.map((n) => moduleIcon(n))
    expect(new Set(icons).size).toBe(11)
  })
  it('every icon used by the mock metadata is known', () => {
    const m = buildMockMetadata()
    for (const d of [...m.modules.alwaysOn, ...m.modules.optional]) expect(NAMES).toContain(d.icon)
  })
  it('unknown / empty icons fall back without throwing', () => {
    for (const n of ['message', 'lowcode2', 'toString', '__proto__', '', undefined, null]) expect(moduleIcon(n)).toBe(DEFAULT_MODULE_ICON)
  })
})
