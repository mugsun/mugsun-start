import { describe, it, expect } from 'vitest'
import css from './theme.css?raw'

const block = (sel: string) => css.slice(css.indexOf(sel + ' {'), css.indexOf('}', css.indexOf(sel + ' {')))

describe('theme tokens', () => {
  it('danger red light/dark', () => {
    for (const v of ['--el-color-danger', '--el-color-error']) {
      expect(block(':root')).toContain(`${v}: #c53030;`)
      expect(block('html.dark')).toContain(`${v}: #f78989;`)
    }
  })
  it('no element default blue', () => {
    expect(css.toLowerCase()).not.toContain('#409eff')
  })
  it('loading button keeps solid fill', () => {
    expect(css).toMatch(/\.el-button\.is-loading::before\s*\{[^}]*display:\s*none/)
  })
  it('checkbox inner focus style removed in module cards', () => {
    expect(css).toMatch(/\.mod-card \.el-checkbox__input\.is-focus/)
  })
})
