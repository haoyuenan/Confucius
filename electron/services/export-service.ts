import { dialog, BrowserWindow } from 'electron'
import { writeFile } from 'fs/promises'

export class ExportService {
  async exportHtml(win: BrowserWindow): Promise<void> {
    const result = await dialog.showSaveDialog(win, {
      title: '导出为 HTML',
      filters: [{ name: 'HTML', extensions: ['html'] }],
      defaultPath: 'document.html',
    })
    if (result.canceled || !result.filePath) return

    const rawHtml = await win.webContents.executeJavaScript(
      `window.__exportPreviewHTML__()`,
    )
    // 二次校验：确保返回值为字符串，防止渲染进程异常返回非预期类型
    if (typeof rawHtml !== 'string') {
      throw new Error('exportHtml: 获取预览内容失败，返回值类型无效')
    }
    const bodyHtml = rawHtml

    const fullHtml = this.wrapHtmlDocument(bodyHtml)
    await writeFile(result.filePath, fullHtml, 'utf-8')
    win.webContents.send('export:done', { format: 'HTML', path: result.filePath })
  }

  async exportPdf(win: BrowserWindow): Promise<void> {
    const result = await dialog.showSaveDialog(win, {
      title: '导出为 PDF',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
      defaultPath: 'document.pdf',
    })
    if (result.canceled || !result.filePath) return

    const bodyHtml = await win.webContents.executeJavaScript(
      `window.__exportPreviewHTML__()`,
    )

    const fullHtml = this.wrapHtmlDocument(bodyHtml)
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    try {
      await printWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`,
      )

      // 等待页面实际渲染完成，而非固定延时
      await waitForPageReady(printWindow)

      const pdfData = await printWindow.webContents.printToPDF({
        printBackground: true,
        margins: { top: 0.75, bottom: 0.75, left: 0.6, right: 0.6 },
        pageSize: 'A4',
      })

      await writeFile(result.filePath, pdfData)
      win.webContents.send('export:done', { format: 'PDF', path: result.filePath })
    } finally {
      printWindow.close()
    }
  }

  async printPreview(win: BrowserWindow): Promise<void> {
    const bodyHtml = await win.webContents.executeJavaScript(
      `window.__exportPreviewHTML__()`,
    )
    if (typeof bodyHtml !== 'string') {
      throw new Error('printPreview: 获取预览内容失败')
    }
    const fullHtml = this.wrapHtmlDocument(bodyHtml)
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    try {
      await printWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`,
      )
      await waitForPageReady(printWindow)
      // 弹出系统打印对话框
      printWindow.webContents.print({ printBackground: true }, (_success) => {
        printWindow.close()
      })
    } catch (err) {
      printWindow.close()
      throw err
    }
  }

  private wrapHtmlDocument(bodyHtml: string): string {
    const exportCss = this.getExportCss()
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confucius 导出文档</title>
  <style>
${exportCss}
  </style>
</head>
<body class="markdown-body">
  ${bodyHtml}
</body>
</html>`
  }

  private getExportCss(): string {
    return `
.markdown-body {
  --bgColor-default: #ffffff;
  --bgColor-muted: #f6f8fa;
  --fgColor-default: #1f2328;
  --fgColor-muted: #656d76;
  --fgColor-accent: #0969da;
  --borderColor-default: #d0d7de;
  color-scheme: light;
  box-sizing: border-box;
  min-width: 200px;
  max-width: 980px;
  margin: 0 auto;
  padding: 32px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.7;
  color: var(--fgColor-default);
  background: var(--bgColor-default);
}

.markdown-body h1 { font-size: 2em; border-bottom: 1px solid var(--borderColor-default); padding-bottom: 0.3em; }
.markdown-body h2 { font-size: 1.5em; border-bottom: 1px solid var(--borderColor-default); padding-bottom: 0.3em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body h5 { font-size: 0.875em; }
.markdown-body h6 { font-size: 0.85em; }

.markdown-body code {
  padding: 0.2em 0.4em;
  font-size: 85%;
  background: var(--bgColor-muted);
  border-radius: 4px;
  font-family: "SF Mono", "Fira Code", "Consolas", monospace;
}

.markdown-body pre {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  word-break: break-all;

  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background: var(--bgColor-muted);
  border-radius: 6px;
}

.markdown-body pre code { padding: 0; background: transparent; border: 0; }

.markdown-body blockquote {
  padding: 0 1em;
  color: var(--fgColor-muted);
  border-left: 0.25em solid var(--borderColor-default);
}

.markdown-body table { border-collapse: collapse; width: 100%; margin: 1em 0; }
.markdown-body th, .markdown-body td {
  border: 1px solid var(--borderColor-default);
  padding: 8px 12px;
  text-align: left;
}
.markdown-body th { background: var(--bgColor-muted); font-weight: 600; }
.markdown-body tr:nth-child(2n) { background: var(--bgColor-muted); }

.markdown-body img { max-width: 100%; }
.markdown-body a { color: var(--fgColor-accent); text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body hr { height: 0.25em; padding: 0; margin: 24px 0; background: var(--borderColor-default); border: 0; }

.hljs{display:block;overflow-x:auto;padding:0.5em;color:#333;background:#f8f8f8}
.hljs-comment,.hljs-quote{color:#998;font-style:italic}
.hljs-keyword,.hljs-selector-tag,.hljs-subst{color:#333;font-weight:bold}
.hljs-number,.hljs-literal,.hljs-variable,.hljs-template-variable,.hljs-tag .hljs-attr{color:#008080}
.hljs-string,.hljs-doctag{color:#d14}
.hljs-title,.hljs-section,.hljs-selector-id{color:#900;font-weight:bold}
.hljs-subst{font-weight:normal}
.hljs-type,.hljs-class .hljs-title{color:#458;font-weight:bold}
.hljs-tag,.hljs-name,.hljs-attribute{color:#000080;font-weight:normal}
.hljs-regexp,.hljs-link{color:#009926}
.hljs-symbol,.hljs-bullet{color:#990073}
.hljs-built_in,.hljs-builtin-name{color:#0086b3}
.hljs-meta{color:#999;font-weight:bold}
.hljs-deletion{background:#fdd}
.hljs-addition{background:#dfd}
.hljs-emphasis{font-style:italic}
.hljs-strong{font-weight:bold}

@media print {
  .markdown-body { padding: 0; }
  @page { margin: 20mm 15mm; }
}
`
  }
}

/**
 * 等待浏览器页面渲染就绪。
 * 使用 did-finish-load + requestAnimationFrame 确认帧已提交，
 * 避免硬编码延迟导致大文档导出空白 PDF。
 */
function waitForPageReady(win: BrowserWindow): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      // 安全兜底：5 秒后无论如何继续
      resolve()
    }, 5000)

    win.webContents.on('did-finish-load', () => {
      // 额外等待一帧以确保布局完成
      win.webContents
        .executeJavaScript('document.readyState')
        .then((state) => {
          if (state === 'complete') {
            clearTimeout(timeout)
            resolve()
          }
        })
        .catch(() => {
          clearTimeout(timeout)
          resolve()
        })
    })

    // 如果 loadURL 在监听之前已完成，readyState 已经是 complete
    win.webContents
      .executeJavaScript('document.readyState')
      .then((state) => {
        if (state === 'complete') {
          clearTimeout(timeout)
          resolve()
        }
      })
      .catch(() => {
        // executeJavaScript 可能不可用（offscreen 模式），兜底等待
      })
  })
}
