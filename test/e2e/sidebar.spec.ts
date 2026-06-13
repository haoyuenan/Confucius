import { test, expect, dispatchMenuAction } from './helpers'

test.describe('Sidebar E2E', () => {
  test('should switch sidebar tabs', async ({ appPage }) => {
    const fileTreeTab = appPage.locator('[data-testid="sidebar-tab-file-tree"]')
    const outlineTab = appPage.locator('[data-testid="sidebar-tab-outline"]')
    const searchTab = appPage.locator('[data-testid="sidebar-tab-search"]')

    // 默认激活的是"文件"标签
    await expect(fileTreeTab).toHaveClass(/active/)

    // 点击"大纲"标签 → 验证大纲面板可见
    await outlineTab.click()
    await expect(outlineTab).toHaveClass(/active/)

    // 点击"搜索"标签 → 验证搜索输入框可见
    await searchTab.click()
    await expect(searchTab).toHaveClass(/active/)
    await expect(appPage.locator('[data-testid="search-input"]')).toBeVisible()

    // 点击"文件"标签 → 验证文件树面板可见
    await fileTreeTab.click()
    await expect(fileTreeTab).toHaveClass(/active/)
  })

  test('should toggle sidebar visibility', async ({ appPage }) => {
    const sidebar = appPage.locator('.app-sidebar')

    // 初始状态：侧边栏可见
    await expect(sidebar).toBeVisible()
    await expect(sidebar).not.toHaveClass(/collapsed/)

    // 发送 view:toggle-sidebar 菜单动作
    await dispatchMenuAction(appPage, 'view:toggle-sidebar')
    // 验证侧边栏折叠
    await expect(sidebar).toHaveClass(/collapsed/)

    // 再次发送切换动作
    await dispatchMenuAction(appPage, 'view:toggle-sidebar')
    // 验证侧边栏展开
    await expect(sidebar).not.toHaveClass(/collapsed/)
  })

  test('should show search input and empty state', async ({ appPage }) => {
    // 点击"搜索"标签
    await appPage.locator('[data-testid="sidebar-tab-search"]').click()

    // 验证搜索输入框可见
    const searchInput = appPage.locator('[data-testid="search-input"]')
    await expect(searchInput).toBeVisible()

    // 输入搜索词
    await searchInput.fill('test query')
    await expect(searchInput).toHaveValue('test query')

    // 未打开文件夹时应显示空状态提示
    await expect(appPage.locator('text=先打开文件夹以启用搜索')).toBeVisible()
  })
})
