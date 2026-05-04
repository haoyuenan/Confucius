import { useEffect, useState } from 'react'
import * as bridge from '../../services/electron-bridge'

interface EnvInfo {
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
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

function AboutDialog({ onClose }: { onClose: () => void }) {
  const [version, setVersion] = useState('...')
  const [env, setEnv] = useState<EnvInfo | null>(null)

  useEffect(() => {
    bridge.getVersion().then(setVersion)
    bridge.getEnv().then(setEnv)
  }, [])

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-panel about-dialog" onClick={(e) => e.stopPropagation()}>
        <button className="dialog-close" onClick={onClose}>✕</button>

        <div className="about-header">
          <div className="about-icon">📝</div>
          <h1 className="about-title">Confucius</h1>
          <span className="about-version">v{version}</span>
        </div>

        <p className="about-desc">
          本地 Markdown 编辑器 — 简洁、快速、可扩展
        </p>

        <div className="about-section">
          <div className="about-section-title">功能特性</div>
          <div className="about-features">
            {FEATURES.map((f) => (
              <span key={f} className="about-feature">{f}</span>
            ))}
          </div>
        </div>

        {env && (
          <div className="about-section">
            <div className="about-section-title">运行环境</div>
            <div className="about-env">
              <div className="about-env-row"><span className="env-label">平台</span><span className="env-value">{PLATFORM_LABELS[env.platform] ?? env.platform} ({env.arch})</span></div>
              <div className="about-env-row"><span className="env-label">Electron</span><span className="env-value">{env.electron}</span></div>
              <div className="about-env-row"><span className="env-label">Chrome</span><span className="env-value">{env.chrome}</span></div>
              <div className="about-env-row"><span className="env-label">Node.js</span><span className="env-value">{env.node}</span></div>
            </div>
          </div>
        )}

        <div className="about-section">
          <div className="about-section-title">许可</div>
          <p className="about-license">MIT License</p>
        </div>

        <div className="about-footer">
          <button className="about-close-btn" onClick={onClose}>关闭</button>
        </div>
      </div>
    </div>
  )
}

export default AboutDialog
