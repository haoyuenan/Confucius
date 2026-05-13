import { useEffect, useCallback, useState } from 'react'
import { useAppStore } from './stores/app-store'
import { useEditorStore } from './stores/editor-store'
import { useTabStore } from './stores/tab-store'
import { useSidebarStore } from './stores/sidebar-store'
import Sidebar from './components/Sidebar/Sidebar'
import EditorLayout from './components/Editor/EditorLayout'
import ThemeSelector from './components/Settings/ThemeSelector'
import StatusBar from './components/Editor/StatusBar'
import { themeService, getThemeDef, type ThemeId } from './services/theme-service'
import { checkLargeFile } from './editor/large-file-handler'
import { PluginEngine } from './engine/PluginEngine'
import { HostAPIBridgeImpl } from './engine/HostAPIBridge'
import { StatusBarPlugin } from './plugins/builtins/status-bar-info'
import PluginManagerDialog from './components/Settings/PluginManagerDialog'
import SettingsDialog, { type SettingsTab } from './components/Settings/SettingsDialog'
import * as bridge from './services/electron-bridge'

function App() {
  const [showPluginDialog, setShowPluginDialog] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)

  const newUntitledTab = useTabStore((s) => s.newUntitledTab)
  const markTabSaved = useTabStore((s) => s.markTabSaved)
  const openFile = useTabStore((s) => s.openFile)

  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const setMode = useEditorStore((s) => s.setMode)
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode)
  const toggleTypewriterMode = useEditorStore((s) => s.toggleTypewriterMode)
  const setIsLargeFile = useEditorStore((s) => s.setIsLargeFile)

  const setActiveTab = useSidebarStore((s) => s.setActiveTab)

  // 首次启动自动建一个空标签
  useEffect(() => {
    if (useTabStore.getState().tabs.length === 0) {
      newUntitledTab()
    }
  }, [newUntitledTab])

  // 启动时同步菜单显示状态
  useEffect(() => {
    const hidden = localStorage.getItem('confucius-hide-menu') !== 'false'
    bridge.setMenuVisible(!hidden).catch(() => {})
  }, [])

  // 初始化插件引擎（防止 StrictMode / HMR 重复初始化）
  useEffect(() => {
    const w = window as { __pluginEngine?: PluginEngine }
    if (w.__pluginEngine) return

    const engine = new PluginEngine({
      bridge: new HostAPIBridgeImpl(),
      builtinDir: 'plugins/builtins',
      builtinPlugins: {
        'builtin:status-bar': new StatusBarPlugin(),
      },
    })
    engine.start().catch((err) => {
      console.error('[App] Plugin engine start failed:', err)
    })
    w.__pluginEngine = engine
  }, [])

  const handleSaveFile = useCallback(async () => {
    const tab = useTabStore.getState().activeTab()
    if (!tab || !tab.filePath) return
    try {
      await bridge.writeFile(tab.filePath, tab.content)
      markTabSaved(tab.id)
    } catch (err) {
      console.error('保存文件失败:', err)
    }
  }, [markTabSaved])

  const handleOpenFile = useCallback(async () => {
    const file = await bridge.openFileDialog()
    if (!file) return

    const large = checkLargeFile(file.content.length)
    if (large.isLarge) {
      setIsLargeFile(true)
      setMode('split')
    } else {
      setIsLargeFile(false)
    }
    openFile(file.filePath, file.content)
  }, [openFile, setIsLargeFile, setMode])

  const handleSaveAs = useCallback(async () => {
    const tab = useTabStore.getState().activeTab()
    if (!tab) return
    const fp = await bridge.saveFileDialog()
    if (!fp) return
    try {
      await bridge.writeFile(fp, tab.content)
      openFile(fp, tab.content)
    } catch (err) {
      console.error('另存为失败:', err)
    }
  }, [openFile])

  const handleNewFile = useCallback(async () => {
    newUntitledTab()
  }, [newUntitledTab])

  useEffect(() => {
    const cleanup = bridge.onMenuAction((action) => {
      switch (action) {
        case 'view:toggle-sidebar': toggleSidebar(); break
        case 'file:new': handleNewFile(); break
        case 'file:open': handleOpenFile(); break
        case 'file:save': handleSaveFile(); break
        case 'file:save-as': handleSaveAs(); break
        case 'search:focus': toggleSidebar(); setActiveTab('search'); break
        case 'export:html': bridge.exportHtml(); break
        case 'export:pdf': bridge.exportPdf(); break
        case 'theme:light': themeService.switchTheme('plain-white'); setCurrentTheme('plain-white'); break
        case 'theme:dark': themeService.switchTheme('night-black'); setCurrentTheme('night-black'); break
        case 'theme:sepia': themeService.switchTheme('warm-sun'); setCurrentTheme('warm-sun'); break
        case 'mode:toggle': useEditorStore.getState().toggleMode(); break
        case 'mode:preview':
          setMode(useEditorStore.getState().mode === 'preview' ? 'split' : 'preview')
          break
        case 'plugin:manage': setShowPluginDialog(true); break
        case 'app:about': setSettingsTab('about'); break
        case 'focus:mode': toggleFocusMode(); break
        case 'typewriter:mode': toggleTypewriterMode(); break
        case 'file:close': window.close(); break
      }
    })
    return () => cleanup?.()
  }, [toggleSidebar, handleNewFile, handleOpenFile, handleSaveFile, handleSaveAs, setActiveTab, toggleFocusMode, toggleTypewriterMode, setMode])

  useEffect(() => {
    const cleanup = bridge.onExportDone((info) => {
      if (window.Notification?.permission === 'granted') {
        new window.Notification('导出完成', { body: `${info.format} 已导出到: ${info.path}` })
      }
    })
    return () => cleanup?.()
  }, [])

  // 监听外部文件打开（拖拽文件到应用图标）
  useEffect(() => {
    const cleanup = bridge.onFileOpen((data) => {
      const large = checkLargeFile(data.content.length)
      if (large.isLarge) {
        setIsLargeFile(true)
        setMode('split')
      } else {
        setIsLargeFile(false)
      }
      openFile(data.filePath, data.content)
    })
    return () => cleanup?.()
  }, [openFile, setIsLargeFile, setMode])

  const isPreviewMode = useEditorStore((s) => s.mode) === 'preview'
  const mode = useEditorStore((s) => s.mode)
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(themeService.getCurrentTheme())

  const handleSearch = useCallback(() => {
    toggleSidebar()
    setActiveTab('search')
  }, [toggleSidebar, setActiveTab])

  const currentMode = getThemeDef(currentTheme).mode

  const handleToggleTheme = useCallback(() => {
    themeService.toggleTheme()
    setCurrentTheme(themeService.getCurrentTheme())
  }, [])

  const handleExport = useCallback(() => {
    bridge.exportHtml()
  }, [])

  const handlePrint = useCallback(() => {
    bridge.printPreview()
  }, [])

  const handleSettings = useCallback(() => {
    setSettingsTab('general')
  }, [])

  const handleEditToggle = useCallback(() => {
    useEditorStore.getState().toggleMode()
  }, [])

  const handleViewToggle = useCallback(() => {
    const cur = useEditorStore.getState().mode
    setMode(cur === 'preview' ? 'split' : 'preview')
  }, [setMode])

  return (
    <div className={`app-root${isPreviewMode ? ' preview-mode' : ''}`}>
      <header className="app-titlebar">
        {/* 品牌区 — 左侧固定 */}
        <div className="titlebar-brand">
          <span className="titlebar-app-name">Confucius：一个安静的写作/阅读空间</span>
        </div>
        {/* 工具栏 — 占满剩余空间，右对齐 */}
        <div className="titlebar-tools">
          <button className="toolbar-btn" onClick={handleNewFile} title="新建 (Ctrl+N)">📄 新建</button>
          <button className="toolbar-btn" onClick={handleOpenFile} title="打开 (Ctrl+O)">📂 打开</button>
          <button className="toolbar-btn" onClick={() => { toggleSidebar() }} title="切换侧边栏 (Ctrl+\)">📑 侧边</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleSearch} title="全局搜索 (Ctrl+Shift+F)">🔍 搜索</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleToggleTheme} title="切换浅色/深色模式">
            {currentMode === 'light' ? '🌙 深色' : '☀ 浅色'}
          </button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleExport} title="导出 HTML">📤 导出</button>
          <button className="toolbar-btn" onClick={handlePrint} title="打印 (Ctrl+P)">🖨 打印</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className={`toolbar-btn${mode !== 'preview' ? ' active' : ''}`} onClick={handleEditToggle} title="切换编辑模式 (split ↔ wysiwyg)">
            ✏ 编辑
          </button>
          <button className={`toolbar-btn${mode === 'preview' ? ' active' : ''}`} onClick={handleViewToggle} title="切换分栏/预览">
            {mode === 'preview' ? '⊞ 分栏' : '👁 预览'}
          </button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleSettings} title="设置">⚙ 设置</button>
        </div>
      </header>
      <div className="app-body">
        <aside className={`app-sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
          <Sidebar />
          <div className="sidebar-footer"><ThemeSelector /></div>
        </aside>
        <main className="app-main"><EditorLayout /></main>
      </div>
      <StatusBar />
      {showPluginDialog && <PluginManagerDialog onClose={() => setShowPluginDialog(false)} />}
      {settingsTab && <SettingsDialog initialTab={settingsTab} onClose={() => setSettingsTab(null)} />}
    </div>
  )
}

export default App
