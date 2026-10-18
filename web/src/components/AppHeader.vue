<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { Moon, Sunny, Menu as MenuIcon, ArrowDown } from '@element-plus/icons-vue'
import { setLocale, type Locale } from '@/i18n'
import BrandLogo from './BrandLogo.vue'

defineProps<{ narrow: boolean; dark: boolean }>()
const emit = defineEmits<{ toggleDark: [] }>()
const { t, locale } = useI18n()
const DOCS = 'https://docs.mugsun.com'
const GITHUB = 'https://github.com/mugsun'
const langs: { id: Locale; label: string }[] = [{ id: 'zh-CN', label: '中文' }, { id: 'en', label: 'English' }]
const onMenu = (cmd: string) => {
  if (cmd === 'theme') emit('toggleDark')
  else window.open(cmd === 'docs' ? DOCS : GITHUB, '_blank', 'noopener')
}
</script>

<template>
  <header class="app-header">
    <div class="inner">
      <a href="/" class="logo">
        <BrandLogo :dark="dark" />
      </a>
      <nav class="actions">
        <a v-if="!narrow" class="link" :href="DOCS" target="_blank" rel="noopener">{{ t('header.docs') }}</a>
        <el-dropdown trigger="click" @command="(l: Locale) => setLocale(l)">
          <el-button text class="lang-btn" :aria-label="t('header.lang')">
            {{ locale === 'en' ? 'English' : '中文' }}<el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="l in langs" :key="l.id" :command="l.id" :lang="l.id">{{ l.label }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <template v-if="!narrow">
          <el-button text circle class="icon-btn" :aria-label="dark ? t('header.theme.toLight') : t('header.theme.toDark')" :title="dark ? t('header.theme.toLight') : t('header.theme.toDark')" @click="emit('toggleDark')">
            <el-icon :size="18"><Sunny v-if="dark" /><Moon v-else /></el-icon>
          </el-button>
          <a class="icon-btn gh" :href="GITHUB" target="_blank" rel="noopener" :aria-label="t('header.github')" :title="t('header.github')">
            <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
          </a>
        </template>
        <el-dropdown v-else trigger="click" @command="onMenu">
          <el-button text circle class="icon-btn" :aria-label="t('header.menu')"><el-icon :size="20"><MenuIcon /></el-icon></el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="docs">{{ t('header.docs') }}</el-dropdown-item>
              <el-dropdown-item command="theme">{{ dark ? t('header.theme.toLight') : t('header.theme.toDark') }}</el-dropdown-item>
              <el-dropdown-item command="github">{{ t('header.github') }}</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </nav>
    </div>
  </header>
</template>

<style scoped>
.app-header { height: 56px; border-bottom: 1px solid var(--el-border-color-light); background: var(--el-bg-color); position: sticky; top: 0; z-index: 20; }
.inner { max-width: 1200px; margin: 0 auto; padding: 0 var(--gutter); height: 100%; display: flex; align-items: center; justify-content: space-between; }
.logo { display: flex; align-items: center; height: 28px; text-decoration: none; border-radius: 6px; }
.actions { display: flex; align-items: center; gap: 8px; }
.link { color: var(--el-text-color-primary); text-decoration: none; font-size: 14px; padding: 6px 8px; border-radius: 8px; }
.link:hover { color: var(--link); }
.icon-btn { color: var(--el-text-color-regular); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; border-radius: 8px; }
.gh:hover { color: var(--el-text-color-primary); background: var(--el-fill-color-light); }
.lang-btn { white-space: nowrap; }
</style>
