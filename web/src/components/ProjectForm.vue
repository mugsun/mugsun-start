<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FormInstance, FormRules, FormItemProp } from 'element-plus'
import { form, manual, restorePackage, metadata, fields, serverErrors } from '@/lib/store'
import { checkField, type FieldError } from '@/lib/validate'
import { loc } from '@/lib/l10n'
import type { FieldName } from '@/api'

const { t, locale } = useI18n()
const formRef = ref<FormInstance>()
const errors = reactive<Record<string, boolean>>({})

/** 校验规则来自 metadata.fields（失败时用兜底），文案仍走前端 i18n */
const MSG: Record<string, Partial<Record<Exclude<FieldError, null>, string>>> = {
  groupId: { required: 'form.err.groupRequired', pattern: 'form.err.group', maxLength: 'form.err.group' },
  artifactId: { required: 'form.err.artifactRequired', pattern: 'form.err.artifact', maxLength: 'form.err.artifact' },
  name: { required: 'form.err.nameRequired', maxLength: 'form.err.name', pattern: 'form.err.name' },
  packageName: { required: 'form.err.packageRequired', pattern: 'form.err.packageName', keyword: 'form.err.packageName', maxLength: 'form.err.packageName' },
  description: { maxLength: 'form.err.description', pattern: 'form.err.description' }
}
const rule = (f: FieldName) => ({
  trigger: 'blur',
  validator: (_r: unknown, v: string, cb: (e?: Error) => void) => {
    const spec = f === 'name' ? { ...fields.value.name, required: true } : fields.value[f]
    const e = checkField(f === 'name' ? (v ?? '').trim() : v ?? '', spec, { javaPackage: f === 'packageName' })
    cb(e ? new Error(t(MSG[f][e] ?? 'form.err.description')) : undefined)
  }
})
const rules = computed<FormRules>(() => ({
  groupId: [rule('groupId')], artifactId: [rule('artifactId')], name: [rule('name')], packageName: [rule('packageName')], description: [rule('description')]
}))
const dbName = computed(() => metadata.value?.database.values.find((v) => v.id === metadata.value?.database.default)?.name ?? 'PostgreSQL')
const dbNote = computed(() => loc(metadata.value?.database.note, locale.value) || t('form.databaseHint'))
const descMax = computed(() => fields.value.description?.maxLength ?? 200)

const onValidate = (prop: FormItemProp, ok: boolean) => { errors[String(prop)] = !ok }
const bad = (p: FieldName) => errors[p] || !!serverErrors[p]
const aria = (p: FieldName) => ({ 'aria-invalid': bad(p) ? 'true' : 'false', 'aria-describedby': bad(p) ? `err-${p}` : undefined })
const FIELDS = ['groupId', 'artifactId', 'name', 'packageName', 'description'] as const

async function focusField(f: string) {
  formRef.value?.scrollToField(f)
  await nextTick()
  document.getElementById(`f-${f}`)?.focus({ preventScroll: true })
}

/** 全量校验；返回出错数量，并滚动聚焦第一个出错字段 */
async function validateAll(): Promise<number> {
  if (!formRef.value) return 0
  let badFields: string[] = []
  try {
    await formRef.value.validate()
  } catch (f) {
    badFields = Object.keys(f as object)
  }
  if (badFields.length) await focusField(FIELDS.find((f) => badFields.includes(f))!)
  return badFields.length
}
/** 服务端返回字段错误后：聚焦第一个 */
async function focusFirstServerError() {
  const f = FIELDS.find((x) => serverErrors[x])
  if (f) await focusField(f)
}
defineExpose({ validateAll, focusFirstServerError })
</script>

<template>
  <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="pf" :validate-on-rule-change="false" @validate="onValidate">
    <div class="grid2">
      <el-form-item :label="t('form.group')" prop="groupId" :error="serverErrors.groupId">
        <el-input id="f-groupId" v-model.trim="form.groupId" :title="form.groupId" v-bind="aria('groupId')" spellcheck="false" />
        <template #error="{ error }"><div :id="'err-groupId'" class="field-err">{{ error }}</div></template>
      </el-form-item>
      <el-form-item :label="t('form.artifact')" prop="artifactId" :error="serverErrors.artifactId">
        <el-input id="f-artifactId" v-model.trim="form.artifactId" :title="form.artifactId" v-bind="aria('artifactId')" spellcheck="false" />
        <template #error="{ error }"><div id="err-artifactId" class="field-err">{{ error }}</div></template>
      </el-form-item>
    </div>
    <el-form-item :label="t('form.name')" prop="name" :error="serverErrors.name">
      <el-input id="f-name" v-model="form.name" v-bind="aria('name')" @input="manual.name = true" />
      <template #error="{ error }"><div id="err-name" class="field-err">{{ error }}</div></template>
    </el-form-item>
    <el-form-item prop="packageName" :error="serverErrors.packageName" class="pkg-item">
      <template #label>
        <span class="label-row">
          <label for="f-packageName">{{ t('form.packageName') }}</label>
          <el-button v-if="manual.packageName" link type="primary" class="restore" @click="restorePackage">{{ t('form.restore') }}</el-button>
        </span>
      </template>
      <el-input id="f-packageName" v-model.trim="form.packageName" :title="form.packageName" v-bind="aria('packageName')" spellcheck="false" @input="manual.packageName = true" />
      <template #error="{ error }"><div id="err-packageName" class="field-err">{{ error }}</div></template>
    </el-form-item>
    <el-form-item :label="t('form.description')" prop="description" :error="serverErrors.description">
      <el-input id="f-description" v-model="form.description" v-bind="aria('description')" :maxlength="descMax" @input="manual.description = true" />
      <template #error="{ error }"><div id="err-description" class="field-err">{{ error }}</div></template>
    </el-form-item>
    <el-form-item :label="t('form.database')">
      <el-input :model-value="dbName" readonly disabled aria-describedby="db-hint" />
      <div id="db-hint" class="hint">{{ dbNote }}</div>
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
