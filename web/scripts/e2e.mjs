// 布局断言（Playwright）。用法：先起 dev server，再 BASE=http://localhost:3093 node scripts/e2e.mjs
import { chromium } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:3093'
const browser = await chromium.launch()
let failed = 0
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failed++ }

async function buttons(width) {
  const page = await browser.newPage({ viewport: { width, height: 900 } })
  await page.goto(BASE)
  await page.waitForSelector('.mod-card')
  const share = await page.locator('.bar .btns > .el-button').boundingBox()
  const dl = await page.locator('.bar .tipwrap .el-button').boundingBox()
  await page.close()
  return { share, dl }
}

{
  const { share, dl } = await buttons(390)
  check(Math.abs(share.width - dl.width) <= 1, `390: buttons equal width (${share.width.toFixed(1)} / ${dl.width.toFixed(1)})`)
  check(Math.abs(share.y - dl.y) <= 1, '390: buttons on one row')
  check(share.width > 150, '390: buttons fill the row')
}
{
  const { share, dl } = await buttons(1440)
  check(share.width < 200 && dl.width < 200, `1440: buttons keep natural width (${share.width.toFixed(1)} / ${dl.width.toFixed(1)})`)
  check(Math.abs(share.height - dl.height) <= 1 && share.height < 44, `1440: normal height (${share.height} / ${dl.height})`)
  check(dl.x > share.x + share.width, '1440: download sits to the right of share')
}
await browser.close()
process.exit(failed ? 1 : 0)
