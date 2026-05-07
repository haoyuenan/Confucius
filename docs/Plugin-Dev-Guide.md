# 插件开发指南

## 快速开始

### 创建你的第一个插件

在 `~/.confucius/plugins/hello/` 目录下创建两个文件：

**manifest.json**
```json
{
  "id": "hello",
  "name": "Hello Plugin",
  "version": "1.0.0",
  "description": "在状态栏显示 Hello 文字"
}
```

**index.js**
```javascript
module.exports = {
  manifest: {
    id: 'hello',
    name: 'Hello Plugin',
    version: '1.0.0',
  },
  onActivate: function (ctx) {
    ctx.addStatusBarItem({
      id: 'hello-label',
      priority: 1,
      component: 'Hello Confucius',
    })
  },
  onDeactivate: function () {
    // 资源自动清理
  },
}
```

重启应用即可在状态栏看到 "Hello Confucius"。

---

## 插件格式

### manifest.json 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | ✅ | 唯一标识符 |
| `name` | ✅ | 显示名称 |
| `version` | ✅ | 语义版本，如 `1.0.0` |
| `apiVersion` | 可选 | 兼容的宿主 API 版本，如 `^1.0.0` |
| `entry` | 可选 | 入口文件，默认 `index.js` |
| `dependencies` | 可选 | 依赖的插件 ID 列表 |
| `permissions` | 可选 | 权限声明 |

### index.js 导出格式

```javascript
module.exports = {
  manifest: { id, name, version, ... },
  onActivate: function (ctx) { /* 注册 UI、监听事件 */ },
  onDeactivate: function () { /* 可选：手动清理 */ },
}
```

---

## API 参考

### ctx — PluginContext

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `ctx.getContent()` | 获取当前编辑器文本 | `string` |
| `ctx.getCursorPosition()` | 获取光标位置 | `{ line, col }` |
| `ctx.getActiveFilePath()` | 当前文件路径 | `string \| null` |
| `ctx.addStatusBarItem(item)` | 添加状态栏条目 | 移除函数 `() => void` |
| `ctx.addSidebarTab(tab)` | 添加侧边栏面板 | 移除函数 `() => void` |
| `ctx.addStyle(css)` | 注入 CSS | 移除函数 `() => void` |
| `ctx.onContentChange(cb)` | 监听内容变化 | 取消函数 `() => void` |
| `ctx.events.on(event, handler)` | 订阅事件 | 取消函数 `() => void` |
| `ctx.console.log/warn/error` | 安全版控制台 | — |

### 事件列表

| 事件名 | 触发时机 | payload |
|--------|---------|---------|
| `file:opened` | 打开文件 | `{ path }` |
| `file:saved` | 保存文件 | `{ path, content }` |
| `editor:content-change` | 编辑器内容变化 | `{ content }` |
| `theme:switched` | 主题切换 | `{ theme }` |
| `mode:switched` | 模式切换 | `{ mode }` |
| `app:ready` | 应用就绪 | — |
| `plugin:activated` | 其他插件激活 | `{ id }` |
| `plugin:deactivated` | 其他插件卸载 | `{ id }` |

---

## 完整示例：字数统计

```javascript
module.exports = {
  manifest: {
    id: 'word-count',
    name: '字数统计',
    version: '1.0.0',
    permissions: ['ui:statusbar'],
  },
  onActivate: function (ctx) {
    var currentContent = ''

    // 监听内容变化
    ctx.onContentChange(function (content) {
      currentContent = content
      updateDisplay()
    })

    // 注册状态栏条目
    ctx.addStatusBarItem({
      id: 'word-count',
      priority: 10,
      component: '字数: 0',
    })

    function updateDisplay() {
      var chineseChars = (currentContent.match(/[\u4e00-\u9fff]/g) || []).length
      var englishWords = currentContent
        .replace(/[\u4e00-\u9fff]/g, ' ')
        .split(/[\s,;.!?()]+/)
        .filter(Boolean).length
      var total = chineseChars + englishWords
      // 状态栏组件通过 addStatusBarItem 的 component 更新
      console.log('字数:', total)
    }
  },
}
```

---

## 最佳实践

- **资源清理**：`addStatusBarItem` / `addSidebarTab` / `addStyle` 返回的移除函数，引擎会在 `deactivate` 时自动调用，无需手动跟踪
- **错误隔离**：`onActivate` 中的异常不会崩溃宿主，但会记录到控制台
- **沙箱限制**：`window`、`document`、`fetch` 等全局 API 不可用；`console`、`Math`、`JSON` 可用
- **持久化配置**：使用 `localStorage` 存储插件配置（key 加插件 ID 前缀防冲突）

---

## 测试插件

### 单元测试（Vitest）

```typescript
// test/unit/engine/dependency-graph.test.ts 示例
import { DependencyGraph, CyclicDependencyError } from '../../src/engine/DependencyGraph'

describe('DependencyGraph', () => {
  test('拓扑排序', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.add('B', [])
    const result = g.resolveOrder(['A', 'B'])
    expect(result.indexOf('B')).toBeLessThan(result.indexOf('A'))
  })

  test('循环依赖抛出异常', () => {
    const g = new DependencyGraph()
    g.add('A', ['B'])
    g.add('B', ['A'])
    expect(() => g.resolveOrder(['A', 'B'])).toThrow(CyclicDependencyError)
  })
})
```

