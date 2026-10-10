/**
 * WYSIWYG 视图：ProseMirror EditorView 组装
 * 插件栈：history + keymap + inputRules + dropCursor + gapCursor + placeholder
 */
import { EditorState, Plugin } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { history } from 'prosemirror-history'
import { dropCursor } from 'prosemirror-dropcursor'
import { gapCursor } from 'prosemirror-gapcursor'
import { buildKeymap } from '../editor-core/keymap.js'
import { buildInputRules } from '../editor-core/inputrules.js'
import { liveNodeViews } from './live-view.js'
import type { CommandRegistry } from '../editor-core/commands.js'

/** 空文档占位符（widget 装饰实现） */
function placeholderPlugin(text) {
  if (!text) return []
  return [
    new Plugin({
      props: {
        decorations(state) {
          const doc = state.doc
          const empty =
            doc.childCount <= 1 &&
            doc.firstChild &&
            doc.firstChild.type.name === 'paragraph' &&
            doc.firstChild.content.size === 0
          if (!empty) return DecorationSet.empty
          return DecorationSet.create(doc, [
            Decoration.widget(1, () => {
              const el = document.createElement('span')
              el.className = 'ep-placeholder'
              el.textContent = text
              return el
            }, { side: -1 }),
          ])
        },
      },
    }),
  ]
}

/**
 * @param {HTMLElement} place 挂载容器
 * @param {{doc: any, registry: CommandRegistry, placeholder?: string, onChange?: () => void, onTransaction?: () => void}} opts
 */
export function createProseView(place, opts) {
  const { doc, registry, placeholder, onChange, onTransaction } = opts

  const state = EditorState.create({
    doc,
    plugins: [
      history(),
      buildKeymap(registry),
      buildInputRules(),
      dropCursor(),
      gapCursor(),
      ...placeholderPlugin(placeholder),
    ],
  })

  const view = new EditorView(place, {
    state,
    nodeViews: liveNodeViews(),
    attributes: { class: 'ep-prosemirror' },
    dispatchTransaction(tr) {
      view.updateState(view.state.apply(tr))
      if (onTransaction) onTransaction()
      if (tr.docChanged && onChange) onChange()
    },
  })

  return view
}
