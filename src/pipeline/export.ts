/**
 * PNG / PDF 导出
 *
 * html2canvas + jsPDF 均为动态 import（独立 chunk 懒加载，合计 ~550KB），
 * 未触发导出时不占首屏。输出与预览共用 buildPreviewRoot 单一管线，
 * 保证「预览 = 导出」一致。
 */
import { buildPreviewRoot } from './preview.js'
import { adaptWechat } from './wechat.js'

/** 导出内容宽度：公众号版心 677px，默认 800px */
function contentWidth(variant) {
  return variant === 'wechat' ? 677 : 800
}

/** 构建指定变体的导出 root（与预览同管线） */
async function buildExportRoot(md, variant) {
  const root = await buildPreviewRoot(md)
  if (variant === 'wechat') adaptWechat(root)
  return root
}

/**
 * 离屏挂载 root 并栅格化为 2x canvas。
 * 必须挂进文档，编辑器/预览样式才能参与计算。
 */
async function renderRootToCanvas(root, width) {
  const holder = document.createElement('div')
  holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;background:#ffffff;`
  holder.appendChild(root)
  document.body.appendChild(holder)
  try {
    const html2canvas = (await import('html2canvas')).default
    return await html2canvas(root, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
    })
  } finally {
    holder.remove()
  }
}

/** 触发浏览器下载 */
function download(url, filename) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
}

/**
 * 导出 PNG 长图（2x）
 * @param {string} md
 * @param {'default' | 'wechat'} [variant]
 * @param {string} [filename]
 * @returns {Promise<{ width: number, height: number }>} 位图尺寸（2x）
 */
export async function exportPNG(md, variant = 'default', filename = 'editor-plus.png') {
  const root = await buildExportRoot(md, variant)
  const canvas = await renderRootToCanvas(root, contentWidth(variant))
  download(canvas.toDataURL('image/png'), filename)
  return { width: canvas.width, height: canvas.height }
}

/**
 * 导出 A4 多页 PDF（按页高切片，页间无缝）
 * @param {string} md
 * @param {'default' | 'wechat'} [variant]
 * @param {string} [filename]
 * @returns {Promise<{ pages: number }>}
 */
export async function exportPDF(md, variant = 'default', filename = 'editor-plus.pdf') {
  const root = await buildExportRoot(md, variant)
  const canvas = await renderRootToCanvas(root, contentWidth(variant))

  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF('p', 'pt', 'a4')
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 28
  const imgW = pageW - margin * 2
  const pxPerPt = canvas.width / imgW
  const pageSrcH = Math.floor((pageH - margin * 2) * pxPerPt)

  let y = 0
  let pages = 0
  while (y < canvas.height) {
    const sliceH = Math.min(pageSrcH, canvas.height - y)
    const tmp = document.createElement('canvas')
    tmp.width = canvas.width
    tmp.height = sliceH
    const ctx = tmp.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, tmp.width, tmp.height)
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    if (pages > 0) pdf.addPage()
    pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, imgW, sliceH / pxPerPt)
    pages++
    y += sliceH
  }
  pdf.save(filename)
  return { pages }
}