> 当前已有 27 个引擎模块测试用例规划（`EventBus`、`ConfigDB`、`SandboxFactory`、`Scanner`、`HostAPIBridgeImpl`），作为参考开发者可参照编写。

---

## 调试指南

### 打开开发者工具

在应用运行时按以下方式打开开发者工具：

| 快捷键 | 说明 |
|--------|------|
| `F12` | 快速打开开发者工具 |
| `Ctrl + Shift + I` | 备用快捷键 |
| 菜单 → 帮助 → 切换开发者工具 | 图形界面方式 |

开发者工具包含：
- **Console（控制台）**：查看插件日志输出
- **Sources（源代码）**：调试插件代码（需找到沙箱文件）
- **Elements（元素）**：检查 UI 元素

### 查看插件日志

插件中通过 `ctx.console.log()` 输出的日志会显示在开发者工具的 Console 中：

```javascript
module.exports = {
  manifest: { id: 'debug-demo', name: '调试示例', version: '1.0.0' },
  onActivate: function (ctx) {
    // 这些信息会出现在 Console 中
    ctx.console.log('✅ 插件已激活')
    ctx.console.log('当前文件:', ctx.getActiveFilePath())
    ctx.console.log('内容长度:', ctx.getContent().length)
    
    // 使用 warn 和 error 会有不同的颜色标识
    ctx.console.warn('⚠️ 这是一个警告')
    ctx.console.error('❌ 这是一个错误')
  },
}
```

日志输出位置：
```
[插件:debug-demo] ✅ 插件已激活
[插件:debug-demo] 当前文件: /path/to/file.md
[插件:debug-demo] 内容长度: 1523
```

### 调试沙箱内的代码

由于插件运行在沙箱中，调试需要注意以下几点：

**1. 在 Sources 面板定位插件代码**

- 打开开发者工具 → Sources 面板
- 找到 `webpack://` 或 `plugin-sandbox` 相关条目
- 或者在 Console 点击日志右侧的文件链接

**2. 使用 debugger 语句**

```javascript
module.exports = {
  manifest: { id: 'debug-plugin', name: '调试插件', version: '1.0.0' },
  onActivate: function (ctx) {
    ctx.console.log('准备调试')
    
    // 在这里设置断点
    debugger
    
    var content = ctx.getContent()
    ctx.console.log('内容:', content)
  },
}
```

**3. 常见调试技巧**

```javascript
// 技巧 1：打印上下文对象查看可用 API
ctx.console.log('可用 API:', Object.keys(ctx))

// 技巧 2：检查事件触发
ctx.events.on('file:opened', function (payload) {
  ctx.console.log('文件打开事件:', payload)
  debugger // 在这里断点查看 payload
})

// 技巧 3：捕获错误
try {
  // 可疑代码
  ctx.registerCommand('test', function () {
    throw new Error('测试错误')
  })
} catch (e) {
  ctx.console.error('捕获到错误:', e.message, e.stack)
}
```

**4. 沙箱限制说明**

| 可用 | 不可用 | 说明 |
|------|--------|------|
| ✅ `ctx.console` | ❌ `window.console` | 使用安全控制台 |
| ✅ `Math`, `JSON` | ❌ `document` | DOM 操作受限 |
| ✅ `ctx.events` | ❌ `fetch` | 网络请求受限 |
| ✅ `ctx.config` | ❌ `localStorage` | 使用插件配置存储 |

---

## 发布流程

### 插件打包结构

一个完整的插件包应包含以下结构：

```
my-plugin/
├── manifest.json       # 插件元数据（必需）
├── index.js           # 入口文件（必需）
├── style.css          # 样式文件（可选）
├── icon.svg           # 插件图标（可选）
├── README.md          # 使用说明（推荐）
├── LICENSE            # 许可证文件（推荐）
└── assets/            # 资源文件夹（可选）
    ├── images/
    └── fonts/
```

**manifest.json 示例**：

```json
{
  "id": "my-awesome-plugin",
  "name": "我的插件",
  "version": "1.0.0",
  "description": "这是一个示例插件",
  "author": "Your Name",
  "apiVersion": "^1.0.0",
  "entry": "index.js",
  "dependencies": [],
  "permissions": ["ui:statusbar", "editor:content"]
}
```

### 分享方式

**方式 1：本地文件分享**

1. 将插件文件夹打包为 ZIP：
   ```bash
   cd my-plugin
   zip -r ../my-plugin-v1.0.0.zip .
   ```

2. 接收方解压后，通过「插件管理器 → 加载本地插件」选择文件夹

**方式 2：GitHub 分享**

1. 创建 GitHub 仓库
2. 上传插件代码
3. 发布 Release，上传插件 ZIP 包
4. 分享 Release 链接

示例仓库结构：
```
.github/
  └── workflows/
      └── release.yml   # 自动打包工作流（可选）
src/
  └── index.js
dist/                    # 构建输出（通过 CI 生成）
manifest.json
README.md
LICENSE
```

