import { useEffect, useCallback, useState } from 'react'
import { useAppStore } from './stores/app-store'
import { useEditorStore } from './stores/editor-store'
import { useTabStore } from './stores/tab-store'
import { useSidebarStore } from './stores/sidebar-store'
import Sidebar from './components/Sidebar/Sidebar'
import EditorLayout from './components/Editor/EditorLayout'
import ThemeSelector from './components/Settings/ThemeSelector'
import ModeSwitch from './components/Editor/ModeSwitch'
import StatusBar from './components/Editor/StatusBar'
import { themeService } from './services/theme-service'
import { checkLargeFile } from './editor/large-file-handler'
import { PluginEngine } from './engine/PluginEngine'
import { HostAPIBridgeImpl } from './engine/HostAPIBridge'
import { StatusBarPlugin } from './plugins/builtins/status-bar-info'
import PluginManagerDialog from './components/Settings/PluginManagerDialog'
import * as bridge from './services/electron-bridge'

function App() {
  const [showPluginDialog, setShowPluginDialog] = useState(false)
  const version = useAppStore((s) => s.version)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)

  const activeTab = useTabStore((s) => s.activeTab())
  const newUntitledTab = useTabStore((s) => s.newUntitledTab)
  const markTabSaved = useTabStore((s) => s.markTabSaved)
  const openFile = useTabStore((s) => s.openFile)

  const setVersion = useAppStore((s) => s.setVersion)
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

  // 初始化插件引擎
  useEffect(() => {
    const engine = new PluginEngine({
      bridge: new HostAPIBridgeImpl(),
      // 内置插件目录（开发时映射到项目根目录）
      builtinDir: 'plugins/builtins',
      builtinPlugins: {
        'builtin:status-bar': new StatusBarPlugin(),
      },
    })
    engine.start()
    ;(window as any).__pluginEngine = engine
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
        case 'theme:light': themeService.switchTheme('light'); break
        case 'theme:dark': themeService.switchTheme('dark'); break
        case 'theme:sepia': themeService.switchTheme('sepia'); break
        case 'mode:toggle': useEditorStore.getState().toggleMode(); break
        case 'mode:preview':
          setMode(useEditorStore.getState().mode === 'preview' ? 'split' : 'preview')
          break
        case 'plugin:manage': setShowPluginDialog(true); break
        case 'focus:mode': toggleFocusMode(); break
        case 'typewriter:mode': toggleTypewriterMode(); break
        case 'file:close': window.close(); break
      }
    })
    return () => cleanup?.()
  }, [toggleSidebar, handleNewFile, handleOpenFile, handleSaveFile, handleSaveAs, setActiveTab, toggleFocusMode, toggleTypewriterMode])

  useEffect(() => {
    bridge.getVersion().then(setVersion).catch(console.error)
  }, [setVersion])

  useEffect(() => {
    const cleanup = bridge.onExportDone((info) => {
      if (window.Notification?.permission === 'granted') {
        new window.Notification('导出完成', { body: `${info.format} 已导出到: ${info.path}` })
      }
    })
    return () => cleanup?.()
  }, [])

  const fileName = activeTab?.fileName ?? 'Confucius'
  const isModified = activeTab?.isModified ?? false
  const hasFile = activeTab !== null
  const isPreviewMode = useEditorStore((s) => s.mode) === 'preview'

  return (
    <div className={`app-root${isPreviewMode ? ' preview-mode' : ''}`}>
      <header className="app-titlebar">
        <span className="app-title">
          {hasFile ? <>{fileName}{isModified && <span className="modified-dot"> ●</span>}</> : 'Confucius'}
        </span>
        <span className="app-version">v{version || '...'}</span>
      </header>
      <div className="app-body">
        <aside className={`app-sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
          <Sidebar />
          <div className="sidebar-footer"><ThemeSelector /></div>
        </aside>
        <main className="app-main"><EditorLayout /></main>
        <ModeSwitch />
      </div>
      <StatusBar />
      {showPluginDialog && <PluginManagerDialog onClose={() => setShowPluginDialog(false)} />}
    </div>
  )
}

export default App
