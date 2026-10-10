/**
 * Mindmap（echarts tree）→ PNG 栅格化渲染器（lang=mindmap）
 *
 * 与 vditor 的 mindmap 行为对齐：数据为 JSON 树（root {name, children}），
 * 兼容 lute 输出的 encodeURIComponent 编码格式。样式沿用 vditor 配色。
 * 依赖 echarts（复用 echarts.ts 的懒加载单例），SSR 模式无头渲染 → PNG。
 */
import { registerCodeRenderer } from './registry.js'
import { svgToPngImg } from './rasterize.js'
import { loadEcharts } from './echarts.js'

/**
 * 解析 mindmap 数据：先按原样 JSON.parse，失败再 decodeURIComponent 后解析
 * @param {string} text
 */
function parseData(text) {
  try {
    return JSON.parse(text)
  } catch {
    /* 继续尝试解码 */
  }
  try {
    return JSON.parse(decodeURIComponent(text))
  } catch {
    return null
  }
}

/** @param {string} code mindmap JSON 树 */
async function renderMindmap(code) {
  const data = parseData(code)
  if (!data || typeof data !== 'object') {
    throw new Error('mindmap 解析失败：代码块内容需为 JSON 树（{name, children}）')
  }
  const echarts = await loadEcharts()
  const chart = echarts.init(null, null, {
    renderer: 'svg',
    ssr: true,
    width: 800,
    height: 480,
  })
  try {
    chart.setOption({
      animation: false,
      series: [
        {
          type: 'tree',
          data: [data],
          initialTreeDepth: -1,
          left: '5%',
          right: '20%',
          top: '5%',
          bottom: '5%',
          itemStyle: {
            borderColor: '#58b3e9',
            borderWidth: 1,
          },
          label: {
            color: '#58b3e9',
            fontSize: 14,
            position: 'left',
          },
          lineStyle: {
            color: '#58b3e9',
            width: 1,
          },
          roam: true,
          // echarts 回调签名 (value, params)；叶子节点方框、分支节点圆点
          symbol: (value, params) =>
            params?.data?.children ? 'circle' : 'rect',
          symbolSize: 7,
        },
      ],
    })
    const svg = chart.renderToSVGString()
    return await svgToPngImg(svg, { alt: 'mindmap' })
  } finally {
    chart.dispose()
  }
}

// 挂进渲染器注册表
registerCodeRenderer('mindmap', renderMindmap)
