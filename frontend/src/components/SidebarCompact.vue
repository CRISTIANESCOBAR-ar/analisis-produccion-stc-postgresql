<template>
  <!-- Barra compacta de iconos (en flujo normal) -->
  <aside
    class="relative z-20 flex-none w-12 flex flex-col items-center bg-gray-100 border-r border-gray-200 py-2 shadow-sm select-none overflow-y-auto"
  >
    <div class="w-5 h-px bg-gray-300 mb-2"></div>
    <nav class="flex flex-col items-center gap-1 w-full px-1.5">
      <template v-for="item in groups" :key="item.id || item.sep">
        <div v-if="item.sep" class="w-5 h-px bg-gray-300 my-1"></div>
        <button
          v-else
          @click="toggleGroup(item.id)"
          v-tippy="{ content: item.label, placement: 'right', theme: 'light', delay: [120, 0] }"
          class="group relative w-full flex items-center justify-center h-10 rounded-lg transition-all"
          :class="isGroupActive(item) || openGroup === item.id
            ? 'bg-indigo-100 text-indigo-700'
            : 'text-gray-400 hover:bg-gray-200 hover:text-gray-700'"
        >
          <span class="text-base leading-none select-none">{{ item.icon }}</span>
        </button>
      </template>
    </nav>
  </aside>

  <!-- Fondo semi-opaco para cerrar el panel -->
  <div
    v-if="openGroup !== null"
    class="fixed inset-0 z-30"
    @click="openGroup = null"
  ></div>

  <!-- Panel deslizable con los enlaces del grupo -->
  <Transition name="slide-panel">
    <aside
      v-if="openGroup !== null && currentGroup"
      key="panel"
      class="fixed top-0 left-12 w-56 h-auto max-h-screen bg-gray-100 text-gray-700 z-40 flex flex-col border-r border-gray-200 shadow-xl font-sans overflow-hidden"
    >
      <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-none">
        <div class="flex items-center gap-2">
          <span class="text-base leading-none">{{ currentGroup.icon }}</span>
          <span class="font-semibold text-sm tracking-wide">{{ currentGroup.label }}</span>
        </div>
        <button
          @click="openGroup = null"
          class="w-7 h-7 rounded hover:bg-gray-200 text-gray-500 hover:text-gray-700 flex items-center justify-center transition-colors"
          title="Cerrar"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      <nav class="sidebar-scroll overflow-y-auto px-2 py-2 space-y-1 max-h-[calc(100vh-4rem)]">
        <router-link
          v-for="link in currentGroup.links"
          :key="link.to"
          :to="link.to"
          class="flex items-center gap-2 px-3 py-2 rounded transition-colors text-sm text-gray-600 hover:bg-gray-200 hover:text-gray-700"
          :class="{ 'bg-indigo-100 text-indigo-700': route.path === link.to }"
        >
          <span>{{ link.icon }}</span>
          {{ link.label }}
        </router-link>
      </nav>
    </aside>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const openGroup = ref(null)

