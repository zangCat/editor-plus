/**
 * PM 文档 → Markdown
 *
 * 管线：PM doc → 手工构造 mdast → remark-stringify 输出。
 *
 * 与 parser 成对维护的 round-trip 约定：
 * - list/listItem 恒 spread:false（紧凑列表）
 * - 有序列表仅在 start !== 1 时输出 start
 * - code mark 序列化为 inlineCode（无 children），故必须最内层
 * - table_cell 内容取其内部所有块的内联文本，扁平合并
 */
import { unified } from 'unified'
import remarkStringify from 'remark-stringify'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Node as PMNode } from 'prosemirror-model'

// GFM 扩展节点（delete/table/listItem.checked）与 math/inlineMath
// 必须注册对应插件后 stringify 才认识
export const stringifyProcessor = unified()
  .use(remarkStringify, {
    bullet: '-',
    rule: '-',
    fence: '`',
    emphasis: '_',
    strong: '*',
    listItemIndent: 'one',
  })
  .use(remarkGfm)
  .use(remarkMath)

/** mark 包裹顺序：index 越小越靠外层（code 必须最内层） */
const MARK_ORDER = { link: 0, strong: 1, em: 2, strike: 3, code: 4 }

/**
 * PM 文档 → Markdown 字符串
 * @param {PMNode} doc
 * @returns {string}
 */
export function docToMarkdown(doc) {
  const ast = docToMdast(doc)
  return stringifyProcessor.stringify(ast)
}

export function docToMdast(doc) {
  return {
    type: 'root',
    children: doc.children.flatMap((node) => blockToMdast(node)),
  } as import('mdast').Root
}

function textContentOf(node) {
  let out = ''
  node.descendants
    ? node.descendants((n) => {
        if (n.isText) out += n.text
      })
    : null
  return out
}

/** PM block 节点 → mdast 块节点数组（未知类型丢弃） */
function blockToMdast(node) {
  switch (node.type.name) {
    case 'paragraph':
      return [{ type: 'paragraph', children: inlineToMdast(node) }]

    case 'heading':
      return [
        {
          type: 'heading',
          depth: Math.min(6, Math.max(1, node.attrs.level)),
          children: inlineToMdast(node),
        },
      ]

    case 'blockquote':
      return [
        {
          type: 'blockquote',
          children: node.children.flatMap((child) => blockToMdast(child)),
        },
      ]

    case 'bullet_list':
      return [
        {
          type: 'list',
          ordered: false,
          spread: false,
          children: node.children.map(listItemToMdast),
        },
      ]

    case 'ordered_list': {
      const order = Number(node.attrs.order) || 1
      return [
        {
          type: 'list',
          ordered: true,
          spread: false,
          ...(order !== 1 ? { start: order } : {}),
          children: node.children.map(listItemToMdast),
        },
      ]
    }

    case 'list_item':
      return [listItemToMdast(node)]

    case 'code_block':
      return [
        {
          type: 'code',
          lang: node.attrs.params || undefined,
          value: textContentOf(node),
        },
      ]

    case 'horizontal_rule':
      return [{ type: 'thematicBreak' }]

    case 'table': {
      const align = node.attrs.align || node.firstChild.children.map(() => null)
      const rows = node.children.map((row, rowIndex) => ({
        type: 'tableRow',
        children: row.children.map((cell) => cellToMdast(cell)),
      }))
      return [{ type: 'table', align, children: rows }]
    }

    case 'html_block':
      return [{ type: 'html', value: textContentOf(node) }]

    case 'math_block':
      return [{ type: 'math', value: textContentOf(node) }]

    default:
      return []
  }
}

function listItemToMdast(node) {
  const blocks = node.children.flatMap((child) => blockToMdast(child))
  return {
    type: 'listItem',
    spread: false,
    ...(node.attrs.checked == null ? {} : { checked: node.attrs.checked }),
    children: blocks,
  }
}

function cellToMdast(cell) {
  // 单元格内所有块的内联内容扁平合并
  const children = []
  cell.forEach((block) => {
    if (block.type.name === 'paragraph') {
      children.push(...inlineToMdast(block))
    }
  })
  return { type: 'tableCell', children }
}

/** PM 节点的内联内容 → mdast 内联节点数组 */
function inlineToMdast(node) {
  const result = []
  node.forEach((child) => {
    result.push(...inlineNodeToMdast(child))
  })
  return result
}

function inlineNodeToMdast(node) {
  let leaf
  switch (node.type.name) {
    case 'text':
      leaf = { type: 'text', value: node.text || '' }
      break
    case 'image':
      leaf = {
        type: 'image',
        url: node.attrs.src || '',
        alt: node.attrs.alt || undefined,
        title: node.attrs.title || undefined,
      }
      break
    case 'hard_break':
      leaf = { type: 'break' }
      break
    case 'html_inline':
      leaf = { type: 'html', value: node.attrs.html || '' }
      break
    case 'math_inline':
      leaf = { type: 'inlineMath', value: node.attrs.tex || '' }
      break
    default:
      return []
  }

  // 由内向外包 mark：code（inlineCode，无 children）最内层，link 最外层
  const marks = [...node.marks].sort(
    (a, b) => (MARK_ORDER[a.type.name] ?? 9) - (MARK_ORDER[b.type.name] ?? 9)
  )

  for (const mark of marks.reverse()) {
    switch (mark.type.name) {
      case 'code': {
        const value = leaf.type === 'text' ? leaf.value : ''
        leaf = { type: 'inlineCode', value }
        break
      }
      case 'strike':
        leaf = { type: 'delete', children: [leaf] }
        break
      case 'em':
        leaf = { type: 'emphasis', children: [leaf] }
        break
      case 'strong':
        leaf = { type: 'strong', children: [leaf] }
        break
      case 'link':
        leaf = {
          type: 'link',
          url: mark.attrs.href || '',
          title: mark.attrs.title || undefined,
          children: [leaf],
        }
        break
    }
  }
  return [leaf]
}
