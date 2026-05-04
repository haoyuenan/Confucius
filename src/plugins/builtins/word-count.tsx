import { useEffect, useState } from 'react'
import type { Plugin, PluginContext } from '../../types/plugin'
import { useEditorStore } from '../../stores/editor-store'

function countWords(text: string): { words: number; lines: number } {
  const lines = text.split('\n').length
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length
  const englishText = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g, ' ')
  const englishWords = englishText
    .split(/[\s,;.!?()\[\]{}""'':：；。！？（）【】“”]+/)
    .filter(Boolean).length
  const words = chineseChars + englishWords
  return { words, lines }
}

/** 字数统计显示组件（直接读取 store，无需插件手动跟踪内容） */
function WordCountDisplay() {
  const content = useEditorStore((s) => s.content)
  const [selected, setSelected] = useState('')

  useEffect(() => {
    const handler = () => setSelected(window.getSelection()?.toString() ?? '')
    document.addEventListener('selectionchange', handler)
    return () => document.removeEventListener('selectionchange', handler)
  }, [])

  const { words, lines } = countWords(content)
  const parts: string[] = []
  if (selected) parts.push(`选中: ${selected.length}`)
  parts.push(`字数: ${words.toLocaleString()}`)
  parts.push(`行: ${lines}`)

  return <>{parts.join('  ')}</>
}

export class WordCountPlugin implements Plugin {
  manifest = {
    id: 'builtin:word-count',
    name: '字数统计',
    version: '1.0.0',
    description: '实时显示文档字数、行数和选中字数',
  }

  private removeItem: (() => void) | null = null

  onActivate(ctx: PluginContext): void {
    this.removeItem = ctx.addStatusBarItem({
      id: 'word-count',
      priority: 10,
      component: <WordCountDisplay />,
    })
  }

  onDeactivate(): void {
    this.removeItem?.()
  }
}
