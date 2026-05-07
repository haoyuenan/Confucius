import { test as base, expect, type ElectronApplication, type Page } from '@playwright/test'
import { _electron as electron } from 'playwright'
import path from 'path'

/**
 * 自定义 fixture：启动 Electron 应用并暴露 appPage 和 electronApp
 */
type AppFixture = {
  electronApp: ElectronApplication
  appPage: Page
}

export const test = base.extend<AppFixture>({
  electronApp: async ({}, use) => {
    const appPath = path.resolve(__dirname, '../../dist-electron/main.js')
    const electronApp = await electron.launch({
      args: [appPath],
      env: {
        ...process.env,
        ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      },
    })
    await use(electronApp)
    await electronApp.close()
  },
  appPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    // 等待应用完成初始渲染
    await page.waitForLoadState('domcontentloaded')
    // 等待编辑器容器出现
    await page.waitForSelector('.editor-area', { timeout: 15_000 })
    await use(page)
  },
})

export { expect }

/**
 * 辅助：获取 CM6 编辑器中的文本内容
 */
export async function getEditorContent(page: Page): Promise<string> {
  return page.evaluate(() => {
    const view = (window as any).__cm6View
    return view ? view.state.doc.toString() : ''
  })
}

/**
 * 辅助：在 CM6 编辑器中输入文本
 */
export async function typeInEditor(page: Page, text: string): Promise<void> {
  const editorPane = page.locator('[data-testid="editor-pane"]')
  await editorPane.click()
  await page.keyboard.type(text, { delay: 30 })
}

/**
 * 辅助：选中编辑器中所有文本
 */
export async function selectAllInEditor(page: Page): Promise<void> {
  const editorPane = page.locator('[data-testid="editor-pane"]')
  await editorPane.click()
  await page.keyboard.press('Control+a')
}

/**
 * 辅助：获取活动标签页的文件名
 */
export async function getActiveTabName(page: Page): Promise<string> {
  const activeTab = page.locator('[data-testid="tab-item"]').filter({ has: page.locator('.active') })
  const name = activeTab.locator('[data-testid="tab-name"]')
  return name.textContent() ?? ''
}
