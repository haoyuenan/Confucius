# Confucius

> A local Markdown knowledge base editor built with Electron + React + CodeMirror 6, with bidirectional links, knowledge graph, and plugin support

[中文文档](./README.md)

## Screenshot

![Main Window](docs/screenshots/main_window.png)

Split editing mode: CodeMirror 6 editor on the left, markdown-it live preview on the right, status bar at bottom.

## Features

### Three Editing Modes
- **Split View** (split): Source code on the left, instant Markdown rendering on the right (default)
- **WYSIWYG Mode**: Hide syntax markers for headings, bold/italic/strikethrough, inline code, unordered lists, and blockquotes; restore display near cursor
- **Preview Mode**: Full-screen reading with centered layout (`Ctrl+Shift+O`)

### Knowledge Base
- **Bidirectional Links**: `[[note title]]` autocomplete and syntax highlighting, Ctrl+click to navigate
- **Backlinks Panel**: View all notes that reference the current document, including unlinked mentions
- **Tags System**: Inline `#tag` + YAML frontmatter tags, hierarchical tag panel browsing
- **Global Knowledge Graph**: D3.js force-directed graph with global/local modes, drag, zoom, and click-to-navigate
- **Quick Open**: `Ctrl+O` fuzzy search across filenames and titles
- **Daily Notes**: One-click create today's note, auto-archived to `journal/YYYY/MM/YYYY-MM-DD.md` with frontmatter

### Editor
- **Format Toolbar**: Undo/redo, headings, bold/italic/strikethrough, quote/code block/list, link/image/hr/formula/table, focus/typewriter mode
- **Table Insertion**: `` ⊞ `` toolbar button with row/column picker, inserts aligned Markdown table template
- **CodeMirror 6 Core**: High-performance text editing with Markdown syntax highlighting
- **Find & Replace**: `Ctrl+F` search, `Ctrl+Shift+F` replace, F3 next match, auto-highlight all occurrences
- **Code Highlighting**: 33 commonly used languages via highlight.js; unknown languages fall back to auto-detection
- **Math Formulas**: KaTeX rendering for `$...$` inline and `$$...$$` block formulas
- **Diagram Support**: Mermaid flowcharts, sequence diagrams, Gantt charts, etc.
- **GFM Compatible**: Task lists, tables, etc.
- **Paste/Drag Images**: Copy or drag image files from file manager into editor — auto-inserts `![name](path)` Markdown syntax
- **URL Paste Auto-Link**: Select text then paste a URL — automatically converts to `[text](url)` link
- **Focus Mode** (F11): Non-active lines semi-transparent
- **Typewriter Mode** (F12): Active line always centered in viewport
- **Context Menu**: Right-click for save/save-as/undo/redo/cut/copy/paste

### File Management
- **Welcome Screen**: Rich zero-state panel with cultural brush-stroke decoration, "Open Folder" and "New Note" quick actions
- **Recent Files**: Auto-tracks last 10 opened files, one-click reopen from welcome screen
- **Quick Toolbar**: New, open, daily note, toggle sidebar, search, theme toggle, export, edit/preview mode, settings
- **File Tree Sidebar**: Browse and open Markdown files within a folder
- **Outline Panel**: Auto-extract heading structure, click to jump in editor and preview (slug-based precision targeting)
- **Global Search**: Cross-file full-text search, 300ms debounce, parallel reading
- **File Operations**: New, open, save, save as, **auto-save** (every 5 seconds)
- **Sidebar Context Menu**: New file/directory, rename, delete
- **Drag & Drop Open**: Drag `.md` / `.markdown` files to app icon to open directly

