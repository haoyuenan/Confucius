import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { editorKeyBindings } from './keybindings'
import { wrapSelectionAsLink, insertImageFromPath } from './format-helpers'
import { wysiwygMode } from './wysiwyg-plugin'
import { typewriterScrollListener } from './typewriter-mode'
import { wikiLinkExtensions } from './wikilinks-plugin'
import { tagAutocomplete } from './tags-plugin'

export function createEditorView(
  container: HTMLElement,
  onChange: (content: string) => void,
  enableWysiwyg = false,
  enableTypewriter = false,
): EditorView {
  let updateTimeout: ReturnType<typeof setTimeout> | null = null

  const extensions = [
    basicSetup,
    markdown({ base: markdownLanguage, codeLanguages: [] }),
    syntaxHighlighting(defaultHighlightStyle),
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        if (updateTimeout) clearTimeout(updateTimeout)
        updateTimeout = setTimeout(() => { onChange(update.state.doc.toString()) }, 150)
      }
    }),
    keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
    highlightSelectionMatches(),
    editorKeyBindings,
    // 粘贴 URL 自动转链接 / 粘贴图片文件自动插入
    EditorView.domEventHandlers({
      paste: (event, view) => {
        const text = event.clipboardData?.getData('text/plain')
        if (text) {
          const isUrl = /^https?:\/\/\S+$/i.test(text.trim())
          if (isUrl && wrapSelectionAsLink(view, text.trim())) {
            event.preventDefault()
            return true
          }
        }
        const files = event.clipboardData?.files
        if (files && files.length > 0) {
          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/') && 'path' in file) {
              insertImageFromPath(view, (file as { path: string }).path, file.name)
              event.preventDefault()
              return true
            }
          }
        }
        return false
      },
      drop: (event, view) => {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/') && 'path' in file) {
            const filePath = (file as { path: string }).path
            const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
            if (pos === null) continue
            const alt = file.name.replace(/\.[^.]+$/, '')
            const encodedPath = filePath.replace(/\\/g, '/').split('/').map(seg => encodeURIComponent(seg)).join('/')
            const markdown = `![${alt}](local-asset:///${encodedPath})`
            view.dispatch({
              changes: { from: pos, insert: markdown },
              selection: { anchor: pos + markdown.length },
            })
            event.preventDefault()
            return true
          }
        }
        return false
      },
    }),
    EditorView.theme({
      '&': { height: '100%', width: '100%' },
      '.cm-scroller': {
        padding: '16px 24px',
        fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        fontSize: '14px',
        lineHeight: '1.7',
      },
      '.cm-content': { caretColor: 'var(--accent-color, #0366d6)' },
      '.cm-cursor': { borderLeftColor: 'var(--accent-color, #0366d6)', borderLeftWidth: '2px' },
      '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--accent-color, #0366d6)' },
    }),
  ]

  extensions.push(...wikiLinkExtensions(), tagAutocomplete)
  if (enableWysiwyg) extensions.push(wysiwygMode())
  if (enableTypewriter) extensions.push(typewriterScrollListener())

  const view = new EditorView({ doc: '', extensions, parent: container })
  return view
}
