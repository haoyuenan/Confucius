import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useVirtualList } from './use-virtual-list'

describe('useVirtualList', () => {
  it('returns correct total height', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemHeight: 28, totalCount: 100 }),
    )
    expect(result.current.totalHeight).toBe(2800)
  })

  it('computes visible range on scroll', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemHeight: 28, totalCount: 100, overscan: 3 }),
    )

    act(() => {
      result.current.onScroll(0, 280)
    })

    // scrollTop=0, containerHeight=280 → start=0, visible count = ceil(280/28) + 6 = 16
    expect(result.current.startIndex).toBe(0)
    expect(result.current.visibleIndices.length).toBeLessThanOrEqual(16)
    expect(result.current.offsetY).toBe(0)
  })

  it('offsets correctly when scrolled down', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemHeight: 28, totalCount: 100, overscan: 0 }),
    )

    act(() => {
      result.current.onScroll(560, 280)
    })

    // scrollTop=560 → startIndex = 560/28 = 20, visible = 280/28 = 10
    expect(result.current.startIndex).toBe(20)
    expect(result.current.offsetY).toBe(560)
    expect(result.current.visibleIndices[0]).toBe(20)
  })

  it('does not exceed total count', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemHeight: 28, totalCount: 5, overscan: 5 }),
    )

    act(() => {
      result.current.onScroll(0, 280)
    })

    expect(result.current.visibleIndices.length).toBeLessThanOrEqual(5)
  })

  it('handles zero items', () => {
    const { result } = renderHook(() =>
      useVirtualList({ itemHeight: 28, totalCount: 0 }),
    )
    expect(result.current.visibleIndices).toEqual([])
    expect(result.current.totalHeight).toBe(0)
  })
})
