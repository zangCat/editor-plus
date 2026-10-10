/**
 * ABC 乐谱 → PNG 栅格化渲染器（lang=abc）
 *
 * 代码块内容为 ABC 记谱法。abcjs.renderAbc 需要挂载元素量取文本排版，
 * 走离屏容器渲染，产物走统一栅格化管线。
 * abcjs 本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { withOffscreen, svgElementToPngImg } from './rasterize.js'

/** @type {Promise<any> | null} */
let abcjsPromise = null

/** 懒加载 abcjs（CJS 包，取 default 互操作） */
function loadAbcjs() {
  if (!abcjsPromise) {
    abcjsPromise = import('abcjs').then((m) => m.default ?? m)
  }
  return abcjsPromise
}

/** @param {string} code ABC 记谱法源码 */
async function renderAbc(code) {
  const ABCJS = await loadAbcjs()
  return withOffscreen(async (box) => {
    const el = document.createElement('div')
    box.appendChild(el)
    ABCJS.renderAbc(el, code)
    const svg = el.querySelector('svg')
    if (!svg) throw new Error('abc 乐谱渲染失败')
    return await svgElementToPngImg(svg, { alt: 'abc' })
  })
}

// 挂进渲染器注册表
registerCodeRenderer('abc', renderAbc)
