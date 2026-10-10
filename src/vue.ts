/**
 * editor-plus Vue 适配层子入口（可选）
 *
 * 核心本身框架无关；本入口仅提供 v-model 薄封装组件（工具栏/大纲/字数统计），
 * 适合快速接入 Vue 3 项目。需要宿主提供 vue >= 3.2（optional peerDependency）。
 *
 * 自定义 UI 的项目无需引入本入口，直接使用核心入口的 NextEditor 即可。
 */
export { default as EditorPlus } from './components/EditorPlus.vue'
