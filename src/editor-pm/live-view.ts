/**
 * 即时渲染块/内联片段（wysiwyg）：Vditor 式「渲染 ⇄ 源码」切换
 *
 * 覆盖所有「无法直接编辑的复杂渲染」：
 * - code_block（lang 命中图表渲染器注册表）：mermaid/echarts/plantuml 等 → 图表
 * - math_block / math_inline：TeX 源码 → KaTeX HTML
 * - html_block / html_inline：原文 → 白名单净化后真实 DOM（素材片段等）
 *
 * 通用交互：默认展示渲染结果；点击切换为源码编辑（textarea 预填），
 * blur / Ctrl+Enter 提交写回文档模型并重渲，Esc 取消。源码是唯一数据源，
 * 提交走正常 ProseMirror 事务，序列化/预览/导出零感知（围栏/公式/原文保留）。
 */
import { getCodeRenderer } from '../renderers/registry.js'
import { renderMathToHtml } from '../renderers/katex.js'
import { sanitizeHtmlFragment } from '../pipeline/sanitize.js'

/**
 * 渲染种类的统一抽象
 * @typedef {Object} LiveKind
 * @property {string} id 提示与 data-live 标识（图表为语言名）
 * @property {(node: any) => string} source 取当前源码
 * @property {(src: string, el: HTMLElement) => void | Promise<void>} render 渲染进已清空的容器（失败应 throw）
 * @property {{ attr: string } | null} commit null = 整块文本替换；否则按属性写回
 */

/** 图表块：lang 命中渲染器注册表 */
/** @param {string} lang @returns {LiveKind} */
function chartKind(lang) {
  return {
    id: lang,
    source: (node) => node.textContent,
    render: async (src, el) => {
      const renderer = getCodeRenderer(lang)
      if (!renderer) throw new Error('渲染器未注册')
      const html = await renderer(src, lang, el)
      // 渲染器自行挂载 DOM（如 markmap 原地建图）时返回空串，不再覆写容器
      if (html) el.innerHTML = html
    },
    commit: null,
  }
}

/** 块级公式：TeX → KaTeX display */
const mathBlockKind = {
  id: 'math',
  source: (node) => node.textContent,
  render: async (src, el) => {
    el.innerHTML = await renderMathToHtml(src, true)
  },
  commit: null,
}

/** HTML 块：原文 → 白名单净化 DOM（净化后无有效内容则保留原文展示，与预览管线一致） */
const htmlBlockKind = {
  id: 'html',
  source: (node) => node.textContent,
  render: (src, el) => {
    const frag = sanitizeHtmlFragment(src)
    if (!frag) {
      el.textContent = src
      return
    }
    el.appendChild(frag)
  },
  commit: null,
}

/** 行内公式：attrs.tex → KaTeX inline */
const mathInlineKind = {
  id: 'math',
  source: (node) => node.attrs.tex || '',
  render: async (src, el) => {
    el.innerHTML = await renderMathToHtml(src, false)
  },
  commit: { attr: 'tex' },
}

/** 行内 HTML：attrs.html → 白名单净化 DOM */
const htmlInlineKind = {
  id: 'html',
  source: (node) => node.attrs.html || '',
  render: (src, el) => {
    const frag = sanitizeHtmlFragment(src)
    if (!frag) {
      el.textContent = src
      return
    }
    el.appendChild(frag)
  },
  commit: { attr: 'html' },
}

class LiveBaseView {
  /** @type {any} PM 节点 */
  node
  /** @type {any} PM EditorView */
  view
  /** @type {() => number} 节点当前位置（节点移除后返回 undefined） */
  getPos
  /** @type {LiveKind} 渲染种类 */
  kind
  /** @type {number} 渲染代数：并发重渲时旧结果直接丢弃 */
  renderGen = 0
  /** @type {HTMLElement | null} 源码编辑态容器（null = 展示态） */
  editEl = null
  /** 根容器（子类构造器按块/行内重建） */
  dom: HTMLElement = document.createElement('div')
  /** 渲染区（子类构造器重建） */
  renderEl: HTMLElement = document.createElement('div')
  /** @type {boolean} 行内节点标记 */
  inline = false
  /** @type {(e: MouseEvent) => void} */
  _onClick
  /** @type {HTMLElement | null} 右上角编辑按钮（仅块级视图，避免与渲染内容自带交互冲突） */
  btnEl = null
  /** @type {(e: MouseEvent) => void} */
  _onBtn
  /** @type {(e: MouseEvent) => void} */
  _onBtnDown

