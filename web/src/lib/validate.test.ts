import { describe, it, expect } from 'vitest'
import { isValidGroup, isValidArtifact, isValidPackage, derivePackage } from './validate'

describe('validate', () => {
  it('group', () => {
    expect(isValidGroup('com.example')).toBe(true)
    expect(isValidGroup('com.1x')).toBe(false)
    expect(isValidGroup('Com.example')).toBe(false)
    expect(isValidGroup('com..a')).toBe(false)
  })
  it('artifact', () => {
    expect(isValidArtifact('my-app')).toBe(true)
    expect(isValidArtifact('1app')).toBe(false)
    expect(isValidArtifact('a'.repeat(51))).toBe(false)
  })
  it('package', () => {
    expect(isValidPackage('com.example.demo')).toBe(true)
    expect(isValidPackage('com.example.class')).toBe(false)
    expect(isValidPackage('com.my-app')).toBe(false)
  })
  it('derive', () => {
    expect(derivePackage('com.example', 'my-app')).toBe('com.example.myapp')
  })
})