**方式 3：社区插件目录（即将支持）**

```
plugins/community/       # 社区插件目录
├── awesome-plugin-1/
├── awesome-plugin-2/
└── index.json          # 插件索引
```

### 版本管理

**语义化版本规范**（Semantic Versioning）：

| 版本号格式 | 说明 | 示例 |
|------------|------|------|
| `MAJOR.MINOR.PATCH` | 主版本.次版本.修订版 | `1.2.3` |
| `MAJOR` | 不兼容的 API 修改 | 2.0.0 |
| `MINOR` | 向下兼容的功能新增 | 1.3.0 |
| `PATCH` | 向下兼容的问题修复 | 1.2.4 |

**版本更新流程**：

1. **修改 manifest.json 中的 version**
   ```json
   {
     "version": "1.1.0"  // 从 1.0.0 升级
   }
   ```

2. **更新 README.md 的更新日志**
   ```markdown
   ## 更新日志

   ### v1.1.0 (2026-05-07)
   - ✨ 新增：支持自定义快捷键
   - 🐛 修复：状态栏显示问题
   - 📚 文档：添加使用示例

   ### v1.0.0 (2026-05-01)
   - 🎉 初始版本发布
   ```

3. **测试新版本**
   - 卸载旧版本
   - 安装新版本
   - 验证所有功能正常

4. **发布新版本**
   - 创建 Git Tag：`git tag v1.1.0`
   - 推送 Tag：`git push origin v1.1.0`
   - 创建 GitHub Release
   - 上传打包好的 ZIP 文件

---

## 高级示例

### 示例 1：侧边栏面板插件

创建一个侧边栏面板，显示文档大纲：

```javascript
/**
 * 文档大纲插件
 * 在侧边栏显示当前文档的标题结构
 */
module.exports = {
  manifest: {
    id: 'doc-outline',
    name: '文档大纲',
    version: '1.0.0',
    description: '侧边栏显示文档标题大纲',
    permissions: ['ui:sidebar', 'editor:content'],
  },

  onActivate: function (ctx) {
    ctx.console.log('📑 文档大纲插件已激活')

    // 提取标题的函数
    function extractHeadings(content) {
      var headings = []
      var lines = content.split('\n')
      
      lines.forEach(function (line, index) {
        // 匹配 Markdown 标题: ## 标题
        var match = line.match(/^(#{1,6})\s+(.+)$/)
        if (match) {
          headings.push({
            level: match[1].length,
            text: match[2],
            line: index + 1,
          })
        }
      })
      
      return headings
    }

    // 生成大纲 HTML
    function renderOutline() {
      var content = ctx.getContent()
      var headings = extractHeadings(content)
      
      if (headings.length === 0) {
        return '<div class="outline-empty">暂无标题</div>'
      }
      
      var html = '<ul class="outline-list">'
      headings.forEach(function (h) {
        html += '<li class="outline-item outline-level-' + h.level + '" ' +
                'data-line="' + h.line + '">' +
                '<span class="outline-text">' + escapeHtml(h.text) + '</span>' +
                '</li>'
      })
      html += '</ul>'
      return html
    }

    // 转义 HTML
    function escapeHtml(text) {
      var div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    // 添加样式
    ctx.addStyle(
      '.outline-list { list-style: none; padding: 0; margin: 0; }' +
      '.outline-item { padding: 4px 8px; cursor: pointer; border-radius: 4px; }' +
      '.outline-item:hover { background: var(--bg-hover); }' +
      '.outline-level-1 { font-weight: bold; }' +
      '.outline-level-2 { padding-left: 16px; }' +
      '.outline-level-3 { padding-left: 32px; font-size: 0.9em; }' +
      '.outline-level-4 { padding-left: 48px; font-size: 0.85em; }' +
      '.outline-level-5, .outline-level-6 { padding-left: 64px; font-size: 0.8em; color: var(--text-secondary); }' +
      '.outline-empty { padding: 20px; text-align: center; color: var(--text-secondary); }'
    )

    // 添加侧边栏面板
    ctx.addSidebarTab({
      id: 'outline-panel',
      label: '大纲',
      icon: '📑',
      render: renderOutline,
    })

    // 监听内容变化，更新大纲
    ctx.onContentChange(function () {
      // 重新渲染面板
      // 注意：实际实现中面板会自动刷新
      ctx.console.log('内容变化，大纲已更新')
    })

    // 监听点击事件，跳转到对应行
    document.addEventListener('click', function (e) {
      var item = e.target.closest('.outline-item')
      if (item) {
        var line = parseInt(item.dataset.line, 10)
        ctx.setCursorPosition({ line: line, col: 1 })
      }
    })
  },
}
```

### 示例 2：快捷键注册示例

注册自定义快捷键执行插件命令：

