<template>
  <div class="app">
    <header class="app-header">
      <div class="app-brand">
        <span class="app-logo">ep</span>
        <div>
          <h1>editor-plus</h1>
          <p>ProseMirror 文档模型 · remark/mdast 序列化 · 三视图</p>
        </div>
      </div>
      <div class="app-actions">
        <button
          class="app-btn"
          :class="{ 'is-active': showOutline }"
          @click="showOutline = !showOutline"
        >
          大纲
        </button>
        <button
          class="app-btn"
          :class="{ 'is-active': showStats }"
          @click="showStats = !showStats"
        >
          统计
        </button>
        <div class="app-variant" title="预览输出样式">
          <button
            class="app-variant-btn"
            :class="{ 'is-active': variant === 'default' }"
            @click="variant = 'default'"
          >
            默认
          </button>
          <button
            class="app-variant-btn"
            :class="{ 'is-active': variant === 'wechat' }"
            @click="variant = 'wechat'"
          >
            公众号
          </button>
        </div>
        <button class="app-btn" :disabled="busy" @click="onCopyWechat">
          {{ copyState === 'ok' ? '已复制 ✓' : copyState === 'fail' ? '复制失败' : '复制公众号 HTML' }}
        </button>
        <button class="app-btn" :disabled="busy" @click="onExportHTML">导出 HTML</button>
        <button class="app-btn" :disabled="busy" @click="onExportPNG">
          {{ exporting === 'png' ? '生成中…' : '导出 PNG' }}
        </button>
        <button class="app-btn" :disabled="busy" @click="onExportPDF">
          {{ exporting === 'pdf' ? '生成中…' : '导出 PDF' }}
        </button>
        <div class="app-rt" :class="rtOk ? 'is-ok' : 'is-bad'" :title="rtDetail">
          round-trip {{ rtOk ? '成立' : '被破坏' }}
        </div>
      </div>
    </header>

    <main class="app-main">
      <EditorPlus
        ref="editorRef"
        v-model="markdown"
        v-model:mode="mode"
        class="app-editor"
        :outline="showOutline"
        :counter="showStats"
        placeholder="开始输入 Markdown…（# 空格 → 标题，- 空格 → 列表）"
      />
      <PreviewPane :markdown="markdown" :variant="variant" class="app-preview" />
    </main>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import EditorPlus from './components/EditorPlus.vue'
import PreviewPane from './components/PreviewPane.vue'
import { markdownToDoc, docToMarkdown } from './markdown-core/index.js'
import { copySocialHTML, buildStandaloneHTML } from './pipeline/social.js'
import { exportPNG, exportPDF } from './pipeline/export.js'

const editorRef = ref(null)
const mode = ref('wysiwyg')
const variant = ref('default')
const busy = ref(false)
const copyState = ref('')
const exporting = ref('')
const showOutline = ref(true)
const showStats = ref(true)

