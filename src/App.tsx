import { useEffect, useCallback, useState, useRef } from 'react'
import { useAppStore } from './stores/app-store'
import { useEditorStore } from './stores/editor-store'
import { useTabStore } from './stores/tab-store'
import { useSidebarStore } from './stores/sidebar-store'
import Sidebar from './components/Sidebar/Sidebar'
import EditorLayout from './components/Editor/EditorLayout'
import StatusBar from './components/Editor/StatusBar'
import { themeService, getThemeDef, getThemesByMode, type ThemeId } from './services/theme-service'
import { checkLargeFile } from './editor/large-file-handler'
import { PluginEngine } from './engine/PluginEngine'
import { HostAPIBridgeImpl } from './engine/HostAPIBridge'
import { StatusBarPlugin } from './plugins/builtins/status-bar-info'
import SettingsDialog, { type SettingsTab, THEME_SWATCHES } from './components/Settings/SettingsDialog'
import CommandPalette from './components/CommandPalette/CommandPalette'
import { getActiveView } from './editor/active-view'
import * as bridge from './services/electron-bridge'
import { loadSession, subscribeAutoSave } from './services/workspace-store'

function App() {
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
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

  // Ctrl+E 打开命令面板
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault()
        setShowCommandPalette((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // 启动：恢复工作区 或 建空白标签
  useEffect(() => {
    const session = loadSession()
    if (session) {
      // 同步恢复：主题 + 侧边栏
      themeService.switchTheme(session.theme as ThemeId)
      setCurrentTheme(session.theme as ThemeId)
      useAppStore.getState().setSidebarWidth(session.sidebar.width)
      if (!session.sidebar.visible) {
        useAppStore.getState().toggleSidebar()
      }
      useSidebarStore.getState().setActiveTab(session.sidebar.activeTab)
      useSidebarStore.getState().setExpandedPaths(session.sidebar.expandedPaths)

      // 异步恢复标签页（串行读文件，避免 IPC 竞争）
      ;(async () => {
        for (const t of session.tabs) {
          if (t.filePath) {
            try {
              const data = await bridge.readFile(t.filePath)
              useTabStore.getState().openFile(t.filePath, data.content)
            } catch { continue }
          } else {
            useTabStore.getState().newUntitledTab()
          }
        }
        const tabs = useTabStore.getState().tabs
        const idx = Math.min(session.activeTabIndex, tabs.length - 1)
        if (tabs[idx]) useTabStore.getState().activateTab(tabs[idx].id)
      })()
    } else {
      if (useTabStore.getState().tabs.length === 0) {
        newUntitledTab()
      }
    }

    // 订阅自动保存 + beforeunload
    const unsub = subscribeAutoSave()
    return () => unsub()
  }, [newUntitledTab]) // eslint-disable-line react-hooks/exhaustive-deps

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
        case 'mode:toggle': useEditorStore.getState().toggleMode(); break
        case 'mode:preview':
          setMode(useEditorStore.getState().mode === 'preview' ? 'split' : 'preview')
          break
        case 'plugin:manage': setSettingsTab('plugin'); break
        case 'settings:display': setSettingsTab('display'); break
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

  // 自动保存：每 5 秒检查未保存的文件
  useEffect(() => {
    const id = setInterval(() => {
      const tab = useTabStore.getState().activeTab()
      if (!tab || !tab.filePath || !tab.isModified) return
      bridge.writeFile(tab.filePath, tab.content)
        .then(() => {
          const s = useTabStore.getState()
          const t = s.tabs.find(t2 => t2.id === tab.id)
          if (t) s.markTabSaved(tab.id)
        })
        .catch((err) => console.error('自动保存失败:', err))
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const isPreviewMode = useEditorStore((s) => s.mode) === 'preview'
  const mode = useEditorStore((s) => s.mode)
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(themeService.getCurrentTheme())

  const handleSearch = useCallback(() => {
    toggleSidebar()
    setActiveTab('search')
  }, [toggleSidebar, setActiveTab])

  const currentMode = getThemeDef(currentTheme).mode

  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const themePickerRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭主题选择器
  useEffect(() => {
    if (!themePickerOpen) return
    const onOutsideClick = (e: MouseEvent) => {
      if (themePickerRef.current && !themePickerRef.current.contains(e.target as Node)) {
        setThemePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [themePickerOpen])

  const handleToggleTheme = useCallback(() => {
    themeService.toggleTheme()
    setCurrentTheme(themeService.getCurrentTheme())
  }, [])

  const handleThemeSelect = useCallback((id: ThemeId) => {
    themeService.switchTheme(id)
    setCurrentTheme(id)
    setThemePickerOpen(false)
  }, [])

  const currentThemes = getThemesByMode(currentMode)

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
          <div className="theme-picker-wrapper" ref={themePickerRef}>
            <button
              className="toolbar-btn theme-picker-btn"
              onClick={() => setThemePickerOpen((v) => !v)}
              title="选择主题"
            >
              🎨
            </button>
            {themePickerOpen && (
              <div className="theme-picker-dropdown">
                {currentThemes.map((t) => {
                  const swatch = THEME_SWATCHES[t.id]
                  const active = currentTheme === t.id
                  return (
                    <button
                      key={t.id}
                      className={`theme-picker-card${active ? ' active' : ''}`}
                      onClick={() => handleThemeSelect(t.id)}
                    >
                      <div className="theme-picker-card-swatches">
                        <div style={{ background: swatch.bg }} />
                        <div style={{ background: swatch.secondary }} />
                        <div style={{ background: swatch.accent }} />
                      </div>
                      <span className="theme-picker-card-label">{t.icon} {t.label}</span>
                      {active && <span className="theme-picker-card-check">✓</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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

        </aside>
        <main className="app-main"><EditorLayout /></main>
      </div>
      <StatusBar />
      {settingsTab && <SettingsDialog initialTab={settingsTab} onClose={() => setSettingsTab(null)} />}
      {showCommandPalette && (
        <CommandPalette
          context={{
            newUntitledTab: handleNewFile,
            openFile: handleOpenFile,
            saveFile: handleSaveFile,
            saveAs: handleSaveAs,
            toggleSidebar: () => toggleSidebar(),
            toggleMode: () => useEditorStore.getState().toggleMode(),
            togglePreview: () => setMode(
              useEditorStore.getState().mode === 'preview' ? 'split' : 'preview',
            ),
            toggleFocus: () => toggleFocusMode(),
            toggleTypewriter: () => toggleTypewriterMode(),
            toggleTheme: () => handleToggleTheme(),
            openSettings: (tab) => setSettingsTab((tab ?? 'general') as any),
            exportHtml: () => bridge.exportHtml(),
            exportPdf: () => bridge.printPreview(),
            search: () => handleSearch(),
            findInDocument: () => getActiveView()?.focus(),
          }}
          onClose={() => setShowCommandPalette(false)}
        />
      )}
    </div>
  )
}

export default App
