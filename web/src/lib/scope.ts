import type { ProjectType } from '@/api'
import { FALLBACK_TYPES } from './defaults'
import { loc } from './l10n'

export { BACKEND, FULLSTACK } from './defaults'
export interface ScopeView { id: string; name: string; description: string }

/** 生成范围始终显示前端兜底的两项；接口返回同 id 时用接口文案覆盖，接口失败不影响 */
export function resolveScopeTypes(locale: string, fromApi?: ProjectType[]): ScopeView[] {
  return FALLBACK_TYPES.map((b) => {
    const api = fromApi?.find((x) => x.id === b.id)
    return {
      id: b.id,
      name: loc(api?.name, locale) || loc(b.name, locale),
      description: loc(api?.description, locale) || loc(b.description, locale)
    }
  })
}

/** 默认类型：接口里标 default 的，其次兜底里的 */
export function defaultType(fromApi?: ProjectType[]): string {
  return fromApi?.find((x) => x.default && FALLBACK_TYPES.some((b) => b.id === x.id))?.id ?? FALLBACK_TYPES.find((b) => b.default)!.id
}
