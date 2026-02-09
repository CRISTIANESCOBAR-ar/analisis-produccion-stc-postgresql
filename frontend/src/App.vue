<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <aside 
      :class="[
        'fixed top-0 left-0 h-full bg-blue-800 text-white z-[9999] transition-all duration-300 flex flex-col',
        sidebarExpanded ? 'w-64' : 'w-16',
        sidebarVisible ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      ]"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-blue-600">
        <div class="flex items-center gap-2">
          <h2 v-show="sidebarExpanded" class="text-lg font-bold">STC Produção</h2>
          <span v-show="!sidebarExpanded" class="text-lg font-bold">STC</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="toggleSidebarExpanded"
            class="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded hover:bg-blue-700 transition-colors"
            :title="sidebarExpanded ? 'Colapsar menu' : 'Expandir menu'"
          >
            <span class="text-base">{{ sidebarExpanded ? '<' : '>' }}</span>
          </button>
          <button @click="sidebarVisible = false" class="lg:hidden">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      
      <nav class="sidebar-scroll px-2 py-2 space-y-1 overflow-y-auto flex-1 min-h-0">
        <!-- Laboratorio Hilandería Group -->
        <div class="space-y-1">
          <button 
            @click="toggleLabMenu"
            class="w-full flex items-center rounded hover:bg-blue-700 transition-colors"
            :class="[
              isLabRouteActive ? 'bg-blue-700' : '',
              sidebarExpanded ? 'justify-between px-3 py-2' : 'justify-center px-2 py-2'
            ]"
            :title="sidebarExpanded ? '' : 'Laboratorio Hilanderia'"
          >
            <div class="flex items-center gap-2">
              <span>🧪</span>
              <span v-show="sidebarExpanded" class="font-medium">Laboratorio Hilandería</span>
            </div>
            <svg 
              v-show="sidebarExpanded"
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
            v-show="sidebarExpanded && labMenuOpen"
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
            class="w-full flex items-center rounded hover:bg-blue-700 transition-colors"
            :class="[
              isProdRouteActive ? 'bg-blue-700' : '',
              sidebarExpanded ? 'justify-between px-3 py-2' : 'justify-center px-2 py-2'
            ]"
            :title="sidebarExpanded ? '' : 'Produccion'"
          >
            <div class="flex items-center gap-2">
              <span>🏭</span>
              <span v-show="sidebarExpanded" class="font-medium">Producción</span>
            </div>
            <svg 
              v-show="sidebarExpanded"
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
            v-show="sidebarExpanded && prodMenuOpen"
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
            class="w-full flex items-center rounded hover:bg-blue-700 transition-colors"
            :class="[
              isCalidadRouteActive ? 'bg-blue-700' : '',
              sidebarExpanded ? 'justify-between px-3 py-2' : 'justify-center px-2 py-2'
            ]"
            :title="sidebarExpanded ? '' : 'Control de Calidad'"
          >
            <div class="flex items-center gap-2">
              <span>✅</span>
              <span v-show="sidebarExpanded" class="font-medium">Control de Calidad</span>
            </div>
            <svg 
              v-show="sidebarExpanded"
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
            v-show="sidebarExpanded && calidadMenuOpen"
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

        <!-- INDIGO Group -->
        <div class="space-y-1">
          <button 
            @click="toggleIndigoMenu"
            class="w-full flex items-center rounded hover:bg-blue-700 transition-colors"
            :class="[
              isIndigoRouteActive ? 'bg-blue-700' : '',
              sidebarExpanded ? 'justify-between px-3 py-2' : 'justify-center px-2 py-2'
            ]"
            :title="sidebarExpanded ? '' : 'Indigo'"
          >
            <div class="flex items-center gap-2">
              <span>💙</span>
              <span v-show="sidebarExpanded" class="font-medium">ÍNDIGO</span>
            </div>
            <svg 
              v-show="sidebarExpanded"
              class="w-4 h-4 transition-transform duration-200"
              :class="{ 'rotate-180': indigoMenuOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div 
            v-show="sidebarExpanded && indigoMenuOpen"
            class="ml-4 space-y-1 border-l-2 border-blue-600 pl-2"
          >
            <router-link 
              to="/residuos-indigo-tejeduria" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/residuos-indigo-tejeduria' }"
            >
              <span>♻️</span> Residuos INDIGO y TEJEDURIA
            </router-link>
            <router-link 
              to="/analisis-residuos-indigo" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/analisis-residuos-indigo' }"
            >
              <span>📊</span> Análisis Residuos de Índigo
            </router-link>
            <router-link 
              to="/consulta-rolada-indigo" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/consulta-rolada-indigo' }"
            >
              <span>🔎</span> Consulta ROLADA ÍNDIGO
            </router-link>
            <router-link 
              to="/informe-produccion-indigo" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/informe-produccion-indigo' }"
            >
              <span>📅</span> ROLADAS del Mes
            </router-link>
            <router-link 
              to="/seguimiento-roladas" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/seguimiento-roladas' }"
            >
              <span>📈</span> Seguimiento de Roladas
            </router-link>
            <router-link 
              to="/seguimiento-roladas-fibra" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/seguimiento-roladas-fibra' }"
            >
              <span>🧬</span> Seguimiento Roladas + Fibra HVI
            </router-link>
            <router-link 
              to="/grafico-metricas-diarias" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/grafico-metricas-diarias' }"
            >
              <span>📉</span> Gráfico de Métricas Diarias
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

    <main 
      @click="sidebarVisible = false" 
      class="main-scroll flex-1 overflow-auto transition-all duration-300"
      :class="sidebarExpanded ? 'lg:pl-64' : 'lg:pl-16'"
    >
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const sidebarVisible = ref(false)
const sidebarExpanded = ref(localStorage.getItem('sidebarExpanded') === 'true')

