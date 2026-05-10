import { useState, useEffect, useCallback } from 'react'
import * as bridge from '../../services/electron-bridge'
import { themeService, getThemesByMode, type ThemeMode, type ThemeId } from '../../services/theme-service'
import { useEditorStore } from '../../stores/editor-store'
import { useAppStore } from '../../stores/app-store'

interface EnvInfo {
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
}

export type SettingsTab = 'general' | 'display' | 'shortcuts' | 'about'

const THEME_SWATCHES: Record<ThemeId, { bg: string; accent: string; secondary: string }> = {
  'plain-white': { bg: '#ffffff', accent: '#0366d6', secondary: '#f6f8fa' },
  'eye-care': { bg: '#fbf0d9', accent: '#8b5e3c', secondary: '#f2e6c9' },
  'cloud': { bg: '#f5f5f0', accent: '#0284c7', secondary: '#ecece5' },
  'mint': { bg: '#f0f5f3', accent: '#0d9488', secondary: '#e8efe9' },
  'night-black': { bg: '#1e1e1e', accent: '#569cd6', secondary: '#252526' },
  'deep-sea': { bg: '#0d1117', accent: '#58a6ff', secondary: '#161b22' },
  'warm-gray': { bg: '#1a1410', accent: '#d4a373', secondary: '#221c17' },
}

const FEATURES = [
  'Markdown 编辑与实时预览',
  '双栏 / 即时渲染 / 纯预览三种模式',
  '多标签管理',
  '文件树与全文搜索',
  'Mermaid 图表渲染',
  'KaTeX 公式支持',
  '专注模式 & 打字机模式',
  '亮色 / 暗色 / 护眼三主题',
  'HTML & PDF 导出',
  '插件系统',
]

const PLATFORM_LABELS: Record<string, string> = {
  win32: 'Windows',
  darwin: 'macOS',
  linux: 'Linux',
}

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'general', label: '通用', icon: '⚙' },
  { id: 'display', label: '显示', icon: '🎨' },
  { id: 'shortcuts', label: '快捷键', icon: '⌨' },
  { id: 'about', label: '关于', icon: '📝' },
]

interface Props {
  onClose: () => void
  initialTab?: SettingsTab
}

