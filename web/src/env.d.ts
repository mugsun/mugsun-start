/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const c: DefineComponent<object, object, unknown>
  export default c
}
interface ImportMetaEnv {
  /** 真实接口根地址；同源部署设 '/'。开发时为空使用 mock；生产构建为空且未设 VITE_USE_MOCK=1 时报错 */
  readonly VITE_API_BASE?: string
  /** 设为 '1' 时显式使用内置 mock（演示用，优先于 VITE_API_BASE） */
  readonly VITE_USE_MOCK?: string
}
