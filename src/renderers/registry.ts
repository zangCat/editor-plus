/**
 * 渲染器注册表：输出管线的扩展点（公众号/social 平台适配的未来挂载点）
 *
 * 设计（借鉴 mdeditor 渲染器 + vditor previewRender.transform 钩子的优点）：
 * - codeRenderer：lang → (code, lang) => html ｜ Promise<html>，如 mermaid → PNG 栅格化
 * - transform：对 DOMSerializer 输出的 HTML 元素做后处理（如内联样式化）
 * - 复制/导出/预览应共用同一条 renderMarkdownToHTML 管线，保证输出一致
 */

/** @type {Map<string, (code: string, lang: string) => string | Promise<string>>} */
const codeRenderers = new Map()

/** @type {Array<(el: HTMLElement) => void | Promise<void>>} */
const transforms = []

/**
 * 注册语言渲染器（同名覆盖）
 * @param {string} lang
 * @param {(code: string, lang: string) => string | Promise<string>} renderer
 */
export function registerCodeRenderer(lang, renderer) {
  codeRenderers.set(lang, renderer)
  return () => codeRenderers.delete(lang)
}

export function getCodeRenderer(lang) {
  return codeRenderers.get(lang) || null
}

export function listCodeRenderers() {
  return [...codeRenderers.keys()]
}

/**
 * 注册文档级 transform（后处理钩子）
 * @param {(el: HTMLElement) => void | Promise<void>} fn
 */
export function registerTransform(fn) {
  transforms.push(fn)
  return () => {
    const i = transforms.indexOf(fn)
    if (i >= 0) transforms.splice(i, 1)
  }
}

export function getTransforms() {
  return [...transforms]
}
