<template>
  <!-- Rail compacto / barra expandida (en flujo normal) -->
  <aside
    ref="asideRef"
    :class="expanded ? 'w-60' : 'w-12'"
    class="relative z-20 flex-none flex flex-col bg-white border-r border-gray-200 py-2 shadow-sm select-none transition-[width] duration-200 ease-in-out"
  >
    <div class="w-5 h-px bg-gray-200 mb-2 mx-auto flex-none"></div>
    <nav class="sidebar-scroll flex-1 flex flex-col gap-0.5 w-full px-1.5 overflow-y-auto" aria-label="Navegación principal">
      <template v-for="item in groups" :key="item.id || item.sep">
        <div v-if="item.sep" class="w-5 h-px bg-gray-200 my-1 mx-auto flex-none"></div>

        <!-- Modo expandido: sección acordeón -->
        <div v-else-if="expanded" class="w-full">
          <button
            type="button"
            @click="toggleSection(item.id)"
            :aria-expanded="openSection === item.id"
            class="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg transition-colors"
            :class="isGroupActive(item) ? 'text-gray-900' : 'text-gray-500 hover:text-gray-800'"
          >
            <component :is="item.icon" class="w-5 h-5 flex-none" aria-hidden="true" />
            <span class="flex-1 text-left text-[12px] font-semibold tracking-wide uppercase truncate">{{ item.label }}</span>
            <ChevronDownIcon
              class="w-4 h-4 text-gray-400 transition-transform duration-150 flex-none"
              :class="openSection === item.id ? 'rotate-180' : ''"
              aria-hidden="true"
            />
          </button>
          <div v-show="openSection === item.id" class="ml-[26px] border-l border-gray-200 pl-2 py-1 space-y-0.5">
            <router-link
              v-for="link in item.links"
              :key="link.to"
              :to="link.to"
              class="relative block px-2.5 py-1.5 rounded-md text-[13px] transition-colors"
              :class="isLinkActive(link)
                ? 'bg-gray-100 text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
            >
              <span
                v-if="isLinkActive(link)"
                class="absolute -left-2 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-gray-900"
                aria-hidden="true"
              ></span>
              <span class="block truncate">{{ link.label }}</span>
            </router-link>
          </div>
        </div>

        <!-- Modo rail: botón de icono -->
        <button
          v-else
          type="button"
          @click="toggleGroup(item.id, $event)"
          @dblclick="pinAndOpen(item.id)"
          v-tippy="{ content: item.label, placement: 'right', theme: 'light', delay: [120, 0] }"
          :aria-expanded="openGroup === item.id"
          :aria-label="item.label"
          class="relative w-full flex items-center justify-center h-10 rounded-lg transition-colors flex-none"
          :class="isGroupActive(item) || openGroup === item.id
            ? 'bg-gray-100 text-gray-900'
            : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700'"
        >
          <span
            v-if="isGroupActive(item)"
            class="absolute left-0.5 top-1/2 -translate-y-1/2 h-5 w-0.5 rounded-full bg-gray-900"
            aria-hidden="true"
          ></span>
          <component :is="item.icon" class="w-5 h-5" aria-hidden="true" />
        </button>
      </template>
    </nav>

    <!-- Expandir / contraer -->
    <div class="flex-none px-1.5 pt-2 mt-2 border-t border-gray-100">
      <button
        v-if="expanded"
        type="button"
        @click="setExpanded(false)"
        v-tippy="{ content: 'Contraer menú (tecla [)', theme: 'light' }"
        class="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
      >
        <ChevronDoubleLeftIcon class="w-4 h-4 flex-none" aria-hidden="true" />
        <span class="text-[12px] font-medium">Contraer</span>
      </button>
      <button
        v-else
        type="button"
        @click="setExpanded(true)"
        v-tippy="{ content: 'Expandir menú (tecla [)', placement: 'right', theme: 'light' }"
        aria-label="Expandir menú"
        class="w-full flex items-center justify-center h-10 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
      >
        <ChevronDoubleRightIcon class="w-5 h-5" aria-hidden="true" />
      </button>
    </div>
  </aside>

  <!-- Fondo semi-opaco para cerrar el panel -->
  <div
    v-if="openGroup !== null"
    class="fixed inset-0 z-30"
    @click="openGroup = null"
  ></div>

  <!-- Panel deslizable con los enlaces del grupo (modo rail) -->
  <Transition name="slide-panel">
    <aside
      v-if="openGroup !== null && currentGroup"
      key="panel"
      class="fixed left-12 w-60 z-40 flex flex-col bg-white border border-gray-200 rounded-r-xl shadow-2xl font-sans overflow-hidden"
      :style="panelStyle"
    >
      <div class="flex items-center gap-2 px-3 h-11 border-b border-gray-100 flex-none">
        <component :is="currentGroup.icon" class="w-4 h-4 text-gray-500 flex-none" aria-hidden="true" />
        <span class="flex-1 text-[13px] font-semibold text-gray-900 truncate">{{ currentGroup.label }}</span>
        <button
          @click="pinAndOpen(currentGroup.id)"
          v-tippy="{ content: 'Fijar menú expandido', theme: 'light' }"
          class="w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Fijar menú expandido"
        >
          <ChevronDoubleRightIcon class="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          @click="openGroup = null"
          class="w-7 h-7 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Cerrar"
        >
          <XMarkIcon class="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
      <nav class="sidebar-scroll flex-1 overflow-y-auto p-2 space-y-0.5">
        <router-link
          v-for="link in currentGroup.links"
          :key="link.to"
          :to="link.to"
          class="block px-3 py-2 rounded-md text-[13px] transition-colors"
          :class="isLinkActive(link)
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'"
        >
          <span class="block truncate">{{ link.label }}</span>
        </router-link>
      </nav>
    </aside>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import {
  BeakerIcon,
  BuildingOffice2Icon,
  CheckBadgeIcon,
  SwatchIcon,
  Cog6ToothIcon,
  ChevronDownIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  XMarkIcon,
} from '@heroicons/vue/24/outline'

