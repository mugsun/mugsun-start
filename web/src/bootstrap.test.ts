// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { BOOT_ERROR_CSS, bootstrap } from './bootstrap'
import indexHtml from '../index.html?raw'
import { API_BASE_MISSING_MESSAGE, resolveApiMode } from './api/mode'

describe('bootstrap', () => {
  it('模块求值期抛出 API_BASE_MISSING_MESSAGE 时显示到 #app（role=alert，纯文本）', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const root = document.getElementById('app')!
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await bootstrap(root, async () => {
      resolveApiMode({ production: true })
    })
    const alert = root.querySelector('[role="alert"]')!
    expect(alert).not.toBeNull()
    expect(alert.textContent).toBe(API_BASE_MISSING_MESSAGE)
  })

  it('错误信息按文本插入，不解析 HTML', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const root = document.getElementById('app')!
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await bootstrap(root, async () => {
      throw new Error('<img src=x onerror=alert(1)>')
    })
    expect(root.querySelector('img')).toBeNull()
    expect(root.textContent).toBe('<img src=x onerror=alert(1)>')
  })

  it('正常启动时不显示错误', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    const root = document.getElementById('app')!
    const mount = vi.fn(async () => {})
    await bootstrap(root, mount)
    expect(mount).toHaveBeenCalledOnce()
    expect(root.querySelector('[role="alert"]')).toBeNull()
  })

  it('注入带 prefers-color-scheme: dark 的配色样式，且只注入一次', async () => {
    document.head.innerHTML = ''
    document.body.innerHTML = '<div id="app"></div>'
    const root = document.getElementById('app')!
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await bootstrap(root, async () => { throw new Error('x') })
    await bootstrap(root, async () => { throw new Error('y') })
    const styles = document.head.querySelectorAll('style#boot-error-style')
    expect(styles).toHaveLength(1)
    expect(styles[0].textContent).toBe(BOOT_ERROR_CSS)
    // 只断言关键色值，不写死整段 CSS
    const [light, dark] = BOOT_ERROR_CSS.split(/@media\s*\(prefers-color-scheme:\s*dark\)/)
    expect(dark).toBeDefined()
    expect(light).toMatch(/background:\s*#fef0f0/)
    expect(light).toMatch(/color:\s*#a8071a/)
    expect(light).toMatch(/border:[^;}]*#e04f4f/)
    expect(dark).toMatch(/\.boot-error-wrap\{[^}]*background:\s*#141414/)
    expect(dark).toMatch(/\.boot-error\{[^}]*background:\s*#2b1d1d/)
    expect(dark).toMatch(/\.boot-error\{[^}]*color:\s*#ffa39e/)
    expect(dark).toMatch(/\.boot-error\{[^}]*border-color:\s*#b35656/)
    expect(root.firstElementChild!.classList.contains('boot-error-wrap')).toBe(true)
    expect(root.querySelector('[role="alert"]')!.classList.contains('boot-error')).toBe(true)
  })
})

/** 运行 index.html 的首帧主题脚本（真实文件内容），模拟 localStorage 与系统偏好 */
function runThemeScript(stored: string | null, systemDark: boolean) {
  const code = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)![1]
  document.documentElement.className = ''
  localStorage.clear()
  if (stored !== null) localStorage.setItem('start-mugsun-theme', stored)
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: systemDark && q.includes('dark') }))
  new Function(code)()
  vi.unstubAllGlobals()
}

/** 在当前 html class 与给定系统偏好下，提示框/外层实际生效的声明（按 CSSOM 规则顺序后者覆盖前者） */
async function effective(systemDark: boolean) {
  document.head.innerHTML = ''
  document.body.innerHTML = '<div id="app"></div>'
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await bootstrap(document.getElementById('app'), async () => { throw new Error('x') })
  const sheet = (document.getElementById('boot-error-style') as HTMLStyleElement).sheet!
  const box = document.querySelector('.boot-error') as HTMLElement
  const wrap = document.querySelector('.boot-error-wrap') as HTMLElement
  const out = { wrapBg: '', boxBg: '', color: '' }
  const apply = (rule: CSSStyleRule) => {
    if (wrap.matches(rule.selectorText) && rule.style.background) out.wrapBg = rule.style.background
    if (box.matches(rule.selectorText)) {
      if (rule.style.background) out.boxBg = rule.style.background
      if (rule.style.color) out.color = rule.style.color
    }
  }
  for (const rule of Array.from(sheet.cssRules)) {
    if (rule instanceof CSSMediaRule) {
      if (systemDark && rule.conditionText.includes('prefers-color-scheme: dark')) Array.from(rule.cssRules).forEach((r) => apply(r as CSSStyleRule))
    } else apply(rule as CSSStyleRule)
  }
  return out
}

const hex = (c: string) => c.replace(/rgb\((\d+), (\d+), (\d+)\)/, (_, r, g, b) => '#' + [r, g, b].map((n: string) => (+n).toString(16).padStart(2, '0')).join(''))

describe('启动错误页跟随应用主题', () => {
  it('手动暗色（html.dark）→ 暗色，即使系统为亮色', async () => {
    runThemeScript('dark', false)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    const e = await effective(false)
    expect(hex(e.wrapBg)).toBe('#141414')
    expect(hex(e.boxBg)).toBe('#2b1d1d')
    expect(hex(e.color)).toBe('#ffa39e')
  })

  it('系统暗色但手动选了亮色（html.light）→ 亮色', async () => {
    runThemeScript('light', true)
    expect(document.documentElement.classList.contains('light')).toBe(true)
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    const e = await effective(true)
    expect(hex(e.wrapBg)).toBe('#ffffff')
    expect(hex(e.boxBg)).toBe('#fef0f0')
    expect(hex(e.color)).toBe('#a8071a')
  })

  it('跟随系统（auto）且系统暗色 → 暗色', async () => {
    runThemeScript('auto', true)
    const e = await effective(true)
    expect(hex(e.boxBg)).toBe('#2b1d1d')
  })

  it('外层 fixed 铺满视口并可滚动（替代 min-height:100vh）', async () => {
    document.body.innerHTML = '<div id="app"></div>'
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await bootstrap(document.getElementById('app'), async () => { throw new Error('x') })
    const wrap = document.querySelector('.boot-error-wrap') as HTMLElement
    expect(wrap.style.position).toBe('fixed')
    expect(wrap.style.inset).toMatch(/^0(px)?$/)
    expect(wrap.style.overflow).toBe('auto')
  })
})

