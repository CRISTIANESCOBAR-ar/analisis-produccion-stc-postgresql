<template>
  <div class="titlebar-container flex items-center justify-between bg-slate-900 text-white select-none shrink-0 z-50 px-3">
    <!-- Left: Brand / History Navigation (Slack style) -->
    <div class="flex items-center gap-2 titlebar-left shrink-0">
      <div class="flex items-center gap-0.5 nav-buttons">
        <button 
          @click="goBack" 
          title="Atrás" 
          class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button 
          @click="goForward" 
          title="Adelante" 
          class="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <span class="titlebar-font text-[13px] font-semibold text-slate-400 tracking-wide hidden sm:inline leading-none">Santana STC</span>
    </div>

    <!-- Center: Search Bar -->
    <div ref="searchContainerRef" class="search-container relative w-full max-w-md mx-2">
      <!-- Search Input -->
      <div
        class="search-input flex items-center bg-slate-800/80 hover:bg-slate-700/80 rounded px-2.5 cursor-text transition-colors border border-slate-700/60 focus-within:border-blue-500 focus-within:bg-slate-900 search-input-height"
        @click="openPalette"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 mr-2 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref="searchInput"
          type="text"
          v-model="searchQuery"
          placeholder="Buscar lotes, partidas, vistas... (Ctrl+K)"
          class="titlebar-font bg-transparent border-none outline-none text-slate-200 w-full placeholder-slate-500 text-[13px] leading-none"
          @keydown.down.prevent="navigateResults(1)"
          @keydown.up.prevent="navigateResults(-1)"
          @keydown.enter.prevent="selectResult"
          @keydown.esc="closePalette"
          @focus="isOpen = true"
          @blur="handleBlur"
        />
        <div class="titlebar-font text-[11px] text-slate-500 ml-2 shrink-0 border border-slate-600/50 rounded px-1.5 py-0.5 leading-tight bg-slate-800/50 hidden sm:block">Ctrl K</div>
      </div>
    </div>
  </div>

  <!-- Dropdown Results: Teleported to body so overflow:hidden doesn't clip it -->
  <Teleport to="body">
    <div 
      v-if="isOpen && filteredResults.length > 0" 
      class="fixed bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden dropdown-no-drag z-50"
      :style="dropdownStyle"
    >
      <ul class="max-h-[60vh] overflow-y-auto py-1">
        <li 
          v-for="(result, index) in filteredResults" 
          :key="result.path"
          @mousedown.prevent="goToRoute(result.path)"
          @mouseenter="selectedIndex = index"
          :class="[
            'px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors',
            selectedIndex === index ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'
          ]"
        >
          <div class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span class="font-medium">{{ result.title }}</span>
          </div>
          <span class="text-xs font-semibold text-slate-400 px-2 py-0.5 bg-slate-100 rounded-full" v-if="result.group">{{ result.group }}</span>
        </li>
      </ul>
    </div>
    <div 
      v-else-if="isOpen && searchQuery.length > 0" 
      class="fixed bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden p-6 text-center text-slate-500 text-sm dropdown-no-drag z-50"
      :style="dropdownStyle"
    >
      No se encontraron resultados para <strong class="text-slate-700">"{{ searchQuery }}"</strong>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const searchInput = ref(null)
const searchContainerRef = ref(null)
const searchQuery = ref('')
const isOpen = ref(false)
const selectedIndex = ref(0)
const dropdownPos = ref({ top: 0, left: 0, width: 0 })

// Recalculate dropdown position when opening
watch(isOpen, (val) => {
  if (val) {
    nextTick(updateDropdownPos)
  }
})

function updateDropdownPos() {
  if (!searchContainerRef.value) return
  const rect = searchContainerRef.value.getBoundingClientRect()
  dropdownPos.value = {
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width
  }
}

const dropdownStyle = computed(() => ({
  top: `${dropdownPos.value.top}px`,
  left: `${dropdownPos.value.left}px`,
  width: `${dropdownPos.value.width}px`,
  zIndex: 9999
}))

