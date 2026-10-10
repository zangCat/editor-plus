/**
 * editor-plus 核心入口（框架无关，零 UI 依赖）
 *
 * 引入核心即可自定义 UI：
 *   import { NextEditor } from '@npm-zzh/editor-plus'
 *
 * 可选附加（核心 JS 产物不携带 CSS import，样式统一显式引入）：
 *   - Vue 薄适配组件：import { EditorPlus } from '@npm-zzh/editor-plus/vue'
 *   - 核心样式（prosemirror 基础样式 + 编辑器样式，已合并为单文件）：
 *       import '@npm-zzh/editor-plus/styles.css'
 *   - 数学公式样式（KaTeX 字体不随本库打包，按需一行）：
 *       import 'katex/dist/katex.min.css'
 *
 * 渲染扩展点：registerCodeRenderer(lang, fn) / registerTransform(fn)，
 * 内置图表渲染器（mermaid/echarts/mindmap/flowchart/graphviz/plantuml/abc/
 * markmap/wavedrom/smiles）在本入口默认注册——图表库本体均为动态 import
 * 懒加载，注册本身只有轻量代码；不需要图表能力时可改为深路径按需引入。
 */
// side-effect：注册全部内置图表渲染器（图表库本体各自懒加载，不占首屏）
import './renderers/charts.js'

// 编辑器门面与命令层
export * from './editor-core/index.js'

// 文档模型（Markdown ⇄ PM Doc 唯一边界）
export * from './markdown-core/index.js'

// 输出管线（预览 = 复制 = 导出 同一管线）
export { buildPreviewRoot, renderMarkdownToHTML } from './pipeline/preview.js'
export { sanitizeHtmlFragment } from './pipeline/sanitize.js'
export { copySocialHTML, buildStandaloneHTML } from './pipeline/social.js'
export { exportPNG, exportPDF } from './pipeline/export.js'
export { wechatTheme, adaptWechat, adaptTaskList, applyInlineStyles } from './pipeline/wechat.js'

// 渲染扩展点（注册表）
export {
  registerCodeRenderer,
  registerTransform,
  listCodeRenderers,
} from './renderers/registry.js'
