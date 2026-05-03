# 第一阶段详细设计：基础框架与环境搭建

**计划周期**：第 1-2 周  
**阶段目标**：完成 Electron + React + TypeScript 项目初始化，搭建主进程与渲染进程通信框架，配置开发环境热重载与基础打包能力。

---

## 1. 技术选型确认

| 层级 | 选型 | 版本 | 理由 |
|------|------|------|------|
| 桌面框架 | Electron | ^28.x | 成熟生态，VSCode/Typora 同源，社区资源丰富 |
| 前端框架 | React + TypeScript | React ^18.x | 组件化开发，类型安全 |
| 构建工具 | Vite | ^5.x | 极速 HMR，ESM 原生支持 |
| 编辑器内核 | CodeMirror 6 | ^6.x | 高性能、模块化、可深度定制 |
| 打包工具 | electron-builder | ^24.x | 跨平台打包，支持自动更新 |
| CSS 方案 | CSS Modules + CSS Variables | — | 作用域隔离 + 运行时主题切换 |

> **注意**：Architecture.md 中提到 ProseMirror/CodeMirror 6 二选一，此处选 **CodeMirror 6** 作为默认方案，因为其性能更优、模块粒度更细，适合渐进式搭建编辑器。

---

## 2. 项目目录结构

```
confucius/
├── electron/                  # 主进程代码
│   ├── main.ts                # 应用入口：窗口创建、生命周期
│   ├── menu.ts                # 原生菜单定义
│   ├── ipc-handlers.ts        # IPC 处理器注册
│   └── preload.ts             # preload 脚本（上下文桥接）
│
├── src/                       # 渲染进程代码（React）
│   ├── App.tsx                # 根组件
│   ├── main.tsx               # React 入口
│   ├── components/            # UI 组件
│   │   ├── Layout/            # 布局组件（侧边栏 + 编辑器区）
│   │   ├── Editor/            # 编辑器相关组件
│   │   ├── Sidebar/           # 侧边栏组件
│   │   └── Common/            # 通用 UI 组件
│   ├── hooks/                 # 自定义 Hooks
│   ├── services/              # 业务服务层
│   ├── stores/                # 状态管理（Zustand/Context）
│   ├── types/                 # TypeScript 类型定义
│   ├── styles/                # 全局样式与主题变量
│   └── utils/                 # 工具函数
│
├── public/                    # 静态资源
├── package.json
├── tsconfig.json
├── vite.config.ts             # Vite 配置（含 Electron 插件）
├── electron-builder.yml       # 打包配置
└── .eslintrc.cjs
```

**设计原则**：
- `electron/` 与 `src/` 严格分离，主进程不依赖渲染进程代码
- `services/` 层封装所有与主进程的 IPC 通信，渲染业务逻辑不直接调用 `window.electronAPI`
- `stores/` 使用 **Zustand** （轻量级状态管理，无 Provider 包裹）

---

## 3. 主进程设计 (`electron/`)

### 3.1 应用入口 (`main.ts`)

```
流程：
  app.whenReady()
    → createMainWindow()
      → new BrowserWindow({...})
        → loadURL(dev) / loadFile(prod)
    → setupMenu()
    → registerIpcHandlers()
```

**关键配置**：
```typescript
// 窗口创建参数
const win = new BrowserWindow({
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,     // 安全：隔离渲染进程
    nodeIntegration: false,     // 安全：禁用 Node 直接访问
  },
});
```

### 3.2 原生菜单 (`menu.ts`)

第一阶段实现固定菜单骨架，包含：
- **文件菜单**：新建、打开、保存、另存为（占位，后续绑定功能）
- **编辑菜单**：撤销、重做、剪切、复制、粘贴（占位）
- **视图菜单**：切换侧边栏、切换开发者工具
- **帮助菜单**：关于

采用 **`Menu.buildFromTemplate()`** 动态构建，后续阶段可通过配置扩展。

### 3.3 IPC 通信协议 (`ipc-handlers.ts`)

定义通道命名规范：
```
<领域>:<动作>
```

| 通道名 | 方向 | 第一阶段实现 | 说明 |
|--------|------|-------------|------|
| `app:get-version` | 渲染→主→渲染 | ✅ | 获取应用版本 |
| `dialog:open-file` | 渲染→主→渲染 | ✅ | 打开文件对话框 |
| `dialog:save-file` | 渲染→主→渲染 | ✅ | 保存文件对话框 |
| `file:read` | 渲染→主→渲染 | ✅ | 读取文件内容 |
| `file:write` | 渲染→主→渲染 | ✅ | 写入文件内容 |

使用 **`ipcMain.handle()` / `ipcRenderer.invoke()`** 模式，保证请求-响应式调用。

### 3.4 Preload 脚本 (`preload.ts`)

通过 `contextBridge.exposeInMainWorld()` 暴露安全的 API 对象：

