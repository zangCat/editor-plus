/**
 * 公众号（WeChat）/social 平台输出适配
 *
 * 微信编辑器会剥离 <style> 标签与 class，只保留元素 inline style，
 * 因此输出必须把全部样式内联到元素上（applyInlineStyles）。
 * Mermaid 已由 codeRenderer 注册表栅格化为 PNG，天然兼容。
 */

/* eslint-disable */

/** @typedef {Record<string, string>} CssDecl camelCase 声明，如 { fontSize: '15px' } */

/**
 * WeChat 主题：选择器 → 样式声明。
 * 注意对象键序即合并优先级（后者覆盖前者）：
 * `code` 先于 `pre code`，行内 code 样式会被代码块内的 code 覆盖。
 * @type {Record<string, CssDecl>}
 */
export const wechatTheme = {
  // 根容器
  section: {
    fontFamily:
      "-apple-system,BlinkMacSystemFont,'Helvetica Neue','PingFang SC','Microsoft YaHei',sans-serif",
    fontSize: '15px',
    color: '#3e3e3e',
    lineHeight: '1.75',
    wordBreak: 'break-word',
  },
  // 标题
  h1: {
    margin: '32px 0 16px',
    fontSize: '21px',
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: '1.4',
  },
  h2: {
    margin: '28px 0 14px',
    fontSize: '18px',
    fontWeight: '700',
    color: '#1a1a1a',
    paddingBottom: '6px',
    borderBottom: '1px solid #ececec',
  },
  h3: {
    margin: '24px 0 12px',
    fontSize: '16px',
    fontWeight: '700',
    color: '#1a1a1a',
  },
  h4: { margin: '20px 0 10px', fontSize: '15px', fontWeight: '700' },
  h5: { margin: '18px 0 8px', fontSize: '14px', fontWeight: '700', color: '#555' },
  h6: { margin: '18px 0 8px', fontSize: '14px', fontWeight: '700', color: '#888' },
  // 文本
  p: { margin: '16px 0' },
  strong: { fontWeight: '700', color: '#1a1a1a' },
  em: { fontStyle: 'italic' },
  del: { textDecoration: 'line-through', color: '#999' },
  a: { color: '#576b95', textDecoration: 'none' },
  // 列表
  ul: { margin: '16px 0', paddingLeft: '24px' },
  ol: { margin: '16px 0', paddingLeft: '24px' },
  li: { margin: '4px 0' },
  // 引用
  blockquote: {
    margin: '16px 0',
    padding: '10px 14px',
    borderLeft: '3px solid #42b983',
    background: '#f7f7f7',
    color: '#666',
    borderRadius: '0 4px 4px 0',
  },
  'blockquote p': { margin: '4px 0', color: '#666' },
  // 行内 code（先声明，被下方 pre code 覆盖）
  code: {
    fontFamily: "Menlo,Consolas,'Courier New',monospace",
    fontSize: '14px',
    color: '#d63200',
    background: 'rgba(27,31,35,.06)',
    padding: '2px 4px',
    borderRadius: '3px',
  },
  // 代码块
  pre: {
    margin: '16px 0',
    padding: '12px 14px',
    background: '#282c34',
    borderRadius: '4px',
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
  },
  'pre code': {
    color: '#d4d4d4',
    background: 'none',
    padding: '0',
    borderRadius: '0',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  // 表格
  table: { borderCollapse: 'collapse', margin: '16px 0', width: '100%', fontSize: '14px' },
  th: {
    border: '1px solid #dcdcdc',
    padding: '8px 12px',
    background: '#f2f2f2',
    fontWeight: '600',
    textAlign: 'left',
  },
  td: { border: '1px solid #dcdcdc', padding: '8px 12px', textAlign: 'left' },
  // 其他
  hr: { border: 'none', borderTop: '1px solid #e0e0e0', margin: '24px 0' },
  img: { maxWidth: '100%', margin: '16px auto', borderRadius: '4px', display: 'block' },
  // highlight.js token（One Dark 配色，匹配深色 pre 底）
  '.hljs-keyword': { color: '#c678dd' },
  '.hljs-selector-tag': { color: '#e06c75' },
  '.hljs-literal': { color: '#d19a66' },
  '.hljs-number': { color: '#d19a66' },
  '.hljs-string': { color: '#98c379' },
  '.hljs-attr': { color: '#d19a66' },
  '.hljs-attribute': { color: '#d19a66' },
  '.hljs-title': { color: '#61afef' },
  '.hljs-title.function_': { color: '#61afef' },
  '.hljs-title.class_': { color: '#e5c07b' },
  '.hljs-function': { color: '#61afef' },
  '.hljs-comment': { color: '#7f848e', fontStyle: 'italic' },
  '.hljs-built_in': { color: '#e5c07b' },
  '.hljs-type': { color: '#e5c07b' },
  '.hljs-params': { color: '#e06c75' },
  '.hljs-variable': { color: '#e06c75' },
  '.hljs-name': { color: '#e06c75' },
  '.hljs-tag': { color: '#e06c75' },
  '.hljs-meta': { color: '#61afef' },
  '.hljs-symbol': { color: '#56b6c2' },
  '.hljs-operator': { color: '#56b6c2' },
  '.hljs-bullet': { color: '#d19a66' },
  '.hljs-section': { color: '#61afef' },
  '.hljs-selector-class': { color: '#98c379' },
  '.hljs-selector-id': { color: '#61afef' },
  '.hljs-property': { color: '#e06c75' },
  '.hljs-doctag': { color: '#c678dd' },
  '.hljs-quote': { color: '#7f848e', fontStyle: 'italic' },
  '.hljs-regexp': { color: '#98c379' },
  '.hljs-subst': { color: '#d4d4d4' },
}

/* eslint-enable */

/**
 * 公众号适配总入口：任务清单前缀 + section 根容器 + 全量内联样式。
 * 预览/复制/导出三处共用，保证输出一致。
 * @param {HTMLElement} root
 */
export function adaptWechat(root) {
  adaptTaskList(root)
  // 微信习惯：正文包一层 section 根容器，承载字体/行高/字色等基础样式
  const section = document.createElement('section')
  while (root.firstChild) section.appendChild(root.firstChild)
  root.appendChild(section)
  applyInlineStyles(root, wechatTheme)
}

/**
 * 微信不支持 ::before/::after 与属性选择器，
 * 任务清单改为字符前缀（☑/☐），可读性优先。
 * @param {HTMLElement} root
 */
export function adaptTaskList(root) {
  for (const li of root.querySelectorAll('li[data-checked]')) {
    const done = li.getAttribute('data-checked') === 'true'
    li.insertBefore(document.createTextNode(done ? '☑ ' : '☐ '), li.firstChild)
    if (done) {
      for (const p of li.querySelectorAll('p')) {
        p.setAttribute('style', joinStyle({ color: '#999', textDecoration: 'line-through' }))
      }
    }
  }
}

/**
 * 把 theme 内联到 root 下所有元素（含 root 自身）。
 * 支持三类选择器：`tag`、`.class`、`tag.class`，以及空格分隔的后代选择器。
 * @param {HTMLElement} root
 * @param {Record<string, CssDecl>} theme
 */
export function applyInlineStyles(root, theme) {
  const els = [root, ...root.querySelectorAll('*')]
  for (const el of els) {
    /** @type {CssDecl} */
    let decl = {}
    for (const [sel, css] of Object.entries(theme)) {
      if (matchSelector(el, sel)) Object.assign(decl, css)
    }
    if (Object.keys(decl).length) {
      // 保留元素已有 inline style（如原生 HTML 节点携带的 style），theme 优先
      const existing = parseStyle(el.getAttribute('style') || '')
      el.setAttribute('style', joinStyle({ ...existing, ...decl }))
    }
  }
}

/**
 * 后代选择器匹配：从右往左逐段匹配元素自身与祖先链
 * @param {HTMLElement} el
 * @param {string} sel
 */
function matchSelector(el, sel) {
  const parts = sel.trim().split(/\s+/)
  let node = /** @type {HTMLElement | null} */ (el)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!node || !matchSegment(node, parts[i])) return false
    node = node.parentElement
  }
  return true
}

function matchSegment(el, seg) {
  if (seg.startsWith('.')) return el.classList.contains(seg.slice(1))
  if (seg.includes('.')) {
    const dot = seg.indexOf('.')
    const tag = seg.slice(0, dot)
    if (el.tagName.toLowerCase() !== tag) return false
    return seg
      .slice(dot + 1)
      .split('.')
      .every((c) => el.classList.contains(c))
  }
  return el.tagName.toLowerCase() === seg
}

/** camelCase 声明 → `k:v;k:v` 内联样式串 */
function joinStyle(css) {
  return Object.entries(css)
    .map(([k, v]) => `${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}:${v}`)
    .join(';')
}

/** 内联样式串 → camelCase 声明 */
function parseStyle(str) {
  /** @type {CssDecl} */
  const css = {}
  for (const pair of str.split(';')) {
    const i = pair.indexOf(':')
    if (i > 0) {
      const kebab = pair.slice(0, i).trim()
      if (kebab) {
        const camel = kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
        css[camel] = pair.slice(i + 1).trim()
      }
    }
  }
  return css
}
