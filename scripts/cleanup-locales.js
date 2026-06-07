/**
 * 打包后脚本：删除 Electron 多余语言包，只保留中文和英文
 * 在 electron-builder.yml 中通过 afterPack 引用
 */
const fs = require('fs')
const path = require('path')

const KEEP_LOCALES = new Set([
  'zh-CN.pak',
  'zh-TW.pak',
  'en-US.pak',
  'en-GB.pak',
])

exports.default = async function (context) {
  const localeDir = path.join(context.appOutDir, 'locales')
  if (!fs.existsSync(localeDir)) {
    console.log('[cleanup-locales] locales directory not found, skipping')
    return
  }

  const files = fs.readdirSync(localeDir)
  let removed = 0
  for (const file of files) {
    if (file.endsWith('.pak') && !KEEP_LOCALES.has(file)) {
      fs.unlinkSync(path.join(localeDir, file))
      removed++
    }
  }
  console.log(`[cleanup-locales] removed ${removed} locale files, kept ${files.length - removed}`)
}
