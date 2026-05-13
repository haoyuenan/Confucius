import { ipcMain, app, dialog, BrowserWindow, Menu, shell } from 'electron'
import { FileService } from './services/file-service'
import { FileWatcher } from './services/file-watcher'
import { ExportService } from './services/export-service'
import { SearchService } from './services/search-service'
import { ScannerService } from './services/scanner-service'
import { spawn } from 'child_process'
import path from 'path'

const fileService = new FileService()
const searchService = new SearchService()
const exportService = new ExportService()
const scannerService = new ScannerService()
let fileWatcher: FileWatcher | null = null

/** 当前打开的工作区路径，供 local-asset 协议路径校验使用 */
export let currentWorkspacePath: string | null = null

/**
 * 解析插件目录路径
 * 开发模式：使用 process.cwd()（项目根目录）
 * 打包后：使用 process.resourcesPath（app.asar 外的 resources 目录）
 */
function resolvePluginPath(dirPath: string): string {
  // 如果已经是绝对路径，直接返回
  if (path.isAbsolute(dirPath)) {
    return dirPath
  }
  // 防止路径穿越：拒绝包含 .. 的相对路径
  if (dirPath.includes('..')) {
    throw new Error(`拒绝：插件路径包含非法遍历: ${dirPath}`)
  }
  // 开发模式检测：app.isPackaged 为 false
  const basePath = app.isPackaged ? process.resourcesPath : process.cwd()
  return path.join(basePath, dirPath)
}

/**
 * IPC 处理器包装：自动捕获异常并返回 { error } 格式
 * 避免渲染进程收到未处理的 Promise rejection
 */
function handle(
  channel: string,
  handler: (event: Electron.IpcMainInvokeEvent, ...args: any[]) => any,
): void {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return await handler(event, ...args)
    } catch (err: unknown) {
      console.error(`[IPC] ${channel} handler failed:`, err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      return { error: errorMessage }
    }
  })
}

