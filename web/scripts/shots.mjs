// 按规格第 9 节拍 16 张验收截图。用法：BASE=http://localhost:3093 OUT=<目录> node scripts/shots.mjs
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
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.el-message--error'); await p.waitForTimeout(400)
}, { full: false })
await run('13b-1440-dark-gen-fail', { dark: true, query: '?mock=gen-fail' }, async (p) => {
  await ready(p); await p.click('.el-button--primary:has-text("下载 ZIP")'); await p.waitForSelector('.el-message--error'); await p.waitForTimeout(400)
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
await browser.close()
