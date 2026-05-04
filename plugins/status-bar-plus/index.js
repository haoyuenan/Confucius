/**
 * status-bar-plus — 外部插件示例
 *
 * 格式规范：
 * - 纯 JavaScript（无 JSX / TypeScript）
 * - 通过 module.exports 导出 plugin 对象
 * - 通过 ctx.addStatusBarItem() 注册状态栏条目
 * - 通过 ctx.addStyle() 注入自定义样式（可选）
 * - 使用 ctx.console.log/warn/error 输出日志（沙箱安全版）
 *
 * 安装方式：
 * 1. 复制整个 plugins/status-bar-plus/ 目录到 ~/.confucius/plugins/
 * 2. 在主菜单中选择「插件管理 → 加载插件」
 * 3. 选择 index.js 文件
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory()
  } else {
    root.StatusBarPlusPlugin = factory()
  }
})(this, function () {

  // ── 工具函数 ──
  var _timeId = null
  var _gitLabel = ''
  var _clockLabel = ''

  function formatTime(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds())
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n }

  // ── 插件实例 ──
  var plugin = {
    manifest: {
      id: 'status-bar-plus',
      name: '状态栏增强',
      version: '1.0.0',
      description: '在状态栏显示系统时间和模拟 Git 分支信息',
    },

    onActivate: function (ctx) {
      ctx.console.log('状态栏增强插件已激活')

      // 1) 系统时钟（动态标签）
      var clockCleanup = ctx.addStatusBarItem({
        id: 'clock',
        priority: -5,
        label: function () {
          return formatTime(new Date())
        },
      })

      // 2) 模拟 Git 分支（静态标签）
      var gitCleanup = ctx.addStatusBarItem({
        id: 'git-branch',
        priority: -3,
        label: 'main',
      })

      // 3) 注入样式
      var styleCleanup = ctx.addStyle(
        '.status-item#clock { font-family: "SF Mono", "Fira Code", "Consolas", monospace !important; }' +
        '.status-item#git-branch { color: #f66a0a !important; }'
      )

      // 每 30 秒模拟刷新一次 Git 信息
      _timeId = setInterval(function () {
        ctx.console.log('状态栏增强: 定时刷新...')
      }, 30000)

      // 保存清理函数
      plugin._cleanups = [clockCleanup, gitCleanup, styleCleanup]
    },

    onDeactivate: function () {
      if (_timeId) clearInterval(_timeId)
      if (plugin._cleanups) {
        plugin._cleanups.forEach(function (fn) { fn() })
        plugin._cleanups = []
      }
    },

    _cleanups: [],
  }

  return plugin
})