// Extract searchable routes
const searchableRoutes = computed(() => {
  const routes = router.options.routes || []
  return routes
    .filter(r => r.meta && r.meta.title) // Only routes with titles
    .map(r => ({
      path: r.path,
      title: r.meta.title,
      keywords: r.meta.keywords || [],
      isRoute: true,
      group: getRouteGroup(r.path)
    }))
})

function getRouteGroup(path) {
  if (path.includes('resumen') || path.includes('hvi') || path.includes('ensayos')) return 'Laboratorio'
  if (path.includes('tejeduria') || path.includes('calidad') || path.includes('revisor')) return 'Calidad'
  if (path.includes('indigo') || path.includes('rolada')) return 'Índigo'
  return 'Módulo'
}

const filteredResults = computed(() => {
  if (!searchQuery.value) {
    // Show a few default useful routes if empty but open
    return searchableRoutes.value.slice(0, 5)
  }
  
  const query = searchQuery.value.toLowerCase().trim()
  
  return searchableRoutes.value.filter(route => {
    const matchTitle = route.title.toLowerCase().includes(query)
    const matchPath = route.path.toLowerCase().includes(query)
    const matchKeywords = route.keywords.some(kw => kw.toLowerCase().includes(query))
    return matchTitle || matchPath || matchKeywords
  }).slice(0, 10) // Limit to 10 results
})

// Keyboard shortcuts Ctrl+K
const handleGlobalKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    openPalette()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', updateDropdownPos)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', updateDropdownPos)
})

const openPalette = () => {
  isOpen.value = true
  nextTick(() => {
    updateDropdownPos()
    if (searchInput.value) {
      searchInput.value.focus()
    }
  })
}

const closePalette = () => {
  isOpen.value = false
  if (searchInput.value) {
    searchInput.value.blur()
  }
}

const handleBlur = () => {
  // Timeout to allow click on results before closing
  setTimeout(() => {
    isOpen.value = false
  }, 150)
}

const navigateResults = (direction) => {
  if (!isOpen.value) {
    openPalette()
    return
  }
  
  const total = filteredResults.value.length
  if (total === 0) return
  
  selectedIndex.value = (selectedIndex.value + direction + total) % total
}

const selectResult = () => {
  if (!isOpen.value || filteredResults.value.length === 0) return
  const result = filteredResults.value[selectedIndex.value]
  if (result) {
    goToRoute(result.path)
  }
}

const goToRoute = (path) => {
  router.push(path)
  closePalette()
  searchQuery.value = ''
  selectedIndex.value = 0
}

const goBack = () => {
  if (window.history.length > 1) {
    router.back()
  }
}

const goForward = () => {
  router.forward()
}
</script>

<style scoped>
/* Segoe UI font stack for native Windows feel */
.titlebar-font {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
}

/* WCO Standard properties */
.titlebar-container {
  font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  height: env(titlebar-area-height, 52px);
  max-height: env(titlebar-area-height, 52px);
  overflow: hidden;
  padding-left: max(env(titlebar-area-x, 0px), 12px);
  padding-right: max(calc(100vw - env(titlebar-area-width, 100vw) - env(titlebar-area-x, 0px)), 12px);
  width: 100%;
  box-sizing: border-box;
  -webkit-app-region: drag;
}

/* Search input fills most of the titlebar height */
.search-input-height {
  height: calc(env(titlebar-area-height, 52px) - 8px);
  max-height: 40px;
}

/* Elements that must remain clickable */
.search-input,
.nav-buttons,
.dropdown-no-drag {
  -webkit-app-region: no-drag;
}

/* In normal browser mode (not installed PWA), increased height by 30% (44px -> 57px) */
@media (display-mode: browser) {
  .titlebar-container {
    height: 57px;
    max-height: 57px;
    padding-left: 12px;
    padding-right: 12px;
  }
  .search-input-height {
    height: 39px;
    max-height: 39px;
  }
}
</style>
