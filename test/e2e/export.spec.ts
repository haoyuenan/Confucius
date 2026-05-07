import { test, expect, typeInEditor } from './helpers'

test.describe('Export E2E', () => {
  test('should generate preview HTML for export', async ({ appPage }) => {
    // 在编辑器中输入 Markdown 内容
    await typeInEditor(appPage, '# Hello')
    // 等待预览面板渲染
    await appPage.waitForSelector('[data-testid="preview-pane"]', { timeout: 5_000 })
    await appPage.waitForTimeout(500) // 等待 markdown-it 渲染完成

    // 调用预览 HTML 导出函数
    const previewHTML = await appPage.evaluate(() => (window as any).__exportPreviewHTML__())

    // 验证返回值为非空字符串
    expect(typeof previewHTML).toBe('string')
    expect(previewHTML.length).toBeGreaterThan(0)
    expect(previewHTML).toContain('Hello')
  })

  test('should have export preview function available', async ({ appPage }) => {
    // 验证 __exportPreviewHTML__ 函数存在于 window 上
    const exportFunctionExists = await appPage.evaluate(
      () => typeof (window as any).__exportPreviewHTML__ === 'function',
    )
    expect(exportFunctionExists).toBe(true)

    // 输入内容并验证导出函数返回有效 HTML
    await typeInEditor(appPage, '# Test Export')
    await appPage.waitForSelector('[data-testid="preview-pane"]', { timeout: 5_000 })
    await appPage.waitForTimeout(500)

    const previewHTML = await appPage.evaluate(() => (window as any).__exportPreviewHTML__())
    expect(typeof previewHTML).toBe('string')
    expect(previewHTML.length).toBeGreaterThan(0)
    expect(previewHTML).toContain('Test Export')
  })
})
