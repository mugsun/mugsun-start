<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn, useMediaQuery } from '@vueuse/core'
import { Folder, FolderOpened, Document, WarningFilled } from '@element-plus/icons-vue'
import { form, metaState, preview, previewState, previewError, loadPreview, optional, previewCooldownUntil } from '@/lib/store'
import { loc } from '@/lib/l10n'
import { formDetails } from '@/lib/fieldErrors'
import type { PreviewNode } from '@/api'

const { t, locale } = useI18n()
const narrow = useMediaQuery('(max-width: 639px)')
const expanded = ref<string[]>([])
const highlight = ref(new Set<string>())
const live = ref('')
const tree = computed<PreviewNode[]>(() => preview.value?.tree ?? [])
let prevPaths: Set<string> | null = null
let hlTimer: ReturnType<typeof setTimeout> | undefined

const allPaths = (n: PreviewNode[], out: string[] = []) => { for (const x of n) { out.push(x.path); if (x.children) allPaths(x.children, out) } return out }
const topDirs = (n: PreviewNode[], depth = 2): string[] =>
  depth <= 0 ? [] : n.filter((x) => x.type === 'dir').flatMap((x) => [x.path, ...topDirs(x.children ?? [], depth - 1)])
const modName = (id?: string | null) => (id ? loc(optional.value.find((m) => m.id === id)?.name, locale.value) || id : '')

