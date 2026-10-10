/**
 * Mermaid → PNG 栅格化渲染器
 *
 * 注册进 codeRenderer 注册表（pipeline/preview.ts 加载本模块即生效）。
 * 微信等平台不支持外部脚本/交互式 SVG，必须离线栅格化为位图：
 *   mermaid.render → SVG → rasterize.svgToPngImg → 2x PNG dataURL
 * mermaid 本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { svgToPngImg } from './rasterize.js'

/** @type {Promise<import('mermaid').default> | null} */
let mermaidPromise = null

/** 懒加载并初始化 mermaid 单例 */
export function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((m) => {
      m.default.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        // foreignObject 画到 canvas 会被污染导致 toDataURL 抛错。
        // 注意：flowchart-v2 实际读取的是顶层 htmlLabels，
        // 只配 flowchart.htmlLabels 无效（v11.17 实测）。
        htmlLabels: false,
        look: 'classic',
        theme: 'default',
        flowchart: { htmlLabels: false },
      })
      return m.default
    })
  }
  return mermaidPromise
}

let seq = 0

/** @param {string} code mermaid 源码 */
async function renderMermaid(code) {
  const mermaid = await loadMermaid()
  const id = `ep-mermaid-${Date.now()}-${seq++}`
  try {
    const { svg } = await mermaid.render(id, code)
    return await svgToPngImg(svg, { alt: 'mermaid' })
  } finally {
    // mermaid.render 失败时会把带「Syntax error in text」的错误 SVG 容器
    // 残留在 body 下（#d{id}）且不自动清理，必须手动移除，否则污染页面
    document.getElementById(id)?.remove()
    document.getElementById(`d${id}`)?.remove()
  }
}

// 挂进渲染器注册表：lang=mermaid 的代码块走栅格化而非 hljs
registerCodeRenderer('mermaid', renderMermaid)
