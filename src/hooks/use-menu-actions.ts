import { useEffect } from 'react'
import { useEditorStore } from '../stores/editor-store'
import { useTabStore } from '../stores/tab-store'
import { useSidebarStore } from '../stores/sidebar-store'
import { checkLargeFile } from '../editor/large-file-handler'
import i18n from '../i18n/i18n'
import * as bridge from '../services/bridge'

interface MenuActionOptions {
  onToggleSidebar: () => void
  onNewFile: () => void
  onOpenFile: () => void
  onSaveFile: () => void
  onSaveAs: () => void
  onSetSettingsTab: (tab: string) => void
}

export function useMenuActions({
  onToggleSidebar,
  onNewFile,
  onOpenFile,
  onSaveFile,
  onSaveAs,
  onSetSettingsTab,
}: MenuActionOptions) {
  const setMode = useEditorStore((s) => s.setMode)
  const toggleFocusMode = useEditorStore((s) => s.toggleFocusMode)
  const toggleTypewriterMode = useEditorStore((s) => s.toggleTypewriterMode)
  const setActiveTab = useSidebarStore((s) => s.setActiveTab)

  useEffect(() => {
    const cleanup = bridge.onMenuAction((action) => {
      switch (action) {
        case 'view:toggle-sidebar': onToggleSidebar(); break
        case 'file:new': onNewFile(); break
        case 'file:open': onOpenFile(); break
        case 'file:save': onSaveFile(); break
        case 'file:save-as': onSaveAs(); break
        case 'search:focus': onToggleSidebar(); setActiveTab('search'); break
        case 'export:html': bridge.exportHtml(); break
        case 'export:pdf': bridge.exportPdf(); break
        case 'mode:toggle': useEditorStore.getState().toggleMode(); break
        case 'mode:preview':
          setMode(useEditorStore.getState().mode === 'preview' ? 'split' : 'preview')
          break
        case 'settings:display': onSetSettingsTab('display'); break
        case 'app:about': onSetSettingsTab('about'); break
        case 'focus:mode': toggleFocusMode(); break
        case 'typewriter:mode': toggleTypewriterMode(); break
        case 'file:close': window.close(); break
      }
    })
    return () => cleanup?.()
  }, [onToggleSidebar, onNewFile, onOpenFile, onSaveFile, onSaveAs, onSetSettingsTab, setActiveTab, toggleFocusMode, toggleTypewriterMode, setMode])

  useEffect(() => {
    const cleanup = bridge.onExportDone((info) => {
      if (window.Notification?.permission === 'granted') {
        new window.Notification(i18n.t('app.notification.exportDone'), {
          body: i18n.t('app.notification.exportBody', { format: info.format, path: info.path }),
        })
      }
    })
    return () => cleanup?.()
  }, [])

  useEffect(() => {
    const cleanup = bridge.onFileOpen((data) => {
      const large = checkLargeFile(data.content.length)
      if (large.isLarge) {
        useEditorStore.getState().setIsLargeFile(true)
        useEditorStore.getState().setMode('split')
      } else {
        useEditorStore.getState().setIsLargeFile(false)
      }
      useTabStore.getState().openFile(data.filePath, data.content)
    })
    return () => cleanup?.()
  }, [])
}
