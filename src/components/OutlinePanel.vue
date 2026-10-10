<template>
  <aside class="ep-outline">
    <div class="ep-outline__title">大纲</div>
    <div v-if="!items.length" class="ep-outline__empty">暂无标题</div>
    <nav v-else class="ep-outline__list">
      <button
        v-for="(item, i) in items"
        :key="i"
        type="button"
        class="ep-outline__item"
        :style="{ '--lv': item.level }"
        :title="item.text"
        @click="emit('jump', item)"
      >
        {{ item.text }}
      </button>
    </nav>
  </aside>
</template>

<script setup>
/**
 * OutlinePanel：标题大纲面板
 * - items 由父层传入（{ level, text, pos }）
 * - 点击条目向上抛 jump 事件，跳转由编辑器层完成
 */
defineProps({
  items: { type: Array, default: () => [] },
})

const emit = defineEmits(['jump'])
</script>
