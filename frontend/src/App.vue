<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <div class="fixed top-0 left-0 h-full w-12 z-50" @mouseenter="sidebarVisible = true"></div>
    
    <aside 
      @mouseleave="sidebarVisible = false" 
      @mouseenter="clearHideTimer" 
      :class="[
        'fixed top-0 left-0 h-full bg-blue-800 text-white z-[9999] transition-all duration-300',
        sidebarVisible ? 'translate-x-0 w-64' : '-translate-x-full w-64'
      ]"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-blue-600">
        <h2 class="text-lg font-bold">STC Produção</h2>
        <button @click="sidebarVisible = false" class="lg:hidden">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <nav class="px-2 py-2 space-y-1">
        <router-link 
          to="/resumen" 
          class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors" 
          :class="{ 'bg-blue-600': $route.path === '/resumen' }"
        >
          <span>📑</span> Resumen Ensayos
        </router-link>
        
        <router-link 
          to="/resumen-diario" 
          class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors" 
          :class="{ 'bg-blue-600': $route.path === '/resumen-diario' }"
        >
          <span>📅</span> Resumen Diario
        </router-link>
        
        <router-link 
          to="/stats" 
          class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors" 
          :class="{ 'bg-blue-600': $route.path === '/stats' }"
        >
          <span>📊</span> Gráficos
        </router-link>
        
        <router-link 
          to="/uster" 
          class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors" 
          :class="{ 'bg-blue-600': $route.path === '/uster' }"
        >
          <span>🧩</span> Uster
        </router-link>
        
        <router-link 
          to="/tenso" 
          class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors" 
          :class="{ 'bg-blue-600': $route.path === '/tenso' }"
        >
          <span>🧪</span> TensoRapid
        </router-link>
      </nav>
    </aside>

    <button 
      @click="sidebarVisible = !sidebarVisible" 
      class="lg:hidden fixed top-3 left-3 z-50 text-blue-600 bg-blue-100 p-1.5 rounded-md hover:bg-blue-600 hover:text-white transition-colors shadow-sm"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <main @click="sidebarVisible = false" class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const sidebarVisible = ref(false)
let hideTimer = null

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}
</script>