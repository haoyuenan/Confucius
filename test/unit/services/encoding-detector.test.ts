// @vitest-environment node

import { describe, test, expect } from 'vitest'
import { decodeBuffer } from '../../../electron/services/encoding-detector'

describe('encoding-detector', () => {
  test('UTF-8 BOM 检测并去除 BOM 头', () => {
    const raw = Buffer.from('\uFEFF你好世界', 'utf-8')
    const result = decodeBuffer(raw)
    expect(result.encoding).toBe('UTF-8')
    expect(result.content).toBe('你好世界')
  })

  test('UTF-16LE BOM 检测并正确解码', () => {
    const raw = Buffer.from('\uFEFFHello', 'utf-16le')
    const result = decodeBuffer(raw)
    expect(result.encoding).toBe('UTF-16LE')
    expect(result.content).toBe('Hello')
  })

  test('UTF-16BE BOM 检测并正确解码', () => {
    // Node.js Buffer 不支持 'utf-16be' 作为编码，手动构造: BOM(0xFE 0xFF) + 'Test'(UTF-16BE)
    const bom = Buffer.from([0xFE, 0xFF])
    const text = Buffer.from('Test', 'utf-16le')
    // 从 utf-16le 转换: 交换每两个字节得到 utf-16be
    const textBe = Buffer.alloc(text.length)
    for (let i = 0; i < text.length; i += 2) {
      textBe[i] = text[i + 1]
      textBe[i + 1] = text[i]
    }
    const raw = Buffer.concat([bom, textBe])
    const result = decodeBuffer(raw)
    expect(result.encoding).toBe('UTF-16BE')
    expect(result.content).toBe('Test')
  })

  test('GBK 编码检测（不含 BOM）', () => {
    // 使用 iconv-lite 生成可靠的 GBK 编码字节
    const iconv = require('iconv-lite')
    const raw = iconv.encode('中华人民共和国国家标准 GBK 编码测试', 'gbk')
    const result = decodeBuffer(raw)
    expect(result.encoding).toBe('gbk')
    expect(result.content).toBe('中华人民共和国国家标准 GBK 编码测试')
  })

  test('纯 ASCII / UTF-8 无 BOM 归为 UTF-8', () => {
    const raw = Buffer.from('Hello, World!', 'utf-8')
    const result = decodeBuffer(raw)
    expect(result.encoding).toBe('UTF-8')
    expect(result.content).toBe('Hello, World!')
  })

  test('空 buffer 返回空字符串', () => {
    const raw = Buffer.alloc(0)
    const result = decodeBuffer(raw)
    expect(typeof result.content).toBe('string')
    expect(result.content).toBe('')
  })
})
