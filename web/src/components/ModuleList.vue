<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { WarningFilled, TopRight } from '@element-plus/icons-vue'
import { form, alwaysOn, optional, metaState, BACKEND } from '@/lib/store'
import { loc } from '@/lib/l10n'
import type { OptionalModule } from '@/api'

const emit = defineEmits<{ retry: [] }>()
const { t, locale } = useI18n()
import { moduleIcon as icon } from './moduleIcons'
const L = (v: Parameters<typeof loc>[0]) => loc(v, locale.value)
const disabledFor = (d: OptionalModule) => !d.appliesTo.includes(form.type)
const backendNote = (d: OptionalModule) => (form.type === BACKEND ? L(d.notes?.backendOnly) : '')

/** 骨架屏 200ms 后才出现，避免闪烁 */
const showSkeleton = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
watch(metaState, (s) => {
  clearTimeout(timer)
  showSkeleton.value = false
  if (s === 'loading') timer = setTimeout(() => (showSkeleton.value = true), 200)
}, { immediate: true })
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div class="modules">
    <template v-if="metaState === 'loading'">
      <el-skeleton v-if="showSkeleton" :rows="3" animated class="sk" />
      <el-skeleton v-if="showSkeleton" :rows="3" animated class="sk" />
    </template>

    <div v-else-if="metaState === 'error'" class="err" role="alert">
      <el-icon :size="32" class="err-icon" aria-hidden="true"><WarningFilled /></el-icon>
      <p>{{ t('modules.loadError') }}</p>
      <el-button type="primary" class="retry" @click="emit('retry')">{{ t('modules.retry') }}</el-button>
    </div>

    <template v-else>
      <section class="group" aria-labelledby="mg-0">
        <h3 id="mg-0" class="gt">{{ t('modules.alwaysOn') }}</h3>
        <ul class="req">
          <li v-for="d in alwaysOn" :key="d.id">
            <el-icon class="ri" :size="20" aria-hidden="true"><component :is="icon(d.icon)" /></el-icon>
            <div class="rt">
              <div class="rn">{{ L(d.name) }}</div>
              <div class="rd" :title="L(d.description)">{{ L(d.description) }}</div>
            </div>
            <el-tag type="info" effect="plain" round class="inc">{{ t('modules.included') }}</el-tag>
          </li>
        </ul>
      </section>
      <section class="group" aria-labelledby="mg-1">
        <h3 id="mg-1" class="gt">{{ t('modules.optional') }}</h3>
        <el-checkbox-group v-model="form.dependencies" class="opt">
          <el-checkbox
            v-for="d in optional" :key="d.id" :value="d.id" :disabled="disabledFor(d)"
            class="mod-card" :class="{ on: form.dependencies.includes(d.id) }"
          >
            <span class="mc">
              <span class="mn"><el-icon :size="18" aria-hidden="true"><component :is="icon(d.icon)" /></el-icon>{{ L(d.name) }}</span>
              <span class="md" :title="L(d.description)">{{ L(d.description) }}</span>
              <span v-if="disabledFor(d)" class="why">{{ t('modules.notApplicable') }}</span>
              <span v-else-if="backendNote(d)" class="why">{{ backendNote(d) }}</span>
            </span>
            <a
              v-if="d.links?.reference" class="doc" :href="d.links.reference" target="_blank" rel="noopener"
              :aria-label="t('modules.docsAria', { name: L(d.name) })" @click.stop
            >{{ t('modules.docs') }}<el-icon :size="12" aria-hidden="true"><TopRight /></el-icon></a>
          </el-checkbox>
        </el-checkbox-group>
      </section>
    </template>
  </div>
</template>

<style scoped>
.modules { display: flex; flex-direction: column; gap: 24px; }
.sk { padding: 16px; background: var(--card-bg); border-radius: 12px; }
.err { min-height: 280px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; background: var(--card-bg); border-radius: 12px; padding: 24px; }
.err p { margin: 0; color: var(--el-text-color-regular); max-width: 360px; }
.err-icon { color: var(--el-color-danger); }
.gt { font-size: 14px; font-weight: 600; margin: 0 0 12px; color: var(--el-text-color-primary); }
.req { list-style: none; margin: 0; padding: 4px 16px; background: var(--card-bg); border-radius: 12px; }
.req li { display: flex; align-items: center; gap: 12px; padding: 12px 0; }
.req li + li { border-top: 1px solid var(--el-border-color-lighter); }
.ri { color: var(--el-text-color-secondary); flex: none; }
.rt { flex: 1; min-width: 0; }
.rn { font-weight: 600; color: var(--el-text-color-primary); }
.rd { font-size: 13px; color: var(--el-text-color-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.inc { flex: none; }
.opt { display: flex; flex-direction: column; gap: 12px; }
.mod-card.el-checkbox { position: relative; width: 100%; box-sizing: border-box; height: auto; margin: 0; padding: 16px 16px 36px; border: 1px solid var(--el-border-color); border-radius: 12px; background: var(--card-bg); align-items: flex-start; white-space: normal; }
.mod-card.el-checkbox:hover { border-color: var(--el-border-color-darker); }
.mod-card.on { border: 1.5px solid var(--sel-border); background: var(--brand-tint); padding: 15.5px 15.5px 35.5px; }
.mod-card.is-disabled { opacity: 0.5; }
.mod-card :deep(.el-checkbox__input) { margin-top: 3px; }
.mod-card :deep(.el-checkbox__inner) { width: 16px; height: 16px; }
.mod-card :deep(.el-checkbox__label) { padding-left: 12px; flex: 1; min-width: 0; white-space: normal; }
.mod-card:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
.mod-card :deep(.el-checkbox__input.is-focus .el-checkbox__inner) { box-shadow: none; }
.mc { display: flex; flex-direction: column; gap: 4px; }
.mn { display: inline-flex; align-items: center; gap: 6px; font-size: 16px; font-weight: 600; color: var(--el-text-color-primary); line-height: 1.4; }
.md { font-size: 14px; line-height: 1.6; color: var(--el-text-color-secondary); font-weight: 400; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.why { font-size: 12px; color: var(--el-text-color-secondary); }
.doc { position: absolute; right: 16px; bottom: 10px; font-size: 13px; color: var(--link); text-decoration: none; display: inline-flex; align-items: center; gap: 2px; font-weight: 400; }
.doc:hover { text-decoration: underline; }
.doc:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; border-radius: 4px; }
.mod-card.on:hover { border-color: var(--sel-border); }
</style>