function SettingsDialog({ onClose, initialTab = 'general' }: Props) {
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
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`settings-nav-card${activeTab === item.id ? ' active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className="settings-nav-icon">{item.icon}</span>
                <span className="settings-nav-label">{item.label}</span>
              </button>
            ))}
          </nav>

          <div className="settings-content">
            {activeTab === 'general' && (
              <div className="settings-section">
                <h3 className="settings-section-title">通用设置</h3>
                <div className="settings-rows">
                  <div className="settings-row">
                    <span className="settings-row-label">专注模式</span>
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
                    <span className="settings-row-label">打字机模式</span>
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
                    <span className="settings-row-label">启动时展开侧边栏</span>
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
                    <span className="settings-row-label">隐藏主菜单</span>
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
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="settings-section">
                <h3 className="settings-section-title">主题</h3>

                <div className="mode-select-area">
                  <p className="mode-select-label">主题模式</p>
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
                          <span className="mode-card-label">{mode === 'light' ? '浅色模式' : '深色模式'}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="theme-preset-area">
                  <p className="mode-select-label">主题预设</p>
                  <div className="theme-cards">
                    {getThemesByMode(themeService.getCurrentMode()).map((t) => {
                      const active = currentTheme === t.id
                      const swatch = THEME_SWATCHES[t.id]
                      return (
                        <div
                          key={t.id}
                          className={`theme-card${active ? ' active' : ''}`}
                          onClick={() => { themeService.switchTheme(t.id); setCurrentTheme(t.id) }}
                        >
                          <span className="theme-card-swatches">
                            <span className="theme-card-swatch" style={{ background: swatch.bg }} />
                            <span className="theme-card-swatch" style={{ background: swatch.secondary }} />
                            <span className="theme-card-swatch" style={{ background: swatch.accent }} />
                            {active && <span className="theme-card-check">✓</span>}
                          </span>
                          <span className="theme-card-name">{t.icon} {t.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="settings-section">
                <h3 className="settings-section-title">快捷键</h3>

                <ShortcutGroup title="文件操作" shortcuts={[
                  { keys: ['Ctrl', 'N'], desc: '新建文件' },
                  { keys: ['Ctrl', 'O'], desc: '打开文件' },
                  { keys: ['Ctrl', 'S'], desc: '保存文件' },
                  { keys: ['Ctrl', 'Shift', 'S'], desc: '另存为' },
                  { keys: ['Ctrl', 'Shift', 'H'], desc: '导出 HTML' },
                  { keys: ['Ctrl', 'Shift', 'E'], desc: '导出 PDF' },
                  { keys: ['Ctrl', 'W'], desc: '关闭窗口' },
                ]} />

                <ShortcutGroup title="编辑格式" shortcuts={[
                  { keys: ['Ctrl', 'B'], desc: '加粗' },
                  { keys: ['Ctrl', 'I'], desc: '斜体' },
                  { keys: ['Ctrl', 'K'], desc: '插入链接' },
                  { keys: ['Ctrl', '`'], desc: '行内代码' },
                  { keys: ['Ctrl', 'Shift', '`'], desc: '代码块' },
                  { keys: ['Ctrl', 'Shift', 'M'], desc: '公式块' },
                  { keys: ['Ctrl', 'Shift', 'L'], desc: '无序列表' },
                  { keys: ['Ctrl', 'Shift', '['], desc: '引用块' },
                  { keys: ['Ctrl', 'Shift', 'O'], desc: '有序列表' },
                ]} />

                <ShortcutGroup title="视图模式" shortcuts={[
                  { keys: ['Ctrl', 'Shift', 'P'], desc: '切换编辑模式 (分屏 ↔ WYSIWYG)' },
                  { keys: ['Ctrl', 'Shift', 'O'], desc: '切换预览模式' },
                  { keys: ['Ctrl', '\\'], desc: '切换侧边栏' },
                  { keys: ['Ctrl', 'Shift', 'F'], desc: '全局搜索' },
                  { keys: ['F11'], desc: '专注模式' },
                  { keys: ['F12'], desc: '打字机模式' },
                ]} />

                <ShortcutGroup title="其他" shortcuts={[
                  { keys: ['Ctrl', 'Z'], desc: '撤销' },
                  { keys: ['Ctrl', 'Y'], desc: '重做' },
                  { keys: ['Ctrl', 'Shift', 'I'], desc: '插件管理' },
                  { keys: ['Esc'], desc: '关闭对话框' },
                  { keys: ['Ctrl', '滚轮'], desc: '预览区缩放' },
                ]} />
              </div>
            )}

            {activeTab === 'about' && (
              <div className="settings-section about-section">
                <div className="about-header-compact">
                  <div className="about-big-icon">📝</div>
                  <h3 className="about-name">Confucius</h3>
                  <span className="about-ver-badge">v{version}</span>
                  <p className="about-tagline">本地 Markdown 编辑器 — 简洁、快速、可扩展</p>
                </div>

                <div className="settings-section">
                  <h4 className="settings-section-subtitle">功能特性</h4>
                  <div className="about-features-grid">
                    {FEATURES.map((f) => (
                      <span key={f} className="about-feature-tag">{f}</span>
                    ))}
                  </div>
                </div>

                {env && (
                  <div className="settings-section">
                    <h4 className="settings-section-subtitle">运行环境</h4>
                    <div className="about-env-table">
                      <div className="env-row"><span className="env-label">平台</span><span className="env-value">{PLATFORM_LABELS[env.platform] ?? env.platform} ({env.arch})</span></div>
                      <div className="env-row"><span className="env-label">Electron</span><span className="env-value">{env.electron}</span></div>
                      <div className="env-row"><span className="env-label">Chrome</span><span className="env-value">{env.chrome}</span></div>
                      <div className="env-row"><span className="env-label">Node.js</span><span className="env-value">{env.node}</span></div>
                    </div>
                  </div>
                )}

                <div className="settings-section">
                  <h4 className="settings-section-subtitle">许可</h4>
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
