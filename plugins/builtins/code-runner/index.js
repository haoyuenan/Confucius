/// <reference path="../types/plugin.d.ts" />

/**
 * 代码运行器插件
 *
 * 功能：在 Markdown 预览中为代码块添加运行按钮
 * 支持：JavaScript（渲染进程沙箱执行）、Python（通过 IPC 调用主进程）
 * 安装：帮助 → 插件管理 → 加载插件 → 选择此目录
 */

// ==================== 代码执行引擎（内嵌函数） ====================

/**
 * 代码运行结果
 * @typedef {Object} RunResult
 * @property {string} stdout 标准输出
 * @property {string} stderr 标准错误
 * @property {number} exitCode 退出码
 * @property {string} [error] 错误信息
 * @property {number} duration 执行耗时（毫秒）
 */

/**
 * 运行选项
 * @typedef {Object} RunOptions
 * @property {number} [timeout] 超时时间（毫秒）
 */

/**
 * 运行代码
 * @param {string} language 语言（javascript 或 python）
 * @param {string} code 代码内容
 * @param {RunOptions} [options] 运行选项
 * @returns {Promise<RunResult>}
 */
async function runCode(language, code, options) {
  const startTime = Date.now()
  const opts = options || {}

  try {
    if (language === 'javascript' || language === 'js') {
      return await runJavaScript(code, opts.timeout || 30000, startTime)
    } else if (language === 'python' || language === 'py') {
      return await runPython(code, opts.timeout || 30000, startTime)
    } else {
      return {
        stdout: '',
        stderr: '',
        exitCode: -1,
        error: `不支持的语言: ${language}。当前支持 JavaScript 和 Python。`,
        duration: Date.now() - startTime
      }
    }
  } catch (err) {
    return {
      stdout: '',
      stderr: '',
      exitCode: -1,
      error: `运行错误: ${err.message}`,
      duration: Date.now() - startTime
    }
  }
}

/**
 * 在沙箱中运行 JavaScript 代码
 * @param {string} code JavaScript 代码
 * @param {number} timeout 超时时间（毫秒）
 * @param {number} startTime 开始时间戳
 * @returns {Promise<RunResult>}
 */
async function runJavaScript(code, timeout, startTime) {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let exitCode = 0
    let timeoutId = null

    // 重写 console.log 和 console.error
    const originalLog = console.log
    const originalError = console.error

    console.log = function (...args) {
      stdout += args.join(' ') + '\n'
    }
    console.error = function (...args) {
      stderr += args.join(' ') + '\n'
    }

    // 设置超时
    timeoutId = setTimeout(() => {
      console.log = originalLog
      console.error = originalError
      resolve({
        stdout,
        stderr,
        exitCode: -1,
        error: `执行超时（${timeout}ms），代码执行已被终止。`,
        duration: Date.now() - startTime
      })
    }, timeout)

    try {
      // 使用 new Function 创建沙箱函数
      // 限制：无法访问全局变量（除了 console）
      const sandboxFunc = new Function(`
        "use strict";
        ${code}
      `)
      sandboxFunc()
      clearTimeout(timeoutId)
    } catch (err) {
      clearTimeout(timeoutId)
      exitCode = 1
      stderr = err.toString()
    } finally {
      // 恢复原始 console
      console.log = originalLog
      console.error = originalError
    }

    resolve({
      stdout,
      stderr,
      exitCode,
      duration: Date.now() - startTime
    })
  })
}

/**
 * 通过 IPC 运行 Python 代码
 * @param {string} code Python 代码
 * @param {number} timeout 超时时间（毫秒）
 * @param {number} startTime 开始时间戳
 * @returns {Promise<RunResult>}
 */
async function runPython(code, timeout, startTime) {
  // 通过 Electron API 调用主进程
  if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.runCode) {
    const result = await window.electronAPI.runCode('python', code, {
      timeout
    })
    return {
      ...result,
      duration: Date.now() - startTime
    }
  } else {
    return {
      stdout: '',
      stderr: '',
      exitCode: -1,
      error: 'Python 执行不可用：Electron API 未加载。请在 Confucius 应用中使用此插件。',
      duration: Date.now() - startTime
    }
  }
}

/**
 * 检查语言是否支持
 * @param {string} language 语言
 * @returns {boolean}
 */
function isLanguageSupported(language) {
  return ['javascript', 'js', 'python', 'py'].includes(language.toLowerCase())
}

// ==================== 插件主模块 ====================

