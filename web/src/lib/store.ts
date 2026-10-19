import { reactive, ref, computed, watch } from 'vue'
import { api, isAbort, ApiError } from '@/api'
import type { Metadata, ProjectRequest, PreviewResult, Fields, FieldName } from '@/api'
import { derivePackage } from './validate'
import { fromQuery } from './share'
import { resolveScopeTypes, defaultType, FULLSTACK } from './scope'
import { FALLBACK_FIELDS, FALLBACK_POSTGEN, FALLBACK_TYPES } from './defaults'
import { loc } from './l10n'
import { fieldErrorKey, formDetails, FORM_FIELDS } from './fieldErrors'
import { safeServerMessage } from './messageGuard'
import { i18n } from '@/i18n'
import { createCooldown, COOLDOWN_DEFAULT_S } from './cooldown'

export { FULLSTACK, BACKEND } from './scope'

const locale = () => String(i18n.global.locale.value)

export const metadata = ref<Metadata | null>(null)
export const metaState = ref<'loading' | 'ready' | 'error'>('loading')

/** 字段规则：接口下发优先，逐字段回退到兜底 */
export const fields = computed<Fields>(() => ({ ...FALLBACK_FIELDS, ...(metadata.value?.fields ?? {}) }))
const fieldDefault = (f: FieldName) => loc(fields.value[f]?.default, locale())

export const form = reactive({
  type: FULLSTACK as string,
  groupId: fieldDefault('groupId'),
  artifactId: fieldDefault('artifactId'),
  name: fieldDefault('name'),
  packageName: fieldDefault('packageName'),
  description: fieldDefault('description'),
  dependencies: [] as string[]
})
/** 手动改过之后不再自动跟随 */
export const manual = reactive({ name: false, packageName: false, description: false })
/** 服务端 INVALID_PARAMETER 的 details，按字段显示在表单下方 */
export const serverErrors = reactive<Partial<Record<FieldName, string>>>({})

export const alwaysOn = computed(() => metadata.value?.modules.alwaysOn ?? [])
export const optional = computed(() => metadata.value?.modules.optional ?? [])
export const scopeTypes = computed(() => resolveScopeTypes(locale(), metadata.value?.types))
export const isFullstack = computed(() => form.type === FULLSTACK)
export const postGenerate = computed(() => metadata.value?.postGenerate ?? FALLBACK_POSTGEN)

const follows = (f: FieldName, src: string) => (fields.value[f]?.follows ?? '') === src

watch(() => [form.groupId, form.artifactId] as const, ([g, a]) => {
  if (!manual.packageName && follows('packageName', 'groupId+artifactId')) form.packageName = derivePackage(g, a)
  if (!manual.name && follows('name', 'artifactId')) form.name = a
})
// 编辑字段时清掉该字段的服务端错误
for (const f of ['groupId', 'artifactId', 'name', 'packageName', 'description'] as const) {
  watch(() => form[f], () => { delete serverErrors[f] })
}
// 切换语言时，未手动改过的描述跟着换
watch(() => i18n.global.locale.value, () => { if (!manual.description) form.description = fieldDefault('description') })

export function restorePackage() {
  manual.packageName = false
  form.packageName = derivePackage(form.groupId, form.artifactId)
}

let fromShare = false
/** 分享链接里带了的字段，metadata 回来后不覆盖 */
const shareKeys = new Set<string>()
const DEFAULTED = ['groupId', 'artifactId', 'name', 'packageName', 'description'] as const
let depsFromShare = false
export function applyQuery(search: string) {
  const q = fromQuery(search, { fields: fields.value, allowedTypes: FALLBACK_TYPES.map((t) => t.id) })
  if (Object.keys(q).length === 0) return
  if (q.type) fromShare = true
  for (const k of Object.keys(q)) shareKeys.add(k)
  if (q.dependencies !== undefined) depsFromShare = true
  Object.assign(form, q)
  if (q.packageName !== undefined) manual.packageName = q.packageName !== derivePackage(form.groupId, form.artifactId)
  if (q.name !== undefined) manual.name = q.name !== form.artifactId
  if (q.description !== undefined) manual.description = true
}

/* ---------- metadata：只采用最新一次，取消上一次 ---------- */
let metaCtrl: AbortController | null = null
export async function loadMetadata() {
  metaCtrl?.abort()
  const ctrl = (metaCtrl = new AbortController())
  metaState.value = 'loading'
  try {
    const m = await api.getMetadata({ locale: locale(), signal: ctrl.signal })
    if (ctrl !== metaCtrl) return
    // 还停在兜底默认值、且不是来自分享链接/手动修改的字段，换成接口下发的默认值
    const pristine = DEFAULTED.filter((f) => !shareKeys.has(f) && !(f in manual && manual[f as keyof typeof manual]) && form[f] === fieldDefault(f))
    metadata.value = m
    if (!fromShare) form.type = defaultType(m.types)
    for (const f of pristine) form[f] = fieldDefault(f)
    const known = new Set(m.modules.optional.map((d) => d.id))
    // 分享链接带了 dependencies 就以链接为准；否则按 optional[].default 预勾选
    form.dependencies = depsFromShare
      ? form.dependencies.filter((d) => known.has(d))
      : m.modules.optional.filter((d) => d.default === true && d.appliesTo.includes(form.type)).map((d) => d.id)
    metaState.value = 'ready'
  } catch (e) {
    if (isAbort(e) || ctrl !== metaCtrl) return
    metadata.value = null
    if (!manual.description) form.description = fieldDefault('description')
    metaState.value = 'error'
  }
}

