import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { writeFile, readFile } from './bridge'

const IMPORT_FILTERS = [
  { name: '支持的文件', extensions: ['docx', 'pdf', 'html', 'htm', 'epub'] },
  { name: 'Word 文档', extensions: ['docx'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: '网页', extensions: ['html', 'htm'] },
  { name: '电子书', extensions: ['epub'] },
]

export async function checkPandocAvailable(): Promise<boolean> {
  return invoke('check_pandoc')
}

export interface ImportResult {
  content: string
  suggestedName: string
}

export async function importFile(sourcePath: string): Promise<ImportResult> {
  return invoke('import_file', { sourcePath })
}

export async function importFileDialog(
  rootPath: string,
  openFile: (path: string, content: string) => void,
): Promise<void> {
  const selected = await open({
    multiple: false,
    filters: IMPORT_FILTERS,
  })
  if (!selected) return

  const sourcePath = selected as string
  const result = await importFile(sourcePath)

  // Handle duplicate filenames
  let targetName = result.suggestedName
  let counter = 1
  let targetPath = `${rootPath}/${targetName}`
  while (await fileExists(targetPath)) {
    const base = result.suggestedName.replace(/\.md$/, '')
    targetName = `${base}_${counter}.md`
    targetPath = `${rootPath}/${targetName}`
    counter++
  }

  await writeFile(targetPath, result.content)
  const file = await readFile(targetPath)
  openFile(file.filePath, file.content)
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await invoke('stat_file', { path })
    return true
  } catch {
    return false
  }
}

export { IMPORT_FILTERS }
