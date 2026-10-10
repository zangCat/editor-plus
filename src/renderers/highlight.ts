/**
 * 代码块高亮：highlight.js 按需懒加载（core + 常用语言动态 import，避免 580KB+ 全量打包）
 */

/** @type {Promise<any> | null} */
let hljsPromise = null

const COMMON_LANGS = [
  'javascript',
  'typescript',
  'xml',
  'css',
  'json',
  'bash',
  'markdown',
  'python',
]

// 必须用字符串字面量动态 import：Vite 无法重写指向 node_modules 深路径的模板字符串 import
const LANG_LOADERS = {
  javascript: () => import('highlight.js/lib/languages/javascript'),
  typescript: () => import('highlight.js/lib/languages/typescript'),
  xml: () => import('highlight.js/lib/languages/xml'),
  css: () => import('highlight.js/lib/languages/css'),
  json: () => import('highlight.js/lib/languages/json'),
  bash: () => import('highlight.js/lib/languages/bash'),
  markdown: () => import('highlight.js/lib/languages/markdown'),
  python: () => import('highlight.js/lib/languages/python'),
}

export function getHljs() {
  if (!hljsPromise) {
    hljsPromise = import('highlight.js/lib/core').then(async (mod) => {
      const hljs = mod.default
      await Promise.all(
        COMMON_LANGS.map((lang) =>
          LANG_LOADERS[lang]().then((l) => hljs.registerLanguage(lang, l.default))
        )
      )
      return hljs
    })
  }
  return hljsPromise
}

/**
 * 高亮代码 → HTML 字符串（hljs.highlight 输出已转义，安全）
 * @param {string} code
 * @param {string} lang
 */
export async function highlightCode(code, lang) {
  try {
    const hljs = await getHljs()
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    }
    return hljs.highlightAuto(code).value
  } catch {
    return escapeHtml(code)
  }
}

export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
