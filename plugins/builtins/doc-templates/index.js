/**
 * 文档模板插件
 *
 * 功能：一键插入预定义文档模板，支持变量替换
 * 安装：帮助 → 插件管理 (Ctrl+Shift+I) → 加载插件 → 选择此目录
 */

// 内置模板数据（直接嵌入，避免 require）
var builtInTemplates = [
  {
    id: 'readme',
    name: 'README',
    icon: '📄',
    description: '项目介绍文档',
    content: '# {{title}}\n\n> {{description}}\n\n## 安装\n\n```bash\nnpm install {{package}}\n```\n\n## 使用\n\n```javascript\n// 示例代码\n```\n\n## API\n\n| 方法 | 说明 |\n|------|------|\n| `init()` | 初始化 |\n\n## License\n\nMIT © {{author}}',
  },
  {
    id: 'api-doc',
    name: 'API 文档',
    icon: '🔌',
    description: 'API 接口文档',
    content: '# {{title}} API 文档\n\n## 概述\n\n## 接口列表\n\n### {{endpoint}}\n\n**请求方法**: `{{method}}`\n\n**路径**: `{{path}}`\n\n**参数**:\n\n| 参数 | 类型 | 必填 | 说明 |\n|------|------|------|------|\n| | | | |\n\n**响应**:\n\n```json\n{\n  "code": 0,\n  "data": {}\n}\n```\n\n## 错误码\n\n| 错误码 | 说明 |\n|--------|------|\n| 0 | 成功 |\n\n---\n\n_最后更新: {{date}}_',
  },
  {
    id: 'blog',
    name: '博客文章',
    icon: '📝',
    description: '博客文章模板',
    content: '---\ntitle: {{title}}\ndate: {{date}}\nauthor: {{author}}\ntags: []\n---\n\n## 引言\n\n## 正文\n\n## 总结\n\n## 参考资料',
  },
  {
    id: 'weekly',
    name: '周报',
    icon: '📊',
    description: '工作周报模板',
    content: '# {{title}} 周报\n\n**汇报周期**: {{year}}年 第W周 ({{month}}月)\n\n**汇报人**: {{author}}\n\n**日期**: {{date}}\n\n## 本周完成\n\n- [ ] \n- [ ] \n- [ ] \n\n## 下周计划\n\n- [ ] \n- [ ] \n- [ ] \n\n## 问题与风险\n\n## 备注',
  },
  {
    id: 'meeting',
    name: '会议纪要',
    icon: '📋',
    description: '会议记录模板',
    content: '# {{title}} 会议纪要\n\n**时间**: {{date}} {{time}}\n\n**地点**: \n\n**主持人**: {{author}}\n\n**参会人员**: \n\n## 议程\n\n## 讨论内容\n\n### 议题一\n\n**结论**: \n\n**待办**: \n\n### 议题二\n\n**结论**: \n\n**待办**: \n\n## 行动项\n\n| 序号 | 事项 | 负责人 | 截止日期 |\n|------|------|--------|----------|\n| 1 | | | |\n\n## 下次会议\n\n**时间**: \n\n**议题**: ',
  },
]

