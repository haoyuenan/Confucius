import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  loadConfig,
  saveConfig,
  checkHealth,
  listModels,
  streamGenerate,
  type AIConfig,
} from '../../../src/services/ai-service'

const baseConfig: AIConfig = {
  endpoint: 'http://localhost:11434',
  model: 'qwen2.5:7b',
  language: 'zh',
}

const encoder = new TextEncoder()

function chunkStream(lines: string[]) {
  const chunks = lines.map((l) => encoder.encode(l))
  let i = 0
  return {
    read: vi.fn(async () => {
      if (i < chunks.length) {
        const value = chunks[i++]
        return { done: false, value }
      }
      return { done: true, value: undefined as unknown as Uint8Array }
    }),
  }
}

beforeEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('ai-service config', () => {
  it('无配置时返回默认值', () => {
    expect(loadConfig()).toEqual(baseConfig)
  })

  it('loadConfig 读取已保存配置', () => {
    localStorage.setItem(
      'confucius-ai-config',
      JSON.stringify({ endpoint: 'http://x', model: 'm', language: 'en' }),
    )
    expect(loadConfig()).toEqual({ endpoint: 'http://x', model: 'm', language: 'en' })
  })

  it('loadConfig 遇非法 JSON 回退默认值', () => {
    localStorage.setItem('confucius-ai-config', 'not json{{')
    expect(loadConfig()).toEqual(baseConfig)
  })

  it('saveConfig 持久化到 localStorage', () => {
    saveConfig({ ...baseConfig, model: 'llama3' })
    expect(JSON.parse(localStorage.getItem('confucius-ai-config')!)).toMatchObject({ model: 'llama3' })
  })
})

describe('checkHealth', () => {
  it('正常响应时返回 true', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true })))
    await expect(checkHealth('http://x')).resolves.toBe(true)
  })

  it('非 2xx 返回 false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    await expect(checkHealth('http://x')).resolves.toBe(false)
  })

  it('网络异常返回 false', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    await expect(checkHealth('http://x')).resolves.toBe(false)
  })
})

describe('listModels', () => {
  it('解析模型名列表', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ models: [{ name: 'a' }, { name: 'b' }] }) })),
    )
    await expect(listModels('http://x')).resolves.toEqual(['a', 'b'])
  })

  it('模型数据缺失时返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({}) })))
    await expect(listModels('http://x')).resolves.toEqual([])
  })

  it('json 解析失败返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => { throw new Error('bad') } })))
    await expect(listModels('http://x')).resolves.toEqual([])
  })

  it('网络异常返回空数组', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    await expect(listModels('http://x')).resolves.toEqual([])
  })
})

describe('streamGenerate', () => {
  it('流式收集 token 并触发 onDone', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: { getReader: () => chunkStream(['{"response":"Hello"}\n', '\n', '{"response":" World"}\n']) },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const onToken = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()
    await streamGenerate(baseConfig, 'summarize', 'some text', { onToken, onDone, onError })

    expect(fetchMock).toHaveBeenCalledWith(
      `${baseConfig.endpoint}/api/generate`,
      expect.objectContaining({ method: 'POST' }),
    )
    expect(onToken).toHaveBeenCalledTimes(2)
    expect(onDone).toHaveBeenCalledWith('Hello World')
    expect(onError).not.toHaveBeenCalled()
  })

  it('跳过格式错误的行', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body: { getReader: () => chunkStream(['not json\n', '{"response":"ok"}\n']) },
      })),
    )
    const onDone = vi.fn()
    const onError = vi.fn()
    await streamGenerate(baseConfig, 'rewrite', 't', { onToken: vi.fn(), onDone, onError })
    expect(onDone).toHaveBeenCalledWith('ok')
    expect(onError).not.toHaveBeenCalled()
  })

  it('非 2xx 响应触发 onError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })))
    const onError = vi.fn()
    await streamGenerate(baseConfig, 'translate', 'text', {
      onToken: vi.fn(),
      onDone: vi.fn(),
      onError,
    })
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('缺少响应体触发 onError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, body: undefined })))
    const onError = vi.fn()
    await streamGenerate(baseConfig, 'expand', 'text', { onToken: vi.fn(), onDone: vi.fn(), onError })
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('网络异常触发 onError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('down') }))
    const onError = vi.fn()
    await streamGenerate(baseConfig, 'translate', 'text', { onToken: vi.fn(), onDone: vi.fn(), onError })
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('中文文本做翻译时请求体包含源文本', async () => {
    const fetchMock = vi.fn(async (_url: string, _opts?: RequestInit) => ({
      ok: true,
      status: 200,
      body: { getReader: () => chunkStream(['{"response":"hi"}\n']) },
    }))
    vi.stubGlobal('fetch', fetchMock)
    await streamGenerate(baseConfig, 'translate', '你好世界', { onToken: vi.fn(), onDone: vi.fn(), onError: vi.fn() })
    const [, opts] = fetchMock.mock.calls[0]
    const body = JSON.parse((opts as RequestInit).body as string)
    expect(body.prompt).toContain('你好世界')
  })
})
