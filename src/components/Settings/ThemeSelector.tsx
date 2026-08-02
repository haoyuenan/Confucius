import { useState, useEffect } from 'react'
import { themeService, getThemesByMode, type ThemeId } from '../../services/theme-service'
import { useTranslation } from 'react-i18next'
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
        {currentThemes.map((theme) => (
          <button
            key={theme.id}
            className={`${styles.themeBtn}${currentId === theme.id ? ` ${styles.active}` : ''}`}
            onClick={() => { themeService.switchTheme(theme.id); setCurrentId(theme.id) }}
            title={t(`theme.name.${theme.id}`)}
          >
            <span className={styles.themeIcon}>{theme.icon}</span>
            <span className={styles.themeLabel}>{t(`theme.name.${theme.id}`)}</span>
          </button>
        ))}
      </div>
      <button className={styles.modeToggle} onClick={handleToggleMode} title={t('app.toolbar.pickTheme')} data-testid="theme-mode-toggle">
        {mode === 'light' ? '🌙' : '☀'}
      </button>
    </div>
  )
}

export default ThemeSelector
