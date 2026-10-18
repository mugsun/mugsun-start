import { describe, it, expect } from 'vitest'
import { checkField, derivePackage, isReservedSegment } from './validate'
import { FALLBACK_FIELDS as F } from './defaults'

describe('validate by field spec', () => {
  it('group', () => {
    expect(checkField('com.example', F.groupId)).toBeNull()
    expect(checkField('com.1x', F.groupId)).toBe('pattern')
    expect(checkField('', F.groupId)).toBe('required')
  })
  it('artifact', () => {
    expect(checkField('my-app', F.artifactId)).toBeNull()
    expect(checkField('a'.repeat(51), F.artifactId)).toBe('maxLength')
  })
  it('package with keyword check', () => {
    expect(checkField('com.example.demo', F.packageName, { javaPackage: true })).toBeNull()
    expect(checkField('com.example.class', F.packageName, { javaPackage: true })).toBe('keyword')
    expect(checkField('com.my-app', F.packageName)).toBe('pattern')
  })
  it('invalid server pattern is ignored, not thrown', () => {
    expect(checkField('x', { pattern: '([' })).toBeNull()
  })
  it('derive', () => { expect(derivePackage('com.example', 'my-app')).toBe('com.example.myapp') })
})

describe('package segments: keywords and literals', () => {
  it.each(['com.class.demo', 'com.int', 'record.x', 'com.true', 'false.app', 'com.example.null'])('%s is rejected', (v) => {
    expect(checkField(v, F.packageName, { javaPackage: true })).toBe('keyword')
  })
  it('literals are reserved, similar words are fine', () => {
    for (const w of ['true', 'false', 'null']) expect(isReservedSegment(w)).toBe(true)
    expect(checkField('com.trueish.nullable', F.packageName, { javaPackage: true })).toBeNull()
  })
})
