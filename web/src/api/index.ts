import { createHttpApi } from './http'
import { mockFetch, MOCK_BASE } from './mock'
import { resolveApiMode } from './mode'

export * from './types'
export { isAbort } from './http'

/**
 * 全站唯一的接口入口。设置 VITE_API_BASE 即切到真接口（同源部署设 '/'）；
 * 开发时未设置则同一套 HTTP 层打到内置 mock（mockFetch 模拟 §4 的响应），行为一致。
 * 生产构建未设 VITE_API_BASE 且未显式 VITE_USE_MOCK=1 时，构建期（vite.config）就会失败；
 * 这里在运行期再兜一次，抛出同样带修复方法的错误，绝不悄悄走 mock。
 */
const mode = resolveApiMode({
  production: import.meta.env.PROD,
  apiBase: import.meta.env.VITE_API_BASE,
  useMock: import.meta.env.VITE_USE_MOCK
})
export const usingMock = mode.mock
export const api = mode.mock ? createHttpApi(MOCK_BASE, mockFetch) : createHttpApi(mode.base, (u, i) => fetch(u, i))