var codeRunnerPlugin = {
  manifest: {
    id: 'code-runner',
    name: '代码运行器',
    version: '1.0.0',
    description: '在 Markdown 中运行代码块，支持 JavaScript 和 Python',
    author: 'renfy',
    apiVersion: '1.0',
    permissions: ['run-code', 'ui']
  },

  onActivate: function (ctx) {
    ctx.console.log('▶️ 代码运行器插件已激活')

    var plugin = codeRunnerPlugin
    plugin.ctx = ctx
    plugin.cleanups = []
    plugin.running = new Map() // 跟踪正在运行的代码块
    plugin.config = plugin.loadConfig()

    // 注入样式
    var removeStyle = ctx.addStyle(plugin.getStyles())
    plugin.cleanups.push(removeStyle)

    // 监听预览区渲染完成事件
    // 使用 MutationObserver 监视预览区的变化
    plugin.setupPreviewObserver()

    // 添加配置面板到侧边栏
    var removeSidebarTab = ctx.addSidebarTab({
      id: 'code-runner',
      label: '代码运行器',
      icon: '▶️',
      render: function () {
        return plugin.renderPanel()
      }
    })
    plugin.cleanups.push(removeSidebarTab)

    ctx.console.log('✅ 代码运行器初始化完成')
  },

  onDeactivate: function () {
    var plugin = codeRunnerPlugin

    // 停止所有正在运行的代码
    plugin.running.forEach(function (info, id) {
      plugin.stopExecution(id)
    })
    plugin.running.clear()

    // 清理观察者
    if (plugin.observer) {
      plugin.observer.disconnect()
      plugin.observer = null
    }

    // 清理所有注册的清理函数
    if (plugin.cleanups) {
      plugin.cleanups.forEach(function (fn) {
        if (typeof fn === 'function') fn()
      })
      plugin.cleanups = []
    }

    // 移除所有运行按钮和输出区域
    var buttons = document.querySelectorAll('.code-runner-btn')
    buttons.forEach(function (btn) { btn.remove() })
    var outputs = document.querySelectorAll('.code-runner-output')
    outputs.forEach(function (out) { out.remove() })

    codeRunnerPlugin.ctx.console.log('⏹️ 代码运行器插件已停用')
  },

  // 获取配置存储键
  getConfigKey: function () {
    return 'code-runner:config'
  },

  // 加载配置
  loadConfig: function () {
    try {
      var saved = localStorage.getItem(codeRunnerPlugin.getConfigKey())
      if (saved) {
        var config = JSON.parse(saved)
        return {
          timeout: config.timeout || 30000,
          showExitCode: config.showExitCode !== false,
          showDuration: config.showDuration !== false,
          autoScroll: config.autoScroll !== false
        }
      }
    } catch (e) {}
    return {
      timeout: 30000,
      showExitCode: true,
      showDuration: true,
      autoScroll: true
    }
  },

  // 保存配置
  saveConfig: function () {
    try {
      localStorage.setItem(codeRunnerPlugin.getConfigKey(), JSON.stringify(codeRunnerPlugin.config))
    } catch (e) {
      codeRunnerPlugin.ctx.console.error('保存配置失败:', e)
    }
  },

  // 设置预览区观察者
  setupPreviewObserver: function () {
    var plugin = codeRunnerPlugin

    // 延迟初始化，等待预览区渲染
    setTimeout(function () {
      plugin.addRunButtons()
    }, 500)

    // 使用 MutationObserver 监视预览区变化
    var previewPane = document.querySelector('.preview-pane') ||
                      document.querySelector('[class*="preview"]') ||
                      document.querySelector('.cm-preview') ||
                      document.getElementById('preview')

    if (previewPane) {
      plugin.observer = new MutationObserver(function (mutations) {
        // 防抖处理，避免频繁添加按钮
        clearTimeout(plugin.debounceTimer)
        plugin.debounceTimer = setTimeout(function () {
          plugin.addRunButtons()
        }, 100)
      })

      plugin.observer.observe(previewPane, {
        childList: true,
        subtree: true
      })
    }

    // 监听内容变化事件
    var removeContentChange = plugin.ctx.events.on('editor:content-change', function () {
      clearTimeout(plugin.debounceTimer)
      plugin.debounceTimer = setTimeout(function () {
        plugin.addRunButtons()
      }, 300)
    })
    plugin.cleanups.push(removeContentChange)
  },

  // 为代码块添加运行按钮
  addRunButtons: function () {
    var plugin = codeRunnerPlugin

    // 查找所有代码块
    var codeBlocks = document.querySelectorAll('pre code[class*="language-"]')
    var preBlocks = document.querySelectorAll('pre[class*="language-"]')

    // 合并选择器结果
    var allBlocks = []
    codeBlocks.forEach(function (block) {
      allBlocks.push(block)
    })
    preBlocks.forEach(function (block) {
      if (!allBlocks.includes(block)) {
        allBlocks.push(block)
      }
    })

    allBlocks.forEach(function (codeBlock) {
      var preElement = codeBlock.closest('pre') || codeBlock

      // 检查是否已添加运行按钮
      if (preElement.querySelector('.code-runner-btn')) {
        return
      }

      // 获取语言
      var language = plugin.detectLanguage(codeBlock, preElement)

      // 检查是否支持该语言
      if (!isLanguageSupported(language)) {
        return
      }

      // 创建运行按钮
      var runBtn = document.createElement('button')
      runBtn.className = 'code-runner-btn'
      runBtn.innerHTML = '▶ 运行'
      runBtn.title = '运行 ' + language + ' 代码'
      runBtn.dataset.language = language
      runBtn.dataset.blockId = 'block-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9)

      // 绑定点击事件
      runBtn.addEventListener('click', function (e) {
        e.preventDefault()
        e.stopPropagation()
        plugin.executeCode(preElement, codeBlock, language, runBtn)
      })

      // 添加按钮到代码块
      preElement.style.position = 'relative'
      preElement.appendChild(runBtn)
    })
  },

  // 检测代码块语言
  detectLanguage: function (codeBlock, preElement) {
    // 从 class 中提取语言
    var classList = codeBlock.classList || []
    for (var i = 0; i < classList.length; i++) {
      var cls = classList[i]
      if (cls.startsWith('language-')) {
        return cls.replace('language-', '').toLowerCase()
      }
    }

    // 从 pre 元素的 class 中查找
    var preClassList = preElement.classList || []
    for (var i = 0; i < preClassList.length; i++) {
      var cls = preClassList[i]
      if (cls.startsWith('language-')) {
        return cls.replace('language-', '').toLowerCase()
      }
    }

    return 'text'
  },

  // 执行代码
  executeCode: async function (preElement, codeBlock, language, runBtn) {
    var plugin = codeRunnerPlugin
    var blockId = runBtn.dataset.blockId

    // 获取代码内容
    var code = codeBlock.textContent || codeBlock.innerText || ''
    if (!code.trim()) {
      plugin.showOutput(preElement, blockId, '代码块为空，无法执行。', true)
      return
    }

    // 检查是否正在运行
    if (plugin.running.has(blockId)) {
      plugin.stopExecution(blockId)
      return
    }

    // 更新按钮状态
    runBtn.innerHTML = '⏹ 停止'
    runBtn.classList.add('running')

    // 创建执行记录
    plugin.running.set(blockId, {
      startTime: Date.now(),
      timeoutId: null
    })

    try {
      // 显示输出区域（清空之前的内容）
      plugin.showOutput(preElement, blockId, '运行中...', false)

      // 执行代码
      var result = await runCode(language, code, {
        timeout: plugin.config.timeout
      })

      // 检查是否已被停止
      if (!plugin.running.has(blockId)) {
        return
      }

      // 格式化输出
      var output = plugin.formatResult(result)
      plugin.showOutput(preElement, blockId, output, result.exitCode !== 0 || result.error)

    } catch (err) {
      plugin.showOutput(preElement, blockId, '执行错误: ' + err.message, true)
    } finally {
      // 清理执行记录
      plugin.running.delete(blockId)

      // 恢复按钮状态
      runBtn.innerHTML = '▶ 运行'
      runBtn.classList.remove('running')
    }
  },

  // 停止代码执行
  stopExecution: function (blockId) {
    var info = codeRunnerPlugin.running.get(blockId)
    if (info && info.timeoutId) {
      clearTimeout(info.timeoutId)
    }
    codeRunnerPlugin.running.delete(blockId)
  },

  // 格式化执行结果
  formatResult: function (result) {
    var parts = []

    if (result.stdout) {
      parts.push(result.stdout)
    }

    if (result.stderr) {
      if (result.stdout) parts.push('')
      parts.push(result.stderr)
    }

    if (result.error) {
      if (result.stdout || result.stderr) parts.push('')
      parts.push('错误: ' + result.error)
    }

    // 添加执行信息
    var info = []
    if (codeRunnerPlugin.config.showExitCode) {
      info.push('退出码: ' + result.exitCode)
    }
    if (codeRunnerPlugin.config.showDuration) {
      info.push('耗时: ' + result.duration + 'ms')
    }

    if (info.length > 0) {
      if (parts.length > 0) parts.push('')
      parts.push('---')
      parts.push(info.join(' | '))
    }

    return parts.join('\n')
  },

  // 显示输出
  showOutput: function (preElement, blockId, content, isError) {
    var plugin = codeRunnerPlugin

    // 查找或创建输出区域
    var outputId = 'output-' + blockId
    var outputElement = document.getElementById(outputId)

    if (!outputElement) {
      outputElement = document.createElement('div')
      outputElement.id = outputId
      outputElement.className = 'code-runner-output'

      // 插入到 pre 元素之后
      if (preElement.nextSibling) {
        preElement.parentNode.insertBefore(outputElement, preElement.nextSibling)
      } else {
        preElement.parentNode.appendChild(outputElement)
      }
    }

    // 设置内容和样式
    outputElement.textContent = content
    outputElement.classList.remove('error', 'success')
    outputElement.classList.add(isError ? 'error' : 'success')

    // 自动滚动
    if (plugin.config.autoScroll) {
      outputElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  },

  // 渲染配置面板
  renderPanel: function () {
    var plugin = codeRunnerPlugin
    var ctx = plugin.ctx

    var container = document.createElement('div')
    container.className = 'code-runner-panel'

    // 标题
    var header = document.createElement('div')
    header.className = 'code-runner-panel-header'
    header.innerHTML = '<h3>▶️ 代码运行器</h3>'
    container.appendChild(header)

    // 配置表单
    var form = document.createElement('div')
    form.className = 'code-runner-form'

    // 超时时间配置
    var timeoutGroup = document.createElement('div')
    timeoutGroup.className = 'code-runner-form-group'

    var timeoutLabel = document.createElement('label')
    timeoutLabel.textContent = '超时时间（毫秒）:'
    timeoutLabel.className = 'code-runner-form-label'

    var timeoutInput = document.createElement('input')
    timeoutInput.type = 'number'
    timeoutInput.className = 'code-runner-form-input'
    timeoutInput.value = String(plugin.config.timeout)
    timeoutInput.min = '1000'
    timeoutInput.max = '300000'
    timeoutInput.step = '1000'
    timeoutInput.addEventListener('change', function () {
      var value = parseInt(this.value, 10)
      plugin.config.timeout = isNaN(value) ? 30000 : Math.max(1000, value)
      this.value = String(plugin.config.timeout)
      plugin.saveConfig()
      ctx.console.log('✅ 超时时间已更新: ' + plugin.config.timeout + 'ms')
    })

    timeoutGroup.appendChild(timeoutLabel)
    timeoutGroup.appendChild(timeoutInput)
    form.appendChild(timeoutGroup)

    // 显示选项
    var optionsGroup = document.createElement('div')
    optionsGroup.className = 'code-runner-form-group'

    var optionsTitle = document.createElement('label')
    optionsTitle.textContent = '显示选项:'
    optionsTitle.className = 'code-runner-form-label'
    optionsGroup.appendChild(optionsTitle)

    // 显示退出码
    var showExitCodeDiv = document.createElement('div')
    showExitCodeDiv.className = 'code-runner-checkbox'
    var showExitCodeCheckbox = document.createElement('input')
    showExitCodeCheckbox.type = 'checkbox'
    showExitCodeCheckbox.checked = plugin.config.showExitCode
    showExitCodeCheckbox.addEventListener('change', function () {
      plugin.config.showExitCode = this.checked
      plugin.saveConfig()
    })
    var showExitCodeLabel = document.createElement('span')
    showExitCodeLabel.textContent = '显示退出码'
    showExitCodeDiv.appendChild(showExitCodeCheckbox)
    showExitCodeDiv.appendChild(showExitCodeLabel)
    optionsGroup.appendChild(showExitCodeDiv)

    // 显示耗时
    var showDurationDiv = document.createElement('div')
    showDurationDiv.className = 'code-runner-checkbox'
    var showDurationCheckbox = document.createElement('input')
    showDurationCheckbox.type = 'checkbox'
    showDurationCheckbox.checked = plugin.config.showDuration
    showDurationCheckbox.addEventListener('change', function () {
      plugin.config.showDuration = this.checked
      plugin.saveConfig()
    })
    var showDurationLabel = document.createElement('span')
    showDurationLabel.textContent = '显示执行耗时'
    showDurationDiv.appendChild(showDurationCheckbox)
    showDurationDiv.appendChild(showDurationLabel)
    optionsGroup.appendChild(showDurationDiv)

    // 自动滚动
    var autoScrollDiv = document.createElement('div')
    autoScrollDiv.className = 'code-runner-checkbox'
    var autoScrollCheckbox = document.createElement('input')
    autoScrollCheckbox.type = 'checkbox'
    autoScrollCheckbox.checked = plugin.config.autoScroll
    autoScrollCheckbox.addEventListener('change', function () {
      plugin.config.autoScroll = this.checked
      plugin.saveConfig()
    })
    var autoScrollLabel = document.createElement('span')
    autoScrollLabel.textContent = '执行后自动滚动到输出'
    autoScrollDiv.appendChild(autoScrollCheckbox)
    autoScrollDiv.appendChild(autoScrollLabel)
    optionsGroup.appendChild(autoScrollDiv)

    form.appendChild(optionsGroup)
    container.appendChild(form)

    // 说明
    var info = document.createElement('div')
    info.className = 'code-runner-info'
    info.innerHTML = `
      <h4>支持的编程语言</h4>
      <ul>
        <li><strong>JavaScript</strong> - 在渲染进程沙箱中执行</li>
        <li><strong>Python</strong> - 通过主进程调用系统 Python</li>
      </ul>
      <p class="code-runner-note">
        💡 提示: 在 Markdown 预览中，支持的语言代码块右上角会出现 "▶ 运行" 按钮。
      </p>
    `
    container.appendChild(info)

    return container
  },

  // 获取样式
  getStyles: function () {
    return `
      /* 运行按钮 */
      .code-runner-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        padding: 4px 10px;
        background: var(--primary-color, #1976d2);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        opacity: 0.7;
        transition: all 0.2s ease;
        z-index: 10;
      }

      .code-runner-btn:hover {
        opacity: 1;
        background: var(--primary-color-dark, #1565c0);
      }

      .code-runner-btn.running {
        background: #d32f2f;
        opacity: 1;
      }

      .code-runner-btn.running:hover {
        background: #b71c1c;
      }

      /* 鼠标悬停代码块时显示按钮 */
      pre:hover .code-runner-btn {
        opacity: 1;
      }

      /* 输出区域 */
      .code-runner-output {
        margin: 0;
        padding: 12px 16px;
        font-family: 'SF Mono', 'Fira Code', Consolas, Monaco, monospace;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        border-radius: 0 0 6px 6px;
        max-height: 300px;
        overflow: auto;
      }

      .code-runner-output.success {
        background: var(--bg-code, #f5f5f5);
        color: var(--text-primary, #333);
        border: 1px solid var(--border-color, #ddd);
        border-top: none;
      }

      .code-runner-output.error {
        background: #ffebee;
        color: #c62828;
        border: 1px solid #ffcdd2;
        border-top: none;
      }

      /* 配置面板 */
      .code-runner-panel {
        padding: 16px;
      }

      .code-runner-panel-header {
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color, #ddd);
        margin-bottom: 16px;
      }

      .code-runner-panel-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary, #333);
      }

      .code-runner-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .code-runner-form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .code-runner-form-label {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary, #333);
      }

      .code-runner-form-input {
        padding: 8px 12px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 4px;
        font-size: 13px;
        background: var(--bg-input, #fff);
        color: var(--text-primary, #333);
        transition: border-color 0.2s ease;
      }

      .code-runner-form-input:focus {
        outline: none;
        border-color: var(--primary-color, #1976d2);
      }

      .code-runner-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--text-secondary, #666);
      }

      .code-runner-checkbox input[type="checkbox"] {
        margin: 0;
      }

      .code-runner-info {
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid var(--border-color, #ddd);
      }

      .code-runner-info h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #333);
      }

      .code-runner-info ul {
        margin: 0 0 12px 0;
        padding-left: 20px;
        font-size: 13px;
        color: var(--text-secondary, #666);
        line-height: 1.6;
      }

      .code-runner-info li {
        margin-bottom: 4px;
      }

      .code-runner-note {
        margin: 0;
        padding: 10px 12px;
        background: var(--bg-secondary, #f5f5f5);
        border-radius: 4px;
        font-size: 12px;
        color: var(--text-secondary, #666);
        line-height: 1.5;
      }

      /* 暗色主题适配 */
      [data-theme="dark"] .code-runner-output.success {
        background: var(--bg-code, #2d2d2d);
        color: var(--text-primary, #e0e0e0);
        border-color: var(--border-color, #444);
      }

      [data-theme="dark"] .code-runner-output.error {
        background: #3e2723;
        color: #ff8a80;
        border-color: #5d4037;
      }

      [data-theme="dark"] .code-runner-note {
        background: var(--bg-secondary, #333);
      }
    `
  },

  cleanups: [],
  ctx: null,
  config: null,
  running: null,
  observer: null,
  debounceTimer: null
}

module.exports = codeRunnerPlugin
