/**
 * 图表渲染器统一挂载入口（side-effect import）
 *
 * pipeline/preview.ts 只需 `import '../renderers/charts.js'` 一行即完成
 * 全部图表 lang 的注册。各渲染器内部对图表库本体做动态 import（独立
 * chunk 懒加载），本入口自身仅包含轻量的注册逻辑，不拖累首屏。
 *
 * 已支持（对齐 vditor 常用图表能力）：
 *   mermaid   流程图/时序图等（mermaid → SVG → PNG）
 *   echarts   图表（echarts 5 SSR → SVG → PNG）
 *   mindmap   Markdown/JSON 树思维导图（echarts tree → PNG）
 *   flowchart 流程图 DSL（flowchart.js + Raphael → PNG）
 *   graphviz/dot  DOT 语法关系图（viz.js wasm → SVG → PNG）
 *   plantuml  UML（官方服务端 SVG，外链 img）
 *   abc       ABC 乐谱（abcjs → PNG）
 *   markmap   Markdown 思维导图（markmap-lib/view → SVG → PNG）
 *   wavedrom  时序图/比特流（wavedrom → PNG）
 *   smiles    化学结构式（smiles-drawer → PNG）
 */
import './mermaid.js'
import './echarts.js'
import './mindmap.js'
import './flowchart.js'
import './graphviz.js'
import './plantuml.js'
import './abc.js'
import './markmap.js'
import './wavedrom.js'
import './smiles.js'
