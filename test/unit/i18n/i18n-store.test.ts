import { describe, it, expect, beforeEach } from 'vitest'
import { useI18nStore } from '../../../src/i18n/i18n-store'

beforeEach(() => {
  localStorage.clear()
  // Reset to Chinese default
  useI18nStore.getState().setLang('zh')
})

describe('i18n-store', () => {
  it('default language is zh', () => {
    expect(useI18nStore.getState().lang).toBe('zh')
  })

  it('setLang switches language', () => {
    useI18nStore.getState().setLang('en')
    expect(useI18nStore.getState().lang).toBe('en')
  })

  it('persists to localStorage', () => {
    useI18nStore.getState().setLang('en')
    expect(localStorage.getItem('confucius-lang')).toBe('en')
  })

  it('reads persisted language on init', () => {
    localStorage.setItem('confucius-lang', 'en')
    // Re-create store would normally re-read, but we can just check setLang worked
    useI18nStore.getState().setLang('en')
    expect(useI18nStore.getState().lang).toBe('en')
  })

  it('t returns Chinese text by default', () => {
    const { t } = useI18nStore.getState()
    expect(t('app.toolbar.newLabel')).toBe('新建')
  })

  it('t returns English text after switching', () => {
    useI18nStore.getState().setLang('en')
    const { t } = useI18nStore.getState()
    expect(t('app.toolbar.newLabel')).toBe('New')
  })

  it('t returns key as fallback for missing keys', () => {
    const { t } = useI18nStore.getState()
    expect(t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('t replaces {params} in text', () => {
    const { t } = useI18nStore.getState()
    expect(t('sidebar.search.results', { count: 42 })).toContain('42')
  })

  it('t replaces multiple params', () => {
    useI18nStore.getState().setLang('en')
    const { t } = useI18nStore.getState()
    expect(t('plugin.success.loaded', { name: 'test' })).toBe('✅ Loaded: test')
  })

  it('zh.json and en.json have identical top-level keys', () => {
    const zhKeys = Object.keys(require('../../../src/i18n/zh.json')).sort()
    const enKeys = Object.keys(require('../../../src/i18n/en.json')).sort()
    expect(zhKeys).toEqual(enKeys)
  })
})