/** 按 path 对比新旧树，新增节点高亮 1.5 秒，祖先目录展开 */
watch(preview, (p) => {
  if (!p) return
  const paths = allPaths(p.tree)
  if (prevPaths) {
    const added = paths.filter((x) => !prevPaths!.has(x))
    highlight.value = new Set(added)
    clearTimeout(hlTimer)
    if (added.length) hlTimer = setTimeout(() => (highlight.value = new Set()), 1500)
    live.value = t('preview.updated', { n: p.fileCount })
  }
  const ancestors = [...highlight.value].flatMap((id) => id.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/')))
  prevPaths = new Set(paths)
  expanded.value = [...new Set([...topDirs(p.tree), ...ancestors])]
})

const debounced = useDebounceFn(loadPreview, 300)
watch(() => [form.artifactId, form.packageName, form.type, form.dependencies.join(','), form.groupId, form.name, form.description], () => {
  if (metaState.value !== 'loading') debounced()
})
watch(metaState, (s) => { if (s !== 'loading') { prevPaths = null; loadPreview() } })

const showSkeleton = ref(false)
let skTimer: ReturnType<typeof setTimeout> | undefined
const waiting = computed(() => metaState.value === 'loading' || (previewState.value === 'loading' && !preview.value))
watch(waiting, (w) => {
  clearTimeout(skTimer); showSkeleton.value = false
  if (w) skTimer = setTimeout(() => (showSkeleton.value = true), 200)
}, { immediate: true })
/**
 * 429：文案里的秒数取收到 429 时的 Retry-After，之后不变；只有按钮读秒（按钮不在 live region 里）。
 * 屏幕阅读器：收到 429 时播报一次文案，冷却结束时播报一次「可以重试」，倒计时不播报。
 */
const now = ref(Date.now())
let tick: ReturnType<typeof setInterval> | undefined
watch(previewCooldownUntil, (u) => {
  clearInterval(tick); now.value = Date.now()
  if (u <= now.value) return
  live.value = rateText.value
  tick = setInterval(() => {
    now.value = Date.now()
    if (now.value >= u) { clearInterval(tick); live.value = t('preview.canRetry') }
  }, 250)
})
const retryIn = computed(() => Math.max(0, Math.ceil((previewCooldownUntil.value - now.value) / 1000)))
const limited = computed(() => previewError.value?.code === 'RATE_LIMITED')
const rateText = computed(() => previewError.value?.retryAfter !== undefined ? t('bar.rateLimited', { s: previewError.value.retryAfter }) : t('bar.rateLimitedNoWait'))
onBeforeUnmount(() => { clearTimeout(hlTimer); clearTimeout(skTimer); clearInterval(tick) })
</script>

<template>
  <section class="preview" aria-labelledby="pv-title">
    <div class="head">
      <h2 id="pv-title">{{ t('preview.title') }}</h2>
      <span v-if="preview && !waiting" class="count">{{ t('preview.files', { n: preview.fileCount }) }}</span>
    </div>
    <div class="body" :style="{ height: narrow ? '320px' : '420px' }" :aria-busy="previewState === 'loading'">
      <template v-if="waiting">
        <el-skeleton v-if="showSkeleton" :rows="3" animated />
      </template>
      <div v-else-if="previewState === 'error' && !preview" class="perr" :role="limited ? undefined : 'alert'">
        <el-icon :size="28" class="err-icon" aria-hidden="true"><WarningFilled /></el-icon>
        <span>{{ limited ? rateText : previewError?.code === 'INVALID_PARAMETER' ? (formDetails(previewError.details).length ? t('preview.invalid') : t('bar.invalidOther', { id: previewError.requestId || '-' })) : previewError?.code === 'UNSUPPORTED_OPTION' ? t('preview.unsupported') : t('preview.error') }}</span>
        <span v-if="previewError?.requestId && !(previewError.code === 'INVALID_PARAMETER' && !formDetails(previewError.details).length)" class="rid">{{ t('preview.requestId', { id: previewError.requestId }) }}</span>
        <el-button size="small" :disabled="retryIn > 0" @click="loadPreview()">{{ retryIn > 0 ? t('preview.retryIn', { s: retryIn }) : t('modules.retry') }}</el-button>
      </div>
      <el-empty v-else-if="!tree.length" :description="t('preview.empty')" :image-size="64" />
      <el-tree
        v-else :key="expanded.join('|')" :data="tree" node-key="path" :default-expanded-keys="expanded"
        :props="{ label: 'name', children: 'children' }" highlight-current :expand-on-click-node="true" class="tree"
        :aria-label="t('preview.title')"
      >
        <template #default="{ node, data }">
          <span class="node" :class="{ hl: highlight.has(data.path) }" :title="data.module ? t('preview.fromModule', { m: modName(data.module) }) : undefined">
            <el-icon class="ni" :class="{ dir: data.type === 'dir' }" aria-hidden="true">
              <Document v-if="data.type === 'file'" /><FolderOpened v-else-if="node.expanded" /><Folder v-else />
            </el-icon>
            <span class="nl">{{ data.name }}</span>
            <span v-if="data.childCount !== undefined && !data.children" class="cc">({{ data.childCount }})</span>
            <span v-if="data.module && data.type === 'dir'" class="mod-tag">{{ modName(data.module) }}</span>
          </span>
        </template>
      </el-tree>
    </div>
    <p v-if="preview?.truncated" class="note">{{ t('preview.truncated') }}</p>
    <p v-else-if="previewState === 'error' && preview" class="note" :role="limited ? undefined : 'status'">{{ limited ? `${t('preview.stale')} ${rateText}` : t('preview.stale') }}</p>
    <div class="sr-only" aria-live="polite">{{ live }}</div>
  </section>
</template>

<style scoped>
.preview { background: var(--card-bg); border-radius: 12px; padding: 16px; }
.head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
h2 { margin: 0; font-size: 16px; font-weight: 600; }
.count { font-size: 13px; color: var(--el-text-color-secondary); white-space: nowrap; }
.body { overflow-x: auto; overflow-y: auto; border-radius: 8px; background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); padding: 8px; }
.tree { background: transparent; font-family: var(--mono); font-size: 13px; min-width: max-content; }
/* 窄屏下文件名不截断，和启动说明的命令块一样横向滚动 */
.tree :deep(.el-tree-node__content),
.tree :deep(.el-tree-node__label) { white-space: nowrap; overflow: visible; text-overflow: clip; }
.node { display: inline-flex; align-items: center; gap: 6px; padding: 0 6px; border-radius: 4px; transition: background-color .3s; }
.node.hl { background: var(--brand-tint); }
.ni { color: var(--el-text-color-secondary); }
.ni.dir { color: var(--link); }
.nl { white-space: nowrap; }
.mod-tag { margin-left: 6px; font-family: var(--el-font-family); font-size: 11px; line-height: 16px; padding: 0 6px; border-radius: 4px; color: var(--link); border: 1px solid currentColor; }
.err-icon { color: var(--el-color-danger); }
.cc { color: var(--el-text-color-secondary); margin-left: 4px; }
.perr { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; color: var(--el-text-color-regular); }
.perr .rid { font-size: 12px; color: var(--el-text-color-secondary); }
.note { font-size: 12px; color: var(--el-text-color-secondary); margin-top: 8px; }
</style>
