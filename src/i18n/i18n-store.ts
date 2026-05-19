import { create } from 'zustand'
import zh from './zh.json'
import en from './en.json'

type Lang = 'zh' | 'en'
type Dict = Record<string, string>

const dicts: Record<Lang, Dict> = { zh, en }
const STORAGE_KEY = 'confucius-lang'

export interface I18nState {
  lang: Lang
  t: (key: string, params?: Record<string, string | number>) => string
  setLang: (lang: Lang) => void
}

function loadLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'en' ? 'en' : 'zh'
  } catch {
    return 'zh'
  }
}

export const useI18nStore = create<I18nState>((set, get) => ({
  lang: loadLang(),
  t: (key, params) => {
    const lang = get().lang
    const dict = dicts[lang] || dicts.zh
    let text = dict[key]
    if (text === undefined) text = key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return text
  },
  setLang: (newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang)
    set({ lang: newLang })
  },
}))

/** 便捷 hook — 在 React 组件中使用 */
export function useTranslation() {
  const lang = useI18nStore((s) => s.lang)
  const t = useI18nStore((s) => s.t)
  const setLang = useI18nStore((s) => s.setLang)
  return { t, lang, setLang }
}
