import { useState, useEffect } from 'react'
import { themeService, getThemesByMode, type ThemeId } from '../../services/theme-service'
import { useTranslation } from '../../i18n/i18n-store'
import styles from './ThemeSelector.module.css'

function ThemeSelector() {
  const { t } = useTranslation()
  const [currentId, setCurrentId] = useState<ThemeId>(() => themeService.getCurrentTheme())
  const mode = themeService.getCurrentMode()
  const currentThemes = getThemesByMode(mode)

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme') as ThemeId | null
      if (theme) setCurrentId(theme)
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  const handleToggleMode = () => {
    themeService.toggleTheme()
    setCurrentId(themeService.getCurrentTheme())
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.themeSelector}>
        {currentThemes.map((t) => (
          <button
            key={t.id}
            className={`${styles.themeBtn}${currentId === t.id ? ` ${styles.active}` : ''}`}
            onClick={() => { themeService.switchTheme(t.id); setCurrentId(t.id) }}
            title={t.label}
          >
            <span className={styles.themeIcon}>{t.icon}</span>
            <span className={styles.themeLabel}>{t.label}</span>
          </button>
        ))}
      </div>
      <button className={styles.modeToggle} onClick={handleToggleMode} title={t('app.toolbar.pickTheme')}>
        {mode === 'light' ? '🌙' : '☀'}
      </button>
    </div>
  )
}

export default ThemeSelector
