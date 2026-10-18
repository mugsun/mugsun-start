<!-- 品牌 logo：方标（mugsun-docs/public/brand/svg，与 mugsun-pc#72 同源）+ Saira 实时字标 MUGSUN；整体高 28px -->
<script setup lang="ts">
import mark from '@/assets/brand/mugsun-icon-dark.svg'
defineProps<{ dark: boolean }>()
</script>

<template>
  <span class="brand" :class="{ 'on-dark': dark }" role="img" aria-label="Mugsun">
    <span class="mark"><img :src="mark" alt="" width="28" height="28" draggable="false" /></span>
    <span class="word" aria-hidden="true">MUGSUN</span>
  </span>
</template>

<style scoped>
@font-face {
  font-family: 'Mugsun Saira';
  font-style: normal;
  font-weight: 600;
  src: url('@/assets/brand/fonts/mugsun-saira-600.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0047, U+004D, U+004E, U+0053, U+0055;
}
.brand { display: inline-flex; align-items: center; gap: 8px; height: 28px; }
.mark { position: relative; width: 28px; height: 28px; border-radius: 6px; overflow: hidden; flex: none; }
.mark img { display: block; width: 28px; height: 28px; }
/* 深色底上黑方块会融进背景：1px 内描边（同 pc#72） */
.on-dark .mark::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12); }
.word { font-family: 'Mugsun Saira', system-ui, -apple-system, 'Segoe UI', sans-serif; font-weight: 600; font-size: 16px; letter-spacing: 0.08em; line-height: 28px; color: var(--el-text-color-primary); }
</style>
