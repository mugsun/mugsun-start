import type { Component } from 'vue'
import { Box, DataAnalysis, MagicStick, MapLocation, Setting, Share } from '@element-plus/icons-vue'

/** metadata icon 固定枚举（slices §4.1）。目前确定的只有这 5 个，其余等 S2 定稿。 */
export const MODULE_ICONS: Readonly<Record<string, Component>> = {
  system: Setting, flow: Share, map: MapLocation, track: DataAnalysis, ai: MagicStick
}
/** 不认识的 icon 退回默认图标，不报错 */
export const DEFAULT_MODULE_ICON: Component = Box
export function moduleIcon(name?: string | null): Component {
  return (name && Object.prototype.hasOwnProperty.call(MODULE_ICONS, name) && MODULE_ICONS[name]) || DEFAULT_MODULE_ICON
}
