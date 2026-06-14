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
npm run version:bump -- 0.6.0  # Bump version in package.json + Cargo.toml + tauri.conf.json
```

## Architecture

**Tauri dual-process**. Frontend (React 18 + TypeScript) runs as a webview in `src/`. Backend is Rust in `src-tauri/src/lib.rs`. No Electron/Node.js main process.

**IPC flow**: React component → `src/services/bridge.ts` (the only file that calls `invoke()`) → Rust command → direct `std::fs` operations. Channel naming follows the original Electron IPC: `<domain>:<action>` (e.g. `file:read`, `search:query`).

**State management**: Five Zustand stores in `src/stores/`:
- `app-store.ts` — app info, sidebar toggle/width
- `editor-store.ts` — editor mode (split/wysiwyg/preview), content, loading state
- `sidebar-store.ts` — active tab, root path, file tree, expanded paths, outline, search
- `tab-store.ts` — tab management (open/close/active/modification)
- `knowledge-store.ts` — backlinks, graph data, tags, file search

**Editor pipeline**: Three modes — `split` (dual-pane with draggable divider), `wysiwyg` (single-pane with syntax marker hiding), `preview` (full-screen reading). CM6 extensions composed in `src/editor/cm6-setup.ts`. Key custom extensions: `wikilinks-plugin.ts` (`[[` autocomplete + Ctrl+Click), `tags-plugin.ts` (`#` autocomplete).

**Custom hooks**: `src/hooks/` contains extracted App.tsx logic — `use-keyboard-shortcuts`, `use-session-restore`, `use-auto-save`, `use-menu-actions`, `use-theme-manager`. App.tsx composes these and owns the UI state.

**Theme system**: Twelve CSS files in `themes/` define light/dark mode variables via `html[data-theme='<id>']` selectors. ThemeService manages switching and per-mode memory (localStorage key `confucius-theme`).

**Knowledge base**: `src/services/knowledge-service.ts` is a pure-JS engine (no Rust). Parses `[[wikilinks]]`, `#tags`, and YAML frontmatter. Index stored in `.confucius/index.json`.

**File tree**: Built recursively in Rust (async, directory-first sort). Skips empty dirs and dot-prefixed entries. File changes watched via the `notify` Rust crate (500ms debounce). Only one watcher at a time.

## Code style

- **No semicolons** (Prettier `semi: false`)
- **Single quotes**, trailing commas everywhere, 100 char print width
- `@/*` path alias maps to `src/` — configured in both `tsconfig.json` and `vite.config.mts` (must stay in sync)
- TypeScript strict mode: `noUnusedLocals`, `noUnusedParameters`
- ESLint: `no-unused-vars` is warn (not error), unused params prefixed `_` are ignored

## Adding a new Rust command

1. Add the `#[tauri::command]` function in `src-tauri/src/lib.rs`
2. Register it in the `generate_handler![]` macro at the bottom of `lib.rs`
3. Add a wrapper export in `src/services/bridge.ts` (camelCase name, calls `invoke('snake_case_command_name')`)
4. Add a mock case in `test/setup.ts` (throws `unmocked invoke` on missing commands)

**Naming trap**: Rust commands use `snake_case`, bridge exports use `camelCase`. The `invoke()` string must match the Rust function name exactly.

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
- Knowledge base functions go through JS (knowledge-service.ts), not Rust — no `invoke()` involved
- `readFile()` in bridge strips BOM client-side; `readFileRaw()` does NOT strip BOM
- `search_text` Rust command only searches `.md`/`.markdown` files
- All file commands reject `..` traversal and null bytes via `sanitize_path()` in Rust
- Vite config file is `vite.config.mts` (not `.ts`)

## Key files

| File | Purpose |
|------|---------|
| `src-tauri/src/lib.rs` | All 15 Rust commands (file I/O, search, watcher, image save) |
| `src/services/bridge.ts` | IPC wrapper — sole entry point for system operations |
| `src/hooks/` | Custom hooks extracted from App.tsx |
| `src/editor/cm6-setup.ts` | CM6 extension composition |
| `src/services/knowledge-service.ts` | Knowledge base engine (pure JS) |
| `src/services/theme-service.ts` | Theme switching and persistence |
| `test/setup.ts` | Global Vitest mocks |
| `test/e2e/helpers.ts` | Playwright fixtures and helpers |
