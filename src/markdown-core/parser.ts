/**
 * Markdown → PM 文档
 *
 * 管线：remark-parse + remark-gfm 同步 parse → mdast → 递归转换为 PM 节点。
 *
 * round-trip 陷阱对策（与 serializer 成对维护）：
 * - mdast text 中的软换行 \n 归一为空格（PM 文本不含换行）
 * - definition / footnoteDefinition 丢弃（首轮解析即丢弃，不动点测试两侧对称）
 * - linkReference / imageReference 降级为纯文本
 * - list spread 不入库：serialize 恒 spread:false
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import type { Node as PMNode, Schema } from 'prosemirror-model'
import { editorPlusSchema } from './schema.js'

export const mdProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkMath)

/** 软换行归一：mdast text 中残留的 \n 转为空格 */
function normalizeText(value) {
  return value.replace(/\n/g, ' ')
}

export function markdownToAst(md) {
  return mdProcessor.parse(md)
}

/**
 * Markdown 字符串 → PM 文档
 * @param {string} md
 * @param {Schema} [schema]
 * @returns {PMNode}
 */
export function markdownToDoc(md, schema = editorPlusSchema) {
  const ast = mdProcessor.parse(md)
  return mdastToDoc(ast, schema)
}

export function mdastToDoc(root, schema = editorPlusSchema) {
  const children = []
  for (const child of root.children || []) {
    const node = blockNode(child, schema)
    if (node) children.push(...node)
  }
  if (!children.length) children.push(schema.nodes.paragraph.create())
  return schema.nodes.doc.create(null, children)
}

/** 块级 mdast 节点 → PM block 节点数组（未知类型返回 [] 以便丢弃） */
function blockNode(node, schema) {
  switch (node.type) {
    case 'paragraph':
      return [schema.nodes.paragraph.create(null, inlineNodes(node.children, schema))]

    case 'heading': {
      const level = Math.min(6, Math.max(1, node.depth || 1))
      return [
        schema.nodes.heading.create(
          { level },
          inlineNodes(node.children, schema)
        ),
      ]
    }

    case 'blockquote': {
      const blocks = []
      for (const child of node.children || []) {
        blocks.push(...blockNode(child, schema))
      }
      if (!blocks.length) blocks.push(schema.nodes.paragraph.create())
      return [schema.nodes.blockquote.create(null, blocks)]
    }

    case 'list': {
      const listType = node.ordered ? schema.nodes.ordered_list : schema.nodes.bullet_list
      const items = (node.children || [])
        .map((item) => listItemNode(item, schema))
        .filter(Boolean)
      if (!items.length) return []
      const attrs = node.ordered ? { order: node.start == null ? 1 : node.start } : null
      return [listType.create(attrs, items)]
    }

    case 'code':
      return [
        schema.nodes.code_block.create(
          { params: node.lang || null },
          node.value ? schema.text(node.value) : null
        ),
      ]

    case 'thematicBreak':
      return [schema.nodes.horizontal_rule.create()]

    case 'table': {
      const rows = []
      const children = node.children || []
      children.forEach((row, i) => {
        const cellType =
          i === 0 ? schema.nodes.table_header_cell : schema.nodes.table_cell
        const cells = (row.children || []).map((cell) => {
          const content = cellContent(cell, schema)
          return cellType.create(null, content.length ? content : [schema.nodes.paragraph.create()])
        })
        if (cells.length) rows.push(schema.nodes.table_row.create(null, cells))
      })
      if (!rows.length) return []
      return [schema.nodes.table.create({ align: node.align || null }, rows)]
    }

    case 'html':
      return [
        schema.nodes.html_block.create(
          null,
          node.value ? schema.text(node.value) : null
        ),
      ]

    case 'math':
      return [
        schema.nodes.math_block.create(
          null,
          node.value ? schema.text(node.value) : null
        ),
      ]

    // definition / footnoteDefinition / 未知类型：丢弃
    default:
      return []
  }
}

function listItemNode(node, schema) {
  const blocks = []
  for (const child of node.children || []) {
    blocks.push(...blockNode(child, schema))
  }
  if (!blocks.length) blocks.push(schema.nodes.paragraph.create())
  const checked = node.checked == null ? null : node.checked
  return schema.nodes.list_item.create({ checked }, blocks)
}

/**
 * 单元格内容：GFM tableCell 的 children 是内联节点直接平铺
 * （strong/inlineCode/link…不包 paragraph），直接折叠为单段落。
 */
function cellContent(cell, schema) {
  const inline = inlineNodes(cell.children, schema)
  return [schema.nodes.paragraph.create(null, inline)]
}

/** mdast 内联节点数组 → PM inline 节点数组 */
function inlineNodes(children, schema, marks = []) {
  const result = []
  for (const child of children || []) {
    result.push(...inlineNode(child, schema, marks))
  }
  return result
}

/**
 * 单个 mdast 内联节点 → PM inline 节点数组
 * marks：当前生效的 mark 链（递归构造时累积）
 */
function inlineNode(node, schema, marks) {
  switch (node.type) {
    case 'text':
      return node.value ? [schema.text(normalizeText(node.value), marks)] : []

    case 'break':
      return [schema.nodes.hard_break.create()]

    case 'image':
      return [
        schema.nodes.image.create({
          src: node.url || '',
          alt: node.alt || null,
          title: node.title || null,
        }),
      ]

    case 'inlineCode':
      return [schema.text(node.value, [...marks, schema.marks.code.create()])]

    case 'strong': {
      const next = [...marks, schema.marks.strong.create()]
      return inlineNodes(node.children, schema, next)
    }

    case 'emphasis': {
      const next = [...marks, schema.marks.em.create()]
      return inlineNodes(node.children, schema, next)
    }

    case 'delete': {
      const next = [...marks, schema.marks.strike.create()]
      return inlineNodes(node.children, schema, next)
    }

    case 'link': {
      const next = [
        ...marks,
        schema.marks.link.create({ href: node.url || '', title: node.title || null }),
      ]
      return inlineNodes(node.children, schema, next)
    }

    case 'html':
      return [schema.nodes.html_inline.create({ html: node.value })]

    case 'inlineMath':
      return [schema.nodes.math_inline.create({ tex: node.value || '' })]

    // 引用降级为文本内容；脚注引用忽略
    case 'linkReference':
      return inlineNodes(node.children, schema, marks)
    case 'imageReference':
      return node.alt ? [schema.text(node.alt, marks)] : []
    case 'footnoteReference':
      return []

    default:
      return []
  }
}
