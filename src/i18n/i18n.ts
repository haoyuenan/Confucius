import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import zh from './zh.json'
import en from './en.json'

const STORAGE_KEY = 'confucius-lang'

const savedLang = typeof localStorage !== 'undefined'
  ? localStorage.getItem(STORAGE_KEY) || 'zh'
  : 'zh'

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: savedLang,
  fallbackLng: 'zh',
  interpolation: {
    prefix: '{',
    suffix: '}',
    escapeValue: false,
  },
  returnObjects: false,
})

// 语言切换时持久化到 localStorage
i18n.on('languageChanged', (lng) => {
  try { localStorage.setItem(STORAGE_KEY, lng) } catch { /* noop */ }
})

export default i18n
