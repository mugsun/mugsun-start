import type { L10n } from '@/api'

/** 取当前语言文案；对象缺项时回退到另一种语言；纯字符串原样返回 */
export function loc(v: L10n | string | undefined | null, locale: string): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  const zh = locale.toLowerCase().startsWith('zh')
  return (zh ? v.zh || v.en : v.en || v.zh) ?? ''
}
