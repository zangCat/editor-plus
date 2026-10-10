/**
 * 输入规则：输入即时转换（# + 空格 → 标题，`code` → 行内代码等）
 * 块级规则基于 prosemirror-inputrules 官方模式；行内 mark 规则自实现。
 */
import {
  InputRule,
  inputRules,
  wrappingInputRule,
  textblockTypeInputRule,
} from 'prosemirror-inputrules'
import { findWrapping } from 'prosemirror-transform'
import { TextSelection } from 'prosemirror-state'
import { editorPlusSchema } from '../markdown-core/index.js'

/**
 * 行内 mark 规则：`~~text~~` 等，匹配完成后移除定界符并给内容加 mark
 * regexp 必须带两个捕获组：(定界符)(内容)，且以 $ 锚定输入末端
 */
function markInputRule(regexp, markType, getAttrs = null) {
  return new InputRule(regexp, (state, match, start, end) => {
    const open = match[1]
    const content = match[2]
    if (!open || !content) return null
    const openLen = open.length
    const tr = state.tr
    tr.addMark(start + openLen, end - openLen, markType.create(getAttrs ? getAttrs(match) : null))
    // 从后往前删除定界符，位置不失效
    tr.delete(end - openLen, end)
    tr.delete(start, start + openLen)
    return tr
  })
}

export function buildInputRules() {
  const schema = editorPlusSchema
  const rules = []

  // —— 块级 ——
  // 标题：# ~ ######
  rules.push(
    textblockTypeInputRule(
      new RegExp('^(#{1,6})\\s$'),
      schema.nodes.heading,
      (match) => ({ level: match[1].length })
    )
  )
  // 引用：> + 空格
  rules.push(wrappingInputRule(/^\s*>\s$/, schema.nodes.blockquote))
  // 代码块：```lang + 空格
  rules.push(
    textblockTypeInputRule(/^```([\w+-]*)\s$/, schema.nodes.code_block, (match) => ({
      params: match[1] || null,
    }))
  )
  // 无序列表：-/+/* + 空格
  rules.push(wrappingInputRule(/^\s*([-+*])\s$/, schema.nodes.bullet_list))
  // 有序列表：1. + 空格（连续输入时序号自动递增判断）
  rules.push(
    wrappingInputRule(
      /^\s*(\d+)\.\s$/,
      schema.nodes.ordered_list,
      (match) => ({ order: Number(match[1]) }),
      (match, node) => node.childCount + node.attrs.order === Number(match[1])
    )
  )
  // 任务清单：- [ ] / - [x] + 空格
  rules.push(
    new InputRule(/^\s*([-+*])\s+\[([ xX])\]\s$/, (state, match, start, end) => {
      const checked = match[2].toLowerCase() === 'x'
      const { bullet_list, list_item } = schema.nodes
      const tr = state.tr.delete(start, end)
      const $start = tr.doc.resolve(start)
      const blockRange = $start.blockRange()
      if (!blockRange) return null
      const wrapping = findWrapping(blockRange, bullet_list)
      if (!wrapping) return null
      // findWrapping 的包装链中给 list_item 附加 checked 属性
      for (let i = 0; i < wrapping.length; i++) {
        if (wrapping[i].type === list_item) {
          wrapping[i] = { type: list_item, attrs: { checked } }
        }
      }
      tr.wrap(blockRange, wrapping)
      tr.scrollIntoView()
      return tr
    })
  )
  // 分隔线：--- / *** / ___
  rules.push(
    new InputRule(/^(?:---|\*\*\*|___)\s$/, (state, _match, start, end) => {
      const tr = state.tr
        .replaceWith(start, end, schema.nodes.horizontal_rule.create())
        .scrollIntoView()
      // 确保分隔线后存在可编辑块
      const after = tr.mapping.map(end)
      const $pos = tr.doc.resolve(after)
      if (!$pos.nodeAfter) {
        tr.insert(after, schema.nodes.paragraph.create())
      }
      tr.setSelection(TextSelection.near(tr.doc.resolve(after)))
      return tr
    })
  )

  // —— 行内 ——（regexp 带两个捕获组：(定界符)(内容)，转换时定界符被移除）
  rules.push(markInputRule(/(\*\*)([^*]+)\*\*$/, schema.marks.strong))
  // 负向后顾防止 **粗体* 中途误触发 em
  rules.push(markInputRule(/(?<!\*)(\*)([^*]+)\*$/, schema.marks.em))
  rules.push(markInputRule(/(~~)([^~]+)~~$/, schema.marks.strike))
  rules.push(markInputRule(/(`)([^`]+)`$/, schema.marks.code))
  // 链接：[text](url) → text 保留为 link mark（非对称定界符，自实现）
  rules.push(
    new InputRule(/\[([^\]]+)\]\(([^)\s]+)\)$/, (state, match, start, end) => {
      const node = schema.text(match[1], [schema.marks.link.create({ href: match[2] })])
      return state.tr.replaceWith(start, end, node)
    })
  )
  // 行内公式：$tex$ → math_inline 原子节点（非 mark，自实现）
  rules.push(
    new InputRule(/(\$)([^$\n]+)\$$/, (state, match, start, end) => {
      const tex = match[2]
      if (!tex.trim()) return null
      const node = schema.nodes.math_inline.create({ tex })
      return state.tr.replaceWith(start, end, node).scrollIntoView()
    })
  )

  return inputRules({ rules })
}
