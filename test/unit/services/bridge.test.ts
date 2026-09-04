import { describe, it, expect, beforeEach, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open, save, ask } from '@tauri-apps/plugin-dialog'
import * as bridge from '../../../src/services/bridge'
import { useSidebarStore } from '../../../src/stores/sidebar-store'

const mockedInvoke = vi.mocked(invoke)
const mockedOpen = vi.mocked(open)
const mockedSave = vi.mocked(save)
const mockedAsk = vi.mocked(ask)
const mockedListen = vi.mocked(listen)

function setPreviewHTML(value: unknown) {
  ;(window as any).__exportPreviewHTML__ = () => value
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  useSidebarStore.setState({ rootPath: '' })
  setPreviewHTML('')
  mockedSave.mockResolvedValue(null)
})

describe('bridge file operations', () => {
  it('readFile 去除 BOM', async () => {
    mockedInvoke.mockResolvedValueOnce('\uFEFF# with bom')
    await expect(bridge.readFile('/a.md')).resolves.toEqual({ content: '# with bom', filePath: '/a.md' })
  })

  it('readFile 无 BOM 时保持原样', async () => {
    mockedInvoke.mockResolvedValueOnce('# plain')
    await expect(bridge.readFile('/a.md')).resolves.toEqual({ content: '# plain', filePath: '/a.md' })
  })

  it('readFileBase64 / saveImageFile / writeFile 透传 invoke', async () => {
    mockedInvoke.mockResolvedValueOnce('data:image/png;base64,xxx')
    await expect(bridge.readFileBase64('/a.png')).resolves.toBe('data:image/png;base64,xxx')
    expect(mockedInvoke).toHaveBeenCalledWith('read_file_base64', { path: '/a.png' })

    mockedInvoke.mockResolvedValueOnce('/img.png')
    await expect(bridge.saveImageFile('base64', 'img.png', '/dir')).resolves.toBe('/img.png')
    expect(mockedInvoke).toHaveBeenCalledWith('save_image_file', { dataBase64: 'base64', fileName: 'img.png', targetDir: '/dir' })

    mockedInvoke.mockResolvedValueOnce(undefined)
    await bridge.writeFile('/a.md', 'hi')
    expect(mockedInvoke).toHaveBeenCalledWith('write_file_utf8', { path: '/a.md', content: 'hi' })
  })
})

describe('bridge dialogs', () => {
  it('openFileDialog 选择文件后读取内容', async () => {
    mockedOpen.mockResolvedValueOnce('/pick.md')
    await expect(bridge.openFileDialog()).resolves.toEqual({ content: '# Mock file content', filePath: '/pick.md' })
  })

  it('openFileDialog 取消选择返回 null', async () => {
    mockedOpen.mockResolvedValueOnce(null)
    await expect(bridge.openFileDialog()).resolves.toBeNull()
  })

  it('saveFileDialog 返回用户选择的路径', async () => {
    mockedSave.mockResolvedValueOnce('/out.md')
    await expect(bridge.saveFileDialog()).resolves.toBe('/out.md')
  })

  it('confirmSave 返回 0（确认）或 1（取消）', async () => {
    mockedAsk.mockResolvedValueOnce(true)
    await expect(bridge.confirmSave()).resolves.toBe(0)
    mockedAsk.mockResolvedValueOnce(false)
    await expect(bridge.confirmSave()).resolves.toBe(1)
  })
})

describe('bridge file tree & watcher', () => {
  it('buildFileTree 透传 invoke', async () => {
    const tree = { name: 'root', path: '/ws', type: 'directory', children: [] }
    mockedInvoke.mockResolvedValueOnce(tree)
    await expect(bridge.buildFileTree('/ws')).resolves.toEqual(tree)
  })

  it('start/stopFileWatcher 透传 invoke', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined)
    await bridge.startFileWatcher('/ws')
    expect(mockedInvoke).toHaveBeenCalledWith('start_file_watcher', { rootPath: '/ws' })
    mockedInvoke.mockResolvedValueOnce(undefined)
    await bridge.stopFileWatcher()
    expect(mockedInvoke).toHaveBeenCalledWith('stop_file_watcher')
  })

  it('onFileTreeChanged 派发文件树变更并返回取消函数', async () => {
    let captured: ((event: { payload?: { paths?: string[] } }) => void) | undefined
    mockedListen.mockImplementation((((_event: string, cb: any) => {
      captured = cb
      return Promise.resolve(() => {})
    }) as any))
    const callback = vi.fn()
    const unlisten = bridge.onFileTreeChanged(callback)
    expect(unlisten).toBeTypeOf('function')
    captured!({ payload: { paths: ['/a', '/b'] } })
    expect(callback).toHaveBeenCalledWith(['/a', '/b'])
    captured!({ payload: undefined })
    expect(callback).toHaveBeenCalledWith([])
    unlisten()
  })
})

