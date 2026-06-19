import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { autocompletion } from '@codemirror/autocomplete'
import { defaultKeymap, historyKeymap } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { editorKeyBindings } from './keybindings'
import { wrapSelectionAsLink, insertImageFromPath } from './format-helpers'
import * as bridge from '../services/bridge'
import { useTabStore } from '../stores/tab-store'
import { wysiwygMode } from './wysiwyg-plugin'
import { typewriterScrollListener } from './typewriter-mode'
import { wikiLinkExtensions, wikiLinkCompletion } from './wikilinks-plugin'
import { tagCompletion } from './tags-plugin'
import { aiTooltipPlugin } from './ai-tooltip-plugin'

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

        // 检查剪贴板中的图片数据（截图/复制图片）
        const items = event.clipboardData?.items
        if (items) {
          for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
              const file = items[i].getAsFile()
              if (!file) continue
              event.preventDefault()

              const reader = new FileReader()
              reader.onload = async () => {
                const base64 = reader.result as string
                // 获取当前编辑文件的所在目录
                const activeFilePath = useTabStore.getState().activeTab()?.filePath
                if (!activeFilePath) return

                const dirPath = activeFilePath.replace(/[\\/][^\\/]*$/, '')
                const assetsDir = dirPath + '/' + (localStorage.getItem('confucius-image-path') || 'assets')
                // 文件名：时间戳 + 原始扩展名
                const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
                const ext = file.name?.split('.').pop() || 'png'
                const fileName = `${ts}.${ext}`
                try {
                  await bridge.saveImageFile(base64, fileName, assetsDir)
                  const { from } = view.state.selection.main
                  const alt = file.name?.replace(/\.[^.]+$/, '') || 'image'
                  const relPath = `assets/${fileName}`
                  const markdown = `![${alt}](${relPath})`
                  view.dispatch({
                    changes: { from, insert: markdown },
                    selection: { anchor: from + markdown.length },
                  })
                } catch (err) {
                  console.error('保存剪贴板图片失败:', err)
                }
              }
              reader.readAsDataURL(file)
              return true
            }
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
            const markdown = `![${alt}](${filePath.replace(/\\/g, '/')})`
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

  extensions.push(
    ...wikiLinkExtensions(),
    autocompletion({
      override: [wikiLinkCompletion, tagCompletion],
      activateOnTyping: true,
      closeOnBlur: true,
    }),
  )
  extensions.push(...aiTooltipPlugin())
  if (enableWysiwyg) extensions.push(wysiwygMode())
  if (enableTypewriter) extensions.push(typewriterScrollListener())

  const view = new EditorView({ doc: '', extensions, parent: container })
  return view
}
