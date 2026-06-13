/**
 * Tauri 迁移后的全局类型定义
 * 不再使用 window.electronAPI
 */

/** 导出预览 HTML 的函数签名 */
type ExportPreviewHTMLFn = () => string

declare global {
  interface Window {
    /** 供导出功能获取渲染后的 HTML 内容 */
    __exportPreviewHTML__?: ExportPreviewHTMLFn
  }
}

export {}
