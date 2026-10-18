/** 窄屏（<1024px）常驻模块折叠规则 */
export const COLLAPSED_COUNT = 4
export const canCollapse = (total: number, compact: boolean) => compact && total > COLLAPSED_COUNT
export function visibleAlwaysOn<T>(list: readonly T[], compact: boolean, expanded: boolean): T[] {
  return canCollapse(list.length, compact) && !expanded ? list.slice(0, COLLAPSED_COUNT) : [...list]
}
