import { getMermaidInstance } from '../editor/mermaid-renderer'

export type ThemeName = 'light' | 'dark' | 'sepia'

class ThemeServiceImpl {
  private currentTheme: ThemeName = 'light'

  constructor() {
    const saved = localStorage.getItem('confucius-theme') as ThemeName | null
    this.currentTheme = saved || 'light'
    this.applyTheme(this.currentTheme)
  }

  getCurrentTheme(): ThemeName {
    return this.currentTheme
  }

  switchTheme(name: ThemeName): void {
    this.currentTheme = name
    localStorage.setItem('confucius-theme', name)
    this.applyTheme(name)
  }

  toggleTheme(): void {
    const next: Record<ThemeName, ThemeName> = {
      light: 'dark',
      dark: 'sepia',
      sepia: 'light',
    }
    this.switchTheme(next[this.currentTheme])
  }

  private applyTheme(name: ThemeName): void {
    document.documentElement.setAttribute('data-theme', name)

    // 切换 hljs 主题：启用当前主题的 <style>，禁用它
    ;(['light', 'dark', 'sepia'] as const).forEach((t) => {
      const el = document.getElementById(`hljs-${t}`) as HTMLStyleElement | null
      if (el) el.disabled = t !== name
    })

    // 同步更新 Mermaid 主题（通过模块级引用）
    const mermaid = getMermaidInstance()
    if (mermaid?.initialize) {
      mermaid.initialize({
        theme: name === 'dark' ? 'dark' : name === 'sepia' ? 'neutral' : 'default',
      })
    }
  }
}

/** 全局单例 */
export const themeService = new ThemeServiceImpl()
