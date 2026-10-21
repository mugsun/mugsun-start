/**
 * 接口模式判定（构建期 vite.config 与运行期 src/api/index.ts 共用，规则只写一处）。
 *
 * - 开发/测试（非生产）：设了 VITE_API_BASE 走真接口，否则走内置 mock（「前端 mock 数据」）。
 * - 构建（任何 mode）：必须二选一——设 VITE_API_BASE（同源部署设 '/'），或显式设 VITE_USE_MOCK=1 做演示；
 *   两者都没有时直接报错，不再悄悄回落到 mock。
 * - VITE_USE_MOCK=1 优先于 VITE_API_BASE，便于在任何环境显式演示 mock。
 */
export type ApiMode = { mock: true } | { mock: false; base: string }

export interface ApiModeInput {
  production: boolean
  apiBase?: string
  useMock?: string
}

export const API_BASE_MISSING_MESSAGE =
  '[mugsun-start] 构建时缺少 VITE_API_BASE，已拒绝回落到 mock 数据。' +
  '修复：设置 VITE_API_BASE 为后端地址（前后端同源部署设 VITE_API_BASE=/）；' +
  '如确实要部署 mock 演示版，请显式设置 VITE_USE_MOCK=1。' +
  '\nVITE_API_BASE is missing at build time; refusing to fall back to mock data. ' +
  'Fix: set VITE_API_BASE to the backend URL (VITE_API_BASE=/ for same-origin deployment), ' +
  'or set VITE_USE_MOCK=1 explicitly for a mock demo build.'

export function resolveApiMode({ production, apiBase, useMock }: ApiModeInput): ApiMode {
  if (useMock?.trim() === '1') return { mock: true }
  const base = apiBase?.trim()
  if (base) return { mock: false, base }
  if (production) throw new Error(API_BASE_MISSING_MESSAGE)
  return { mock: true }
}
