import fs from 'fs/promises'
import path from 'path'
import { decodeBuffer } from './encoding-detector'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
}

export class FileService {
  /**
   * 路径安全校验
   * - 拒绝含 .. 的路径遍历
   * - 拒绝空字节注入
   */
  sanitizePath(inputPath: string): string {
    if (!inputPath || typeof inputPath !== 'string') {
      throw new Error('拒绝：路径为空或类型无效')
    }
    if (inputPath.includes('..')) {
      throw new Error(`拒绝：路径包含非法序列 ".." — ${inputPath}`)
    }
    if (inputPath.includes('\0')) {
      throw new Error('拒绝：路径包含空字节')
    }
    return path.resolve(inputPath)
  }

  async readFileContent(filePath: string): Promise<{ content: string; filePath: string }> {
    const resolvedPath = this.sanitizePath(filePath)
    const buffer = await fs.readFile(resolvedPath)
    const { content, encoding } = decodeBuffer(buffer)
    const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    if (encoding !== 'UTF-8') {
      console.log(`file encoding detected: ${filePath} -> ${encoding}`)
    }
    return { content: normalized, filePath: resolvedPath }
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    const resolvedPath = this.sanitizePath(filePath)
    await fs.mkdir(path.dirname(resolvedPath), { recursive: true })
    await fs.writeFile(resolvedPath, content, 'utf-8')
  }

  async rename(oldPath: string, newName: string): Promise<void> {
    const safeOldPath = this.sanitizePath(oldPath)
    const dir = path.dirname(safeOldPath)
    const newPath = path.join(dir, newName)
    await fs.rename(safeOldPath, newPath)
  }

  async delete(targetPath: string): Promise<void> {
    const safePath = this.sanitizePath(targetPath)
    const stat = await fs.stat(safePath)
    if (stat.isDirectory()) {
      await fs.rm(safePath, { recursive: true, force: true })
    } else {
      await fs.unlink(safePath)
    }
  }

  async stat(targetPath: string) {
    const safePath = this.sanitizePath(targetPath)
    return fs.stat(safePath)
  }

  async readdir(dirPath: string) {
    const safePath = this.sanitizePath(dirPath)
    return fs.readdir(safePath, { withFileTypes: true })
  }

  /** 在指定父目录下创建 Markdown 文件 */
  async createFile(parentPath: string, fileName = '未命名.md'): Promise<string> {
    const safeParent = this.sanitizePath(parentPath)
    const filePath = path.join(safeParent, fileName)
    await fs.mkdir(safeParent, { recursive: true })
    await fs.writeFile(filePath, '', 'utf-8')
    return filePath
  }

  /** 在指定父目录下创建目录 */
  async createDir(parentPath: string, dirName = '新建文件夹'): Promise<string> {
    const safeParent = this.sanitizePath(parentPath)
    const dirPath = path.join(safeParent, dirName)
    await fs.mkdir(dirPath, { recursive: true })
    return dirPath
  }

  /** 迭代栈构建文件树，无递归溢出风险；只显示 .md/.markdown 文件 */
  async buildFileTree(rootPath: string): Promise<FileTreeNode> {
    const safePath = this.sanitizePath(rootPath)
    const rootName = path.basename(safePath)
    const root: FileTreeNode = { name: rootName, path: rootPath, type: 'directory', children: [] }

    const MD_EXT = new Set(['.md', '.markdown'])

    interface StackItem { parent: FileTreeNode; dirPath: string }
    const stack: StackItem[] = [{ parent: root, dirPath: safePath }]

    while (stack.length > 0) {
      const item = stack.pop()!
      const entries = await fs.readdir(item.dirPath, { withFileTypes: true })
      const children: FileTreeNode[] = []

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(item.dirPath, entry.name)
        if (entry.isDirectory()) {
          const child: FileTreeNode = { name: entry.name, path: fullPath, type: 'directory', children: [] }
          stack.push({ parent: child, dirPath: fullPath })
          children.push(child)
        } else if (MD_EXT.has(path.extname(entry.name).toLowerCase())) {
          children.push({ name: entry.name, path: fullPath, type: 'file' })
        }
      }

      children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      item.parent.children = children
    }

    // 剪枝：移除不含任何 .md 文件的空目录
    function prune(node: FileTreeNode): boolean {
      if (node.type === 'file') return true
      if (!node.children) return false
      node.children = node.children.filter(prune)
      return node.children.length > 0
    }
    prune(root)

    return root
  }
}
