import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from './stores/app-store'
import { useEditorStore } from './stores/editor-store'
import { useSidebarStore } from './stores/sidebar-store'
import Sidebar from './components/Sidebar/Sidebar'
import EditorLayout from './components/Editor/EditorLayout'
import ThemeSelector from './components/Settings/ThemeSelector'
import ModeSwitch from './components/Editor/ModeSwitch'
import { themeService } from './services/theme-service'
import { fileNameFromPath } from './utils/path'
import { checkLargeFile } from './editor/large-file-handler'

function App() {
  const version = useAppStore((s) => s.version)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const currentFilePath = useAppStore((s) => s.currentFilePath)
  const isModified = useAppStore((s) => s.isModified)
  const isLoading = useAppStore((s) => s.isLoading)

  const setVersion = useAppStore((s) => s.setVersion)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)
  const openFile = useAppStore((s) => s.openFile)
  const markSaved = useAppStore((s) => s.markSaved)
  const newFile = useAppStore((s) => s.newFile)
  const checkModification = useAppStore((s) => s.checkModification)
  const setIsLoading = useAppStore((s) => s.setIsLoading)

  const editorContent = useEditorStore((s) => s.content)
  const setEditorContent = useEditorStore((s) => s.setContent)
  const bumpContentKey = useEditorStore((s) => s.bumpContentKey)
  const setMode = useEditorStore((s) => s.setMode)
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode)
  const toggleTypewriterMode = useEditorStore((s) => s.toggleTypewriterMode)
  const setIsLargeFile = useEditorStore((s) => s.setIsLargeFile)

  const setActiveTab = useSidebarStore((s) => s.setActiveTab)

  const modifiedCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (modifiedCheckTimer.current) clearTimeout(modifiedCheckTimer.current)
    modifiedCheckTimer.current = setTimeout(() => { checkModification(editorContent) }, 200)
  }, [editorContent, checkModification])

  const doOpenFile = useCallback(async (filePath: string) => {
    try {
      const result = await window.electronAPI.readFile(filePath)
      setIsLoading(true)
      openFile(result.filePath, result.content)
      setEditorContent(result.content)
      bumpContentKey()
    } catch (err) { console.error('打开文件失败:', err) }
  }, [openFile, setEditorContent, bumpContentKey, setIsLoading])

  const handleSaveFile = useCallback(async () => {
    if (currentFilePath) {
      try {
        await window.electronAPI.writeFile(currentFilePath, editorContent)
        markSaved(editorContent)
      } catch (err) { console.error('保存文件失败:', err) }
    }
  }, [currentFilePath, editorContent, markSaved])

  const handleOpenFile = useCallback(async () => {
    if (isModified) {
      const r = await window.electronAPI.confirmSave()
      if (r === 0) await handleSaveFile()
      else if (r === 2) return
    }
    const file = await window.electronAPI.openFileDialog()
    if (!file) return

    // 大文件检测
    const large = checkLargeFile(file.content.length)
    if (large.isLarge) {
      setIsLargeFile(true)
      setMode('split')
    } else {
      setIsLargeFile(false)
    }
    doOpenFile(file.filePath)
  }, [isModified])

  const handleSaveAs = useCallback(async () => {
    const fp = await window.electronAPI.saveFileDialog()
    if (!fp) return
    try {
      await window.electronAPI.writeFile(fp, editorContent)
      openFile(fp, editorContent)
    } catch (err) { console.error('另存为失败:', err) }
  }, [editorContent, openFile])

  const handleNewFile = useCallback(async () => {
    if (isModified) {
      const r = await window.electronAPI.confirmSave()
      if (r === 0) await handleSaveFile()
      else if (r === 2) return
    }
    newFile()
    setEditorContent('')
    bumpContentKey()
  }, [isModified])

  useEffect(() => {
    const cleanup = window.electronAPI?.onMenuAction((action) => {
      switch (action) {
        case 'view:toggle-sidebar': toggleSidebar(); break
        case 'file:new': handleNewFile(); break
        case 'file:open': handleOpenFile(); break
        case 'file:save': handleSaveFile(); break
        case 'file:save-as': handleSaveAs(); break
        case 'search:focus': toggleSidebar(); setActiveTab('search'); break
        case 'export:html': window.electronAPI.exportHtml(); break
        case 'export:pdf': window.electronAPI.exportPdf(); break
        case 'theme:light': themeService.switchTheme('light'); break
        case 'theme:dark': themeService.switchTheme('dark'); break
        case 'theme:sepia': themeService.switchTheme('sepia'); break
        case 'mode:toggle': useEditorStore.getState().toggleMode(); break
        case 'focus:mode': toggleFocusMode(); break
        case 'typewriter:mode': toggleTypewriterMode(); break
        case 'file:close': window.close(); break
      }
    })
    return () => cleanup?.()
  }, [toggleSidebar, handleNewFile, handleOpenFile, handleSaveFile, handleSaveAs, setActiveTab, toggleFocusMode, toggleTypewriterMode])

  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion).catch(console.error)
  }, [setVersion])

  useEffect(() => {
    const cleanup = window.electronAPI?.onExportDone((info) => {
      if (window.Notification?.permission === 'granted') {
        new window.Notification('导出完成', { body: `${info.format} 已导出到: ${info.path}` })
      }
    })
    return () => cleanup?.()
  }, [])

  const fileName = currentFilePath ? fileNameFromPath(currentFilePath) : '未命名'

  return (
    <div className="app-root">
      <header className="app-titlebar">
        <span className="app-title">
          {isLoading ? '加载中...' : currentFilePath ? <>{fileName}{isModified && <span className="modified-dot"> ●</span>}</> : 'Confucius'}
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
    </div>
  )
}

export default App