  /**
   * @param {any} node PM 节点
   * @param {any} view PM EditorView
   * @param {() => number} getPos 节点当前位置（节点移除后返回 undefined）
   * @param {LiveKind} kind
   */
  constructor(node, view, getPos, kind) {
    this.node = node
    this.view = view
    this.getPos = getPos
    this.kind = kind
    this._onClick = (e) => {
      if (this.editEl) return
      e.preventDefault()
      e.stopPropagation()
      this.openEditor()
    }
  }

  /**
   * PM 更新钩子：类型变化交还默认渲染；源码变化且非编辑态时重渲
   * @param {any} node
   */
  update(node) {
    if (node.type !== this.node.type) return false
    const changed = this.kind.source(node) !== this.kind.source(this.node)
    this.node = node
    // 编辑态期间的文档变更不覆盖编辑框，关闭时以文档内容为准
    if (changed && !this.editEl) this.render(this.kind.source(node))
    return true
  }

  /** 渲染（异步，代数守卫防过期结果覆盖新渲染） */
  async render(src) {
    const gen = ++this.renderGen
    this.renderEl.classList.add('ep-live-loading')
    try {
      this.renderEl.innerHTML = ''
      await this.kind.render(src, this.renderEl)
      if (gen !== this.renderGen) return
      this.renderEl.classList.remove('ep-live-loading', 'ep-live-error')
    } catch (e) {
      if (gen !== this.renderGen) return
      this.renderEl.classList.remove('ep-live-loading')
      this.renderEl.classList.add('ep-live-error')
      this.renderEl.textContent = `${this.kind.id} 渲染失败：${e instanceof Error ? e.message : e}`
    }
  }

  /** 点击渲染结果 → 源码编辑态（textarea 预填当前源码） */
  openEditor() {
    this.editEl = document.createElement('div')
    this.editEl.className = this.inline ? 'ep-live-inline-editor' : 'ep-live-edit'

    const ta = document.createElement('textarea')
    ta.value = this.kind.source(this.node)
    ta.spellcheck = false
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        this.closeEditor(false)
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        this.closeEditor(true)
      }
    })
    ta.addEventListener('blur', () => this.closeEditor(true))

    const actions = document.createElement('div')
    actions.className = 'ep-live-actions'
    const ok = document.createElement('button')
    ok.type = 'button'
    ok.textContent = '渲染 (Ctrl+Enter)'
    // 阻止按钮按下时 textarea 先失焦，避免 blur 提交与按钮点击重复触发
    ok.addEventListener('mousedown', (e) => e.preventDefault())
    ok.addEventListener('click', () => this.closeEditor(true))
    const tip = document.createElement('span')
    tip.className = 'ep-live-tip'
    tip.textContent = 'Esc 取消 · 失焦自动渲染'
    actions.appendChild(ok)
    actions.appendChild(tip)

    this.editEl.appendChild(ta)
    this.editEl.appendChild(actions)
    this.dom.appendChild(this.editEl)
    this.dom.classList.add('editing')
    ta.focus()
  }

  /**
   * 关闭编辑态：commit=true 把源码写回文档模型（事务触发 update → 重渲）
   * @param {boolean} commit
   */
  closeEditor(commit) {
    if (!this.editEl) return
    const ta = this.editEl.querySelector('textarea')
    const text = ta ? ta.value : ''
    const pos = typeof this.getPos === 'function' ? this.getPos() : null
    this.dom.classList.remove('editing')
    this.editEl.remove()
    this.editEl = null
    if (pos == null) return
    const src = this.kind.source(this.node)
    if (commit && text !== src) {
      const tr = this.view.state.tr
      if (this.kind.commit) {
        // 属性型节点（math_inline/html_inline）：setNodeMarkup 写回
        tr.setNodeMarkup(pos, null, { ...this.node.attrs, [this.kind.commit.attr]: text })
      } else {
        // 文本型块（code_block/math_block/html_block）：整块文本替换
        tr.replaceWith(
          pos,
          pos + this.node.nodeSize,
          this.node.type.create(this.node.attrs, text ? this.view.state.schema.text(text) : null)
        )
      }
      this.view.dispatch(tr)
    } else if (!commit) {
      // 取消：恢复展示（编辑期间文档可能已被外部变更，以文档内容为准）
      this.render(src)
    }
  }

  /** 编辑态/编辑按钮内的事件不进 PM；其余放行（保留渲染内容原生交互与 NodeSelection） */
  stopEvent(e) {
    if (this.editEl && this.editEl.contains(e.target)) return true
    return !!(this.btnEl && this.btnEl.contains(e.target))
  }

  /** 渲染 DOM 全由本视图自管，忽略 PM 突变扫描 */
  ignoreMutation() {
    return true
  }

  destroy() {
    this.renderGen++
    if (this._onClick) this.dom.removeEventListener('click', this._onClick)
    if (this.btnEl) {
      this.btnEl.removeEventListener('mousedown', this._onBtnDown)
      this.btnEl.removeEventListener('click', this._onBtn)
    }
  }
}

