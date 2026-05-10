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
import '../themes/plain-white.css'
import '../themes/eye-care.css'
import '../themes/cloud.css'
import '../themes/mint.css'
import '../themes/night-black.css'
import '../themes/deep-sea.css'
import '../themes/warm-gray.css'

// ── highlight.js 主题（本地打包，移除 CDN 依赖）──
import hljsGithub from 'highlight.js/styles/github.css?inline'
import hljsIdea from 'highlight.js/styles/idea.css?inline'
import hljsAtomDark from 'highlight.js/styles/atom-one-dark.css?inline'
import hljsMonokai from 'highlight.js/styles/monokai.css?inline'
import hljsNord from 'highlight.js/styles/nord.css?inline'
import hljsAtomLight from 'highlight.js/styles/atom-one-light.css?inline'
import hljsGithubDark from 'highlight.js/styles/github-dark.css?inline'

const hljsMap: Record<string, string> = {
  'plain-white': hljsGithub,
  'eye-care': hljsIdea,
  'cloud': hljsAtomLight,
  'mint': hljsNord,
  'night-black': hljsAtomDark,
  'deep-sea': hljsGithubDark,
  'warm-gray': hljsMonokai,
}

const THEME_IDS = ['plain-white', 'eye-care', 'cloud', 'mint', 'night-black', 'deep-sea', 'warm-gray'] as const

THEME_IDS.forEach((id) => {
  const style = document.createElement('style')
  style.id = `hljs-${id}`
  style.textContent = hljsMap[id]
  style.disabled = id !== 'plain-white'
  document.head.appendChild(style)
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
