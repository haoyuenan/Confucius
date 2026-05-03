import { useState, useEffect } from 'react'
import { themeService, type ThemeName } from '../../services/theme-service'

const THEMES: { id: ThemeName; label: string; icon: string }[] = [
  { id: 'light', label: '亮色', icon: '☀️' },
  { id: 'dark', label: '暗色', icon: '🌙' },
  { id: 'sepia', label: '护眼', icon: '📜' },
]

function ThemeSelector() {
  const [current, setCurrent] = useState<ThemeName>(() => themeService.getCurrentTheme())

  useEffect(() => {
    // 监听 data-theme 变化以同步状态
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme') as ThemeName
      if (theme) setCurrent(theme)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="theme-selector">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-btn ${current === t.id ? 'active' : ''}`}
          onClick={() => themeService.switchTheme(t.id)}
          title={t.label}
        >
          <span className="theme-icon">{t.icon}</span>
          <span className="theme-label">{t.label}</span>
        </button>
      ))}
    </div>
  )
}

export default ThemeSelector
