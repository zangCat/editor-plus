/**
 * Markmap Markdown 思维导图渲染器（lang=markmap）
 *
 * 代码块内容为普通 Markdown，markmap-lib 解析为树，markmap-view 用 d3 渲染。
 *
 * 渲染策略（foreignObject 的两个坑，均经截图实证）：
 * 1. 节点标签由 foreignObject 承载，SVG 转位图（img → canvas）时 Chromium 静默
 *    丢弃 foreignObject，节点文字丢失 → 不能栅格化，只能内联 SVG；
 * 2. 内联 SVG 若被 CSS/viewBox 缩放，foreignObject 内 HTML 按 width 属性的
 *    CSS px 布局、却按缩放后尺寸裁切，标签尾部字符被截断（4 字只显示 3 字）
 *    → 构建宽度必须等于最终显示宽度（量取宿主容器），插入后缩放比恒为 1。
 *
 * markmap 本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { withOffscreen } from './rasterize.js'

/** @type {Promise<{Transformer: any, Markmap: any}> | null} */
let markmapPromise = null

/** 懒加载 markmap-lib + markmap-view */
function loadMarkmap() {
  if (!markmapPromise) {
    markmapPromise = Promise.all([
      import('markmap-lib'),
      import('markmap-view'),
    ]).then(([lib, view]) => ({
      Transformer: lib.Transformer,
      Markmap: view.Markmap,
    }))
  }
  return markmapPromise
}

/**
 * @param {string} code Markdown 源码
 * @param {string} _lang
 * @param {HTMLElement} [el] 渲染容器（wysiwyg 即时渲染时由 chartKind 传入，用于量取最终显示宽度）
 * @returns {Promise<string>} 内联 SVG HTML
 */
async function renderMarkmap(code, _lang, el) {
  const { Transformer, Markmap } = await loadMarkmap()
  const { root } = new Transformer().transform(code)

  // 最终显示宽度：优先量取宿主容器（插入后缩放比恒为 1，避开 fo 缩放陷阱）
  let width = 800
  if (el) {
    const cs = getComputedStyle(el)
    width = Math.max(
      el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      320,
    )
  }
  const height = Math.round(width * 0.6)

  return withOffscreen(async (box) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('width', String(width))
    svg.setAttribute('height', String(height))
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('style', 'max-width:100%;height:auto;')
    box.appendChild(svg)

    // duration=0 关闭 d3 入场过渡（默认 500ms）：序列化发生在过渡中途时
    // DOM 会冻结在透明度≈0 的中间态——节点「消失」的直接原因
    const mm = Markmap.create(svg, { duration: 0 })
    mm.setData(root)
    mm.fit()
    // d3 zoom 变换异步写入 DOM，等两帧确保布局/变换落到属性上再序列化
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

    // 节点标签 foreignObject → SVG <text>：foreignObject 内 HTML 在缩放/序列化
    // 场景下布局与绘制不一致（文字截断/丢失，Chromium 顽疾）；<text> 是纯 SVG
    // 图元，viewBox 缩放与栅格化下都稳定。markmap 标签默认左对齐、行内简单文本。
    for (const fo of [...svg.querySelectorAll('foreignObject')]) {
      const text = (fo.textContent || '').trim()
      const x = parseFloat(fo.getAttribute('x')) || 0
      const y = parseFloat(fo.getAttribute('y')) || 0
      const h = parseFloat(fo.getAttribute('height')) || 0
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      t.setAttribute('x', String(x + 4))
      t.setAttribute('y', String(y + h / 2))
      t.setAttribute('dominant-baseline', 'central')
      t.setAttribute('style', 'font:300 16px/20px sans-serif;fill:var(--markmap-text-color,#333);white-space:pre')
      t.textContent = text || ' '
      fo.replaceWith(t)
    }

    // viewBox 以内容实际边界为准（留 12px padding）：markmap 内部 fit 不一定覆盖
    // 全部内容（<text> 替换后宽度亦有变化），按 bbox 兜底保证内容不被视口裁切
    const bbox = svg.getBBox()
    svg.setAttribute(
      'viewBox',
      `${bbox.x - 12} ${bbox.y - 12} ${bbox.width + 24} ${bbox.height + 24}`,
    )

    const html = svg.outerHTML
    mm.destroy()
    return html
  })
}

// 挂进渲染器注册表
registerCodeRenderer('markmap', renderMarkmap)
