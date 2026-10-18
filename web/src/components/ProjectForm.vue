<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules, FormItemProp } from 'element-plus'
import { form, manual, restorePackage, metadata } from '@/lib/store'
import { isValidGroup, isValidArtifact, isValidPackage } from '@/lib/validate'

const { t } = useI18n()
const formRef = ref<FormInstance>()
const errors = reactive<Record<string, boolean>>({})

type Check = (v: string) => string | null
const rule = (check: Check) => ({
  trigger: 'blur',
  validator: (_r: unknown, v: string, cb: (e?: Error) => void) => {
    const msg = check(v ?? '')
    cb(msg ? new Error(msg) : undefined)
  }
})
const rules = computed<FormRules>(() => ({
  groupId: [rule((v) => (!v ? t('form.err.groupRequired') : isValidGroup(v) ? null : t('form.err.group')))],
  artifactId: [rule((v) => (!v ? t('form.err.artifactRequired') : isValidArtifact(v) ? null : t('form.err.artifact')))],
  name: [rule((v) => (!v.trim() ? t('form.err.nameRequired') : v.length > 50 ? t('form.err.name') : null))],
  packageName: [rule((v) => (!v ? t('form.err.packageRequired') : isValidPackage(v) ? null : t('form.err.packageName')))],
  description: [rule((v) => (v.length > 200 ? t('form.err.description') : null))]
}))

const onValidate = (prop: FormItemProp, ok: boolean) => { errors[String(prop)] = !ok }
const aria = (p: string) => ({ 'aria-invalid': errors[p] ? 'true' : 'false', 'aria-describedby': errors[p] ? `err-${p}` : undefined })
const FIELDS = ['groupId', 'artifactId', 'name', 'packageName', 'description'] as const

/** 全量校验；返回出错数量，并滚动聚焦第一个出错字段 */
async function validateAll(): Promise<number> {
  if (!formRef.value) return 0
  let bad: string[] = []
  try {
    await formRef.value.validate()
  } catch (fields) {
    bad = Object.keys(fields as object)
  }
  if (bad.length) {
    const first = FIELDS.find((f) => bad.includes(f))!
    formRef.value.scrollToField(first)
    await nextTick()
    document.getElementById(`f-${first}`)?.focus({ preventScroll: true })
  }
  return bad.length
}
defineExpose({ validateAll })
</script>

<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="pf" :validate-on-rule-change="false" @validate="onValidate">
    <div class="grid2">
      <el-form-item :label="t('form.group')" prop="groupId">
        <el-input id="f-groupId" v-model.trim="form.groupId" :title="form.groupId" v-bind="aria('groupId')" spellcheck="false" />
        <template #error="{ error }"><div :id="'err-groupId'" class="field-err">{{ error }}</div></template>
      </el-form-item>
      <el-form-item :label="t('form.artifact')" prop="artifactId">
        <el-input id="f-artifactId" v-model.trim="form.artifactId" :title="form.artifactId" v-bind="aria('artifactId')" spellcheck="false" />
        <template #error="{ error }"><div id="err-artifactId" class="field-err">{{ error }}</div></template>
      </el-form-item>
    </div>
    <el-form-item :label="t('form.name')" prop="name">
      <el-input id="f-name" v-model="form.name" v-bind="aria('name')" @input="manual.name = true" />
      <template #error="{ error }"><div id="err-name" class="field-err">{{ error }}</div></template>
    </el-form-item>
    <el-form-item prop="packageName" class="pkg-item">
      <template #label>
        <span class="label-row">
          <label for="f-packageName">{{ t('form.packageName') }}</label>
          <el-button v-if="manual.packageName" link type="primary" class="restore" @click="restorePackage">{{ t('form.restore') }}</el-button>
        </span>
      </template>
      <el-input id="f-packageName" v-model.trim="form.packageName" :title="form.packageName" v-bind="aria('packageName')" spellcheck="false" @input="manual.packageName = true" />
      <template #error="{ error }"><div id="err-packageName" class="field-err">{{ error }}</div></template>
    </el-form-item>
    <el-form-item :label="t('form.description')" prop="description">
      <el-input id="f-description" v-model="form.description" v-bind="aria('description')" maxlength="200" @input="manual.description = true" />
      <template #error="{ error }"><div id="err-description" class="field-err">{{ error }}</div></template>
    </el-form-item>
    <el-form-item :label="t('form.database')">
      <el-input :model-value="metadata?.database.values[0]?.name ?? 'PostgreSQL'" readonly disabled :aria-describedby="'db-hint'" />
      <div id="db-hint" class="hint">{{ t('form.databaseHint') }}</div>
    </el-form-item>
  </el-form>
</template>

<style scoped>
.pf :deep(.el-form-item) { margin-bottom: 16px; scroll-margin-top: 80px; }
.pf :deep(.el-form-item__label) { font-weight: 500; color: var(--el-text-color-primary); }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
@media (max-width: 639px) { .grid2 { grid-template-columns: 1fr; } }
.field-err { font-size: 12px; line-height: 1.5; color: var(--el-color-danger); padding-top: 4px; }
.pf :deep(.el-form-item.is-error) { margin-bottom: 16px; }
.pf :deep(.el-form-item__content) { flex-direction: column; align-items: stretch; }
.label-row { display: inline-flex; width: 100%; justify-content: space-between; align-items: center; gap: 8px; }
.pkg-item :deep(.el-form-item__label) { width: 100%; padding-right: 0; }
.restore { font-size: 13px; white-space: nowrap; }
.hint { font-size: 12px; color: var(--el-text-color-secondary); line-height: 1.5; padding-top: 4px; }
</style>
