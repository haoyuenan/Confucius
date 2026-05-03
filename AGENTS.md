# CODEBUDDY.md This file provides guidance to CodeBuddy when working with code in this repository.

## Commands

```bash
npm run dev        # Start Vite dev server with Electron (HMR + main process hot-restart)
npm run build      # TypeScript check + Vite production build
npm run typecheck  # Run tsc --noEmit for type errors
npm run lint       # ESLint on src/ and electron/
npm run pack:win   # electron-builder → Windows .exe installer
npm run pack:mac   # electron-builder → macOS .dmg
npm run pack:linux # electron-builder → Linux .AppImage
```

## Architecture

**Electron dual-process**. Code is strictly separated into `electron/` (main process) and `src/` (renderer process). The main process handles window management, native menus, and all file system operations. The renderer process runs the React UI.

**IPC bridge**. `electron/preload.ts` uses `contextBridge.exposeInMainWorld()` to expose a typed `window.electronAPI` object. All communication uses `ipcMain.handle()` / `ipcRenderer.invoke()` (request-response pattern). Channel naming convention: `<domain>:<action>` (e.g. `file:read`, `search:query`, `export:html`). The preload defines the full API shape — if you add a new IPC channel, update both `electron/ipc-handlers.ts` and `electron/preload.ts` together.

**State management**. Three Zustand stores in `src/stores/`: `app-store.ts` (file path, modification state, sidebar toggle), `editor-store.ts` (editor content, loading state), `sidebar-store.ts` (active tab, file tree, expanded paths, search results). Stores are the single source of truth — React components read via hooks and write via store actions.

**Editor pipeline**. The editing experience is dual-pane split layout:
1. `EditorPane` wraps a CodeMirror 6 `EditorView` — it is initialized once and never remounted. When `initialContent` changes (file open/new file), the content is dispatched in-place to preserve scroll state.
2. `EditorLayout` manages the `ResizablePane` (draggable divider) and side-by-side layout.
3. `PreviewPane` receives raw Markdown text → `markdown-renderer.ts` feeds it through `markdown-it` (with `highlight.js` for code blocks) → the resulting HTML is set via `innerHTML`. After that, `renderMermaidDiagrams()` runs first, then KaTeX formulas are processed via `renderMathInElement()` DOM walker.
4. Keyboard shortcuts (bold, italic, link, etc.) are registered as CM6 `keymap` extensions in `src/editor/keybindings.ts`.

**Theme system**. Three CSS variable files in `themes/` (light.css, dark.css, sepia.css) are loaded at startup. ThemeService sets `document.documentElement.dataset.theme` which triggers CSS selector matching. The theme is persisted in `localStorage`. Switching theme also updates the highlight.js `<link>` element and re-initializes Mermaid with the matching theme.

**File operations**. File operations always flow: React component → `window.electronAPI.method()` → IPC invoke → `ipc-handlers.ts` → Node.js `fs` module. File tree is built recursively in the main process (async, directory-first sort). File changes are watched via `fs.watch` (recursive) with a 500ms debounce.

**Preview HTML is also used for export**. `PreviewPane` registers `window.__exportPreviewHTML__` which returns the rendered innerHTML. The `ExportService` in the main process calls `win.webContents.executeJavaScript('window.__exportPreviewHTML__()')` to get rendered content, then wraps it in a full HTML document (for HTML export) or feeds it into a hidden `BrowserWindow` → `printToPDF` (for PDF export).

**Extension point: WYSIWYG mode**. Phase 5 will implement "live preview" (hide syntax markers when cursor is away via CM6 `Decoration`). This is designed for `src/editor/wysiwyg-plugin.ts`. The architecture keeps the CM6 view as the single truth source; the existing dual-pane mode remains alongside as a toggleable option.

**Known constraint**: chokidar must not be used — it is ESM-only and Electron 28 compiles main process to CommonJS. Use `fs.watch` instead for file watching.
