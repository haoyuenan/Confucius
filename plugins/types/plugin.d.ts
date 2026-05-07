/**
 * Confucius 插件系统类型定义
 * @version 1.0.0
 * @author Confucius Plugin System
 *
 * 使用方式：
 * 1. 在插件目录创建 jsconfig.json 或 tsconfig.json
 * 2. 添加 {"compilerOptions": {"typeRoots": ["./types"]}}
 * 3. 在插件文件中添加三斜杠指令：/// <reference path="../types/plugin.d.ts" />
 */

/**
 * 插件清单（元数据）
 * 定义在 manifest.json 或 index.js 的 manifest 字段中
 */
interface PluginManifest {
  /** 插件唯一标识符，只能包含小写字母、数字、连字符和下划线 */
  id: string

  /** 显示名称，用于在插件管理器中展示 */
  name: string

  /** 版本号，遵循语义化版本规范（semver），如 "1.0.0" */
  version: string

  /** 插件描述，简要说明功能 */
  description?: string

  /** 作者名称或联系方式 */
  author?: string

  /** 兼容的宿主 API 版本，如 "^1.0.0" */
  apiVersion?: string

  /** 入口文件路径，默认为 "index.js" */
  entry?: string

  /** 依赖的插件 ID 列表 */
  dependencies?: string[]

  /** 权限声明列表 */
  permissions?: Permission[]
}

/**
 * 权限类型
 * 声明插件需要的权限，用于安全管控
 */
type Permission =
  | 'ui:statusbar'    // 使用状态栏
  | 'ui:sidebar'      // 使用侧边栏
  | 'file:read'       // 读取文件
  | 'file:write'      // 写入文件
  | 'editor:content'  // 访问编辑器内容
  | 'clipboard:read'  // 读取剪贴板
  | 'clipboard:write' // 写入剪贴板
  | 'notification'    // 发送通知
  | 'command:exec'    // 执行外部命令

/**
 * 状态栏条目定义
 * 用于在底部状态栏添加自定义内容
 */
interface StatusBarItemDef {
  /** 条目唯一标识符 */
  id: string

  /** 优先级，数值越小越靠右（负值靠右，正值靠左） */
  priority: number

  /** 显示文本，可以是字符串或返回字符串的函数（支持动态更新） */
  label?: string | (() => string)

  /** 可选的 React 组件（高级用法，字符串形式） */
  component?: string

  /** 点击回调函数 */
  onClick?: () => void

  /** 悬停提示文本 */
  tooltip?: string
}

/**
 * 侧边栏面板定义
 * 用于在侧边栏添加自定义功能面板
 */
interface SidebarTabDef {
  /** 面板唯一标识符 */
  id: string

  /** 显示标签文本 */
  label: string

  /** 图标名称或 SVG 字符串（可选） */
  icon?: string

  /**
   * 渲染函数，返回 HTML 字符串
   * 注意：由于沙箱限制，无法直接使用 React 组件
   * 建议使用原生 DOM API 或返回 HTML 字符串
   */
  render: () => string | HTMLElement

  /** 面板激活时的回调 */
  onActivate?: () => void

  /** 面板失活时的回调 */
  onDeactivate?: () => void
}

/**
 * 光标位置
 */
interface CursorPosition {
  /** 行号，从 1 开始 */
  line: number

  /** 列号，从 1 开始 */
  col: number
}

/**
 * 文件信息
 */
interface FileInfo {
  /** 文件绝对路径 */
  path: string

  /** 文件名 */
  name: string

  /** 文件扩展名 */
  extension: string

  /** 是否为目录 */
  isDirectory: boolean

  /** 文件大小（字节） */
  size?: number

  /** 最后修改时间 */
  mtime?: Date
}

/**
 * 编辑器选择范围
 */
interface Selection {
  /** 起始位置 */
  anchor: CursorPosition

  /** 结束位置 */
  head: CursorPosition

  /** 选中的文本内容 */
  text: string
}

/**
 * 事件处理器
 */
type EventHandler<T = any> = (payload: T) => void

/**
 * 事件取消订阅函数
 */
type Unsubscribe = () => void

/**
 * 插件事件总线
 * 用于插件间通信和监听编辑器事件
 */
interface PluginEventBus {
  /**
   * 订阅事件
   * @param event 事件名称
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  on<T = any>(event: string, handler: EventHandler<T>): Unsubscribe

  /**
   * 订阅一次性事件
   * @param event 事件名称
   * @param handler 事件处理器
   * @returns 取消订阅函数
   */
  once<T = any>(event: string, handler: EventHandler<T>): Unsubscribe

  /**
   * 触发自定义事件
   * @param event 事件名称
   * @param payload 事件载荷
   */
  emit<T = any>(event: string, payload?: T): void

  /**
   * 取消订阅
   * @param event 事件名称
   * @param handler 可选，指定处理器，不传则取消该事件所有订阅
   */
  off<T = any>(event: string, handler?: EventHandler<T>): void
}

