export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  isExpanded?: boolean
  isSelected?: boolean
}

export interface FlatItem {
  depth: number
  node: FileTreeNode
  isExpandable: boolean
}

export function flattenTree(
  node: FileTreeNode,
  expandedPaths: Set<string>,
  depth: number = 0,
): FlatItem[] {
  const items: FlatItem[] = [
    { depth, node, isExpandable: node.type === 'directory' },
  ]

  if (
    node.type === 'directory' &&
    expandedPaths.has(node.path) &&
    node.children
  ) {
    for (const child of node.children) {
      items.push(...flattenTree(child, expandedPaths, depth + 1))
    }
  }

  return items
}
