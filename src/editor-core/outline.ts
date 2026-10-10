/**
 * 大纲提取：从文档模型 / Markdown 文本中提取标题结构
 *
 * 条目结构 { level, text, pos }：
 * - wysiwyg：pos 为 PM 文档位置（nodeDOM(pos) 可直达 heading 元素）
 * - source / ir：pos 为文本字符偏移（CM dispatch anchor 可直达该行）
 */

/**
 * 从 PM 文档提取标题大纲（wysiwyg 模式）
 * @param {import('prosemirror-model').Node} doc
 * @returns {Array<{ level: number, text: string, pos: number }>}
 */
export function outlineFromDoc(doc) {
  const items = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      items.push({ level: node.attrs.level || 1, text: node.textContent, pos })
    }
    return true
  })
  return items
}

/** 标题行正则：# 开头 + 空格 + 内容（行尾允许 ATX 闭合井号） */
const HEADING_RE = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/

/**
 * 从 Markdown 文本提取标题大纲（source / ir 模式）
 * 带围栏代码块守卫：``` / ~~~ 行切换 fenced 状态（同字符配对），围栏内不识别标题
 * @param {string} text
 * @returns {Array<{ level: number, text: string, pos: number }>}
 */
export function outlineFromText(text) {
  const items = []
  let offset = 0
  let fenced = false
  let fenceChar = ''
  for (const line of String(text).split('\n')) {
    const fence = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      const ch = fence[1][0]
      if (!fenced) {
        fenced = true
        fenceChar = ch
      } else if (ch === fenceChar) {
        fenced = false
        fenceChar = ''
      }
    } else if (!fenced) {
      const m = line.match(HEADING_RE)
      if (m) items.push({ level: m[1].length, text: m[2], pos: offset })
    }
    offset += line.length + 1
  }
  return items
}