const route = useRoute()

const EXPANDED_KEY = 'stc.sidebar.expanded'
const expanded = ref(readStoredExpanded())
const openGroup = ref(null)
const openSection = ref(null)

const groups = [
  {
    id: 'lab',
    icon: BeakerIcon,
    label: 'Laboratorio Hilandería',
    links: [
      { to: '/resumen', label: 'Resumen Ensayos' },
      { to: '/resumen-cardas', label: 'Resumen Cardas' },
      { to: '/resumen-semanal-hilanderia', label: 'Resumen Semanal' },
      { to: '/analisis-calidad-fibra', label: 'Análisis Calidad Fibra' },
      { to: '/golden-batch', label: 'Golden Batch (OEE)' },
      { to: '/informe-auditoria-lote', label: 'Informe Auditoría Lote' },
      { to: '/resumen-diario', label: 'Resumen Diario' },
      { to: '/stats', label: 'Gráficos' },
      // Benninger moved to INDIGO group
    ],
  },
  {
    id: 'produccion',
    icon: BuildingOffice2Icon,
    label: 'Producción',
    links: [
      { to: '/trazabilidad-causa-raiz', label: 'Trazabilidad Causa Raíz' },
      { to: '/informe-diario', label: 'Informe STC Diario' },
      { to: '/velocidad-maquina', label: 'Velocidad Máquina' },
      { to: '/balance-trazabilidad', label: 'Balance Trazabilidad' },
    ],
  },
  // Inventarios oculto — Materia Prima será mostrada desde otra App
  { sep: 'sep1' },
  {
    id: 'calidad',
    icon: CheckBadgeIcon,
    label: 'Control de Calidad',
    links: [
      { to: '/calibracion-revisores', label: 'Calibración Revisores' },
      { to: '/revision-cq', label: 'Metros por Revisor' },
      { to: '/meta-por-revisor', label: 'Meta por Revisor' },
      { to: '/desempeno-revisores', label: 'Desempeño Revisores' },
      { to: '/analisis-mesa-test', label: 'Mesa de Test' },
      { to: '/calidad-sectores', label: 'Metros por Sector' },
      { to: '/consulta-calidad-partida', label: 'Consulta Partida' },
      { to: '/partida-tejeduria', label: 'Partida en Producción' },
      { to: '/pts-tejeduria', label: 'Pts por Partida' },
      { to: '/defecto-tejeduria', label: 'Defecto → Partidas' },
      { to: '/pontos-por-rolada', label: 'PONTOS por Rolada' },
      { to: '/heatmap-tejeduria', label: 'Mapa Calor Telares' },
      { to: '/caida-telares', label: 'Caída de Telares' },
      { to: '/performance-revisores', label: 'Performance Mensual' },
      { to: '/analisis-eficiencia-calidad', label: 'Eficiencia vs Calidad' },
      { to: '/analisis-patrones-teje', label: 'Análisis Patrones (IA)' },
      { to: '/relato-ia-teje', label: 'Relato IA (Tejeduría)' },
    ],
  },
  {
    id: 'indigo',
    icon: SwatchIcon,
    label: 'ÍNDIGO',
    links: [
      { to: '/residuos-indigo-tejeduria', label: 'Residuos INDIGO y TEJEDURIA' },
      { to: '/analisis-residuos-indigo', label: 'Análisis Residuos Índigo' },
      { to: '/consulta-rolada-indigo', label: 'Consulta ROLADA ÍNDIGO' },
      { to: '/informe-produccion-indigo', label: 'ROLADAS del Mes' },
      { to: '/verificacion-partidas-rolada', label: 'Verificación Partidas Rolada' },
      { to: '/auditoria-rtf-secuencia', label: 'Auditoría RTF Secuencia' },
      { to: '/benninger-rtf', label: 'Benninger RTF' },
      { to: '/benninger-impacto', label: 'Benninger Impacto Hilo' },
      { to: '/seguimiento-roladas', label: 'Seguimiento de Roladas' },
      { to: '/seguimiento-roladas-fibra', label: 'Seguimiento Roladas + Fibra' },
      { to: '/grafico-metricas-diarias', label: 'Gráfico Métricas Diarias' },
    ],
  },
  { sep: 'sep2' },
  {
    id: 'config',
    icon: Cog6ToothIcon,
    label: 'Configuración',
    links: [
      { to: '/import-control', label: 'Importar Datos' },
      { to: '/database-explorer', label: 'Explorador DB' },
    ],
  },
]

