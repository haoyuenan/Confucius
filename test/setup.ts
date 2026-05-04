import '@testing-library/jest-dom'

const createNoop = () => () => {}
const createPromiseNoop = () => Promise.resolve()

const mockElectronAPI = {
  getVersion: () => Promise.resolve('1.0.0'),
  getEnv: () => Promise.resolve({ electron: '30.0.0', chrome: '120.0.0', node: '20.0.0', platform: 'win32', arch: 'x64' }),
  openFileDialog: () => Promise.resolve(null),
  saveFileDialog: () => Promise.resolve(null),
  readFile: (_path: string) => Promise.resolve({ content: `# File: ${_path}`, filePath: _path }),
  writeFile: createPromiseNoop,
  confirmSave: () => Promise.resolve(1 as 0 | 1 | 2),
  onMenuAction: () => createNoop() as () => void,
  openFolderDialog: () => Promise.resolve(null),
  buildFileTree: () => Promise.resolve({ name: 'root', path: '/root', type: 'directory' as const, children: [] }),
  startFileWatcher: createPromiseNoop,
  stopFileWatcher: createPromiseNoop,
  onFileTreeChanged: () => createNoop() as () => void,
  showSidebarContextMenu: createPromiseNoop,
  onSidebarAction: () => createNoop() as () => void,
  createFile: () => Promise.resolve(true),
  createDir: () => Promise.resolve(true),
  renameItem: createPromiseNoop,
  deleteItem: createPromiseNoop,
  revealInExplorer: createPromiseNoop,
  searchQuery: () => Promise.resolve([]),
  exportHtml: createPromiseNoop,
  exportPdf: createPromiseNoop,
  onExportDone: () => createNoop() as () => void,
}

// 保护 Node 环境（encoding-detector 等测试用 @vitest-environment node）
if (typeof window !== 'undefined') {
  ;(window as any).electronAPI = mockElectronAPI
  ;(window as any).__exportPreviewHTML__ = () => ''
}
