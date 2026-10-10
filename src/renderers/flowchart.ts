/**
 * flowchart.js → PNG 栅格化渲染器（lang=flowchart）
 *
 * 代码块内容为 flowchart DSL（st=>start: ... 语法）。
 * drawSVG 基于 Raphael，需要挂载后才能量取文本尺寸 → 离屏容器渲染，
 * 纸张尺寸由 drawSVG 内部 setSize 按内容自适应。
 * flowchart.js 本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { withOffscreen, svgElementToPngImg } from './rasterize.js'

/** @type {Promise<{parse: (code: string) => {drawSVG: (el: HTMLElement, opts?: any) => void}}>} */
let flowchartPromise = null

/** 懒加载 flowchart.js（CJS 包，取 default 互操作） */
function loadFlowchart() {
  if (!flowchartPromise) {
    flowchartPromise = import('flowchart.js').then((m) => m.default ?? m)
  }
  return flowchartPromise
}

/** @param {string} code flowchart DSL 源码 */
async function renderFlowchart(code) {
  const flowchart = await loadFlowchart()
  return withOffscreen(async (box) => {
    const el = document.createElement('div')
    // 初始纸张宽度；随后 drawSVG 内部 setSize 按内容自适应覆盖
    el.style.width = '800px'
    box.appendChild(el)
    flowchart.parse(code).drawSVG(el)
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('flowchart 渲染失败')
    return await svgElementToPngImg(svg, { alt: 'flowchart' })
  })
}

// 挂进渲染器注册表
registerCodeRenderer('flowchart', renderFlowchart)
