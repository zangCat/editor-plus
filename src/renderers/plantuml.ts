/**
 * PlantUML 渲染器（lang=plantuml）
 *
 * PlantUML 的 Java 渲染引擎无法在浏览器本地运行，与 vditor 一致走官方服务端：
 * plantuml-encoder（deflate + 自定义 base64）编码后拼服务端 SVG URL，
 * 直接输出外链 <img>（展示无 CORS 限制；导出 html2canvas 已配 useCORS:true）。
 * 无需懒加载大依赖，仅动态引入 1KB 的编码器。
 */
import { registerCodeRenderer } from './registry.js'

/** @param {string} code PlantUML 源码 */
async function renderPlantuml(code) {
  // plantuml-encoder 为 CJS 包，Vite interop 下 encode 可能挂在顶层或 default
  const mod = await import('plantuml-encoder')
  const encode = mod.encode ?? mod.default?.encode
  // ~1 前缀：声明 UTF-8 版 deflate 编码，兼容中文等非 ASCII 内容
  const url = `https://www.plantuml.com/plantuml/svg/~1${encode(code)}`
  return `<img src="${url}" alt="plantuml" style="max-width:100%">`
}

// 挂进渲染器注册表
registerCodeRenderer('plantuml', renderPlantuml)
