// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { BOOT_ERROR_CSS, bootstrap } from './bootstrap'
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
