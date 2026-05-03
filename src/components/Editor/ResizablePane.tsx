import { useRef, useCallback, type ReactNode } from 'react'

interface ResizablePaneProps {
  children: ReactNode
  defaultWidth: number | string
  minWidth: number
  onWidthChange?: (width: number) => void
}

function ResizablePane({ children, defaultWidth, minWidth, onWidthChange }: ResizablePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 初始宽度直接设置 DOM 样式，不走 React 状态
  const inited = useRef(false)

  // 初始化 DOM 宽度
  if (!inited.current && containerRef.current) {
    const w = typeof defaultWidth === 'number' ? `${defaultWidth}px` : defaultWidth
    containerRef.current.style.width = w
    inited.current = true
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const el = containerRef.current
      if (!el) return

      const startX = e.clientX
      const startWidth = el.offsetWidth

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        const newWidth = Math.max(minWidth, startWidth + delta)
        // 直接操作 DOM，避免 React 重渲染
        el.style.width = `${newWidth}px`
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        // 拖拽结束再通知外部
        if (onWidthChange && el) {
          onWidthChange(el.offsetWidth)
        }
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [minWidth, onWidthChange],
  )

  return (
    <div ref={containerRef} className="resizable-pane">
      {children}
      <div className="resizable-handle" onMouseDown={handleMouseDown} />
    </div>
  )
}

export default ResizablePane
