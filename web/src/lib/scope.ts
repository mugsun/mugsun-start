import type { ProjectType } from '@/api'

export const BACKEND = 'maven-project'
export const FULLSTACK = 'mugsun-fullstack'

type T = (key: string) => string

/** 生成范围始终由前端给出；接口有返回同 id 时用接口文案覆盖，接口失败不影响 */
export function resolveScopeTypes(t: T, fromApi?: ProjectType[]): ProjectType[] {
  const base: ProjectType[] = [
    { id: BACKEND, name: t('scope.backend.name'), description: t('scope.backend.desc'), action: '/starter.zip', tags: { build: 'maven', format: 'project' } },
    { id: FULLSTACK, name: t('scope.fullstack.name'), description: t('scope.fullstack.desc'), action: '/starter.zip', tags: { build: 'maven', format: 'project', pc: 'true' } }
  ]
  return base.map((b) => {
    const api = fromApi?.find((x) => x.id === b.id)
    return api ? { ...b, name: api.name || b.name, description: api.description || b.description } : b
  })
}
