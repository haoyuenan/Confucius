import { getMermaidInstance } from '../editor/mermaid-renderer'

export type ThemeMode = 'light' | 'dark'
export type ThemeId =
  | 'plain-white'
  | 'warm-sun'
  | 'cloud'
  | 'mint'
  | 'tokyo-night-light'
  | 'rose-pine-dawn'
  | 'night-black'
  | 'deep-sea'
  | 'warm-gray'
  | 'mo-zhu'
  | 'tokyo-night'
  | 'rose-pine'

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
  { id: 'warm-sun',   mode: 'light', label: '暖阳',    icon: '🌤', hljs: 'warm-sun',    mermaid: 'neutral' },
  { id: 'cloud',       mode: 'light', label: '云白',    icon: '☁', hljs: 'cloud',       mermaid: 'default' },
  { id: 'mint',              mode: 'light', label: '薄荷',          icon: '🌿', hljs: 'mint',              mermaid: 'default' },
  { id: 'tokyo-night-light', mode: 'light', label: '东京夜白',      icon: '🌃', hljs: 'tokyo-night-light', mermaid: 'default' },
  { id: 'rose-pine-dawn',    mode: 'light', label: '玫瑰黎明',      icon: '🌹', hljs: 'rose-pine-dawn',    mermaid: 'default' },
  { id: 'night-black', mode: 'dark',  label: '暗夜黑',  icon: '🌙', hljs: 'night-black', mermaid: 'dark' },
  { id: 'deep-sea',    mode: 'dark',  label: '深海',    icon: '🌊', hljs: 'deep-sea',    mermaid: 'dark' },
  { id: 'warm-gray',   mode: 'dark',  label: '暖灰',    icon: '🔥', hljs: 'warm-gray',   mermaid: 'dark' },
  { id: 'mo-zhu',     mode: 'dark',  label: '墨竹',    icon: '🎋', hljs: 'mo-zhu',     mermaid: 'dark' },
  { id: 'tokyo-night', mode: 'dark',  label: '东京夜',  icon: '🌃', hljs: 'tokyo-night-dark', mermaid: 'dark' },
  { id: 'rose-pine',   mode: 'dark',  label: '玫瑰松',  icon: '🌹', hljs: 'rose-pine',        mermaid: 'dark' },
]

/** 旧 localStorage 值 → 新 ThemeId 映射 */
const LEGACY_MAP: Record<string, ThemeId> = {
  light: 'plain-white',
  dark: 'night-black',
  sepia: 'warm-sun',
  'eye-care': 'warm-sun',
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
    const legacy = LEGACY_MAP[saved ?? '']
    // 无效 id 一律回退默认主题，避免 getThemeDef 的 ! 断言抛 TypeError 导致白屏
    const isKnown = !!saved && THEMES.some((t) => t.id === saved)
    const migrated: ThemeId = legacy ?? (isKnown ? (saved as ThemeId) : 'plain-white')
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
    // 防御：无效 id（旧版本 localStorage/会话残留，如 'sepia'/'light'）
    // 一律回退默认主题，避免 getThemeDef 断言抛 TypeError 导致白屏
    const validId: ThemeId = THEMES.some((t) => t.id === id) ? id : 'plain-white'
    const def = getThemeDef(validId)
    if (def.mode === 'light') this.lastLight = validId
    else this.lastDark = validId
    this.currentTheme = validId
    localStorage.setItem('confucius-theme', validId)
    this.applyTheme(validId)
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
