import { app, BrowserWindow, protocol, net, Menu, ipcMain } from 'electron'
import path from 'path'
import { setupMenu } from './menu'
import { registerIpcHandlers, currentWorkspacePath } from './ipc-handlers'
import { FileService } from './services/file-service'

// 在打包后的生产环境，__dirname 指向 dist-electron
const DIST_ELECTRON = path.join(__dirname)
const DIST = path.join(DIST_ELECTRON, '../dist')

// Vite 开发服务器的地址（由 vite-plugin-electron 注入环境变量）
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null
let pendingFilePath: string | null = null

const fileService = new FileService()

/**
 * 判断文件是否为 Markdown 文件
 */
function isMarkdownFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.md' || ext === '.markdown'
}

/**
 * 打开文件并发送到渲染进程
 */
async function openFileToRenderer(filePath: string): Promise<void> {
  if (!mainWindow) return
  if (!isMarkdownFile(filePath)) return

  try {
    const result = await fileService.readFileContent(filePath)
    mainWindow.webContents.send('app:open-file', {
      filePath: result.filePath,
      content: result.content,
    })
  } catch (err) {
    console.error('open file failed:', err)
  }
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // 等 ready-to-show 再显示，避免白屏闪烁
    icon: path.join(__dirname, '../public/icons/icon.ico'),
    webPreferences: {
      preload: path.join(DIST_ELECTRON, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // 窗口准备好后再显示
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    // 处理启动前 pending 的文件打开请求
    if (pendingFilePath) {
      openFileToRenderer(pendingFilePath)
      pendingFilePath = null
    }
  })

  // 开发环境加载 Vite dev server，生产环境加载构建产物
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'))
  }

  // 编辑区右键菜单
  mainWindow.webContents.on('context-menu', (_event, params) => {
    const { x, y } = params

    const menu = Menu.buildFromTemplate([
      { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => mainWindow?.webContents.send('menu:action', 'file:save') },
      { label: '另存为...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow?.webContents.send('menu:action', 'file:save-as') },
      { type: 'separator' },
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
    ])
    menu.popup({ window: mainWindow!, x, y })
  })
}

// ─── 单实例锁定（Windows/Linux 拖拽文件到已运行应用图标）───
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  // 已有实例运行，退出当前实例
  app.quit()
} else {
  // 当第二个实例启动时（用户拖拽文件到应用图标），聚焦主窗口并打开文件
  app.on('second-instance', (_event, commandLine) => {
    // 从命令行参数中查找 .md 文件
    for (const arg of commandLine) {
      if (isMarkdownFile(arg)) {
        openFileToRenderer(arg)
        break
      }
    }
    // 聚焦主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// ─── macOS 文件拖拽打开 ───
app.on('open-file', (event, filePath) => {
  event.preventDefault()
  if (!isMarkdownFile(filePath)) return

  if (mainWindow && mainWindow.webContents) {
    openFileToRenderer(filePath)
  } else {
    // 窗口未创建，暂存文件路径
    pendingFilePath = filePath
  }
})

// ─── 启动时检查命令行参数（Windows/Linux 拖拽文件启动应用）───
function checkCommandLineFile(): void {
  // process.argv[0] 是应用路径，[1] 可能是文件路径
  // 开发环境下可能有更多参数（如 vite 相关），需要过滤
  const args = process.argv.slice(1)
  for (const arg of args) {
    // 过滤掉 electron/vite 相关参数
    if (arg.includes('--') || arg.includes('vite') || arg.includes('electron')) continue
    if (isMarkdownFile(arg)) {
      pendingFilePath = arg
      break
    }
  }
}

app.whenReady().then(() => {
  // 注册 local-asset: 协议，用于安全加载本地图片
  protocol.handle('local-asset', async (req) => {
    try {
      const filePath = decodeURIComponent(new URL(req.url).pathname)
      const resolved = path.resolve(filePath)

      // 校验路径必须位于工作区或 userData 目录内
      const allowedDirs = [
        currentWorkspacePath,
        app.getPath('userData'),
      ].filter(Boolean) as string[]

      const isAllowed = allowedDirs.some((dir) => {
        const rel = path.relative(dir, resolved)
        return !rel.startsWith('..') && !path.isAbsolute(rel)
      })
      if (!isAllowed) {
        return new Response('Forbidden', { status: 403 })
      }

      return await net.fetch('file://' + resolved)
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })

  // 检查命令行参数中是否有文件
  checkCommandLineFile()

  createMainWindow()
  setupMenu(mainWindow!)
  registerIpcHandlers()

  // 菜单显示控制（renderer 发来请求时切换）
  ipcMain.handle('menu:set-visible', async (_event, visible: boolean) => {
    if (visible) {
      setupMenu(mainWindow!)
    } else {
      Menu.setApplicationMenu(null)
    }
  })

  // macOS：点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

// 所有窗口关闭时退出
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // 使用 app.exit(0) 而非 app.quit()，避免 vite-plugin-electron
    // 在开发模式下对已退出的进程重复调用 tree-kill 产生乱码错误
    app.exit(0)
  }
})