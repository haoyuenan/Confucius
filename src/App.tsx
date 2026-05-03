import { useEffect, useRef, useCallback } from 'react'
import { useAppStore } from './stores/app-store'
import { useEditorStore } from './stores/editor-store'
import { useSidebarStore } from './stores/sidebar-store'
import Sidebar from './components/Sidebar/Sidebar'
import EditorLayout from './components/Editor/EditorLayout'
import ThemeSelector from './components/Settings/ThemeSelector'
import ModeSwitch from './components/Editor/ModeSwitch'
import { themeService } from './services/theme-service'

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

  const setActiveTab = useSidebarStore((s) => s.setActiveTab)

  // 防抖检测修改
  const modifiedCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (modifiedCheckTimer.current) clearTimeout(modifiedCheckTimer.current)
    modifiedCheckTimer.current = setTimeout(() => {
      checkModification(editorContent)
    }, 200)
  }, [editorContent, checkModification])

  /** 打开文件 */
  const doOpenFile = useCallback(
    async (filePath: string) => {
      try {
        const result = await window.electronAPI.readFile(filePath)
        setIsLoading(true)
        openFile(result.filePath, result.content)
        setEditorContent(result.content)
        bumpContentKey()
      } catch (err) {
        console.error('打开文件失败:', err)
      }
    },
    [openFile, setEditorContent, bumpContentKey, setIsLoading],
  )

  const handleOpenFile = useCallback(async () => {
    if (isModified) {
      const result = await window.electronAPI.confirmSave()
      if (result === 0) await handleSaveFile()
      else if (result === 2) return
    }
    const file = await window.electronAPI.openFileDialog()
    if (!file) return
    doOpenFile(file.filePath)
  }, [isModified])

  const handleSaveFile = useCallback(async () => {
    if (currentFilePath) {
      await window.electronAPI.writeFile(currentFilePath, editorContent)
      markSaved(editorContent)
    }
  }, [currentFilePath, editorContent, markSaved])

  const handleSaveAs = useCallback(async () => {
    const filePath = await window.electronAPI.saveFileDialog()
    if (!filePath) return
    await window.electronAPI.writeFile(filePath, editorContent)
    openFile(filePath, editorContent)
  }, [editorContent, openFile])

  const handleNewFile = useCallback(async () => {
    if (isModified) {
      const result = await window.electronAPI.confirmSave()
      if (result === 0) await handleSaveFile()
      else if (result === 2) return
    }
    newFile()
    setEditorContent('')
    bumpContentKey()
  }, [isModified])

  // 监听菜单动作
  useEffect(() => {
    const cleanup = window.electronAPI?.onMenuAction((action) => {
      switch (action) {
        case 'view:toggle-sidebar':
          toggleSidebar()
          break
        case 'file:new':
          handleNewFile()
          break
        case 'file:open':
          handleOpenFile()
          break
        case 'file:save':
          handleSaveFile()
          break
        case 'file:save-as':
          handleSaveAs()
          break
        case 'search:focus':
          toggleSidebar()
          setActiveTab('search')
          break
        case 'export:html':
          window.electronAPI.exportHtml()
          break
        case 'export:pdf':
          window.electronAPI.exportPdf()
          break
        case 'theme:light':
          themeService.switchTheme('light')
          break
        case 'theme:dark':
          themeService.switchTheme('dark')
          break
        case 'theme:sepia':
          themeService.switchTheme('sepia')
          break
        case 'mode:toggle':
          useEditorStore.getState().toggleMode()
          break
      }
    })
    return () => cleanup?.()
  }, [toggleSidebar, handleNewFile, handleOpenFile, handleSaveFile, handleSaveAs, setActiveTab])

  // 获取版本号
  useEffect(() => {
    window.electronAPI?.getVersion().then(setVersion).catch(console.error)
  }, [setVersion])

  // 监听导出完成通知
  useEffect(() => {
    const cleanup = window.electronAPI?.onExportDone((info) => {
      const Notification = (window as any).Notification
      if (Notification && Notification.permission === 'granted') {
        new Notification('导出完成', {
          body: `${info.format} 已导出到: ${info.path}`,
        })
      }
    })
    return () => cleanup?.()
  }, [])

  const fileName = currentFilePath
    ? currentFilePath.replace(/^.*[/\\]/, '')
    : '未命名'

  return (
    <div className="app-root">
      <header className="app-titlebar">
        <span className="app-title">
          {isLoading ? (
            '加载中...'
          ) : currentFilePath ? (
            <>
              {fileName}
              {isModified && <span className="modified-dot"> ●</span>}
            </>
          ) : (
            'Confucius'
          )}
        </span>
        <span className="app-version">v{version || '...'}</span>
      </header>

      <div className="app-body">
        <aside className={`app-sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
          <Sidebar />
          {/* 侧边栏底部：主题选择器 */}
          <div className="sidebar-footer">
            <ThemeSelector />
          </div>
        </aside>
        <main className="app-main">
          <EditorLayout />
        </main>
        <ModeSwitch />
      </div>
    </div>
  )
}

export default App
