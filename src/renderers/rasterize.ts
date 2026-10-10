/**
 * SVG → PNG 栅格化共享工具
 *
 * 各图表渲染器（mermaid/echarts/flowchart/graphviz/markmap/wavedrom...）的统一落点：
 * 微信等平台不支持交互式 SVG，必须离线栅格化为位图 → 2x 白底 PNG dataURL <img>。
 * 预览 = 复制 = 导出 同一份产物，天然一致。
 */

/** 通用栅格化选项 */
// @ts-ignore JSDoc 类型提示
const defaultOpts = { alt: '', scale: 2, background: '#ffffff' }

/**
 * 建一个离屏容器执行 fn（渲染库普遍需要挂载后才能量取尺寸）。
 * 注意：不能用 display:none，否则 getBoundingClientRect / getBBox 全部归零。
 * fn 必须 return await，保证 promise settle 后容器才被移除。
 * @template T
 * @param {(box: HTMLDivElement) => T | Promise<T>} fn
 * @returns {Promise<T>}
 */
export async function withOffscreen(fn) {
  const box = document.createElement('div')
  box.style.cssText =
    'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;'
  document.body.appendChild(box)
  try {
    return await fn(box)
  } finally {
    box.remove()
  }
}

/**
 * SVG 字符串转 2x PNG dataURL <img>（白底，微信深色模式不透底）
 * @param {string} svg SVG 源码
 * @param {{alt?: string, scale?: number, background?: string}} [opts]
 * @returns {Promise<string>} <img> HTML
 */
export function svgToPngImg(svg, opts) {
  const { alt, scale, background } = { ...defaultOpts, ...opts }
  return new Promise((resolve, reject) => {
    // 图表库输出常只有 viewBox/max-width，Image 解析拿不到自然尺寸，
    // 先补显式 width/height 属性
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    const el = doc.documentElement
    let w = parseFloat(el.getAttribute('width') || '')
    let h = parseFloat(el.getAttribute('height') || '')
    if (!w || !h) {
      const vb = (el.getAttribute('viewBox') || '0 0 800 600')
        .split(/[\s,]+/)
        .map(Number)
      w = vb[2]
      h = vb[3]
    }
    el.setAttribute('width', String(w))
    el.setAttribute('height', String(h))
    el.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const sized = new XMLSerializer().serializeToString(el)

    const blob = new Blob([sized], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(w * scale)
        canvas.height = Math.round(h * scale)
        const ctx = canvas.getContext('2d')
        ctx.fillStyle = background
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        const src = canvas.toDataURL('image/png')
        resolve(`<img src="${src}" alt="${alt}" style="max-width:100%">`)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG 加载失败'))
    }
    img.src = url
  })
}

/**
 * 已挂载的 SVG 元素转 2x PNG dataURL <img>。
 * 适用于渲染库直接产出的 live SVG（echarts/graphviz/markmap/wavedrom 等）：
 * clone 一份、按渲染尺寸补宽高后序列化，再走 svgToPngImg。
 * @param {SVGElement} svgEl
 * @param {{alt?: string, scale?: number, background?: string}} [opts]
 * @returns {Promise<string>} <img> HTML
 */
export async function svgElementToPngImg(svgEl, opts) {
  const { alt, scale, background } = { ...defaultOpts, ...opts }
  const clone = /** @type {SVGElement} */ (svgEl.cloneNode(true))
  // 以布局尺寸为准（getBoundingClientRect 在离屏容器内同样有效）
  const rect = svgEl.getBoundingClientRect()
  let w = rect.width
  let h = rect.height
  // width 属性是百分比（如 echarts SSR 输出 width="100%"）时按缺失处理，
  // parseFloat 会得到错误数值
  const attrW = parseFloat(clone.getAttribute('width') || '')
  const attrH = parseFloat(clone.getAttribute('height') || '')
  const wIsPercent = /%$/.test(clone.getAttribute('width') || '')
  const hIsPercent = /%$/.test(clone.getAttribute('height') || '')
  if (!w || !h || wIsPercent || hIsPercent) {
    const vb = (clone.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
    if (!w || wIsPercent) w = attrW && !wIsPercent ? attrW : vb[2] || 800
    if (!h || hIsPercent) h = attrH && !hIsPercent ? attrH : vb[3] || 600
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', String(w))
  clone.setAttribute('height', String(h))
  const svg = new XMLSerializer().serializeToString(clone)
  try {
    return await svgToPngImg(svg, { alt, scale, background })
  } catch (e) {
    // 旧浏览器 foreignObject 栅格化会被 canvas 污染（或字体缺失），
    // 退回原始 SVG 内联输出，保证内容不丢
    console.warn('[rasterize] SVG 栅格化失败，回退内联 SVG', e)
    return svgEl.outerHTML
  }
}
