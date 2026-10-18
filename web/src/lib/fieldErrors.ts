import type { FieldName } from '@/api'

/** 字段 + reason → 前端 i18n 文案 key（表单前端校验与服务端 details 无 message 时共用） */
export const FIELD_ERROR_KEYS: Record<string, Partial<Record<string, string>>> = {
  groupId: { required: 'form.err.groupRequired', pattern: 'form.err.group', maxLength: 'form.err.group' },
  artifactId: { required: 'form.err.artifactRequired', pattern: 'form.err.artifact', maxLength: 'form.err.artifact' },
  name: { required: 'form.err.nameRequired', maxLength: 'form.err.name', pattern: 'form.err.name' },
  packageName: { required: 'form.err.packageRequired', pattern: 'form.err.packageName', keyword: 'form.err.packageName', maxLength: 'form.err.packageName' },
  description: { maxLength: 'form.err.description', pattern: 'form.err.description' }
}
/** 未知 reason 时用该字段的通用文案 */
const GENERIC: Record<string, string> = {
  groupId: 'form.err.group', artifactId: 'form.err.artifact', name: 'form.err.name', packageName: 'form.err.packageName', description: 'form.err.description'
}
export function fieldErrorKey(field: FieldName | string, reason?: string): string | undefined {
  return (reason && FIELD_ERROR_KEYS[field]?.[reason]) || GENERIC[field]
}
