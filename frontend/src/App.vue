<template>
  <div class="h-screen flex flex-row bg-gray-50 overflow-hidden">
    <SidebarCompact v-if="!isEmbeddedMode" />
    <main class="main-scroll flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import SidebarCompact from './components/SidebarCompact.vue'

const route = useRoute()
const isEmbeddedMode = computed(() => String(route.query.embed || '') === '1')
</script>

<style scoped>
.main-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.5) rgba(226, 232, 240, 0.8);
}

:global(.main-scroll::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:global(.main-scroll::-webkit-scrollbar-track) {
  background: rgba(226, 232, 240, 0.8);
  border-radius: 8px;
}

:global(.main-scroll::-webkit-scrollbar-thumb) {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}

:global(.main-scroll::-webkit-scrollbar-thumb:hover) {
  background: rgba(100, 116, 139, 0.7);
}

:global(html),
:global(body) {
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.5) rgba(226, 232, 240, 0.8);
}

:global(html::-webkit-scrollbar),
:global(body::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:global(html::-webkit-scrollbar-track),
:global(body::-webkit-scrollbar-track) {
  background: rgba(226, 232, 240, 0.8);
  border-radius: 8px;
}

:global(html::-webkit-scrollbar-thumb),
:global(body::-webkit-scrollbar-thumb) {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}

:global(html::-webkit-scrollbar-thumb:hover),
:global(body::-webkit-scrollbar-thumb:hover) {
  background: rgba(100, 116, 139, 0.7);
}

:global(.overflow-auto) {
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.5) rgba(226, 232, 240, 0.8);
}

:global(.overflow-auto::-webkit-scrollbar) {
  width: 8px;
  height: 8px;
}

:global(.overflow-auto::-webkit-scrollbar-track) {
  background: rgba(226, 232, 240, 0.8);
  border-radius: 8px;
}

:global(.overflow-auto::-webkit-scrollbar-thumb) {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}

:global(.overflow-auto::-webkit-scrollbar-thumb:hover) {
  background: rgba(100, 116, 139, 0.7);
}
</style>