// 插件对象
module.exports = {
  manifest: {
    id: 'doc-templates',
    name: '文档模板',
    version: '1.0.0',
    description: '一键插入预定义文档模板，支持变量替换',
    author: 'renfy',
    apiVersion: '1.0',
  },

  onActivate: function (ctx) {
    ctx.console.log('📋 文档模板插件已激活')

    var plugin = this
    plugin.ctx = ctx
    plugin.cleanups = []
    plugin.selectedTemplate = null
    plugin.currentVars = {}

    // 加载用户配置
    plugin.config = plugin.loadConfig()

    // 合并内置模板和自定义模板
    plugin.allTemplates = builtInTemplates.concat(plugin.config.customTemplates || [])

    // 注入样式
    var removeStyle = ctx.addStyle(plugin.getStyles())
    plugin.cleanups.push(removeStyle)

    // 添加侧边栏面板
    var removeSidebarTab = ctx.addSidebarTab({
      id: 'doc-templates',
      label: '文档模板',
      icon: '📋',
      render: function () {
        return plugin.renderPanel()
      },
    })
    plugin.cleanups.push(removeSidebarTab)

    // 监听文件打开事件，更新变量
    var removeFileOpen = ctx.events.on('file:opened', function () {
      plugin.updateVariables()
    })
    plugin.cleanups.push(removeFileOpen)

    // 初始化变量
    plugin.updateVariables()
  },

  onDeactivate: function () {
    if (this.cleanups) {
      this.cleanups.forEach(function (fn) {
        if (typeof fn === 'function') fn()
      })
      this.cleanups = []
    }
    this.ctx.console.log('📋 文档模板插件已停用')
  },

  // 获取配置存储键
  getConfigKey: function () {
    return 'doc-templates:config'
  },

  // 加载用户配置
  loadConfig: function () {
    try {
      var saved = localStorage.getItem(this.getConfigKey())
      if (saved) {
        var config = JSON.parse(saved)
        return {
          author: config.author || '',
          defaultTemplate: config.defaultTemplate || 'readme',
          customTemplates: config.customTemplates || [],
        }
      }
    } catch (e) {}
    return {
      author: '',
      defaultTemplate: 'readme',
      customTemplates: [],
    }
  },

  // 保存用户配置
  saveConfig: function () {
    try {
      localStorage.setItem(this.getConfigKey(), JSON.stringify(this.config))
    } catch (e) {
      this.ctx.console.error('保存配置失败:', e)
    }
  },

  // 更新模板变量
  updateVariables: function () {
    var now = new Date()
    var filePath = this.ctx.getActiveFilePath() || ''
    var fileName = filePath ? filePath.split(/[\\/]/).pop() : 'untitled'
    var title = fileName.replace(/\.[^.]+$/, '')
    var project = filePath ? filePath.split(/[\\/]/).filter(Boolean).slice(-2, -1)[0] || 'project' : 'project'

    this.currentVars = {
      date: this.formatDate(now),
      time: this.formatTime(now),
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      day: String(now.getDate()).padStart(2, '0'),
      title: title,
      author: this.config.author || 'author',
      project: project,
      description: '项目描述',
      package: title.toLowerCase().replace(/\s+/g, '-'),
      endpoint: 'endpoint',
      method: 'GET',
      path: '/api/v1/path',
    }
  },

  // 格式化日期
  formatDate: function (date) {
    var y = date.getFullYear()
    var m = String(date.getMonth() + 1).padStart(2, '0')
    var d = String(date.getDate()).padStart(2, '0')
    return y + '-' + m + '-' + d
  },

  // 格式化时间
  formatTime: function (date) {
    var h = String(date.getHours()).padStart(2, '0')
    var m = String(date.getMinutes()).padStart(2, '0')
    return h + ':' + m
  },

  // 替换模板变量
  replaceVars: function (template) {
    var result = template
    var vars = this.currentVars
    for (var key in vars) {
      if (vars.hasOwnProperty(key)) {
        result = result.replace(new RegExp('\\{\\{' + key + '\\}\\}', 'g'), vars[key])
      }
    }
    return result
  },

  // 渲染侧边栏面板
  renderPanel: function () {
    var plugin = this
    var ctx = plugin.ctx

    // 创建容器
    var container = document.createElement('div')
    container.className = 'doc-templates-panel'

    // 标题
    var header = document.createElement('div')
    header.className = 'doc-templates-header'
    header.innerHTML = '<h3>📋 文档模板</h3>'
    container.appendChild(header)

    // 模板列表
    var listContainer = document.createElement('div')
    listContainer.className = 'doc-templates-list'

    plugin.allTemplates.forEach(function (template) {
      var item = document.createElement('div')
      item.className = 'doc-template-item'
      item.dataset.id = template.id

      var icon = document.createElement('span')
      icon.className = 'doc-template-icon'
      icon.textContent = template.icon || '📄'

      var info = document.createElement('div')
      info.className = 'doc-template-info'
      info.innerHTML = '<div class="doc-template-name">' + template.name + '</div>' +
                       '<div class="doc-template-desc">' + template.description + '</div>'

      item.appendChild(icon)
      item.appendChild(info)

      // 点击选择模板
      item.addEventListener('click', function () {
        plugin.selectTemplate(template.id, listContainer, previewContent)
      })

      listContainer.appendChild(item)
    })

    container.appendChild(listContainer)

    // 添加自定义模板按钮
    var addBtn = document.createElement('button')
    addBtn.className = 'doc-template-add-btn'
    addBtn.innerHTML = '+ 自定义模板'
    addBtn.addEventListener('click', function () {
      plugin.showAddTemplateDialog()
    })
    container.appendChild(addBtn)

    // 预览区域
    var previewHeader = document.createElement('div')
    previewHeader.className = 'doc-templates-header doc-templates-preview-header'
    previewHeader.innerHTML = '<h4>👁️ 预览</h4>'
    container.appendChild(previewHeader)

    var previewContent = document.createElement('div')
    previewContent.className = 'doc-template-preview'
    previewContent.innerHTML = '<div class="doc-template-preview-empty">请选择一个模板</div>'
    container.appendChild(previewContent)

    // 插入按钮
    var insertBtn = document.createElement('button')
    insertBtn.className = 'doc-template-insert-btn'
    insertBtn.textContent = '插入模板'
    insertBtn.disabled = true
    insertBtn.addEventListener('click', function () {
      if (plugin.selectedTemplate) {
        plugin.insertTemplate(plugin.selectedTemplate)
      }
    })
    container.appendChild(insertBtn)
    plugin.insertButton = insertBtn

    // 配置区域
    var configHeader = document.createElement('div')
    configHeader.className = 'doc-templates-header doc-templates-config-header'
    configHeader.innerHTML = '<h4>⚙️ 配置</h4>'
    container.appendChild(configHeader)

    var configSection = document.createElement('div')
    configSection.className = 'doc-template-config'

    var authorLabel = document.createElement('label')
    authorLabel.className = 'doc-template-config-label'
    authorLabel.textContent = '作者名称:'

    var authorInput = document.createElement('input')
    authorInput.className = 'doc-template-config-input'
    authorInput.type = 'text'
    authorInput.value = plugin.config.author
    authorInput.placeholder = '输入你的名字'
    authorInput.addEventListener('change', function () {
      plugin.config.author = this.value
      plugin.saveConfig()
      plugin.updateVariables()
      // 刷新预览
      if (plugin.selectedTemplate) {
        plugin.updatePreview(previewContent)
      }
    })

    configSection.appendChild(authorLabel)
    configSection.appendChild(authorInput)
    container.appendChild(configSection)

    // 默认选中第一个模板
    if (plugin.allTemplates.length > 0) {
      setTimeout(function () {
        plugin.selectTemplate(plugin.config.defaultTemplate || plugin.allTemplates[0].id, listContainer, previewContent)
      }, 0)
    }

    return container
  },

  // 选择模板
  selectTemplate: function (templateId, listContainer, previewContent) {
    var plugin = this

    // 更新选中状态
    var items = listContainer.querySelectorAll('.doc-template-item')
    items.forEach(function (item) {
      item.classList.remove('active')
      if (item.dataset.id === templateId) {
        item.classList.add('active')
      }
    })

    // 找到模板
    var template = plugin.allTemplates.find(function (t) { return t.id === templateId })
    if (!template) {
      template = plugin.allTemplates[0]
    }

    plugin.selectedTemplate = template

    // 更新预览
    plugin.updatePreview(previewContent)

    // 启用插入按钮
    if (plugin.insertButton) {
      plugin.insertButton.disabled = false
    }
  },

  // 更新预览
  updatePreview: function (previewContent) {
    if (!this.selectedTemplate) return

    var content = this.replaceVars(this.selectedTemplate.content)
    // 转义 HTML
    var escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')

    previewContent.innerHTML = '<pre class="doc-template-preview-code">' + escaped + '</pre>'
  },

  // 插入模板
  insertTemplate: function (template) {
    var plugin = this
    var content = plugin.replaceVars(template.content)

    // 获取当前编辑器内容
    var currentContent = plugin.ctx.getContent()
    var pos = plugin.ctx.getCursorPosition()

    // 在光标位置插入（实际实现取决于编辑器 API）
    // 这里通过事件通知主应用
    plugin.ctx.events.emit('template:insert', {
      content: content,
      template: template,
    })

    // 如果有 insertText 方法，直接使用
    if (plugin.ctx.insertText) {
      plugin.ctx.insertText(content)
    } else {
      // 否则尝试通过控制台提示用户手动粘贴
      plugin.ctx.console.log('模板内容已准备好，请手动粘贴（已复制到剪贴板）')

      // 尝试写入剪贴板
      try {
        if (navigator && navigator.clipboard) {
          navigator.clipboard.writeText(content)
        }
      } catch (e) {}
    }

    plugin.ctx.console.log('✅ 已插入模板: ' + template.name)
  },

  // 显示添加自定义模板对话框
  showAddTemplateDialog: function () {
    var plugin = this

    var name = window.prompt('模板名称:')
    if (!name) return

    var id = 'custom-' + Date.now()

    var description = window.prompt('模板描述:') || '自定义模板'

    var content = window.prompt('模板内容（支持 {{变量}}）:', '# {{title}}\n\n作者: {{author}}\n日期: {{date}}')
    if (!content) return

    var newTemplate = {
      id: id,
      name: name,
      icon: '📄',
      description: description,
      content: content,
    }

    plugin.config.customTemplates = plugin.config.customTemplates || []
    plugin.config.customTemplates.push(newTemplate)
    plugin.saveConfig()

    plugin.allTemplates.push(newTemplate)

    // 刷新面板（重新渲染）
    plugin.ctx.events.emit('sidebar:refresh', { tab: 'doc-templates' })

    plugin.ctx.console.log('✅ 已添加自定义模板: ' + name)
  },

  // 获取样式
  getStyles: function () {
    return `
      .doc-templates-panel {
        padding: 12px;
        font-size: 13px;
      }

      .doc-templates-header {
        padding: 8px 0;
        border-bottom: 1px solid var(--border-color, #ddd);
        margin-bottom: 8px;
      }

      .doc-templates-header h3,
      .doc-templates-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #333);
      }

      .doc-templates-preview-header,
      .doc-templates-config-header {
        margin-top: 16px;
        border-top: 1px solid var(--border-color, #ddd);
        padding-top: 12px;
      }

      .doc-templates-list {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .doc-template-item {
        display: flex;
        align-items: center;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 1px solid transparent;
      }

      .doc-template-item:hover {
        background: var(--bg-hover, #f5f5f5);
        border-color: var(--border-color, #ddd);
      }

      .doc-template-item.active {
        background: var(--bg-active, #e3f2fd);
        border-color: var(--primary-color, #1976d2);
      }

      .doc-template-icon {
        font-size: 18px;
        margin-right: 10px;
        width: 24px;
        text-align: center;
      }

      .doc-template-info {
        flex: 1;
      }

      .doc-template-name {
        font-weight: 500;
        color: var(--text-primary, #333);
        margin-bottom: 2px;
      }

      .doc-template-desc {
        font-size: 11px;
        color: var(--text-secondary, #666);
      }

      .doc-template-add-btn {
        width: 100%;
        margin-top: 8px;
        padding: 8px;
        background: var(--bg-secondary, #f5f5f5);
        border: 1px dashed var(--border-color, #ccc);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        color: var(--text-secondary, #666);
        transition: all 0.2s ease;
      }

      .doc-template-add-btn:hover {
        background: var(--bg-hover, #e8e8e8);
        border-color: var(--primary-color, #1976d2);
        color: var(--primary-color, #1976d2);
      }

      .doc-template-preview {
        background: var(--bg-code, #f5f5f5);
        border: 1px solid var(--border-color, #ddd);
        border-radius: 6px;
        padding: 10px;
        min-height: 120px;
        max-height: 200px;
        overflow: auto;
      }

      .doc-template-preview-empty {
        color: var(--text-secondary, #999);
        text-align: center;
        padding: 40px 0;
        font-style: italic;
      }

      .doc-template-preview-code {
        margin: 0;
        font-family: 'SF Mono', 'Fira Code', Consolas, monospace;
        font-size: 11px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        color: var(--text-primary, #333);
      }

      .doc-template-insert-btn {
        width: 100%;
        margin-top: 12px;
        padding: 10px;
        background: var(--primary-color, #1976d2);
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .doc-template-insert-btn:hover:not(:disabled) {
        background: var(--primary-color-dark, #1565c0);
      }

      .doc-template-insert-btn:disabled {
        background: var(--bg-disabled, #ccc);
        cursor: not-allowed;
      }

      .doc-template-config {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .doc-template-config-label {
        font-size: 12px;
        color: var(--text-secondary, #666);
      }

      .doc-template-config-input {
        padding: 6px 10px;
        border: 1px solid var(--border-color, #ddd);
        border-radius: 4px;
        font-size: 12px;
        background: var(--bg-input, #fff);
        color: var(--text-primary, #333);
      }

      .doc-template-config-input:focus {
        outline: none;
        border-color: var(--primary-color, #1976d2);
      }
    `
  },

  cleanups: [],
  ctx: null,
  config: null,
  allTemplates: [],
  selectedTemplate: null,
  currentVars: {},
  insertButton: null,
}