### View & Appearance
- **Twelve Themes**: 6 light (Plain White, Warm Sun, Cloud, Mint, Tokyo Night Light, Rose Pine Dawn) / 6 dark (Night Black, Deep Sea, Warm Gray, Ink Bamboo, Tokyo Night, Rose Pine), persisted in localStorage, toolbar one-click toggle + dropdown picker with color swatches
- **Command Palette**: `Ctrl+E` opens a fuzzy-search command palette with keyboard navigation, recent command history, and plugin command integration
- **Workspace Session Recovery**: Automatically saves open tabs, sidebar state, cursor position, and theme on changes; restores everything on next launch
- **i18n / Internationalization**: Full zh ↔ en language switching via Settings → General → Language; all UI components, Electron menus, and dialogs update in real time
- **Brand Titlebar**: App name and tagline on the left, toolbar on the right
- **Unified Settings Panel**: General settings (focus/typewriter/hide menu), theme management with swatches, plugin management, shortcut reference, about
- **Resizable Split**: Drag to adjust split width freely
- **Scroll Sync**: Editor and preview scroll percentage synced in split mode
- **Sidebar Paper Texture**: Subtle CSS-generated grain overlay on warm themes

### Export
- **HTML Export**: Generate standalone HTML file with `[[links]]` resolved to hyperlinks
- **PDF Export**: Generate A4 document via Electron printToPDF

### Status Bar & Plugins
- **Status Bar**: Save status (● unsaved / ✓ saved), word count (including selected characters), cursor position (line:col)
- **Plugin System**: Built-in and external plugin support
  - Sandbox execution + command bus
  - Plugins can register status bar entries, sidebar panels, global commands
  - Dependency management (topological sort), event bus, config persistence
  - Plugin management UI (load/unload/enable/disable)
  - TypeScript type definitions
- **Built-in Plugins** (auto-activated on startup):
  - **Doc Templates**: Insert predefined templates (README, API docs, blog, weekly report, meeting notes) with variable substitution
  - **Code Runner**: Run JavaScript/Python code blocks in Markdown and view output instantly
- **Example Plugins** (load via Plugin Manager UI, located in `plugins/`):
  - **Doc Stats**: Real-time word count, reading time, full statistics report in status bar
  - **Writing Aid**: Smart suggestions and writing assistance

