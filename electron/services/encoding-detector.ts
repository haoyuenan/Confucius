import jschardet from 'jschardet'
import iconv from 'iconv-lite'

export interface DetectResult {
  encoding: string
  content: string
}

/**
 * 检测文件编码并解码为 UTF-8 字符串
 * 支持：UTF-8, GBK/GB2312, Shift-JIS, Big5, EUC-KR, ISO-8859-1 等
 */
export function decodeBuffer(buffer: Buffer): DetectResult {
  // 检查 BOM
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return { encoding: 'UTF-8', content: buffer.toString('utf-8', 3) }
  }
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
    return { encoding: 'UTF-16LE', content: iconv.decode(buffer, 'utf-16le') }
  }
  if (buffer.length >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
    return { encoding: 'UTF-16BE', content: iconv.decode(buffer, 'utf-16be') }
  }

  // 使用 jschardet 检测编码
  const detected = jschardet.detect(buffer)
  const encoding = detected?.encoding || 'utf-8'

  // 统一编码名称为 iconv-lite 可识别的格式
  const normalizedEncoding = normalizeEncoding(encoding)

  try {
    if (normalizedEncoding === 'utf-8' || normalizedEncoding === 'utf8') {
      return { encoding: 'UTF-8', content: buffer.toString('utf-8') }
    }
    const content = iconv.decode(buffer, normalizedEncoding)
    return { encoding: normalizedEncoding, content }
  } catch {
    // 降级为 UTF-8
    return { encoding: 'UTF-8 (fallback)', content: buffer.toString('utf-8') }
  }
}

function normalizeEncoding(enc: string): string {
  const lower = enc.toLowerCase().replace(/[^a-z0-9]/g, '')
  const map: Record<string, string> = {
    utf8: 'utf-8',
    utf_8: 'utf-8',
    ascii: 'utf-8',       // ASCII 是 UTF-8 的合法子集
    gb2312: 'gbk',
    gbk: 'gbk',
    'gb18030': 'gbk',
    big5: 'big5',
    'big-5': 'big5',
    shiftjis: 'shift-jis',
    shift_jis: 'shift-jis',
    sjis: 'shift-jis',
    euckr: 'euc-kr',
    euc_kr: 'euc-kr',
    eucjp: 'euc-jp',
    euc_jp: 'euc-jp',
    iso2022jp: 'iso-2022-jp',
    iso_2022_jp: 'iso-2022-jp',
    'iso-8859-1': 'iso-8859-1',
    latin1: 'iso-8859-1',
    windows1252: 'windows-1252',
  }
  return map[lower] || enc
}
