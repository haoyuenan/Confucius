import { useEffect, useRef } from 'react'
import { EditorView } from 'codemirror'
import { createEditorView } from '../../editor/cm6-setup'
import { setActiveView } from '../../editor/active-view'

interface EditorPaneProps {
  initialContent?: string
  onContentChange: (markdown: string) => void
  enableWysiwyg?: boolean
  enableTypewriter?: boolean
}

function EditorPane({ initialContent = '', onContentChange, enableWysiwyg = false, enableTypewriter = false }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onContentChange)
  onChangeRef.current = onContentChange

  useEffect(() => {
    if (!containerRef.current || viewRef.current) return
    const view = createEditorView(
      containerRef.current,
      (content) => { onChangeRef.current(content) },
      enableWysiwyg,
      enableTypewriter,
    )
    viewRef.current = view
    setActiveView(view)
    return () => {
      setActiveView(null)
      view.destroy()
      viewRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!viewRef.current) return
    const cur = viewRef.current.state.doc.toString()
    if (cur !== initialContent) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: initialContent },
      })
    }
  }, [initialContent])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { position: number }
      if (viewRef.current && typeof detail?.position === 'number') {
        const pos = Math.min(detail.position, viewRef.current.state.doc.length)
        viewRef.current.dispatch({
          effects: EditorView.scrollIntoView(pos, { y: 'start' }),
          selection: { anchor: pos },
        })
        viewRef.current.focus()
      }
    }
    window.addEventListener('editor:jump', handler)
    return () => window.removeEventListener('editor:jump', handler)
  }, [])

  return <div ref={containerRef} data-testid="editor-pane" className="editor-pane" />
}

export default EditorPane
