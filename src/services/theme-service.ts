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

    // 同步更新 highlight.js 主题
    const hljsLink = document.getElementById('hljs-theme') as HTMLLinkElement | null
    if (hljsLink) {
      hljsLink.href = this.getHljsTheme(name)
    }

    // 同步更新 Mermaid 主题（如果已加载）
    if ((window as any).mermaidRef?.initialize) {
      ;(window as any).mermaidRef.initialize({
        theme: name === 'dark' ? 'dark' : name === 'sepia' ? 'neutral' : 'default',
      })
    }

    // 同步更新 KaTeX 主题（仅需修改反色，默认就行）
  }

  private getHljsTheme(name: ThemeName): string {
    switch (name) {
      case 'dark':
        return 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css'
      case 'sepia':
        return 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/idea.min.css'
      default:
        return 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
    }
  }
}

/** 全局单例 */
export const themeService = new ThemeServiceImpl()
