import { EditorView, ViewUpdate } from '@codemirror/view'

/**
 * 返回一个 CM6 updateListener，在 selection 变化时自动滚动到居中位置
 */
export function typewriterScrollListener() {
  return EditorView.updateListener.of((update: ViewUpdate) => {
    if (!update.selectionSet) return
    scrollToCenter(update.view)
  })
}

function scrollToCenter(view: EditorView) {
  const cursorPos = view.state.selection.main.head
  const line = view.state.doc.lineAt(cursorPos)
  const lineBlock = view.lineBlockAt(line.from)
  if (!lineBlock) return

  const viewport = view.scrollDOM.getBoundingClientRect()
  const targetCenter = viewport.height / 2
  const currentPos = lineBlock.top - view.scrollDOM.scrollTop
  const currentCenter = currentPos + lineBlock.height / 2
  const diff = currentCenter - targetCenter

  if (Math.abs(diff) > 50) {
    view.scrollDOM.scrollBy({ top: diff, behavior: 'smooth' })
  }
}
