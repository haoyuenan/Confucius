/**
 * 从文件路径中提取文件名（不含目录部分）
 * 统一处理 Windows 反斜杠和 POSIX 正斜杠
 */
export function fileNameFromPath(filePath: string): string {
  return filePath.replace(/^.*[/\\]/, '')
}
