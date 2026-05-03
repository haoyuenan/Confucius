import { describe, test, expect } from 'vitest'
import { fileNameFromPath } from '../../../src/utils/path'

describe('path', () => {
  test('POSIX 正斜杠提取文件名', () => {
    expect(fileNameFromPath('/a/b/c.md')).toBe('c.md')
  })

  test('Windows 反斜杠提取文件名', () => {
    expect(fileNameFromPath('C:\\Users\\test\\doc.md')).toBe('doc.md')
  })

  test('无分隔符返回原值', () => {
    expect(fileNameFromPath('readme.md')).toBe('readme.md')
  })

  test('多层深路径', () => {
    expect(fileNameFromPath('/project/src/utils/helpers.ts')).toBe('helpers.ts')
  })
})
