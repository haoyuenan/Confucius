import { app, BrowserWindow } from 'electron'
import path from 'path'
import { setupMenu } from './menu'
import { registerIpcHandlers } from './ipc-handlers'

// 在打包后的生产环境，__dirname 指向 dist-electron
const DIST_ELECTRON = path.join(__dirname)
const DIST = path.join(DIST_ELECTRON, '../dist')

// Vite 开发服务器的地址（由 vite-plugin-electron 注入环境变量）
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null

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
  })

  // 开发环境加载 Vite dev server，生产环境加载构建产物
  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(DIST, 'index.html'))
  }
}

app.whenReady().then(() => {
  createMainWindow()
  setupMenu(mainWindow!)
  registerIpcHandlers()

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
