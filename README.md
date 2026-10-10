# @npm-zzh/editor-plus

基于 ProseMirror 文档模型 + remark/mdast 的现代 Markdown 编辑器核心。框架无关、UI 完全自定义，内置 10 种图表渲染与「预览 = 复制公众号 = 导出」统一输出管线。

## 特性

- **框架无关核心**：`NextEditor` 门面不绑定任何 UI 框架，React / Svelte / 原生 JS 均可接入，UI 完全自定义
- **三种编辑模式**：`wysiwyg` 所见即所得 / `source` 纯源码（CodeMirror 6，按需懒加载）/ `ir` 分屏实时预览
- **可靠的文档模型**：PM Doc ⇄ remark/mdast 单一边界，支持 GFM 与数学公式（KaTeX）
- **10 种图表 fenced 渲染**：图表库全部独立 chunk 懒加载，不占首屏
- **统一输出管线**：预览、公众号复制、PNG / PDF 导出走同一条 `renderMarkdownToHTML` 管线，所见即所得输出
- **微信公众号适配**：内联样式主题、任务列表降级、外链样式内联
- **扩展点**：`registerCodeRenderer` 注册自定义语言渲染器；`registerTransform` 注册文档级后处理钩子
- **双格式 + 完整类型**：ESM / CJS，全量 `.d.ts`

## 安装

```bash
npm i @npm-zzh/editor-plus
```

核心 JS 产物不携带任何 CSS import（避免污染 SSR / 测试环境），样式按需显式引入：

```js
import '@npm-zzh/editor-plus/styles.css' // 可选：内置基础样式（可整体替换为自定义样式）

// 数学公式（可选；KaTeX 字体体积大，故不随库分发）
import 'katex/dist/katex.min.css'
```

## 快速上手

### 原生 JS（任意框架）

```js
import { NextEditor } from '@npm-zzh/editor-plus'
import '@npm-zzh/editor-plus/styles.css'

const editor = new NextEditor({
  mount: document.querySelector('#app'), // 必填
  markdown: '# Hello editor-plus',
  mode: 'wysiwyg', // 'wysiwyg' | 'source' | 'ir'
  placeholder: '开始输入…',
  onChange: (md) => console.log(md),
})

// 之后可随时：
editor.setMarkdown('# 新内容')
editor.setMode('ir')
console.log(editor.getMarkdown())
editor.destroy()
```

### Vue 3

```vue
<script setup>
import { ref } from 'vue'
import { EditorPlus } from '@npm-zzh/editor-plus/vue'
import '@npm-zzh/editor-plus/styles.css'

const md = ref('# Hello editor-plus')
</script>

<template>
  <!-- v-model + v-model:mode；outline 左侧大纲，counter 底部字数 -->
  <EditorPlus v-model="md" outline counter placeholder="开始输入…" />
</template>
```

## 图表支持

在 Markdown 中用 fenced code block 即可，无需额外配置（图表库按需懒加载）：

| lang | 用途 | 实现 |
| --- | --- | --- |
| `mermaid` | 流程图 / 时序图等 | mermaid → SVG → PNG |
| `echarts` | 数据图表 | echarts 5 SSR → SVG → PNG |
| `mindmap` | 思维导图（Markdown / JSON 树） | echarts tree → PNG |
| `flowchart` | 流程图 DSL | flowchart.js → PNG |
| `graphviz` / `dot` | DOT 关系图 | viz.js（wasm）→ PNG |
| `plantuml` | UML | 官方服务端 SVG（需网络） |
| `abc` | ABC 乐谱 | abcjs → PNG |
| `markmap` | Markdown 思维导图 | markmap-lib/view → PNG |
| `wavedrom` | 时序图 / 比特流 | wavedrom → PNG |
| `smiles` | 化学结构式 | smiles-drawer → PNG |

所有图表统一栅格化为 PNG `<img>`，保证在公众号 / 导出等富文本场景中稳定显示。

## API 概览

### NextEditor

```ts
new NextEditor(options: {
  mount: HTMLElement        // 必填，挂载容器
  markdown?: string         // 初始内容
  mode?: 'wysiwyg' | 'source' | 'ir'
  placeholder?: string
  onChange?: (md: string) => void
})
```

| 成员 | 说明 |
| --- | --- |
| `getMarkdown()` | 当前 Markdown 字符串 |
| `getDoc()` | 当前 PM 文档模型（仅 wysiwyg 视图就绪时） |
| `getOutline()` | 标题大纲（`{ text, level, pos }[]`） |
| `getStats()` | 字数 / 字符统计（CJK 逐字 + 西文分词） |
| `setMarkdown(md)` | 替换内容 |
| `setMode(mode)` | 切换模式（自动序列化迁移内容） |
| `scrollToPos(pos)` | 大纲跳转定位 |
| `focus()` / `destroy()` | 聚焦 / 销毁 |
| `commands` | 命令注册表（`commands.run(id, ...args)`、`commands.activeIds()`） |
| `on(event, cb)` | 订阅 `change` / `modeChange` / `transaction` / `build`，返回取消函数 |

### 输出管线

```js
import {
  buildPreviewRoot,      // (md) => Promise<HTMLElement>  统一预览根节点
  renderMarkdownToHTML,  // md → HTML 字符串（含图表 / transform）
  sanitizeHtmlFragment,  // HTML 净化
  copySocialHTML,        // 复制为公众号富文本
  buildStandaloneHTML,   // 构建独立 HTML 文档
  exportPNG, exportPDF,  // PNG / PDF 导出
  wechatTheme, adaptWechat, adaptTaskList, applyInlineStyles, // 公众号适配
} from '@npm-zzh/editor-plus'
```

### 文档模型

```js
import {
  editorPlusSchema,                                // PM schema
  markdownToDoc, docToMarkdown,                    // Markdown ⇄ PM Doc
  markdownToAst, mdastToDoc, docToMdast,           // 经 mdast 的双向转换
} from '@npm-zzh/editor-plus'
```

### 扩展注册表

```js
import { registerCodeRenderer, registerTransform, listCodeRenderers } from '@npm-zzh/editor-plus'

// 自定义语言渲染器：lang → (code, lang) => html（可异步）
const unregister = registerCodeRenderer('mychart', async (code) => {
  return `<img src="${renderMyChart(code)}">`
})

// 文档级后处理钩子：对管线输出的元素做统一加工
registerTransform((rootEl) => { /* ... */ })
```

## 自定义 UI

核心包只负责编辑能力与数据模型，不携带任何 UI 框架与强制样式：

- **样式**：不引入 `@npm-zzh/editor-plus/styles.css`，或在其之后覆盖，即获得完全自定义的外观
- **工具栏 / 大纲 / 状态栏**：自行实现，通过 `commands`、`getOutline()`、`getStats()`、`on('transaction')` 驱动（`@npm-zzh/editor-plus/vue` 内置组件即为参考实现）

## License

[MIT](./LICENSE)
