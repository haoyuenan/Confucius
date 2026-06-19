import { useState, useCallback } from 'react'

interface UseVirtualListOptions {
  itemHeight: number
  overscan?: number
  totalCount: number
}

interface VirtualListResult {
  offsetY: number
  startIndex: number
  visibleIndices: number[]
  totalHeight: number
  onScroll: (scrollTop: number, containerHeight: number) => void
}

export function useVirtualList({
  itemHeight,
  overscan = 5,
  totalCount,
}: UseVirtualListOptions): VirtualListResult {
  const [range, setRange] = useState({ start: 0, visible: overscan * 2 + 10 })

  const onScroll = useCallback(
    (scrollTop: number, containerHeight: number) => {
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
      const visible = Math.ceil(containerHeight / itemHeight) + overscan * 2
      setRange({ start, visible })
    },
    [itemHeight, overscan],
  )

  const endIndex = Math.min(totalCount, range.start + range.visible)
  const visibleIndices: number[] = []
  for (let i = range.start; i < endIndex; i++) {
    visibleIndices.push(i)
  }

  return {
    offsetY: range.start * itemHeight,
    startIndex: range.start,
    visibleIndices,
    totalHeight: totalCount * itemHeight,
    onScroll,
  }
}
