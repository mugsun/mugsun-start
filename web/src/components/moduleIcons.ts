import type { Component } from 'vue'
import {
  Box, Connection, DataAnalysis, Document, EditPen, FolderOpened, Lock, MagicStick, MapLocation, Monitor, Setting, Share
} from '@element-plus/icons-vue'

/**
 * metadata icon 固定枚举（与后端 MetadataConsistency.ICONS 一致，S2 定稿共 11 个），每个名字一个不同的图标。
 * 常驻：system security audit file flow lowcode open ops；可选：map track ai。
 */
export const MODULE_ICONS: Readonly<Record<string, Component>> = {
  system: Setting,
  security: Lock,
  audit: Document,
  file: FolderOpened,
  flow: Share,
  lowcode: EditPen,
  open: Connection,
  ops: Monitor,
  map: MapLocation,
  track: DataAnalysis,
  ai: MagicStick
}
/** 不认识的 icon 退回默认图标，不报错 */
export const DEFAULT_MODULE_ICON: Component = Box
export function moduleIcon(name?: string | null): Component {
  return (name && Object.prototype.hasOwnProperty.call(MODULE_ICONS, name) && MODULE_ICONS[name]) || DEFAULT_MODULE_ICON
}
