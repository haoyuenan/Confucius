# 文档模板插件

一键插入预定义文档模板，支持变量替换。

## 功能特性

- 📝 **5 个内置模板**：README、API 文档、博客文章、周报、会议纪要
- 🔄 **变量替换**：支持 `{{date}}`、`{{title}}`、`{{author}}` 等变量
- 👁️ **实时预览**：选择模板前可先预览内容
- ⚙️ **自定义模板**：支持添加自己的模板
- 💾 **配置持久化**：用户配置自动保存到 localStorage

## 使用方法

### 1. 安装插件

1. 打开 Confucius 编辑器
2. 按 `Ctrl+Shift+I` 打开插件管理器
3. 点击"加载插件"
4. 选择 `plugins/doc-templates` 目录

### 2. 使用模板

1. 在侧边栏切换到"文档模板"标签页
2. 从列表中选择需要的模板
3. 查看预览内容
4. 点击"插入模板"按钮

### 3. 配置变量

在配置区域设置你的作者名称，该信息将用于 `{{author}}` 变量。

## 支持的变量

| 变量 | 说明 | 示例 |
|------|------|------|
| `{{date}}` | 当前日期 | 2026-05-07 |
| `{{time}}` | 当前时间 | 14:30 |
| `{{year}}` | 当前年份 | 2026 |
| `{{month}}` | 当前月份 | 05 |
| `{{day}}` | 当前日期 | 07 |
| `{{title}}` | 当前文件名 | my-project |
| `{{author}}` | 作者名称（从配置读取）| renfy |
| `{{project}}` | 当前项目目录名 | Confucius |
| `{{description}}` | 默认描述 | 项目描述 |
| `{{package}}` | 项目包名 | my-project |
| `{{endpoint}}` | API 端点 | endpoint |
| `{{method}}` | HTTP 方法 | GET |
| `{{path}}` | API 路径 | /api/v1/path |

## 添加自定义模板

1. 点击模板列表下方的"+ 自定义模板"按钮
2. 输入模板名称
3. 输入模板描述
4. 输入模板内容（支持变量）

自定义模板会保存在浏览器的 localStorage 中。

## 模板格式

```markdown
# {{title}}

> {{description}}

作者: {{author}}
日期: {{date}}
```

## 文件结构

```
plugins/doc-templates/
├── manifest.json      # 插件元数据
├── index.js          # 主逻辑
├── templates.json    # 内置模板定义
├── style.css         # 样式文件
└── README.md         # 使用说明
```

## 开发说明

### API 使用

插件通过 `ctx` 对象与宿主应用交互：

```javascript
// 获取编辑器内容
ctx.getContent()

// 获取当前文件路径
ctx.getActiveFilePath()

// 添加侧边栏面板
ctx.addSidebarTab({
  id: 'my-panel',
  label: '我的面板',
  render: () => element
})

// 监听事件
ctx.events.on('file:opened', handler)

// 触发事件
ctx.events.emit('template:insert', { content, template })
```

### 配置存储

插件配置存储在 localStorage 中，key 为 `doc-templates:config`：

```json
{
  "author": "你的名字",
  "defaultTemplate": "readme",
  "customTemplates": []
}
```

## 更新日志

### v1.0.0

- 初始版本发布
- 支持 5 个内置模板
- 支持变量替换
- 支持自定义模板
- 支持配置持久化

## 许可证

MIT © renfy
