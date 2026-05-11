/**
 * 最近文件服务 — 基于 localStorage 持久化
 * 最多保留 10 条，按最后打开时间降序排列
 */

const KEY = 'confucius:recent-files'
const MAX = 10

export interface RecentFile {
  filePath: string
  /** 文件名（不含路径） */
  fileName: string
  /** 最后打开时间戳 */
  lastOpenedAt: number
}

function load(): RecentFile[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as RecentFile[]
  } catch {
    return []
  }
}

function save(list: RecentFile[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch { /* 存储满时静默忽略 */ }
}

/** 从路径中提取文件名 */
function nameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath
}

/** 添加或更新一条最近记录 */
export function addRecentFile(filePath: string): void {
  const list = load().filter((f) => f.filePath !== filePath)
  list.unshift({ filePath, fileName: nameFromPath(filePath), lastOpenedAt: Date.now() })
  save(list.slice(0, MAX))
}

/** 获取最近文件列表（降序） */
export function getRecentFiles(): RecentFile[] {
  return load()
}

/** 清除所有最近记录 */
export function clearRecentFiles(): void {
  localStorage.removeItem(KEY)
}

/** 移除单条记录（文件被删除时调用） */
export function removeRecentFile(filePath: string): void {
  save(load().filter((f) => f.filePath !== filePath))
}
