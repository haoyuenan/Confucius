/**
 * EventBus — 插件间事件总线
 *
 * 支持发布/订阅模式，卸载时自动清理所有订阅。
 */

export interface EventDefinitions {
  'file:opened': { path: string }
  'file:saved': { path: string; content: string }
  'file:closed': { path: string }
  'editor:content-change': { content: string }
  'editor:cursor-move': { line: number; col: number }
  'editor:selection-change': { text: string }
  'theme:switched': { theme: string }
  'mode:switched': { mode: string }
  'app:ready': Record<string, never>
  'app:before-quit': Record<string, never>
  'plugin:activated': { id: string }
  'plugin:deactivated': { id: string }
  'plugin:error': { pluginId: string; message: string }
}

export type EventName = keyof EventDefinitions
export type EventPayload<N extends EventName> = EventDefinitions[N]

export class EventBus {
  private listeners = new Map<string, Set<{ pluginId: string; handler: (payload: any) => void }>>()

  /** 订阅事件，返回取消订阅函数 */
  on<N extends EventName>(
    pluginId: string,
    event: N,
    handler: (payload: EventPayload<N>) => void,
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    const entry = { pluginId, handler: handler as (p: any) => void }
    this.listeners.get(event)!.add(entry)

    return () => {
      this.listeners.get(event)?.delete(entry)
    }
  }

  /** 发布事件 */
  emit<N extends EventName>(event: N, payload: EventPayload<N>): void {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    for (const entry of handlers) {
      try {
        entry.handler(payload)
      } catch (err) {
        console.error(`[EventBus] 插件 ${entry.pluginId} 处理事件 ${event} 出错:`, err)
      }
    }
  }

  /** 清除指定插件的所有订阅（卸载时调用） */
  removeAllByPlugin(pluginId: string): void {
    for (const [, handlers] of this.listeners) {
      for (const entry of handlers) {
        if (entry.pluginId === pluginId) {
          handlers.delete(entry)
        }
      }
    }
  }

  /** 清除所有订阅 */
  clear(): void {
    this.listeners.clear()
  }
}
