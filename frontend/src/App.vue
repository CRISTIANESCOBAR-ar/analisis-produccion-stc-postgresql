<template>
  <div class="h-screen flex flex-col bg-gray-50">
    <!-- Backdrop -->
    <Transition v-if="!isEmbeddedMode" name="fade">
      <div 
        v-if="sidebarOpen" 
        class="fixed inset-0 bg-black/30 z-40 transition-opacity"
        @click="closeSidebar"
      />
    </Transition>

    <!-- Sidebar Overlay -->
    <aside
      v-if="!isEmbeddedMode"
      :class="[
        'fixed top-0 left-0 h-full w-64 bg-blue-800 text-white z-50 transition-transform duration-300 flex flex-col shadow-2xl',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      ]"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-blue-600">
        <h2 class="text-lg font-bold">STC Produção</h2>
        <button
          @click="closeSidebar"
          class="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-blue-700 transition-colors"
          title="Cerrar menú"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <nav class="sidebar-scroll px-2 py-2 space-y-1 overflow-y-auto flex-1 min-h-0">
        <!-- Laboratorio Hilandería Group -->
        <div class="space-y-1">
          <button 
            @click="toggleLabMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="isLabRouteActive ? 'bg-blue-700' : ''"
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
              to="/resumen-cardas"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/resumen-cardas' }"
            >
              <span>🧾</span> Resumen Cardas
            </router-link>

            <router-link
              to="/resumen-semanal-hilanderia"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/resumen-semanal-hilanderia' }"
            >
              <span>🗓️</span> Resumen Semanal
            </router-link>

            <router-link
              to="/analisis-calidad-fibra"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/analisis-calidad-fibra' }"
            >
              <span>🧬</span> Análisis Calidad Fibra
            </router-link>

            <router-link
              to="/golden-batch"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/golden-batch' }"
            >
              <span>🏆</span> Golden Batch (OEE)
            </router-link>

            <router-link
              to="/informe-auditoria-lote"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/informe-auditoria-lote' }"
            >
              <span>📋</span> Informe Auditoría Lote
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
              to="/uster-cardas"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/uster-cardas' }"
            >
              <span>🧺</span> Uster Cardas
            </router-link>
            
            <router-link 
              to="/tenso" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/tenso' }"
            >
              <span>🧬</span> TensoRapid
            </router-link>

            <router-link
              to="/benninger-rtf"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/benninger-rtf' }"
            >
              <span>🧾</span> Benninger RTF
            </router-link>

            <router-link
              to="/benninger-impacto"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/benninger-impacto' }"
            >
              <span>⚙️</span> Benninger Impacto Hilo
            </router-link>
          </div>
        </div>

        <!-- Producción Group -->
        <div class="space-y-1">
          <button 
            @click="toggleProdMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="isProdRouteActive ? 'bg-blue-700' : ''"
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
            <router-link 
              to="/informe-diario" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/informe-diario' }"
            >
              <span>📊</span> Informe STC Diario
            </router-link>
          </div>
        </div>

        <!-- Inventario Group -->
        <div class="space-y-1">
          <button 
            @click="toggleInventoryMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="isInventoryRouteActive ? 'bg-blue-700' : ''"
          >
            <div class="flex items-center gap-2">
              <span>📦</span>
              <span class="font-medium">Inventarios</span>
            </div>
            <svg 
              class="w-4 h-4 transition-transform duration-200"
              :class="{ 'rotate-180': inventoryMenuOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div 
            v-show="inventoryMenuOpen"
            class="ml-4 space-y-1 border-l-2 border-blue-600 pl-2"
          >
            <router-link 
              to="/inventario" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/inventario' }"
            >
              <span>🧶</span> Materia Prima
            </router-link>
          </div>
        </div>

        <!-- Control de Calidad Group -->
        <div class="space-y-1">
          <button 
            @click="toggleCalidadMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="isCalidadRouteActive ? 'bg-blue-700' : ''"
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
              to="/desempeno-revisores" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/desempeno-revisores' }"
            >
              <span>⚡</span> Desempeño Revisores
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
            <router-link 
              to="/consulta-calidad-partida" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/consulta-calidad-partida' }"
            >
              <span>🔍</span> Consulta Partida
            </router-link>
            <router-link 
              to="/partida-tejeduria" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/partida-tejeduria' }"
            >
              <span>🏭</span> Partida en Producción
            </router-link>
            <router-link
              to="/caida-telares"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/caida-telares' }"
            >
              <span>📉</span> Caida de Telares
            </router-link>
          </div>
        </div>

        <!-- INDIGO Group -->
        <div class="space-y-1">
          <button 
            @click="toggleIndigoMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="isIndigoRouteActive ? 'bg-blue-700' : ''"
          >
            <div class="flex items-center gap-2">
              <span>💙</span>
              <span class="font-medium">ÍNDIGO</span>
            </div>
            <svg 
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
            v-show="indigoMenuOpen"
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
              to="/verificacion-partidas-rolada"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/verificacion-partidas-rolada' }"
            >
              <span>🔬</span> Verificación Partidas Rolada
            </router-link>
            <router-link
              to="/auditoria-rtf-secuencia"
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              :class="{ 'bg-blue-600': $route.path === '/auditoria-rtf-secuencia' }"
            >
              <span>🔢</span> Auditoría RTF Secuencia
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

        <!-- Configuración Group -->
        <div class="space-y-1">
          <button 
            @click="toggleConfigMenu"
            class="w-full flex items-center justify-between px-3 py-2 rounded hover:bg-blue-700 transition-colors"
            :class="isConfigRouteActive ? 'bg-blue-700' : ''"
          >
            <div class="flex items-center gap-2">
              <span>⚙️</span>
              <span class="font-medium">Configuración</span>
            </div>
            <svg 
              class="w-4 h-4 transition-transform duration-200"
              :class="{ 'rotate-180': configMenuOpen }"
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          <div 
            v-show="configMenuOpen"
            class="ml-4 space-y-1 border-l-2 border-blue-600 pl-2"
          >
            <router-link 
              to="/parametros-hvi" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/parametros-hvi' }"
            >
              <span>🎛️</span> Parámetros HVI
            </router-link>
            <router-link 
              to="/hvi" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/hvi' }"
            >
              <span>🧬</span> Carga HVI (Mistura)
            </router-link>
            <router-link 
              to="/resumen-hvi-datos" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/resumen-hvi-datos' }"
            >
              <span>📊</span> Resumen Datos HVI
            </router-link>
            <router-link 
              to="/correlacion-mezcla-hilo" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/correlacion-mezcla-hilo' }"
            >
              <span>🔬</span> Correlación Mezcla → Hilo
            </router-link>
            <router-link 
              to="/dashboard-mezcla" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/dashboard-mezcla' }"
            >
              <span>🏭</span> Dashboard Mezcla → Hilo
            </router-link>
            <router-link 
              to="/detalle-mistura-lote" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/detalle-mistura-lote' }"
            >
              <span>📊</span> Detalle MISTURA
            </router-link>
            <router-link 
              to="/configuracion-estandares" 
              class="flex items-center gap-2 px-3 py-2 rounded hover:bg-blue-700 transition-colors text-sm" 
              :class="{ 'bg-blue-600': $route.path === '/configuracion-estandares' }"
            >
              <span>⚙️</span> Estándares y Mezclas
            </router-link>
          </div>
        </div>
      </nav>
    </aside>

    <!-- Floating Toggle Button -->
    <button
      v-if="!isEmbeddedMode && !sidebarOpen"
      @click="openSidebar"
      class="fixed top-3 left-3 z-30 bg-transparent text-white p-2 rounded-lg shadow-lg hover:bg-blue-800 transition-all duration-200 hover:shadow-xl active:scale-95"
      v-tippy="{ content: 'Abrir menú de navegación', placement: 'bottom' }"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>

    <main 
      class="main-scroll flex-1 overflow-auto"
    >
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const sidebarOpen = ref(false)
const isEmbeddedMode = computed(() => String(route.query.embed || '') === '1')

