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
await browser.close()
process.exit(failed ? 1 : 0)