export function toRequest(): ProjectRequest {
  return {
    type: form.type,
    groupId: form.groupId,
    artifactId: form.artifactId,
    name: form.name,
    description: form.description,
    packageName: form.packageName,
    dependencies: [...form.dependencies],
    baseDir: form.artifactId
  }
}

export { FORM_FIELDS }
/** §4.4：INVALID_PARAMETER 的 details 回填到表单字段（preview 与 generate 共用），返回映射上的条数 */
export function applyServerErrors(e: unknown): number {
  if (!(e instanceof ApiError) || e.code !== 'INVALID_PARAMETER') return 0
  const mapped = formDetails(e.details)
  // 优先服务端 message（过同一道守卫）；不通过再按 field+reason 走前端文案
  for (const d of mapped) {
    const msg = safeServerMessage(d.message, { locale: locale(), status: e.status, code: e.code, requestId: e.requestId, field: d.field })
    const key = fieldErrorKey(d.field, d.reason)
    serverErrors[d.field as FieldName] = msg || (key ? String(i18n.global.t(key)) : d.reason ?? '')
  }
  return mapped.length
}

/* ---------- 预览：POST /api/v1/preview，只采用最新一次 ---------- */
export const preview = ref<PreviewResult | null>(null)
export const previewState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
export const previewError = ref<ApiError | null>(null)
let previewCtrl: AbortController | null = null
/** 预览 429（#9 并发名额等待超时）后的冷却；冷却期内不发预览请求，结束后最多补发一次。与下载冷却互相独立 */
export const previewCooldown = createCooldown()
export const previewCooldownUntil = previewCooldown.until
export const PREVIEW_COOLDOWN_DEFAULT = COOLDOWN_DEFAULT_S
let pendingAfterCooldown: ReturnType<typeof setTimeout> | undefined
/** 收到 429 的那次请求参数；冷却结束时只有参数变了（冷却期间改过表单）才自动补发 */
let limitedKey: string | null = null
const requestKey = () => JSON.stringify(toRequest())
export async function loadPreview() {
  const wait = previewCooldownUntil.value - Date.now()
  if (wait > 0) {
    // 冷却期内的调用合并成一个定时器；到点时参数没变（没改表单）就不发，等用户点「重试」
    clearTimeout(pendingAfterCooldown)
    pendingAfterCooldown = setTimeout(() => {
      pendingAfterCooldown = undefined
      if (requestKey() !== limitedKey) void loadPreview()
    }, wait)
    return
  }
  previewCtrl?.abort()
  const ctrl = (previewCtrl = new AbortController())
  previewState.value = 'loading'
  try {
    const r = await api.preview(toRequest(), { locale: locale(), signal: ctrl.signal })
    if (ctrl !== previewCtrl) return
    preview.value = r
    previewError.value = null
    previewState.value = 'ready'
  } catch (e) {
    if (isAbort(e) || ctrl !== previewCtrl) return
    previewError.value = e instanceof ApiError ? e : null
    if (e instanceof ApiError && e.code === 'RATE_LIMITED') {
      limitedKey = requestKey()
      previewCooldown.start(e.retryAfter)
    }
    applyServerErrors(e)
    previewState.value = 'error'
  }
}

/* ---------- 下载 429（#9：/starter.zip、/starter.tgz 与预览共用并发名额）：独立的冷却，不影响预览 ---------- */
export const downloadCooldown = createCooldown()
/** 底栏显示的下载错误（目前只有 429 走这里，其余错误仍用 ElMessage） */
export const downloadError = ref<ApiError | null>(null)
/** 开始一次下载（点击或快捷键）：冷却中返回 false，不发请求、不重置倒计时；否则清掉上一次的限流提示 */
export function beginDownload(): boolean {
  if (downloadCooldown.active.value) return false
  downloadError.value = null
  return true
}
/** 冷却结束后的「现在可以重试」提示：改表单时清掉（冷却中保留）。只改可见提示，不写 live region，不会额外播报 */
watch(() => JSON.stringify(toRequest()), () => { if (!downloadCooldown.active.value) downloadError.value = null })
export function onDownloadRateLimited(e: ApiError) {
  downloadError.value = e
  downloadCooldown.start(e.retryAfter)
}

/** 测试用：重置模块级状态 */
export function __resetForTest() {
  metaCtrl?.abort(); previewCtrl?.abort(); clearTimeout(pendingAfterCooldown); previewCooldown.reset(); downloadCooldown.reset(); downloadError.value = null
  metaCtrl = previewCtrl = null
  metadata.value = null; metaState.value = 'loading'; preview.value = null; previewState.value = 'idle'
  fromShare = false; depsFromShare = false; shareKeys.clear()
  Object.assign(manual, { name: false, packageName: false, description: false })
  Object.assign(form, { type: FULLSTACK, groupId: 'com.example', artifactId: 'demo', name: 'demo', packageName: 'com.example.demo', description: fieldDefault('description'), dependencies: [] })
  for (const k of Object.keys(serverErrors)) delete serverErrors[k as FieldName]
}
