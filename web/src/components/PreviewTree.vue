<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDebounceFn, useMediaQuery } from '@vueuse/core'
import { Folder, FolderOpened, Document } from '@element-plus/icons-vue'
import { form, isFullstack, metaState, shortId } from '@/lib/store'
import { buildTree, countFiles, allIds, topDirIds, type TreeNode } from '@/lib/tree'

const { t } = useI18n()
const narrow = useMediaQuery('(max-width: 639px)')
const tree = ref<TreeNode[]>([])
const expanded = ref<string[]>([])
const highlight = ref(new Set<string>())
const live = ref('')
const fileCount = computed(() => countFiles(tree.value))
let prevIds: Set<string> | null = null
let hlTimer: ReturnType<typeof setTimeout> | undefined

function rebuild() {
  const next = buildTree({ artifact: form.artifactId, packageName: form.packageName, fullstack: isFullstack.value, modules: form.dependencies.map(shortId) })
  const ids = allIds(next)
  if (prevIds) {
    const added = ids.filter((i) => !prevIds!.has(i))
    highlight.value = new Set(added)
    clearTimeout(hlTimer)
    if (added.length) hlTimer = setTimeout(() => (highlight.value = new Set()), 1500)
    live.value = t('preview.updated', { n: countFiles(next) })
  }
  // 新增节点的祖先目录一并展开，让高亮可见
  const ancestors = [...highlight.value].flatMap((id) => id.split('/').slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join('/')))
  prevIds = new Set(ids)
  tree.value = next
  expanded.value = [...new Set([...topDirIds(next), ...ancestors])]
}
const debounced = useDebounceFn(rebuild, 300)
watch(() => [form.artifactId, form.packageName, form.type, form.dependencies.join(',')], () => debounced())
rebuild()

const showSkeleton = ref(false)
let skTimer: ReturnType<typeof setTimeout> | undefined
watch(metaState, (s) => {
  clearTimeout(skTimer); showSkeleton.value = false
  if (s === 'loading') skTimer = setTimeout(() => (showSkeleton.value = true), 200)
  else if (s === 'ready') { prevIds = null; rebuild() }
}, { immediate: true })
onBeforeUnmount(() => { clearTimeout(hlTimer); clearTimeout(skTimer) })
</script>

<template>
  <section class="preview" aria-labelledby="pv-title">
    <div class="head">
      <h2 id="pv-title">{{ t('preview.title') }}</h2>
      <span v-if="metaState !== 'loading'" class="count">{{ t('preview.files', { n: fileCount }) }}</span>
    </div>
    <div class="body" :style="{ height: narrow ? '320px' : '420px' }">
      <template v-if="metaState === 'loading'">
        <el-skeleton v-if="showSkeleton" :rows="3" animated />
      </template>
      <el-empty v-else-if="!tree.length" :description="t('preview.empty')" :image-size="64" />
      <el-tree
        v-else :key="expanded.join('|')" :data="tree" node-key="id" :default-expanded-keys="expanded"
        :props="{ label: 'label', children: 'children' }" highlight-current :expand-on-click-node="true" class="tree"
        :aria-label="t('preview.title')"
      >
        <template #default="{ node, data }">
          <span class="node" :class="{ hl: highlight.has(data.id) }">
            <el-icon class="ni" :class="{ dir: !data.isFile }" aria-hidden="true">
              <Document v-if="data.isFile" /><FolderOpened v-else-if="node.expanded" /><Folder v-else />
            </el-icon>
            <span class="nl">{{ data.label }}</span>
          </span>
        </template>
      </el-tree>
    </div>
    <div class="sr-only" aria-live="polite">{{ live }}</div>
  </section>
</template>

<style scoped>
.preview { background: var(--card-bg); border-radius: 12px; padding: 16px; }
.head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; gap: 12px; }
h2 { margin: 0; font-size: 16px; font-weight: 600; }
.count { font-size: 13px; color: var(--el-text-color-secondary); white-space: nowrap; }
.body { overflow: auto; border-radius: 8px; background: var(--el-bg-color); border: 1px solid var(--el-border-color-lighter); padding: 8px; }
.tree { background: transparent; font-family: var(--mono); font-size: 13px; }
.node { display: inline-flex; align-items: center; gap: 6px; padding: 0 6px; border-radius: 4px; transition: background-color .3s; }
.node.hl { background: var(--brand-tint); }
.ni { color: var(--el-text-color-secondary); }
.ni.dir { color: var(--link); }
.nl { white-space: nowrap; }
</style>
