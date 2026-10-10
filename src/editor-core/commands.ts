/**
 * 命令注册表：所有编辑命令的唯一入口（工具栏 / 快捷键 / API 共用）
 *
 * 设计：注册表直接持有 state/view getter，PM 原生命令在 run 内部完成 dispatch，
 * 消费方只需 `commands.run('bold')`，无需感知 EditorState/EditorView。
 */
import {
  toggleMark,
  setBlockType,
  wrapIn,
  chainCommands,
  exitCode,
  lift,
  newlineInCode,
  createParagraphNear,
  liftEmptyBlock,
  splitBlock,
} from 'prosemirror-commands'
import { wrapInList, liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list'
import { undo, redo } from 'prosemirror-history'
import { TextSelection } from 'prosemirror-state'
import type { EditorState, Command } from 'prosemirror-state'
import type { EditorView } from 'prosemirror-view'
import { editorPlusSchema } from '../markdown-core/index.js'

export class CommandRegistry {
  /** @type {() => EditorState} */
  getState
  /** @type {() => EditorView | null} */
  getView
  /** @type {Map<string, {run: Command, isActive?: (s: EditorState) => boolean}>} */
  _commands

  /**
   * @param {() => EditorState} getState
   * @param {() => EditorView | null} getView
   */
  constructor(getState, getView) {
    this.getState = getState
    this.getView = getView
    const schema = editorPlusSchema

    /** @type {Map<string, {run: Command, isActive?: (s: EditorState) => boolean}>} */
    this._commands = new Map()
    const reg = this.register.bind(this)
    const withView = (cmd) => (s, _tr, _args) => cmd(s, this._dispatch(), this.getView())

    // —— 历史 ——
    reg('undo', { run: withView(undo) })
    reg('redo', { run: withView(redo) })

    // —— 行内标记 ——
    reg('bold', {
      run: withView(toggleMark(schema.marks.strong)),
      isActive: (s) => hasMark(s, schema.marks.strong),
    })
    reg('italic', {
      run: withView(toggleMark(schema.marks.em)),
      isActive: (s) => hasMark(s, schema.marks.em),
    })
    reg('strike', {
      run: withView(toggleMark(schema.marks.strike)),
      isActive: (s) => hasMark(s, schema.marks.strike),
    })
    reg('code', {
      run: withView(toggleMark(schema.marks.code)),
      isActive: (s) => hasMark(s, schema.marks.code),
    })
    reg('link', {
      run: (s, _tr, args) => {
        // 浮层输入是异步的，确认后须重新取 state 构造 tr
        const apply = (href) => {
          if (!href) return
          const st = this.getState()
          if (!st) return
          toggleMark(schema.marks.link, { href })(st, this._dispatch(), this.getView())
        }
        if (args && args[0]) apply(String(args[0]))
        else askText('链接地址', 'https://').then(apply)
        return true
      },
      isActive: (s) => hasMark(s, schema.marks.link),
    })
    reg('unlink', { run: withView(toggleMark(schema.marks.link)) })

    // —— 块级结构 ——
    for (let level = 1; level <= 6; level++) {
      reg(`h${level}`, {
        run: withView(setBlockType(schema.nodes.heading, { level })),
        isActive: (s) => activeBlock(s, schema.nodes.heading, level),
      })
    }
    reg('paragraph', {
      run: withView(setBlockType(schema.nodes.paragraph)),
      isActive: (s) => activeBlock(s, schema.nodes.paragraph),
    })
    reg('blockquote', {
      // toggle 语义：无引用 → 包裹；已在引用中 → 提升
      run: withView((s, d, v) =>
        firstSuccess(
          wrapIn(schema.nodes.blockquote),
          lift
        )(s, d, v)
      ),
      isActive: (s) => activeBlock(s, schema.nodes.blockquote),
    })
    reg('codeBlock', {
      run: withView(setBlockType(schema.nodes.code_block)),
      isActive: (s) => activeBlock(s, schema.nodes.code_block),
    })
    reg('bulletList', {
      run: withView(listToggle(schema.nodes.bullet_list)),
      isActive: (s) => activeBlock(s, schema.nodes.bullet_list),
    })
    reg('orderedList', {
      run: withView(listToggle(schema.nodes.ordered_list)),
      isActive: (s) => activeBlock(s, schema.nodes.ordered_list),
    })
    reg('indent', {
      run: withView(sinkListItem(schema.nodes.list_item)),
    })
    reg('outdent', {
      run: withView(liftListItem(schema.nodes.list_item)),
    })
    reg('hr', {
      run: withView(insertHorizontalRule),
    })
    reg('insertImage', {
      run: (s, _tr, args) => {
        // 浮层输入是异步的，确认后须重新取 state 构造 tr
        const apply = (src) => {
          if (!src) return
          const st = this.getState()
          if (!st) return
          const node = schema.nodes.image.create({ src })
          this._dispatch()(st.tr.replaceSelectionWith(node).scrollIntoView())
          const view = this.getView()
          if (view) view.focus()
        }
        if (args && args[0]) apply(String(args[0]))
        else askText('图片地址', 'https://').then(apply)
        return true
      },
    })
    reg('hardBreak', {
      run: withView(
        chainCommands(exitCode, (state, dispatch) => {
          dispatch(
            state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView()
          )
          return true
        })
      ),
    })
    reg('taskListToggle', {
      run: (s) => {
        const { $from } = s.selection
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d)
          if (node.type.name === 'list_item') {
            const pos = $from.before(d)
            const checked =
              node.attrs.checked == null ? true : node.attrs.checked ? false : null
            this._dispatch()(s.tr.setNodeMarkup(pos, null, { ...node.attrs, checked }))
            return true
          }
        }
        return true
      },
    })
    reg('insertTable', {
      run: (s) => {
        const rows = 3
        const cols = 3
        const cell = (type) =>
          type.create(null, schema.nodes.paragraph.create(null, null))
        const headerRow = schema.nodes.table_row.create(
          null,
          Array.from({ length: cols }, () => cell(schema.nodes.table_header_cell))
        )
        const bodyRows = Array.from({ length: rows - 1 }, () =>
          schema.nodes.table_row.create(
            null,
            Array.from({ length: cols }, () => cell(schema.nodes.table_cell))
          )
        )
        const table = schema.nodes.table.create(null, [headerRow, ...bodyRows])
        const { $from, $to } = s.selection
        const tr = s.tr
        // 空段落 → 直接替换；非空块内 replaceSelectionWith 对块级 isolating
        // 节点的 fit 会抛 TypeError，改为插到当前顶层块之后
        const emptyPara =
          $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0
        const at = emptyPara ? $from.before() : $to.depth >= 1 ? $to.after(1) : $to.after(0)
        if (emptyPara) {
          tr.replaceWith($from.before(), $from.after(), table)
        } else {
          tr.insert(at, table)
        }
        // 光标移入表格第一个单元格（table > row > cell > paragraph 的内容位）
        tr.setSelection(TextSelection.near(tr.doc.resolve(at + 4)))
        this._dispatch()(tr)
        return true
      },
    })

    // —— 结构兜底（供 keymap） ——
    reg('newlineInCode', { run: withView(newlineInCode) })
    reg('createParagraphNear', { run: withView(createParagraphNear) })
    reg('liftEmptyBlock', { run: withView(liftEmptyBlock) })
    reg('splitBlock', { run: withView(splitBlock) })
    reg('splitListItem', {
      run: withView(splitListItem(schema.nodes.list_item)),
    })
  }

  _dispatch() {
    const view = this.getView()
    return view ? view.dispatch.bind(view) : () => {}
  }

  register(id, def) {
    this._commands.set(id, def)
    return this
  }

  has(id) {
    return this._commands.has(id)
  }

  /** @returns {boolean} 是否执行了有效编辑 */
  run(id, ...args) {
    const def = this._commands.get(id)
    if (!def) return false
    const state = this.getState()
    if (!state) return false
    return !!def.run(state, state.tr, args)
  }

  isActive(id) {
    const def = this._commands.get(id)
    const state = this.getState()
    if (!def || !def.isActive || !state) return false
    return !!def.isActive(state)
  }

  /** @returns {string[]} 当前激活的命令 id 列表（工具栏高亮用） */
  activeIds() {
    const state = this.getState()
    if (!state) return []
    const ids = []
    for (const [id, def] of this._commands) {
      if (def.isActive && def.isActive(state)) ids.push(id)
    }
    return ids
  }
}

