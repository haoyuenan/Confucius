import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock @tauri-apps/api/core's invoke() for all tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string, _args?: Record<string, unknown>) => {
    switch (cmd) {
      case 'get_app_version':
        return '0.0.0-test'
      case 'read_file_utf8':
        return '# Mock file content'
      case 'write_file_utf8':
        return undefined
      case 'build_file_tree':
        return { name: 'root', path: '/root', type: 'directory', children: [] }
      case 'stat_file':
        return { size: 0, modified: '0', is_dir: false }
      case 'read_dir_entries':
        return []
      case 'search_text':
        return []
      case 'create_file':
        return '/mock/file.md'
      case 'create_dir':
        return '/mock/dir'
      case 'rename_item':
        return undefined
      case 'delete_item':
        return undefined
      case 'start_file_watcher':
        return undefined
      case 'stop_file_watcher':
        return undefined
      default:
        throw new Error(`unmocked invoke: ${cmd}`)
    }
  }),
}))

// Mock @tauri-apps/api/event
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}))

// Mock @tauri-apps/plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(() => Promise.resolve(null)),
  save: vi.fn(() => Promise.resolve(null)),
  ask: vi.fn(() => Promise.resolve(true)),
}))

// Export preview helper
if (typeof window !== 'undefined') {
  ;(window as any).__exportPreviewHTML__ = () => ''
}
