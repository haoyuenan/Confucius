import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { editorKeyBindings } from './keybindings'
import { wysiwygMode } from './wysiwyg-plugin'
import { typewriterScrollListener } from './typewriter-mode'

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
    keymap.of([...defaultKeymap, ...historyKeymap]),
    editorKeyBindings,
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

  if (enableWysiwyg) extensions.push(wysiwygMode())
  if (enableTypewriter) extensions.push(typewriterScrollListener())

  const view = new EditorView({ doc: '', extensions, parent: container })
  return view
}
