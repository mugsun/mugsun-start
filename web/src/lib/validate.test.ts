import { describe, it, expect } from 'vitest'
import { checkField, derivePackage, isReservedSegment, JAVA_KEYWORDS } from './validate'
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
  it('derive: same cases as backend FieldPatternCompileTests / S3FollowupApiTests (#10)', () => {
    // 后端：derivedPackageName("com.example.Shop-Admin") == "com.example.shop_admin"；("com.example.in-t") == "com.example.in_t"
    expect(derivePackage('com.example', 'Shop-Admin')).toBe('com.example.shop_admin')
    expect(derivePackage('com.example', 'in-t')).toBe('com.example.in_t')
    expect(derivePackage('com.example', 'shop-admin')).toBe('com.example.shop_admin')
    expect(derivePackage('com.example', 'my-app')).toBe('com.example.my_app')
  })
  it('derive: edge cases follow replace("-","_").toLowerCase() only', () => {
    expect(derivePackage('Com.Example', 'App')).toBe('com.example.app')
    expect(derivePackage('com.example', 'a--b')).toBe('com.example.a__b')
    expect(derivePackage('com.example', 'a-')).toBe('com.example.a_')
    expect(derivePackage('com.my-org', 'x')).toBe('com.my_org.x')
    expect(derivePackage('com.example', '1app')).toBe('com.example.1app') // 数字开头不清理，由 artifactId/packageName 校验拦
    expect(derivePackage('com.example', 'a.b$c')).toBe('com.example.a.b$c') // 其他非法字符同样不清理
  })
  it('in-t derives to in_t, which is not a keyword', () => {
    expect(checkField(derivePackage('com.example', 'in-t'), F.packageName, { javaPackage: true })).toBeNull()
    expect(isReservedSegment('in_t')).toBe(false)
  })
})

describe('package segments: keywords and literals', () => {
  it.each(['com.class.demo', 'com.int', 'com._', '_.x', 'com.goto', 'com.const', 'com.strictfp', 'com.true', 'false.app', 'com.example.null'])('%s is rejected', (v) => {
    expect(checkField(v, F.packageName, { javaPackage: true })).toBe('keyword')
  })
  it('literals are reserved, similar words are fine', () => {
    for (const w of ['true', 'false', 'null']) expect(isReservedSegment(w)).toBe(true)
    expect(checkField('com.trueish.nullable', F.packageName, { javaPackage: true })).toBeNull()
  })
})

describe('keyword list matches SourceVersion.isKeyword(RELEASE_21)', () => {
  // JLS 21 §3.9 ReservedKeyword，逐个列出
  const JLS21 = ['abstract', 'continue', 'for', 'new', 'switch', 'assert', 'default', 'if', 'package', 'synchronized', 'boolean', 'do', 'goto', 'private', 'this', 'break', 'double', 'implements', 'protected', 'throw', 'byte', 'else', 'import', 'public', 'throws', 'case', 'enum', 'instanceof', 'return', 'transient', 'catch', 'extends', 'int', 'short', 'try', 'char', 'final', 'interface', 'static', 'void', 'class', 'finally', 'long', 'strictfp', 'volatile', 'const', 'float', 'native', 'super', 'while', '_']
  it('exactly the 51 reserved keywords', () => {
    expect(JLS21).toHaveLength(51)
    expect([...JAVA_KEYWORDS].sort()).toEqual([...JLS21].sort())
  })
  it('contextual keywords are valid segments', () => {
    for (const p of ['com.record.x', 'com.var', 'com.yield', 'com.sealed', 'com.permits', 'com.module', 'com.when', 'com.non_sealed']) {
      expect(checkField(p, F.packageName, { javaPackage: true })).toBeNull()
    }
  })
})
