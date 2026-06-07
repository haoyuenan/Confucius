import { CompletionContext, CompletionResult } from '@codemirror/autocomplete'
import { useKnowledgeStore } from '../stores/knowledge-store'

export async function tagCompletion(context: CompletionContext): Promise<CompletionResult | null> {
  const word = context.matchBefore(/(?:^|\s)#([\w\u4e00-\u9fff/-]*)$/)
  if (!word) return null
  const query = word.text.replace(/^.*#/, '')
  const tags = useKnowledgeStore.getState().tags
  const allTags = Object.keys(tags)
  if (allTags.length === 0) return null
  const filtered = allTags.filter(t => t.includes(query))
  return {
    from: word.text.lastIndexOf('#') + word.from + 1,
    options: filtered.map(t => ({ label: t, type: 'keyword' })),
  }
}
