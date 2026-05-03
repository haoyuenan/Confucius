import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js'

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

export function renderMarkdown(text: string): string {
  return md.render(text)
}
