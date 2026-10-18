import { describe, it, expect } from 'vitest'
import { toQuery, fromQuery } from './share'
import { FALLBACK_FIELDS } from './defaults'

const opts = { fields: FALLBACK_FIELDS, allowedTypes: ['mugsun-backend', 'mugsun-fullstack'] }

describe('share', () => {
  it('round trip', () => {
    const s = { type: 'mugsun-backend', groupId: 'com.a', artifactId: 'b', name: 'B', packageName: 'com.a.b', description: '中文 说明', dependencies: ['gis', 'ai'] }
    expect(fromQuery('?' + toQuery(s), opts)).toEqual(s)
  })
  it('drops invalid values', () => {
    expect(fromQuery('?type=evil&groupId=1x&artifactId=Bad&packageName=com.class&dependencies=gis,,<x>,gis&mock=meta-error', opts)).toEqual({ dependencies: ['gis'] })
    expect(fromQuery('?description=' + 'x'.repeat(201), opts)).toEqual({})
  })
})
