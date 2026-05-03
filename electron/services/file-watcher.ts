import fs from 'fs'

export class FileWatcher {
  private watcher: fs.FSWatcher | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(rootPath: string, onChanged: () => void): void {
    this.unwatch()

    this.watcher = fs.watch(rootPath, { recursive: true }, (_eventType, filename) => {
      // 忽略隐藏文件
      if (filename && (filename.startsWith('.') || filename.includes('\\.'))) return

      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      this.debounceTimer = setTimeout(() => {
        onChanged()
      }, 500)
    })
  }

  unwatch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.watcher?.close()
    this.watcher = null
  }
}
