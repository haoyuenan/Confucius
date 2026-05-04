import { useState, useEffect } from 'react'
import { themeService, type ThemeName } from '../../services/theme-service'
import styles from './ThemeSelector.module.css'

const THEMES: { id: ThemeName; label: string; icon: string }[] = [
  { id: 'light', label: '亮色', icon: '☀️' },
  { id: 'dark', label: '暗色', icon: '🌙' },
  { id: 'sepia', label: '护眼', icon: '📜' },
]

function ThemeSelector() {
  const [current, setCurrent] = useState<ThemeName>(() => themeService.getCurrentTheme())

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme') as ThemeName
      if (theme) setCurrent(theme)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  return (
    <div className={styles.themeSelector}>
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`${styles.themeBtn}${current === t.id ? ` ${styles.active}` : ''}`}
          onClick={() => themeService.switchTheme(t.id)}
          title={t.label}
        >
          <span className={styles.themeIcon}>{t.icon}</span>
          <span className={styles.themeLabel}>{t.label}</span>
        </button>
      ))}
    </div>
  )
}

export default ThemeSelector
