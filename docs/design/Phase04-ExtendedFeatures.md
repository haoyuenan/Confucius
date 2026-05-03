# 第四阶段详细设计：扩展功能与主题定制

**计划周期**：第 11-13 周  
**阶段目标**：实现 HTML/PDF 导出功能，构建动态 CSS 主题切换系统，集成 Mermaid 图表渲染。

---

## 1. 模块总览

```
Phase 4 功能矩阵
┌────────────────────────────────────────────────────┐
│                    渲染进程                          │
│                                                     │
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │ 导出模块    │  │ 主题系统    │  │ 图表渲染      │ │
│  │            │  │            │  │              │ │
│  │ 导出为 HTML│  │ 主题选择器  │  │ Mermaid 解析  │ │
│  │ 导出为 PDF │  │ CSS 变量   │  │ SVG/Canvas   │ │
│  │ 打印       │  │ 主题切换   │  │ 交互式图表   │ │
│  └──────┬─────┘  └─────┬──────┘  └──────┬───────┘ │
└─────────┼──────────────┼─────────────────┼────────┘
          │ IPC           │ IPC             │ IPC
          ▼               ▼                 ▼
┌────────────────────────────────────────────────────┐
│                主进程 (Node.js)                      │
│  ┌──────────────┐  ┌──────────────┐               │
│  │ ExportService│  │ ThemeService │               │
│  │ - PDF(puppe)│  │ - 读取主题   │               │
│  │ - HTML direct│  │ - 切换主题   │               │
│  └──────────────┘  └──────────────┘               │
└────────────────────────────────────────────────────┘
```

---

## 2. 导出功能

### 2.1 导出架构设计

```
用户触发导出
     │
     ▼
选择导出格式
     │
     ├── HTML ──── 路线 A：直接生成 HTML 文件
     │             - 使用 markdown-it 渲染为 HTML
     │             - 嵌入 CSS 样式
     │             - 直接写入 .html 文件
     │
     └── PDF ───── 路线 B：通过打印/渲染引擎
                   - 方案 1：Electron 的 printToPDF API
                   - 方案 2：puppeteer 渲染 (更复杂但可控)
                   - 推荐使用方案 1：BrowserWindow.webContents.printToPDF()
```

### 2.2 导出为 HTML

```typescript
// electron/services/export-service.ts
import { dialog, BrowserWindow } from 'electron';
import { writeFile } from 'fs/promises';

export class ExportService {
  async exportHtml(markdownContent: string, win: BrowserWindow): Promise<void> {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'HTML', extensions: ['html'] }],
      defaultPath: 'document.html',
    });
    if (result.canceled || !result.filePath) return;

    // 在渲染进程中完成 markdown→HTML 转换
    // 通过 IPC 获取转换后的 HTML
    const htmlContent = await win.webContents.executeJavaScript(
      `window.__exportPreviewHTML__()`
    );

    // 包裹完整的 HTML 文档
    const fullHtml = this.wrapHtmlDocument(htmlContent);
    await writeFile(result.filePath, fullHtml, 'utf-8');
  }

  private wrapHtmlDocument(bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Document</title>
  <style>
    /* 内嵌所有渲染需要的 CSS */
    ${this.getExportCss()}
  </style>
</head>
<body class="markdown-body">
  ${bodyHtml}
</body>
</html>`;
  }

  private getExportCss(): string {
    // 收集所有需要的 CSS：
    // 1. github-markdown-css
    // 2. highlight.js 主题
    // 3. katex.min.css
    // 4. 自定义表格、代码块等样式
    return `
      /* ... CSS 内容，在构建时从 node_modules 读取或内联 ... */
    `;
  }
}
```

**渲染进程辅助方法**：通过 `window.__exportPreviewHTML__` 暴露获取渲染 HTML 的函数：

```typescript
// 在预览组件挂载时注册
useEffect(() => {
  (window as any).__exportPreviewHTML__ = () => {
    return previewRef.current?.innerHTML || '';
  };
  return () => { delete (window as any).__exportPreviewHTML__; };
}, []);
```

### 2.3 导出为 PDF

```typescript
// electron/services/export-service.ts（续）
export class ExportService {
  async exportPdf(markdownContent: string, win: BrowserWindow): Promise<void> {
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      defaultPath: 'document.pdf',
    });
    if (result.canceled || !result.filePath) return;

    // 获取渲染后的 HTML
    const htmlContent = await win.webContents.executeJavaScript(
      `window.__exportPreviewHTML__()`
    );

    // 打印 PDF（方案一：使用隐藏的 BrowserWindow）
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { offscreen: true },
    });

    const fullHtml = this.wrapHtmlDocument(htmlContent);
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

    const pdfData = await printWindow.webContents.printToPDF({
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
      pageSize: 'A4',
    });

    await writeFile(result.filePath, pdfData);
    printWindow.close();

    // 打开导出的 PDF（可选）
    // shell.openPath(result.filePath);
  }
}
```

### 2.4 导出流程与 UI

**导出按钮位置**：菜单栏"文件 → 导出"子菜单，或工具栏图标。

```typescript
// electron/menu.ts（菜单扩展）
{
  label: '导出',
  submenu: [
    { label: '导出为 HTML...', click: (_, win) =>
      win?.webContents.send('menu:action', 'export:html') },
    { label: '导出为 PDF...', click: (_, win) =>
      win?.webContents.send('menu:action', 'export:pdf') },
  ],
}
```

**导出状态反馈**：
- 导出开始时显示 loading 指示器
- 导出完成后弹出通知（可使用 Electron Notification API）
- 导出失败时显示错误对话框

---

## 3. 主题系统

### 3.1 主题架构

```
主题定义 (themes/)
├── light.css     ← 亮色主题（默认）
├── dark.css      ← 暗色主题
└── sepia.css     ← 护眼主题

