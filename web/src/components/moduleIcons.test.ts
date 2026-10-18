import { describe, it, expect } from 'vitest'
import { moduleIcon, MODULE_ICONS, DEFAULT_MODULE_ICON } from './moduleIcons'

describe('module icons', () => {
  it('maps the fixed enum', () => {
    expect(Object.keys(MODULE_ICONS).sort()).toEqual(['ai', 'flow', 'map', 'system', 'track'])
    for (const k of Object.keys(MODULE_ICONS)) expect(moduleIcon(k)).not.toBe(DEFAULT_MODULE_ICON)
  })
  it('unknown / empty icons fall back without throwing', () => {
    for (const n of ['security', 'lowcode', 'toString', '__proto__', '', undefined, null]) expect(moduleIcon(n)).toBe(DEFAULT_MODULE_ICON)
  })
})
