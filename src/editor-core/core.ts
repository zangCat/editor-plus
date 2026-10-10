/**
 * NextEditor：面向使用者的编辑器门面（框架无关）
 *
 * - PM 文档模型是唯一数据源；源码模式只是同一 Markdown 字符串的另一编辑外壳
 * - 模式切换 = 序列化当前内容 → 重建对应视图（全量切换，路线图：空闲预缓存优化）
 * - 事件：'change'（内容变化，携带 markdown）| 'modeChange' | 'transaction' | 'build'（视图构建就绪）
 */
import { markdownToDoc, docToMarkdown } from '../markdown-core/index.js'
import { outlineFromDoc, outlineFromText } from './outline.js'
import { textStats } from './stat.js'
import { CommandRegistry } from './commands.js'
import { createProseView } from '../editor-pm/view.js'
import { buildPreviewRoot } from '../pipeline/preview.js'
// CodeMirror 全家桶体积大（数百 KB），不进首屏：仅切换源码视图时动态加载（M6 chunk 拆分）；
// wysiwyg 挂载后空闲预取 chunk，保证首次切换近零等待。

export class NextEditor {
  /** @type {HTMLElement} */
  _mount
  /** @type {'wysiwyg' | 'source' | 'ir'} */
  _mode
  /** @type {string} */
  _placeholder
  /** @type {((md: string) => void) | null} */
  _onChange
  /** @type {Record<string, Set<Function>>} */
  _listeners
  /** @type {any} PM EditorView 或 CM EditorView */
  _view
  /** @type {HTMLElement} */
  _el
  /** @type {CommandRegistry} */
  commands
  /** @type {number} 构建代数：进行中的异步视图构建期间发生 destroy/setMode/setMarkdown 时，旧构建直接丢弃 */
  _buildGen
  /** @type {string} 最近一次 _build 的内容；异步视图就绪前 getMarkdown() 的兜底返回 */
  _lastMd
  /** @type {HTMLElement | null} IR 分屏右侧预览容器 */
  _irContent
  /** @type {number | null} IR 预览重建防抖定时器 */
  _irTimer
  /** @type {(() => void) | null} IR 滚动同步回调（源码 → 预览） */
  _irScroll
  /** @type {(() => void) | null} IR 滚动同步回调（预览 → 源码） */
  _irPreviewScroll
  /** @type {boolean} 滚动同步锁：程序化滚动对侧期间抑制反向监听，防回环 */
  _irLock

  constructor(
    options: Partial<{
      markdown?: string
      mode?: 'wysiwyg' | 'source' | 'ir'
      mount: HTMLElement
      placeholder?: string
      onChange?: (md: string) => void
    }> = {}
  ) {
    if (!options.mount) throw new Error('NextEditor: mount HTMLElement is required')
    this._mount = options.mount
    this._mode = options.mode === 'source' || options.mode === 'ir' ? options.mode : 'wysiwyg'
    this._placeholder = options.placeholder || ''
    this._onChange = options.onChange || null
    /** @type {Record<string, Set<Function>>} */
    this._listeners = { change: new Set(), modeChange: new Set(), transaction: new Set(), build: new Set() }

    /** @type {any} PM EditorView 或 CM EditorView */
    this._view = null

    this.commands = new CommandRegistry(
      () => (this._mode === 'wysiwyg' && this._view ? this._view.state : null),
      () => (this._mode === 'wysiwyg' && this._view ? this._view : null)
    )

    this._buildGen = 0
    this._lastMd = options.markdown || ''
    this._build(options.markdown || '')
    this._precacheSourceView()
  }

  get mode() {
    return this._mode
  }

  /** 当前内容对应的 Markdown 字符串（异步视图就绪前返回待构建内容） */
  getMarkdown() {
    if (!this._view) return this._lastMd
    if (this._mode === 'wysiwyg') {
      return docToMarkdown(this._view.state.doc)
    }
    return this._view.state.doc.toString()
  }

  /** 当前 WYSIWYG 文档模型（仅 wysiwyg 模式且视图就绪；否则返回 null） */
  getDoc() {
    return this._mode === 'wysiwyg' && this._view ? this._view.state.doc : null
  }