### Security
- **XSS Protection**: DOMPurify whitelist filtering
- **Path Validation**: Reject `..` traversal and null byte injection
- **Python Execution Confirmation**: Show code preview dialog before running, user must confirm
- **Encoding Detection**: BOM + jschardet, support UTF-8/GBK/Shift-JIS

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New file |
| `Ctrl+O` | Quick open / search notes |
| `Ctrl+S` | Save file |
| `Ctrl+Shift+S` | Save as |
| `Ctrl+F` | Find in document |
| `Ctrl+E` | Command palette |
| `Ctrl+Shift+F` | Global search |
| `Ctrl+\` | Toggle sidebar |
| `Ctrl+Shift+P` | Toggle editing mode (split ↔ wysiwyg) |
| `Ctrl+Shift+O` | Toggle preview mode |
| `Ctrl+Shift+D` | Create/open today's daily note |
| `Ctrl+Shift+G` | Open knowledge graph |
| `Ctrl+Shift+I` | Plugin manager (Settings → Plugins) |
| `F11` | Focus mode |
| `F12` | Typewriter mode |
| `Ctrl+B` | Bold `**text**` |
| `Ctrl+I` | Italic `*text*` |
| `Ctrl+K` | Insert link |
| `` Ctrl+` `` | Inline code |
| `` Ctrl+Shift+` `` | Code block |
| `Ctrl+Shift+M` | Formula block |
| `Ctrl+Shift+L` | Unordered list |
| `Ctrl+Shift+[` | Quote block |
| `Ctrl+Shift+H` | Export HTML |
| `Ctrl+Shift+E` | Export PDF |

## Quick Start

```bash
# Install dependencies
npm install

# Start development mode (Vite HMR + Electron hot reload)
npm run dev

# Type check
npm run typecheck

# Run unit/integration tests (159 tests)
npm test

# Run E2E tests (requires build first)
npm run build
npm run test:e2e

# Regenerate app icons (after editing build/icons/icon.svg)
npm run icons

# Package installer
npm run pack:win    # Windows .exe
npm run pack:mac    # macOS .dmg
npm run pack:linux  # Linux .AppImage
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Electron 28 |
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite 5 + vite-plugin-electron |
| Editor Core | CodeMirror 6 |
| Markdown Parser | markdown-it + markdown-it-texmath |
| Code Highlighting | highlight.js (33 languages) |
| Math Formulas | KaTeX |
| Diagram Rendering | Mermaid |
| Knowledge Graph | D3.js (d3-force) |
| State Management | Zustand |
| XSS Security | DOMPurify |
| DOM Diffing | morphdom |
| Encoding Detection | jschardet + iconv-lite |
| Testing Framework | Vitest + Playwright |

## Project Structure

```
confucius/
├── electron/                       # Main process (Node.js)
│   ├── main.ts                     # Window, lifecycle, drag & drop
│   ├── menu.ts                     # Native menu
│   ├── preload.ts                  # contextBridge secure API
│   ├── ipc-handlers.ts             # IPC channel registration
│   └── services/
│       ├── file-service.ts         # File read/write (path sanitization)
│       ├── file-watcher.ts         # File change watcher
│       ├── export-service.ts       # HTML/PDF export (wikilink resolution)
│       ├── search-service.ts       # Parallel full-text search
│       ├── knowledge-service.ts    # Knowledge base indexing engine
│       ├── scanner-service.ts      # Plugin directory scanner
│       └── encoding-detector.ts    # Encoding detection
│
├── src/                            # Renderer process (React)
│   ├── main.tsx                    # React entry
│   ├── App.tsx                     # Root component
│   ├── i18n/                       # Internationalization (zh ↔ en)
│   │   ├── i18n-store.ts           # Zustand store + useTranslation hook
│   │   ├── zh.json                 # Chinese translation dict (~200 keys)
│   │   └── en.json                 # English translation dict (~200 keys)
│   ├── components/
│   │   ├── CommandPalette/         # Command palette (Ctrl+E) + Quick open (Ctrl+O)
│   │   ├── Editor/                 # Editor components
│   │   ├── Preview/                # Preview components
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx         # VS Code-style icon bar container
│   │   │   ├── FileTreePanel.tsx   # File tree (welcome screen + recent files)
│   │   │   ├── OutlinePanel.tsx    # Outline (slug-based heading targeting)
│   │   │   ├── SearchPanel.tsx     # Global search
│   │   │   ├── BacklinksPanel.tsx  # Backlinks panel (knowledge base)
│   │   │   ├── TagPanel.tsx        # Tags panel (knowledge base)
│   │   │   └── GraphView.tsx       # Knowledge graph (knowledge base)
│   │   └── Settings/               # Settings panel
│   ├── engine/                     # Plugin engine
│   ├── services/
│   │   ├── command-registry.ts     # Built-in commands + fuzzy search + LRU
│   │   ├── workspace-store.ts      # Session save/restore (localStorage)
│   │   ├── theme-service.ts        # Theme management (12 themes)
│   │   ├── recent-files.ts         # Recent files (localStorage)
│   │   └── electron-bridge.ts      # IPC wrappers
│   ├── stores/                     # Zustand stores (6 stores)
│   │   ├── app-store.ts            # App info, sidebar state
│   │   ├── editor-store.ts         # Editor mode, content, loading state
│   │   ├── sidebar-store.ts        # Sidebar panels, file tree, outline, search
│   │   ├── tab-store.ts            # Tab management
│   │   ├── knowledge-store.ts      # Knowledge base data (backlinks, graph, tags, search)
│   │   └── plugin-store.ts         # Plugin state
│   ├── editor/
│   │   ├── cm6-setup.ts            # CM6 extension composition
│   │   ├── wikilinks-plugin.ts     # [[ autocomplete + syntax highlight + Ctrl+click
│   │   ├── tags-plugin.ts          # # autocomplete
│   │   └── ...                     # Other editor utilities
│   └── styles/                     # CSS styles
│
├── themes/                         # Theme CSS variables (12 themes)
├── plugins/                        # Plugin directory
├── test/                           # Tests (159 unit/integration + E2E)
├── docs/                           # Design docs & screenshots
├── build/                          # App icons
├── package.json
├── vite.config.mts
└── electron-builder.yml
```

## Development Status

All core features are stable and complete. v0.4.0 introduces the **Knowledge Base System**: bidirectional links (`[[wikilinks]]`) with autocomplete and syntax highlighting, backlinks panel, tag system (inline + frontmatter), daily notes, knowledge graph (D3.js force layout), and quick open (Ctrl+O). 159 unit/integration tests passing, CI/CD ready for all three platforms.

## License

MIT
