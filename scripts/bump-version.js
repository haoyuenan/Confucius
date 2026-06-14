/**
 * 统一版本更新脚本
 * 用法: node scripts/bump-version.js <new-version>
 * 示例: node scripts/bump-version.js 0.6.0
 *
 * 自动更新以下文件:
 *   - package.json
 *   - src-tauri/Cargo.toml
 *   - src-tauri/tauri.conf.json
 */

const fs = require('fs')
const path = require('path')

const ROOT = process.cwd()

const newVer = process.argv[2]
if (!newVer || !/^\d+\.\d+\.\d+$/.test(newVer)) {
  console.error('用法: node scripts/bump-version.js <semver>')
  console.error('示例: node scripts/bump-version.js 0.6.0')
  process.exit(1)
}

const files = [
  {
    path: path.join(ROOT, 'package.json'),
    pattern: /("version":\s*")[^"]+(")/,
  },
  {
    path: path.join(ROOT, 'src-tauri', 'Cargo.toml'),
    pattern: /(^version\s*=\s*")[^"]+(")/m,
  },
  {
    path: path.join(ROOT, 'src-tauri', 'tauri.conf.json'),
    pattern: /("version":\s*")[^"]+(")/,
  },
]

for (const file of files) {
  try {
    const content = fs.readFileSync(file.path, 'utf-8')
    const updated = content.replace(file.pattern, (match, g1, g2) => `${g1}${newVer}${g2}`)
    if (content === updated) {
      console.warn(`⚠  ${path.relative(ROOT, file.path)} — 未找到版本字段，跳过`)
      continue
    }
    fs.writeFileSync(file.path, updated, 'utf-8')
    console.log(`✓  ${path.relative(ROOT, file.path)} → ${newVer}`)
  } catch (err) {
    console.error(`✗  ${path.relative(ROOT, file.path)} — ${err.message}`)
  }
}
