/**
 * DependencyGraph — 插件依赖关系图（拓扑排序）
 *
 * 使用 Kahn 算法进行拓扑排序，检测循环依赖。
 */
export class CyclicDependencyError extends Error {
  constructor(public cyclicIds: string[]) {
    super(`循环依赖: ${cyclicIds.join(' → ')}`)
    this.name = 'CyclicDependencyError'
  }
}

export class DependencyGraph {
  private edges: Map<string, Set<string>> = new Map()

  /** 注册插件的依赖关系 */
  add(id: string, dependencies: string[]): void {
    this.edges.set(id, new Set(dependencies))
  }

  /** 移除插件 */
  remove(id: string): void {
    this.edges.delete(id)
    for (const [, deps] of this.edges) {
      deps.delete(id)
    }
  }

  /**
   * 拓扑排序（Kahn 算法）
   * @throws CyclicDependencyError 当检测到循环依赖时
   */
  resolveOrder(ids: string[]): string[] {
    const inDegree = new Map<string, number>()
    const adjacency = new Map<string, string[]>()

    for (const id of ids) {
      inDegree.set(id, 0)
      adjacency.set(id, [])
    }

    for (const id of ids) {
      const deps = this.edges.get(id) || new Set()
      for (const dep of deps) {
        if (!ids.includes(dep)) continue
        adjacency.get(dep)!.push(id)
        inDegree.set(id, (inDegree.get(id) || 0) + 1)
      }
    }

    const queue: string[] = []
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id)
    }

    const result: string[] = []
    while (queue.length > 0) {
      const id = queue.shift()!
      result.push(id)
      for (const dependent of adjacency.get(id) || []) {
        const newDegree = (inDegree.get(dependent) || 0) - 1
        inDegree.set(dependent, newDegree)
        if (newDegree === 0) queue.push(dependent)
      }
    }

    if (result.length !== ids.length) {
      const cyclic = ids.filter((id) => (inDegree.get(id) || 0) > 0)
      throw new CyclicDependencyError(cyclic)
    }

    return result
  }

  /** 检查指定插件的依赖是否全部已注册 */
  getMissing(pluginId: string, registeredIds: Set<string>): string[] {
    const deps = this.edges.get(pluginId)
    if (!deps) return []
    return Array.from(deps).filter((id) => !registeredIds.has(id))
  }
}