describe('bridge sidebar', () => {
  it('openFolderDialog 返回目录路径或 null', async () => {
    mockedOpen.mockResolvedValueOnce('/folder')
    await expect(bridge.openFolderDialog()).resolves.toBe('/folder')
    mockedOpen.mockResolvedValueOnce(null)
    await expect(bridge.openFolderDialog()).resolves.toBeNull()
  })

  it('showSidebarContextMenu 派发 DOM 事件', () => {
    const handler = vi.fn()
    const on = vi.fn((e: Event) => handler(e))
    window.addEventListener('sidebar-context-menu', on as any)
    bridge.showSidebarContextMenu('/a', 'file')
    expect(handler).toHaveBeenCalledTimes(1)
    window.removeEventListener('sidebar-context-menu', on as any)
  })

  it('createFile/createDir 成功返回 true，失败返回 false', async () => {
    mockedInvoke.mockResolvedValueOnce('/f.md')
    await expect(bridge.createFile('/ws', 'f.md')).resolves.toBe(true)
    mockedInvoke.mockRejectedValueOnce(new Error('x'))
    await expect(bridge.createFile('/ws', 'f.md')).resolves.toBe(false)

    mockedInvoke.mockResolvedValueOnce('/dir')
    await expect(bridge.createDir('/ws', 'd')).resolves.toBe(true)
    mockedInvoke.mockRejectedValueOnce(new Error('x'))
    await expect(bridge.createDir('/ws', 'd')).resolves.toBe(false)
  })

  it('renameItem / deleteItem 透传 invoke', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined)
    await bridge.renameItem('/old', 'new')
    expect(mockedInvoke).toHaveBeenCalledWith('rename_item', { oldPath: '/old', newName: 'new' })
    mockedInvoke.mockResolvedValueOnce(undefined)
    await bridge.deleteItem('/t')
    expect(mockedInvoke).toHaveBeenCalledWith('delete_item', { targetPath: '/t' })
  })
})

describe('bridge internal knowledge helpers', () => {
  it('readFileRaw / readDir / statFile 透传 invoke', async () => {
    mockedInvoke.mockResolvedValueOnce('# raw')
    await expect(bridge.readFileRaw('/a.md')).resolves.toBe('# raw')
    mockedInvoke.mockResolvedValueOnce([{ name: 'a.md', is_directory: false }])
    await expect(bridge.readDir('/ws')).resolves.toEqual([{ name: 'a.md', is_directory: false }])
    mockedInvoke.mockResolvedValueOnce({ size: 1, modified: '0', is_dir: false })
    await expect(bridge.statFile('/a.md')).resolves.toEqual({ size: 1, modified: '0', is_dir: false })
  })

  it('fileExists 存在返回 true，异常返回 false', async () => {
    mockedInvoke.mockResolvedValueOnce({ size: 1, modified: '0', is_dir: false })
    await expect(bridge.fileExists('/a.md')).resolves.toBe(true)
    mockedInvoke.mockRejectedValueOnce(new Error('ENOENT'))
    await expect(bridge.fileExists('/a.md')).resolves.toBe(false)
  })
})

describe('bridge search', () => {
  it('searchQuery 使用默认参数', async () => {
    mockedInvoke.mockResolvedValueOnce([])
    await bridge.searchQuery({ rootPath: '/ws', query: 'hi' })
    expect(mockedInvoke).toHaveBeenCalledWith('search_text', {
      rootPath: '/ws',
      query: 'hi',
      caseSensitive: false,
      useRegex: false,
      maxResults: 500,
    })
  })

  it('searchQuery 透传自定义参数', async () => {
    mockedInvoke.mockResolvedValueOnce([{ filePath: 'a.md', fileName: 'a', content: 'x' }])
    await bridge.searchQuery({ rootPath: '/ws', query: 'q', caseSensitive: true, regex: true, maxResults: 10 })
    expect(mockedInvoke).toHaveBeenCalledWith(
      'search_text',
      expect.objectContaining({ caseSensitive: true, useRegex: true, maxResults: 10 }),
    )
  })
})

