/**
 * 受控 HTML 渲染：白名单净化
 *
 * html_block/html_inline 在编辑器中始终保留原文展示（安全边界）；
 * 仅预览管线将占位节点携带的原始 HTML 字符串经本文件净化后替换为真实 DOM。
 *
 * 策略：危险标签连子树删除；未知标签 unwrap 保留内容；注释删除；
 * href/src 仅允许 http/https/mailto 及相对路径（禁 javascript:/data: 等）。
 */

/** 危险标签：整个子树删除，不保留内容 */
const DANGEROUS_TAGS = new Set([
  'script', 'style', 'iframe', 'frame', 'frameset', 'object', 'embed',
  'link', 'meta', 'base', 'form', 'input', 'button', 'select', 'textarea',
  'svg', 'math', 'template', 'noscript', 'audio', 'video', 'source', 'track',
])

/** 白名单标签：保留 */
const ALLOWED_TAGS = new Set([
  // 行内
  'a', 'abbr', 'b', 'br', 'cite', 'code', 'del', 'dfn', 'em', 'font', 'i',
  'img', 'ins', 'kbd', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub',
  'sup', 'u',
  // 块级
  'blockquote', 'center', 'div', 'details', 'dl', 'dd', 'dt', 'figure',
  'figcaption', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'li', 'ol', 'p',
  'pre', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'tr', 'ul',
])

/** 白名单属性 */
const ALLOWED_ATTRS = new Set([
  'style', 'class', 'title', 'alt', 'src', 'href', 'colspan', 'rowspan',
  'open', 'start', 'type',
])

/** 允许的 URL 协议（http/https/mailto/相对路径） */
const SAFE_URL = /^(https?:|mailto:|\/|#|\.)/i
/** img src 额外放行 data: 图片（本地 base64 图；<img> 上下文不执行脚本，与 DOMPurify 策略一致） */
const SAFE_DATA_URL = /^data:image\/[\w.+-]+(;base64|[;,])/i

/**
 * @param {string} url
 * @param {boolean} isImgSrc 是否为 img 的 src（data: 图片额外放行）
 * @returns {boolean}
 */
function isSafeUrl(url, isImgSrc) {
  const trimmed = (url || '').trim()
  if (!trimmed) return true
  // 控制字符可被浏览器解析器忽略从而拼接出 javascript: 伪协议，直接拒绝
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return false
  // 带协议前缀的必须命中白名单；img src 的 data: 图片额外放行；其余视为相对路径放行
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return SAFE_URL.test(trimmed) || (isImgSrc && SAFE_DATA_URL.test(trimmed))
  }
  return true
}

/**
 * 递归净化：把 node 的安全内容写入 out
 * @param {Node} node
 * @param {Node} out
 */
function sanitizeInto(node, out) {
  for (const child of [...node.childNodes]) {
    if (child.nodeType === 3 /* TEXT_NODE */) {
      out.appendChild(document.createTextNode(child.textContent))
      continue
    }
    if (child.nodeType !== 1 /* ELEMENT_NODE */) continue // 注释等一并丢弃

    const tag = child.tagName.toLowerCase()
    if (DANGEROUS_TAGS.has(tag)) continue
    if (!ALLOWED_TAGS.has(tag)) {
      sanitizeInto(child, out) // 未知标签：unwrap，保留子内容
      continue
    }

    const el = document.createElement(tag)
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase()
      if (!ALLOWED_ATTRS.has(name)) continue
      if ((name === 'href' || name === 'src') && !isSafeUrl(attr.value, tag === 'img' && name === 'src')) continue
      el.setAttribute(name, attr.value)
    }
    sanitizeInto(child, el)
    out.appendChild(el)
  }
}

/**
 * 净化 HTML 片段
 * @param {string} html 原始 HTML 字符串
 * @returns {DocumentFragment | null} null 表示解析失败或无有效内容，调用方应保留原文占位
 */
export function sanitizeHtmlFragment(html) {
  let doc
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return null
  }
  if (!doc || !doc.body) return null
  const frag = document.createDocumentFragment()
  sanitizeInto(doc.body, frag)
  return frag.hasChildNodes() ? frag : null
}
