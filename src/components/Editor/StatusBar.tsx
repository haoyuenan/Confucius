import { usePluginStore } from '../../stores/plugin-store'

function StatusBar() {
  const items = usePluginStore((s) => s.statusBarItems)

  if (items.length === 0) return null

  return (
    <div className="status-bar">
      <div className="status-left" />
      <div className="status-right">
        {items
          .slice()
          .sort((a, b) => b.priority - a.priority)
          .map((item) => (
            <span key={item.id} className="status-item">
              {item.component}
            </span>
          ))}
      </div>
    </div>
  )
}

export default StatusBar
