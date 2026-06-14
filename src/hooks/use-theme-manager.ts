import { useState, useCallback } from 'react'
import { themeService, type ThemeId } from '../services/theme-service'

export function useThemeManager() {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(themeService.getCurrentTheme())

  const handleToggleTheme = useCallback(() => {
    themeService.toggleTheme()
    setCurrentTheme(themeService.getCurrentTheme())
  }, [])

  const handleThemeSelect = useCallback((id: ThemeId) => {
    themeService.switchTheme(id)
    setCurrentTheme(id)
  }, [])

  return { currentTheme, setCurrentTheme, handleToggleTheme, handleThemeSelect }
}
