import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'pre', 'code',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img', 'input',
  'em', 'strong', 'del', 'ins', 'sub', 'sup',
  'span', 'div', 'wiki-link',
  'svg', 'path', 'g', 'defs', 'text', 'tspan', 'rect', 'circle', 'line', 'polyline', 'polygon',
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title',
  'class', 'id', 'target',
  'width', 'height',
  'xmlns', 'viewBox', 'fill', 'stroke', 'stroke-width',
  'd', 'transform', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
  'points', 'style',
  // 复选框任务列表
  'type', 'checked', 'disabled',
]

// 精准放行业务必需的自定义 data-* 属性（无需放开 ALLOW_DATA_ATTR 全局白名单）。
// - data-title：wiki-link 的目标标题（预览导航）
// - data-tex：KaTeX 公式的原始 tex 源码（渲染层回读用）
const NEEDED_DATA_ATTR = ['data-title', 'data-tex']

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: NEEDED_DATA_ATTR,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+./-]+(?:[^a-z+./:]|$))/i,
  })
}
