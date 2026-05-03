import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TabBar from '../../../src/components/Editor/TabBar'
import { useTabStore } from '../../../src/stores/tab-store'

beforeEach(() => {
  useTabStore.setState({ tabs: [], activeTabId: null })
})

describe('TabBar', () => {
  test('渲染多标签', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    render(<TabBar />)
    expect(screen.getByText('a.md')).toBeInTheDocument()
    expect(screen.getByText('b.md')).toBeInTheDocument()
  })

  test('点击标签切换激活态', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    render(<TabBar />)
    fireEvent.click(screen.getByText('a.md'))
    const s = useTabStore.getState()
    expect(s.activeTabId).toBe(s.tabs[0].id)
  })

  test('未保存标记显示', () => {
    useTabStore.getState().openFile('/a.md', 'x')
    const id = useTabStore.getState().activeTabId!
    useTabStore.getState().updateContent(id, 'modified')
    render(<TabBar />)
    expect(screen.getByText('●')).toBeInTheDocument()
  })

  test('+ 按钮新建标签', () => {
    useTabStore.getState().openFile('/a.md', '# A')
    render(<TabBar />)
    fireEvent.click(screen.getByText('+'))
    expect(useTabStore.getState().tabs).toHaveLength(2)
  })

  test('✕ 按钮关闭标签', async () => {
    useTabStore.getState().openFile('/a.md', '# A')
    useTabStore.getState().openFile('/b.md', '# B')
    render(<TabBar />)
    // mock confirmSave 返回 1（不保存直接关闭）
    const buttons = screen.getAllByText('✕')
    fireEvent.click(buttons[0])
    await new Promise(r => setTimeout(r, 50))
    expect(useTabStore.getState().tabs).toHaveLength(1)
  })
})