```javascript
/**
 * 快捷键示例插件
 * 演示如何监听键盘事件和注册命令
 */
module.exports = {
  manifest: {
    id: 'shortcut-demo',
    name: '快捷键示例',
    version: '1.0.0',
    description: '演示快捷键注册和命令',
    permissions: ['editor:content'],
  },

  onActivate: function (ctx) {
    ctx.console.log('⌨️ 快捷键插件已激活')

    // 命令 1：在当前行上方插入分割线
    function insertDivider() {
      var pos = ctx.getCursorPosition()
      ctx.setCursorPosition({ line: pos.line, col: 1 })
      ctx.insertText('---\n', false)
      ctx.console.log('✅ 分割线已插入')
    }

    // 命令 2：复制当前行
    function duplicateLine() {
      var content = ctx.getContent()
      var lines = content.split('\n')
      var pos = ctx.getCursorPosition()
      var lineIndex = pos.line - 1
      
      if (lineIndex >= 0 && lineIndex < lines.length) {
        var line = lines[lineIndex]
        lines.splice(lineIndex + 1, 0, line)
        ctx.setContent(lines.join('\n'))
        ctx.setCursorPosition({ line: pos.line + 1, col: pos.col })
      }
    }

    // 命令 3：转换为标题
    function makeHeading() {
      var selection = ctx.getSelection()
      if (selection) {
        ctx.wrapSelection('## ', '')
      } else {
        // 没有选区时，获取当前行
        ctx.insertText('## ', false)
      }
    }

    // 注册命令
    ctx.registerCommand('insert-divider', '插入分割线', insertDivider)
    ctx.registerCommand('duplicate-line', '复制当前行', duplicateLine)
    ctx.registerCommand('make-heading', '转换为标题', makeHeading)

    // 监听快捷键（通过 events）
    // 注意：这里使用 DOM 事件监听作为演示
    document.addEventListener('keydown', function (e) {
      // Ctrl + Shift + D：插入分割线
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        insertDivider()
      }
      
      // Ctrl + Shift + C：复制当前行
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault()
        duplicateLine()
      }
      
      // Ctrl + Shift + H：转换为标题
      if (e.ctrlKey && e.shiftKey && e.key === 'H') {
        e.preventDefault()
        makeHeading()
      }
    })

    // 显示通知
    ctx.showNotification(
      '快捷键插件已加载：Ctrl+Shift+D 插入分割线',
      'info',
      5000
    )
  },
}
```

### 示例 3：复杂状态管理示例

实现一个带配置和状态的复杂插件：

