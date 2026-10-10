/**
 * editor-plus 的 ProseMirror Schema
 *
 * 设计原则：文档模型是唯一数据源。
 * 所有节点都可无损映射到 mdast（GFM），由 markdown-core 的 parser/serializer 负责 round-trip。
 *
 * MVP 决策：
 * - 表格为静态表格（不引入 prosemirror-tables），对齐信息存在 table.align 数组属性
 * - GFM 任务清单用 list_item.checked（null | true | false）表达
 * - 原始 HTML 通过 html_block / html_inline 节点保留（内容为纯文本，输出时由 stringify 还原）
 */
import { Schema } from 'prosemirror-model'

export const editorPlusSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },

    paragraph: {
      content: 'inline*',
      group: 'block',
      parseDOM: [{ tag: 'p' }],
      toDOM: () => ['p', 0],
    },

    heading: {
      content: 'inline*',
      group: 'block',
      defining: true,
      attrs: { level: { default: 1 } },
      parseDOM: [1, 2, 3, 4, 5, 6].map((level) => ({
        tag: `h${level}`,
        attrs: { level },
      })),
      toDOM: (node) => [`h${node.attrs.level}`, 0],
    },

    blockquote: {
      content: 'block+',
      group: 'block',
      defining: true,
      parseDOM: [{ tag: 'blockquote' }],
      toDOM: () => ['blockquote', 0],
    },

    bullet_list: {
      content: 'list_item+',
      group: 'block',
      parseDOM: [{ tag: 'ul' }],
      toDOM: () => ['ul', 0],
    },

    ordered_list: {
      content: 'list_item+',
      group: 'block',
      attrs: { order: { default: 1 } },
      parseDOM: [
        {
          tag: 'ol',
          getAttrs: (dom) => ({
            order: dom.hasAttribute('start') ? Number(dom.getAttribute('start')) : 1,
          }),
        },
      ],
      toDOM: (node) => [
        'ol',
        { start: node.attrs.order === 1 ? null : String(node.attrs.order) },
        0,
      ],
    },

    list_item: {
      content: 'block+',
      defining: true,
      attrs: { checked: { default: null } },
      parseDOM: [
        {
          tag: 'li',
          getAttrs: (dom) => {
            if (dom.hasAttribute('data-checked')) {
              return { checked: dom.getAttribute('data-checked') === 'true' }
            }
            return { checked: null }
          },
        },
      ],
      toDOM: (node) =>
        node.attrs.checked == null
          ? ['li', 0]
          : ['li', { 'data-checked': String(node.attrs.checked) }, 0],
    },

    code_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      marks: '',
      attrs: { params: { default: null } },
      parseDOM: [
        {
          tag: 'pre',
          preserveWhitespace: 'full',
          getAttrs: (dom) => {
            const code = dom.querySelector('code')
            const cls = (code && code.className) || dom.className || ''
            const m = cls.match(/language-([\w+-]+)/)
            return { params: m ? m[1] : null }
          },
        },
      ],
      toDOM: (node) => [
        'pre',
        ['code', { class: node.attrs.params ? `language-${node.attrs.params}` : null }, 0],
      ],
    },

    horizontal_rule: {
      group: 'block',
      parseDOM: [{ tag: 'hr' }],
      toDOM: () => ['hr'],
    },

    // 静态表格：首行为表头（位置约定），对齐存 table.align（mdast align 数组的直译）
    table: {
      content: 'table_row+',
      group: 'block',
      tableRole: 'table',
      isolating: true,
      attrs: { align: { default: null } },
      parseDOM: [{ tag: 'table' }],
      toDOM: () => ['table', ['tbody', 0]],
    },

    table_row: {
      content: '(table_header_cell | table_cell)*',
      tableRole: 'row',
      parseDOM: [{ tag: 'tr' }],
      toDOM: () => ['tr', 0],
    },

    table_header_cell: {
      content: 'block+',
      tableRole: 'header_cell',
      isolating: true,
      parseDOM: [{ tag: 'th' }],
      toDOM: () => ['th', 0],
    },

    table_cell: {
      content: 'block+',
      tableRole: 'cell',
      isolating: true,
      parseDOM: [{ tag: 'td' }],
      toDOM: () => ['td', 0],
    },

    image: {
      inline: true,
      atom: true,
      draggable: true,
      group: 'inline',
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null },
      },
      parseDOM: [
        {
          tag: 'img[src]',
          getAttrs: (dom) => ({
            src: dom.getAttribute('src'),
            alt: dom.getAttribute('alt'),
            title: dom.getAttribute('title'),
          }),
        },
      ],
      toDOM: (node) => ['img', { ...node.attrs }],
    },

    hard_break: {
      inline: true,
      group: 'inline',
      selectable: false,
      parseDOM: [{ tag: 'br' }],
      toDOM: () => ['br'],
    },

    html_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      marks: '',
      parseDOM: [{ tag: 'div[data-html-block]' }],
      toDOM: () => ['div', { 'data-html-block': '' }, 0],
    },

    html_inline: {
      inline: true,
      atom: true,
      group: 'inline',
      attrs: { html: {} },
      parseDOM: [
        {
          tag: 'span[data-html-inline]',
          getAttrs: (dom) => ({ html: dom.getAttribute('data-html-inline') }),
        },
      ],
      toDOM: (node) => [
        'span',
        { 'data-html-inline': node.attrs.html, contenteditable: 'false' },
        node.attrs.html,
      ],
    },

    // 数学公式：编辑器内保留 TeX 源码占位，仅预览时经 KaTeX 渲染
    math_block: {
      content: 'text*',
      group: 'block',
      code: true,
      defining: true,
      marks: '',
      parseDOM: [{ tag: 'div[data-math-block]', preserveWhitespace: 'full' }],
      toDOM: () => ['div', { 'data-math-block': '' }, 0],
    },

    math_inline: {
      inline: true,
      atom: true,
      group: 'inline',
      // marks: '' 保证原子节点不会被加 mark，mdast 序列化不会漂移
      marks: '',
      attrs: { tex: {} },
      parseDOM: [
        {
          tag: 'span[data-math-inline]',
          getAttrs: (dom) => ({ tex: dom.getAttribute('data-math-inline') }),
        },
      ],
      toDOM: (node) => [
        'span',
        { 'data-math-inline': node.attrs.tex, contenteditable: 'false' },
        node.attrs.tex,
      ],
    },

    // 必须显式声明 inline 组：content: 'inline*' 的解析只匹配组内节点类型，
    // text 不入组则纯文本内容全部违反 schema（输入会被 PM 校验回滚清理）
    text: { group: 'inline' },
  },

  marks: {
    strong: {
      parseDOM: [
        { tag: 'strong' },
        { tag: 'b' },
        { tag: 'bdi' },
        {
          style: 'font-weight',
          getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null,
        },
      ],
      toDOM: () => ['strong', 0],
    },

    em: {
      parseDOM: [
        { tag: 'i' },
        { tag: 'em' },
        { style: 'font-style', getAttrs: (value) => value === 'italic' && null },
      ],
      toDOM: () => ['em', 0],
    },

    strike: {
      parseDOM: [{ tag: 's' }, { tag: 'del' }, { tag: 'strike' }],
      toDOM: () => ['s', 0],
    },

    code: {
      code: true,
      excludes: '_',
      parseDOM: [{ tag: 'code' }],
      toDOM: () => ['code', 0],
    },

    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'a[href]',
          getAttrs: (dom) => ({
            href: dom.getAttribute('href'),
            title: dom.getAttribute('title'),
          }),
        },
      ],
      toDOM: (node) => ['a', { href: node.attrs.href, title: node.attrs.title }, 0],
    },
  },
})