主题加载机制：
1. 应用启动时读取用户偏好主题
2. CSS 变量定义主题色值
3. 切换主题时，更新 <html> 的 data-theme 属性
4. CSS 选择器根据 data-theme 切换变量值
```

### 3.2 CSS 变量主题定义

```css
/* themes/light.css */
:root,
[data-theme="light"] {
  /* 背景色 */
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-sidebar: #fafbfc;
  --bg-editor: #ffffff;
  --bg-preview: #ffffff;
  --bg-code: #f6f8fa;

  /* 文字色 */
  --text-primary: #24292e;
  --text-secondary: #586069;
  --text-muted: #959da5;

  /* 边框 */
  --border-color: #e1e4e8;
  --border-divider: #d1d5da;

  /* 强调色 */
  --accent-color: #0366d6;
  --accent-hover: #0256b9;

  /* 代码高亮 */
  --code-highlight-bg: #f6f8fa;
  --code-lang-color: #6a737d;

  /* 表格 */
  --table-border: #dfe2e5;
  --table-header-bg: #f6f8fa;
  --table-row-alt: #f6f8fa;

  /* 滚动条 */
  --scrollbar-bg: transparent;
  --scrollbar-thumb: #c1c1c1;
}
```

```css
/* themes/dark.css */
[data-theme="dark"] {
  --bg-primary: #1e1e1e;
  --bg-secondary: #252526;
  --bg-sidebar: #252526;
  --bg-editor: #1e1e1e;
  --bg-preview: #1e1e1e;
  --bg-code: #2d2d2d;

  --text-primary: #d4d4d4;
  --text-secondary: #9d9d9d;
  --text-muted: #6e6e6e;

  --border-color: #3c3c3c;
  --border-divider: #333333;

  --accent-color: #569cd6;
  --accent-hover: #4d8ac9;

  --code-highlight-bg: #2d2d2d;
  --code-lang-color: #808080;

  --table-border: #3c3c3c;
  --table-header-bg: #2d2d2d;
  --table-row-alt: #2d2d2d;

  --scrollbar-bg: transparent;
  --scrollbar-thumb: #424242;
}
```

### 3.3 主题切换机制

```typescript
// src/services/theme-service.ts
type ThemeName = 'light' | 'dark' | 'sepia';

class ThemeService {
  private currentTheme: ThemeName;

  constructor() {
    // 从 localStorage 读取用户偏好
    this.currentTheme = (localStorage.getItem('theme') as ThemeName) || 'light';
    this.applyTheme(this.currentTheme);
  }

  getCurrentTheme(): ThemeName {
    return this.currentTheme;
  }

  switchTheme(name: ThemeName): void {
    this.currentTheme = name;
    localStorage.setItem('theme', name);
    this.applyTheme(name);
  }

  toggleTheme(): void {
    const next: Record<ThemeName, ThemeName> = {
      light: 'dark',
      dark: 'sepia',
      sepia: 'light',
    };
    this.switchTheme(next[this.currentTheme]);
  }