```javascript
/**
 * 智能片段插件
 * 管理可复用的文本片段，支持分类和搜索
 */
module.exports = {
  manifest: {
    id: 'smart-snippets',
    name: '智能片段',
    version: '1.0.0',
    description: '管理和插入可复用的文本片段',
    permissions: ['ui:sidebar', 'ui:statusbar', 'editor:content'],
  },

  onActivate: function (ctx) {
    ctx.console.log('📝 智能片段插件已激活')

    // ============ 状态管理 ============
    var state = {
      snippets: [],
      categories: ['常用', '代码', '模板'],
      activeCategory: '常用',
      searchQuery: '',
      isPanelOpen: false,
    }

    // 从配置加载数据
    var savedSnippets = ctx.config.get('snippets', [])
    if (savedSnippets.length > 0) {
      state.snippets = savedSnippets
    } else {
      // 默认片段
      state.snippets = [
        { id: '1', title: 'TODO', content: '- [ ] 待办事项', category: '常用' },
        { id: '2', title: '分割线', content: '---', category: '常用' },
        { id: '3', title: 'JS 函数', content: 'function name() {\n  \n}', category: '代码' },
      ]
      ctx.config.set('snippets', state.snippets)
    }

    // ============ 核心方法 ============

    // 添加片段
    function addSnippet(title, content, category) {
      var snippet = {
        id: Date.now().toString(),
        title: title,
        content: content,
        category: category || '常用',
        created: new Date().toISOString(),
      }
      state.snippets.push(snippet)
      saveSnippets()
      ctx.console.log('✅ 片段已添加:', title)
      return snippet
    }

    // 删除片段
    function removeSnippet(id) {
      state.snippets = state.snippets.filter(function (s) {
        return s.id !== id
      })
      saveSnippets()
      ctx.console.log('🗑️ 片段已删除')
    }

    // 保存到配置
    function saveSnippets() {
      ctx.config.set('snippets', state.snippets)
    }

    // 搜索片段
    function searchSnippets(query) {
      state.searchQuery = query
      if (!query) {
        return state.snippets.filter(function (s) {
          return s.category === state.activeCategory
        })
      }
      return state.snippets.filter(function (s) {
        return s.title.toLowerCase().indexOf(query.toLowerCase()) !== -1 ||
               s.content.toLowerCase().indexOf(query.toLowerCase()) !== -1
      })
    }

    // 插入片段
    function insertSnippet(snippet) {
      ctx.insertText(snippet.content, false)
      ctx.console.log('📋 已插入:', snippet.title)
    }

    // 获取选中内容作为新片段
    function createFromSelection() {
      var selection = ctx.getSelection()
      if (selection) {
        var title = ctx.prompt('片段名称:', '新片段')
        if (title) {
          addSnippet(title, selection, state.activeCategory)
          ctx.showNotification('片段已保存: ' + title, 'success', 3000)
        }
      } else {
        ctx.showNotification('请先选中要保存的内容', 'warning', 3000)
      }
    }

    // ============ UI 渲染 ============

    // 渲染片段列表
    function renderSnippetList() {
      var snippets = searchSnippets(state.searchQuery)
      
      if (snippets.length === 0) {
        return '<div class="snippets-empty">暂无片段</div>'
      }

      var html = '<div class="snippets-list">'
      snippets.forEach(function (s) {
        html += '<div class="snippet-item" data-id="' + s.id + '">' +
                '<div class="snippet-title">' + s.title + '</div>' +
                '<div class="snippet-preview">' + escapeHtml(s.content.substring(0, 50)) + '</div>' +
                '<button class="snippet-delete" data-id="' + s.id + '">×</button>' +
                '</div>'
      })
      html += '</div>'
      return html
    }

    // 渲染分类选择
    function renderCategories() {
      var html = '<div class="snippet-categories">'
      state.categories.forEach(function (cat) {
        var active = cat === state.activeCategory ? ' active' : ''
        html += '<button class="snippet-category' + active + '" data-cat="' + cat + '">' + cat + '</button>'
      })
      html += '</div>'
      return html
    }

    // 转义 HTML
    function escapeHtml(text) {
      var div = document.createElement('div')
      div.textContent = text
      return div.innerHTML
    }

    // ============ 样式 ============
    ctx.addStyle(
      '.snippets-container { padding: 8px; }' +
      '.snippets-toolbar { display: flex; gap: 8px; margin-bottom: 12px; }' +
      '.snippets-toolbar button { flex: 1; padding: 6px; border: 1px solid var(--border-color); background: var(--bg-secondary); cursor: pointer; border-radius: 4px; }' +
      '.snippets-toolbar button:hover { background: var(--bg-hover); }' +
      '.snippet-search { width: 100%; padding: 8px; margin-bottom: 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary); }' +
      '.snippet-categories { display: flex; gap: 4px; margin-bottom: 12px; }' +
      '.snippet-category { padding: 4px 12px; border: 1px solid var(--border-color); background: var(--bg-secondary); cursor: pointer; border-radius: 12px; font-size: 12px; }' +
      '.snippet-category.active { background: var(--accent-color); color: white; border-color: var(--accent-color); }' +
      '.snippets-list { display: flex; flex-direction: column; gap: 8px; }' +
      '.snippet-item { padding: 8px; border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer; position: relative; }' +
      '.snippet-item:hover { background: var(--bg-hover); }' +
      '.snippet-title { font-weight: bold; margin-bottom: 4px; }' +
      '.snippet-preview { font-size: 12px; color: var(--text-secondary); white-space: pre-wrap; }' +
      '.snippet-delete { position: absolute; top: 4px; right: 4px; padding: 2px 6px; background: #ff4444; color: white; border: none; border-radius: 4px; cursor: pointer; opacity: 0; }' +
      '.snippet-item:hover .snippet-delete { opacity: 1; }' +
      '.snippets-empty { text-align: center; padding: 40px; color: var(--text-secondary); }'
    )

    // ============ 注册 UI ============

    // 状态栏条目 - 快速插入
    ctx.addStatusBarItem({
      id: 'snippets-status',
      priority: 5,
      label: '📝 片段',
      tooltip: '点击打开片段面板',
      onClick: function () {
        state.isPanelOpen = !state.isPanelOpen
        // 这里可以触发面板显示
      },
    })

    // 侧边栏面板
    ctx.addSidebarTab({
      id: 'snippets-panel',
      label: '智能片段',
      icon: '📝',
      render: function () {
        var html = '<div class="snippets-container">'
        html += '<div class="snippets-toolbar">'
        html += '<button id="snippet-new">➕ 新建</button>'
        html += '<button id="snippet-from-selection">📋 从选中创建</button>'
        html += '</div>'
        html += '<input type="text" class="snippet-search" placeholder="搜索片段...">'
        html += renderCategories()
        html += renderSnippetList()
        html += '</div>'
        return html
      },
    })

    // ============ 事件绑定 ============

    // 使用事件委托处理点击
    document.addEventListener('click', function (e) {
      // 新建片段
      if (e.target.id === 'snippet-new') {
        var title = ctx.prompt('片段名称:', '')
        if (title) {
          var content = ctx.prompt('片段内容:', '')
          if (content) {
            addSnippet(title, content)
            ctx.showNotification('片段已创建', 'success', 2000)
          }
        }
      }

      // 从选中创建
      if (e.target.id === 'snippet-from-selection') {
        createFromSelection()
      }

      // 切换分类
      if (e.target.classList.contains('snippet-category')) {
        state.activeCategory = e.target.dataset.cat
        // 重新渲染
      }

      // 插入片段
      if (e.target.closest('.snippet-item')) {
        var id = e.target.closest('.snippet-item').dataset.id
        var snippet = state.snippets.find(function (s) {
          return s.id === id
        })
        if (snippet) {
          insertSnippet(snippet)
        }
      }

      // 删除片段
      if (e.target.classList.contains('snippet-delete')) {
        var id = e.target.dataset.id
        if (ctx.confirm('确定要删除这个片段吗？')) {
          removeSnippet(id)
        }
        e.stopPropagation()
      }
    })

    // 搜索输入
    document.addEventListener('input', function (e) {
      if (e.target.classList.contains('snippet-search')) {
        state.searchQuery = e.target.value
        // 重新渲染列表
      }
    })

    ctx.console.log('📚 已加载 ' + state.snippets.length + ' 个片段')
  },
}
```

