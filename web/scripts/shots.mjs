// 按规格第 9 节拍验收截图（01–16），另加 17/18 两张错误态、19/20 两张 390 宽常驻模块收起/展开。用法：BASE=http://localhost:3093 OUT=<目录> node scripts/shots.mjs
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://localhost:3093'
const OUT = process.env.OUT ?? 'shots'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()

async function open({ w = 1440, lang = 'zh-CN', dark = false, query = '' }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light', locale: lang })
  await ctx.addInitScript(([l, d]) => { localStorage.setItem('start-mugsun-locale', l); localStorage.setItem('start-mugsun-theme', d ? 'dark' : 'light') }, [lang, dark])
  const page = await ctx.newPage()
  await page.goto(`${BASE}/${query}`)
  await page.evaluate(() => document.fonts.ready)
  return { ctx, page }
}
async function ready(page) { await page.waitForSelector('.mod-card'); await page.waitForTimeout(700) }
async function label(page) {
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.textContent = '前端 mock 数据'
    d.setAttribute('aria-hidden', 'true')
    Object.assign(d.style, { position: 'fixed', top: '64px', right: '12px', zIndex: 99999, background: '#d93026', color: '#fff', font: '600 13px/1 system-ui', padding: '6px 10px', borderRadius: '6px', pointerEvents: 'none' })
    document.body.appendChild(d)
  })
}
async function shot(page, name, { full = true } = {}) {
  await label(page)
  if (full) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight)
    const vp = page.viewportSize()
    await page.setViewportSize({ width: vp.width, height: Math.max(h, 900) })
    await page.waitForTimeout(250)
  }
  await page.screenshot({ path: `${OUT}/${name}.png` })
  console.log('ok', name)
}
const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean)
const run = async (name, opts, fn, shotOpts) => {
  if (ONLY.length && !ONLY.some((p) => name.startsWith(p + '-'))) return
  const { ctx, page } = await open(opts); try { await fn(page); await shot(page, name, shotOpts) } finally { await ctx.close() } }

await run('01-1440-zh-light', {}, ready)
await run('02-1440-zh-dark', { dark: true }, ready)
await run('03-1440-en-light', { lang: 'en' }, ready)
await run('04-1440-en-dark', { lang: 'en', dark: true }, ready)
await run('05-390-zh-light', { w: 390 }, ready)
await run('06-390-en-dark', { w: 390, lang: 'en', dark: true }, ready)
await run('07-1440-all-modules-highlight', {}, async (p) => {
  await ready(p)
  for (const c of await p.$$('.mod-card .mn')) await c.click()
  await p.waitForTimeout(400) // 防抖 300ms 后，1.5s 高亮期内
})
await run('08-1440-backend-only', {}, async (p) => { await ready(p); await p.click('.scope-card >> nth=0'); await p.waitForTimeout(1900) })
await run('09-1440-validation-errors', {}, async (p) => {
  await ready(p)
  await p.fill('#f-groupId', 'Com.1example')
  await p.fill('#f-packageName', 'com.example.class')
  await p.click('.el-button--primary:has-text("下载 ZIP")')
  await p.waitForTimeout(600)
}, { full: false })
await run('10-1440-modules-load-error', { query: '?mock=meta-error' }, async (p) => { await p.waitForSelector('.err'); await p.waitForTimeout(300) })
await run('11-1440-skeleton', { query: '?mock=meta-loading' }, async (p) => { await p.waitForTimeout(700) })
await run('12-1440-generating', { query: '?mock=gen-slow' }, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForTimeout(10_600)
}, { full: false })
await run('13-1440-generate-failed', { query: '?mock=gen-fail' }, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.el-message--error'); await p.mouse.move(5, 300); await p.waitForTimeout(400)
}, { full: false })
await run('13b-1440-dark-gen-fail', { dark: true, query: '?mock=gen-fail' }, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.el-message--error'); await p.mouse.move(5, 300); await p.waitForTimeout(400)
}, { full: false })
await run('14-1440-guide-drawer-light', {}, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.el-drawer__body'); await p.waitForTimeout(700)
}, { full: false })
await run('15-390-guide-drawer-dark', { w: 390, dark: true }, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.el-drawer__body'); await p.waitForTimeout(700)
}, { full: false })
await run('16-1440-keyboard-focus-module', {}, async (p) => {
  await ready(p)
  await p.click('h1')
  for (let i = 0; i < 40; i++) {
    await p.keyboard.press('Tab')
    if (await p.evaluate(() => !!document.activeElement?.closest('.mod-card'))) break
  }
  await p.keyboard.press('Space')
  await p.waitForTimeout(400)
}, { full: false })
/** 记录提示文字与其背景的实际颜色和对比度（WCAG 相对亮度） */
async function contrast(p, sel) {
  const r = await p.evaluate((sel) => Array.from(document.querySelectorAll(sel)).map((el) => {
    const fg = getComputedStyle(el).color
    let n = el, bg = 'rgba(0, 0, 0, 0)'
    while (n && (bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent')) { bg = getComputedStyle(n).backgroundColor; n = n.parentElement }
    return { text: el.textContent.trim(), fg, bg }
  }), sel)
  const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map(Number).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
  for (const x of r) { const a = lum(x.fg), b = lum(x.bg); console.log(`contrast ${sel} | ${x.text} | ${x.fg} on ${x.bg} | ${((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)}:1`) }
}
await run('17-1440-gen-429', { query: '?mock=gen-429' }, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.el-message--error'); await p.mouse.move(5, 300); await p.waitForTimeout(400)
  await contrast(p, '.el-message--error .el-message__content')
}, { full: false })
await run('18-1440-gen-invalid', { query: '?mock=gen-invalid' }, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.field-err'); await p.mouse.move(5, 300); await p.waitForTimeout(500)
  await contrast(p, '.field-err')
  await contrast(p, '.alert-row .el-alert__title')
}, { full: false })
await run('19-390-modules-collapsed', { w: 390 }, async (p) => {
  await ready(p); await p.locator('#mg-0').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80)); await p.waitForTimeout(300)
}, { full: false })
await run('20-390-modules-expanded', { w: 390 }, async (p) => {
  await ready(p); await p.locator('#mg-0').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80))
  const b = p.locator('.more'); const y0 = (await b.boundingBox()).y
  await b.click(); await p.mouse.move(5, 100); await p.waitForTimeout(300)
  console.log(`toggle y before ${Math.round(y0)} after expand ${Math.round((await p.locator('.more').boundingBox()).y)} expanded=${await p.locator('.more').getAttribute('aria-expanded')}`)
  const top = (await p.locator('#mg-0').boundingBox()).y
  await b.click(); await p.waitForTimeout(200)
  console.log(`after collapse toggle y ${Math.round((await p.locator('.more').boundingBox()).y)}; list top ${Math.round(top)} -> ${Math.round((await p.locator('#mg-0').boundingBox()).y)}`)
  await b.click(); await p.mouse.move(5, 100); await p.waitForTimeout(300)
  await p.locator('#mg-0').scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80)); await p.waitForTimeout(200)
}, { full: false })
await browser.close()
