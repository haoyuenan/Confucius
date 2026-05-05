import { getActiveView } from '../editor/active-view'
import { useTabStore } from '../stores/tab-store'
import { usePluginStore } from '../stores/plugin-store'
import { useEditorStore } from '../stores/editor-store'
import type { HostAPIBridge } from './types/host-api'
import type { StatusBarItemDef, SidebarTabDef } from './types/plugin'

/**
 * HostAPIBridge 的宿主侧实现
 *
 * 注意：这个文件引用了宿主内部模块（store、editor），
 * 这是允许的——它是适配器实现层。
 * PluginEngine 核心不引用这些模块。
 */
export class HostAPIBridgeImpl implements HostAPIBridge {
  getEditorContent(): string {
    return document.querySelector('.cm-content')?.textContent ?? ''
  }

  getCursorPosition(): { line: number; col: number } {
    const view = getActiveView()
    if (!view) return { line: 1, col: 1 }
    const { main } = view.state.selection
    const line = view.state.doc.lineAt(main.head)
    return { line: line.number, col: main.head - line.from + 1 }
  }

  getActiveTabFilePath(): string | null {
    return useTabStore.getState().activeTab()?.filePath ?? null
  }

  addStatusBarItem(item: StatusBarItemDef): () => void {
    return usePluginStore.getState().addStatusBarItem(item)
  }

  addSidebarTab(tab: SidebarTabDef): () => void {
    return usePluginStore.getState().addSidebarTab(tab)
  }

  onContentChange(cb: (content: string) => void): () => void {
    return useEditorStore.subscribe((state) => cb(state.content ?? ''))
  }

  getAppVersion(): string {
    return '1.0.0'
  }

  getAPIVersion(): string {
    return '1.0.0'
  }
}
