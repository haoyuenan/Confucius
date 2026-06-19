# Confucius

> A local Markdown knowledge base editor built with Tauri + React + CodeMirror 6, with bidirectional links and knowledge graph

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
- **Backlinks Panel**: View all notes that reference the current document
- **Tags System**: Inline `#tag` + YAML frontmatter tags, hierarchical tag panel browsing
- **Global Knowledge Graph**: D3.js force-directed graph with global/local modes, drag, zoom, and click-to-navigate
- **Quick Open**: `Ctrl+O` fuzzy search across filenames and titles
- **Daily Notes**: One-click create today's note, auto-archived to `journal/YYYY/MM/YYYY-MM-DD.md` with frontmatter
- **Rust Knowledge Engine**: Knowledge base indexing migrated to Rust backend, 1000+ file scan < 3s
- **Tantivy Full-Text Search**: Inverted index search engine replaces linear scanning, sub-100ms search for large vaults

### Editor
- **Format Toolbar**: Undo/redo, headings, bold/italic/strikethrough, quote/code block/list, link/image/hr/formula/table, focus/typewriter mode
- **AI Writing Assistant**: Select text to show AI menu: translate, summarize, rewrite, expand (requires Ollama)
- **Template System**: Create notes from templates (daily, weekly, meeting, reading notes) with `{{date}}` placeholder support
- **Table Insertion**: Toolbar button with row/column picker, inserts aligned Markdown table template
- **CodeMirror 6 Core**: High-performance text editing with Markdown syntax highlighting
- **Find & Replace**: `Ctrl+F` search, `Ctrl+Shift+F` replace, F3 next match, auto-highlight all occurrences
- **Code Highlighting**: 33 commonly used languages via highlight.js
- **Math Formulas**: KaTeX rendering for `$...$` inline and `$$...$$` block formulas
- **Diagram Support**: Mermaid flowcharts, sequence diagrams, Gantt charts, etc.
- **GFM Compatible**: Task lists, tables, etc.
- **Paste/Drag Images**: Copy or drag image files into editor — auto-inserts `![name](path)` Markdown syntax
- **Focus Mode** (F11): Non-active lines semi-transparent
- **Typewriter Mode** (F12): Active line always centered in viewport

### File Management
- **Welcome Screen**: Zero-state panel with one-click "Open Folder" and "New Note" actions
- **Recent Files**: Auto-tracks last 10 opened files, one-click reopen from welcome screen
- **Virtual Scrolling**: File tree and search results handle 10,000+ entries with smooth rendering
- **Multi-Format Import**: Import from Word (.docx), PDF, HTML, EPUB and auto-convert to Markdown (pandoc preferred, built-in fallbacks)
- **Quick Toolbar**: New, open, new note, toggle sidebar, search, import, export, theme toggle, edit/preview mode, settings
- **File Tree Sidebar**: Browse and open Markdown files within a folder
- **Outline Panel**: Auto-extract heading structure, click to jump in editor and preview
- **Global Search**: Cross-file full-text search (Tantivy inverted index engine)
- **File Operations**: New, open, save, save as, **auto-save** (every 5 seconds)
- **Sidebar Context Menu**: New file/directory, rename, delete

### View & Appearance
- **Twelve Themes**: 6 light / 6 dark themes, persisted in localStorage, toolbar one-click toggle + dropdown picker with color swatches
- **Command Palette**: `Ctrl+E` fuzzy-search command palette with keyboard navigation and recent history
- **Workspace Session Recovery**: Auto-saves open tabs, sidebar state, and theme; restores everything on next launch
- **i18n**: Full zh ↔ en language switching, instant across all UI
- **Brand Titlebar**: App name on the left, toolbar on the right
- **Unified Settings Panel**: General settings, theme management, shortcut reference, about
- **Resizable Split**: Drag to adjust split width freely
- **Scroll Sync**: Editor and preview scroll synced in split mode

### Export
- **HTML Export**: Generate standalone HTML file with `[[links]]` resolved to hyperlinks
- **PDF Export**: Via system print dialog (save as PDF)

### Status Bar
- **Status Bar**: Save status, word count (including selected characters), cursor position (line:col)

### Security
- **XSS Protection**: DOMPurify whitelist filtering
- **Path Validation**: Reject `..` traversal and null byte injection

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

# Start development mode (Tauri + Vite HMR)
npm run dev

# Type check
npm run typecheck

# Run unit/integration tests
npm test

# Build production version
npm run build:tauri
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri 2 (Rust + WebView) |
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite 5 + @tauri-apps/cli |
| Editor Core | CodeMirror 6 |
| Markdown Parser | markdown-it + markdown-it-texmath |
| Code Highlighting | highlight.js (33 languages) |
| Math Formulas | KaTeX |
| Diagram Rendering | Mermaid |
| Knowledge Graph | D3.js (d3-force) |
| Full-Text Search | Tantivy (Rust inverted index) |
| Text Conversion | pandoc + html2text + docx-rs |
| State Management | Zustand |
| XSS Security | DOMPurify |
| DOM Diffing | morphdom |
| Backend | Rust (file I/O, search, file watcher, knowledge indexing) |
| Testing Framework | Vitest |

## Project Structure

