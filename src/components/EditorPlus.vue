<template>
  <div class="ep">
    <Toolbar
      :active="activeIds"
      :mode="mode"
      @run="runCmd"
      @set-mode="(m) => emit('update:mode', m)"
    />
    <div class="ep-body">
      <OutlinePanel v-if="outline" :items="outlineItems" @jump="jumpTo" />
      <div ref="hostEl" class="ep-host" />
    </div>
    <div v-if="counter" class="ep-status">
      <span>{{ stats.words }} 字</span>
      <span class="ep-status__sep">·</span>
      <span>{{ stats.chars }} 字符</span>
    </div>
  </div>
</template>

<script setup>
/**
 * EditorPlus：NextEditor 的 Vue3 薄适配层
 * - v-model + v-model:mode 双向绑定（含回声抑制：外部值与内部一致时不重建，防光标跳动）
 * - 命令 / 激活状态透传
 * - outline：左侧标题大纲（点击跳转）；counter：底部字数统计
 */
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { NextEditor } from '../editor-core/index.js'
import Toolbar from './Toolbar.vue'
import OutlinePanel from './OutlinePanel.vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  mode: { type: String, default: 'wysiwyg' },
  placeholder: { type: String, default: '' },
  outline: { type: Boolean, default: false },
  counter: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'update:mode', 'change'])

const hostEl = ref(null)
/** @type {NextEditor|null} */
let editor = null
/** 内部维护的最新 markdown，用于回声抑制 */
let innerValue = props.modelValue

const activeIds = ref([])
const outlineItems = ref([])
const stats = ref({ words: 0, chars: 0 })

/** 刷新大纲与字数（change/modeChange/build 事件 + 初始） */
function refreshMeta() {
  if (!editor) return
  outlineItems.value = editor.getOutline()
  stats.value = editor.getStats()
}

function jumpTo(item) {
  if (editor) editor.scrollToPos(item.pos)
}

onMounted(() => {
  editor = new NextEditor({
    markdown: props.modelValue,
    mode: props.mode,
    placeholder: props.placeholder,
    mount: hostEl.value,
    onChange: (md) => {
      innerValue = md
      emit('update:modelValue', md)
      emit('change', md)
    },
  })

  editor.on('transaction', () => {
    activeIds.value = editor.commands.activeIds()
  })
  activeIds.value = editor.commands.activeIds()
  // 内容/模式变化与异步视图构建就绪时刷新大纲、字数
  editor.on('change', refreshMeta)
  editor.on('modeChange', refreshMeta)
  editor.on('build', refreshMeta)
  refreshMeta()
  // 调试钩子：仅开发模式在控制台暴露编辑器实例（window.__epEditor）
  if (import.meta.env?.DEV && typeof window !== 'undefined') window.__epEditor = editor
})

onBeforeUnmount(() => {
  if (editor) editor.destroy()
  editor = null
})

// 外部值变化 → 写入编辑器（与内部值一致时跳过）
watch(
  () => props.modelValue,
  (v) => {
    if (v !== innerValue && editor) {
      editor.setMarkdown(v || '')
      innerValue = editor.getMarkdown()
    }
  }
)

// 外部模式变化 → 切换视图
watch(
  () => props.mode,
  (m) => {
    if (editor && m !== editor.mode) {
      editor.setMode(m)
      innerValue = editor.getMarkdown()
      emit('update:modelValue', innerValue)
    }
  }
)

function runCmd(id, ...args) {
  if (editor) editor.commands.run(id, ...args)
}

function focus() {
  if (editor) editor.focus()
}

defineExpose({ runCmd, focus, getEditor: () => editor })
</script>
