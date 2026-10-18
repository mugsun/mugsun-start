// 布局断言（Playwright，走前端 mock）。
// 本地：先起 dev server，再 BASE=http://127.0.0.1:3093 node scripts/e2e.mjs；CI：pnpm e2e:ci（build 后 vite preview）。
// 失败时把截图和 trace 写到 e2e-artifacts/（CI 上传为 artifact）。
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3093'
const OUT = process.env.E2E_OUT ?? 'e2e-artifacts'
const browser = await chromium.launch()
let failed = 0
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++ }

async function buttons(width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })
  await ctx.tracing.start({ screenshots: true, snapshots: true })
  const page = await ctx.newPage()
  const before = failed
  try {
    await page.goto(BASE)
    await page.waitForSelector('.mod-card')
    const share = await page.locator('.bar .btns > .el-button').boundingBox()
    const dl = await page.locator('.bar .tipwrap .el-button').boundingBox()
    return { share, dl, done: async () => finish(ctx, page, width, before) }
  } catch (e) {
    failed++
    await finish(ctx, page, width, before)
    throw e
  }
}
async function finish(ctx, page, width, before) {
  if (failed > before) {
    mkdirSync(OUT, { recursive: true })
    await page.screenshot({ path: `${OUT}/layout-${width}.png`, fullPage: true }).catch(() => {})
    await ctx.tracing.stop({ path: `${OUT}/trace-${width}.zip` })
  } else {
    await ctx.tracing.stop()
  }
  await ctx.close()
}

