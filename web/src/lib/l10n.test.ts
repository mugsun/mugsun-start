import { describe, it, expect } from 'vitest'
import { loc } from './l10n'
import type { L10n } from '@/api'

describe('loc', () => {
  it('en null or empty falls back to zh', () => {
    expect(loc({ zh: '中文', en: null } as unknown as L10n, 'en')).toBe('中文')
    expect(loc({ zh: '中文', en: '' }, 'en')).toBe('中文')
    expect(loc({ zh: '中文' } as unknown as L10n, 'en')).toBe('中文')
  })
  it('picks current language; zh missing falls back to en', () => {
    expect(loc({ zh: '中', en: 'en' }, 'zh-CN')).toBe('中')
    expect(loc({ zh: null, en: 'en' } as unknown as L10n, 'zh-CN')).toBe('en')
    expect(loc(null, 'en')).toBe('')
    expect(loc('plain', 'zh-CN')).toBe('plain')
  })
})
