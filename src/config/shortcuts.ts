/**
 * 快捷键单一事实源
 *
 * 所有快捷键的按键定义集中在此：
 * - `keybindings.ts`（编辑器内 CM6 绑定）通过 `cm6Key()` 生成按键格式
 * - `command-registry.ts`（命令面板文案）通过 `getShortcutLabel()` 生成显示文本
 * - `SettingsDialog`（设置页快捷键表）按 group 分组渲染
 *
 * 修改快捷键只需改这里，三处消费方自动同步，不再漂移。
 */

export type ShortcutGroup = 'file' | 'edit' | 'view' | 'other'

export interface ShortcutDef {
  id: string
  group: ShortcutGroup
  /** UI 展示格式，如 ['Ctrl', 'Shift', 'O'] */
  keys: string[]
  /** settings.shortcuts.desc.* 键名（不含前缀） */
  descriptionKey: string
}

export const SHORTCUTS: ShortcutDef[] = [
  // 文件
  { id: 'file:new', group: 'file', keys: ['Ctrl', 'N'], descriptionKey: 'newFile' },
  { id: 'file:open', group: 'file', keys: ['Ctrl', 'O'], descriptionKey: 'openFile' },
  { id: 'file:save', group: 'file', keys: ['Ctrl', 'S'], descriptionKey: 'save' },
  { id: 'file:save-as', group: 'file', keys: ['Ctrl', 'Shift', 'S'], descriptionKey: 'saveAs' },
  { id: 'export:html', group: 'file', keys: ['Ctrl', 'Shift', 'H'], descriptionKey: 'exportHtml' },
  { id: 'export:pdf', group: 'file', keys: ['Ctrl', 'Shift', 'E'], descriptionKey: 'exportPdf' },
  { id: 'file:close', group: 'file', keys: ['Ctrl', 'W'], descriptionKey: 'closeWindow' },

  // 编辑
  { id: 'edit:find', group: 'edit', keys: ['Ctrl', 'F'], descriptionKey: 'find' },
  { id: 'edit:bold', group: 'edit', keys: ['Ctrl', 'B'], descriptionKey: 'bold' },
  { id: 'edit:italic', group: 'edit', keys: ['Ctrl', 'I'], descriptionKey: 'italic' },
  { id: 'edit:link', group: 'edit', keys: ['Ctrl', 'K'], descriptionKey: 'link' },
  { id: 'edit:inline-code', group: 'edit', keys: ['Ctrl', '`'], descriptionKey: 'inlineCode' },
  { id: 'edit:code-block', group: 'edit', keys: ['Ctrl', 'Shift', '`'], descriptionKey: 'codeBlock' },
  { id: 'edit:math', group: 'edit', keys: ['Ctrl', 'Shift', 'M'], descriptionKey: 'mathBlock' },
  { id: 'edit:unordered-list', group: 'edit', keys: ['Ctrl', 'Shift', 'L'], descriptionKey: 'unorderedList' },
  { id: 'edit:blockquote', group: 'edit', keys: ['Ctrl', 'Shift', '['], descriptionKey: 'blockquote' },
  { id: 'edit:ordered-list', group: 'edit', keys: ['Ctrl', 'Shift', 'O'], descriptionKey: 'orderedList' },

  // 视图
  { id: 'command:palette', group: 'view', keys: ['Ctrl', 'E'], descriptionKey: 'commandPalette' },
  { id: 'view:sidebar', group: 'view', keys: ['Ctrl', '\\'], descriptionKey: 'toggleSidebar' },
  { id: 'view:toggle-mode', group: 'view', keys: ['Ctrl', 'Shift', 'P'], descriptionKey: 'toggleMode' },
  { id: 'tool:search', group: 'view', keys: ['Ctrl', 'Shift', 'F'], descriptionKey: 'globalSearch' },
  { id: 'view:focus', group: 'view', keys: ['F11'], descriptionKey: 'focusMode' },
  { id: 'view:typewriter', group: 'view', keys: ['F12'], descriptionKey: 'typewriter' },

  // 其他
  { id: 'edit:undo', group: 'other', keys: ['Ctrl', 'Z'], descriptionKey: 'undo' },
  { id: 'edit:redo', group: 'other', keys: ['Ctrl', 'Y'], descriptionKey: 'redo' },
  { id: 'dialog:close', group: 'other', keys: ['Esc'], descriptionKey: 'closeDialog' },
  { id: 'settings:plugins', group: 'other', keys: ['Ctrl', 'Shift', 'I'], descriptionKey: 'plugins' },
]

/** UI 格式 → CM6 按键格式：['Ctrl','Shift','O'] → 'Mod-Shift-o' */
export function cm6Key(keys: string[]): string {
  return keys.map((k) => (k === 'Ctrl' ? 'Mod' : k)).join('-').toLowerCase()
}

/** UI 格式 → 显示文本：['Ctrl','Shift','O'] → 'Ctrl+Shift+O' */
export function getShortcutLabel(id: string): string | undefined {
  return SHORTCUTS.find((s) => s.id === id)?.keys.join('+')
}
