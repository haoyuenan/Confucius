import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './i18n/i18n'
import './styles/global.css'
import 'github-markdown-css/github-markdown.css'
import './styles/editor.css'
import './styles/preview.css'
import './styles/sidebar.css'
import './styles/wysiwyg.css'
import './styles/status-bar.css'
import './styles/dialog.css'
import '../themes/plain-white.css'
import '../themes/warm-sun.css'
import '../themes/cloud.css'
import '../themes/mint.css'
import '../themes/tokyo-night-light.css'
import '../themes/rose-pine-dawn.css'
import '../themes/night-black.css'
import '../themes/deep-sea.css'
import '../themes/warm-gray.css'
import '../themes/mo-zhu.css'
import '../themes/tokyo-night.css'
import '../themes/rose-pine.css'

// ── highlight.js 主题（本地打包，移除 CDN 依赖）──
import hljsGithub from 'highlight.js/styles/github.css?inline'
import hljsIdea from 'highlight.js/styles/idea.css?inline'
import hljsAtomDark from 'highlight.js/styles/atom-one-dark.css?inline'
import hljsMonokai from 'highlight.js/styles/monokai.css?inline'

import hljsAtomLight from 'highlight.js/styles/atom-one-light.css?inline'
import hljsGithubDark from 'highlight.js/styles/github-dark.css?inline'

import hljsTokyoNightLight from 'highlight.js/styles/tokyo-night-light.css?inline'
import hljsTokyoNightDark from 'highlight.js/styles/tokyo-night-dark.css?inline'
import hljsRosePineDawn from 'highlight.js/styles/rose-pine-dawn.css?inline'
import hljsRosePine from 'highlight.js/styles/rose-pine.css?inline'

const hljsMap: Record<string, string> = {
  'plain-white': hljsGithub,
  'warm-sun':    hljsIdea,
  'cloud':       hljsAtomLight,
  'mint':              hljsGithub,
  'tokyo-night-light': hljsTokyoNightLight,
  'rose-pine-dawn':    hljsRosePineDawn,
  'night-black': hljsAtomDark,
  'deep-sea':    hljsGithubDark,
  'warm-gray':   hljsMonokai,
  'mo-zhu':      hljsAtomDark,
  'tokyo-night-dark': hljsTokyoNightDark,
  'rose-pine':        hljsRosePine,
}

const THEME_IDS = ['plain-white', 'warm-sun', 'cloud', 'mint', 'tokyo-night-light', 'rose-pine-dawn', 'night-black', 'deep-sea', 'warm-gray', 'mo-zhu', 'tokyo-night', 'rose-pine'] as const

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
