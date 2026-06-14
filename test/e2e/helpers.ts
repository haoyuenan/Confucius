import { test as base, expect, type Page } from '@playwright/test'

/**
 * Tauri E2E 测试 fixture
 *
 * 使用 Playwright web 测试，通过 addInitScript 桥接 Tauri IPC mock，
 * 让前端在纯浏览器环境中正常运行。
 */

// ─── 启动 Vite dev server ───
import { createServer, type ViteDevServer } from 'vite'

let _server: ViteDevServer | null = null

async function ensureDevServer(): Promise<string> {
  if (!_server) {
    _server = await createServer({
      root: process.cwd(),
      server: { port: 5179, strictPort: true },
    })
    await _server.listen()
    console.log(`[e2e] Vite dev server started at ${_server.resolvedUrls?.local?.[0] ?? 'http://localhost:5179'}`)
  }
  return _server.resolvedUrls?.local?.[0] ?? 'http://localhost:5179'
}

// ─── Tauri IPC mock ───

const TAURI_MOCK_SCRIPT = `
// Mock @tauri-apps/api/core invoke
window.__TAURI_INVOKE__ = (cmd, args) => {
  switch (cmd) {
    case 'get_app_version': return Promise.resolve('0.0.0-test');
    case 'read_file_utf8':   return Promise.resolve('# Mock content from: ' + (args?.path || ''));
    case 'write_file_utf8':  return Promise.resolve(undefined);
    case 'build_file_tree':  return Promise.resolve({ name: 'mock', path: '/mock', type: 'directory', children: [] });
    case 'stat_file':        return Promise.resolve({ size: 0, modified: '0', is_dir: false });
    case 'read_dir_entries': return Promise.resolve([]);
    case 'search_text':      return Promise.resolve([]);
    case 'start_file_watcher': return Promise.resolve(undefined);
    case 'stop_file_watcher':  return Promise.resolve(undefined);
    default: return Promise.reject(new Error('unmocked Tauri invoke: ' + cmd));
  }
};

// Mock @tauri-apps/plugin-dialog
window.__TAURI_DIALOG__ = {
  open: () => Promise.resolve(null),
  save: () => Promise.resolve(null),
  ask: () => Promise.resolve(true),
};
window.__TAURI_PLUGIN_DIALOG__ = {
  open: () => Promise.resolve(null),
  save: () => Promise.resolve(null),
  ask: () => Promise.resolve(true),
};

// Mock @tauri-apps/api/event listen
window.__TAURI_EVENT__ = {
  listen: () => Promise.resolve(() => {}),
};

// Support dispatch of menu actions via CustomEvent (replaces Electron IPC)
window.__dispatchMenuAction = (action) => {
  window.dispatchEvent(new CustomEvent('menu-action', { detail: { action } }));
};

// Export preview HTML stub
window.__exportPreviewHTML__ = () => '<h1>Mock Preview</h1>';
`

// ─── Fixture ───

type AppFixture = {
  appPage: Page
}

export const test = base.extend<AppFixture>({
  appPage: async ({ browser }, use) => {
    const baseURL = await ensureDevServer()
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    })
    // Inject Tauri mock before any page script runs
    await context.addInitScript(TAURI_MOCK_SCRIPT)

    const page = await context.newPage()
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    // Wait for the editor to render
    await page.waitForSelector('.app-root', { timeout: 15_000 })

    await use(page)

    await context.close()
  },
})

export { expect }

// ─── Helpers ───

/** 获取 CM6 编辑器的文本内容 */
export async function getEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const view = (window as any).__cm6View
    return view ? view.state.doc.toString() : ''
  })
}

/** 在 CM6 编辑器中输入文本 */
export async function typeInEditor(page: Page, text: string): Promise<void> {
  const editorPane = page.locator('[data-testid="editor-pane"]')
  await editorPane.click()
  await page.keyboard.type(text, { delay: 30 })
}

/** 选中编辑器中所有文本 */
export async function selectAllInEditor(page: Page): Promise<void> {
  const editorPane = page.locator('[data-testid="editor-pane"]')
  await editorPane.click()
  await page.keyboard.press('Control+a')
}

/** 通过 CustomEvent 模拟菜单动作（替代旧的 Electron IPC） */
export async function dispatchMenuAction(page: Page, action: string): Promise<void> {
  await page.evaluate((a) => {
    window.dispatchEvent(new CustomEvent('menu-action', { detail: { action: a } }))
  }, action)
  await page.waitForTimeout(300)
}
