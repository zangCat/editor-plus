/**
 * 预览管线：Markdown → 受控 HTML DOM
 *
 * 与编辑器共用同一文档模型（markdownToDoc），从根上保证
 * 「所见即所得视图 / 源码视图 / 预览 / 复制 / 导出」输出一致。
 *
 * 安全性：DOMSerializer 对文本节点天然转义；html_block/html_inline 在编辑器中
 * 保留原文占位，仅预览时经 sanitize.ts 白名单净化后替换为真实 DOM（受控 HTML）。
 */
import { DOMSerializer } from 'prosemirror-model'
import { markdownToDoc, editorPlusSchema } from '../markdown-core/index.js'
import { highlightCode } from '../renderers/highlight.js'
import { getCodeRenderer, getTransforms } from '../renderers/registry.js'
// 注意：内置图表渲染器的注册在核心入口 src/index.ts（import './renderers/charts.js'），
// 本模块保持纯净——深路径按需引入 pipeline 的使用者不被动带入图表注册。
import { renderMathToHtml } from '../renderers/katex.js'
import { adaptWechat } from './wechat.js'
import { sanitizeHtmlFragment } from './sanitize.js'

const serializer = DOMSerializer.fromSchema(editorPlusSchema)

/**
 * 受控 HTML：把 html_block/html_inline 占位节点携带的原始 HTML
 * 经白名单净化后替换为真实 DOM；净化失败时保留原文占位。
 * @param {HTMLElement} root
 */
function applySanitizedHtml(root) {
  for (const holder of [...root.querySelectorAll('[data-html-block]')]) {
    const frag = sanitizeHtmlFragment(holder.textContent || '')
    if (!frag) continue
    const el = document.createElement('div')
    el.className = 'ep-html-block'
    el.appendChild(frag)
    holder.replaceWith(el)
  }
  for (const holder of [...root.querySelectorAll('[data-html-inline]')]) {
    const frag = sanitizeHtmlFragment(holder.getAttribute('data-html-inline') || '')
    if (!frag) continue
    const el = document.createElement('span')
    el.className = 'ep-html-inline'
    el.appendChild(frag)
    holder.replaceWith(el)
  }
}

/**
 * 数学公式：把 math_block / math_inline 占位节点替换为 KaTeX 渲染结果。
 * 编辑器内保留 TeX 源码（与 html 占位同策略），仅预览时渲染。
 * @param {HTMLElement} root
 */
async function applyMath(root) {
  const blocks = [...root.querySelectorAll('[data-math-block]')]
  const inlines = [...root.querySelectorAll('[data-math-inline]')]
  await Promise.all([
    ...blocks.map(async (holder) => {
      try {
        const el = document.createElement('div')
        el.className = 'ep-math-block'
        el.innerHTML = await renderMathToHtml(holder.textContent || '', true)
        holder.replaceWith(el)
      } catch (e) {
        console.error('[editor-plus] math block render failed:', e)
      }
    }),
    ...inlines.map(async (holder) => {
      try {
        const el = document.createElement('span')
        el.className = 'ep-math-inline'
        el.innerHTML = await renderMathToHtml(holder.getAttribute('data-math-inline') || '', false)
        holder.replaceWith(el)
      } catch (e) {
        console.error('[editor-plus] math inline render failed:', e)
      }
    }),
  ])
}

/**
 * 构建预览内容根节点（不挂载，供预览/复制/导出共用）
 * @param {string} md
 * @returns {Promise<HTMLElement>} div.ep-preview-content
 */
export async function buildPreviewRoot(md) {
  const doc = markdownToDoc(md)
  const fragment = serializer.serializeFragment(doc.content)

  const root = document.createElement('div')
  root.className = 'ep-preview-content'
  root.appendChild(fragment)

  applySanitizedHtml(root)
  await applyMath(root)

  // 代码块：先查注册表（mermaid 等特殊渲染器），否则走 hljs
  for (const pre of [...root.querySelectorAll('pre')]) {
    const el = pre.querySelector('code')
    if (!el) continue
    const cls = (el.getAttribute('class') || '').match(/language-([\w+-]+)/)
    const lang = cls ? cls[1] : ''
    const code = el.textContent || ''

    const custom = lang ? getCodeRenderer(lang) : null
    if (custom) {
      try {
        const html = await custom(code, lang)
        // 特殊渲染器（如 mermaid 的 <img>）整体替换 pre，避免残留代码块底色
        const holder = document.createElement('div')
        holder.innerHTML = html
        while (holder.firstChild) pre.parentElement.insertBefore(holder.firstChild, pre)
        pre.remove()
      } catch (e) {
        console.error(`[editor-plus] code renderer(${lang}) failed:`, e)
        el.innerHTML = ''
        el.appendChild(document.createTextNode(code))
      }
    } else {
      el.innerHTML = await highlightCode(code, lang)
    }
  }

  // 文档级 transform 钩子
  for (const fn of getTransforms()) {
    await fn(root)
  }

  return root
}

/**
 * 渲染 Markdown 到容器
 * @param {string} md
 * @param {HTMLElement} container
 * @param {{ variant?: 'default' | 'wechat' }} [opts]
 *   variant='wechat' 时输出公众号适配：全内联样式 + 任务清单字符化
 * @returns {Promise<HTMLElement>} 本次渲染的内容根节点
 */
export async function renderMarkdownToHTML(
  md,
  container,
  opts = { variant: /** @type {'default' | 'wechat'} */ ('default') }
) {
  const root = await buildPreviewRoot(md)
  if (opts.variant === 'wechat') adaptWechat(root)
  container.innerHTML = ''
  container.appendChild(root)
  return root
}
