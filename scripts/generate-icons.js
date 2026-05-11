/**
 * 图标生成脚本
 * 依赖：@resvg/resvg-js（WASM，无需原生编译）、png-to-ico
 *
 * 用法：node scripts/generate-icons.js
 */

const fs = require('fs')
const path = require('path')

const SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024]
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256] // Windows .ico 支持的标准尺寸

const SVG_SRC = path.join(__dirname, '../build/icons/icon.svg')
const PNG_DIR = path.join(__dirname, '../build/icons/png')
const WIN_DIR = path.join(__dirname, '../build/icons/win')

async function main() {
  // 确保目录存在
  fs.mkdirSync(PNG_DIR, { recursive: true })
  fs.mkdirSync(WIN_DIR, { recursive: true })

  const svgData = fs.readFileSync(SVG_SRC)

  // ── 1. 生成所有尺寸的 PNG ──────────────────────────────────
  console.log('正在生成 PNG…')
  const { Resvg } = require('@resvg/resvg-js')

  for (const size of SIZES) {
    const resvg = new Resvg(svgData, {
      fitTo: { mode: 'width', value: size },
    })
    const pngData = resvg.render().asPng()
    const outPath = path.join(PNG_DIR, `${size}x${size}.png`)
    fs.writeFileSync(outPath, pngData)
    console.log(`  ✓ ${size}x${size}.png`)
  }

  // ── 2. 生成 Windows .ico ──────────────────────────────────
  console.log('正在生成 icon.ico…')
  const pngToIcoMod = require('png-to-ico')
  const pngToIco = pngToIcoMod.default ?? pngToIcoMod

  const icoPngs = ICO_SIZES.map((s) =>
    fs.readFileSync(path.join(PNG_DIR, `${s}x${s}.png`))
  )
  const icoBuffer = await pngToIco(icoPngs)
  fs.writeFileSync(path.join(WIN_DIR, 'icon.ico'), icoBuffer)
  console.log('  ✓ win/icon.ico')

  console.log('\n图标生成完成！')
}

main().catch((err) => {
  console.error('图标生成失败:', err.message)
  process.exit(1)
})
