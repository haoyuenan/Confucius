import { EditorView, ViewPlugin, ViewUpdate, showTooltip } from '@codemirror/view'
import { StateField, StateEffect } from '@codemirror/state'
import { loadConfig, streamGenerate, checkHealth, type AIAction } from '../services/ai-service'
import { useNotificationStore } from '../stores/notification-store'
import i18n from '../i18n/i18n'

const _tooltipViews = new WeakMap<Node, EditorView>()

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

export function aiTooltipPlugin() {
  return [
    aiMenuVisible,
    ViewPlugin.fromClass(
      class {
        constructor(readonly view: EditorView) {}

        update(update: ViewUpdate) {
          if (!update.selectionSet) return
          update.view.dispatch({
            effects: showAiMenu.of(
              update.state.selection.main.from !== update.state.selection.main.to,
            ),
          })
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
            useNotificationStore.getState().showToast(
              t('ai.noConnection') + ' ' + t('ai.noConnectionHint'),
              'error',
            )
            return
          }

          const view = _tooltipViews.get(dom)
          if (!view) return
          view.dispatch({ effects: showAiMenu.of(false) })

          streamGenerate(config, action.key, state.sliceDoc(sel.from, sel.to), {
            onToken() {},
            onDone(fullText) {
              const s = view.state.selection.main
              view.dispatch({
                changes: { from: s.from, to: s.to, insert: fullText },
              })
            },
            onError(err) {
              const msg = err instanceof Error ? err.message : String(err)
              console.error('AI 操作失败:', err)
              useNotificationStore.getState().showToast(i18n.t('toast.aiError', { msg }), 'error')
            },
          })
        })

        dom.appendChild(btn)
      }

      return {
        pos: sel.head,
        above: true,
        create: (view: EditorView) => {
          _tooltipViews.set(dom, view)
          return { dom }
        },
      }
    }),
  ]
}
