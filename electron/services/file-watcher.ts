import fs from 'fs'

export class FileWatcher {
  private watcher: fs.FSWatcher | null = null
  private pollingTimer: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(rootPath: string, onChanged: () => void): void {
    this.unwatch()

    // 优先使用 fs.watch（recursive），失败时降级为轮询
    try {
      this.watcher = fs.watch(rootPath, { recursive: true }, (_eventType, filename) => {
        if (filename && (filename.startsWith('.') || filename.includes('\\.'))) return
        this.debounceNotify(onChanged)
      })
    } catch {
      // Linux 上 recursive: true 可能不支持，降级为轮询检查目录 mtime
      console.warn('fs.watch recursive 不可用，降级为轮询模式')
      let lastMtime = 0
      try { lastMtime = fs.statSync(rootPath).mtimeMs } catch { /* ignore */ }
      this.pollingTimer = setInterval(() => {
        try {
          const currentMtime = fs.statSync(rootPath).mtimeMs
          if (currentMtime !== lastMtime) {
            lastMtime = currentMtime
            this.debounceNotify(onChanged)
          }
        } catch { /* 目录不可访问时跳过 */ }
      }, 2000)
    }
  }

  private debounceNotify(onChanged: () => void): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => {
      onChanged()
    }, 500)
  }

  unwatch(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = null
    }
    this.watcher?.close()
    this.watcher = null
  }
}
