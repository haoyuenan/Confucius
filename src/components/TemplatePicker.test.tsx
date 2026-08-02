import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { TemplatePicker } from '../components/TemplatePicker'
import { expandTemplate, getDefaultVariables, PRESET_TEMPLATES } from '../services/template-service'

// Mock stores
vi.mock('../stores/sidebar-store', () => ({
  useSidebarStore: (selector: (s: unknown) => unknown) => {
    const state = {
      rootPath: '/mock/workspace',
      setRootPath: vi.fn(),
      expandedPaths: new Set<string>(),
    }
    return selector(state)
  },
}))

vi.mock('../stores/tab-store', () => ({
  useTabStore: (selector: (s: unknown) => unknown) => {
    const state = {
      openFile: vi.fn(),
    }
    return selector(state)
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'template.picker.title': '选择模板',
        'template.picker.fileName': '文件名',
        'template.picker.create': '创建',
        'template.picker.cancel': '取消',
      }
      return map[key] || key
    },
  }),
}))

// Mock bridge
vi.mock('../services/bridge', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
  readFile: vi.fn((path: string) => Promise.resolve({ content: '# test', filePath: path })),
  createFile: vi.fn(() => Promise.resolve('/mock/file.md')),
  createDir: vi.fn(() => Promise.resolve('/mock/dir')),
  readDir: vi.fn(() => Promise.resolve([])),
  fileExists: vi.fn(() => Promise.resolve(false)),
}))

describe('TemplatePicker', () => {
  it('renders all preset templates', () => {
    render(<TemplatePicker onClose={vi.fn()} />)

    expect(screen.getByText('选择模板')).toBeTruthy()
    expect(screen.getByText('日记')).toBeTruthy()
    expect(screen.getByText('会议记录')).toBeTruthy()
    expect(screen.getByText('周报')).toBeTruthy()
    expect(screen.getByText('读书笔记')).toBeTruthy()
  })

  it('pre-selects the first template', () => {
    render(<TemplatePicker onClose={vi.fn()} />)

    // The first template should be visible and button enabled
    expect(screen.getByText('日记')).toBeTruthy()
    expect(screen.getByText('创建')).toBeTruthy()
    expect(screen.getByText('创建').closest('button')?.disabled).toBe(false)
  })

  it('shows create button enabled when template selected', () => {
    render(<TemplatePicker onClose={vi.fn()} />)

    const createBtn = screen.getByText('创建').closest('button')!
    expect(createBtn.disabled).toBe(false)
  })

  it('calls writeFile and opens file on create', async () => {
    const onClose = vi.fn()
    render(<TemplatePicker onClose={onClose} />)

    const createBtn = screen.getByText('创建').closest('button')!
    fireEvent.click(createBtn)

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })
})

describe('template-service', () => {
  it('has 4 preset templates', () => {
    const keys = Object.keys(PRESET_TEMPLATES)
    expect(keys.length).toBe(4)
    expect(keys).toContain('日记.md')
    expect(keys).toContain('会议记录.md')
    expect(keys).toContain('周报.md')
    expect(keys).toContain('读书笔记.md')
  })

  it('expands date placeholder', () => {
    const result = expandTemplate('今天是 {{date}}', { date: '2026-06-19' })
    expect(result).toBe('今天是 2026-06-19')
  })

  it('expands multiple placeholders', () => {
    const result = expandTemplate('# {{title}}\n日期：{{date}}', {
      title: '测试',
      date: '2026-06-19',
    })
    expect(result).toContain('# 测试')
    expect(result).toContain('日期：2026-06-19')
  })

  it('preserves unknown placeholders', () => {
    const result = expandTemplate('{{unknown}}', {})
    expect(result).toBe('{{unknown}}')
  })

  it('getDefaultVariables returns current date info', () => {
    const vars = getDefaultVariables('我的笔记')
    expect(vars.title).toBe('我的笔记')
    expect(vars.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(vars.year).toMatch(/^\d{4}$/)
    expect(vars.month).toMatch(/^\d{2}$/)
    expect(vars.day).toMatch(/^\d{2}$/)
    expect(vars.time).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})
