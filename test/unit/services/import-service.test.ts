import { describe, it, expect, beforeEach, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import {
  checkPandocAvailable,
  importFile,
  importFileDialog,
  IMPORT_FILTERS,
} from '../../../src/services/import-service'

const mockedInvoke = vi.mocked(invoke)
const mockedOpen = vi.mocked(open)

let statExists: boolean

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  statExists = false
  mockedInvoke.mockImplementation(async (cmd: string) => {
    switch (cmd) {
      case 'check_pandoc':
        return false
      case 'import_file':
        return { content: '# imported', suggestedName: 'imported.md' }
      case 'stat_file':
        if (statExists) return { size: 1, modified: '0', is_dir: false }
        throw new Error('ENOENT')
      case 'write_file_utf8':
        return undefined
      case 'read_file_utf8':
        return '# imported'
      default:
        return undefined
    }
  })
})

describe('import-service', () => {
  it('checkPandocAvailable 走 check_pandoc', async () => {
    await expect(checkPandocAvailable()).resolves.toBe(false)
  })

  it('importFile 返回导入结果', async () => {
    await expect(importFile('/tmp/a.docx')).resolves.toMatchObject({
      content: '# imported',
      suggestedName: 'imported.md',
    })
  })

  it('IMPORT_FILTERS 覆盖 docx/pdf/html/epub', () => {
    const exts = IMPORT_FILTERS.flatMap((f) => f.extensions)
    expect(exts).toContain('docx')
    expect(exts).toContain('pdf')
    expect(exts).toContain('epub')
    expect(exts).toContain('html')
  })

  it('importFileDialog 取消选择时直接返回', async () => {
    mockedOpen.mockResolvedValueOnce(null as unknown as string)
    const openFile = vi.fn()
    await importFileDialog('/ws', openFile)
    expect(openFile).not.toHaveBeenCalled()
    // 不会发生任何写入
    expect(mockedInvoke).not.toHaveBeenCalledWith('write_file_utf8')
  })

  it('importFileDialog 正常导入并回写内容', async () => {
    mockedOpen.mockResolvedValueOnce('/tmp/a.docx')
    const openFile = vi.fn()
    await importFileDialog('/ws', openFile)
    expect(mockedInvoke).toHaveBeenCalledWith('write_file_utf8', {
      path: '/ws/imported.md',
      content: '# imported',
    })
    expect(openFile).toHaveBeenCalledWith('/ws/imported.md', '# imported')
  })

  it('importFileDialog 处理重名：追加计数器后缀', async () => {
    statExists = true
    mockedOpen.mockResolvedValueOnce('/tmp/a.docx')
    const writeCalls: { path: string }[] = []
    mockedInvoke.mockImplementation((cmd: string, args?: any) => {
      if (cmd === 'write_file_utf8') {
        writeCalls.push(args as { path: string })
        return Promise.resolve(undefined) as Promise<void>
      }
      if (cmd === 'stat_file') {
        // 第一次存在，第二次不存在 → 循环退出
        if (statExists) {
          statExists = false
          return Promise.resolve({ size: 1, modified: '0', is_dir: false })
        }
        return Promise.reject(new Error('ENOENT'))
      }
      if (cmd === 'import_file') return Promise.resolve({ content: '# imported', suggestedName: 'imported.md' })
      if (cmd === 'read_file_utf8') return Promise.resolve('# imported')
      return Promise.resolve(undefined)
    })
    const openFile = vi.fn()
    await importFileDialog('/ws', openFile)
    expect(writeCalls.some((c) => c.path === '/ws/imported_1.md')).toBe(true)
    expect(writeCalls.some((c) => c.path === '/ws/imported.md')).toBe(false)
    expect(openFile).toHaveBeenCalledWith('/ws/imported_1.md', '# imported')
  })
})
