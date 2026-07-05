export const LARGE_FILE_THRESHOLD = 500_000 // 500KB — 超过此大小使用流式渲染
export const STREAM_CHUNK_SIZE = 4 * 1024  // 4KB per streaming chunk

export interface LargeFileInfo {
  isLarge: boolean
  size: number
  useStreaming: boolean
}

export function checkLargeFile(size: number): LargeFileInfo {
  const isLarge = size >= LARGE_FILE_THRESHOLD
  return { isLarge, size, useStreaming: isLarge }
}
