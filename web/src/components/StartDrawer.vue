<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useClipboard } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { DocumentCopy, TopRight } from '@element-plus/icons-vue'
import { form, postGenerate } from '@/lib/store'

const props = defineProps<{ narrow: boolean }>()
const open = defineModel<boolean>({ required: true })
const { t } = useI18n()
const { copy } = useClipboard({ legacy: true })
/** 环境要求与命令来自 metadata.postGenerate（失败时用兜底），{artifactId} 由前端替换 */
const env = computed(() => postGenerate.value.requirements[form.type] ?? [])
const cmds = computed(() => {
  const a = form.artifactId || 'demo'
  return (postGenerate.value.commands[form.type] ?? []).map((c) => c.replace(/\{artifactId\}/g, a)).join('\n')
})
async function doCopy() { await copy(cmds.value); ElMessage.success(t('drawer.copied')) }
</script>

<template>
  <el-drawer v-model="open" :title="t('drawer.title')" :direction="props.narrow ? 'btt' : 'rtl'" :size="props.narrow ? '80%' : '480px'" class="start-drawer" append-to-body>
    <section>
      <h3>1. {{ t('drawer.env') }}</h3>
      <ul class="env"><li v-for="e in env" :key="e">{{ e }}</li></ul>
    </section>
    <section>
      <h3>2. {{ t('drawer.commands') }}</h3>
      <div class="cmd">
        <pre tabindex="0" :aria-label="t('drawer.commands')"><code>{{ cmds }}</code></pre>
        <el-button size="small" class="copy" :icon="DocumentCopy" @click="doCopy">{{ t('drawer.copy') }}</el-button>
      </div>
    </section>
    <section>
      <h3>3. {{ t('drawer.access') }}</h3>
      <p>{{ t('drawer.accessText') }}</p>
    </section>
    <section>
      <a class="docs" :href="postGenerate.docs" target="_blank" rel="noopener">{{ t('drawer.docs') }}<el-icon aria-hidden="true"><TopRight /></el-icon></a>
    </section>
  </el-drawer>
</template>

<style scoped>
section { margin-bottom: 24px; }
h3 { font-size: 16px; font-weight: 600; margin: 0 0 8px; }
p { margin: 0; color: var(--el-text-color-regular); }
.env { margin: 0; padding-left: 20px; color: var(--el-text-color-regular); }
.cmd { position: relative; }
pre { margin: 0; padding: 14px 16px; padding-right: 80px; background: var(--card-bg); border: 1px solid var(--el-border-color-lighter); border-radius: 8px; overflow-x: auto; white-space: pre; font-family: var(--mono); font-size: 13px; line-height: 1.7; }
pre:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.copy { position: absolute; top: 8px; right: 8px; }
.docs { color: var(--link); text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.docs:hover { text-decoration: underline; }
</style>
