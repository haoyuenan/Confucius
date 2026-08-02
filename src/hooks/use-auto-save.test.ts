import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAutoSave } from './use-auto-save'
import { useTabStore } from '../stores/tab-store'

// 只需要 writeFile；tab-store 在本测试路径里不会触发其它 bridge 调用
vi.mock('../services/bridge', () => ({
  writeFile: vi.fn(() => Promise.resolve()),
}))

import * as bridge from '../services/bridge'

const AUTOSAVE_KEY = 'confucius-autosave-interval'

function openModifiedTab(path = '/note.md') {
  const store = useTabStore.getState()
  store.openFile(path, 'original')
  const id = useTabStore.getState().activeTab()!.id
  store.updateContent(id, 'edited') // 标记为已修改
  return id
}

beforeEach(() => {
  vi.useFakeTimers()
  ;(bridge.writeFile as ReturnType<typeof vi.fn>).mockClear()
  localStorage.clear()
  useTabStore.setState({ tabs: [], activeTabId: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useAutoSave', () => {
  it('默认间隔（5s）后保存已修改的活跃文件', async () => {
    const id = openModifiedTab()
    renderHook(() => useAutoSave())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(bridge.writeFile).toHaveBeenCalledTimes(1)
    expect(bridge.writeFile).toHaveBeenCalledWith('/note.md', 'edited')
    // 保存后应标记为未修改
    expect(useTabStore.getState().tabs.find(t => t.id === id)!.isModified).toBe(false)
  })

  it('未修改的文件不触发保存', async () => {
    useTabStore.getState().openFile('/clean.md', 'x')

    renderHook(() => useAutoSave())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(bridge.writeFile).not.toHaveBeenCalled()
  })

  it('无文件路径的未命名标签不触发保存', async () => {
    const store = useTabStore.getState()
    store.newUntitledTab()
    const id = useTabStore.getState().activeTab()!.id
    store.updateContent(id, 'draft')

    renderHook(() => useAutoSave())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(bridge.writeFile).not.toHaveBeenCalled()
  })

  it('从 localStorage 读取自定义间隔', async () => {
    localStorage.setItem(AUTOSAVE_KEY, '2000')
    openModifiedTab()
    renderHook(() => useAutoSave())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1999)
    })
    expect(bridge.writeFile).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(bridge.writeFile).toHaveBeenCalledTimes(1)
  })

  it('写入期间继续输入不会误标已保存，下一轮会保存最新内容', async () => {
    const id = openModifiedTab()
    renderHook(() => useAutoSave())

    // 第一次写盘挂起（模拟慢写入）
    let resolveWrite!: (v: unknown) => void
    ;(bridge.writeFile as ReturnType<typeof vi.fn>)
      .mockImplementationOnce(() => new Promise((r) => { resolveWrite = r }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(bridge.writeFile).toHaveBeenCalledWith('/note.md', 'edited')

    // 写入进行中，用户继续输入
    act(() => {
      useTabStore.getState().updateContent(id, 'edited-while-saving')
    })
    expect(useTabStore.getState().tabs.find(t => t.id === id)!.isModified).toBe(true)

    // 写入完成：内容已变化 → 不得标记已保存
    await act(async () => {
      resolveWrite(undefined)
    })
    const tab = useTabStore.getState().tabs.find(t => t.id === id)!
    expect(tab.isModified).toBe(true)
    expect(tab.savedContent).toBe('original')

    // 下一轮自动保存最新内容并标记已保存
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(bridge.writeFile).toHaveBeenLastCalledWith('/note.md', 'edited-while-saving')
    expect(useTabStore.getState().tabs.find(t => t.id === id)!.isModified).toBe(false)
  })

  it('运行中修改间隔设置会在下一轮重新读取', async () => {
    const id = openModifiedTab()
    renderHook(() => useAutoSave())

    // 首个定时器以默认 5000 注册；在它触发前把间隔改小为 1000。
    // 第一轮结束时会以新的 1000 间隔重新调度下一轮。
    localStorage.setItem(AUTOSAVE_KEY, '1000')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })
    expect(bridge.writeFile).toHaveBeenCalledTimes(1)

    act(() => {
      useTabStore.getState().updateContent(id, 'edited-again')
    })

    // 若是固定 setInterval(5000)，第二次保存要到 t=10000 才发生；
    // 递归重读间隔后，第二轮仅在 1000ms 后即触发 —— 证明间隔被重新读取
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(bridge.writeFile).toHaveBeenCalledTimes(2)
  })
})
