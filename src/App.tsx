import { useEffect, useCallback, useState, useRef } from 'react'
import { useAppStore } from './stores/app-store'
import { useEditorStore } from './stores/editor-store'
import { useTabStore } from './stores/tab-store'
import { useSidebarStore } from './stores/sidebar-store'
import Sidebar from './components/Sidebar/Sidebar'
import EditorLayout from './components/Editor/EditorLayout'
import StatusBar from './components/Editor/StatusBar'
import { getThemeDef, getThemesByMode, type ThemeId } from './services/theme-service'
import { checkLargeFile } from './editor/large-file-handler'
import SettingsDialog, { type SettingsTab, THEME_SWATCHES } from './components/Settings/SettingsDialog'
import CommandPalette from './components/CommandPalette/CommandPalette'
import { getActiveView } from './editor/active-view'
import * as bridge from './services/bridge'
import { useTranslation } from 'react-i18next'
import { DailyNoteButton } from './components/DailyNoteButton'
import { importFileDialog } from './services/import-service'
import { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts'
import { useSessionRestore } from './hooks/use-session-restore'
import { useAutoSave } from './hooks/use-auto-save'
import { useMenuActions } from './hooks/use-menu-actions'
import { useThemeManager } from './hooks/use-theme-manager'

function App() {
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [commandPaletteMode, setCommandPaletteMode] = useState<'command' | 'file'>('command')

  const { t } = useTranslation()
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  const newUntitledTab = useTabStore((s) => s.newUntitledTab)
  const markTabSaved = useTabStore((s) => s.markTabSaved)
  const openFile = useTabStore((s) => s.openFile)

  const setMode = useEditorStore((s) => s.setMode)
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode)
  const toggleTypewriterMode = useEditorStore((s) => s.toggleTypewriterMode)
  const setIsLargeFile = useEditorStore((s) => s.setIsLargeFile)

  const { currentTheme, handleToggleTheme, handleThemeSelect } = useThemeManager()

  const handleDailyNote = useCallback(async () => {
    const filePath = await bridge.knowledgeCreateDailyNote()
    const file = await bridge.readFile(filePath)
    openFile(file.filePath, file.content)
  }, [openFile])

  const handleNewFile = useCallback(() => {
    newUntitledTab()
  }, [newUntitledTab])

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

  const handleSearch = useCallback(() => {
    if (!sidebarVisible) {
      toggleSidebar()
    }
    useSidebarStore.getState().setActiveTab('search')
  }, [sidebarVisible, toggleSidebar])

  const handleToggleCommandPalette = useCallback(() => {
    setCommandPaletteMode('command')
    setShowCommandPalette((v) => !v)
  }, [])

  const handleQuickOpen = useCallback(() => {
    setCommandPaletteMode('file')
    setShowCommandPalette(true)
  }, [])

  const handleSetSettingsTab = useCallback((tab: string) => {
    setSettingsTab(tab as SettingsTab)
  }, [])

  // Hooks
  useKeyboardShortcuts({
    onToggleCommandPalette: handleToggleCommandPalette,
    onQuickOpen: handleQuickOpen,
    onDailyNote: handleDailyNote,
  })

  useSessionRestore(newUntitledTab)
  useAutoSave()

  useMenuActions({
    onToggleSidebar: () => toggleSidebar(),
    onNewFile: handleNewFile,
    onOpenFile: handleOpenFile,
    onSaveFile: handleSaveFile,
    onSaveAs: handleSaveAs,
    onSetSettingsTab: handleSetSettingsTab,
  })

  // Derived state
  const isPreviewMode = useEditorStore((s) => s.mode) === 'preview'
  const mode = useEditorStore((s) => s.mode)
  const currentMode = getThemeDef(currentTheme).mode

  const [themePickerOpen, setThemePickerOpen] = useState(false)
  const themePickerRef = useRef<HTMLDivElement>(null)

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

  const handleThemeSelectAndClose = useCallback((id: ThemeId) => {
    handleThemeSelect(id)
    setThemePickerOpen(false)
  }, [handleThemeSelect])

  const currentThemes = getThemesByMode(currentMode)

  const handleExport = useCallback(() => {
    bridge.exportHtml()
  }, [])

  const handleImport = useCallback(async () => {
    const root = useSidebarStore.getState().rootPath
    if (!root) return
    await importFileDialog(root, openFile)
  }, [openFile])

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
        <div className="titlebar-brand">
          <span className="titlebar-app-name">{t('app.title')}</span>
        </div>
        <div className="titlebar-tools">
          <DailyNoteButton />
          <button className="toolbar-btn" onClick={handleNewFile} title={t('app.toolbar.new')}>📄 {t('app.toolbar.newLabel')}</button>
           <button className="toolbar-btn" onClick={handleOpenFile} title={t('app.toolbar.open')}>📂 {t('app.toolbar.openLabel')}</button>
          <button className="toolbar-btn" onClick={() => { toggleSidebar() }} title={t('app.toolbar.sidebar')}>📑 {t('app.toolbar.sidebarLabel')}</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleSearch} title={t('app.toolbar.search')}>🔍 {t('app.toolbar.searchLabel')}</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleToggleTheme} title={t('app.toolbar.toggleTheme')}>
            {currentMode === 'light' ? t('app.toolbar.darkMode') : t('app.toolbar.lightMode')}
          </button>
          <div className="theme-picker-wrapper" ref={themePickerRef}>
            <button
              className="toolbar-btn theme-picker-btn"
              onClick={() => setThemePickerOpen((v) => !v)}
              title={t('app.toolbar.pickTheme')}
            >
              🎨 {t('app.toolbar.pickTheme')}
            </button>
            {themePickerOpen && (
              <div className="theme-picker-dropdown">
                {currentThemes.map((theme) => {
                  const swatch = THEME_SWATCHES[theme.id]
                  const active = currentTheme === theme.id
                  return (
                    <button
                      key={theme.id}
                      className={`theme-picker-card${active ? ' active' : ''}`}
                      onClick={() => handleThemeSelectAndClose(theme.id)}
                    >
                      <div className="theme-picker-card-swatches">
                        <span className="theme-picker-card-swatch" style={{ backgroundColor: swatch.bg }} />
                        <span className="theme-picker-card-swatch" style={{ backgroundColor: swatch.secondary }} />
                        <span className="theme-picker-card-swatch" style={{ backgroundColor: swatch.accent }} />
                      </div>
                      <span className="theme-picker-card-label">{theme.icon} {t('theme.name.' + theme.id)}</span>
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
          <button className="toolbar-btn" onClick={handleImport} title={t('app.toolbar.import')}>📥 {t('app.toolbar.importLabel')}</button>
          <button className="toolbar-btn" onClick={handleExport} title={t('app.toolbar.exportHtml')}>📤 {t('app.toolbar.exportHtmlLabel')}</button>
          <button className="toolbar-btn" onClick={handlePrint} title={t('app.toolbar.print')}>🖨 {t('app.toolbar.printLabel')}</button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className={`toolbar-btn${mode !== 'preview' ? ' active' : ''}`} onClick={handleEditToggle} title={t('app.toolbar.editTitle')}>
            ✏ {t('app.toolbar.edit')}
          </button>
          <button className={`toolbar-btn${mode === 'preview' ? ' active' : ''}`} onClick={handleViewToggle} title={t('app.toolbar.previewTitle')}>
            {mode === 'preview' ? t('app.toolbar.split') : t('app.toolbar.preview')}
          </button>
        </div>
        <div className="toolbar-sep" />
        <div className="toolbar-group">
          <button className="toolbar-btn" onClick={handleSettings} title={t('app.toolbar.settings')}>⚙ {t('app.toolbar.settings')}</button>
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
          initialMode={commandPaletteMode}
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
            openSettings: (tab) => setSettingsTab((tab ?? 'general') as SettingsTab),
            exportHtml: () => bridge.exportHtml(),
            exportPdf: () => bridge.printPreview(),
            importFile: () => handleImport(),
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
