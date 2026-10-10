/// <reference types="vite/client" />

/** Vite CSS ?inline 导入返回字符串 */
declare module '*.css?inline' {
  const css: string
  export default css
}

/** .vue 单文件组件的通用类型（供 tsc / dts 生成解析 .vue 导入） */
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
