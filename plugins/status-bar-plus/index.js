/**
 * 状态栏增强插件
 *
 * 安装：帮助 → 插件管理 (Ctrl+Shift+I) → 加载插件 → 选择此文件
 *
 * 格式说明：直接 module.exports 导出，无 IIFE 包装
 */

module.exports = {
  manifest: {
    id: 'status-bar-plus',
    name: '状态栏增强',
    version: '1.0.1',
    description: '显示系统时钟',
    author: 'Confucius Plugin Example',
  },

  onActivate: function (ctx) {
    ctx.console.log('状态栏增强插件已激活')

    // 系统时钟（每秒更新）
    ctx.addStatusBarItem({
      id: 'clock',
      priority: -5,
      label: function () {
        var now = new Date()
        var h = String(now.getHours()).padStart(2, '0')
        var m = String(now.getMinutes()).padStart(2, '0')
        var s = String(now.getSeconds()).padStart(2, '0')
        return h + ':' + m + ':' + s
      },
    })

    // 注入时钟字体样式
    ctx.addStyle(
      '.status-item:has(#clock) { font-family: "SF Mono", "Fira Code", "Consolas", monospace !important; min-width: 65px; }'
    )
  },

  onDeactivate: function () {},
}
