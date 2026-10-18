import { describe, it, expect } from 'vitest'
import { toQuery, fromQuery } from './share'

describe('share', () => {
  it('round trip', () => {
    const s = { type: 'maven-project', groupId: 'com.a', artifactId: 'b', name: 'B', packageName: 'com.a.b', description: '中文 说明', dependencies: ['mugsun-gis', 'mugsun-ai'] }
    expect(fromQuery('?' + toQuery(s))).toEqual(s)
  })
  it('partial', () => {
    expect(fromQuery('?groupId=x&mock=meta-error')).toEqual({ groupId: 'x' })
    expect(fromQuery('?dependencies=')).toEqual({ dependencies: [] })
  })
})
