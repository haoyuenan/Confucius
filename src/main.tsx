import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import 'github-markdown-css/github-markdown.css'
import './styles/editor.css'
import './styles/preview.css'
import './styles/sidebar.css'
import './styles/wysiwyg.css'
import './styles/status-bar.css'
import './styles/dialog.css'
import '../themes/light.css'
import '../themes/dark.css'
import '../themes/sepia.css'

// ── highlight.js 主题（本地打包，移除 CDN 依赖）──
import hljsLight from 'highlight.js/styles/github.css?inline'
import hljsDark from 'highlight.js/styles/atom-one-dark.css?inline'
import hljsSepia from 'highlight.js/styles/idea.css?inline'

const hljsThemes: Record<string, string> = {
  light: hljsLight,
  dark: hljsDark,
  sepia: hljsSepia,
}

// 创建 3 个 <style> 元素，默认只启用 light
;(['light', 'dark', 'sepia'] as const).forEach((name) => {
  const style = document.createElement('style')
  style.id = `hljs-${name}`
  style.textContent = hljsThemes[name]
  style.disabled = name !== 'light'
  document.head.appendChild(style)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