---

## API 详解

### 编辑器方法

#### `getContent(): string`

获取当前编辑器中的完整 Markdown 内容。

**参数**：无

**返回值**：`string` - 编辑器文本内容

**使用场景**：
- 分析文档结构（如统计字数、提取标题）
- 导出或转换内容
- 实现实时预览

**示例**：
```javascript
var content = ctx.getContent()
var lines = content.split('\n')
ctx.console.log('文档共', lines.length, '行')
```

---

#### `setContent(content: string, options?: { preserveCursor?: boolean }): void`

设置编辑器内容。

**参数**：
- `content`：`string` - 新的文本内容
- `options.preserveCursor`：`boolean` - 是否保持光标位置（默认 true）

**返回值**：无

**使用场景**：
- 批量替换文本
- 插入格式化后的内容
- 模板填充

**示例**：
```javascript
// 简单替换
ctx.setContent('# 新标题\n\n正文内容')

// 保持光标位置
ctx.setContent(newContent, { preserveCursor: true })
```

---

#### `getCursorPosition(): CursorPosition`

获取光标当前位置。

**参数**：无

**返回值**：`CursorPosition` 对象
```typescript
{
  line: number,  // 行号，从 1 开始
  col: number    // 列号，从 1 开始
}
```

**使用场景**：
- 获取当前编辑位置
- 跳转到特定位置时先保存当前位置

**示例**：
```javascript
var pos = ctx.getCursorPosition()
ctx.console.log('光标在第', pos.line, '行，第', pos.col, '列')
```

---

#### `setCursorPosition(position: CursorPosition): void`

设置光标位置。

**参数**：
- `position`：`CursorPosition` - 目标位置

**返回值**：无

**使用场景**：
- 跳转到特定行
- 导航到大纲中的某个位置
- 搜索结果的定位

**示例**：
```javascript
// 跳转到第 10 行开头
ctx.setCursorPosition({ line: 10, col: 1 })
```

---

#### `getSelection(): string`

获取当前选中的文本。

**参数**：无

**返回值**：`string` - 选中的文本，无选择时返回空字符串

**使用场景**：
- 对选中内容进行处理
- 复制选中内容到剪贴板
- 将选中内容保存为片段

**示例**：
```javascript
var selected = ctx.getSelection()
if (selected) {
  ctx.console.log('选中内容:', selected.substring(0, 100) + '...')
}
```

---

#### `insertText(text: string, selectInserted?: boolean): void`

在当前光标位置插入文本。

**参数**：
- `text`：`string` - 要插入的文本
- `selectInserted`：`boolean` - 是否选中插入的文本（默认 false）

**返回值**：无

**使用场景**：
- 插入模板片段
- 插入格式化符号（如 Markdown 语法）
- 自动补全

**示例**：
```javascript
// 插入分割线
ctx.insertText('---\n')

// 插入并选中
ctx.insertText('**粗体文本**', true)
```

---

#### `replaceSelection(text: string): void`

替换当前选中的文本。

**参数**：
- `text`：`string` - 替换后的文本

**返回值**：无

**使用场景**：
- 格式化选中文本
- 替换变量

**示例**：
```javascript
// 将选中的文本加粗
ctx.replaceSelection('**' + ctx.getSelection() + '**')
```

---

#### `wrapSelection(before: string, after: string, defaultText?: string): void`

在选区前后包裹文本。

**参数**：
- `before`：`string` - 选区前插入的文本
- `after`：`string` - 选区后插入的文本
- `defaultText`：`string` - 无选区时插入的默认文本

**返回值**：无

**使用场景**：
- 添加 Markdown 语法（粗体、斜体、代码块等）
- 添加 HTML 标签
- 添加引用符号

**示例**：
```javascript
// 加粗快捷键
ctx.wrapSelection('**', '**', '粗体文本')

// 斜体
ctx.wrapSelection('*', '*')

// 代码块
ctx.wrapSelection('```javascript\n', '\n```', 'code')

// 链接
ctx.wrapSelection('[', '](https://example.com)', '链接文本')
```

---

### UI 扩展方法

#### `addStatusBarItem(item: StatusBarItemDef): () => void`

添加状态栏条目。

**参数**：`StatusBarItemDef` 对象
```typescript
{
  id: string,              // 唯一标识符
  priority: number,        // 优先级（负值靠右，正值靠左）
  label?: string | (() => string),  // 显示文本或函数
  component?: string,      // React 组件字符串（高级）
  onClick?: () => void,    // 点击回调
  tooltip?: string         // 悬停提示
}
```

**返回值**：`() => void` - 调用可移除该条目

**使用场景**：
- 显示实时信息（字数、时间等）
- 提供快捷操作按钮
- 显示插件状态

**示例**：
```javascript
// 静态标签
ctx.addStatusBarItem({
  id: 'my-label',
  priority: 1,
  label: '就绪',
  tooltip: '点击刷新',
  onClick: function () {
    ctx.console.log('点击了状态栏')
  },
})

// 动态标签（每秒更新）
ctx.addStatusBarItem({
  id: 'clock',
  priority: -5,
  label: function () {
    var now = new Date()
    return now.toLocaleTimeString()
  },
})
```

