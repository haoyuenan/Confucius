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

// 为标题生成 id 属性，支持文档内锚点跳转
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf\u{20000}-\u{2a6df}-]/gu, '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultHeadingOpen: any = md.renderer.rules.heading_open ||
  function (tokens: any[], idx: number, options: any, _env: unknown, self: any) {
    return self.renderToken(tokens, idx, options)
  }

md.renderer.rules.heading_open = function (tokens, idx, options, env, self) {
  const inlineToken = tokens[idx + 1]
  if (inlineToken?.type === 'inline' && inlineToken.content) {
    tokens[idx].attrSet('id', slugify(inlineToken.content))
  }
  return defaultHeadingOpen(tokens, idx, options, env, self)
}

// markdown-it-texmath: 在 markdown-it 层渲染 KaTeX 公式，无需 DOM 后处理
md.use(texmath, {
  engine: katex,
  delimiters: 'dollars',
  katexOptions: { throwOnError: false },
})

function preprocessWikiLinks(text: string): string {
  return text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_match: string, title: string, display: string) => {
    const label = md.utils.escapeHtml(display || title)
    const dataTitle = md.utils.escapeHtml(title)
    return `<wiki-link data-title="${dataTitle}">${label}</wiki-link>`
  })
}

export function renderMarkdown(text: string): string {
  const processed = preprocessWikiLinks(text)
  const raw = md.render(processed)
  return sanitizeHtml(raw)
}