/** 块级即时渲染视图（code_block 图表 / math_block / html_block） */
class LiveBlockView extends LiveBaseView {
  /**
   * @param {any} node @param {any} view @param {() => number} getPos @param {LiveKind} kind
   */
  constructor(node, view, getPos, kind) {
    super(node, view, getPos, kind)
    this.inline = false

    this.dom = document.createElement('div')
    this.dom.className = 'ep-live-block'
    this.dom.setAttribute('data-live', kind.id)
    this.dom.setAttribute('contenteditable', 'false')

    this.renderEl = document.createElement('div')
    this.renderEl.className = 'ep-live-render'
    this.dom.appendChild(this.renderEl)

    // 右上角编辑按钮：渲染内容可能自带交互（链接/按钮等），整块点击会冲突，仅按钮进入源码编辑
    this.btnEl = document.createElement('button')
    this.btnEl.type = 'button'
    this.btnEl.className = 'ep-live-hint'
    this.btnEl.title = '编辑源码（Esc 取消）'
    this.btnEl.textContent = `${kind.id} · 编辑`
    this._onBtn = (e) => {
      e.preventDefault()
      e.stopPropagation()
      this.openEditor()
    }
    this._onBtnDown = (e) => e.preventDefault()
    this.btnEl.addEventListener('mousedown', this._onBtnDown)
    this.btnEl.addEventListener('click', this._onBtn)
    this.dom.appendChild(this.btnEl)

    this.render(kind.source(node))
  }
}

/** 行内即时渲染视图（math_inline / html_inline）：点击弹出就近源码编辑框 */
class LiveInlineView extends LiveBaseView {
  /**
   * @param {any} node @param {any} view @param {() => number} getPos @param {LiveKind} kind
   */
  constructor(node, view, getPos, kind) {
    super(node, view, getPos, kind)
    this.inline = true

    this.dom = document.createElement('span')
    this.dom.className = 'ep-live-inline'
    this.dom.setAttribute('data-live', kind.id)
    this.dom.setAttribute('contenteditable', 'false')

    this.renderEl = document.createElement('span')
    this.renderEl.className = 'ep-live-inline-render'
    this.dom.appendChild(this.renderEl)

    this.dom.addEventListener('click', this._onClick)
    this.render(kind.source(node))
  }
}

/** @returns {Record<string, any>} PM nodeViews：接管全部「渲染 ⇄ 源码」节点，未命中的 code_block 返回 null 走默认 */
export function liveNodeViews() {
  return {
    code_block(node, view, getPos) {
      return node.attrs.params && getCodeRenderer(node.attrs.params)
        ? new LiveBlockView(node, view, getPos, chartKind(node.attrs.params))
        : null
    },
    math_block(node, view, getPos) {
      return new LiveBlockView(node, view, getPos, mathBlockKind)
    },
    html_block(node, view, getPos) {
      return new LiveBlockView(node, view, getPos, htmlBlockKind)
    },
    math_inline(node, view, getPos) {
      return new LiveInlineView(node, view, getPos, mathInlineKind)
    },
    html_inline(node, view, getPos) {
      return new LiveInlineView(node, view, getPos, htmlInlineKind)
    },
  }
}