const firstGroupId = groups.find(g => !g.sep)?.id ?? null

const currentGroup = computed(() =>
  openGroup.value
    ? (groups.find(g => !g.sep && g.id === openGroup.value) || null)
    : null
)

const activeGroupId = computed(() => {
  const g = groups.find(g => !g.sep && g.links?.some(l => l.to === route?.path))
  return g?.id ?? null
})

function isGroupActive(group) {
  return group.links?.some(l => l.to === route?.path) ?? false
}

function isLinkActive(link) {
  return route?.path === link.to
}

function readStoredExpanded() {
  try {
    return window.localStorage.getItem(EXPANDED_KEY) === '1'
  } catch {
    return false
  }
}

function setExpanded(v) {
  expanded.value = v
  try {
    window.localStorage.setItem(EXPANDED_KEY, v ? '1' : '0')
  } catch {}
  openGroup.value = null
  if (v) openSection.value = activeGroupId.value || firstGroupId
}

function pinAndOpen(id) {
  setExpanded(true)
  openSection.value = id
}

const asideRef = ref(null)
const activeTopOffset = ref(0)
const asideTop = ref(0)
const viewportH = ref(window.innerHeight)

const panelStyle = computed(() => {
  const minTop = asideTop.value + 4
  let top = Math.max(activeTopOffset.value, minTop)
  top = Math.min(top, Math.max(minTop, viewportH.value - 120))
  const maxH = Math.max(160, viewportH.value - top - 12)
  return {
    top: `${top}px`,
    maxHeight: `${maxH}px`,
  }
})

function toggleGroup(id, event) {
  if (openGroup.value === id) {
    openGroup.value = null
    return
  }
  openGroup.value = id
  if (event && asideRef.value) {
    activeTopOffset.value = event.currentTarget.getBoundingClientRect().top
    asideTop.value = asideRef.value.getBoundingClientRect().top
  }
}

function toggleSection(id) {
  openSection.value = openSection.value === id ? null : id
}

watch(() => route?.path, () => {
  openGroup.value = null
  if (expanded.value && activeGroupId.value) {
    openSection.value = activeGroupId.value
  }
})

if (expanded.value) {
  openSection.value = activeGroupId.value || firstGroupId
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    openGroup.value = null
    return
  }
  if (e.key === '[') {
    const t = e.target
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
    setExpanded(!expanded.value)
  }
}

function handleResize() {
  viewportH.value = window.innerHeight
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', handleResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', handleResize)
})
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
