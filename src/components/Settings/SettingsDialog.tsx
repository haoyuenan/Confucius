import { useState, useEffect, useCallback } from 'react'
import * as bridge from '../../services/electron-bridge'
import { themeService, getThemesByMode, type ThemeMode, type ThemeId } from '../../services/theme-service'
import { useEditorStore } from '../../stores/editor-store'
import { useAppStore } from '../../stores/app-store'
import { useTranslation, useI18nStore } from '../../i18n/i18n-store'

// ─── Types ───

interface EnvInfo {
  tauri: string
  platform: string
  arch: string
}

export type SettingsTab = 'general' | 'display' | 'shortcuts' | 'about'

export const THEME_SWATCHES: Record<ThemeId, { bg: string; accent: string; secondary: string }> = {
  'plain-white': { bg: '#ffffff', accent: '#0366d6', secondary: '#f6f8fa' },
  'warm-sun':    { bg: '#faf4e4', accent: '#b07d26', secondary: '#f2e8cc' },
  'cloud':       { bg: '#f5f5f0', accent: '#0284c7', secondary: '#ecece5' },
  'mint':              { bg: '#f0f5f3', accent: '#0d9488', secondary: '#e8efe9' },
  'tokyo-night-light': { bg: '#fbfbfd', accent: '#3760bf', secondary: '#f1f2f6' },
  'rose-pine-dawn':    { bg: '#faf4ed', accent: '#d7827e', secondary: '#f0eae0' },
  'night-black': { bg: '#1e1e1e', accent: '#569cd6', secondary: '#252526' },
  'deep-sea':    { bg: '#0d1117', accent: '#58a6ff', secondary: '#161b22' },
  'warm-gray':   { bg: '#1a1410', accent: '#d4a373', secondary: '#221c17' },
  'mo-zhu':      { bg: '#0e1812', accent: '#5db87a', secondary: '#142318' },
  'tokyo-night': { bg: '#1a1b26', accent: '#7aa2f7', secondary: '#1f2132' },
  'rose-pine':   { bg: '#191724', accent: '#ebbcba', secondary: '#1f1d2e' },
}

const FEATURE_KEYS = ['editor', 'modes', 'tabs', 'search', 'mermaid', 'katex', 'focus', 'themes', 'export']

const PLATFORM_LABELS: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
}

const NAV_ITEM_DEFS: { id: SettingsTab; icon: string }[] = [
  { id: 'general', icon: '⚙' },
  { id: 'display', icon: '🎨' },
  { id: 'shortcuts', icon: '⌨' },
  { id: 'about', icon: 'app' },
]

interface Props {
  onClose: () => void
  initialTab?: SettingsTab
}

