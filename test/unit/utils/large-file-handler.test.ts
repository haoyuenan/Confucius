import { describe, test, expect } from 'vitest'
import { checkLargeFile, LARGE_FILE_THRESHOLD } from '../../../src/editor/large-file-handler'

describe('large-file-handler', () => {
  test('小文件返回 isLarge=false', () => {
    const result = checkLargeFile(100)
    expect(result.isLarge).toBe(false)
  })

  test('等于阈值返回 isLarge=true', () => {
    const result = checkLargeFile(LARGE_FILE_THRESHOLD)
    expect(result.isLarge).toBe(true)
    expect(result.size).toBe(LARGE_FILE_THRESHOLD)
  })

  test('大文件返回 isLarge=true', () => {
    const result = checkLargeFile(LARGE_FILE_THRESHOLD * 2)
    expect(result.isLarge).toBe(true)
  })
})
