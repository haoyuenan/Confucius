import { ipcMain, app, dialog, BrowserWindow, Menu, shell } from 'electron'
import path from 'path'
import fs from 'fs/promises'
import { FileService } from './services/file-service'
import { FileWatcher } from './services/file-watcher'
import { ExportService } from './services/export-service'
import { SearchService } from './services/search-service'
import { ScannerService } from './services/scanner-service'

const fileService = new FileService()
const searchService = new SearchService()
const exportService = new ExportService()
const scannerService = new ScannerService()
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
    return await fileService.readFileContent(result.filePaths[0])
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

  // ---- 插件选择对话框 ----
  ipcMain.handle('dialog:open-plugin', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '加载插件',
      filters: [
        { name: 'JavaScript 插件', extensions: ['js', 'mjs'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return await fileService.readFileContent(result.filePaths[0])
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
    return await fileService.readFileContent(filePath)
  })

  ipcMain.handle('file:write', async (_event, payload: { filePath: string; content: string }) => {
    const { filePath: targetPath, content } = payload
    await fileService.writeFile(targetPath, content)
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
    return await fileService.buildFileTree(rootPath)
  })

  // ---- 文件监听 ----
  ipcMain.handle('file-watcher:start', async (_event, rootPath: string) => {
    const safePath = fileService.sanitizePath(rootPath)
    fileWatcher?.unwatch()
    fileWatcher = new FileWatcher()
    fileWatcher.watch(safePath, () => {
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
    const safeParent = fileService.sanitizePath(parentPath)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    const result = await dialog.showSaveDialog(win, {
      title: '新建 Markdown 文件',
      defaultPath: path.join(safeParent, '未命名.md'),
      filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
    })
    if (result.canceled || !result.filePath) return false
    await fileService.writeFile(result.filePath, '')
    return true
  })

  ipcMain.handle('sidebar:create-dir', async (_event, parentPath: string) => {
    const safeParent = fileService.sanitizePath(parentPath)
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return false
    const result = await dialog.showSaveDialog(win, {
      title: '新建目录',
      defaultPath: path.join(safeParent, '新建文件夹'),
    })
    if (result.canceled || !result.filePath) return false
    await fs.mkdir(result.filePath, { recursive: true })
    return true
  })

  ipcMain.handle('sidebar:rename', async (_event, payload: { oldPath: string; newName: string }) => {
    await fileService.rename(payload.oldPath, payload.newName)
  })

  ipcMain.handle('sidebar:delete', async (_event, targetPath: string) => {
    await fileService.delete(targetPath)
  })

  ipcMain.handle('sidebar:reveal', async (_event, targetPath: string) => {
    const safePath = fileService.sanitizePath(targetPath)
    shell.showItemInFolder(safePath)
  })

  // ---- 全局搜索 ----
  ipcMain.handle('search:query', async (_event, params: {
    rootPath: string; query: string; caseSensitive?: boolean; regex?: boolean; maxResults?: number
  }) => {
    return await searchService.search(params.rootPath, params.query, {
      caseSensitive: params.caseSensitive,
      regex: params.regex,
      maxResults: params.maxResults,
    })
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

  // ---- 插件扫描 ----
  ipcMain.handle('scanner:scan', async (_event, dirPath: string) => {
    return await scannerService.scanDirectory(dirPath)
  })

  ipcMain.handle('scanner:read-entry', async (_event, entryPath: string) => {
    return await scannerService.readEntry(entryPath)
  })
}
