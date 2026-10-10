/**
 * WaveDrom 时序图/比特流图 → PNG 栅格化渲染器（lang=wavedrom）
 *
 * 代码块内容为宽松 JSON 的 source（支持函数、尾逗号）。
 * renderWaveElement 需要挂载元素注入 SVG，走离屏容器渲染。
 * wavedrom 本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { withOffscreen, svgElementToPngImg } from './rasterize.js'
import { looseJsonParse } from './util.js'

/** @type {Promise<any> | null} */
let wavedromPromise = null

/** 懒加载 wavedrom（CJS 包，取 default 互操作） */
function loadWavedrom() {
  if (!wavedromPromise) {
    wavedromPromise = import('wavedrom').then((m) => m.default ?? m)
  }
  return wavedromPromise
}

let seq = 0

/** @param {string} code wavedrom source（宽松 JSON） */
async function renderWavedrom(code) {
  const wavedrom = await loadWavedrom()
  const source = looseJsonParse(code)
  if (!source || typeof source !== 'object') {
    throw new Error('wavedrom source 解析失败：代码块内容需为 JS 对象字面量')
  }
  return withOffscreen(async (box) => {
    const el = document.createElement('div')
    box.appendChild(el)
    wavedrom.renderWaveElement(seq++, source, el, wavedrom.waveSkin, false)
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('wavedrom 渲染失败')
    return await svgElementToPngImg(svg, { alt: 'wavedrom' })
  })
}

// 挂进渲染器注册表
registerCodeRenderer('wavedrom', renderWavedrom)
