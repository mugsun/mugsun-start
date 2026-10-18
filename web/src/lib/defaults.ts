/**
 * 前端兜底值：metadata 加载失败时仍要能显示和编辑（体验设计官验收过的行为）。
 * 值与 §4.1 一致；接口返回后以接口为准。
 */
import type { Fields, PostGenerate, ProjectType } from '@/api'

export const BACKEND = 'mugsun-backend'
export const FULLSTACK = 'mugsun-fullstack'

export const FALLBACK_TYPES: ProjectType[] = [
  { id: BACKEND, name: { zh: '仅后端', en: 'Backend only' }, description: { zh: 'mugsun-boot，Spring Boot 3.5、JDK 21。', en: 'mugsun-boot, Spring Boot 3.5, JDK 21.' }, action: '/starter.zip', tags: { build: 'maven', format: 'project', scope: 'backend' } },
  { id: FULLSTACK, name: { zh: '前后端', en: 'Full stack' }, description: { zh: '后端 + mugsun-pc 管理台（Vue 3）。', en: 'Backend plus the mugsun-pc admin console (Vue 3).' }, action: '/starter.zip', tags: { build: 'maven', format: 'project', scope: 'fullstack' }, default: true }
]

export const FALLBACK_FIELDS: Fields = {
  groupId: { default: 'com.example', pattern: '^[a-z][a-z0-9_]*(\\.[a-z][a-z0-9_]*)*$', required: true },
  artifactId: { default: 'demo', pattern: '^[a-z][a-z0-9-]*$', maxLength: 50, required: true },
  name: { default: 'demo', maxLength: 50, required: true, follows: 'artifactId' },
  packageName: { default: 'com.example.demo', pattern: '^[a-z_][a-z0-9_]*(\\.[a-z_][a-z0-9_]*)*$', follows: 'groupId+artifactId' },
  description: { default: { zh: '基于 mugsun 的管理系统', en: 'An admin system built on mugsun' }, maxLength: 200 },
  version: { default: '0.0.1-SNAPSHOT' }
}

export const FALLBACK_VERSIONS = { bootVersion: '3.5.13', javaVersion: '21', packaging: 'jar', database: 'postgresql' }

export const FALLBACK_POSTGEN: PostGenerate = {
  requirements: { [BACKEND]: ['JDK 21', 'Maven 3.9+', 'Docker'], [FULLSTACK]: ['JDK 21', 'Maven 3.9+', 'Docker', 'Node.js 22.13+', 'pnpm 11+'] },
  commands: {
    [BACKEND]: ['unzip {artifactId}.zip && cd {artifactId}', 'docker compose up -d', './mvnw spring-boot:run'],
    [FULLSTACK]: ['unzip {artifactId}.zip && cd {artifactId}', 'docker compose up -d', './mvnw spring-boot:run', 'cd {artifactId}-pc && pnpm install && pnpm dev']
  },
  docs: 'https://docs.mugsun.com/guide/quick-start'
}
