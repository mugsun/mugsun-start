/// <reference types="vite/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const c: DefineComponent<object, object, unknown>
  export default c
}
interface ImportMetaEnv {
  /** 真实接口根地址；为空时使用 mock */
  readonly VITE_API_BASE?: string
}
