import { useState, useEffect, useCallback } from 'react'
import * as bridge from '../../services/electron-bridge'
import { themeService, type ThemeName } from '../../services/theme-service'
import { useEditorStore } from '../../stores/editor-store'
import { useAppStore } from '../../stores/app-store'

interface EnvInfo {
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
}

export type SettingsTab = 'general' | 'display' | 'about'

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

const THEMES: { id: ThemeName; label: string; icon: string }[] = [
  { id: 'light', label: '亮色', icon: '☀' },
  { id: 'dark', label: '暗色', icon: '🌙' },
  { id: 'sepia', label: '护眼', icon: '🟡' },
]

const NAV_ITEMS: { id: SettingsTab; label: string; icon: string }[] = [
  { id: 'general', label: '通用', icon: '⚙' },
  { id: 'display', label: '显示', icon: '🎨' },
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

  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => themeService.getCurrentTheme())

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
                </div>
              </div>
            )}

            {activeTab === 'display' && (
              <div className="settings-section">
                <h3 className="settings-section-title">主题</h3>
                <div className="settings-rows">
                  <div className="settings-row">
                    <span className="settings-row-label">选择主题</span>
                    <div className="theme-btn-group">
                      {THEMES.map((t) => (
                        <button
                          key={t.id}
                          className={`theme-btn-item${currentTheme === t.id ? ' active' : ''}`}
                          onClick={() => { themeService.switchTheme(t.id); setCurrentTheme(t.id) }}
                        >
                          {t.icon} {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
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

export default SettingsDialog
