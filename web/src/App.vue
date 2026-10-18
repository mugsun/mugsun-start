<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDark, useToggle, useMediaQuery, useOnline, useEventListener, useClipboard } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import enLocale from 'element-plus/es/locale/lang/en'
import AppHeader from './components/AppHeader.vue'
import ScopeCards from './components/ScopeCards.vue'
import ProjectForm from './components/ProjectForm.vue'
import ModuleList from './components/ModuleList.vue'
import PreviewTree from './components/PreviewTree.vue'
import ActionBar from './components/ActionBar.vue'
import StartDrawer from './components/StartDrawer.vue'
import { api, ApiError, isAbort } from './api'
import { generateErrorMessage } from './lib/errors'
import { form, scopeTypes, loadMetadata, applyQuery, toRequest, metaState, applyServerErrors } from './lib/store'
import { toQuery } from './lib/share'

const { t, locale } = useI18n()
const isDark = useDark({ storageKey: 'start-mugsun-theme' })
const toggleDark = useToggle(isDark)
const narrow = useMediaQuery('(max-width: 639px)')
const online = useOnline()
const { copy } = useClipboard({ legacy: true })
const epLocale = computed(() => (locale.value === 'en' ? enLocale : zhCn))

const formRef = ref<InstanceType<typeof ProjectForm>>()
const generating = ref(false)
const slow = ref(false)
const invalidCount = ref(0)
const drawer = ref(false)
const guideAvailable = ref(false)

applyQuery(location.search)
onMounted(() => { document.documentElement.lang = locale.value; loadMetadata() })

async function download() {
  if (generating.value || metaState.value !== 'ready') return
  const bad = (await formRef.value?.validateAll()) ?? 0
  invalidCount.value = bad
  if (bad) return
  generating.value = true
  slow.value = false
  const slowTimer = setTimeout(() => (slow.value = true), 10_000)
  try {
    const r = await api.generate(toRequest(), { locale: locale.value })
    const url = URL.createObjectURL(r.blob)
    const a = Object.assign(document.createElement('a'), { href: url, download: r.fileName })
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    drawer.value = true
    guideAvailable.value = true
  } catch (e) {
    if (isAbort(e)) return
    handleGenerateError(e)
  } finally {
    clearTimeout(slowTimer)
    generating.value = false
    slow.value = false
  }
}

/** §4.4：能映射的字段错误回填表单；其余见 lib/errors.ts */
function handleGenerateError(e: unknown) {
  const err = e instanceof ApiError ? e : null
  const n = applyServerErrors(err)
  if (n) {
    invalidCount.value = n
    formRef.value?.focusFirstServerError()
    return
  }
  const message = generateErrorMessage(err, t, locale.value)
  ElMessage({ type: 'error', message, duration: 6000, showClose: true })
}

async function share() {
  const url = `${location.origin}${location.pathname}?${toQuery({ ...form })}`
  history.replaceState(null, '', url)
  await copy(url)
  ElMessage.success(t('bar.shared'))
}

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); download() }
})
</script>

<template>
  <el-config-provider :locale="epLocale">
    <AppHeader :narrow="narrow" :dark="isDark" @toggle-dark="toggleDark()" />
    <div v-if="!online" class="offline" role="alert">{{ t('offline') }}</div>
    <main class="page">
      <div class="title">
        <h1>{{ t('title') }}</h1>
        <p>{{ t('subtitle') }}</p>
      </div>
      <div class="cols">
        <section class="col left" aria-labelledby="h-info">
          <h2 id="h-info">{{ t('info.title') }}</h2>
          <h3 class="sub">{{ t('info.scope') }}</h3>
          <ScopeCards v-model="form.type" :types="scopeTypes" :label="t('info.scope')" />
          <h3 class="sub">{{ t('info.meta') }}</h3>
          <ProjectForm ref="formRef" />
        </section>
        <section class="col right" aria-labelledby="h-mod">
          <h2 id="h-mod">{{ t('modules.title') }}</h2>
          <ModuleList @retry="loadMetadata()" />
        </section>
      </div>
      <PreviewTree class="pv" />
    </main>
    <ActionBar
      :narrow="narrow" :generating="generating" :slow="slow" :invalid-count="invalidCount" :show-guide="guideAvailable && !drawer"
      @download="download" @share="share" @guide="drawer = true" @close-alert="invalidCount = 0"
    />
    <StartDrawer v-model="drawer" :narrow="narrow" />
  </el-config-provider>
</template>

<style scoped>
.page { max-width: 1200px; margin: 0 auto; padding: 32px var(--gutter) 140px; }
.title h1 { font-size: 28px; font-weight: 600; margin: 0 0 8px; line-height: 1.3; }
.title p { margin: 0 0 24px; color: var(--el-text-color-secondary); }
.cols { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 7fr); gap: 24px; align-items: start; }
@media (max-width: 1023px) { .cols { grid-template-columns: minmax(0, 1fr); } }
.col { min-width: 0; }
.col h2 { font-size: 20px; font-weight: 600; margin: 0 0 16px; }
.sub { font-size: 14px; font-weight: 600; margin: 0 0 12px; color: var(--el-text-color-primary); }
.sub + * { margin-bottom: 24px; }
.left .sub:nth-of-type(n+2) { margin-top: 0; }
.pv { margin-top: 24px; }
.scope-sk { margin-bottom: 24px; }
.offline { background: var(--el-color-warning-light-9); color: var(--el-color-warning-dark-2); border-bottom: 1px solid var(--el-color-warning-light-5); text-align: center; padding: 8px 16px; font-size: 14px; }
@media (max-width: 639px) { .page { padding-top: 24px; } .title h1 { font-size: 22px; } }
</style>
