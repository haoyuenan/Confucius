import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  addRecentFile,
  getRecentFiles,
  clearRecentFiles,
  removeRecentFile,
} from '../../../src/services/recent-files'

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recent-files', () => {
  it('addRecentFile 无记录时创建一条', () => {
    addRecentFile('/notes/a.md')
    const list = getRecentFiles()
    expect(list).toHaveLength(1)
    expect(list[0]).toEqual({
      filePath: '/notes/a.md',
      fileName: 'a.md',
      lastOpenedAt: 1700000000000,
    })
  })

  it('新记录插入到最前（降序）且最多 10 条', () => {
    for (let i = 1; i <= 12; i++) addRecentFile(`/notes/f${i}.md`)
    const list = getRecentFiles()
    expect(list.length).toBe(10)
    expect(list[0].fileName).toBe('f12.md')
    expect(list[9].fileName).toBe('f3.md')
  })

  it('重复路径会去重并移到最前', () => {
    addRecentFile('/notes/a.md')
    addRecentFile('/notes/b.md')
    addRecentFile('/notes/a.md')
    const list = getRecentFiles()
    expect(list.filter((f) => f.filePath === '/notes/a.md')).toHaveLength(1)
    expect(list[0].filePath).toBe('/notes/a.md')
  })

  it('nameFromPath 兼容正斜杠与反斜杠路径', () => {
    addRecentFile('C:\\notes\\win.md')
    addRecentFile('/notes/nix.md')
    expect(getRecentFiles().some((f) => f.fileName === 'win.md')).toBe(true)
    expect(getRecentFiles().some((f) => f.fileName === 'nix.md')).toBe(true)
  })

  it('clearRecentFiles 清除所有记录', () => {
    addRecentFile('/notes/a.md')
    clearRecentFiles()
    expect(getRecentFiles()).toHaveLength(0)
    expect(localStorage.getItem('confucius:recent-files')).toBeNull()
  })

  it('removeRecentFile 仅移除指定记录', () => {
    addRecentFile('/notes/a.md')
    addRecentFile('/notes/b.md')
    removeRecentFile('/notes/a.md')
    const list = getRecentFiles()
    expect(list.some((f) => f.filePath === '/notes/a.md')).toBe(false)
    expect(list.some((f) => f.filePath === '/notes/b.md')).toBe(true)
  })

  it('localStorage 中的非法 JSON 回退为空列表', () => {
    localStorage.setItem('confucius:recent-files', '{invalid json')
    expect(getRecentFiles()).toEqual([])
  })

  it('localStorage 为空时返回空列表', () => {
    expect(getRecentFiles()).toEqual([])
  })
})
