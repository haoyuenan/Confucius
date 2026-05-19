import { app, Menu, BrowserWindow, MenuItemConstructorOptions } from 'electron'

const ZH_LABELS: Record<string, string> = {
  'menu.file': '文件', 'menu.edit': '编辑', 'menu.view': '视图', 'menu.help': '帮助',
  'menu.new': '新建', 'menu.open': '打开...', 'menu.save': '保存',
  'menu.saveAs': '另存为...', 'menu.export': '导出',
  'menu.exportHtml': '导出为 HTML...', 'menu.exportPdf': '导出为 PDF...',
  'menu.closeWindow': '关闭窗口', 'menu.quit': '退出',
  'menu.undo': '撤销', 'menu.redo': '重做', 'menu.cut': '剪切',
  'menu.copy': '复制', 'menu.paste': '粘贴', 'menu.selectAll': '全选',
  'menu.toggleSidebar': '切换侧边栏', 'menu.toggleMode': '切换编辑模式',
  'menu.togglePreview': '切换预览模式',
  'menu.focusMode': '专注模式', 'menu.typewriter': '打字机模式',
  'menu.search': '搜索', 'menu.themeSettings': '主题设置…',
  'menu.devTools': '开发者工具', 'menu.reload': '重新加载',
  'menu.zoomIn': '放大', 'menu.zoomOut': '缩小', 'menu.resetZoom': '重置缩放',
  'menu.pluginManager': '插件管理', 'menu.about': '关于 Confucius',
}

function lb(labels: Record<string, string> | undefined, key: string): string {
  return labels?.[key] ?? ZH_LABELS[key] ?? key
}

export function setupMenu(win: BrowserWindow, labels?: Record<string, string>): void {
  const L = (key: string) => lb(labels, key)
  const isMac = process.platform === 'darwin'

  const fileMenu: MenuItemConstructorOptions = {
    label: L('menu.file'),
    submenu: [
      { label: L('menu.new'), accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('menu:action', 'file:new') },
      { label: L('menu.open'), accelerator: 'CmdOrCtrl+O', click: () => win.webContents.send('menu:action', 'file:open') },
      { type: 'separator' },
      { label: L('menu.save'), accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('menu:action', 'file:save') },
      { label: L('menu.saveAs'), accelerator: 'CmdOrCtrl+Shift+S', click: () => win.webContents.send('menu:action', 'file:save-as') },
      { type: 'separator' },
      {
        label: L('menu.export'),
        submenu: [
          { label: L('menu.exportHtml'), accelerator: 'CmdOrCtrl+Shift+H', click: () => win.webContents.send('menu:action', 'export:html') },
          { label: L('menu.exportPdf'), accelerator: 'CmdOrCtrl+Shift+E', click: () => win.webContents.send('menu:action', 'export:pdf') },
        ],
      },
      { type: 'separator' },
      ...(isMac
        ? [{ label: L('menu.closeWindow'), accelerator: 'CmdOrCtrl+W', click: () => win.webContents.send('menu:action', 'file:close') } as MenuItemConstructorOptions]
        : [{ role: 'quit' as const, label: L('menu.quit') }]),
    ],
  }

  const editMenu: MenuItemConstructorOptions = {
    label: L('menu.edit'),
    submenu: [
      { role: 'undo', label: L('menu.undo') },
      { role: 'redo', label: L('menu.redo') },
      { type: 'separator' },
      { role: 'cut', label: L('menu.cut') },
      { role: 'copy', label: L('menu.copy') },
      { role: 'paste', label: L('menu.paste') },
      { role: 'selectAll', label: L('menu.selectAll') },
    ],
  }

  const viewMenu: MenuItemConstructorOptions = {
    label: L('menu.view'),
    submenu: [
      { label: L('menu.toggleSidebar'), accelerator: 'CmdOrCtrl+\\', click: () => win.webContents.send('menu:action', 'view:toggle-sidebar') },
      { type: 'separator' },
      { label: L('menu.toggleMode'), accelerator: 'CmdOrCtrl+Shift+P', click: () => win.webContents.send('menu:action', 'mode:toggle') },
      { label: L('menu.togglePreview'), accelerator: 'CmdOrCtrl+Shift+O', type: 'checkbox' as const, click: () => win.webContents.send('menu:action', 'mode:preview') },
      { type: 'separator' },
      { label: L('menu.focusMode'), type: 'checkbox' as const, accelerator: 'F11', click: () => win.webContents.send('menu:action', 'focus:mode') },
      { label: L('menu.typewriter'), type: 'checkbox' as const, accelerator: 'F12', click: () => win.webContents.send('menu:action', 'typewriter:mode') },
      { type: 'separator' },
      { label: L('menu.search'), accelerator: 'CmdOrCtrl+Shift+F', click: () => win.webContents.send('menu:action', 'search:focus') },
      { type: 'separator' },
      { label: L('menu.themeSettings'), click: () => win.webContents.send('menu:action', 'settings:display') },
      { type: 'separator' },
      { role: 'toggleDevTools', label: L('menu.devTools') },
      { role: 'reload', label: L('menu.reload') },
      { type: 'separator' },
      { role: 'zoomIn', label: L('menu.zoomIn') },
      { role: 'zoomOut', label: L('menu.zoomOut') },
      { role: 'resetZoom', label: L('menu.resetZoom') },
    ],
  }

  const helpMenu: MenuItemConstructorOptions = {
    label: L('menu.help'),
    submenu: [
      { label: L('menu.pluginManager'), accelerator: 'CmdOrCtrl+Shift+I', click: () => win.webContents.send('menu:action', 'plugin:manage') },
      { type: 'separator' },
      { label: L('menu.about'), click: () => win.webContents.send('menu:action', 'app:about') },
    ],
  }

  const menuTemplate: MenuItemConstructorOptions[] = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about' as const }, { type: 'separator' as const }, { role: 'hide' as const }, { role: 'hideOthers' as const }, { role: 'unhide' as const }, { type: 'separator' as const }, { role: 'quit' as const },
    ] } as MenuItemConstructorOptions] : []),
    fileMenu, editMenu, viewMenu, helpMenu,
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
}
