import { createHttpApi } from './http'
import { mockFetch, MOCK_BASE } from './mock'

export * from './types'
export { isAbort } from './http'

const base = import.meta.env.VITE_API_BASE
/**
 * 全站唯一的接口入口。设置 VITE_API_BASE 即切到真接口；
 * 未设置时同一套 HTTP 层打到内置 mock（mockFetch 模拟 §4 的响应），行为一致。
 */
export const usingMock = !base
export const api = base ? createHttpApi(base, (u, i) => fetch(u, i)) : createHttpApi(MOCK_BASE, mockFetch)
