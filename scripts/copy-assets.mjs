/**
 * 构建 lib 后处理：拼接核心样式为 dist/index.css
 *
 * 核心 JS 产物不携带 CSS import（避免 SSR/Node 测试环境解析 css 失败，
 * 也避免 KaTeX 等可选样式被强制打进所有使用方），样式统一由消费方显式引入：
 *
 *   import 'editor-plus/styles.css'            // 本脚本拼接的三份核心样式
 *   import 'katex/dist/katex.min.css'          // 需要公式渲染时按需引入
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const sources = [
  require.resolve('prosemirror-view/style/prosemirror.css'),
  require.resolve('prosemirror-gapcursor/style/gapcursor.css'),
  path.join(process.cwd(), 'src', 'styles', 'editor-plus.css'),
]

const header =
  '/*! editor-plus 核心样式 = prosemirror-view + prosemirror-gapcursor + editor-plus（构建时拼接） */\n'
const css = header + (await Promise.all(sources.map((p) => readFile(p, 'utf8')))).join('\n')

await mkdir('dist', { recursive: true })
await writeFile(path.join('dist', 'index.css'), css)
console.log(`[copy-assets] dist/index.css ← ${sources.length} 份样式，${css.length} bytes`)
