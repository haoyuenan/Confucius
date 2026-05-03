import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron'

export function setupMenu(win: BrowserWindow): void {
  const isMac = process.platform === 'darwin'

  const fileMenu: MenuItemConstructorOptions = {
    label: '文件',
    submenu: [
      { label: '新建', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:action', 'file:new') },
      { label: '打开...', accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:action', 'file:open') },
      { type: 'separator' },
      { label: '保存', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:action', 'file:save') },
      { label: '另存为...', accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:action', 'file:save-as') },
      { type: 'separator' },
      {
        label: '导出',
        submenu: [
          { label: '导出为 HTML...', click: () => win.webContents.send('menu:action', 'export:html') },
          { label: '导出为 PDF...', click: () => win.webContents.send('menu:action', 'export:pdf') },
        ],
      },
      { type: 'separator' },
      isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' },
    ],
  }

  const editMenu: MenuItemConstructorOptions = {
    label: '编辑',
    submenu: [
      { role: 'undo', label: '撤销' },
      { role: 'redo', label: '重做' },
      { type: 'separator' },
      { role: 'cut', label: '剪切' },
      { role: 'copy', label: '复制' },
      { role: 'paste', label: '粘贴' },
      { role: 'selectAll', label: '全选' },
    ],
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: '视图',
    submenu: [
      { label: '切换侧边栏', accelerator: 'CmdOrCtrl+\\', click: () => win.webContents.send('menu:action', 'view:toggle-sidebar') },
      { type: 'separator' },
      { label: '搜索', accelerator: 'CmdOrCtrl+Shift+F', click: () => win.webContents.send('menu:action', 'search:focus') },
      { type: 'separator' },
      {
        label: '主题',
        submenu: [
          { label: '亮色', click: () => win.webContents.send('menu:action', 'theme:light') },
          { label: '暗色', click: () => win.webContents.send('menu:action', 'theme:dark') },
          { label: '护眼', click: () => win.webContents.send('menu:action', 'theme:sepia') },
        ],
      },
      {
        label: '切换编辑模式',
        accelerator: 'CmdOrCtrl+Shift+P',
        click: () => win.webContents.send('menu:action', 'mode:toggle'),
      },
      { type: 'separator' },
      { role: 'toggleDevTools', label: '开发者工具' },
      { role: 'reload', label: '重新加载' },
      { type: 'separator' },
      { role: 'zoomIn', label: '放大' },
      { role: 'zoomOut', label: '缩小' },
      { role: 'resetZoom', label: '重置缩放' },
    ],
  }

  const helpMenu: MenuItemConstructorOptions = {
    label: '帮助',
    submenu: [
      {
        label: '关于 Confucius',
        click: () => {
          const { dialog } = require('electron')
          dialog.showMessageBox(win, {
            type: 'info',
            title: '关于 Confucius',
            message: 'Confucius',
            detail: `版本: ${app.getVersion()}\n本地 Markdown 编辑器`,
          })
        },
      },
    ],
  }

  const menuTemplate: MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ label: app.name, submenu: [
        { role: 'about' as const },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ] } as MenuItemConstructorOptions]
      : []),
    fileMenu,
    editMenu,
    viewMenu,
    helpMenu,
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
}
