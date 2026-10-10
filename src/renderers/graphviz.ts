/**
 * Graphviz (viz.js) → PNG 栅格化渲染器（lang=graphviz，别名 dot）
 *
 * 代码块内容为 DOT 语法。@viz-js/viz v3 为 standalone 构建（内嵌 wasm），
 * instance() → renderSVGElement 同步产出未挂载 SVG 元素，
 * 属性中自带 width/height(pt)，直接序列化走统一栅格化管线。
 * viz 本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { svgToPngImg } from './rasterize.js'

/** @type {Promise<import('@viz-js/viz').Viz> | null} */
let vizPromise = null

/** 懒加载 viz 实例 */
function loadViz() {
  if (!vizPromise) {
    vizPromise = import('@viz-js/viz').then((m) => m.instance())
  }
  return vizPromise
}

/** @param {string} code DOT 源码 */
async function renderGraphviz(code) {
  const viz = await loadViz()
  // DOT 语法非法时 renderSVGElement 抛错，由管线统一回退显示源码
  const svgEl = viz.renderSVGElement(code)
  const svg = new XMLSerializer().serializeToString(svgEl)
  return svgToPngImg(svg, { alt: 'graphviz' })
}

// 挂进渲染器注册表（dot 为 graphviz 的常用别名）
registerCodeRenderer('graphviz', renderGraphviz)
registerCodeRenderer('dot', renderGraphviz)
