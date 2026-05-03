import { useCallback } from 'react'
import EditorPane from './EditorPane'
import PreviewPane from '../Preview/PreviewPane'
import ResizablePane from './ResizablePane'
import FormatToolbar from './FormatToolbar'
import TabBar from './TabBar'
import { useEditorStore } from '../../stores/editor-store'
import { useTabStore } from '../../stores/tab-store'
import { toggleFocusMode } from '../../editor/focus-mode'
import { getActiveView } from '../../editor/active-view'

function EditorLayout() {
  const activeTab = useTabStore((s) => s.activeTab())
  const activeTabId = useTabStore((s) => s.activeTabId)
  const updateContent = useTabStore((s) => s.updateContent)

  const mode = useEditorStore((s) => s.mode)
  const focusMode = useEditorStore((s) => s.focusMode)
  const typewriterMode = useEditorStore((s) => s.typewriterMode)

  toggleFocusMode(getActiveView(), focusMode)

  const content = activeTab?.content ?? ''
  const setContent = useCallback(
    (c: string) => {
      if (activeTabId) updateContent(activeTabId, c)
    },
    [activeTabId, updateContent],
  )

  const paneProps = {
    initialContent: content,
    onContentChange: setContent,
    enableTypewriter: focusMode && typewriterMode,
  }

  return (
    <div className="editor-area">
      <TabBar />
      <FormatToolbar />
      <div className="editor-content">
        {mode === 'wysiwyg' ? (
          <div className="wysiwyg-layout" style={{ height: '100%' }} key="wysiwyg-container">
            <EditorPane key={`cm6-${activeTabId}`} {...paneProps} enableWysiwyg />
          </div>
        ) : (
          <div className="split-pane" key="split-container">
            <ResizablePane defaultWidth="50%" minWidth={250}>
              <EditorPane key={`cm6-${activeTabId}`} {...paneProps} />
            </ResizablePane>
            <div className="split-divider" />
            <div className="preview-wrapper">
              <PreviewPane content={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EditorLayout
