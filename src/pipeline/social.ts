/**
 * social 输出：复制公众号 HTML / 导出独立 HTML 文件
 *
 * 与预览共用 buildPreviewRoot 单一管线，保证「预览 = 复制 = 导出」一致。
 */
import { buildPreviewRoot } from './preview.js'
import { adaptWechat } from './wechat.js'
// 导出默认样式时内嵌预览 CSS（Vite ?inline 返回字符串）
import previewCss from '../styles/editor-plus.css?inline'

/**
 * 构建「复制/导出」用的 HTML
 * @param {string} md
 * @param {'default' | 'wechat'} variant
 * @returns {Promise<{ html: string, root: HTMLElement }>}
 */
async function buildOutput(md, variant) {
  const root = await buildPreviewRoot(md)
  if (variant === 'wechat') adaptWechat(root)
  return { html: root.innerHTML, root }
}

/**
 * 复制为公众号可用 HTML（富文本剪贴板，可直接粘贴进微信编辑器）
 * @param {string} md
 */
export async function copySocialHTML(md) {
  const { html } = await buildOutput(md, 'wechat')
  await writeClipboard(html)
  return html
}

/**
 * 导出独立 HTML 文档（当前预览样式的自包含单文件）
 *
 * KaTeX 样式说明：库不打包 katex.min.css（其 60 个字体文件无法内嵌自包含），
 * 导出页经 CDN 引入；离线打开时公式退化为纯文本，但仍有 .ep-math-block 的
 * 横向滚动兜底，不会撑破屏幕。
 *
 * @param {string} md
 * @param {'default' | 'wechat'} [variant]
 */
export async function buildStandaloneHTML(md, variant = 'default') {
  const { root } = await buildOutput(md, variant)
  // 必须保留 .ep-preview-content 包装（预览样式均挂在该类下），故用 outerHTML
  const content = root.outerHTML
  const style =
    variant === 'wechat'
      ? `body{margin:0;background:#f2f2f2}section{max-width:677px;margin:0 auto;padding:20px 16px}`
      : String(previewCss)
  const katexCss =
    variant === 'default'
      ? `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.9/dist/katex.min.css">`
      : ''
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>editor-plus 导出</title>
${katexCss}
<style>${style}</style>
</head>
<body>
${content}
</body>
</html>`
}

/** 富文本剪贴板写入，execCommand 兜底（非安全上下文/权限被拒/旧浏览器） */
async function writeClipboard(html) {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([html], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      // 文档失焦 / 权限拒绝等场景降级 execCommand
    }
  }
  const div = document.createElement('div')
  div.contentEditable = 'true'
  div.style.position = 'fixed'
  div.style.left = '-9999px'
  div.innerHTML = html
  document.body.appendChild(div)
  const range = document.createRange()
  range.selectNodeContents(div)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  document.execCommand('copy')
  sel.removeAllRanges()
  div.remove()
}
