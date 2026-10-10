/**
 * editor-core：编辑器门面与命令层（框架无关）
 */
export { NextEditor } from './core.js'
export { CommandRegistry } from './commands.js'
export { buildKeymap } from './keymap.js'
export { buildInputRules } from './inputrules.js'
export { outlineFromDoc, outlineFromText } from './outline.js'
export { textStats } from './stat.js'
