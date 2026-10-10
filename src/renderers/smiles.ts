/**
 * SMILES 化学结构式 → PNG 栅格化渲染器（lang=smiles）
 *
 * 代码块内容为 SMILES 表达式（如 CCO 乙醇）。smiles-drawer 的 draw
 * 以 target='svg' 模式同步回调产出未挂载 SVG 元素，挂到离屏容器后
 * 走统一栅格化管线。本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { withOffscreen, svgElementToPngImg } from './rasterize.js'

/** @type {Promise<any> | null} */
let smilesPromise = null

/** 懒加载 smiles-drawer（ESM default 为聚合对象，类挂在 .SmiDrawer 上） */
function loadSmilesDrawer() {
  if (!smilesPromise) {
    smilesPromise = import('smiles-drawer').then(
      /** @returns {any} 运行时兼容：聚合对象 .SmiDrawer（类型声明即如此）/ 裸类 */
      (m) => /** @type {any} */ (m.default)?.SmiDrawer ?? m.default ?? m
    )
  }
  return smilesPromise
}

/** @param {string} code SMILES 表达式（围栏内可能带空行/缩进，必须 trim） */
async function renderSmiles(code) {
  const SmilesDrawer = await loadSmilesDrawer()
  const expr = String(code || '').trim()
  return withOffscreen(
    (box) =>
      new Promise((resolve, reject) => {
        try {
          new SmilesDrawer().draw(
            expr,
            'svg',
            'light',
            /** @param {SVGElement} svgEl */
            (svgEl) => {
              box.appendChild(svgEl)
              svgElementToPngImg(svgEl, { alt: 'smiles' }).then(resolve, reject)
            },
            /** @param {unknown} err */
            (err) => reject(err instanceof Error ? err : new Error(String(err)))
          )
        } catch (e) {
          reject(e)
        }
      })
  )
}

// 挂进渲染器注册表
registerCodeRenderer('smiles', renderSmiles)