// Menu group states (persisted in localStorage)
const labMenuOpen = ref(localStorage.getItem('labMenuOpen') !== 'false')
const prodMenuOpen = ref(localStorage.getItem('prodMenuOpen') !== 'false')
const calidadMenuOpen = ref(localStorage.getItem('calidadMenuOpen') !== 'false')
const indigoMenuOpen = ref(localStorage.getItem('indigoMenuOpen') !== 'false')
const configMenuOpen = ref(localStorage.getItem('configMenuOpen') !== 'false')
const inventoryMenuOpen = ref(localStorage.getItem('inventoryMenuOpen') !== 'false')

const labRoutes = ['/resumen', '/resumen-cardas', '/resumen-semanal-hilanderia', '/analisis-calidad-fibra', '/golden-batch', '/informe-auditoria-lote', '/resumen-diario', '/stats', '/uster', '/uster-cardas', '/tenso', '/benninger-rtf', '/benninger-impacto']
const isLabRouteActive = computed(() => labRoutes.includes(route.path))

const prodRoutes = ['/import-control', '/informe-diario']
const isProdRouteActive = computed(() => prodRoutes.includes(route.path))

const inventoryRoutes = ['/inventario']
const isInventoryRouteActive = computed(() => inventoryRoutes.includes(route.path))

const calidadRoutes = ['/revision-cq', '/desempeno-revisores', '/analisis-mesa-test', '/calidad-sectores', '/partida-tejeduria', '/caida-telares']
const isCalidadRouteActive = computed(() => calidadRoutes.includes(route.path))

const indigoRoutes = [
  '/residuos-indigo-tejeduria',
  '/analisis-residuos-indigo',
  '/consulta-rolada-indigo',
  '/informe-produccion-indigo',
  '/verificacion-partidas-rolada',
  '/auditoria-rtf-secuencia',
  '/seguimiento-roladas',
  '/seguimiento-roladas-fibra',
  '/grafico-metricas-diarias'
]
  const isIndigoRouteActive = computed(() => indigoRoutes.includes(route.path)) 
  
  const configRoutes = ['/parametros-hvi', '/detalle-mistura-lote', '/configuracion-estandares', '/correlacion-mezcla-hilo', '/dashboard-mezcla']
  const isConfigRouteActive = computed(() => configRoutes.includes(route.path))

  function openSidebar() {
    sidebarOpen.value = true
  }

  function closeSidebar() {
    sidebarOpen.value = false
  }

  // Close sidebar on route change (user navigated)
watch(() => route.path, () => {
  closeSidebar()
})

// Close sidebar on Escape key
function handleKeydown(e) {
  if (e.key === 'Escape' && sidebarOpen.value) {
    closeSidebar()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})

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

function toggleIndigoMenu() {
  indigoMenuOpen.value = !indigoMenuOpen.value
  localStorage.setItem('indigoMenuOpen', indigoMenuOpen.value.toString())
}

function toggleInventoryMenu() {
  inventoryMenuOpen.value = !inventoryMenuOpen.value
  localStorage.setItem('inventoryMenuOpen', inventoryMenuOpen.value.toString())
}

function toggleConfigMenu() {
  configMenuOpen.value = !configMenuOpen.value
  localStorage.setItem('configMenuOpen', configMenuOpen.value.toString())
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

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