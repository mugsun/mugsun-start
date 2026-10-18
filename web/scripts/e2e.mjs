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
    check(/^重试（[12] 秒）$/.test(label), `download-429: button counts down (${label})`)
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
await browser.close()
process.exit(failed ? 1 : 0)
