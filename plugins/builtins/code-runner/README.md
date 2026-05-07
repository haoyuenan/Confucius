# 代码运行器插件 (Code Runner)

在 Markdown 预览中直接运行代码块，支持 JavaScript 和 Python。

## 功能特性

- ▶️ **一键运行** - 在代码块右上角点击运行按钮即可执行代码
- 🐍 **Python 支持** - 通过系统 Python 解释器执行 Python 代码
- 🟨 **JavaScript 支持** - 在渲染进程沙箱中安全执行 JS 代码
- ⚙️ **灵活配置** - 自定义 Python 路径、超时时间等参数
- 🎨 **主题适配** - 支持亮/暗/Sepia 三种主题
- 🛑 **安全执行** - JavaScript 在沙箱中运行，Python 通过 IPC 调用

## 安装方法

1. 打开 Confucius 编辑器
2. 进入 **帮助 → 插件管理** (快捷键 `Ctrl+Shift+I`)
3. 点击 **加载插件**
4. 选择本插件目录 `plugins/code-runner/`
5. 完成！代码块右上角将出现运行按钮

## 使用方法

### 运行代码

在 Markdown 中编写代码块：

<pre>
```javascript
console.log("Hello, World!");
const sum = 1 + 2;
console.log("Sum:", sum);
```

```python
print("Hello from Python!")
for i in range(3):
    print(f"Count: {i}")
```
</pre>

点击代码块右上角的 **▶ 运行** 按钮即可执行代码。

### 查看输出

执行结果会显示在代码块下方：
- **绿色背景** - 执行成功
- **红色背景** - 执行出错
- 包含标准输出、标准错误、退出码和执行耗时

## 配置说明

打开侧边栏的「代码运行器」面板，可以配置以下选项：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| Python 解释器路径 | Python 可执行文件路径或命令 | `python` |
| 超时时间 | 代码执行超时时间（毫秒） | `30000` (30秒) |
| 显示退出码 | 是否在输出中显示 exit code | 启用 |
| 显示执行耗时 | 是否在输出中显示执行时间 | 启用 |
| 自动滚动 | 执行后是否自动滚动到输出区域 | 启用 |

### Python 路径配置

如果系统中 Python 命令不是 `python`，请修改路径：

- Windows: `C:\Python39\python.exe` 或 `py`
- macOS/Linux: `python3` 或 `/usr/bin/python3`

## 示例

### JavaScript 示例

```javascript
// 计算斐波那契数列
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

console.log("斐波那契数列前10项:");
for (let i = 0; i < 10; i++) {
  console.log(`F(${i}) = ${fibonacci(i)}`);
}
```

### Python 示例

```python
# 简单的数据处理
data = [1, 2, 3, 4, 5]
squared = [x**2 for x in data]
print("原始数据:", data)
print("平方后:", squared)
print("平均值:", sum(data) / len(data))
```

## 安全说明

⚠️ **安全警告**

### JavaScript 执行
- 在渲染进程的沙箱环境中执行
- 无法访问文件系统、网络或 Node.js API
- 仅允许使用标准 JavaScript 功能和 `console.log`/`console.error`

### Python 执行
- 通过主进程调用系统 Python 解释器
- **具有完整的系统访问权限**（文件读写、网络请求等）
- 仅在您信任的环境中运行 Python 代码

### 建议
- 不要运行来源不明的代码
- 避免执行可能破坏系统的命令
- 敏感环境请谨慎使用 Python 运行功能

## 技术实现

### 架构

```
┌─────────────────────────────────────────┐
│           渲染进程 (Renderer)           │
│  ┌─────────────────────────────────────┐│
│  │         代码运行器插件               ││
│  │  ┌──────────────┐  ┌──────────────┐ ││
│  │  │  JavaScript  │  │    Python    │ ││
│  │  │   沙箱执行    │  │  IPC 调用     │ ││
│  │  │  new Function │  │              │ ││
│  │  └──────────────┘  └──────┬───────┘ ││
│  │                           │         ││
│  └───────────────────────────┼─────────┘│
└───────────────────────────────┼─────────┘
                                │ IPC
┌───────────────────────────────┼─────────┐
│           主进程 (Main)        │        │
│  ┌────────────────────────────┴───────┐│
│  │    child_process.spawn()           ││
│  │         Python 执行                 ││
│  └────────────────────────────────────┘│
└────────────────────────────────────────┘
```

### 文件说明

| 文件 | 说明 |
|------|------|
| `manifest.json` | 插件清单文件 |
| `index.js` | 插件主逻辑，UI 渲染和事件处理 |
| `runner.js` | 执行引擎，包含 JS/Python 执行逻辑 |
| `style.css` | UI 样式定义（已通过 JS 动态注入） |
| `README.md` | 使用说明文档 |

## 故障排除

### Python 无法运行

1. 检查 Python 是否已安装：`python --version`
2. 确认 Python 路径配置正确
3. 尝试使用完整路径，如 `C:\Python39\python.exe`
4. 检查代码是否有语法错误

### JavaScript 执行无输出

- 确保使用 `console.log()` 而不是直接返回值
- 检查浏览器控制台是否有错误

### 超时问题

- 长时间运行的代码会被强制终止
- 可以在配置中增加超时时间
- 复杂计算建议使用本地开发环境

## 更新日志

### v1.0.0
- ✅ 初始版本
- ✅ JavaScript 沙箱执行
- ✅ Python IPC 调用执行
- ✅ 超时控制
- ✅ 配置管理
- ✅ 主题适配

## 许可证

MIT License

## 作者

renfy