{
  const { share, dl, done } = await buttons(390)
  check(Math.abs(share.width - dl.width) <= 1, `390: buttons equal width (${share.width.toFixed(1)} / ${dl.width.toFixed(1)})`)
  check(Math.abs(share.y - dl.y) <= 1, '390: buttons on one row')
  check(share.width > 150, '390: buttons fill the row')
  await done()
}
{
  const { share, dl, done } = await buttons(1440)
  check(share.width < 200 && dl.width < 200, `1440: buttons keep natural width (${share.width.toFixed(1)} / ${dl.width.toFixed(1)})`)
  check(Math.abs(share.height - dl.height) <= 1 && share.height < 44, `1440: normal height (${share.height} / ${dl.height})`)
  check(dl.x > share.x + share.width, '1440: download sits to the right of share')
  await done()
}
// 下载 429（?mock=download-429，Retry-After 2）：按钮读秒并禁用，提示 N 固定，结束后切换一次并恢复按钮
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-CN' })
  await ctx.addInitScript(() => localStorage.setItem('start-mugsun-locale', 'zh-CN'))
  await ctx.tracing.start({ screenshots: true, snapshots: true })
  const page = await ctx.newPage()
  const before = failed
  try {
    await page.goto(`${BASE}/?mock=download-429`)
    await page.waitForSelector('.mod-card')
    const btn = page.locator('.bar .tipwrap .el-button')
    await btn.click()
    await page.waitForSelector('.bar .rate')
    const label = (await btn.innerText()).trim()
    check(/^下载 ZIP（[12] 秒）$/.test(label), `download-429: button keeps its name + seconds (${label})`)
    await btn.blur(); await page.mouse.move(5, 5); await page.waitForTimeout(300)
    check(await page.locator('.el-popper:visible:has-text("快捷键")').count() === 0, 'download-429: no shortcut tooltip while disabled')
    const idBefore = (await page.locator('.bar .rate').innerText()).trim()
    await page.keyboard.press('Meta+Enter'); await page.keyboard.press('Control+Enter'); await page.waitForTimeout(300)
    const after = (await btn.innerText()).trim()
    check((await page.locator('.bar .rate').innerText()).trim() === idBefore, 'download-429: shortcut during cooldown sends no request (same error ID)')
    check(Number(after.match(/(\d+)/)?.[1] ?? 99) <= Number(label.match(/(\d+)/)?.[1] ?? 0), `download-429: countdown not reset by shortcut (${label} → ${after})`)
    check(await btn.isDisabled(), 'download-429: button disabled while cooling')
    const hint = (await page.locator('.bar .rate').innerText()).trim()
    check(/^请求过于频繁，请在 2 秒后重试（错误编号：.+）$/.test(hint), `download-429: hint keeps N (${hint})`)
    check((await page.locator('.bar [aria-live]').innerText()).includes('请在 2 秒后重试'), 'download-429: announced on arrival')
    check(await page.locator('.el-message--error').count() === 0, 'download-429: no alert toast')
    await page.waitForFunction(() => !document.querySelector('.bar .tipwrap .el-button').disabled, null, { timeout: 5000 })
    check((await btn.innerText()).trim() === '下载 ZIP', 'download-429: button restored after cooldown')
    check(/^请求过于频繁，现在可以重试（错误编号：.+）$/.test((await page.locator('.bar .rate').innerText()).trim()), 'download-429: hint switched to ready')
    check((await page.locator('.bar [aria-live]').innerText()).trim() === '可以重试', 'download-429: announced on end')
    check(await page.locator('.perr').count() === 0, 'download-429: preview unaffected')
  } catch (e) {
    failed++; console.log('FAIL download-429:', e.message)
  }
  if (failed > before) {
    mkdirSync(OUT, { recursive: true })
    await page.screenshot({ path: `${OUT}/download-429.png`, fullPage: true }).catch(() => {})
    await ctx.tracing.stop({ path: `${OUT}/trace-download-429.zip` })
  } else await ctx.tracing.stop()
  await ctx.close()
}
// 下载 429 布局：390 提示在按钮上方单独一行、可换行无省略号、错误编号全文；两按钮仍等宽且文字不溢出。1440 英文不重叠
async function rateLayout(width, lang) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, locale: lang })
  await ctx.addInitScript((l) => localStorage.setItem('start-mugsun-locale', l), lang)
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}/?mock=download-429`)
    await page.waitForSelector('.mod-card')
    await page.locator('.bar .tipwrap .el-button').click()
    await page.waitForSelector('.bar .rate')
    return await page.evaluate(() => {
      const r = document.querySelector('.bar .rate'); const cs = getComputedStyle(r)
      const share = document.querySelector('.bar .btns > .el-button'); const dl = document.querySelector('.bar .tipwrap .el-button')
      const box = (e) => e.getBoundingClientRect().toJSON()
      const span = dl.querySelector('span')
      return {
        rate: box(r), share: box(share), dl: box(dl), summary: box(document.querySelector('.bar .summary')),
        text: r.textContent, clipped: cs.textOverflow === 'ellipsis' || r.scrollWidth > r.clientWidth + 1 || r.scrollHeight > r.clientHeight + 1,
        dlOverflow: span ? span.scrollWidth > dl.clientWidth : false, dlText: dl.textContent.trim()
      }
    })
  } finally { await ctx.close() }
}
try {
  const n = await rateLayout(390, 'zh-CN')
  check(n.rate.bottom <= Math.min(n.share.top, n.dl.top) + 0.5, `390 download-429: hint above buttons (${n.rate.bottom.toFixed(0)} ≤ ${n.dl.top.toFixed(0)})`)
  check(!n.clipped, '390 download-429: hint not truncated')
  check(/（错误编号：01MOCK[0-9A-Z]{10}）$/.test(n.text), `390 download-429: full error ID visible (${n.text})`)
  check(n.rate.right <= 390 && n.rate.left >= 0, '390 download-429: hint within viewport')
  check(Math.abs(n.share.width - n.dl.width) <= 1 && Math.abs(n.dl.width - 175) <= 1, `390 download-429: buttons equal width (${n.share.width} / ${n.dl.width})`)
  check(!n.dlOverflow, `390 download-429: button text fits (${n.dlText})`)
  const e = await rateLayout(1440, 'en')
  const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
  check(!overlap(e.rate, e.share) && !overlap(e.rate, e.dl) && !overlap(e.rate, e.summary), '1440 en download-429: hint does not overlap summary/buttons')
  check(!e.clipped && /\(Error ID: 01MOCK[0-9A-Z]{10}\)$/.test(e.text), `1440 en download-429: full text (${e.text})`)
  check(e.share.width < 200 && e.share.height < 44, `1440 en download-429: share keeps size (${e.share.width.toFixed(0)}x${e.share.height})`)
  check(!e.dlOverflow, `1440 en download-429: button text fits (${e.dlText})`)
} catch (err) { failed++; console.log('FAIL rate layout:', err.message) }
await browser.close()
process.exit(failed ? 1 : 0)