---

#### `addSidebarTab(tab: SidebarTabDef): () => void`

添加侧边栏面板。

**参数**：`SidebarTabDef` 对象
```typescript
{
  id: string,              // 唯一标识符
  label: string,           // 显示标签
  icon?: string,           // 图标
  render: () => string | HTMLElement,  // 渲染函数
  onActivate?: () => void, // 激活回调
  onDeactivate?: () => void // 失活回调
}
```

**返回值**：`() => void` - 调用可移除该面板

**使用场景**：
- 文档大纲
- 文件浏览器
- 自定义工具面板

**示例**：
```javascript
ctx.addSidebarTab({
  id: 'my-panel',
  label: '我的工具',
  icon: '🔧',
  render: function () {
    return '<div>面板内容</div>'
  },
  onActivate: function () {
    ctx.console.log('面板激活')
  },
})
```

---

#### `addStyle(css: string): () => void`

注入 CSS 样式。

**参数**：`css` - CSS 代码字符串

**返回值**：`() => void` - 调用可移除该样式

**使用场景**：
- 自定义插件 UI 样式
- 修改现有元素样式

**示例**：
```javascript
ctx.addStyle(
  '.my-plugin-element { color: red; }' +
  '.my-plugin-button { background: blue; }'
)
```

**注意**：
- 样式会自动添加插件 ID 前缀防止冲突
- 插件卸载时样式自动清除

---

#### `registerCommand(id: string, title: string, callback: () => void): () => void`

注册命令。

**参数**：
- `id`：`string` - 命令唯一标识符
- `title`：`string` - 命令显示标题
- `callback`：`() => void` - 执行回调

**返回值**：`() => void` - 调用可注销命令

**使用场景**：
- 添加可通过命令面板触发的功能
- 与快捷键系统集成

**示例**：
```javascript
ctx.registerCommand('export-to-pdf', '导出为 PDF', function () {
  ctx.console.log('导出中...')
})
```

---

#### `showNotification(message: string, type?: string, duration?: number): void`

显示通知消息。

**参数**：
- `message`：`string` - 消息内容
- `type`：`'info' | 'success' | 'warning' | 'error'` - 类型（默认 'info'）
- `duration`：`number` - 显示时长（毫秒），0 表示不自动关闭

**返回值**：无

**使用场景**：
- 操作成功/失败的反馈
- 重要信息提示

**示例**：
```javascript
ctx.showNotification('保存成功', 'success', 3000)
ctx.showNotification('发生错误', 'error', 5000)
```

---

#### `confirm(message: string): boolean`

显示确认对话框。

**参数**：`message` - 确认消息

**返回值**：`boolean` - 用户是否确认

**示例**：
```javascript
if (ctx.confirm('确定要删除吗？')) {
  // 执行删除
}
```

---

#### `prompt(message: string, defaultValue?: string): string | null`

显示输入对话框。

**参数**：
- `message` - 提示消息
- `defaultValue` - 默认值

**返回值**：`string | null` - 用户输入的内容，取消时返回 null

**示例**：
```javascript
var name = ctx.prompt('请输入名称:', '默认值')
if (name) {
  ctx.console.log('输入了:', name)
}
```

---

### 事件系统

#### `events.on(event: string, handler: (payload?: any) => void): () => void`

订阅事件。

**参数**：
- `event`：`string` - 事件名称
- `handler`：`(payload) => void` - 事件处理器

**返回值**：`() => void` - 调用可取消订阅

**示例**：
```javascript
var unsubscribe = ctx.events.on('file:saved', function (payload) {
  ctx.console.log('文件已保存:', payload.path)
})

// 取消订阅
unsubscribe()
```

---

#### `events.emit(event: string, payload?: any): void`

触发自定义事件。

**参数**：
- `event`：`string` - 事件名称
- `payload`：`any` - 事件数据

**返回值**：无

**示例**：
```javascript
// 插件 A
events.emit('my-plugin:data-loaded', { data: [...] })

// 插件 B
events.on('my-plugin:data-loaded', function (payload) {
  ctx.console.log('收到数据:', payload.data)
})
```

---

#### `onContentChange(callback: (content: string) => void): () => void`

监听内容变化（便捷方法）。

**示例**：
```javascript
ctx.onContentChange(function (content) {
  // 内容发生变化
  updateWordCount(content)
})
```

---

### 完整事件列表

