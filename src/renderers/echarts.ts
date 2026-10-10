/**
 * ECharts → PNG 栅格化渲染器（lang=echarts）
 *
 * 代码块内容为宽松 JSON 的 option（支持函数、尾逗号）。
 * 使用 echarts 5 SSR 模式无头渲染：
 *   init(null, null, { ssr: true, renderer: 'svg' }) → setOption → renderToSVGString
 * 不挂载交互实例，产物走统一栅格化管线（2x PNG dataURL）。
 * echarts 本体通过动态 import 独立 chunk，未使用时不占首屏。
 */
import { registerCodeRenderer } from './registry.js'
import { svgToPngImg } from './rasterize.js'
import { looseJsonParse } from './util.js'

/** @type {Promise<import('echarts')> | null} */
let echartsPromise = null

/** 懒加载 echarts 单例（mindmap 渲染器共用） */
export function loadEcharts() {
  if (!echartsPromise) {
    echartsPromise = import('echarts')
  }
  return echartsPromise
}

/** @param {string} code ECharts option（宽松 JSON） */
async function renderEcharts(code) {
  const option = looseJsonParse(code)
  if (!option || typeof option !== 'object') {
    throw new Error('echarts option 解析失败：代码块内容需为 JS 对象字面量')
  }
  const echarts = await loadEcharts()
  // 尺寸优先取 option.width/height，缺省 800×480，越界夹紧
  const width = Math.min(Math.max(Number(option.width) || 800, 200), 2000)
  const height = Math.min(Math.max(Number(option.height) || 480, 120), 2000)
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width,
    height,
  })
  try {
    // SSR 无交互，动画会导致输出空白首帧，默认关掉（用户显式配置优先）
    chart.setOption({ animation: false, ...option })
    const svg = chart.renderToSVGString()
    return await svgToPngImg(svg, { alt: 'echarts' })
  } finally {
    chart.dispose()
  }
}

// 挂进渲染器注册表
registerCodeRenderer('echarts', renderEcharts)