```
confucius/
├── src-tauri/                      # Tauri Rust backend
│   ├── Cargo.toml                  # Rust dependencies
│   ├── tauri.conf.json             # Tauri configuration
│   ├── capabilities/default.json   # Permission scopes
│   └── src/
│       ├── main.rs                 # Entry point
│       ├── lib.rs                  # Rust commands (file I/O/search/watcher/import)
│       ├── knowledge/              # Knowledge base engine (Rust)
│       │   ├── types.rs            # Data structures
│       │   ├── parser.rs           # wikilinks/tags/frontmatter parser
│       │   ├── indexer.rs          # Full & incremental indexing
│       │   └── resolver.rs         # Backlinks/graph/tags queries
│       ├── search/                 # Tantivy full-text search
│       │   ├── schema.rs           # Index schema
│       │   ├── indexer.rs          # Index builder
│       │   └── searcher.rs         # BM25 search query
│       └── import.rs               # Multi-format import converter
│
├── src/                            # Frontend (React + TypeScript)
│   ├── main.tsx                    # React entry
│   ├── App.tsx                     # Root component
│   ├── i18n/                       # Internationalization
│   ├── components/
│   │   ├── CommandPalette/         # Command palette + quick open
│   │   ├── Editor/                 # Editor components
│   │   ├── Preview/                # Preview components
│   │   ├── Sidebar/                # Sidebar (file tree/outline/search/backlinks/tags/graph)
│   │   ├── Settings/               # Settings panel
│   │   ├── TemplatePicker.tsx      # Template selection dialog
│   │   ├── AIConfigDialog.tsx      # AI config dialog
│   │   └── DailyNoteButton.tsx     # New note button
│   ├── services/
│   │   ├── bridge.ts               # Tauri IPC wrapper
│   │   ├── command-registry.ts     # Built-in commands + fuzzy search
│   │   ├── knowledge-service.ts    # Knowledge base engine (JS, being phased out)
│   │   ├── theme-service.ts        # Theme management (12 themes)
│   │   ├── template-service.ts     # Template system
│   │   ├── import-service.ts       # Multi-format import service
│   │   ├── ai-service.ts           # Ollama AI service
│   │   └── recent-files.ts         # Recent files tracking
│   ├── stores/                     # Zustand stores (5 stores)
│   ├── editor/                     # CM6 extensions (ai-tooltip, wikilinks, tags, wysiwyg, etc.)
│   ├── hooks/                      # Custom hooks (virtual scrolling, etc.)
│   └── styles/                     # CSS styles
│
├── themes/                         # Theme CSS variables (12 themes)
├── test/                           # Tests
├── docs/                           # Design docs & screenshots
├── package.json
├── vite.config.mts
└── tsconfig.json
```

## Changelog

### v0.7.0

**Knowledge Engine**:
- **Rust Knowledge Index**: New `src-tauri/src/knowledge/` module migrates wikilinks/tags/frontmatter parsing and incremental indexing to Rust, 1000+ file full scan < 3s
- **Tantivy Full-Text Search**: Replaced linear regex scanning with Tantivy inverted index engine, search drops from seconds to milliseconds
- **Dual Backend**: `knowledge-store.ts` supports JS/Rust dual backend switchable via localStorage `confucius-knowledge-backend`

**Editor Enhancements**:
- **AI Writing Assistant**: Select text to show AI menu with translate, summarize, rewrite, expand (requires local Ollama)
- **AI Config Panel**: Configure Ollama endpoint, select model, test connection with one click
- **Template System**: `.confucius/templates/` directory with 4 preset templates (daily/weekly/meeting/reading notes), supports `{{date}}`/`{{title}}` placeholders
- **New Note Button**: DailyNoteButton refactored to a generic template picker

**File Management**:
- **Multi-Format Import**: Import from Word (.docx), PDF, HTML, EPUB and auto-convert to Markdown (pandoc preferred, built-in html2text + docx-rs + zip fallbacks)
- **Virtual Scrolling**: `use-virtual-list` hook, file tree and search results handle 10,000+ entries smoothly

**Performance**:
- 45 Rust unit tests covering knowledge/search modules
- 174 frontend tests, zero type errors and lint violations

### v0.6.0

Image paste management and architecture cleanup:

- **Image paste management**: Ctrl+V screenshots/images → Rust auto-saves to `assets/` → inserts `![](...)`
- **New Rust command**: `save_image_file` — receives base64, decodes, writes to target directory
- **New setting**: Configurable image save path (default: `assets`)
- **File rename**: `electron-bridge.ts` → `bridge.ts`, removing Electron confusion
- **Dead code cleanup**: Removed never-reached return value `2` from `confirmSave`

## Migration from Electron

v0.5.0 migrates from Electron 28 to Tauri 2:

- **Installer size**: ~72 MB (Electron NSIS) → **~8 MB** (Tauri)
- **Memory usage**: ~200 MB → **~60 MB**
- **Startup time**: 1-3 s → **< 1 s**
- **Backend**: Node.js → **Rust**
- **Native menus**: Removed, replaced by web toolbar
- **PDF export**: Electron printToPDF → system print dialog
- **Plugin system**: Removed (engine + external plugins)
- **Encoding detection**: jschardet + iconv-lite → Rust native UTF-8
- **Image paths**: `convertFileSrc` + asset protocol → Rust base64 data URI

## Development Status

v0.7.0 introduces Rust knowledge engine, Tantivy full-text search, AI writing assistant, template system, multi-format import, and virtual scrolling.

## License

MIT
