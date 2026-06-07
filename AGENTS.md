# AGENTS.md — Guidance for AI agents working with this repository

## Commands

```bash
npm run dev        # Start Vite dev server with Electron (HMR + main process hot-restart)
npm run build      # TypeScript check + Vite production build
npm run typecheck  # Run tsc --noEmit for type errors
npm run lint       # ESLint on src/ and electron/
npm run pack:win   # electron-builder → Windows .exe installer (NSIS, compression: maximum)
npm run pack:mac   # electron-builder → macOS .dmg
npm run pack:linux # electron-builder → Linux .AppImage
```

## Architecture

**Electron dual-process**. Code is strictly separated into `electron/` (main process) and `src/` (renderer process). The main process handles window management, native menus, and all file system operations. The renderer process runs the React UI.

**IPC bridge**. `electron/preload.ts` uses `contextBridge.exposeInMainWorld()` to expose a typed `window.electronAPI` object. All communication uses `ipcMain.handle()` / `ipcRenderer.invoke()` (request-response pattern). Channel naming convention: `<domain>:<action>` (e.g. `file:read`, `search:query`, `export:html`, `knowledge:get-backlinks`). The preload defines the full API shape — if you add a new IPC channel, update both `electron/ipc-handlers.ts` and `electron/preload.ts` together.

**State management**. Six Zustand stores in `src/stores/`:
- `app-store.ts` — app info, sidebar toggle/width
- `editor-store.ts` — editor mode (split/wysiwyg/preview), content, loading state, focus/typewriter mode
- `sidebar-store.ts` — active tab, root path, file tree, expanded paths, outline items, search results
- `tab-store.ts` — tab management (open/close/active/modification state)
- `knowledge-store.ts` — knowledge base data (backlinks, graph data, tags, file search results)
- `plugin-store.ts` — plugin commands, sidebar tabs, state

Stores are the single source of truth — React components read via hooks and write via store actions.

**Editor pipeline**. The editing experience supports three modes:
1. `split` — dual-pane layout with `ResizablePane` (draggable divider). `EditorPane` wraps a CodeMirror 6 view (initialized once, never remounted). `PreviewPane` renders Markdown via markdown-it.
2. `wysiwyg` — single-pane CodeMirror with syntax marker hiding via `src/editor/wysiwyg-plugin.ts`.
3. `preview` — full-screen reading layout.

**CM6 extensions** are composed in `src/editor/cm6-setup.ts`. Key extensions:
- `wikilinks-plugin.ts` — `[[` autocomplete, syntax highlighting, Ctrl+Click navigation
- `tags-plugin.ts` — `#` autocomplete

**Theme system**. Twelve theme CSS files in `themes/` define light/dark mode variables. ThemeService manages switching via `document.documentElement.dataset.theme`. Themes also control highlight.js `<style>` elements and Mermaid theme. Toolbar toggles light/dark; settings panel offers per-mode theme selection.

**File operations**. Always flow: React component → `window.electronAPI.method()` → IPC invoke → `ipc-handlers.ts` → Node.js `fs` module. File tree is built recursively in the main process (async, directory-first sort). File changes are watched via `fs.watch` (recursive) with a 500ms debounce. Note: chokidar must not be used — it is ESM-only and Electron 28 compiles main process to CommonJS.

**Knowledge base index**. `electron/services/knowledge-service.ts` provides a complete knowledge base engine:
- Parses `[[wikilinks]]`, `#tags`, and YAML frontmatter from all `.md` files in the workspace
- Stores index in `.confucius/index.json` (hidden workspace directory)
- Full scan on workspace open, incremental update on file changes
- Exposes backlinks, graph data, tags, file search, and wikilink resolution via IPC

**Preview HTML is also used for export**. `PreviewPane` registers `window.__exportPreviewHTML__` which returns the rendered innerHTML. The `ExportService` in the main process calls `win.webContents.executeJavaScript('window.__exportPreviewHTML__()')` to get rendered content, resolves `[[wikilinks]]` to HTML anchors, then wraps it in a full HTML document (for HTML export) or feeds it into a hidden `BrowserWindow` → `printToPDF` (for PDF export).

**Heading slug system**. The outline panel and preview use a shared `slugify()` function (exported from `src/editor/markdown-renderer.ts`) to generate heading IDs. Outline items include a `slug` field for precise preview targeting — clicking an outline heading finds the preview element by `id` attribute rather than by index or text matching.

**Dependencies for knowledge base**:
- `d3` (v7) — force-directed graph layout for knowledge graph visualization
- highlight.js configured with 33 commonly used languages (core + selective registration) instead of all 384 languages

**Electron-builder**: configured with `compression: maximum` for NSIS installer. The `electron-builder.yml` excludes `node_modules` from the asar and bundles `plugins/builtins` as extra resources.
