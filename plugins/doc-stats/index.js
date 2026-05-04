/**
 * 文档统计插件
 *
 * 安装：帮助 → 插件管理 (Ctrl+Shift+I) → 加载插件 → 选择此文件
 *
 * 格式说明：
 * - 纯 JavaScript，无 IIFE 包装
 * - 直接通过 module.exports 导出插件对象
 * - 由 PluginManager.new Function() 沙箱执行
 */

module.exports = {
  manifest: {
    id: 'doc-stats',
    name: '文档统计',
    version: '1.0.0',
    description: '状态栏显示字数/阅读时间，点击查看完整报告',
    author: 'Confucius Example',
  },

  onActivate: function (ctx) {
    ctx.console.log('📊 文档统计插件已激活')

    // 字数统计显示（动态更新）
    ctx.addStatusBarItem({
      id: 'ds-words',
      priority: 8,
      label: function () {
        var s = countStats(ctx.getContent())
        return '📝 ' + (s.words).toLocaleString() + ' 字'
      },
    })

    // 阅读时间显示（动态更新）
    ctx.addStatusBarItem({
      id: 'ds-readtime',
      priority: -8,
      label: function () {
        var s = countStats(ctx.getContent())
        return '⏱ ' + s.readTime + ' 分钟'
      },
    })

    // 点击统计条目 → 控制台输出完整报告
    var handler = function (e) {
      var el = e.target
      if (el && el.closest && el.closest('.status-item')) {
        var text = el.closest('.status-item').textContent || ''
        if (text.indexOf('📝') !== -1) {
          var s = countStats(ctx.getContent())
          ctx.console.log('')
          ctx.console.log('╔══════════════════════╗')
          ctx.console.log('║   文档统计报告        ║')
          ctx.console.log('╚══════════════════════╝')
          ctx.console.log('  字数:         ' + s.words.toLocaleString())
          ctx.console.log('  字符(含空格):  ' + s.chars.toLocaleString())
          ctx.console.log('  字符(无空格):  ' + s.charsNoSpace.toLocaleString())
          ctx.console.log('  行数:         ' + s.lines.toLocaleString())
          ctx.console.log('  段落:         ' + s.paragraphs.toLocaleString())
          ctx.console.log('  阅读时间:     约 ' + s.readTime + ' 分钟')
          ctx.console.log('')
        }
      }
    }
    document.addEventListener('click', handler)

    // 保存清理函数
    this._cleanups = [function () { document.removeEventListener('click', handler) }]
  },

  onDeactivate: function () {
    if (this._cleanups) {
      this._cleanups.forEach(function (fn) { fn() })
      this._cleanups = []
    }
  },

  _cleanups: [],
}

// ── 统计引擎（独立函数）──
function countStats(text) {
  var chars = text.length
  var charsNoSpace = text.replace(/\s/g, '').length
  var chinese = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length
  var english = text
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/[\s,;.!?()\[\]{}"'':：；。！？（）【】“”]+/)
    .filter(Boolean).length
  var words = chinese + english
  var lines = text.split('\n').length
  var paragraphs = text.split(/\n\s*\n/).filter(function (p) { return p.trim() }).length
  var readTime = Math.max(1, Math.ceil(words / 300))
  return { chars: chars, charsNoSpace: charsNoSpace, words: words, lines: lines, paragraphs: paragraphs, readTime: readTime }
}
