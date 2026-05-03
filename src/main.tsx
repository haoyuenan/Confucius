import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/global.css'
import 'github-markdown-css/github-markdown.css'
import './styles/editor.css'
import './styles/preview.css'
import './styles/sidebar.css'
import '../themes/light.css'
import '../themes/dark.css'
import '../themes/sepia.css'

// 动态加载 highlight.js CDN 主题（供数据主题切换使用）
const hljsLink = document.createElement('link')
hljsLink.id = 'hljs-theme'
hljsLink.rel = 'stylesheet'
hljsLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css'
document.head.appendChild(hljsLink)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