function SettingsDialog({ onClose, initialTab = 'general' }: Props) {
  const { t } = useTranslation()
  const lang = useI18nStore((s) => s.lang)
  const setLang = useI18nStore((s) => s.setLang)
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab)

  const focusMode = useEditorStore((s) => s.focusMode)
  const typewriterMode = useEditorStore((s) => s.typewriterMode)
  const setFocusMode = useEditorStore((s) => s.setFocusMode)
  const setTypewriterMode = useEditorStore((s) => s.setTypewriterMode)
  const sidebarVisible = useAppStore((s) => s.sidebarVisible)
  const toggleSidebar = useAppStore((s) => s.toggleSidebar)

  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => themeService.getCurrentTheme())
  const [hideMenu, setHideMenu] = useState(() => localStorage.getItem('confucius-hide-menu') !== 'false')
  const [version, setVersion] = useState('...')
  const [env, setEnv] = useState<EnvInfo | null>(null)

  useEffect(() => {
    bridge.getVersion().then(setVersion)
    bridge.getEnv().then(setEnv)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  const handleOverlay = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  return (
    <div className="dialog-overlay" onClick={handleOverlay}>
      <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" onClick={onClose}>✕</button>

        <div className="settings-body">
          <nav className="settings-nav">
            {NAV_ITEM_DEFS.map((item) => (
              <button
                key={item.id}
                className={`settings-nav-card${activeTab === item.id ? ' active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                {item.icon === 'app' ? (
                  <span className="settings-nav-icon settings-nav-icon-app">
                    <svg viewBox="0 0 512 512" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="snbg" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#c8832c"/>
                          <stop offset="100%" stopColor="#7a4e10"/>
                        </linearGradient>
                      </defs>
                      <rect width="512" height="512" rx="96" ry="96" fill="url(#snbg)"/>
                      <rect x="112" y="80" width="288" height="352" rx="22" fill="#fff" opacity="0.93"/>
                      <polygon points="336,80 400,80 400,144" fill="#f5e6cc" opacity="0.9"/>
                      <path d="M138 240 L138 334 L168 334 L168 290 L204 326 L240 290 L240 334 L270 334 L270 240 L240 240 L204 278 L168 240 Z" fill="#8b5010"/>
                      <line x1="316" y1="238" x2="316" y2="306" stroke="#8b5010" strokeWidth="26" strokeLinecap="round"/>
                      <polyline points="284,289 316,336 348,289" stroke="#8b5010" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </span>
                ) : (
                  <span className="settings-nav-icon">{item.icon}</span>
                )}
                <span className="settings-nav-label">{t(`settings.tab.${item.id}`)}</span>
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {activeTab === 'general' && (
              <div className="settings-section">
                <h3 className="settings-section-title">{t('settings.general.title')}</h3>
                <div className="settings-rows">
                  <div className="settings-row">
                    <span className="settings-row-label">{t('settings.general.focusMode')}</span>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={focusMode}
                        onChange={() => setFocusMode(!focusMode)}
                      />
                      <span className="settings-toggle-track">
                        <span className="settings-toggle-thumb" />
                      </span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">{t('settings.general.typewriter')}</span>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={typewriterMode}
                        onChange={() => setTypewriterMode(!typewriterMode)}
                      />
                      <span className="settings-toggle-track">
                        <span className="settings-toggle-thumb" />
                      </span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">{t('settings.general.sidebar')}</span>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={sidebarVisible}
                        onChange={toggleSidebar}
                      />
                      <span className="settings-toggle-track">
                        <span className="settings-toggle-thumb" />
                      </span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">{t('settings.general.hideMenu')}</span>
                    <label className="settings-toggle">
                      <input
                        type="checkbox"
                        checked={hideMenu}
                        onChange={() => {
                          const next = !hideMenu
                          setHideMenu(next)
                          localStorage.setItem('confucius-hide-menu', String(next))
                          bridge.setMenuVisible(!next).catch(() => {})
                        }}
                      />
                      <span className="settings-toggle-track">
                        <span className="settings-toggle-thumb" />
                      </span>
                    </label>
                  </div>
                  <div className="settings-row">
                    <span className="settings-row-label">{t('settings.language.title')}</span>
                    <div className="lang-toggle-group">
                      <button
                        className={`lang-btn${lang === 'zh' ? ' active' : ''}`}
                        onClick={() => setLang('zh')}
                      >🇨🇳 {t('settings.language.zh')}</button>
                      <button
                        className={`lang-btn${lang === 'en' ? ' active' : ''}`}
                        onClick={() => setLang('en')}
                      >🇺🇸 {t('settings.language.en')}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="settings-section">
                <h3 className="settings-section-title">{t('settings.display.title')}</h3>

                <div className="mode-select-area">
                  <p className="mode-select-label">{t('settings.display.mode')}</p>
                  <div className="mode-cards">
                    {(['light', 'dark'] as ThemeMode[]).map((mode) => {
                      const active = themeService.getCurrentMode() === mode
                      return (
                        <button
                          key={mode}
                          className={`mode-card${active ? ' active' : ''}`}
                          onClick={() => {
                            const first = getThemesByMode(mode)[0]
                            if (first) { themeService.switchTheme(first.id); setCurrentTheme(first.id) }
                          }}
                        >
                          <span className="mode-card-window">
                            <span className="mode-card-titlebar">
                              <span className="mode-card-dot" />
                              <span className="mode-card-title-icon">{mode === 'light' ? '☀' : '🌙'}</span>
                            </span>
                            <span className="mode-card-body" style={{ background: mode === 'light' ? '#f0f0f0' : '#222' }} />
                          </span>
                          <span className="mode-card-label">{mode === 'light' ? t('settings.display.light') : t('settings.display.dark')}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="theme-preset-area">
                  <p className="mode-select-label">{t('settings.display.presets')}</p>
                  <div className="theme-cards">
                    {getThemesByMode(themeService.getCurrentMode()).map((theme) => {
                      const active = currentTheme === theme.id
                      const swatch = THEME_SWATCHES[theme.id]
                      return (
                        <div
                          key={theme.id}
                          className={`theme-card${active ? ' active' : ''}`}
                          onClick={() => { themeService.switchTheme(theme.id); setCurrentTheme(theme.id) }}
                        >
                          <span className="theme-card-swatches">
                            <span className="theme-card-swatch" style={{ background: swatch.bg }} />
                            <span className="theme-card-swatch" style={{ background: swatch.secondary }} />
                            <span className="theme-card-swatch" style={{ background: swatch.accent }} />
                            {active && <span className="theme-card-check">✓</span>}
                          </span>
                          <span className="theme-card-name">{theme.icon} {t('theme.name.' + theme.id)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="settings-section">
                <h3 className="settings-section-title">{t('settings.shortcuts.title')}</h3>

                <ShortcutGroup title={t('settings.shortcuts.file')} shortcuts={[
                  { keys: ['Ctrl', 'N'], desc: t('settings.shortcuts.desc.newFile') },
                  { keys: ['Ctrl', 'O'], desc: t('settings.shortcuts.desc.openFile') },
                  { keys: ['Ctrl', 'S'], desc: t('settings.shortcuts.desc.save') },
                  { keys: ['Ctrl', 'Shift', 'S'], desc: t('settings.shortcuts.desc.saveAs') },
                  { keys: ['Ctrl', 'Shift', 'H'], desc: t('settings.shortcuts.desc.exportHtml') },
                  { keys: ['Ctrl', 'Shift', 'E'], desc: t('settings.shortcuts.desc.exportPdf') },
                  { keys: ['Ctrl', 'W'], desc: t('settings.shortcuts.desc.closeWindow') },
                ]} />

                <ShortcutGroup title={t('settings.shortcuts.edit')} shortcuts={[
                  { keys: ['Ctrl', 'B'], desc: t('settings.shortcuts.desc.bold') },
                  { keys: ['Ctrl', 'I'], desc: t('settings.shortcuts.desc.italic') },
                  { keys: ['Ctrl', 'K'], desc: t('settings.shortcuts.desc.link') },
                  { keys: ['Ctrl', '`'], desc: t('settings.shortcuts.desc.inlineCode') },
                  { keys: ['Ctrl', 'Shift', '`'], desc: t('settings.shortcuts.desc.codeBlock') },
                  { keys: ['Ctrl', 'Shift', 'M'], desc: t('settings.shortcuts.desc.mathBlock') },
                  { keys: ['Ctrl', 'Shift', 'L'], desc: t('settings.shortcuts.desc.unorderedList') },
                  { keys: ['Ctrl', 'Shift', '['], desc: t('settings.shortcuts.desc.blockquote') },
                  { keys: ['Ctrl', 'Shift', 'O'], desc: t('settings.shortcuts.desc.orderedList') },
                ]} />

                <ShortcutGroup title={t('settings.shortcuts.view')} shortcuts={[
                  { keys: ['Ctrl', 'Shift', 'P'], desc: t('settings.shortcuts.desc.toggleMode') },
                  { keys: ['Ctrl', 'Shift', 'O'], desc: t('settings.shortcuts.desc.togglePreview') },
                  { keys: ['Ctrl', '\\'], desc: t('settings.shortcuts.desc.toggleSidebar') },
                  { keys: ['Ctrl', 'Shift', 'F'], desc: t('settings.shortcuts.desc.globalSearch') },
                  { keys: ['F11'], desc: t('settings.shortcuts.desc.focusMode') },
                  { keys: ['F12'], desc: t('settings.shortcuts.desc.typewriter') },
                ]} />

                <ShortcutGroup title={t('settings.shortcuts.other')} shortcuts={[
                  { keys: ['Ctrl', 'Z'], desc: t('settings.shortcuts.desc.undo') },
                  { keys: ['Ctrl', 'Y'], desc: t('settings.shortcuts.desc.redo') },
                  { keys: ['Ctrl', 'Shift', 'I'], desc: t('settings.shortcuts.desc.pluginManager') },
                  { keys: ['Esc'], desc: t('settings.shortcuts.desc.closeDialog') },
                  { keys: ['Ctrl', t('settings.shortcuts.key.scroll')], desc: t('settings.shortcuts.desc.previewZoom') },
                ]} />
              </div>
            )}

            {activeTab === 'about' && (
              <div className="settings-section about-section">
                <div className="about-header-compact">
                  <div className="about-big-icon">
                    <svg viewBox="0 0 512 512" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="abbg" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#c8832c"/>
                          <stop offset="100%" stopColor="#7a4e10"/>
                        </linearGradient>
                      </defs>
                      <rect width="512" height="512" rx="96" ry="96" fill="url(#abbg)"/>
                      <rect x="112" y="80" width="288" height="352" rx="22" fill="#fff" opacity="0.93"/>
                      <polygon points="336,80 400,80 400,144" fill="#f5e6cc" opacity="0.9"/>
                      <polyline points="336,80 336,144 400,144" fill="none" stroke="#d4a860" strokeWidth="3"/>
                      <rect x="144" y="136" width="30" height="11" rx="5" fill="#c8832c" opacity="0.55"/>
                      <rect x="182" y="136" width="120" height="11" rx="5" fill="#c8832c" opacity="0.55"/>
                      <rect x="144" y="166" width="192" height="9" rx="4.5" fill="#c8832c" opacity="0.3"/>
                      <rect x="144" y="188" width="174" height="9" rx="4.5" fill="#c8832c" opacity="0.3"/>
                      <line x1="144" y1="212" x2="368" y2="212" stroke="#d4a860" strokeWidth="2" opacity="0.4"/>
                      <path d="M138 240 L138 334 L168 334 L168 290 L204 326 L240 290 L240 334 L270 334 L270 240 L240 240 L204 278 L168 240 Z" fill="#8b5010"/>
                      <line x1="316" y1="238" x2="316" y2="306" stroke="#8b5010" strokeWidth="26" strokeLinecap="round"/>
                      <polyline points="284,289 316,336 348,289" stroke="#8b5010" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                  </div>
                  <h3 className="about-name">Confucius</h3>
                  <span className="about-ver-badge">v{version}</span>
                  <p className="about-tagline">{t('settings.about.tagline')}</p>
                </div>

                <div className="settings-section">
                  <h4 className="settings-section-subtitle">{t('settings.about.features')}</h4>
                  <div className="about-features-grid">
                    {FEATURE_KEYS.map((k) => (
                      <span key={k} className="about-feature-tag">{t(`settings.about.feature.${k}`)}</span>
                    ))}
                  </div>
                </div>

                {env && (
                  <div className="settings-section">
                    <h4 className="settings-section-subtitle">{t('settings.about.env')}</h4>
                    <div className="about-env-table">
                      <div className="env-row"><span className="env-label">{t('settings.about.platform')}</span><span className="env-value">{PLATFORM_LABELS[env.platform] ?? env.platform} ({env.arch})</span></div>
                      <div className="env-row"><span className="env-label">Runtime</span><span className="env-value">Tauri v{env.tauri}</span></div>
                    </div>
                  </div>
                )}

                <div className="settings-section">
                  <h4 className="settings-section-subtitle">{t('settings.about.license')}</h4>
                  <p className="about-license-text">MIT License</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface ShortcutDef {
  keys: string[]
  desc: string
}

function ShortcutGroup({ title, shortcuts }: { title: string; shortcuts: ShortcutDef[] }) {
  return (
    <div className="shortcut-group">
      <h4 className="settings-section-subtitle">{title}</h4>
      <div className="shortcut-rows">
        {shortcuts.map((s, i) => (
          <div key={i} className="shortcut-row">
            <span className="shortcut-desc">{s.desc}</span>
            <span className="shortcut-keys">
              {s.keys.map((k, j) => (
                <span key={j}>
                  {j > 0 && <span className="shortcut-plus">+</span>}
                  <kbd className="shortcut-key">{k}</kbd>
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default SettingsDialog
