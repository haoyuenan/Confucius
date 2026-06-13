import { test, expect, typeInEditor, getEditorContent, selectAllInEditor, dispatchMenuAction } from './helpers'

test.describe('Editor E2E', () => {
  test.beforeEach(async ({ appPage }) => {
    // 等待编辑器准备就绪
    await appPage.waitForSelector('[data-testid="editor-pane"]', { timeout: 10_000 })
  })

  test('should type text in editor', async ({ appPage }) => {
    await typeInEditor(appPage, 'Hello World')
    const content = await getEditorContent(appPage)
    expect(content).toContain('Hello World')
  })

  test('should apply bold formatting', async ({ appPage }) => {
    // 输入文本
    await typeInEditor(appPage, 'hello')
    // 全选
    await selectAllInEditor(appPage)
    // 点击加粗按钮
    await appPage.locator('[data-testid="format-btn-B"]').click()
    // 验证内容包含加粗标记
    const content = await getEditorContent(appPage)
    expect(content).toContain('**hello**')
  })

  test('should switch to WYSIWYG mode', async ({ appPage }) => {
    // 通过 CustomEvent 发送菜单动作切换模式
    await dispatchMenuAction(appPage, 'mode:toggle')
    // 验证 WYSIWYG 布局出现
    await expect(appPage.locator('.wysiwyg-layout')).toBeVisible()
  })

  test('should switch to preview mode', async ({ appPage }) => {
    // 通过 CustomEvent 发送菜单动作
    await dispatchMenuAction(appPage, 'mode:preview')
    // 验证预览面板可见
    await expect(appPage.locator('[data-testid="preview-pane"]')).toBeVisible()
    // 验证分栏面板隐藏
    await expect(appPage.locator('.split-pane')).toBeHidden()
  })

  test('should toggle focus mode', async ({ appPage }) => {
    // 通过 CustomEvent 发送菜单动作
    await dispatchMenuAction(appPage, 'focus:mode')
    // 专注模式在 CM6 的 .cm-editor DOM 上添加 focus-mode-active class
    const cmEditor = appPage.locator('.cm-editor')
    await expect(cmEditor).toHaveClass(/focus-mode-active/)
  })
})
