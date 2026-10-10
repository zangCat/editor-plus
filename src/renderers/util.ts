/**
 * 渲染器共享小工具
 */

/**
 * 宽松 JSON 解析：支持函数字面量、尾逗号、无引号键等 echarts option /
 * wavedrom source 常见写法（图表配置不是纯数据，必须容忍 JS 语法）。
 * 与 vditor 的实现一致：利用 Function 构造器按表达式求值。
 * @param {string} text
 * @returns {any} 解析结果；失败时返回 null（调用方自行报错/回退源码）
 */
export function looseJsonParse(text) {
  try {
    return Function('"use strict";return (' + text + ')')()
  } catch {
    return null
  }
}
