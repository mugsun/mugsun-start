<script setup lang="ts">
import { Select } from '@element-plus/icons-vue'
import type { ProjectType } from '@/api'

defineProps<{ types: ProjectType[]; label: string }>()
const model = defineModel<string>({ required: true })
</script>

<template>
  <el-radio-group v-model="model" class="scope" :aria-label="label">
    <el-radio v-for="ty in types" :key="ty.id" :value="ty.id" class="scope-card" :class="{ on: model === ty.id }">
      <span class="t">{{ ty.name }}</span>
      <span class="d">{{ ty.description }}</span>
      <el-icon v-if="model === ty.id" class="check" aria-hidden="true"><Select /></el-icon>
    </el-radio>
  </el-radio-group>
</template>

<style scoped>
.scope { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; width: 100%; }
@media (max-width: 639px) { .scope { grid-template-columns: minmax(0, 1fr); } }
.scope-card.el-radio { position: relative; width: 100%; box-sizing: border-box; min-width: 0; height: auto; margin: 0; padding: 14px 36px 14px 16px; border: 1px solid var(--el-border-color); border-radius: 12px; background: var(--card-bg); align-items: flex-start; white-space: normal; }
.scope-card.el-radio:hover { border-color: var(--el-border-color-darker); }
.scope-card.on { border: 1.5px solid var(--sel-border); background: var(--brand-tint); padding: 13.5px 35.5px 13.5px 15.5px; }
.scope-card :deep(.el-radio__input) { position: absolute; opacity: 0; pointer-events: none; }
.scope-card :deep(.el-radio__label) { padding: 0; min-width: 0; white-space: normal; display: flex; flex-direction: column; gap: 4px; }
.scope-card:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
.t { font-size: 16px; font-weight: 600; color: var(--el-text-color-primary); line-height: 1.4; }
.d { font-size: 14px; color: var(--el-text-color-secondary); line-height: 1.6; font-weight: 400; }
.check { position: absolute; top: 12px; right: 12px; color: var(--link); font-size: 18px; }
.scope-card.on:hover { border-color: var(--sel-border); }
</style>
