import EditorPane from './EditorPane'
import PreviewPane from '../Preview/PreviewPane'
import ResizablePane from './ResizablePane'
import FormatToolbar from './FormatToolbar'
import { useEditorStore } from '../../stores/editor-store'

function EditorLayout() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)
  const mode = useEditorStore((s) => s.mode)

  return (
    <div className="editor-area">
      <FormatToolbar />
      <div className="editor-content">
        {mode === 'wysiwyg' ? (
          <div className="wysiwyg-layout" style={{ height: '100%' }} key="wysiwyg-container">
            <EditorPane
              key="cm6-wysiwyg"
              initialContent={content}
              onContentChange={setContent}
              enableWysiwyg
            />
          </div>
        ) : (
          <div className="split-pane" key="split-container">
            <ResizablePane defaultWidth="50%" minWidth={250}>
              <EditorPane
                key="cm6-split"
                initialContent={content}
                onContentChange={setContent}
              />
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
