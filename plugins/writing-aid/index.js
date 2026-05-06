/**
 * 写作助手插件
 *
 * 安装：帮助 → 插件管理 (Ctrl+Shift+I) → 加载插件 → 选择此文件
 *
 * 功能：
 * 1. 章节定位 — 状态栏显示光标所在标题层级（面包屑）
 * 2. 待办进度 — 显示 Markdown 复选框完成率
 * 3. 写作增量 — 本次会话净增/减字数
 */

module.exports = {
  manifest: {
    id: 'writing-aid',
    name: '写作助手',
    version: '1.0.0',
    description: '显示当前章节定位、待办进度、本次写作增量',
    author: 'Confucius Plugins',
  },

  onActivate: function (ctx) {
    ctx.console.log('✍️ 写作助手已激活')

    // ── 状态缓存 ──────────────────────────────────
    var headings = []    // { level, title, line }
    var todoTotal = 0
    var todoDone = 0
    var cursorLine = 1
    var baseWords = 0   // 激活时的字数基线
    var currentWords = 0

    // ── 工具函数 ──────────────────────────────────

    /** 统计中文+英文单词数 */
    function countWords(text) {
      if (!text) return 0
      // 中文字符数
      var cjk = text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g)
      var cjkCount = cjk ? cjk.length : 0
      // 英文单词数（去掉 CJK 后按空白分词）
      var noCjk = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
      var words = noCjk.match(/[a-zA-Z0-9]+/g)
      var enCount = words ? words.length : 0
      return cjkCount + enCount
    }

    /** 解析文档结构：标题、待办 */
    function parseContent(text) {
      var lines = text.split('\n')
      headings = []
      todoTotal = 0
      todoDone = 0

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i]

        // 标题
        var hMatch = line.match(/^(#{1,6})\s+(.+)/)
        if (hMatch) {
          var title = hMatch[2]
            .replace(/\s*#+\s*$/, '')       // 去尾部 ###
            .replace(/\*\*|__/g, '')         // 去加粗
            .replace(/\*|_/g, '')            // 去斜体
            .replace(/`([^`]*)`/g, '$1')     // 去行内代码
            .trim()
          headings.push({ level: hMatch[1].length, title: title, line: i + 1 })
        }

        // 待办复选框
        if (/^\s*[-*+]\s+\[[ xX]\]/.test(line)) {
          todoTotal++
          if (/^\s*[-*+]\s+\[[xX]\]/.test(line)) {
            todoDone++
          }
        }
      }

      currentWords = countWords(text)
    }

    /**
     * 构建光标所在位置的标题面包屑
     * 例如光标在 H3 下 → "一级标题 › 二级标题 › 三级标题"
     */
    function buildBreadcrumb(lineNum) {
      if (headings.length === 0) return '(无标题)'

      // 找到光标位置之前（含）的所有标题
      var stack = []  // 维护一个按层级递增的栈

      for (var i = 0; i < headings.length; i++) {
        if (headings[i].line > lineNum) break

        var h = headings[i]
        // 弹出所有层级 >= 当前标题的条目（当前标题会覆盖同级及更深层级）
        while (stack.length > 0 && stack[stack.length - 1].level >= h.level) {
          stack.pop()
        }
        stack.push(h)
      }

      if (stack.length === 0) return '(顶部)'

      // 截断过长标题
      var parts = []
      for (var j = 0; j < stack.length; j++) {
        var t = stack[j].title
        if (t.length > 16) {
          t = t.substring(0, 14) + '…'
        }
        parts.push(t)
      }

      return parts.join(' › ')
    }

    // ── 初始化 ────────────────────────────────────

    var initContent = ctx.getContent() || ''
    parseContent(initContent)
    baseWords = currentWords

    var initCursor = ctx.getCursorPosition()
    if (initCursor) cursorLine = initCursor.line

    // ── 事件监听 ──────────────────────────────────

    ctx.onContentChange(function (newContent) {
      parseContent(newContent)
    })

    ctx.events.on('editor:cursor-move', function (payload) {
      cursorLine = payload.line
    })

    // ── 状态栏：章节定位 ─────────────────────────

    ctx.addStatusBarItem({
      id: 'wa-section',
      priority: 6,
      label: function () {
        return '§ ' + buildBreadcrumb(cursorLine)
      },
    })

    // ── 状态栏：待办进度 ─────────────────────────

    ctx.addStatusBarItem({
      id: 'wa-todo',
      priority: 4,
      label: function () {
        if (todoTotal === 0) return ''
        var pct = Math.round((todoDone / todoTotal) * 100)
        return '☑ ' + todoDone + '/' + todoTotal + ' (' + pct + '%)'
      },
    })

    // ── 状态栏：写作增量 ─────────────────────────

    ctx.addStatusBarItem({
      id: 'wa-delta',
      priority: 2,
      label: function () {
        var delta = currentWords - baseWords
        if (delta === 0) return '△ ±0'
        var sign = delta > 0 ? '+' : ''
        return '△ ' + sign + delta + ' 字'
      },
    })

    // ── 注入样式 ─────────────────────────────────

    ctx.addStyle(
      '[data-status-id="wa-section"] { max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }' +
      '[data-status-id="wa-todo"] { font-variant-numeric: tabular-nums; }'
    )
  },

  onDeactivate: function () {},
}