describe('bridge export & print', () => {
  it('exportHtml 生成完整文档并写入文件', async () => {
    setPreviewHTML('<p>hi</p>')
    const onDone = vi.fn()
    window.addEventListener('export-done', onDone as any)
    mockedSave.mockResolvedValueOnce('/tmp/out.html')
    await bridge.exportHtml()
    expect(mockedSave).toHaveBeenCalledWith(expect.objectContaining({ defaultPath: 'document.html' }))
    const writeCall = mockedInvoke.mock.calls.find(([cmd]) => cmd === 'write_file_utf8')
    expect(writeCall).toBeTruthy()
    expect((writeCall![1] as { content: string }).content).toContain('<p>hi</p>')
    expect(onDone).toHaveBeenCalledTimes(1)
    window.removeEventListener('export-done', onDone as any)
  })

  it('exportHtml 预览非字符串时直接返回', async () => {
    setPreviewHTML(123)
    await bridge.exportHtml()
    expect(mockedSave).not.toHaveBeenCalled()
  })

  it('exportHtml 保存取消时返回', async () => {
    setPreviewHTML('<p>hi</p>')
    mockedSave.mockResolvedValueOnce(null)
    await bridge.exportHtml()
    expect(mockedInvoke).not.toHaveBeenCalledWith('write_file_utf8')
  })

  it('exportPdf 无预览内容时安全返回', async () => {
    setPreviewHTML('')
    await expect(bridge.exportPdf()).resolves.toBeUndefined()
  })

  it('onExportDone / onFileOpen / onMenuAction 注册并清理监听', () => {
    const cb = vi.fn()
    const un1 = bridge.onExportDone(cb)
    window.dispatchEvent(new CustomEvent('export-done', { detail: { format: 'HTML', path: '/x' } }))
    expect(cb).toHaveBeenCalledWith({ format: 'HTML', path: '/x' })
    un1()
    window.dispatchEvent(new CustomEvent('export-done', { detail: { format: 'HTML', path: '/y' } }))
    expect(cb).toHaveBeenCalledTimes(1)

    const cb2 = vi.fn()
    const un2 = bridge.onFileOpen(cb2)
    window.dispatchEvent(new CustomEvent('file-open', { detail: { filePath: '/f', content: 'c' } }))
    expect(cb2).toHaveBeenCalledWith({ filePath: '/f', content: 'c' })
    un2()

    const cb3 = vi.fn()
    const un3 = bridge.onMenuAction(cb3)
    window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'save' } }))
    expect(cb3).toHaveBeenCalledWith('save')
    un3()
    window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: 'open' } }))
    expect(cb3).toHaveBeenCalledTimes(1)
  })
})

describe('bridge app info', () => {
  it('getVersion 返回 invoke 值', async () => {
    mockedInvoke.mockResolvedValueOnce('1.0.0')
    await expect(bridge.getVersion()).resolves.toBe('1.0.0')
  })

  it('getEnv 返回版本与平台', async () => {
    mockedInvoke.mockResolvedValueOnce('0.0.0-test')
    const env = await bridge.getEnv()
    expect(env.tauri).toBe('0.0.0-test')
    expect(typeof env.platform).toBe('string')
    expect(['x64', 'x86']).toContain(env.arch)
  })
})

