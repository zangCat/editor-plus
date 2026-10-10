/**
 * markdown-core：Markdown ⇄ ProseMirror 文档模型的唯一边界
 *
 * 使用方式：
 *   import { markdownToDoc, docToMarkdown, editorPlusSchema } from './markdown-core'
 *
 * round-trip 不动点性质（M1 生死线）：
 *   markdownToDoc(md).toJSON()
 *     ===
 *   markdownToDoc(docToMarkdown(markdownToDoc(md))).toJSON()
 */
export { editorPlusSchema } from './schema.js'
export { markdownToDoc, markdownToAst, mdastToDoc, mdProcessor } from './parser.js'
export { docToMarkdown, docToMdast, stringifyProcessor } from './serializer.js'