```typescript
// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  getVersion: () => ipcRenderer.invoke('app:get-version'),
  openFile: () => ipcRenderer.invoke('dialog:open-file'),
  saveFile: () => ipcRenderer.invoke('dialog:save-file'),
  readFile: (path: string) => ipcRenderer.invoke('file:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu:action', (_event, action) => callback(action));
  },
});
```

---

## 4. 渲染进程设计 (`src/`)

### 4.1 应用入口

`main.tsx` → `App.tsx` 采用两层结构：

```tsx
// App.tsx 初始版本
function App() {
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.electronAPI.getVersion().then(setVersion);
  }, []);

  return (
    <div className="app-root">
      <div className="app-titlebar">
        <span>Confucius - {version}</span>
      </div>
      <div className="app-content">
        {/* 第一阶段仅显示 Hello World 与基础布局占位 */}
        <SidebarPlaceholder />
        <EditorPlaceholder />
      </div>
    </div>
  );
}
```

### 4.2 布局结构

采用 CSS Grid 三区布局：

```
┌──────────────────────────┐
│  Title Bar (自定义标题栏)   │
├──────────┬───────────────┤
│ Sidebar  │  Editor Area  │
│ (占位)    │  (占位)       │
│          │               │
└──────────┴───────────────┘
```

侧边栏宽度可拖拽调整，使用 `CSS resize` 或自定义拖拽 Hook。

### 4.3 状态管理初始化

使用 Zustand 创建全局 Store 骨架：

```typescript
interface AppStore {
  // 应用状态
  version: string;
  // 侧边栏状态
  sidebarVisible: boolean;
  sidebarWidth: number;
  // 文件状态（第二阶段填充）
  currentFilePath: string | null;
  isModified: boolean;
  // 动作
  toggleSidebar: () => void;
  setSidebarWidth: (w: number) => void;
}
```

---

## 5. 开发环境配置

### 5.1 Vite 配置

使用 `vite-plugin-electron` 实现主进程 + 渲染进程一体化构建：

```typescript
// vite.config.ts 核心配置
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';

export default defineConfig({
  plugins: [
    react(),
    electron([
      { entry: 'electron/main.ts' },     // 主进程入口
      { entry: 'electron/preload.ts' },  // preload 脚本
    ]),
  ],
});
```

**热重载效果**：
- 渲染进程代码变更 → 即时 HMR（无需刷新窗口）
- 主进程 / preload 变更 → 自动重启 Electron 窗口

### 5.2 开发脚本

```json
{
  "scripts": {
    "dev": "vite",                          // 启动开发服务器
    "build": "vite build",                   // 构建
    "preview": "vite preview",               // 预览构建产物
    "lint": "eslint src/ electron/ --ext .ts,.tsx",
    "typecheck": "tsc --noEmit",
    "pack:win": "electron-builder --win",
    "pack:mac": "electron-builder --mac",
    "pack:linux": "electron-builder --linux"
  }
}
```

### 5.3 ESLint + Prettier

- ESLint 配置：`@typescript-eslint/recommended` + `eslint-plugin-react`
- 集成 Prettier 作为代码格式化器
- 提交前可选使用 `husky + lint-staged`

---

## 6. electron-builder 打包配置

```yaml
# electron-builder.yml
appId: com.confucius.editor
productName: Confucius
directories:
  output: dist-release
files:
  - dist/**/*       # Vite 构建产物
  - electron/**/*   # 主进程编译产物
win:
  target: nsis      # Windows 安装包
  icon: public/icon.ico
mac:
  target: dmg
  icon: public/icon.icns
linux:
  target: AppImage
  icon: public/icon.png
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

---

## 7. 质量验收标准

| 检查项 | 验收条件 |
|--------|---------|
| 项目启动 | `npm run dev` 能正常弹出 Electron 窗口 |
| 热重载 | 修改 React 组件后窗口自动刷新 |
| 主进程热重启 | 修改主进程代码后 Electron 自动重启 |
| 窗口基础功能 | 窗口可正常关闭、最小化、最大化 |
| IPC 通信 | 渲染进程能调用 `getVersion` 获取版本号 |
| 菜单显示 | 原生菜单栏正确显示各菜单项 |
| 打包验证 | `npm run pack:win` 可生成 .exe 安装包 |
| 类型检查 | `npm run typecheck` 无错误 |
| ESLint | `npm run lint` 无严重错误 |

---

## 8. 风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|---------|
| vite-plugin-electron 不兼容最新 Electron 版本 | 开发环境无法启动 | 降级 Electron 或改用 `electron-vite` 替代 |
| contextIsolation 导致 API 调用失败 | 功能不可用 | 确认 preload 中暴露的 API 类型与渲染进程声明一致 |
| Windows/Linux 路径分隔符差异 | 文件操作异常 | 统一使用 `path.join()` 和正斜杠处理路径 |
