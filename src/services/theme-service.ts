import { getMermaidInstance } from '../editor/mermaid-renderer'

export type ThemeMode = 'light' | 'dark'
export type ThemeId =
  | 'plain-white'
  | 'eye-care'
  | 'cloud'
  | 'mint'
  | 'night-black'
  | 'deep-sea'
  | 'warm-gray'

export interface ThemeDef {
  id: ThemeId
  mode: ThemeMode
  label: string
  icon: string
  hljs: string
  mermaid: 'default' | 'dark' | 'neutral'
}

export const THEMES: ThemeDef[] = [
  { id: 'plain-white', mode: 'light', label: '素白纸', icon: '☀', hljs: 'plain-white', mermaid: 'default' },
  { id: 'eye-care',    mode: 'light', label: '护眼',    icon: '📜', hljs: 'eye-care',    mermaid: 'neutral' },
  { id: 'cloud',       mode: 'light', label: '云白',    icon: '☁', hljs: 'cloud',       mermaid: 'default' },
  { id: 'mint',        mode: 'light', label: '薄荷',    icon: '🌿', hljs: 'mint',        mermaid: 'default' },
  { id: 'night-black', mode: 'dark',  label: '暗夜黑',  icon: '🌙', hljs: 'night-black', mermaid: 'dark' },
  { id: 'deep-sea',    mode: 'dark',  label: '深海',    icon: '🌊', hljs: 'deep-sea',    mermaid: 'dark' },
  { id: 'warm-gray',   mode: 'dark',  label: '暖灰',    icon: '🔥', hljs: 'warm-gray',   mermaid: 'dark' },
]

/** 旧 localStorage 值 → 新 ThemeId 映射 */
const LEGACY_MAP: Record<string, ThemeId> = {
  light: 'plain-white',
  dark: 'night-black',
  sepia: 'eye-care',
}

export function getThemeDef(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id)!
}

export function getThemesByMode(mode: ThemeMode): ThemeDef[] {
  return THEMES.filter((t) => t.mode === mode)
}

class ThemeServiceImpl {
  private currentTheme: ThemeId = 'plain-white'
  private lastLight: ThemeId = 'plain-white'
  private lastDark: ThemeId = 'night-black'

  constructor() {
    const saved = localStorage.getItem('confucius-theme') as string | null
    const migrated: ThemeId = LEGACY_MAP[saved ?? ''] ?? (saved as ThemeId | null) ?? 'plain-white'
    this.currentTheme = migrated
    if (getThemeDef(migrated).mode === 'light') this.lastLight = migrated
    else this.lastDark = migrated
    this.applyTheme(migrated)
  }

  getCurrentTheme(): ThemeId {
    return this.currentTheme
  }

  getCurrentMode(): ThemeMode {
    return getThemeDef(this.currentTheme).mode
  }

  getCurrentDef(): ThemeDef {
    return getThemeDef(this.currentTheme)
  }

  switchTheme(id: ThemeId): void {
    const def = getThemeDef(id)
    if (def.mode === 'light') this.lastLight = id
    else this.lastDark = id
    this.currentTheme = id
    localStorage.setItem('confucius-theme', id)
    this.applyTheme(id)
  }

  toggleTheme(): void {
    const cur = getThemeDef(this.currentTheme)
    const nextId = cur.mode === 'light' ? this.lastDark : this.lastLight
    this.switchTheme(nextId)
  }

  private applyTheme(id: ThemeId): void {
    document.documentElement.setAttribute('data-theme', id)

    THEMES.forEach((t) => {
      const el = document.getElementById(`hljs-${t.id}`) as HTMLStyleElement | null
      if (el) el.disabled = t.id !== id
    })

    const def = getThemeDef(id)
    const mermaid = getMermaidInstance()
    if (mermaid?.initialize) {
      mermaid.initialize({ theme: def.mermaid })
    }
  }
}

export const themeService = new ThemeServiceImpl()
