import { describe, test, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import FileTreePanel from '../../../src/components/Sidebar/FileTreePanel'
import { useSidebarStore } from '../../../src/stores/sidebar-store'

beforeEach(() => {
  useSidebarStore.setState({
    activeTab: 'file-tree',
    rootPath: '/project',
    fileTree: {
      name: 'project',
      path: '/project',
      type: 'directory',
      children: [
        { name: 'readme.md', path: '/project/readme.md', type: 'file' },
        { name: 'src', path: '/project/src', type: 'directory', children: [] },
      ],
    },
    expandedPaths: new Set(['/project']),
    selectedPath: null,
    outlineItems: [],
    searchQuery: '',
    searchResults: [],
    isSearching: false,
  })
})

describe('FileTreePanel', () => {
  test('显示文件夹名', () => {
    render(<FileTreePanel />)
    const pathEl = screen.getByTitle('/project')
    expect(pathEl).toBeInTheDocument()
    expect(pathEl.textContent).toBe('project')
  })

  test('显示文件节点', () => {
    render(<FileTreePanel />)
    expect(screen.getByText('readme.md')).toBeInTheDocument()
  })

  test('显示目录节点', () => {
    render(<FileTreePanel />)
    expect(screen.getByText('src')).toBeInTheDocument()
  })
})
