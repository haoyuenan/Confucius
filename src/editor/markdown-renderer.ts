import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import texmath from 'markdown-it-texmath'
import hljs from 'highlight.js'
import katex from 'katex'
import { sanitizeHtml } from '../utils/sanitize'

const md = new MarkdownIt({
  html: true,
  breaks: true,
  linkify: true,
  typographer: true,
  highlight: (str: string, lang: string): string => {
    if (lang === 'mermaid') {
      return `<pre class="mermaid-container"><code class="language-mermaid">${md.utils.escapeHtml(str)}</code></pre>`
    }
    let highlighted: string
    if (lang && hljs.getLanguage(lang)) {
      try {
        highlighted = hljs.highlight(str, { language: lang, ignoreIllegals: true }).value
      } catch {
        highlighted = hljs.highlightAuto(str).value
      }
    } else {
      highlighted = hljs.highlightAuto(str).value
    }
    const langLabel = lang ? `<span class="lang-label">${lang}</span>` : ''
    return `<pre class="code-block"><code class="hljs">${highlighted}</code>${langLabel}</pre>`
  },
})

md.use(taskLists, { enabled: true, label: true, labelAfter: true })

// markdown-it-texmath: 在 markdown-it 层渲染 KaTeX 公式，无需 DOM 后处理
md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false },
})

export function renderMarkdown(text: string): string {
  const raw = md.render(text)
  return sanitizeHtml(raw)
}
