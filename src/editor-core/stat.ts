/**
 * 文字统计：CJK 感知的字数 / 字符数
 *
 * - words：CJK 字符逐字计数 + 西文按空白分隔的单词数（与常见中文编辑器口径一致）
 * - chars：非空白字符数
 */

/** CJK 统一表意文字（含扩展A）+ 假名 + 谚文 */
const CJK_RE = /[\u4e00-\u9fff\u3400-\u4dbf\u3040-\u30ff\uac00-\ud7af]/

/**
 * @param {string} md Markdown 文本
 * @returns {{ words: number, chars: number }}
 */
export function textStats(md) {
  const text = String(md)
  let words = 0
  let chars = 0
  // 按空白切段：段内每个 CJK 字符计 1，非空段整体计 1 个西文词
  for (const seg of text.split(/\s+/)) {
    if (!seg) continue
    let cjk = 0
    for (const ch of seg) {
      chars++
      if (CJK_RE.test(ch)) cjk++
    }
    words += cjk + (seg.length > cjk ? 1 : 0)
  }
  return { words, chars }
}
