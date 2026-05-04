import { describe, test, expect, beforeEach } from 'vitest'
import { useEditorStore } from '../../../src/stores/editor-store'

beforeEach(() => {
  useEditorStore.setState({
    content: '',
    isLoading: false,
    isLargeFile: false,
    contentKey: 0,
    mode: 'split',
    focusMode: false,
    typewriterMode: false,
  })
})

describe('editor-store', () => {
  test('setContent 更新内容', () => {
    useEditorStore.getState().setContent('# hello')
    expect(useEditorStore.getState().content).toBe('# hello')
  })

  test('setIsLoading 切换加载状态', () => {
    useEditorStore.getState().setIsLoading(true)
    expect(useEditorStore.getState().isLoading).toBe(true)
  })

  test('setIsLargeFile 标记大文件', () => {
    useEditorStore.getState().setIsLargeFile(true)
    expect(useEditorStore.getState().isLargeFile).toBe(true)
  })

  test('bumpContentKey 自增', () => {
    const prev = useEditorStore.getState().contentKey
    useEditorStore.getState().bumpContentKey()
    expect(useEditorStore.getState().contentKey).toBe(prev + 1)
  })

  test('setMode 设置编辑模式', () => {
    useEditorStore.getState().setMode('wysiwyg')
    expect(useEditorStore.getState().mode).toBe('wysiwyg')
  })

  test('setMode 设置为预览模式', () => {
    useEditorStore.getState().setMode('preview')
    expect(useEditorStore.getState().mode).toBe('preview')
  })

  test('toggleMode 切换 split ↔ wysiwyg', () => {
    expect(useEditorStore.getState().mode).toBe('split')
    useEditorStore.getState().toggleMode()
    expect(useEditorStore.getState().mode).toBe('wysiwyg')
    useEditorStore.getState().toggleMode()
    expect(useEditorStore.getState().mode).toBe('split')
  })

  test('setFocusMode 设置专注模式', () => {
    useEditorStore.getState().setFocusMode(true)
    expect(useEditorStore.getState().focusMode).toBe(true)
  })

  test('toggleFocusMode 翻转', () => {
    useEditorStore.getState().toggleFocusMode()
    expect(useEditorStore.getState().focusMode).toBe(true)
    useEditorStore.getState().toggleFocusMode()
    expect(useEditorStore.getState().focusMode).toBe(false)
  })

  test('toggleTypewriterMode 翻转', () => {
    expect(useEditorStore.getState().typewriterMode).toBe(false)
    useEditorStore.getState().toggleTypewriterMode()
    expect(useEditorStore.getState().typewriterMode).toBe(true)
  })
})
