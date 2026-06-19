import DOMPurify from 'dompurify'

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'ul', 'ol', 'li',
  'pre', 'code',
  'blockquote',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'a', 'img',
  'em', 'strong', 'del', 'ins', 'sub', 'sup',
  'span', 'div',
  'svg', 'path', 'g', 'defs', 'text', 'tspan', 'rect', 'circle', 'line', 'polyline', 'polygon',
]

const ALLOWED_ATTR = [
  'href', 'src', 'alt', 'title',
  'class', 'id', 'target',
  'width', 'height',
  'xmlns', 'viewBox', 'fill', 'stroke', 'stroke-width',
  'd', 'transform', 'x', 'y', 'cx', 'cy', 'r', 'rx', 'ry',
  'points', 'style',
]

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|data):|[^a-z]|[a-z+./-]+(?:[^a-z+./:]|$))/i,
  })
}