/* —— 辅助 —— */

/**
 * 输入框询问：优先原生 window.prompt。部分受限环境（webview/自动化）调用
 * prompt 会直接抛异常，此时降级为自制浮层输入框（Promise 化）。
 * Enter/确定 → 输入值；Esc/取消/点击遮罩 → null。
 * @param {string} title
 * @param {string} defaultValue
 * @returns {Promise<string | null>}
 */
function askText(title, defaultValue) {
  return new Promise((resolve) => {
    let raw
    try {
      raw = window.prompt(title, defaultValue)
    } catch {
      raw = undefined
    }
    if (raw !== undefined) {
      resolve(raw)
      return
    }
    const overlay = document.createElement('div')
    overlay.className = 'ep-prompt-overlay'
    const box = document.createElement('div')
    box.className = 'ep-prompt-box'
    const label = document.createElement('div')
    label.className = 'ep-prompt-title'
    label.textContent = title
    const input = document.createElement('input')
    input.className = 'ep-prompt-input'
    input.value = defaultValue || ''
    const actions = document.createElement('div')
    actions.className = 'ep-prompt-actions'
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.textContent = '取消'
    const ok = document.createElement('button')
    ok.type = 'button'
    ok.textContent = '确定'
    actions.appendChild(cancel)
    actions.appendChild(ok)
    box.appendChild(label)
    box.appendChild(input)
    box.appendChild(actions)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
    input.focus()
    input.select()
    let done = false
    const close = (value) => {
      if (done) return
      done = true
      overlay.remove()
      document.removeEventListener('keydown', onKey, true)
      resolve(value)
    }
    const onKey = (e) => {
      if (e.key === 'Enter') close(input.value)
      else if (e.key === 'Escape') close(null)
    }
    ok.addEventListener('click', () => close(input.value))
    cancel.addEventListener('click', () => close(null))
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) close(null)
    })
    document.addEventListener('keydown', onKey, true)
  })
}

/** 列表 toggle：无列表 → 包裹；已在列表 → 提升 */
function listToggle(listType) {
  return (state, dispatch, view) =>
    firstSuccess(wrapInList(listType), liftListItem(listType))(state, dispatch, view)
}

function insertHorizontalRule(state, dispatch) {
  dispatch(state.tr.replaceSelectionWith(editorPlusSchema.nodes.horizontal_rule.create()))
  return true
}

function firstSuccess(...cmds) {
  return (state, dispatch, view) => {
    for (const cmd of cmds) {
      if (cmd(state, dispatch, view)) return true
    }
    return false
  }
}

function hasMark(state, markType) {
  const { from, $from, to, empty } = state.selection
  return empty
    ? !!markType.isInSet(state.storedMarks || $from.marks())
    : state.doc.rangeHasMark(from, to, markType)
}

function activeBlock(state, nodeType, level = null) {
  const { $from } = state.selection
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d)
    if (node.type === nodeType) {
      return level == null || node.attrs.level === level
    }
  }
  return false
}
