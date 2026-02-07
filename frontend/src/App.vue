<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <div class="fixed top-0 left-0 h-full w-12 z-50"
      @mouseenter="startShowTimer"
      @mouseleave="clearShowTimer"
    ></div>
    
    <aside 
      @mouseleave="startHideTimer" 
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
        <!-- Laboratorio Hilandería Group -->
        <div class="space-y-1">
          <button 
            @click="toggleLabMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="{ 'bg-blue-700': isLabRouteActive }"
          >
            <div class="flex items-center gap-2">
              <span>🧪</span>
              <span class="font-medium">Laboratorio Hilandería</span>
            </div>
            <svg 
              class="w-4 h-4 transition-transform duration-200"
              :class="{ 'rotate-180': labMenuOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div 
            v-show="labMenuOpen"
            class="ml-4 space-y-1 border-l-2 border-blue-600 pl-2"
          >
            <router-link 
              to="/resumen" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/resumen' }"
            >
              <span>📑</span> Resumen Ensayos
            </router-link>
            
            <router-link 
              to="/resumen-diario" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/resumen-diario' }"
            >
              <span>📅</span> Resumen Diario
            </router-link>
            
            <router-link 
              to="/stats" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/stats' }"
            >
              <span>📊</span> Gráficos
            </router-link>
            
            <router-link 
              to="/uster" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/uster' }"
            >
              <span>🧩</span> Uster
            </router-link>
            
            <router-link 
              to="/tenso" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/tenso' }"
            >
              <span>🧬</span> TensoRapid
            </router-link>
          </div>
        </div>

        <!-- Producción Group -->
        <div class="space-y-1">
          <button 
            @click="toggleProdMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="{ 'bg-blue-700': isProdRouteActive }"
          >
            <div class="flex items-center gap-2">
              <span>🏭</span>
              <span class="font-medium">Producción</span>
            </div>
            <svg 
              class="w-4 h-4 transition-transform duration-200"
              :class="{ 'rotate-180': prodMenuOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div 
            v-show="prodMenuOpen"
            class="ml-4 space-y-1 border-l-2 border-blue-600 pl-2"
          >
            <router-link 
              to="/import-control" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/import-control' }"
            >
              <span>📥</span> Importar Datos
            </router-link>
          </div>
        </div>

        <!-- Control de Calidad Group -->
        <div class="space-y-1">
          <button 
            @click="toggleCalidadMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="{ 'bg-blue-700': isCalidadRouteActive }"
          >
            <div class="flex items-center gap-2">
              <span>✅</span>
              <span class="font-medium">Control de Calidad</span>
            </div>
            <svg 
              class="w-4 h-4 transition-transform duration-200"
              :class="{ 'rotate-180': calidadMenuOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div 
            v-show="calidadMenuOpen"
            class="ml-4 space-y-1 border-l-2 border-blue-600 pl-2"
          >
            <router-link 
              to="/revision-cq" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/revision-cq' }"
            >
              <span>📋</span> Metros por Revisor
            </router-link>
            <router-link 
              to="/analisis-mesa-test" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/analisis-mesa-test' }"
            >
              <span>🧪</span> Mesa de Test
            </router-link>
            <router-link 
              to="/calidad-sectores" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/calidad-sectores' }"
            >
              <span>📈</span> Metros por Sector
            </router-link>
          </div>
        </div>
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
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const sidebarVisible = ref(false)

// Laboratorio menu state (persisted in localStorage)
const labMenuOpen = ref(localStorage.getItem('labMenuOpen') !== 'false')
const prodMenuOpen = ref(localStorage.getItem('prodMenuOpen') !== 'false')
const calidadMenuOpen = ref(localStorage.getItem('calidadMenuOpen') !== 'false')

const labRoutes = ['/resumen', '/resumen-diario', '/stats', '/uster', '/tenso']
const isLabRouteActive = computed(() => labRoutes.includes(route.path))

const prodRoutes = ['/import-control']
const isProdRouteActive = computed(() => prodRoutes.includes(route.path))

const calidadRoutes = ['/revision-cq']
const isCalidadRouteActive = computed(() => calidadRoutes.includes(route.path))

function toggleLabMenu() {
  labMenuOpen.value = !labMenuOpen.value
  localStorage.setItem('labMenuOpen', labMenuOpen.value.toString())
}

function toggleProdMenu() {
  prodMenuOpen.value = !prodMenuOpen.value
  localStorage.setItem('prodMenuOpen', prodMenuOpen.value.toString())
}

function toggleCalidadMenu() {
  calidadMenuOpen.value = !calidadMenuOpen.value
  localStorage.setItem('calidadMenuOpen', calidadMenuOpen.value.toString())
}

let showTimer = null
let hideTimer = null
let closeTimer = null
let recentClose = false
let mouseDown = false

function clearShowTimer() {
  if (showTimer) {
    clearTimeout(showTimer)
    showTimer = null
  }
}

function startShowTimer() {
  clearShowTimer()
  if (mouseDown || recentClose) return
  showTimer = setTimeout(() => {
    sidebarVisible.value = true
    clearShowTimer()
  }, 250) // small delay to avoid accidental opens
}

function clearHideTimer() {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function startHideTimer() {
  clearHideTimer()
  // give a short delay before hiding so brief mouse leaves don't close immediately
  hideTimer = setTimeout(() => {
    sidebarVisible.value = false
    recentClose = true
    if (closeTimer) clearTimeout(closeTimer)
    closeTimer = setTimeout(() => { recentClose = false; closeTimer = null }, 800)
    clearHideTimer()
  }, 120)
}

onMounted(() => {
  const md = () => (mouseDown = true)
  const mu = () => (mouseDown = false)
  window.addEventListener('mousedown', md)
  window.addEventListener('mouseup', mu)
  // cleanup
  onBeforeUnmount(() => {
    window.removeEventListener('mousedown', md)
    window.removeEventListener('mouseup', mu)
    clearShowTimer()
    clearHideTimer()
    if (closeTimer) clearTimeout(closeTimer)
  })
})
</script>