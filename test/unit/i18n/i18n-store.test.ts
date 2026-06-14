import { describe, it, expect, beforeEach } from 'vitest'
import i18n from '../../../src/i18n/i18n'

beforeEach(() => {
  i18n.changeLanguage('zh')
  localStorage.clear()
})

describe('i18n', () => {
  it('default language is zh', () => {
    expect(i18n.language).toBe('zh')
  })

  it('changeLanguage switches language', () => {
    i18n.changeLanguage('en')
    expect(i18n.language).toBe('en')
  })

  it('persists to localStorage', () => {
    i18n.changeLanguage('en')
    expect(localStorage.getItem('confucius-lang')).toBe('en')
  })

  it('t returns Chinese text by default', () => {
    expect(i18n.t('app.toolbar.newLabel')).toBe('新建')
  })

  it('t returns English text after switching', () => {
    i18n.changeLanguage('en')
    expect(i18n.t('app.toolbar.newLabel')).toBe('New')
  })

  it('t returns key as fallback for missing keys', () => {
    expect(i18n.t('nonexistent.key')).toBe('nonexistent.key')
  })

  it('t replaces {params} in text', () => {
    expect(i18n.t('sidebar.search.results', { count: 42 })).toContain('42')
  })

  it('t replaces multiple params', () => {
    i18n.changeLanguage('en')
    expect(i18n.t('plugin.success.loaded', { name: 'test' })).toBe('✅ Loaded: test')
  })

  it('zh.json and en.json have identical top-level keys', () => {
    const zh = require('../../../src/i18n/zh.json')
    const en = require('../../../src/i18n/en.json')
    const zhKeys = Object.keys(zh).sort()
    const enKeys = Object.keys(en).sort()
    expect(zhKeys).toEqual(enKeys)
  })
})
