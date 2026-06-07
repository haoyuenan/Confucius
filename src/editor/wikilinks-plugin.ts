import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { RangeSetBuilder } from '@codemirror/state'
import { knowledgeSearchFiles, knowledgeResolveLink, readFile } from '../services/electron-bridge'
import { useTabStore } from '../stores/tab-store'

export async function wikiLinkCompletion(context: CompletionContext): Promise<CompletionResult | null> {
  const word = context.matchBefore(/\[\[([^\]|]*)$/)
  if (!word) return null
  const query = word.text.replace('[[', '')
  const results = await knowledgeSearchFiles(query)
  return {
    from: word.from + 2,
    options: results.map(r => ({
      label: r.title,
      detail: r.path,
      apply: `${r.title}]]`,
    })),
  }
}

const wikiLinkDeco = Decoration.mark({ class: 'cm-wikilink' })

export const wikiLinkHighlighter = ViewPlugin.fromClass(class {
  decorations: DecorationSet
  constructor(view: EditorView) {
    this.decorations = this.computeDecorations(view)
  }
  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.computeDecorations(update.view)
    }
  }
  computeDecorations(view: EditorView) {
    const builder = new RangeSetBuilder<Decoration>()
    const doc = view.state.doc.toString()
    const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
    let match: RegExpExecArray | null
    const cleaned = doc.replace(/```[\s\S]*?```/g, m => ' '.repeat(m.length))
    while ((match = regex.exec(cleaned)) !== null) {
      const from = match.index
      const to = from + match[0].length
      builder.add(from, to, wikiLinkDeco)
    }
    return builder.finish()
  }
}, { decorations: v => v.decorations })

export function wikiLinkExtensions() {
  return [
    wikiLinkHighlighter,
    EditorView.domEventHandlers({
      mousedown: (event, view) => {
        if (!event.ctrlKey && !event.metaKey) return false
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
        if (pos === null) return false
        const doc = view.state.doc.toString()
        const cleaned = doc.replace(/```[\s\S]*?```/g, m => ' '.repeat(m.length))
        const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
        let match: RegExpExecArray | null
        while ((match = regex.exec(cleaned)) !== null) {
          if (pos >= match.index && pos <= match.index + match[0].length) {
            const title = match[1].trim()
            event.preventDefault()
            navigateToWikiLink(title)
            return true
          }
        }
        return false
      },
    }),
  ]
}

async function navigateToWikiLink(title: string) {
  const linkPath = await knowledgeResolveLink(title)
  if (linkPath) {
    try {
      const file = await readFile(linkPath)
      useTabStore.getState().openFile(file.filePath, file.content)
    } catch {
      // 文件被删除
    }
  }
}
