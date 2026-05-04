export const LARGE_FILE_THRESHOLD = 1_000_000 // 1MB

export interface LargeFileInfo {
  isLarge: boolean
  size: number
}

export function checkLargeFile(size: number): LargeFileInfo {
  return { isLarge: size >= LARGE_FILE_THRESHOLD, size }
}
