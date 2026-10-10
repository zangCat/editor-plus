/**
 * 快捷键绑定：全部经由 CommandRegistry（单一出口），便于工具栏/键位共享状态
 */
import { keymap } from 'prosemirror-keymap'
import { baseKeymap, chainCommands } from 'prosemirror-commands'
import type { CommandRegistry } from './commands.js'

export function buildKeymap(registry) {
  /** @type {Record<string, any>} */
  const keys = {}
  const bind = (key, id) => {
    keys[key] = () => registry.run(id)
  }

  // 历史
  bind('Mod-z', 'undo')
  bind('Shift-Mod-z', 'redo')
  bind('Mod-y', 'redo')

  // 行内标记
  bind('Mod-b', 'bold')
  bind('Mod-i', 'italic')
  bind('Mod-e', 'code')
  bind('Mod-Shift-x', 'strike')
  bind('Mod-k', 'link')

  // 结构
  bind('Mod-]', 'indent')
  bind('Mod-[', 'outdent')

  // 硬换行：Shift-Enter / Ctrl-Enter
  keys['Shift-Enter'] = () => registry.run('hardBreak')
  keys['Mod-Enter'] = () => registry.run('hardBreak')

  // Enter：列表内拆分项优先，其余走 baseKeymap
  keys['Enter'] = chainCommands(() => registry.run('splitListItem'), baseKeymap.Enter)

  // Tab：代码块内缩进；列表内层级缩进
  keys['Tab'] = (state, dispatch) => {
    const { $from, empty } = state.selection
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'code_block') {
        if (dispatch && empty) dispatch(state.tr.insertText('  '))
        return true
      }
    }
    return registry.run('indent')
  }
  keys['Shift-Tab'] = () => registry.run('outdent')

  // baseKeymap 兜底（未被上面覆盖的键）
  for (const [key, cmd] of Object.entries(baseKeymap)) {
    if (!keys[key]) keys[key] = cmd
  }

  return keymap(keys)
}
