import { useEffect, useState, useCallback } from 'react'
import { useKnowledgeStore } from '../../stores/knowledge-store'
import { useTabStore } from '../../stores/tab-store'
import * as bridge from '../../services/electron-bridge'

export function TagPanel() {
  const { tags, loadTags } = useKnowledgeStore()
  const openFile = useTabStore(s => s.openFile)
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  useEffect(() => { loadTags() }, [loadTags])

  const sorted = Object.entries(tags).sort(([a], [b]) => a.localeCompare(b))

  const handleOpenFile = useCallback(async (filePath: string) => {
    try {
      const file = await bridge.readFile(filePath)
      openFile(file.filePath, file.content)
    } catch {
      // file deleted
    }
  }, [openFile])

  return (
    <div className="sidebar-panel tag-panel">
      {sorted.length === 0 ? (
        <div className="sidebar-hint">暂无标签</div>
      ) : (
        <>
          <div className="sidebar-tag-list">
            {sorted.map(([tag, files]) => (
              <div
                key={tag}
                className={`sidebar-tag-item ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
              >
                <span className="sidebar-tag-name">#{tag}</span>
                <span className="sidebar-count">{files.length}</span>
              </div>
            ))}
          </div>
          {selectedTag && tags[selectedTag] && (
            <div className="sidebar-section">
              <div className="sidebar-section-title"># {selectedTag}</div>
              <ul className="sidebar-file-list">
                {tags[selectedTag].map(fp => (
                  <li key={fp} className="sidebar-file-item" onClick={() => handleOpenFile(fp)}>
                    <span className="sidebar-file-name">{fp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
