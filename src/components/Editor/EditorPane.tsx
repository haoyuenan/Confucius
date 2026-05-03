import { useEffect, useRef } from 'react'
import { EditorView } from 'codemirror'
import { createEditorView } from '../../editor/cm6-setup'

interface EditorPaneProps {
  initialContent?: string
  onContentChange: (markdown: string) => void
}

function EditorPane({ initialContent = '', onContentChange }: EditorPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onContentChange)
  onChangeRef.current = onContentChange

  // 仅初始化一次
  useEffect(() => {
    if (!containerRef.current || viewRef.current) return
    const view = createEditorView(containerRef.current, (content) => {
      onChangeRef.current(content)
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [])

  // 外部设置内容（打开文件或新建文件时）
  useEffect(() => {
    if (!viewRef.current) return
    const cur = viewRef.current.state.doc.toString()
    if (cur !== initialContent) {
      viewRef.current.dispatch({
        changes: { from: 0, to: viewRef.current.state.doc.length, insert: initialContent },
      })
    }
  }, [initialContent])

  // 大纲点击跳转
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

  return <div ref={containerRef} className="editor-pane" />
}

export default EditorPane
