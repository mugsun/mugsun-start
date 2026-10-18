import { describe, it, expect } from 'vitest'
import { buildTree, countFiles, allIds, topDirIds } from './tree'

const base = { artifact: 'demo', packageName: 'com.example.demo', fullstack: true, modules: [] as string[] }

describe('tree', () => {
  it('backend only has no pc dir', () => {
    const ids = allIds(buildTree({ ...base, fullstack: false }))
    expect(ids.some((i) => i.includes('demo-pc'))).toBe(false)
  })
  it('modules add files to both sides', () => {
    const a = buildTree(base)
    const b = buildTree({ ...base, modules: ['gis'] })
    expect(countFiles(b) - countFiles(a)).toBe(4)
    expect(allIds(b)).toContain('demo/demo-pc/src/modules/gis/routes.ts')
  })
  it('backend only with module drops pc part', () => {
    const t = buildTree({ ...base, fullstack: false, modules: ['ai'] })
    expect(allIds(t)).toContain('demo/src/main/resources/config/mugsun-ai.yml')
    expect(allIds(t).some((i) => i.includes('modules/ai'))).toBe(false)
  })
  it('package path and dirs first', () => {
    const t = buildTree({ ...base, packageName: 'org.acme.x' })
    expect(allIds(t)).toContain('demo/src/main/java/org/acme/x/DemoApplication.java')
    expect(t[0].children![0].isFile).toBe(false)
    expect(topDirIds(t)).toEqual(expect.arrayContaining(['demo', 'demo/src']))
  })
})
