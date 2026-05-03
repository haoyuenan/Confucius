import { useEffect, useCallback } from 'react'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useEditorStore } from '../../stores/editor-store'
import { extractOutline, getOutlineIndent } from '../../editor/outline-parser'

function OutlinePanel() {
  const outlineItems = useSidebarStore((s) => s.outlineItems)
  const setOutlineItems = useSidebarStore((s) => s.setOutlineItems)
  const editorContent = useEditorStore((s) => s.content)

  // 编辑器内容变化时更新大纲
  useEffect(() => {
    const items = extractOutline(editorContent)
    setOutlineItems(items)
  }, [editorContent, setOutlineItems])

  // 点击跳转到编辑器对应位置
  const handleJump = useCallback((from: number) => {
    // 通过自定义事件通知 EditorLayout 跳转
    window.dispatchEvent(
      new CustomEvent('editor:jump', { detail: { position: from } }),
    )
  }, [])

  if (outlineItems.length === 0) {
    return (
      <div className="outline-panel">
        <div className="sidebar-empty">文档中未检测到标题</div>
      </div>
    )
  }

  return (
    <div className="outline-panel">
      <div className="outline-header">大纲</div>
      <div className="outline-list">
        {outlineItems.map((item, idx) => (
          <div
            key={`${item.from}-${idx}`}
            className="outline-item"
            style={{ paddingLeft: getOutlineIndent(item.level) + 12 }}
            onClick={() => handleJump(item.from)}
          >
            <span className={`outline-level h-${item.level}`}>H{item.level}</span>
            <span className="outline-text">{item.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default OutlinePanel
