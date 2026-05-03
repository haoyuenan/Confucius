import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import SearchPanel from '../../../src/components/Sidebar/SearchPanel'
import { useSidebarStore } from '../../../src/stores/sidebar-store'

beforeEach(() => {
  useSidebarStore.setState({
    activeTab: 'search',
    rootPath: '/test',
    fileTree: null,
    expandedPaths: new Set(),
    selectedPath: null,
    outlineItems: [],
    searchQuery: '',
    searchResults: [],
    isSearching: false,
  })
})

describe('SearchPanel', () => {
  test('显示搜索输入框', () => {
    render(<SearchPanel />)
    const input = screen.getByPlaceholderText(/搜索/)
    expect(input).toBeInTheDocument()
  })

  test('显示区分大小写选项', () => {
    render(<SearchPanel />)
    expect(screen.getByText('区分大小写')).toBeInTheDocument()
  })

  test('无搜索时显示搜索输入提示', () => {
    useSidebarStore.setState({ searchResults: [] })
    render(<SearchPanel />)
    const input = screen.getByPlaceholderText(/搜索/)
    expect(input).toBeInTheDocument()
  })
})