const groups = [
  {
    id: 'lab',
    icon: '🧪',
    label: 'Laboratorio Hilandería',
    links: [
      { to: '/resumen', icon: '📑', label: 'Resumen Ensayos' },
      { to: '/resumen-cardas', icon: '🧾', label: 'Resumen Cardas' },
      { to: '/resumen-semanal-hilanderia', icon: '🗓️', label: 'Resumen Semanal' },
      { to: '/analisis-calidad-fibra', icon: '🧬', label: 'Análisis Calidad Fibra' },
      { to: '/golden-batch', icon: '🏆', label: 'Golden Batch (OEE)' },
      { to: '/informe-auditoria-lote', icon: '📋', label: 'Informe Auditoría Lote' },
      { to: '/resumen-diario', icon: '📅', label: 'Resumen Diario' },
      { to: '/stats', icon: '📊', label: 'Gráficos' },
      { to: '/uster', icon: '🧩', label: 'Uster' },
      { to: '/uster-cardas', icon: '🧺', label: 'Uster Cardas' },
      { to: '/tenso', icon: '🧬', label: 'TensoRapid' },
      { to: '/benninger-rtf', icon: '🧾', label: 'Benninger RTF' },
      { to: '/benninger-impacto', icon: '⚙️', label: 'Benninger Impacto Hilo' },
    ],
  },
  {
    id: 'produccion',
    icon: '🏭',
    label: 'Producción',
    links: [
      { to: '/import-control', icon: '📥', label: 'Importar Datos' },
      { to: '/informe-diario', icon: '📊', label: 'Informe STC Diario' },
    ],
  },
  {
    id: 'inventarios',
    icon: '📦',
    label: 'Inventarios',
    links: [
      { to: '/inventario', icon: '🧶', label: 'Materia Prima' },
    ],
  },
  { sep: 'sep1' },
  {
    id: 'calidad',
    icon: '✅',
    label: 'Control de Calidad',
    links: [
      { to: '/revision-cq', icon: '📋', label: 'Metros por Revisor' },
      { to: '/desempeno-revisores', icon: '⚡', label: 'Desempeño Revisores' },
      { to: '/analisis-mesa-test', icon: '🧪', label: 'Mesa de Test' },
      { to: '/calidad-sectores', icon: '📈', label: 'Metros por Sector' },
      { to: '/consulta-calidad-partida', icon: '🔍', label: 'Consulta Partida' },
      { to: '/partida-tejeduria', icon: '🏭', label: 'Partida en Producción' },
      { to: '/pts-tejeduria', icon: '🔢', label: 'Pts por Partida' },
      { to: '/defecto-tejeduria', icon: '🔎', label: 'Defecto → Partidas' },
      { to: '/heatmap-tejeduria', icon: '🔥', label: 'Mapa Calor Telares' },
      { to: '/caida-telares', icon: '📉', label: 'Caída de Telares' },
      { to: '/performance-revisores', icon: '📊', label: 'Performance Mensual' },
      { to: '/analisis-patrones-teje', icon: '🤖', label: 'Análisis Patrones (IA)' },
    ],
  },
  {
    id: 'indigo',
    icon: '💙',
    label: 'ÍNDIGO',
    links: [
      { to: '/residuos-indigo-tejeduria', icon: '♻️', label: 'Residuos INDIGO y TEJEDURIA' },
      { to: '/analisis-residuos-indigo', icon: '📊', label: 'Análisis Residuos Índigo' },
      { to: '/consulta-rolada-indigo', icon: '🔎', label: 'Consulta ROLADA ÍNDIGO' },
      { to: '/informe-produccion-indigo', icon: '📅', label: 'ROLADAS del Mes' },
      { to: '/verificacion-partidas-rolada', icon: '🔬', label: 'Verificación Partidas Rolada' },
      { to: '/auditoria-rtf-secuencia', icon: '🔢', label: 'Auditoría RTF Secuencia' },
      { to: '/seguimiento-roladas', icon: '📈', label: 'Seguimiento de Roladas' },
      { to: '/seguimiento-roladas-fibra', icon: '🧬', label: 'Seguimiento Roladas + Fibra' },
      { to: '/grafico-metricas-diarias', icon: '📉', label: 'Gráfico Métricas Diarias' },
    ],
  },
  { sep: 'sep2' },
  {
    id: 'config',
    icon: '⚙️',
    label: 'Configuración',
    links: [
      { to: '/parametros-hvi', icon: '🎛️', label: 'Parámetros HVI' },
      { to: '/hvi', icon: '🧬', label: 'Carga HVI (Mistura)' },
      { to: '/resumen-hvi-datos', icon: '📊', label: 'Resumen Datos HVI' },
      { to: '/correlacion-mezcla-hilo', icon: '🔬', label: 'Correlación Mezcla → Hilo' },
      { to: '/dashboard-mezcla', icon: '🏭', label: 'Dashboard Mezcla → Hilo' },
      { to: '/relato-ia-integral', icon: '💡', label: 'Relato Integral IA' },
      { to: '/detalle-mistura-lote', icon: '📊', label: 'Detalle MISTURA' },
      { to: '/configuracion-estandares', icon: '⚙️', label: 'Estándares y Mezclas' },
    ],
  },
]

const currentGroup = computed(() =>
  openGroup.value
    ? (groups.find(g => !g.sep && g.id === openGroup.value) || null)
    : null
)

function isGroupActive(group) {
  return group.links?.some(l => l.to === route.path) ?? false
}

function toggleGroup(id) {
  openGroup.value = openGroup.value === id ? null : id
}

watch(() => route.path, () => { openGroup.value = null })

function handleKeydown(e) {
  if (e.key === 'Escape') openGroup.value = null
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.slide-panel-enter-active,
.slide-panel-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-panel-enter-from,
.slide-panel-leave-to {
  transform: translateX(-0.5rem);
  opacity: 0;
}

.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.5) rgba(226, 232, 240, 0.8);
}

.sidebar-scroll::-webkit-scrollbar {
  width: 6px;
}

.sidebar-scroll::-webkit-scrollbar-track {
  background: rgba(226, 232, 240, 0.8);
  border-radius: 8px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 8px;
}

.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.7);
}
</style>