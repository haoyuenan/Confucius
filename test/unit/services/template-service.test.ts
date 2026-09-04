import { describe, it, expect, beforeEach, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import {
  PRESET_TEMPLATES,
  listTemplates,
  readTemplateContent,
  ensurePresetTemplates,
  expandTemplate,
  getDefaultVariables,
} from '../../../src/services/template-service'

const mockedInvoke = vi.mocked(invoke)

let statExists: boolean

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  statExists = true
  mockedInvoke.mockReset()
})

describe('template-service', () => {
  it('PRESET_TEMPLATES 含 4 套预置模板', () => {
    expect(Object.keys(PRESET_TEMPLATES)).toHaveLength(4)
    expect(PRESET_TEMPLATES['日记.md']).toContain('{{date}}')
  })

  it('expandTemplate 替换变量并保留未知占位符', () => {
    const out = expandTemplate('title: {{title}}, date: {{date}}', { title: 'T', date: '2026-01-01' })
    expect(out).toBe('title: T, date: 2026-01-01')
    expect(expandTemplate('{{missing}}', {})).toBe('{{missing}}')
  })

  it('getDefaultVariables 生成日期/时间/标题变量', () => {
    const vars = getDefaultVariables('我的标题')
    expect(vars.title).toBe('我的标题')
    expect(vars.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(vars.year).toMatch(/^\d{4}$/)
    expect(vars.month).toMatch(/^\d{2}$/)
    expect(vars.day).toMatch(/^\d{2}$/)
  })

  it('listTemplates 只返回 .md/.markdown 文件', async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_dir_entries') {
        return [
          { name: 'a.md', is_directory: false },
          { name: 'b.markdown', is_directory: false },
          { name: 'c.txt', is_directory: false },
          { name: 'sub.md', is_directory: true },
        ]
      }
      return undefined
    })
    const templates = await listTemplates('/ws')
    expect(templates.map((t) => t.name)).toEqual(['a.md', 'b.markdown'])
    expect(templates.every((t) => t.path.startsWith('/ws/.confucius/templates/'))).toBe(true)
  })

  it('listTemplates 目录读取失败返回空数组', async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_dir_entries') throw new Error('EACCES')
      return undefined
    })
    await expect(listTemplates('/ws')).resolves.toEqual([])
  })

  it('readTemplateContent 读取文件内容', async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_file_utf8') return '# 模板内容'
      return undefined
    })
    await expect(readTemplateContent('/ws/.confucius/templates/a.md')).resolves.toBe('# 模板内容')
  })

  it('readTemplateContent 读取失败返回空字符串', async () => {
    mockedInvoke.mockImplementation(async (cmd: string) => {
      if (cmd === 'read_file_utf8') throw new Error('ENOENT')
      return undefined
    })
    await expect(readTemplateContent('/ws/.confucius/templates/a.md')).resolves.toBe('')
  })

  it('ensurePresetTemplates 跳过已存在的模板，创建缺失的', async () => {
    const written: string[] = []
    mockedInvoke.mockImplementation(async (cmd: string, args?: any) => {
      switch (cmd) {
        case 'create_dir':
          return '/ws/.confucius'
        case 'stat_file':
          if (statExists) return { size: 1, modified: '0', is_dir: false }
          throw new Error('ENOENT')
        case 'write_file_utf8':
          written.push((args as { path: string }).path)
          return undefined
        default:
          return undefined
      }
    })
    // 文件都不存在 → 全部创建
    statExists = false
    await ensurePresetTemplates('/ws')
    expect(written.length).toBe(4)
    expect(written.every((p) => p.startsWith('/ws/.confucius/templates/'))).toBe(true)
  })
})
