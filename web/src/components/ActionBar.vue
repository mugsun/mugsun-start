<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { form, scopeTypes, metaState } from '@/lib/store'

const props = defineProps<{ narrow: boolean; generating: boolean; slow: boolean; invalidCount: number; showGuide: boolean }>()
const emit = defineEmits<{ download: []; share: []; guide: []; closeAlert: [] }>()
const { t } = useI18n()
const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
const key = isMac ? '⌘' : 'Ctrl'
const scopeName = computed(() => scopeTypes.value.find((v) => v.id === form.type)?.name ?? '')
const summary = computed(() => t('bar.summary', { scope: scopeName.value, n: form.dependencies.length, pkg: form.packageName }))
const blocked = computed(() => metaState.value !== 'ready')
const downloadTip = computed(() =>
  metaState.value === 'error' ? t('bar.disabledMeta') : metaState.value === 'loading' ? t('bar.disabledLoading') : t('bar.shortcut', { key })
)
void props
</script>

<template>
  <div class="bar-wrap">
    <div v-if="invalidCount > 0" class="alert-row">
      <el-alert type="error" :title="t('bar.invalid', { n: invalidCount })" show-icon :closable="true" @close="emit('closeAlert')" />
    </div>
    <div class="bar" role="region" :aria-label="t('bar.download')">
      <div class="inner">
        <div class="summary" :title="summary">{{ summary }}</div>
        <div class="btns">
          <span v-if="slow && !narrow" class="slow" role="status">{{ t('bar.slow') }}</span>
          <el-button v-if="showGuide && !narrow" link type="primary" @click="emit('guide')">{{ t('bar.guide') }}</el-button>
          <el-button class="b" @click="emit('share')">{{ t('bar.share') }}</el-button>
          <el-tooltip :content="downloadTip" placement="top">
            <span class="tipwrap" :tabindex="blocked ? 0 : -1">
              <el-button class="b" type="primary" :loading="generating" :disabled="blocked" :aria-keyshortcuts="isMac ? 'Meta+Enter' : 'Control+Enter'" @click="emit('download')">
                {{ generating ? t('bar.generating') : t('bar.download') }}
              </el-button>
            </span>
          </el-tooltip>
        </div>
      </div>
      <div v-if="narrow && (slow || showGuide)" class="sub">
        <span v-if="slow" role="status">{{ t('bar.slow') }}</span>
        <el-button v-else link type="primary" @click="emit('guide')">{{ t('bar.guide') }}</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bar-wrap { position: fixed; left: 0; right: 0; bottom: 0; z-index: 30; }
.alert-row { max-width: 1200px; margin: 0 auto 8px; padding: 0 var(--gutter); }
.bar { background: var(--el-bg-color-page); border-top: 1px solid var(--el-border-color-light); box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.06); }
.inner { max-width: 1200px; margin: 0 auto; padding: 0 var(--gutter); height: 64px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.summary { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--el-text-color-regular); }
.btns { display: flex; align-items: center; gap: 12px; flex: none; }
.btns .el-button + .el-button { margin-left: 0; }
.b { white-space: nowrap; min-width: max-content; }
.tipwrap { display: inline-flex; }
.tipwrap:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 8px; }
.slow { font-size: 13px; color: var(--el-text-color-secondary); white-space: nowrap; }
.sub { display: none; }
@media (max-width: 639px) {
  .inner { flex-direction: column; align-items: stretch; height: auto; padding: 8px var(--gutter) 10px; gap: 6px; }
  .summary { font-size: 12px; }
  .btns { gap: 8px; }
  .btns > * { flex: 1; }
  .b, .tipwrap, .tipwrap .el-button { width: 100%; height: 44px; }
  .sub { display: block; text-align: center; font-size: 12px; color: var(--el-text-color-secondary); padding-bottom: 6px; }
}
</style>