| 事件名 | 触发时机 | payload |
|--------|----------|---------|
| `file:opened` | 打开文件 | `{ path: string, name: string }` |
| `file:saved` | 保存文件 | `{ path: string, content: string }` |
| `file:closed` | 关闭文件 | `{ path: string }` |
| `file:created` | 创建新文件 | `{ path: string }` |
| `file:deleted` | 删除文件 | `{ path: string }` |
| `file:renamed` | 重命名文件 | `{ oldPath: string, newPath: string }` |
| `editor:content-change` | 编辑器内容变化 | `{ content: string }` |
| `editor:cursor-change` | 光标位置变化 | `{ position: { line, col } }` |
| `editor:selection-change` | 选区变化 | `{ selection: { anchor, head, text } }` |
| `editor:mode-change` | 编辑器模式切换 | `{ mode: 'edit' \| 'preview' \| 'split' }` |
| `app:ready` | 应用就绪 | — |
| `app:quit` | 应用退出 | — |
| `theme:switched` | 主题切换 | `{ theme: 'light' \| 'dark' \| 'sepia' }` |
| `window:focus` | 窗口获得焦点 | — |
| `window:blur` | 窗口失去焦点 | — |
| `plugin:activated` | 其他插件激活 | `{ id: string, name: string }` |
| `plugin:deactivated` | 其他插件卸载 | `{ id: string, name: string }` |
| `plugin:error` | 插件出错 | `{ id: string, error: string }` |
| `sidebar:tab-changed` | 侧边栏标签切换 | `{ tabId: string }` |
| `sidebar:toggled` | 侧边栏显示/隐藏 | `{ visible: boolean }` |

---

### 配置存储

#### `config.get<T>(key: string, defaultValue?: T): T | undefined`

获取配置项。

**示例**：
```javascript
var theme = ctx.config.get('theme', 'light')
var snippets = ctx.config.get('snippets', [])
```

---

#### `config.set<T>(key: string, value: T): void`

设置配置项。

**示例**：
```javascript
ctx.config.set('theme', 'dark')
ctx.config.set('lastOpenFile', ctx.getActiveFilePath())
```

---

#### `config.onChange<T>(key: string, handler: (newVal, oldVal) => void): () => void`

监听配置变化。

**示例**：
```javascript
ctx.config.onChange('theme', function (newTheme, oldTheme) {
  ctx.console.log('主题从', oldTheme, '变为', newTheme)
})
```

---

### 权限系统

插件需要在 `manifest.json` 中声明所需权限：

```json
{
  "permissions": [
    "ui:statusbar",
    "ui:sidebar",
    "editor:content",
    "file:read"
  ]
}
```

#### 权限列表

| 权限 | 说明 | 对应 API |
|------|------|----------|
| `ui:statusbar` | 使用状态栏 | `ctx.addStatusBarItem()` |
| `ui:sidebar` | 使用侧边栏 | `ctx.addSidebarTab()` |
| `editor:content` | 访问编辑器内容 | `ctx.getContent()`, `ctx.setContent()` |
| `file:read` | 读取文件 | `ctx.readFile()` |
| `file:write` | 写入文件 | `ctx.writeFile()` |
| `clipboard:read` | 读取剪贴板 | `ctx.readClipboard()` |
| `clipboard:write` | 写入剪贴板 | `ctx.writeClipboard()` |
| `notification` | 发送通知 | `ctx.showNotification()` |
| `command:exec` | 执行外部命令 | （预留）|

**未声明权限的 API 调用会抛出错误**。

---

## 类型支持

### TypeScript 类型定义

插件开发可使用类型文件获得智能提示：

**1. 创建 jsconfig.json**：

```json
{
  "compilerOptions": {
    "checkJs": true,
    "typeRoots": ["./types"]
  },
  "include": ["index.js"]
}
```

**2. 在插件文件开头添加类型引用**：

```javascript
/// <reference path="../types/plugin.d.ts" />

module.exports = {
  manifest: { id: 'my-plugin', name: '我的插件', version: '1.0.0' },
  onActivate: function (ctx) {
    // 现在 ctx 会有完整的类型提示
    ctx.getContent() // Ctrl+点击可跳转到类型定义
  },
}
```

**3. 类型文件位置**：

```
plugins/
├── types/
│   └── plugin.d.ts    # 类型定义文件
├── my-plugin/
│   ├── index.js
│   └── jsconfig.json  # 类型配置
```

类型文件包含：
- `PluginManifest` - 插件清单类型
- `PluginContext` - 完整上下文 API 类型
- `StatusBarItemDef`, `SidebarTabDef` - UI 组件类型
- `AppEvents` - 所有可用事件的类型定义
- `definePlugin()` - 插件定义辅助函数

---

## 故障排除

### 常见问题

**Q: 插件无法加载**

检查清单：
- [ ] `manifest.json` 中 `id` 是否唯一
- [ ] `index.js` 是否存在语法错误
- [ ] 是否导出正确的对象格式
- [ ] 插件文件夹是否在正确位置

**Q: 样式不生效**

可能原因：
- CSS 选择器错误
- 样式被其他样式覆盖
- 使用了沙箱内不可用的选择器

**Q: 事件监听不工作**

检查：
- 事件名称拼写是否正确
- 是否在沙箱内使用 `document.addEventListener`
- 事件是否实际被触发

**Q: 配置保存失败**

可能原因：
- 未正确调用 `ctx.config.set()`
- 存储数据超过 localStorage 限制（约 5MB）
- 存储了无法序列化的对象

---

## 参考资源

- [插件类型定义](../plugins/types/plugin.d.ts) - 完整类型定义
- [示例插件](../plugins/) - 官方示例插件
- [设计文档](specs/2026-05-07-plugin-ecosystem-enhancement-design.md) - 架构设计