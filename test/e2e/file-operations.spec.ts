import { test, expect, typeInEditor, dispatchMenuAction } from './helpers'

test.describe('File Operations E2E', () => {
  test('should create new untitled tab', async ({ appPage }) => {
    // 初始状态：应用启动时有一个"未命名"标签
    const initialTabCount = await appPage.locator('[data-testid="tab-item"]').count()
    expect(initialTabCount).toBe(1)

    // 点击新建标签按钮
    await appPage.locator('[data-testid="tab-new"]').click()

    // 验证新标签出现
    const newTabCount = await appPage.locator('[data-testid="tab-item"]').count()
    expect(newTabCount).toBe(initialTabCount + 1)

    // 验证新标签名称包含"未命名"
    const tabNames = await appPage.locator('[data-testid="tab-name"]').allTextContents()
    const hasUntitledTab = tabNames.some((name) => name.includes('未命名'))
    expect(hasUntitledTab).toBe(true)
  })

  test('should show modified indicator after typing', async ({ appPage }) => {
    // 在编辑器中输入文本
    await typeInEditor(appPage, 'Hello, World!')

    // 验证标题栏显示修改指示器
    await expect(appPage.locator('.modified-dot')).toBeVisible()

    const titleText = await appPage.locator('.app-titlebar .app-title').textContent()
    expect(titleText).toContain('●')
  })

  test('should close a tab', async ({ appPage }) => {
    // 先创建第二个标签（应用启动时只有1个标签）
    await appPage.locator('[data-testid="tab-new"]').click()

    // 验证有2个标签
    const initialTabCount = await appPage.locator('[data-testid="tab-item"]').count()
    expect(initialTabCount).toBe(2)

    // 关闭第一个标签
    await appPage.locator('[data-testid="tab-close"]').first().click()

    // 验证标签数量减少
    const newTabCount = await appPage.locator('[data-testid="tab-item"]').count()
    expect(newTabCount).toBe(1)
  })

  test('should create tab via menu action', async ({ appPage }) => {
    // 获取初始标签数量
    const initialTabCount = await appPage.locator('[data-testid="tab-item"]').count()

    // 通过 CustomEvent 发送 file:new 菜单动作
    await dispatchMenuAction(appPage, 'file:new')
    await appPage.waitForTimeout(200)

    // 验证创建了新标签
    const newTabCount = await appPage.locator('[data-testid="tab-item"]').count()
    expect(newTabCount).toBe(initialTabCount + 1)

    // 验证新标签名称包含"未命名"
    const tabNames = await appPage.locator('[data-testid="tab-name"]').allTextContents()
    const hasUntitledTab = tabNames.some((name) => name.includes('未命名'))
    expect(hasUntitledTab).toBe(true)
  })
})
