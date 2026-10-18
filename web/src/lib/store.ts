import { reactive, ref, computed, watch } from 'vue'
import { api, withTimeout, METADATA_TIMEOUT_MS } from '@/api'
import type { Metadata, Dependency, ProjectRequest } from '@/api'
import { derivePackage } from './validate'
import { fromQuery } from './share'

export const FULLSTACK = 'mugsun-fullstack'
export const BACKEND = 'maven-project'

export const form = reactive({
  type: FULLSTACK,
  groupId: 'com.example',
  artifactId: 'demo',
  name: 'demo',
  packageName: 'com.example.demo',
  description: '',
  database: 'postgresql',
  dependencies: [] as string[]
})
/** 手动改过之后不再自动跟随 */
export const manual = reactive({ name: false, packageName: false, description: false })

export const metadata = ref<Metadata | null>(null)
export const metaState = ref<'loading' | 'ready' | 'error'>('loading')

export const requiredDeps = computed<Dependency[]>(() =>
  (metadata.value?.dependencies.values ?? []).flatMap((g) => g.values).filter((d) => d.required)
)
export const optionalDeps = computed<Dependency[]>(() =>
  (metadata.value?.dependencies.values ?? []).flatMap((g) => g.values).filter((d) => !d.required)
)
export const isFullstack = computed(() => form.type === FULLSTACK)
/** mugsun-gis → gis */
export const shortId = (id: string) => id.replace(/^mugsun-/, '')

watch(() => [form.groupId, form.artifactId] as const, ([g, a]) => {
  if (!manual.packageName) form.packageName = derivePackage(g, a)
  if (!manual.name) form.name = a
})

export function restorePackage() {
  manual.packageName = false
  form.packageName = derivePackage(form.groupId, form.artifactId)
}

let fromShare = false
export function applyQuery(search: string) {
  const q = fromQuery(search)
  if (Object.keys(q).length === 0) return
  fromShare = true
  Object.assign(form, q)
  if (q.packageName !== undefined) manual.packageName = q.packageName !== derivePackage(form.groupId, form.artifactId)
  if (q.name !== undefined) manual.name = q.name !== form.artifactId
  if (q.description !== undefined) manual.description = true
}

export async function loadMetadata(locale: string) {
  metaState.value = 'loading'
  try {
    const m = await withTimeout(api.getMetadata(locale), METADATA_TIMEOUT_MS)
    metadata.value = m
    if (!fromShare) form.type = m.type.default
    if (!manual.description) form.description = m.description.default ?? ''
    const known = new Set(m.dependencies.values.flatMap((g) => g.values).map((d) => d.id))
    form.dependencies = form.dependencies.filter((d) => known.has(d))
    metaState.value = 'ready'
  } catch {
    metaState.value = 'error'
  }
}

export function toRequest(): ProjectRequest {
  const m = metadata.value
  return {
    type: form.type,
    groupId: form.groupId,
    artifactId: form.artifactId,
    name: form.name,
    packageName: form.packageName,
    description: form.description,
    dependencies: [...requiredDeps.value.map((d) => d.id), ...form.dependencies],
    bootVersion: m?.bootVersion.default,
    javaVersion: m?.javaVersion.default,
    packaging: m?.packaging.default,
    language: m?.language.default,
    database: form.database
  }
}
