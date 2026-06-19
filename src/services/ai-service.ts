export interface AIConfig {
  endpoint: string
  model: string
  language: 'zh' | 'en'
}

export type AIAction = 'translate' | 'summarize' | 'rewrite' | 'expand'

interface StreamCallback {
  onToken: (token: string) => void
  onDone: (fullText: string) => void
  onError: (error: Error) => void
}

const STORAGE_KEY = 'confucius-ai-config'

export function loadConfig(): AIConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* fall through */ }
  return { endpoint: 'http://localhost:11434', model: 'qwen2.5:7b', language: 'zh' }
}

export function saveConfig(config: AIConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export async function checkHealth(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/api/tags`)
    return res.ok
  } catch {
    return false
  }
}

export async function listModels(endpoint: string): Promise<string[]> {
  try {
    const res = await fetch(`${endpoint}/api/tags`)
    const data = await res.json()
    return (data.models || []).map((m: { name: string }) => m.name)
  } catch {
    return []
  }
}

const SYSTEM_PROMPTS: Record<AIAction, string> = {
  translate:
    'You are a translation assistant. Translate the following text to {target}. Return only the translated text, no explanations.',
  summarize:
    'You are a summarization assistant. Extract the key points in 3-5 concise sentences. If the text is in Chinese, respond in Chinese. Return only the summary.',
  rewrite:
    'You are a writing assistant. Improve the following text for clarity and fluency while preserving the original meaning. If the text is in Chinese, respond in Chinese. Return only the improved text.',
  expand:
    'You are a writing assistant. Expand on the following text to provide more depth and elaboration. Maintain the same tone and language as the input. Return only the expanded text.',
}

export async function streamGenerate(
  config: AIConfig,
  action: AIAction,
  text: string,
  cb: StreamCallback,
): Promise<void> {
  const target = config.language === 'zh' ? 'Chinese' : 'English'
  let system = SYSTEM_PROMPTS[action].replace('{target}', target)
  if (action === 'translate') {
    const isChinese = /[\u4e00-\u9fff]/.test(text)
    system = system.replace('{target}', isChinese ? 'English' : 'Chinese')
  }

  try {
    const res = await fetch(`${config.endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        prompt: `${system}\n\n${text}`,
        stream: true,
      }),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let fullText = ''
    let buffer = ''

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const data = JSON.parse(line)
          if (data.response) {
            fullText += data.response
            cb.onToken(data.response)
          }
        } catch { /* skip malformed lines */ }
      }
    }

    cb.onDone(fullText)
  } catch (err) {
    cb.onError(err as Error)
  }
}
