export const LARGE_FILE_THRESHOLD = 500_000 // 500KB — 超过此大小视为大文件（跳过 Mermaid、强制双栏）

export interface LargeFileInfo {
  isLarge: boolean
  size: number
}

export function checkLargeFile(size: number): LargeFileInfo {
  return { isLarge: size >= LARGE_FILE_THRESHOLD, size }
}
