import EditorPane from './EditorPane'
import PreviewPane from '../Preview/PreviewPane'
import ResizablePane from './ResizablePane'
import FormatToolbar from './FormatToolbar'
import { useEditorStore } from '../../stores/editor-store'
import { toggleFocusMode } from '../../editor/focus-mode'
import { getActiveView } from '../../editor/active-view'

function EditorLayout() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const mode = useEditorStore((s) => s.mode)
  const focusMode = useEditorStore((s) => s.focusMode)
  const typewriterMode = useEditorStore((s) => s.typewriterMode)

  // 专注模式变化时 toggle 样式
  toggleFocusMode(getActiveView(), focusMode)

  const paneProps = {
    initialContent: content,
    onContentChange: setContent,
    enableTypewriter: focusMode && typewriterMode,
  }

  return (
    <div className="editor-area">
      <FormatToolbar />
      <div className="editor-content">
        {mode === 'wysiwyg' ? (
          <div className="wysiwyg-layout" style={{ height: '100%' }} key="wysiwyg-container">
            <EditorPane key="cm6-wysiwyg" {...paneProps} enableWysiwyg />
          </div>
        ) : (
          <div className="split-pane" key="split-container">
            <ResizablePane defaultWidth="50%" minWidth={250}>
              <EditorPane key="cm6-split" {...paneProps} />
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
