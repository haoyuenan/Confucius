export interface SearchResult {
  filePath: string
  fileName: string
  lineNumber: number
  lineContent: string
  matchStart: number
  matchEnd: number
}
