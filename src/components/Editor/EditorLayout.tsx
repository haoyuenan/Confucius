import EditorPane from './EditorPane'
import PreviewPane from '../Preview/PreviewPane'
import ResizablePane from './ResizablePane'
import { useEditorStore } from '../../stores/editor-store'

function EditorLayout() {
  const content = useEditorStore((s) => s.content)
  const setContent = useEditorStore((s) => s.setContent)

  return (
    <div className="split-pane">
      <ResizablePane defaultWidth="50%" minWidth={250}>
        <EditorPane
          initialContent={content}
          onContentChange={setContent}
        />
      </ResizablePane>
      <div className="split-divider" />
      <div className="preview-wrapper">
        <PreviewPane content={content} />
      </div>
    </div>
  )
}

export default EditorLayout