export function registerIpcHandlers(): void {
  // ---- 应用 ----
  handle('app:get-version', () => app.getVersion())
  handle('app:get-env', () => ({
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    platform: process.platform,
    arch: process.arch,
  }))

  // ---- 文件对话框 ----
  handle('dialog:open-file', async () => {
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

  handle('dialog:save-file', async () => {
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
  handle('dialog:open-plugin', async () => {
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

  handle('dialog:open-folder', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return null
    const result = await dialog.showOpenDialog(win, {
      title: '打开文件夹',
      properties: ['openDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    currentWorkspacePath = result.filePaths[0]
    return result.filePaths[0]
  })

  // ---- 文件读写 ----
  handle('file:read', async (_event, filePath: string) => {
    return await fileService.readFileContent(filePath)
  })

  handle('file:write', async (_event, payload: { filePath: string; content: string }) => {
    const { filePath: targetPath, content } = payload
    await fileService.writeFile(targetPath, content)
  })

  handle('file:confirm-save', async () => {
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
  handle('file-tree:build', async (_event, rootPath: string) => {
    return await fileService.buildFileTree(rootPath)
  })

  // ---- 文件监听 ----
  handle('file-watcher:start', async (_event, rootPath: string) => {
    const safePath = fileService.sanitizePath(rootPath)
    fileWatcher?.unwatch()
    fileWatcher = new FileWatcher()
    fileWatcher.watch(safePath, () => {
      const win = BrowserWindow.getAllWindows()[0]
      win?.webContents.send('file-tree:changed')
    })
  })

  handle('file-watcher:stop', async () => {
    fileWatcher?.unwatch()
    fileWatcher = null
  })

  // ---- 侧边栏右键菜单 ----
  handle('sidebar:context-menu', async (event, params: { nodePath: string; nodeType: string }) => {
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
  handle('sidebar:create-file', async (_event, parentPath: string) => {
    await fileService.createFile(parentPath)
    return true
  })

  handle('sidebar:create-dir', async (_event, parentPath: string) => {
    await fileService.createDir(parentPath)
    return true
  })

  handle('sidebar:rename', async (_event, payload: { oldPath: string; newName: string }) => {
    await fileService.rename(payload.oldPath, payload.newName)
  })

  handle('sidebar:delete', async (_event, targetPath: string) => {
    await fileService.delete(targetPath)
  })

  handle('sidebar:reveal', async (_event, targetPath: string) => {
    const safePath = fileService.sanitizePath(targetPath)
    shell.showItemInFolder(safePath)
  })

  // ---- 全局搜索 ----
  handle('search:query', async (_event, params: {
    rootPath: string; query: string; caseSensitive?: boolean; regex?: boolean; maxResults?: number
  }) => {
    return await searchService.search(params.rootPath, params.query, {
      caseSensitive: params.caseSensitive,
      regex: params.regex,
      maxResults: params.maxResults,
    })
  })

  // ---- 导出 ----
  handle('export:html', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    await exportService.exportHtml(win)
  })

  handle('export:pdf', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    await exportService.exportPdf(win)
  })

  // ---- 打印 ----
  handle('print:preview', async () => {
    const win = BrowserWindow.getFocusedWindow()
    if (!win) return
    await exportService.printPreview(win)
  })

  // ---- 外部链接 ----
  handle('shell:open-external', async (_event, url: string) => {
    // 仅允许 http/https 协议，防止恶意协议调用
    if (/^https?:\/\//i.test(url)) {
      await shell.openExternal(url)
    }
  })

  // ---- 插件扫描 ----
  handle('scanner:scan', async (_event, dirPath: string) => {
    const resolvedPath = resolvePluginPath(dirPath)
    console.log(`[scanner] scanning: ${dirPath} -> ${resolvedPath}`)
    return await scannerService.scanDirectory(resolvedPath)
  })

  handle('scanner:read-entry', async (_event, entryPath: string) => {
    return await scannerService.readEntry(entryPath)
  })

  // ---- 代码运行 ----
  handle('plugin:run-code', async (_event, { language, code, options }: {
    language: string
    code: string
    options?: {
      timeout?: number
    }
  }) => {
    // 安全验证：只允许 python
    if (language !== 'python') {
      return {
        error: `Unsupported language: ${language}. Only Python is supported.`
      }
    }

    // 安全确认：执行前弹窗提示用户
    const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    const preview = code.length > 200 ? code.slice(0, 200) + '...' : code
    const result = dialog.showMessageBoxSync(focusedWindow, {
      type: 'warning',
      buttons: ['取消', '执行'],
      defaultId: 0,
      cancelId: 0,
      title: '代码执行确认',
      message: '即将执行 Python 代码，请确认是否继续？',
      detail: `代码预览:\n${preview}`,
    })
    if (result !== 1) {
      return { stdout: '', stderr: '', exitCode: -1, error: '用户取消执行' }
    }

    return await runPythonCode(code, options?.timeout)
  })
}

/**
 * Python 解释器白名单
 * 仅允许这些命令，防止命令注入
 */
const PYTHON_WHITELIST = ['python', 'python3', 'py']

/**
 * 查找可用的 Python 解释器
 */
function findPythonPath(): string {
  // 在打包环境中，可能需要检查常见路径
  // 这里返回第一个白名单中的命令
  return PYTHON_WHITELIST[0]
}

/**
 * 运行 Python 代码
 * @param code Python 代码
 * @param timeout 超时时间（毫秒）
 * @returns 执行结果
 */
async function runPythonCode(
  code: string,
  timeout: number = 30000
): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }> {
  // 限制代码长度，防止恶意超大输入
  if (code.length > 100_000) {
    return { stdout: '', stderr: '', exitCode: -1, error: '代码长度超出限制（最大 100KB）' }
  }
  const MAX_OUTPUT = 1024 * 1024 // 1MB
  const pythonPath = findPythonPath()
  return new Promise((resolve) => {
    const pythonProcess = spawn(pythonPath, ['-c', code])

    let stdout = ''
    let stderr = ''
    let outputExceeded = false

    // 收集标准输出（带大小限制）
    pythonProcess.stdout.on('data', (data) => {
      if (outputExceeded) return
      stdout += data.toString()
      if (stdout.length > MAX_OUTPUT) {
        outputExceeded = true
        stdout = stdout.slice(0, MAX_OUTPUT) + '\n... [输出截断：超过 1MB]'
        pythonProcess.kill('SIGTERM')
      }
    })

    // 收集标准错误（带大小限制）
    pythonProcess.stderr.on('data', (data) => {
      if (outputExceeded) return
      stderr += data.toString()
      if (stderr.length > MAX_OUTPUT) {
        outputExceeded = true
        stderr = stderr.slice(0, MAX_OUTPUT) + '\n... [输出截断：超过 1MB]'
        pythonProcess.kill('SIGTERM')
      }
    })

    // 设置超时
    const timeoutId = setTimeout(() => {
      pythonProcess.kill('SIGTERM')
      resolve({
        stdout,
        stderr,
        exitCode: -1,
        error: `执行超时（${timeout}ms），进程已被终止。`
      })
    }, timeout)

    // 进程结束
    pythonProcess.on('close', (exitCode) => {
      clearTimeout(timeoutId)
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 0
      })
    })

    // 进程错误
    pythonProcess.on('error', (err) => {
      clearTimeout(timeoutId)
      resolve({
        stdout,
        stderr,
        exitCode: -1,
        error: `启动 Python 进程失败: ${err.message}`
      })
    })
  })
}
