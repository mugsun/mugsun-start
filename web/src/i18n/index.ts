import { createI18n } from 'vue-i18n'
import zh from './zh'
import en from './en'

export type Locale = 'zh-CN' | 'en'
const KEY = 'start-mugsun-locale'

function initial(): Locale {
  try {
    const s = localStorage.getItem(KEY)
    if (s === 'zh-CN' || s === 'en') return s
  } catch { /* ignore */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh-CN' : 'en'
}

export const i18n = createI18n({ legacy: false, locale: initial(), fallbackLocale: 'zh-CN', messages: { 'zh-CN': zh, en } })

export function setLocale(l: Locale) {
  i18n.global.locale.value = l
  document.documentElement.lang = l
  try { localStorage.setItem(KEY, l) } catch { /* ignore */ }
}
