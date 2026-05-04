import { useState, useCallback, useRef, useEffect } from 'react'
import { useSidebarStore } from '../../stores/sidebar-store'
import { useTabStore } from '../../stores/tab-store'
import * as bridge from '../../services/electron-bridge'
import type { SearchResult } from '../../types/search'

function SearchPanel() {
  const rootPath = useSidebarStore((s) => s.rootPath)
  const searchResults = useSidebarStore((s) => s.searchResults)
  const isSearching = useSidebarStore((s) => s.isSearching)
  const setSearchResults = useSidebarStore((s) => s.setSearchResults)
  const setIsSearching = useSidebarStore((s) => s.setIsSearching)

  const openFile = useTabStore((s) => s.openFile)

  const [query, setQuery] = useState('')
  const [caseSensitive, setCaseSensitive] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef(false)

  const performSearch = useCallback(
    async (q: string) => {
      if (!rootPath || !q.trim()) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      abortRef.current = false

      try {
        const results = await bridge.searchQuery({
          rootPath,
          query: q.trim(),
          caseSensitive,
          maxResults: 500,
        })
        if (!abortRef.current) {
          setSearchResults(results)
        }
      } catch (err) {
        console.error('搜索失败:', err)
      } finally {
        if (!abortRef.current) {
          setIsSearching(false)
        }
      }
    },
    [rootPath, caseSensitive, setSearchResults, setIsSearching],
  )

  // 防抖搜索
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      abortRef.current = true
      debounceRef.current = setTimeout(() => performSearch(value), 300)
    },
    [performSearch],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  /** 打开搜索结果对应文件 */
  const handleResultClick = useCallback(
    async (result: SearchResult) => {
      try {
        const file = await bridge.readFile(result.filePath)
        openFile(file.filePath, file.content)
      } catch (err) {
        console.error('打开搜索结果文件失败:', err)
      }
    },
    [openFile],
  )

  /** 高亮匹配文本 */
  const highlightMatch = (text: string, start: number, end: number) => {
    const before = text.slice(0, start)
    const match = text.slice(start, end)
    const after = text.slice(end)
    return <>{before}<mark className="search-highlight">{match}</mark>{after}</>
  }

  return (
    <div className="search-panel">
      <div className="search-input-wrapper">
        <input
          className="search-input"
          type="text"
          placeholder="搜索文件内容..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          autoFocus
        />
      </div>

      <div className="search-options">
        <label className="search-option">
          <input type="checkbox" checked={caseSensitive} onChange={(e) => setCaseSensitive(e.target.checked)} />
          区分大小写
        </label>
      </div>

      <div className="search-status">
        {isSearching && <span className="search-loading">搜索中...</span>}
        {!isSearching && query && <span className="search-count">找到 {searchResults.length} 个结果</span>}
      </div>

      <div className="search-results">
        {!rootPath ? (
          <div className="sidebar-empty">先打开文件夹以启用搜索</div>
        ) : searchResults.length === 0 && query && !isSearching ? (
          <div className="sidebar-empty">未找到匹配结果</div>
        ) : (
          searchResults.map((result, idx) => (
            <div
              key={`${result.filePath}-${result.lineNumber}-${idx}`}
              className="search-result-item"
              onClick={() => handleResultClick(result)}
            >
              <div className="result-file">{result.fileName}</div>
              <div className="result-line">
                <span className="result-line-num">{result.lineNumber}:</span>
                <span className="result-line-content">
                  {highlightMatch(result.lineContent, result.matchStart, result.matchEnd)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default SearchPanel