// Laboratorio menu state (persisted in localStorage)
const labMenuOpen = ref(localStorage.getItem('labMenuOpen') !== 'false')
const prodMenuOpen = ref(localStorage.getItem('prodMenuOpen') !== 'false')
const calidadMenuOpen = ref(localStorage.getItem('calidadMenuOpen') !== 'false')
const indigoMenuOpen = ref(localStorage.getItem('indigoMenuOpen') !== 'false')

const labRoutes = ['/resumen', '/resumen-diario', '/stats', '/uster', '/tenso']
const isLabRouteActive = computed(() => labRoutes.includes(route.path))

const prodRoutes = ['/import-control']
const isProdRouteActive = computed(() => prodRoutes.includes(route.path))

const calidadRoutes = ['/revision-cq', '/analisis-mesa-test', '/calidad-sectores']
const isCalidadRouteActive = computed(() => calidadRoutes.includes(route.path))

const indigoRoutes = [
  '/residuos-indigo-tejeduria',
  '/analisis-residuos-indigo',
  '/consulta-rolada-indigo',
  '/informe-produccion-indigo',
  '/seguimiento-roladas',
  '/seguimiento-roladas-fibra',
  '/grafico-metricas-diarias'
]
const isIndigoRouteActive = computed(() => indigoRoutes.includes(route.path))

function setSidebarExpanded(value) {
  sidebarExpanded.value = value
  localStorage.setItem('sidebarExpanded', value.toString())
}

function toggleSidebarExpanded() {
  setSidebarExpanded(!sidebarExpanded.value)
}

function ensureSidebarExpanded() {
  if (!sidebarExpanded.value) {
    setSidebarExpanded(true)
  }
}

function toggleLabMenu() {
  ensureSidebarExpanded()
  labMenuOpen.value = !labMenuOpen.value
  localStorage.setItem('labMenuOpen', labMenuOpen.value.toString())
}

function toggleProdMenu() {
  ensureSidebarExpanded()
  prodMenuOpen.value = !prodMenuOpen.value
  localStorage.setItem('prodMenuOpen', prodMenuOpen.value.toString())
}

function toggleCalidadMenu() {
  ensureSidebarExpanded()
  calidadMenuOpen.value = !calidadMenuOpen.value
  localStorage.setItem('calidadMenuOpen', calidadMenuOpen.value.toString())
}

function toggleIndigoMenu() {
  ensureSidebarExpanded()
  indigoMenuOpen.value = !indigoMenuOpen.value
  localStorage.setItem('indigoMenuOpen', indigoMenuOpen.value.toString())
}
</script>

<style scoped>
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.45) rgba(15, 23, 42, 0.25);
}

:deep(.sidebar-scroll::-webkit-scrollbar) {
  width: 8px;
}

:deep(.sidebar-scroll::-webkit-scrollbar-track) {
  background: rgba(15, 23, 42, 0.25);
  border-radius: 8px;
}

:deep(.sidebar-scroll::-webkit-scrollbar-thumb) {
  background: rgba(255, 255, 255, 0.45);
  border-radius: 8px;
  border: 2px solid transparent;
  background-clip: content-box;
}

:deep(.sidebar-scroll::-webkit-scrollbar-thumb:hover) {
  background: rgba(255, 255, 255, 0.65);
}

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