  /** 当前标题大纲（wysiwyg 取文档模型；源码/IR 按行解析文本，围栏内不识别。视图就绪前返回 []） */
  getOutline() {
    if (!this._view) return []
    if (this._mode === 'wysiwyg') return outlineFromDoc(this._view.state.doc)
    return outlineFromText(this._view.state.doc.toString())
  }

  /** 文字统计（基于当前 Markdown：CJK 逐字 + 西文分词） */
  getStats() {
    return textStats(this.getMarkdown())
  }

  /** 滚动到指定位置（大纲点击跳转）：wysiwyg 直达 heading 元素，CM 定位光标并对齐视口顶部 */
  scrollToPos(pos) {
    if (!this._view) return
    if (this._mode === 'wysiwyg') {
      const dom = this._view.nodeDOM(pos)
      const el = dom && dom.nodeType === 1 ? dom : null
      if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    // CM 视图：state.doc 是 Text，长度用 .length（非 PM 的 content.size）
    const view = this._view
    const anchor = Math.min(pos, view.state.doc.length)
    view.dispatch({ selection: { anchor } })
    view.focus()
    // 顶部对齐：CM 常铺满展开、自身无滚动空间，需滚动外层容器；dispatch 后 DOM 同步更新，
    // 坐标立即可读（rAF 在后台标签页会被节流，故用同步计算）。8px 为行高呼吸边距
    const coords = view.coordsAtPos(anchor)
    if (!coords) return
    let scroller = view.scrollDOM
    while (scroller && scroller.scrollHeight <= scroller.clientHeight + 1) scroller = scroller.parentElement
    if (!scroller || scroller === document.body) return
    scroller.scrollTop += coords.top - scroller.getBoundingClientRect().top - 8
  }

  setMarkdown(md) {
    this._build(md)
  }

  /** @param {'wysiwyg' | 'source' | 'ir'} mode */
  setMode(mode) {
    if (mode === this._mode) return
    const md = this.getMarkdown()
    this._mode = mode
    this._build(md)
    this._emit('modeChange', mode)
  }

  focus() {
    if (this._view) this._view.focus()
  }

  on(event, cb) {
    if (!this._listeners[event]) return () => {}
    this._listeners[event].add(cb)
    return () => this._listeners[event].delete(cb)
  }

  destroy() {
    this._buildGen++ // 使进行中的异步视图构建失效
    if (this._irTimer) clearTimeout(this._irTimer)
    this._irTimer = null
    this._teardownIrSync()
    if (this._view) {
      this._view.destroy()
      this._view = null
    }
    for (const set of Object.values(this._listeners) as Set<Function>[]) set.clear()
    if (this._el && this._el.parentNode) this._el.parentNode.removeChild(this._el)
  }

  /* —— 内部 —— */

  async _build(markdown) {
    const gen = ++this._buildGen
    this._lastMd = markdown
    if (!this._el) {
      this._el = document.createElement('div')
      this._el.className = 'ep-editor'
      this._mount.appendChild(this._el)
    }
    if (this._view) {
      this._teardownIrSync()
      this._view.destroy()
      this._view = null
    }
    this._el.innerHTML = ''

    const place = document.createElement('div')
    place.className = `ep-mode-${this._mode}`
    this._el.appendChild(place)

    if (this._mode === 'wysiwyg') {
      this._view = createProseView(place, {
        doc: markdownToDoc(markdown),
        registry: this.commands,
        placeholder: this._placeholder,
        onChange: () => this._emitChange(),
        onTransaction: () => this._emit('transaction'),
      })
      this._emit('build', this._mode)
      return
    }

    // 源码/IR 视图：CodeMirror 按需动态加载（期间可能发生新构建/销毁，用代数守卫丢弃过期结果）
    let createCodeView
    try {
      ;({ createCodeView } = await import('../editor-cm/view.js'))
    } catch (e) {
      console.error('[editor-plus] source view load failed:', e)
      return
    }
    if (gen !== this._buildGen) return

    if (this._mode === 'ir') {
      // IR 分屏：左源码 + 右实时预览（复用统一预览管线）
      const src = document.createElement('div')
      src.className = 'ep-ir-src'
      const preview = document.createElement('div')
      preview.className = 'ep-ir-preview'
      place.appendChild(src)
      place.appendChild(preview)
      this._irContent = preview

      this._view = createCodeView(src, {
        text: markdown,
        placeholder: this._placeholder,
        onChange: () => {
          this._scheduleIrPreview()
          this._emitChange()
        },
        onTransaction: () => this._emit('transaction'),
      })

      // 滚动同步：源码 ⇄ 预览（按滚动比例映射；程序化滚动对侧期间置锁，抑制反向监听防回环）
      const cmScroll = this._view.scrollDOM
      this._irScroll = () => {
        const p = this._irContent
        if (!p || this._irLock) return
        this._irLock = true
        const max = cmScroll.scrollHeight - cmScroll.clientHeight
        const ratio = max > 0 ? cmScroll.scrollTop / max : 0
        p.scrollTop = ratio * (p.scrollHeight - p.clientHeight)
        requestAnimationFrame(() => { this._irLock = false })
      }
      cmScroll.addEventListener('scroll', this._irScroll)
      this._irPreviewScroll = () => {
        if (this._irLock) return
        this._irLock = true
        const max = preview.scrollHeight - preview.clientHeight
        const ratio = max > 0 ? preview.scrollTop / max : 0
        cmScroll.scrollTop = ratio * (cmScroll.scrollHeight - cmScroll.clientHeight)
        requestAnimationFrame(() => { this._irLock = false })
      }
      preview.addEventListener('scroll', this._irPreviewScroll)

      this._renderIrPreview(markdown, gen)
      this._emit('build', this._mode)
      return
    }

    this._view = createCodeView(place, {
      text: markdown,
      placeholder: this._placeholder,
      onChange: () => this._emitChange(),
      onTransaction: () => this._emit('transaction'),
    })
    this._emit('build', this._mode)
  }

  /** IR 分屏：输入防抖重建右侧预览 */
  _scheduleIrPreview() {
    if (this._irTimer) clearTimeout(this._irTimer)
    const gen = this._buildGen
    this._irTimer = setTimeout(() => {
      this._irTimer = null
      this._renderIrPreview(this.getMarkdown(), gen)
    }, 150)
  }

  /** IR 分屏：重建右侧预览内容（异步，代数过期直接丢弃；重建期间保持滚动位置） */
  async _renderIrPreview(md, gen) {
    const wrap = this._irContent
    if (!wrap || gen !== this._buildGen) return
    try {
      const root = await buildPreviewRoot(md)
      if (gen !== this._buildGen || wrap !== this._irContent) return
      // 记录滚动比例，重建后恢复（innerHTML 清空会把 scrollTop 归零并触发 scroll 事件，须置锁防止反向拽动源码）
      const max = wrap.scrollHeight - wrap.clientHeight
      const ratio = max > 0 ? wrap.scrollTop / max : 0
      wrap.innerHTML = ''
      wrap.appendChild(root)
      const nmax = wrap.scrollHeight - wrap.clientHeight
      if (nmax > 0) {
        this._irLock = true
        wrap.scrollTop = ratio * nmax
        requestAnimationFrame(() => { this._irLock = false })
      }
    } catch (e) {
      console.error('[editor-plus] ir preview render failed:', e)
    }
  }

  /** 移除 IR 滚动同步监听（视图重建/销毁前调用） */
  _teardownIrSync() {
    if (this._view && this._irScroll) this._view.scrollDOM.removeEventListener('scroll', this._irScroll)
    if (this._irContent && this._irPreviewScroll) this._irContent.removeEventListener('scroll', this._irPreviewScroll)
    this._irScroll = null
    this._irPreviewScroll = null
    this._irContent = null
  }

  /** 空闲时预取源码视图 chunk，切换模式零等待（M6：视图切换预缓存） */
  _precacheSourceView() {
    const warm = () => {
      import('../editor-cm/view.js').catch(() => {})
    }
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(warm, { timeout: 3000 })
    } else {
      setTimeout(warm, 1500)
    }
  }

  _emitChange() {
    const md = this.getMarkdown()
    if (this._onChange) this._onChange(md)
    this._emit('change', md)
  }

  _emit(event, payload = null) {
    for (const cb of this._listeners[event]) cb(payload)
  }
}
