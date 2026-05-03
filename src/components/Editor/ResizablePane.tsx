import { useRef, useState, useCallback, type ReactNode } from 'react'

interface ResizablePaneProps {
  children: ReactNode
  defaultWidth: number | string
  minWidth: number
  onWidthChange?: (width: number) => void
}

function ResizablePane({ children, defaultWidth, minWidth, onWidthChange }: ResizablePaneProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(defaultWidth)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = containerRef.current?.offsetWidth ?? 400

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientX - startX
        const newWidth = Math.max(minWidth, startWidth + delta)
        setWidth(newWidth)
        onWidthChange?.(newWidth)
      }

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [minWidth, onWidthChange],
  )

  return (
    <div ref={containerRef} className="resizable-pane" style={{ width: typeof width === 'number' ? width : width }}>
      {children}
      <div className="resizable-handle" onMouseDown={handleMouseDown} />
    </div>
  )
}

export default ResizablePane
