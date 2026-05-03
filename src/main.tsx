import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import 'github-markdown-css/github-markdown.css'
import './styles/editor.css'
import './styles/preview.css'
import './styles/sidebar.css'
import './styles/wysiwyg.css'
import './styles/toolbar.css'
import '../themes/light.css'
import '../themes/dark.css'
import '../themes/sepia.css'

// 动态加载 highlight.js CDN 主题（由 theme-service 切换）
// 初始加载亮色主题，切换时 theme-service 会修改 href
const hljsLink = document.createElement('link')
hljsLink.id = 'hljs-theme'
hljsLink.rel = 'stylesheet'
hljsLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
hljsLink.onerror = () => {
  console.warn('highlight.js 主题 CDN 加载失败，降级使用默认样式')
}
document.head.appendChild(hljsLink)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