/**
 * 安全控制台
 * 限制版的 console，仅包含日志方法
 */
interface SafeConsole {
  /** 输出日志信息 */
  log(...args: any[]): void

  /** 输出警告信息 */
  warn(...args: any[]): void

  /** 输出错误信息 */
  error(...args: any[]): void

  /** 信息性日志（与 log 相同） */
  info(...args: any[]): void

  /** 调试日志（仅在开发模式显示） */
  debug?(...args: any[]): void
}

/**
 * 配置存储
 * 用于插件持久化存储配置
 */
interface PluginConfig {
  /**
   * 获取配置项
   * @param key 配置键名
   * @param defaultValue 默认值
   * @returns 配置值
   */
  get<T = any>(key: string, defaultValue?: T): T | undefined

  /**
   * 设置配置项
   * @param key 配置键名
   * @param value 配置值
   */
  set<T = any>(key: string, value: T): void

  /**
   * 批量设置配置
   * @param values 配置对象
   */
  setAll(values: Record<string, any>): void

  /**
   * 删除配置项
   * @param key 配置键名
   */
  remove(key: string): void

  /**
   * 清空所有配置
   */
  clear(): void

  /**
   * 获取所有配置
   * @returns 配置对象
   */
  getAll(): Record<string, any>

  /**
   * 监听配置变化
   * @param key 配置键名
   * @param handler 变化处理器
   * @returns 取消监听函数
   */
  onChange<T = any>(key: string, handler: (newValue: T, oldValue: T) => void): Unsubscribe
}

/**
 * 插件运行时上下文
 * 这是插件与宿主应用交互的主要接口
 */
interface PluginContext {
  /**
   * 安全控制台
   * 插件日志会输出到开发者工具和控制台
   */
  console: SafeConsole

  /**
   * 事件总线
   * 用于监听编辑器事件和插件间通信
   */
  events: PluginEventBus

  /**
   * 插件配置存储
   * 自动以插件 ID 为前缀隔离存储
   */
  config: PluginConfig

  // ============ 编辑器信息 ============

  /**
   * 获取当前编辑器内容
   * @returns Markdown 文本内容
   */
  getContent(): string

  /**
   * 设置编辑器内容
   * @param content 新内容
   * @param options 可选配置
   */
  setContent(content: string, options?: { preserveCursor?: boolean }): void

  /**
   * 获取光标位置
   * @returns 光标行号和列号
   */
  getCursorPosition(): CursorPosition

  /**
   * 设置光标位置
   * @param position 目标位置
   */
  setCursorPosition(position: CursorPosition): void

  /**
   * 获取当前选中的文本
   * @returns 选中的文本内容，无选择时返回空字符串
   */
  getSelection(): string

  /**
   * 设置选区
   * @param anchor 起始位置
   * @param head 结束位置
   */
  setSelection(anchor: CursorPosition, head: CursorPosition): void

  /**
   * 获取当前激活的文件路径
   * @returns 文件路径，无打开文件时返回 null
   */
  getActiveFilePath(): string | null

  /**
   * 获取当前文件信息
   * @returns 文件信息对象，无打开文件时返回 null
   */
  getActiveFile(): FileInfo | null

  /**
   * 监听内容变化
   * 当编辑器内容发生变化时触发回调
   * @param callback 回调函数，接收新内容
   * @returns 取消监听函数
   */
  onContentChange(callback: (content: string) => void): Unsubscribe

  /**
   * 监听选区变化
   * 当选区发生变化时触发回调
   * @param callback 回调函数，接收选区信息
   * @returns 取消监听函数
   */
  onSelectionChange(callback: (selection: Selection) => void): Unsubscribe

  /**
   * 监听光标位置变化
   * 当光标移动时触发回调
   * @param callback 回调函数，接收光标位置
   * @returns 取消监听函数
   */
  onCursorChange(callback: (position: CursorPosition) => void): Unsubscribe

  /**
   * 在光标位置插入文本
   * @param text 要插入的文本
   * @param selectInserted 是否选中插入的文本
   */
  insertText(text: string, selectInserted?: boolean): void

  /**
   * 替换选中的文本
   * @param text 替换后的文本
   */
  replaceSelection(text: string): void

  /**
   * 包裹选中的文本
   * @param before 选区前的文本
   * @param after 选区后的文本
   * @param defaultText 无选区时插入的默认文本
   */
  wrapSelection(before: string, after: string, defaultText?: string): void

  // ============ UI 扩展 ============

  /**
   * 添加状态栏条目
   * 在底部状态栏显示自定义信息
   * @param item 状态栏条目定义
   * @returns 移除函数，调用可删除该条目
   */
  addStatusBarItem(item: StatusBarItemDef): () => void

  /**
   * 添加侧边栏面板
   * 在侧边栏添加自定义功能面板
   * @param tab 侧边栏面板定义
   * @returns 移除函数，调用可删除该面板
   */
  addSidebarTab(tab: SidebarTabDef): () => void

