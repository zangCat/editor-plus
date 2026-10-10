<template>
  <div ref="previewEl" class="ep-preview" />
</template>

<script setup>
/**
 * PreviewPane：消费 renderMarkdownToHTML 预览管线
 * 200ms 防抖；内容来自 DOMSerializer（受控、已转义），无 XSS 注入面
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { renderMarkdownToHTML } from '../pipeline/preview.js'

const props = defineProps({
  markdown: { type: String, default: '' },
  debounce: { type: Number, default: 200 },
  /** 输出样式变体：default（GitHub 风）/ wechat（公众号内联样式） */
  variant: { type: String, default: 'default' },
})

const previewEl = ref(null)
let timer = null

function render() {
  if (!previewEl.value) return
  renderMarkdownToHTML(props.markdown, previewEl.value, { variant: props.variant }).catch(
    (e) => {
      console.error('[editor-plus] preview render failed:', e)
    }
  )
}

onMounted(render)

watch(
  () => [props.markdown, props.variant],
  () => {
    clearTimeout(timer)
    timer = setTimeout(render, props.debounce)
  }
)

onBeforeUnmount(() => clearTimeout(timer))
</script>
