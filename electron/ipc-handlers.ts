import { ipcMain, app, dialog, BrowserWindow, Menu } from 'electron'
import fs from 'fs/promises'
import path from 'path'
import { SearchService } from './services/search-service'
import { FileWatcher } from './services/file-watcher'
import { ExportService } from './services/export-service'

const searchService = new SearchService()
const exportService = new ExportService()
let fileWatcher: FileWatcher | null = null

export function registerIpcHandlers(): void {
  // ---- 应用 ----
  ipcMain.handle('app:get-version', () => app.getVersion())

  // ---- 文件对话框 ----
  ipcMain.handle('dialog:open-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '打开 Markdown 文件',
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return await readFileContent(result.filePaths[0])
  })

  ipcMain.handle('dialog:save-file', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showSaveDialog(win, {
      title: '保存 Markdown 文件',
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown'] },
        { name: '所有文件', extensions: ['*'] },
      ],
    })
    if (result.canceled || !result.filePath) return null
    return result.filePath
  })

  ipcMain.handle('dialog:open-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '打开文件夹',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // ---- 文件读写 ----
  ipcMain.handle('file:read', async (_event, filePath: string) => {
    return await readFileContent(filePath)
  })

  ipcMain.handle('file:write', async (_event, payload: { filePath: string; content: string }) => {
    const { filePath: targetPath, content } = payload
    const resolvedPath = path.resolve(targetPath)
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
    await fs.writeFile(resolvedPath, content, 'utf-8')
  })

  ipcMain.handle('file:confirm-save', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return 2
    const result = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['保存', '不保存', '取消'],
      defaultId: 0,
      cancelId: 2,
      title: '未保存的更改',
      message: '文件已被修改，是否保存更改？',
    })
    return result.response as 0 | 1 | 2
  })

  // ---- 文件树 ----
  ipcMain.handle('file-tree:build', async (_event, rootPath: string) => {
    return await buildFileTree(rootPath)
  })

  // ---- 文件监听 ----
  ipcMain.handle('file-watcher:start', async (_event, rootPath: string) => {
    fileWatcher?.unwatch()
    fileWatcher = new FileWatcher()
    fileWatcher.watch(rootPath, () => {
      const win = BrowserWindow.getAllWindows()[0]
      win?.webContents.send('file-tree:changed')
    })
  })

  ipcMain.handle('file-watcher:stop', async () => {
    fileWatcher?.unwatch()
    fileWatcher = null
  })

  // ---- 侧边栏右键菜单 ----
  ipcMain.handle('sidebar:context-menu', async (event, params: { nodePath: string; nodeType: string }) => {
    const menu = Menu.buildFromTemplate([
      {
        label: '新建文件',
        click: () => event.sender.send('sidebar:action', { action: 'new-file', path: params.nodePath }),
      },
      {
        label: '新建目录',
        click: () => event.sender.send('sidebar:action', { action: 'new-dir', path: params.nodePath }),
      },
      { type: 'separator' },
      {
        label: '重命名',
        click: () => event.sender.send('sidebar:action', { action: 'rename', path: params.nodePath }),
      },
      {
        label: '删除',
        click: () => event.sender.send('sidebar:action', { action: 'delete', path: params.nodePath }),
      },
      { type: 'separator' },
      {
        label: '在资源管理器中显示',
        click: () => event.sender.send('sidebar:action', { action: 'reveal', path: params.nodePath }),
      },
    ])
    menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! })
  })

  // ---- 侧边栏操作 ----
  ipcMain.handle('sidebar:create-file', async (_event, parentPath: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    const result = await dialog.showSaveDialog(win, {
      title: '新建 Markdown 文件',
      defaultPath: path.join(parentPath, '未命名.md'),
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (result.canceled || !result.filePath) return false
    await fs.writeFile(result.filePath, '', 'utf-8')
    return true
  })

  ipcMain.handle('sidebar:create-dir', async (_event, parentPath: string) => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    const result = await dialog.showSaveDialog(win, {
      title: '新建目录',
      defaultPath: path.join(parentPath, '新建文件夹'),
    })
    if (result.canceled || !result.filePath) return false
    await fs.mkdir(result.filePath, { recursive: true })
    return true
  })

  ipcMain.handle('sidebar:rename', async (_event, payload: { oldPath: string; newName: string }) => {
    const { oldPath: oldPathStr, newName } = payload
    const dir = path.dirname(oldPathStr)
    const newPath = path.join(dir, newName)
    await fs.rename(oldPathStr, newPath)
  })

  ipcMain.handle('sidebar:delete', async (_event, targetPath: string) => {
    const stat = await fs.stat(targetPath)
    if (stat.isDirectory()) {
      await fs.rm(targetPath, { recursive: true, force: true })
    } else {
      await fs.unlink(targetPath)
    }
  })

  ipcMain.handle('sidebar:reveal', async (_event, targetPath: string) => {
    const { shell } = require('electron')
    shell.showItemInFolder(targetPath)
  })

  // ---- 导出 ----
  ipcMain.handle('export:html', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    await exportService.exportHtml(win)
  })

  ipcMain.handle('export:pdf', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    await exportService.exportPdf(win)
  })

  // ---- 全局搜索 ----
  ipcMain.handle('search:query', async (_event, params: {
    rootPath: string
    query: string
    caseSensitive?: boolean
    regex?: boolean
    maxResults?: number
  }) => {
    return await searchService.search(params.rootPath, params.query, {
      caseSensitive: params.caseSensitive,
      regex: params.regex,
      maxResults: params.maxResults,
    })
  })
}

// ---- 工具函数 ----

async function readFileContent(filePath: string): Promise<{
  content: string
  filePath: string
}> {
  const resolvedPath = path.resolve(filePath)
  let content = await fs.readFile(resolvedPath, 'utf-8')
  content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return { content, filePath: resolvedPath }
}

interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

async function buildFileTree(rootPath: string): Promise<FileTreeNode> {
  const stat = await fs.stat(rootPath)
  const name = path.basename(rootPath)
  const node: FileTreeNode = {
    name,
    path: rootPath,
    type: stat.isDirectory() ? 'directory' : 'file',
  }

  if (stat.isDirectory()) {
    const entries = await fs.readdir(rootPath)
    const children: FileTreeNode[] = []

    for (const entry of entries) {
      if (entry.startsWith('.')) continue
      const childPath = path.join(rootPath, entry)
      children.push(await buildFileTree(childPath))
    }

    children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

    node.children = children
  }

  return node
}
