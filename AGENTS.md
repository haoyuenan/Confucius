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
npm run test:watch     # Vitest in watch mode
npm run test:coverage  # Vitest with coverage report
npm run version:bump -- 0.7.0  # Bump version in package.json + Cargo.toml + tauri.conf.json
```

## Architecture

**Tauri dual-process**. Frontend (React 18 + TypeScript) runs as a webview in `src/`. Backend is Rust in `src-tauri/src/`. No Electron/Node.js main process.

**IPC flow**: React component → `src/services/bridge.ts` (the only file that calls `invoke()`) → Rust command → direct `std::fs` operations. Channel naming follows the original Electron IPC: `<domain>:<action>` (e.g. `file:read`, `search:query`).

**State management**: Five Zustand stores in `src/stores/`:
- `app-store.ts` — app info, sidebar toggle/width
- `editor-store.ts` — editor mode (split/wysiwyg/preview), content, loading state
- `sidebar-store.ts` — active tab, root path, file tree, expanded paths, outline, search
- `tab-store.ts` — tab management (open/close/active/modification)
- `knowledge-store.ts` — backlinks, graph data, tags, file search (supports JS/Rust dual backend)

**Editor pipeline**: Three modes — `split` (dual-pane with draggable divider), `wysiwyg` (single-pane with syntax marker hiding), `preview` (full-screen reading). CM6 extensions composed in `src/editor/cm6-setup.ts`. Key custom extensions: `wikilinks-plugin.ts` (`[[` autocomplete + Ctrl+Click), `tags-plugin.ts` (`#` autocomplete), `ai-tooltip-plugin.ts` (AI floating menu on text selection).

**Custom hooks**: `src/hooks/` contains — `use-keyboard-shortcuts`, `use-session-restore`, `use-auto-save`, `use-menu-actions`, `use-theme-manager`, `use-virtual-list`. App.tsx composes these and owns the UI state.

**Theme system**: Twelve CSS files in `themes/` define light/dark mode variables via `html[data-theme='<id>']` selectors. ThemeService manages switching and per-mode memory (localStorage key `confucius-theme`).

**Knowledge base**: Dual-engine architecture with **Rust as the primary engine (default)** and JS engine (`src/services/knowledge-service.ts`) as fallback only. Rust engine in `src-tauri/src/knowledge/` parses `[[wikilinks]]`, `#tags`, and YAML frontmatter; index stored in `.confucius/index.json`. Backend is switchable via localStorage `confucius-knowledge-backend` — unset or `"rust"` uses Rust; explicit `"js"` uses the JS fallback. `bridge.knowledgeSearchFiles`/`knowledgeResolveLink` route to Tantivy (`search_text`) under the Rust backend.

**Full-text search**: Tantivy inverted index in `src-tauri/src/search/` replaces the old regex linear scan for non-regex, non-case-sensitive queries. Index stored in `.confucius/tantivy/`. Regex search falls back to the original parallel-scan implementation.

**AI assistant**: `src/services/ai-service.ts` calls Ollama HTTP API (`localhost:11434` by default) for translate/summarize/rewrite/expand. CM6 floating toolbar via `src/editor/ai-tooltip-plugin.ts`. Config stored in localStorage `confucius-ai-config`.

**Template system**: `src/services/template-service.ts` manages `.confucius/templates/` directory. Preset templates auto-created on first use. Placeholder syntax: `{{date}}`, `{{time}}`, `{{title}}`, `{{year}}`, `{{month}}`, `{{day}}`.

**Multi-format import**: `src-tauri/src/import.rs` converts Word/PDF/HTML/EPUB to Markdown via pandoc (preferred) with built-in fallbacks (html2text + docx-rs + zip). Frontend service in `src/services/import-service.ts`.

**File tree**: Built recursively in Rust (async, directory-first sort). Skips empty dirs and dot-prefixed entries. File changes watched via the `notify` Rust crate (500ms debounce). Only one watcher at a time.

## Code style

- **No semicolons** (Prettier `semi: false`)
- **Single quotes**, trailing commas everywhere, 100 char print width
- `@/*` path alias maps to `src/` — configured in both `tsconfig.json` and `vite.config.mts` (must stay in sync)
- TypeScript strict mode: `noUnusedLocals`, `noUnusedParameters`
- ESLint: `no-unused-vars` is warn (not error), unused params prefixed `_` are ignored

## Adding a new Rust command

1. Add the `#[tauri::command]` function in the appropriate module (`src-tauri/src/lib.rs` or sub-module)
2. Register it in the `generate_handler![]` macro at the bottom of `lib.rs`
3. Add a wrapper export in `src/services/bridge.ts` (camelCase name, calls `invoke('snake_case_command_name')`) — or in domain-specific service files (e.g. `import-service.ts`)
4. Add a mock case in `test/setup.ts` (throws `unmocked invoke` on missing commands)

**Naming trap**: Rust commands use `snake_case`, bridge exports use `camelCase`. The `invoke()` string must match the Rust function name exactly.

**serde camelCase**: All Rust types returned via IPC must have `#[serde(rename_all = "camelCase")]` to match frontend TypeScript interfaces. Types read/written to `index.json` must also use camelCase for compatibility with the JS knowledge service.

## Adding a new Rust module

1. Create the module directory under `src-tauri/src/` (e.g. `src-tauri/src/mymod/`)
2. Add `mod.rs` with module declarations and `#[tauri::command]` functions
3. Add `mod mymod;` to `lib.rs`
4. Register commands in `generate_handler![]`
5. Add dependencies to `src-tauri/Cargo.toml` if needed
6. Write `#[cfg(test)]` unit tests in each file

## Testing

- **Framework**: Vitest (jsdom env, globals enabled — no `describe`/`it` imports needed)
- **Setup**: `test/setup.ts` mocks `@tauri-apps/api/core` invoke, `@tauri-apps/api/event` listen, `@tauri-apps/plugin-dialog`, and `window.__exportPreviewHTML__`
- **Coverage threshold**: 70% across branches/functions/lines/statements
- **Test locations**: `src/**/*.{test,spec}.{ts,tsx}`, `test/unit/**`, `test/integration/**`
- **E2E**: Playwright in `test/e2e/`, uses its own Vite dev server on port 5179, injects Tauri IPC mocks via `addInitScript`. Key helpers: `typeInEditor`, `getEditorContent`, `selectAllInEditor`, `dispatchMenuAction` in `test/e2e/helpers.ts`
- **Adding a new Rust command**: Update both `test/setup.ts` (switch-case mock) and `test/e2e/helpers.ts` (if E2E uses it)

## Pitfalls

- `sidebar-store.ts` uses `Set<string>` for `expandedPaths` — careful with serialization/persistence
- `tab-store` directly calls `useEditorStore.getState().setContent()` — modifying one store may require updating the other
- Knowledge base has dual backend with **Rust as default** (unset localStorage or `"rust"`); JS fallback only when localStorage `confucius-knowledge-backend` = `"js"`. JS path calls `knowledge-service.ts` methods directly (no `invoke()`). Rust path uses `invoke('knowledge_init_loaded')` etc. Under Rust backend, `knowledgeSearchFiles`/`knowledgeResolveLink` route to Tantivy `search_text`.
- `readFile()` in bridge strips BOM client-side; `readFileRaw()` does NOT strip BOM
- `search_text` Rust command delegates to Tantivy for non-regex, non-case-sensitive searches. Regex searches still use the old parallel regex scan.
- Tantivy index lives in `.confucius/tantivy/`; knowledge index in `.confucius/index.json`. Both share the same workspace root.
- All file commands reject `..` traversal and null bytes via `sanitize_path()` in Rust
- Vite config file is `vite.config.mts` (not `.ts`)
- AI tooltip uses `WeakMap<Node, EditorView>` to associate DOM elements with CM6 editor views — important for multi-editor scenarios
- `import.rs` uses `html2text` (not `html2md`) for HTML→Markdown; `docx-rs` for Word; `zip` for EPUB; PDF requires pandoc

## Key files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | 22 Rust commands (file I/O, search, watcher, image save, import) |
| `src-tauri/src/knowledge/` | Rust knowledge index engine (parser, indexer, resolver) |
| `src-tauri/src/search/` | Tantivy full-text search (schema, indexer, searcher) |
| `src-tauri/src/import.rs` | Multi-format import (pandoc + crate fallbacks) |
| `src/services/bridge.ts` | IPC wrapper — sole entry point for system operations |
| `src/services/ai-service.ts` | Ollama AI API (streaming generate, health check) |
| `src/services/template-service.ts` | Template system (presets, placeholder expansion) |
| `src/services/import-service.ts` | Import file dialog and conversion |
| `src/hooks/` | Custom hooks (virtual-list, auto-save, session-restore, etc.) |
| `src/editor/cm6-setup.ts` | CM6 extension composition (includes ai-tooltip-plugin) |
| `src/editor/ai-tooltip-plugin.ts` | AI floating menu on text selection |
| `src/services/knowledge-service.ts` | Knowledge base engine (JS fallback) |
| `src/services/theme-service.ts` | Theme switching and persistence |
| `test/setup.ts` | Global Vitest mocks |
| `test/e2e/helpers.ts` | Playwright fixtures and helpers |
