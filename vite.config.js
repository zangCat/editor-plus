import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180,
  },
  build: {
    // 演示应用产物输出到 dist-demo（dist/ 留给 npm 库构建 vite.lib.config.js）
    outDir: 'dist-demo',
    target: 'es2020',
    rollupOptions: {
      output: {
        // M6：首屏静态依赖拆 vendor（并行加载 + 长缓存）。
        // 只归类首屏依赖；动态依赖（mermaid/html2canvas/jspdf/highlight.js/CodeMirror）
        // 保持默认拆分，避免被拖进首屏。
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('prosemirror')) return 'vendor-prosemirror'
          if (id.includes('node_modules/vue/') || id.includes('node_modules/@vue/')) {
            return 'vendor-vue'
          }
          if (
            id.includes('unified') ||
            id.includes('remark') ||
            id.includes('mdast') ||
            id.includes('micromark') ||
            id.includes('unist') ||
            id.includes('vfile') ||
            id.includes('devlop') ||
            id.includes('decode-named-character-reference') ||
            id.includes('character-entities')
          ) {
            return 'vendor-remark'
          }
          return undefined
        },
      },
    },
  },
})