const sampleMd = `# editor-plus

取两边优势的新一代 Markdown 编辑器：**ProseMirror 文档模型**是唯一数据源，
remark/mdast 负责*无损*序列化，~~不存在~~「DOM 即数据源」的顽疾。

## 功能速览

- 所见即所得 + 源码 + IR 分屏三视图，切换不丢内容
- GFM 全家桶：表格、任务清单、删除线
- 数学公式：行内 $E = mc^2$、块级 $$...$$（KaTeX 渲染）
- 图表即时渲染：mermaid / echarts / mindmap / flowchart / graphviz / plantuml / abc / markmap / wavedrom / smiles
- 输入规则：试试输入 \`# \`、\`- \`、\`\`\`js、\`**加粗**\`、\`$x^2$\`
- [x] round-trip 不动点校验（底部徽标）
- [x] IR 分屏：源码 + 实时预览 + 双向滚动同步
- [x] 工具栏：插入表格 / 图片 / 链接（受限环境降级浮层输入）
- 渲染器注册表：公众号 / social 输出管线的扩展点

1. 键入 \`1. \\\` 得到有序列表
2. Tab 缩进层级，Ctrl+] / Ctrl+[ 同效
3. Ctrl+B 加粗、Ctrl+I 斜体、Ctrl+K 链接

> 引用块：预览管线与编辑器共用同一文档模型，输出天然一致。

\`\`\`javascript
// 代码高亮（highlight.js 按需懒加载）
export function createEditor(mount) {
  return new NextEditor({ mount, mode: 'wysiwyg' })
}
\`\`\`

\`\`\`mermaid
graph LR
  A[Markdown] --> B[PM 文档模型]
  B --> C[HTML 管线]
  C --> D[公众号 PNG]
\`\`\`

## 图表渲染

10 种图表语言即时渲染：悬停块右上角「编辑」按钮可回到源码修改（渲染内容自带交互不被吞）。

\`\`\`echarts
{
  xAxis: { type: 'category', data: ['一月', '二月', '三月'] },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: [5, 20, 36] }],
}
\`\`\`

\`\`\`mindmap
{"name":"根节点","children":[{"name":"分支一"},{"name":"分支二","children":[{"name":"叶子"}]}]}
\`\`\`

\`\`\`flowchart
st=>start: 开始
op=>operation: 处理
e=>end: 结束

st->op->e
\`\`\`

\`\`\`graphviz
digraph G {
  rankdir=LR;
  A -> B;
  B -> C;
}
\`\`\`

\`\`\`dot
digraph D { A -> B }
\`\`\`

\`\`\`plantuml
@startuml
Alice -> Bob: 你好
Bob --> Alice: 好的
@enduml
\`\`\`

\`\`\`abc
X:1
T:Scale
M:4/4
L:1/8
K:C
CDEF GABc|
\`\`\`

\`\`\`markmap
- 根主题
  - 子节点一
  - 子节点二
\`\`\`

\`\`\`wavedrom
{ signal: [
  { name: 'clk', wave: 'p......' },
  { name: 'bus', wave: 'x345x', data: ['head', 'mid', 'tail'] },
] }
\`\`\`

\`\`\`smiles
CCO
\`\`\`

| 特性 | editor-plus | 传统编辑器 |
| :--- | :---: | ---: |
| 数据源 | 文档模型 | DOM |
| 序列化 | mdast | 正则 |
| 单元格格式 | **加粗**、\`代码\`、[链接](https://example.com) | 仅纯文本 |
| 测试 | 不动点 | 抽查 |

---

## 数学公式

行内公式：质能方程 $E = mc^2$，欧拉公式 $e^{i\pi} + 1 = 0$。

块级公式（高斯积分）：

$$
\\int_{-\\infty}^{\\infty} e^{-x^2}\\,dx = \\sqrt{\\pi}
$$

## 受控 HTML

原生 HTML 预览时经白名单净化后真实渲染（编辑器内仍保留原文）：

<details open>
<summary>点击折叠的细节（details / summary）</summary>
支持 <mark>高亮</mark>、<u>下划线</u>、<kbd>Ctrl+B</kbd>、<sub>下标</sub>、<sup>上标</sup>。
</details>

<script>alert('xss')<\/script> 危险标签整棵删除；<img src="x" onerror="alert(1)"> 事件属性被剥离；<a href="javascript:alert(1)">javascript: 链接</a> 被拦截。
`

const markdown = ref(sampleMd)

/** round-trip 不动点校验结果（M6：移出按键关键路径，停止输入后空闲执行） */
const rtOk = ref(true)
const rtDetail = ref('等待校验…')

function runRoundTrip() {
  try {
    const doc1 = markdownToDoc(markdown.value).toJSON()
    const once = docToMarkdown(markdownToDoc(markdown.value))
    const doc2 = markdownToDoc(once).toJSON()
    const ok = JSON.stringify(doc1) === JSON.stringify(doc2)
    rtOk.value = ok
    rtDetail.value = ok
      ? '两次解析的文档模型完全一致'
      : '文档模型出现漂移，需检查 parser/serializer 对应关系'
  } catch (e) {
    rtOk.value = false
    rtDetail.value = '解析异常: ' + e.message
  }
}

let rtTimer = null
watch(markdown, () => {
  clearTimeout(rtTimer)
  rtTimer = setTimeout(() => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(runRoundTrip, { timeout: 1500 })
    } else {
      runRoundTrip()
    }
  }, 500)
})
runRoundTrip()

let copyTimer = null
async function onCopyWechat() {
  busy.value = true
  try {
    await copySocialHTML(markdown.value)
    copyState.value = 'ok'
  } catch (e) {
    console.error('[editor-plus] copy failed:', e)
    copyState.value = 'fail'
  } finally {
    busy.value = false
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => (copyState.value = ''), 2000)
  }
}

async function onExportHTML() {
  busy.value = true
  try {
    const html = await buildStandaloneHTML(markdown.value, variant.value)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'editor-plus-export.html'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[editor-plus] export failed:', e)
  } finally {
    busy.value = false
  }
}

async function onExportPNG() {
  busy.value = true
  exporting.value = 'png'
  try {
    await exportPNG(markdown.value, variant.value)
  } catch (e) {
    console.error('[editor-plus] PNG export failed:', e)
  } finally {
    busy.value = false
    exporting.value = ''
  }
}

async function onExportPDF() {
  busy.value = true
  exporting.value = 'pdf'
  try {
    await exportPDF(markdown.value, variant.value)
  } catch (e) {
    console.error('[editor-plus] PDF export failed:', e)
  } finally {
    busy.value = false
    exporting.value = ''
  }
}
</script>
