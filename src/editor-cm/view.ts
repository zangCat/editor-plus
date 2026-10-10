/**
 * 源码视图：CodeMirror 6（markdown 语言 + 代码块内嵌语言高亮）
 */
import { EditorView as CMView, minimalSetup } from 'codemirror'
import { placeholder as cmPlaceholderExt } from '@codemirror/view'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'

/**
 * @param {HTMLElement} place 挂载容器
 * @param {{text: string, placeholder?: string, onChange?: () => void, onTransaction?: () => void}} opts
 */
export function createCodeView(place, opts) {
  const { text, placeholder, onChange, onTransaction } = opts

  const extensions = [
    minimalSetup,
    markdown({ base: markdownLanguage, codeLanguages: languages }),
    CMView.lineWrapping,
    CMView.theme({
      '&': { height: '100%', fontSize: '14px' },
      '.cm-scroller': { fontFamily: "'JetBrains Mono', Consolas, monospace", padding: '12px 16px' },
    }),
    ...(placeholder ? [cmPlaceholderExt(placeholder)] : []),
    CMView.updateListener.of((update) => {
      if (update.selectionSet || update.docChanged) {
        if (onTransaction) onTransaction()
      }
      if (update.docChanged && onChange) onChange()
    }),
  ]

  const view = new CMView({
    doc: text,
    parent: place,
    extensions,
  })

  return view
}