  /**
   * 注入 CSS 样式
   * 动态添加样式到页面，自动添加插件 ID 前缀防止冲突
   * @param css CSS 代码字符串
   * @returns 移除函数，调用可删除该样式
   */
  addStyle(css: string): () => void

  /**
   * 注册命令
   * 添加可执行的命令，可通过快捷键或命令面板触发
   * @param id 命令唯一标识符
   * @param title 命令显示标题
   * @param callback 命令执行回调
   * @returns 注销函数
   */
  registerCommand(id: string, title: string, callback: () => void): () => void

  /**
   * 显示通知消息
   * @param message 消息内容
   * @param type 通知类型
   * @param duration 显示时长（毫秒），0 表示不自动关闭
   */
  showNotification(
    message: string,
    type?: 'info' | 'success' | 'warning' | 'error',
    duration?: number
  ): void

  /**
   * 显示确认对话框
   * @param message 确认消息
   * @returns 用户是否确认
   */
  confirm(message: string): boolean

  /**
   * 显示输入对话框
   * @param message 提示消息
   * @param defaultValue 默认值
   * @returns 用户输入的内容，取消时返回 null
   */
  prompt(message: string, defaultValue?: string): string | null

  // ============ 文件操作 ============

  /**
   * 读取文件内容
   * 需要权限 'file:read'
   * @param path 文件路径
   * @returns 文件内容
   */
  readFile(path: string): string

  /**
   * 写入文件
   * 需要权限 'file:write'
   * @param path 文件路径
   * @param content 文件内容
   */
  writeFile(path: string, content: string): void

  /**
   * 检查文件是否存在
   * @param path 文件路径
   * @returns 是否存在
   */
  fileExists(path: string): boolean

  /**
   * 获取文件列表
   * @param dirPath 目录路径
   * @returns 文件信息列表
   */
  listFiles(dirPath: string): FileInfo[]

  // ============ 剪贴板 ============

  /**
   * 读取剪贴板文本
   * 需要权限 'clipboard:read'
   * @returns 剪贴板内容
   */
  readClipboard(): string

  /**
   * 写入剪贴板
   * 需要权限 'clipboard:write'
   * @param text 文本内容
   */
  writeClipboard(text: string): void
}

/**
 * 插件接口
 * 所有插件必须实现此接口
 */
interface Plugin {
  /** 插件清单 */
  manifest: PluginManifest

  /**
   * 插件激活回调
   * 当插件被加载时调用，用于注册 UI、监听事件等
   * @param ctx 插件上下文
   */
  onActivate?(ctx: PluginContext): void

  /**
   * 插件停用回调
   * 当插件被卸载时调用，用于清理资源
   * 注意：通过 ctx 添加的 UI 元素会自动清理，无需手动处理
   */
  onDeactivate?(): void
}

/**
 * 定义插件的辅助函数
 * 提供类型提示和自动完成支持
 * @param plugin 插件对象
 * @returns 插件对象（原样返回）
 */
declare function definePlugin(plugin: Plugin): Plugin

/**
 * 预设事件列表
 * 这些事件由宿主应用触发，插件可以订阅
 */
interface AppEvents {
  // 文件事件
  'file:opened': { path: string; name: string }
  'file:saved': { path: string; content: string }
  'file:closed': { path: string }
  'file:created': { path: string }
  'file:deleted': { path: string }
  'file:renamed': { oldPath: string; newPath: string }

  // 编辑器事件
  'editor:content-change': { content: string }
  'editor:cursor-change': { position: CursorPosition }
  'editor:selection-change': { selection: Selection }
  'editor:mode-change': { mode: 'edit' | 'preview' | 'split' }

  // 应用事件
  'app:ready': void
  'app:quit': void
  'theme:switched': { theme: 'light' | 'dark' | 'sepia' }
  'window:focus': void
  'window:blur': void

  // 插件事件
  'plugin:activated': { id: string; name: string }
  'plugin:deactivated': { id: string; name: string }
  'plugin:error': { id: string; error: string }

  // 侧边栏事件
  'sidebar:tab-changed': { tabId: string }
  'sidebar:toggled': { visible: boolean }
}

/**
 * 类型化的应用事件订阅（可选）
 * 提供更精确的类型提示
 */
declare function onAppEvent<K extends keyof AppEvents>(
  event: K,
  handler: EventHandler<AppEvents[K]>
): Unsubscribe

// 全局声明，允许在插件文件中使用这些类型
declare global {
  /** 插件上下文（在沙箱执行时注入） */
  const ctx: PluginContext
}

// 导出所有类型（用于 CommonJS/ESM 模块）
export {
  Plugin,
  PluginManifest,
  Permission,
  StatusBarItemDef,
  SidebarTabDef,
  CursorPosition,
  FileInfo,
  Selection,
  EventHandler,
  Unsubscribe,
  PluginEventBus,
  SafeConsole,
  PluginConfig,
  PluginContext,
  AppEvents,
  definePlugin,
  onAppEvent,
}