  private applyTheme(name: ThemeName): void {
    document.documentElement.setAttribute('data-theme', name);
  }
}
```

### 3.4 主题选择 UI

```tsx
// src/components/Settings/ThemeSelector.tsx
function ThemeSelector() {
  const [current, setCurrent] = useState<ThemeName>('light');

  const themes = [
    { id: 'light', label: '亮色', icon: '☀️' },
    { id: 'dark', label: '暗色', icon: '🌙' },
    { id: 'sepia', label: '护眼', icon: '📜' },
  ];

  return (
    <div className="theme-selector">
      {themes.map(t => (
        <button
          key={t.id}
          className={`theme-btn ${current === t.id ? 'active' : ''}`}
          onClick={() => themeService.switchTheme(t.id)}
        >
          <span className="theme-icon">{t.icon}</span>
          <span className="theme-label">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
```

### 3.5 与第三方库主题联动

切换主题时，需要同步更新 highlight.js 和 KaTeX 的主题：

```typescript
// 在 theme-service.ts 中扩展
private applyTheme(name: ThemeName): void {
  document.documentElement.setAttribute('data-theme', name);

  // 动态更换 highlight.js 样式
  const hljsLink = document.getElementById('hljs-theme') as HTMLLinkElement;
  if (hljsLink) {
    hljsLink.href = name === 'dark'
      ? 'highlight.js/styles/atom-one-dark.css'
      : 'highlight.js/styles/github.css';
  }

  // KaTeX 样式不变（使用默认）
}
```

---

## 4. Mermaid 图表渲染

### 4.1 集成方案

```
markdown-it 解析
     │
     ▼
检测到 ```mermaid 代码块
     │
     ▼
不经过 highlight.js 处理，保留原始文本
     │
     ▼
DOM 渲染后，遍历所有 .language-mermaid 的 <code> 块
     │
     ▼
调用 mermaid.render(id, definition) → SVG
     │
     ▼
替换 <pre> 内容为生成的 SVG
```

### 4.2 渲染流程

```typescript
// src/editor/mermaid-renderer.ts
import mermaid from 'mermaid';

// 初始化 Mermaid
mermaid.initialize({
  startOnLoad: false,  // 手动控制渲染
  theme: document.documentElement.getAttribute('data-theme') === 'dark'
    ? 'dark' : 'default',
  securityLevel: 'loose',  // 允许点击链接
  fontFamily: 'sans-serif',
});

/**
 * 在 DOM 中查找并渲染所有 mermaid 图表
 */
export async function renderMermaidDiagrams(container: HTMLElement): Promise<void> {
  const codeBlocks = container.querySelectorAll<HTMLElement>('code.language-mermaid');
  if (codeBlocks.length === 0) return;

  const tasks: Promise<void>[] = [];
  codeBlocks.forEach((codeBlock, index) => {
    const pre = codeBlock.closest('pre');
    if (!pre) return;

    const definition = codeBlock.textContent || '';
    const id = `mermaid-${Date.now()}-${index}`;

    tasks.push(
      mermaid.render(id, definition)
        .then(({ svg }) => {
          // 用 SVG 替换 pre 内容
          pre.innerHTML = svg;
          pre.classList.add('mermaid-rendered');
        })
        .catch(err => {
          // 渲染失败显示错误信息
          pre.innerHTML = `<div class="mermaid-error">图表渲染失败: ${err.message}</div>`;
        })
    );
  });

  await Promise.all(tasks);
}
```

### 4.3 markdown-it 处理

自定义 fence 规则，确保 mermaid 代码块不被 highlight.js 处理：

```typescript
// 在 markdown-it 配置中添加
const defaultFence = md.renderer.rules.fence!;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  const lang = token.info.trim().split(/\s+/g)[0];

  if (lang === 'mermaid') {
    // 直接输出带特殊标记的 pre
    return `<pre class="mermaid-container"><code class="language-mermaid">${md.utils.escapeHtml(token.content)}</code></pre>`;
  }

  return defaultFence(tokens, idx, options, env, self);
};
```

### 4.4 预览区渲染调度

在预览组件中，每次内容更新后触发 Mermaid 渲染：

```tsx
// src/components/Preview/PreviewPane.tsx（升级版）
function PreviewPane({ content }: PreviewPaneProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const html = useMemo(() => renderMarkdown(content), [content]);
  const theme = useThemeStore(s => s.currentTheme);

  // Mermaid 主题跟随切换
  useEffect(() => {
    mermaid.initialize({ theme: theme === 'dark' ? 'dark' : 'default' });
  }, [theme]);

  // 每次 html 更新后渲染 mermaid
  useEffect(() => {
    if (previewRef.current) {
      // 先更新 innerHTML
      previewRef.current.innerHTML = html;
      // 然后渲染图表
      renderMermaidDiagrams(previewRef.current);
      // 最后渲染公式（先图表后公式，避免 DOM 冲突）
      renderMathInElement(previewRef.current, { ... });
    }
  }, [html]);

  return (
    <div
      ref={previewRef}
      className="preview-pane markdown-body"
    />
  );
}
```

### 4.5 图表类型与样式

支持的图表类型及自定义样式：

```css
/* 图表容器 */
.mermaid-container {
  background: var(--bg-code, #f6f8fa);
  border-radius: 6px;
  padding: 16px;
  overflow-x: auto;
  text-align: center;
}

.mermaid-rendered {
  background: transparent;
}
.mermaid-rendered svg {
  max-width: 100%;
  height: auto;
}

.mermaid-error {
  color: #d73a49;
  font-size: 14px;
  padding: 12px;
  border: 1px solid #d73a49;
  border-radius: 4px;
}
```

---

## 5. 组件与文件变更

| 文件路径 | 说明 |
|---------|------|
| `electron/services/export-service.ts` | 导出服务（HTML + PDF） |
| `src/services/theme-service.ts` | 主题服务 |
| `src/components/Settings/ThemeSelector.tsx` | 主题选择器 UI |
| `src/components/Preview/PreviewPane.tsx` | 预览区增强（Mermaid） |
| `src/editor/mermaid-renderer.ts` | Mermaid 渲染器 |
| `src/editor/markdown-renderer.ts` | markdown-it 增强（mermaid fence） |
| `themes/light.css` | 亮色主题变量 |
| `themes/dark.css` | 暗色主题变量 |
| `themes/sepia.css` | 护眼主题变量 |
| `src/styles/global.css` | 全局样式使用 CSS 变量 |
| `src/components/Common/StatusBar.tsx` | 状态栏（显示当前主题、导出按钮） |

---

## 6. 验收标准

| 功能 | 验收条件 |
|------|---------|
| 导出 HTML | 当前文档导出为独立的 .html 文件，样式完整 |
| 导出 PDF | 当前文档导出为 .pdf 文件，排版正确，支持分页 |
| 主题切换 | 可在亮色/暗色/护眼主题间切换，所有 UI 跟随变化 |
| 主题持久化 | 切换的主题在重启应用后保持不变 |
| Mermaid 渲染 | ` ```mermaid ` 代码块正确渲染为 SVG 图表 |
| 图表主题跟随 | 暗色主题下表表面板同步切换为暗色风格 |
| 图表交互 | 支持流程图、时序图、甘特图等常见图表类型 |
| 导出包含图表 | 导出的 HTML/PDF 中图表正确可见 |

---

## 7. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| Mermaid 大图渲染性能 | 预览区卡顿 | 限制图表最大尺寸，使用 `requestIdleCallback` 延迟渲染非可见区域 |
| PDF 导出中文乱码 | 导出文件不可用 | 确保系统中文字体可用，或在 HTML 中嵌入 web-safe 中文字体 |
| 主题切换闪烁 | 视觉体验差 | CSS 变量切换使用 `transition` 平滑过渡、使用 `prefers-color-scheme` 检测系统主题 |
| Mermaid 版本兼容 | 图表语法不兼容 | 锁定 Mermaid 版本，并添加版本号到配置文件中 |
| 导出无图表内容 | 导出遗漏 | 导出前确保所有 Mermaid 图表渲染完成（`await` 所有 Promise） |

---

## 8. 扩展性设计

主题系统预留插件式主题加载机制：

```typescript
// themes/theme-loader.ts
interface ThemeDefinition {
  name: string;
  label: string;
  cssFile: string;      // 主题 CSS 文件路径
  highlightJsTheme: string; // 对应 highlight.js 主题
  mermaidTheme: 'default' | 'dark' | 'neutral' | 'forest';
}

// 用户自定义主题存放目录
// %USERDATA%/confucius/themes/*.css
// 应用启动时扫描并加载
```
