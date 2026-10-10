/**
 * KaTeX 数学公式渲染
 *
 * 供预览管线（pipeline/preview.ts）把 math_block / math_inline 占位节点
 * 替换为 KaTeX HTML。katex 本体（~280KB + 字体）动态 import 独立 chunk
 * 不占首屏。
 *
 * 样式说明：katex.min.css 不在本库引入（其 60 个字体文件随 CSS 汇聚会被
 * 打包器 base64 内联，膨胀 1.4MB+）。消费方按需引入一行即可：
 *   import 'katex/dist/katex.min.css'
 */

/** @type {Promise<import('katex').default> | null} */
let katexPromise = null

/** 懒加载 katex 单例 */
function loadKatex() {
  if (!katexPromise) {
    katexPromise = import('katex').then((m) => m.default)
  }
  return katexPromise
}

/**
 * TeX 源码 → KaTeX HTML
 * @param {string} tex 公式源码
 * @param {boolean} displayMode true = 块级公式（$$...$$）
 * @returns {Promise<string>}
 */
export async function renderMathToHtml(tex, displayMode) {
  const katex = await loadKatex()
  // throwOnError: false 时非法 TeX 会渲染为红色错误片段而非抛错
  return katex.renderToString(tex, { throwOnError: false, displayMode, strict: false })
}
