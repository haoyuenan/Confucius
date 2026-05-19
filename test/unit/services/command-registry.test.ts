import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getBuiltinCommands,
  searchCommands,
  mergeAllCommands,
  saveRecent,
  getRecentCommands,
} from '../../../src/services/command-registry'

const stubCtx = {
  newUntitledTab: vi.fn(),
  openFile: vi.fn(),
  saveFile: vi.fn(),
  saveAs: vi.fn(),
  toggleSidebar: vi.fn(),
  toggleMode: vi.fn(),
  togglePreview: vi.fn(),
  toggleFocus: vi.fn(),
  toggleTypewriter: vi.fn(),
  toggleTheme: vi.fn(),
  openSettings: vi.fn(),
  exportHtml: vi.fn(),
  exportPdf: vi.fn(),
  search: vi.fn(),
  findInDocument: vi.fn(),
}

beforeEach(() => {
  localStorage.clear()
})

describe('getBuiltinCommands', () => {
  it('returns all built-in commands', () => {
    const cmds = getBuiltinCommands(stubCtx)
    expect(cmds.length).toBeGreaterThan(10)
    expect(cmds.some((c) => c.id === 'file:save')).toBe(true)
  })

  it('each command has required fields', () => {
    for (const cmd of getBuiltinCommands(stubCtx)) {
      expect(cmd.id).toBeTruthy()
      expect(cmd.label).toBeTruthy()
      expect(cmd.category).toBeTruthy()
      expect(typeof cmd.execute).toBe('function')
    }
  })

  it('execute calls the correct handler', () => {
    const cmds = getBuiltinCommands(stubCtx)
    cmds.find((c) => c.id === 'file:new')!.execute()
    expect(stubCtx.newUntitledTab).toHaveBeenCalledOnce()
  })
})

describe('searchCommands', () => {
  const cmds = getBuiltinCommands(stubCtx)

  it('empty query returns all commands', () => {
    expect(searchCommands(cmds, '')).toHaveLength(cmds.length)
  })

  it('prefix match finds command', () => {
    const results = searchCommands(cmds, '保存')
    expect(results.some((c) => c.id === 'file:save')).toBe(true)
  })

  it('no match returns empty', () => {
    expect(searchCommands(cmds, 'zzz_not_exists')).toHaveLength(0)
  })
})

describe('mergeAllCommands', () => {
  it('plugin command overrides builtin with same id', () => {
    const override = { id: 'file:save', label: '自定义保存', execute: vi.fn() }
    const merged = mergeAllCommands(getBuiltinCommands(stubCtx), [override])
    expect(merged.find((c) => c.id === 'file:save')?.label).toBe('自定义保存')
  })
})

describe('recent commands', () => {
  it('saveRecent persists to localStorage', () => {
    saveRecent('file:save')
    expect(JSON.parse(localStorage.getItem('confucius-palette-recent')!)).toEqual(['file:save'])
  })

  it('getRecentCommands filters from list', () => {
    saveRecent('file:save')
    const cmds = getBuiltinCommands(stubCtx)
    const recent = getRecentCommands(cmds)
    expect(recent).toHaveLength(1)
    expect(recent[0].id).toBe('file:save')
  })
})
