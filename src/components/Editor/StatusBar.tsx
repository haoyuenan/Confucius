import { useEffect, useState } from 'react'
import { usePluginStore } from '../../stores/plugin-store'

function resolveLabel(label: string | (() => string) | undefined): string {
  if (typeof label === 'function') return label()
  return label ?? ''
}

function StatusBar() {
  const items = usePluginStore((s) => s.statusBarItems)
  const [, setTick] = useState(0)

  useEffect(() => {
    const hasDynamic = items.some((i) => typeof i.label === 'function')
    if (!hasDynamic) return
    const id = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(id)
  }, [items])

  if (items.length === 0) return null

  const sorted = items.slice().sort((a, b) => b.priority - a.priority)

  return (
    <div className="status-bar">
      <div className="status-left" />
      <div className="status-right">
        {sorted.map((item) => (
          <span key={item.id} className="status-item">
            {item.component ?? resolveLabel(item.label)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default StatusBar