describe('bridge knowledge (JS fallback wrapper)', () => {
  it('knowledgeInitialize 初始化索引并返回 true', async () => {
    await expect(bridge.knowledgeInitialize('/ws')).resolves.toBe(true)
  })

  it('knowledgeGetBacklinks / knowledgeGetGraph / knowledgeGetTags 返回结构', () => {
    expect(bridge.knowledgeGetBacklinks('/ws/a.md')).toEqual({ linked: [], unlinked: [] })
    const graph = bridge.knowledgeGetGraph()
    expect(Array.isArray(graph.nodes)).toBe(true)
    expect(bridge.knowledgeGetTags()).toEqual({})
  })

  it('knowledgeCreateDailyNote 返回文件路径', async () => {
    const path = await bridge.knowledgeCreateDailyNote()
    expect(path).toMatch(/\.md$/)
  })

  it('knowledgeReindex 返回 true', async () => {
    await expect(bridge.knowledgeReindex('/ws/a.md')).resolves.toBe(true)
  })

  it('knowledgeSearchFiles 在空根路径时走 JS 回退', async () => {
    useSidebarStore.setState({ rootPath: '' })
    await expect(bridge.knowledgeSearchFiles('query')).resolves.toEqual([])
  })

  it('knowledgeSearchFiles 在 JS 后端将相对路径转绝对路径', async () => {
    localStorage.setItem('confucius-knowledge-backend', 'js')
    useSidebarStore.setState({ rootPath: '/ws' })
    await expect(bridge.knowledgeSearchFiles('query')).resolves.toEqual([])
  })

  it('knowledgeSearchFiles 在 Rust 后端走 Tantivy', async () => {
    localStorage.removeItem('confucius-knowledge-backend')
    useSidebarStore.setState({ rootPath: '/ws' })
    mockedInvoke.mockResolvedValueOnce([])
    await expect(bridge.knowledgeSearchFiles('query')).resolves.toEqual([])
    expect(mockedInvoke).toHaveBeenCalledWith('search_text', expect.objectContaining({ rootPath: '/ws' }))
  })

  it('knowledgeResolveLink 在 Rust 后端无结果时返回 null', async () => {
    localStorage.removeItem('confucius-knowledge-backend')
    useSidebarStore.setState({ rootPath: '/ws' })
    mockedInvoke.mockResolvedValueOnce([])
    await expect(bridge.knowledgeResolveLink('My"Title')).resolves.toBeNull()
  })

  it('knowledgeResolveLink 在空根路径走 JS 回退', async () => {
    useSidebarStore.setState({ rootPath: '' })
    await expect(bridge.knowledgeResolveLink('Note')).resolves.toBeNull()
  })
})

describe('bridge knowledge (Rust IPC)', () => {
  it('knowledgeInitRust / knowledgeGetBacklinksRust 透传 invoke', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined)
    await bridge.knowledgeInitRust('/ws')
    expect(mockedInvoke).toHaveBeenCalledWith('knowledge_init_loaded', { workspacePath: '/ws' })

    mockedInvoke.mockResolvedValueOnce([])
    await bridge.knowledgeGetBacklinksRust('/ws/a.md')
    expect(mockedInvoke).toHaveBeenCalledWith('knowledge_get_backlinks', { filePath: '/ws/a.md' })
  })

  it('knowledgeGetGraphRust 无路径时传 null', async () => {
    mockedInvoke.mockResolvedValueOnce({ nodes: [], links: [] })
    await bridge.knowledgeGetGraphRust()
    expect(mockedInvoke).toHaveBeenCalledWith('knowledge_get_graph', { filePath: null })
  })

  it('knowledgeGetGraphRust 有路径则传路径', async () => {
    mockedInvoke.mockResolvedValueOnce({ nodes: [], links: [] })
    await bridge.knowledgeGetGraphRust('/ws/a.md')
    expect(mockedInvoke).toHaveBeenCalledWith('knowledge_get_graph', { filePath: '/ws/a.md' })
  })

  it('knowledgeGetTagsRust / knowledgeReindexRust / checkPandoc / importFile 透传', async () => {
    mockedInvoke.mockResolvedValueOnce({})
    await bridge.knowledgeGetTagsRust()
    expect(mockedInvoke).toHaveBeenCalledWith('knowledge_get_tags')

    mockedInvoke.mockResolvedValueOnce(undefined)
    await bridge.knowledgeReindexRust('/ws', '/ws/a.md')
    expect(mockedInvoke).toHaveBeenCalledWith('knowledge_reindex', { workspacePath: '/ws', filePath: '/ws/a.md' })

    mockedInvoke.mockResolvedValueOnce(false)
    await expect(bridge.checkPandoc()).resolves.toBe(false)

    mockedInvoke.mockResolvedValueOnce({ content: '# imported', suggestedName: 'a.md' })
    await expect(bridge.importFile('/a.docx')).resolves.toEqual({ content: '# imported', suggestedName: 'a.md' })
  })
})
