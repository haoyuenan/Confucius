# Status Bar Plus — 外部插件示例

## 功能

在 Confucius 状态栏额外显示：

| 条目 | 位置 | 说明 |
|------|------|------|
| 🕒 系统时间 | 状态栏右侧最左 | HH:mm:ss 格式实时时钟 |
| ⎇ 当前分支 | 状态栏右侧 | 静态显示 `main`（可扩展为实际 Git 检测） |

## 安装

```bash
# 1. 将整个插件目录复制到用户插件目录
mkdir -p ~/.confucius/plugins
cp -r plugins/status-bar-plus ~/.confucius/plugins/

# 2. 在 Confucius 中加载
#    视图 → 插件管理 → 加载插件
#    选择 ~/.confucius/plugins/status-bar-plus/index.js
```

## 卸载

在「插件管理」面板中点击「卸载」按钮，或重启应用。

## 插件开发规范

### 文件结构

```
my-plugin/
├── manifest.json          # 可选，仅用于元数据展示
├── index.js               # 必须，插件入口
└── style.css              # 可选，参考样式
```

### index.js 导出格式

```javascript
// IIFE + UMD 格式，兼容多种加载环境
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory()
  }
})(this, function () {
  return {
    manifest: { id: 'my-plugin', name: '我的插件', version: '1.0.0' },
    onActivate: function (ctx) {
      // ctx 可用 API:
      //   ctx.addStatusBarItem({ id, priority, label })   — 注册状态栏条目
      //   ctx.addSidebarTab({ id, label, icon, component }) — 注册侧边栏面板（需 JSX）
      //   ctx.addStyle(css)            — 注入 CSS
      //   ctx.getContent()             — 获取编辑器内容
      //   ctx.console.log/warn/error   — 日志输出
    },
    onDeactivate: function () { /* 清理资源 */ },
  }
})
```
