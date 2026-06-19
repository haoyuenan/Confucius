import { EditorView, ViewPlugin, ViewUpdate, showTooltip } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'
import { loadConfig, streamGenerate, checkHealth, type AIAction } from '../services/ai-service'
import i18n from '../i18n/i18n'

const showAiMenu = StateEffect.define<boolean>()
const aiMenuVisible = StateField.define<boolean>({
  create: () => false,
  update: (value, tr) => {
    for (const e of tr.effects) {
      if (e.is(showAiMenu)) return e.value
    }
    return value
  },
})

let _currentView: EditorView | null = null

export function getAICurrentView() {
  return _currentView
}

export function aiTooltipPlugin() {
  return [
    aiMenuVisible,
    ViewPlugin.fromClass(
      class {
        constructor(readonly view: EditorView) {
          _currentView = view
        }

        update(update: ViewUpdate) {
          if (!update.selectionSet) return
          update.view.dispatch({
            effects: showAiMenu.of(update.state.selection.main.from !== update.state.selection.main.to),
          })
        }

        destroy() {
          _currentView = null
        }
      },
    ),
    showTooltip.compute(['selection', aiMenuVisible], (state) => {
      if (!state.field(aiMenuVisible)) return null
      const sel = state.selection.main
      if (sel.from === sel.to) return null

      const t = i18n.t
      const actions: { key: AIAction; label: string }[] = [
        { key: 'translate', label: t('ai.menu.translate') },
        { key: 'summarize', label: t('ai.menu.summarize') },
        { key: 'rewrite', label: t('ai.menu.rewrite') },
        { key: 'expand', label: t('ai.menu.expand') },
      ]

      const dom = document.createElement('div')
      dom.className = 'ai-tooltip'
      dom.style.cssText =
        'display:flex;gap:4px;padding:4px;background:var(--bg-color,#fff);border:1px solid var(--border-color,#d0d7de);border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.1);z-index:100'

      for (const action of actions) {
        const btn = document.createElement('button')
        btn.textContent = action.label
        btn.style.cssText =
          'padding:4px 10px;border:1px solid var(--border-color,#d0d7de);border-radius:4px;background:var(--bg-color,#fff);color:var(--text-color,#333);cursor:pointer;font-size:12px;white-space:nowrap'
        btn.addEventListener('click', async (e) => {
          e.preventDefault()
          e.stopPropagation()
          dom.innerHTML = `<span style="padding:4px 10px;font-size:12px;color:var(--text-muted,#666)">${t('ai.loading')}</span>`

          const config = loadConfig()
          const healthy = await checkHealth(config.endpoint)
          if (!healthy) {
            alert(t('ai.noConnection') + '\n' + t('ai.noConnectionHint'))
            return
          }

          const text = state.sliceDoc(sel.from, sel.to)
          const view = _currentView
          if (!view) return

          streamGenerate(config, action.key, text, {
            onToken() {},
            onDone(fullText) {
              view.dispatch({
                changes: { from: sel.from, to: sel.to, insert: fullText },
              })
              view.dispatch({ effects: showAiMenu.of(false) })
            },
            onError(err) {
              console.error('AI 操作失败:', err)
            },
          })
        })

        dom.appendChild(btn)
      }

      return { pos: sel.head, above: true, create: () => ({ dom }) }
    }),
  ]
}
