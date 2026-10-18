// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import { i18n, setLocale } from '@/i18n'
import ModuleList from '../ModuleList.vue'
import PreviewTree from '../PreviewTree.vue'
import * as s from '@/lib/store'
import { ApiError } from '@/api'

const opts = { global: { plugins: [i18n, ElementPlus] } }
beforeEach(() => { s.__resetForTest(); setLocale('zh-CN') })

describe('component error paths', () => {
  it('ModuleList: load error shows message and retry emits', async () => {
    s.metaState.value = 'error'
    const w = mount(ModuleList, opts)
    await nextTick()
    expect(w.text()).toContain('模块列表加载失败')
    await w.find('button.retry').trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
  })
  it('PreviewTree: preview error shows requestId; invalid params get dedicated text', async () => {
    s.metaState.value = 'ready'
    s.previewState.value = 'error'
    s.previewError.value = new ApiError(500, 'GENERATION_FAILED', 'x', 'req-9')
    const w = mount(PreviewTree, opts)
    await nextTick()
    expect(w.text()).toContain('预览加载失败')
    expect(w.text()).toContain('req-9')
    s.previewError.value = new ApiError(400, 'INVALID_PARAMETER', 'x', 'req-1', [{ field: 'groupId', message: 'm' }])
    await nextTick()
    expect(w.text()).toContain('项目信息有误')
  })
})
