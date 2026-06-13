# AGENTS.md — Guidance for AI agents working with this repository

## Commands

```bash
npm run dev            # Start Tauri dev mode (Vite HMR + WebView hot-reload)
npm run build          # TypeScript check + Vite production build
npm run dev:vite       # Start Vite dev server only (no Tauri)
npm run build:tauri    # Full Tauri production build (frontend + Rust)
npm run typecheck      # Run tsc --noEmit for type errors
npm run lint           # ESLint on src/
npm test               # Run Vitest unit/integration tests
npm run tauri -- help  # Tauri CLI help
```

## Architecture

**Tauri dual-process**. The frontend runs as a webview (React + TypeScript) in `src/`. The backend consists of Rust commands in `src-tauri/src/lib.rs`. Communication uses `@tauri-apps/api/core`'s `invoke()` (request-response pattern). There is no Electron/Node.js main process.

**Rust backend** (`src-tauri/src/lib.rs`). All system-level operations are implemented as `#[tauri::command]` functions:
- `build_file_tree` — recursive directory walk, returns sorted tree of `.md` files
- `search_text` — parallel full-text regex search (8 threads)
- `read_file_utf8` / `write_file_utf8` — file I/O (bypasses Tauri fs scope)
- `create_file` / `create_dir` / `rename_item` / `delete_item` — file management
- `stat_file` / `read_dir_entries` — file metadata and directory listing
- `start_file_watcher` / `stop_file_watcher` — filesystem change watcher (via `notify` crate)
- `run_code` — Python code execution via `child_process`
- `get_app_version` — returns package version

**IPC bridge**. `src/services/electron-bridge.ts` wraps all Tauri `invoke()` calls and plugin APIs into a single module — the frontend's sole entry point for system operations. Channel naming convention follows the original Electron IPC: `<domain>:<action>` (e.g. `file:read`, `search:query`). If you add a new Rust command, update both `lib.rs` (the command function + `generate_handler![]`) and `electron-bridge.ts` (the wrapper function).

**State management**. Five Zustand stores in `src/stores/`:
- `app-store.ts` — app info, sidebar toggle/width
- `editor-store.ts` — editor mode (split/wysiwyg/preview), content, loading state, focus/typewriter mode
- `sidebar-store.ts` — active tab, root path, file tree, expanded paths, outline items, search results
- `tab-store.ts` — tab management (open/close/active/modification state)
- `knowledge-store.ts` — knowledge base data (backlinks, graph data, tags, file search results)

Stores are the single source of truth — React components read via hooks and write via store actions.

**Editor pipeline**. The editing experience supports three modes:
1. `split` — dual-pane layout with `ResizablePane` (draggable divider). `EditorPane` wraps a CodeMirror 6 view (initialized once, never remounted). `PreviewPane` renders Markdown via markdown-it.
2. `wysiwyg` — single-pane CodeMirror with syntax marker hiding via `src/editor/wysiwyg-plugin.ts`.
3. `preview` — full-screen reading layout.

**CM6 extensions** are composed in `src/editor/cm6-setup.ts`. Key extensions:
- `wikilinks-plugin.ts` — `[[` autocomplete, syntax highlighting, Ctrl+Click navigation
- `tags-plugin.ts` — `#` autocomplete

**Theme system**. Twelve theme CSS files in `themes/` define light/dark mode variables. ThemeService manages switching via `document.documentElement.dataset.theme`. Themes also control highlight.js `<style>` elements and Mermaid theme. Toolbar toggles light/dark; settings panel offers per-mode theme selection.

**File operations**. Always flow: React component → `bridge.method()` → `invoke('command_name', args)` → Rust command → direct `std::fs` operations. File tree is built recursively in Rust (async, directory-first sort). File changes are watched via the `notify` Rust crate (recursive, 500ms debounce in the event thread).

**Knowledge base index**. `src/services/knowledge-service.ts` provides a complete knowledge base engine running entirely in the frontend:
- Parses `[[wikilinks]]`, `#tags`, and YAML frontmatter from all `.md` files in the workspace
- Stores index in `.confucius/index.json` (hidden workspace directory)
- Full scan on workspace open, incremental update on file changes
- Exposes backlinks, graph data, tags, file search, and wikilink resolution via bridge APIs

**Preview HTML export**. `PreviewPane` registers `window.__exportPreviewHTML__` which returns the rendered innerHTML. The HTML export generates a standalone HTML document with embedded CSS. PDF export uses the browser's native `window.print()` (system print dialog).

**Heading slug system**. The outline panel and preview use a shared `slugify()` function (exported from `src/editor/markdown-renderer.ts`) to generate heading IDs. Outline items include a `slug` field for precise preview targeting — clicking an outline heading finds the preview element by `id` attribute rather than by index or text matching.

**Dependencies for knowledge base**:
- `d3` (v7) — force-directed graph layout for knowledge graph visualization
- highlight.js configured with 33 commonly used languages (core + selective registration) instead of all 384 languages

**Tauri plugins**:
- `@tauri-apps/plugin-dialog` — file/folder dialogs
- `@tauri-apps/plugin-shell` — open external URLs
- `@tauri-apps/plugin-process` — process info
- Rust crate `notify-debouncer-full` (v0.3) — filesystem watching

**Build/packaging**: `tauri.conf.json` configures the Tauri builder. Icon resources live in `src-tauri/icons/`. Output is configured in `dist-release/` via `npm run build:tauri`.
