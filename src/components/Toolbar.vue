<template>
  <div class="ep-toolbar" role="toolbar">
    <template v-for="(item, i) in items" :key="`${item.id}-${i}`">
      <span v-if="item.id === 'sep'" class="ep-tb-sep" />
      <button
        v-else
        type="button"
        class="ep-tb-btn"
        :class="{ 'is-active': isActive(item) }"
        :title="item.title"
        @mousedown.prevent
        @click="$emit('run', item.id)"
      >
        <span v-if="item.label" class="ep-tb-label">{{ item.label }}</span>
        <svg v-else-if="item.icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path :d="item.icon" />
        </svg>
      </button>
    </template>

    <span class="ep-tb-sep" />
    <div class="ep-tb-modes">
      <button
        type="button"
        class="ep-tb-btn ep-tb-mode"
        :class="{ 'is-active': mode === 'wysiwyg' }"
        @mousedown.prevent
        @click="$emit('set-mode', 'wysiwyg')"
      >
        所见即所得
      </button>
      <button
        type="button"
        class="ep-tb-btn ep-tb-mode"
        :class="{ 'is-active': mode === 'source' }"
        @mousedown.prevent
        @click="$emit('set-mode', 'source')"
      >
        源码
      </button>
      <button
        type="button"
        class="ep-tb-btn ep-tb-mode"
        :class="{ 'is-active': mode === 'ir' }"
        @mousedown.prevent
        @click="$emit('set-mode', 'ir')"
      >
        分屏
      </button>
    </div>
  </div>
</template>

<script setup>
import { toolbarItems } from '../toolbar/config.js'

const props = defineProps({
  /** 激活的命令 id 集合（由宿主在 transaction 时刷新） */
  active: { type: Array, default: () => [] },
  mode: { type: String, default: 'wysiwyg' },
})

defineEmits(['run', 'set-mode'])

const items = toolbarItems

function isActive(item) {
  return props.active.includes(item.id)
}
</script>
