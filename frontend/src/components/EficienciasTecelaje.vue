<template>
  <div class="bg-white rounded-lg shadow-md p-6 mb-6">
    <!-- Header con título -->
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-gray-800 mb-4">📊 Eficiencias de Tecelaje</h2>

      <!-- Resumen de eficiencias -->
      <div v-if="!loadingResumen" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-blue-50 p-4 rounded border-l-4 border-blue-400">
          <p class="text-sm text-gray-600 font-medium">Eficiencia A</p>
          <p class="text-2xl font-bold text-blue-600">{{ resumen.EFIC_TA || '--' }}</p>
        </div>
        <div class="bg-green-50 p-4 rounded border-l-4 border-green-400">
          <p class="text-sm text-gray-600 font-medium">Eficiencia B</p>
          <p class="text-2xl font-bold text-green-600">{{ resumen.EFIC_TB || '--' }}</p>
        </div>
        <div class="bg-purple-50 p-4 rounded border-l-4 border-purple-400">
          <p class="text-sm text-gray-600 font-medium">Eficiencia C</p>
          <p class="text-2xl font-bold text-purple-600">{{ resumen.EFIC_TC || '--' }}</p>
        </div>
        <div class="bg-orange-50 p-4 rounded border-l-4 border-orange-400">
          <p class="text-sm text-gray-600 font-medium">Eficiencia Día</p>
          <p class="text-2xl font-bold text-orange-600">{{ resumen.EFIC_DIA || '--' }}</p>
        </div>
      </div>

      <div v-else class="text-center py-4 text-gray-500">
        <p>Cargando eficiencias...</p>
      </div>
    </div>

    <!-- Selector de Turno (Tabs) -->
    <div class="flex gap-2 mb-6 border-b border-gray-200">
      <button
        v-for="t in ['A', 'B', 'C', 'DIA']"
        :key="t"
        @click="cambiarTurno(t)"
        :class="[
          'px-4 py-3 font-medium rounded-t transition-colors',
          turnoActivo === t
            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
            : 'text-gray-600 hover:text-gray-800'
        ]"
      >
        Turno {{ t }}
      </button>
    </div>

    <!-- Estado de carga -->
    <div v-if="loadingDetalle" class="text-center py-8 text-gray-500">
      <p class="mb-2">Cargando detalles del turno {{ turnoActivo }}...</p>
      <div class="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
    </div>

    <!-- Mensaje de error -->
    <div v-else-if="error" class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
      <p class="font-medium">Error al cargar datos</p>
      <p class="text-sm">{{ error }}</p>
    </div>

    <!-- Tabla de resultados -->
    <div v-else-if="detalle && detalle.data">
      <div class="mb-4 text-gray-600">
        <p class="text-sm">
          Total de piezas en tecelaje: <span class="font-bold text-lg">{{ detalle.total }}</span>
        </p>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr class="bg-gray-100 border-b border-gray-300">
              <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">T</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Artículo</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Color</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Nombre</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Trama</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-gray-700">Efi %</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-gray-700">Metros</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-gray-700">Estado</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-gray-700">Telar</th>
              <th class="px-3 py-2 text-center text-xs font-semibold text-gray-700">Caída (hh:mm)</th>
              <th class="px-3 py-2 text-left text-xs font-semibold text-gray-700">Grupo</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, idx) in detalle.data"
              :key="idx"
              :class="idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'"
              class="border-b border-gray-200 hover:bg-blue-100 transition-colors"
            >
              <td class="px-3 py-2 text-sm text-gray-800 font-medium">{{ row.tipo || '-' }}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{{ row.artigo || '-' }}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{{ row.color || '-' }}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{{ truncate(row.nombre, 20) }}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{{ row.trama || '-' }}</td>
              <td class="px-3 py-2 text-sm text-center font-semibold">
                <span :class="getEficienciaClass(row.eficiencia)">
                  {{ formatNumber(row.eficiencia, 1) }}
                </span>
              </td>
              <td class="px-3 py-2 text-sm text-center text-gray-800">{{ formatNumber(row.metros, 0) }}</td>
              <td class="px-3 py-2 text-sm text-center">
                <span :class="getStatusClass(row.status)">{{ row.status || '-' }}</span>
              </td>
              <td class="px-3 py-2 text-sm text-center font-medium">{{ row.telar || '0' }}</td>
              <td class="px-3 py-2 text-sm text-center font-mono text-gray-700">{{ row.caida }}</td>
              <td class="px-3 py-2 text-sm text-gray-800">{{ row.grupo || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Footer con estadísticas -->
      <div v-if="estadisticas" class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div>
          <p class="text-xs text-gray-600 font-medium">Métros Totales</p>
          <p class="text-lg font-bold text-gray-800">{{ formatNumber(estadisticas.metrosTotales, 0) }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-600 font-medium">Eficiencia Promedio</p>
          <p class="text-lg font-bold text-blue-600">{{ formatNumber(estadisticas.eficienciaPromedio, 1) }}%</p>
        </div>
        <div>
          <p class="text-xs text-gray-600 font-medium">Telar Más Usado</p>
          <p class="text-lg font-bold text-gray-800">{{ estadisticas.telarMasUsado || '-' }}</p>
        </div>
        <div>
          <p class="text-xs text-gray-600 font-medium">Status Más Común</p>
          <p class="text-lg font-bold text-gray-800">{{ estadisticas.statusMasComun || '-' }}</p>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-8 text-gray-500">
      <p>No hay datos disponibles</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  fetchEficienciasResumen,
  fetchEficienciasDetalle
} from '@/services/eficienciasService'

// State
const resumen = ref({
  EFIC_TA: '--',
  EFIC_TB: '--',
  EFIC_TC: '--',
  EFIC_DIA: '--'
})

const detalle = ref(null)
const turnoActivo = ref('DIA')
const loadingResumen = ref(true)
const loadingDetalle = ref(false)
const error = ref(null)

// Helpers
function formatNumber(val, decimals = 0) {
  if (!val && val !== 0) return '--'
  const num = parseFloat(val)
  if (isNaN(num)) return '--'
  return num.toFixed(decimals)
}

function truncate(text, len = 20) {
  if (!text) return '-'
  return text.length > len ? text.substring(0, len) + '...' : text
}

function getEficienciaClass(efic) {
  const val = parseFloat(efic)
  if (isNaN(val)) return 'text-gray-600'
  if (val >= 85) return 'text-green-600 font-bold'
  if (val >= 70) return 'text-orange-600 font-bold'
  return 'text-red-600 font-bold'
}

function getStatusClass(status) {
  if (!status) return 'text-gray-600'
  const upper = status.toUpperCase()
  if (upper.includes('COMPLETO')) return 'px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium'
  if (upper.includes('INICIO')) return 'px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium'
  if (upper.includes('PARADO')) return 'px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium'
  return 'px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs font-medium'
}

// Estadísticas computadas
const estadisticas = computed(() => {
  if (!detalle.value || !detalle.value.data || detalle.value.data.length === 0) {
    return null
  }

  const data = detalle.value.data
  const metrosTotales = data.reduce((sum, row) => sum + (parseFloat(row.metros) || 0), 0)
  const eficienciaPromedio =
    data.reduce((sum, row) => sum + (parseFloat(row.eficiencia) || 0), 0) / data.length
  
  // Telar más usado
  const telaresCount = {}
  data.forEach(row => {
    const telar = row.telar || '0'
    telaresCount[telar] = (telaresCount[telar] || 0) + 1
  })
  const telarMasUsado = Object.entries(telaresCount)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || '-'

  // Status más común
  const statusCount = {}
  data.forEach(row => {
    const st = row.status || 'DESCONOCIDO'
    statusCount[st] = (statusCount[st] || 0) + 1
  })
  const statusMasComun = Object.entries(statusCount)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || '-'

  return {
    metrosTotales,
    eficienciaPromedio,
    telarMasUsado,
    statusMasComun
  }
})

// Métodos
async function cargarResumen() {
  loadingResumen.value = true
  error.value = null
  try {
    const data = await fetchEficienciasResumen()
    resumen.value = data || {
      EFIC_TA: '--',
      EFIC_TB: '--',
      EFIC_TC: '--',
      EFIC_DIA: '--'
    }
  } catch (err) {
    console.error('Error cargando resumen:', err)
    error.value = err.message || 'Error al cargar resumen de eficiencias'
  } finally {
    loadingResumen.value = false
  }
}

async function cargarDetalle(turno) {
  loadingDetalle.value = true
  error.value = null
  try {
    const data = await fetchEficienciasDetalle(turno)
    detalle.value = data
  } catch (err) {
    console.error('Error cargando detalle:', err)
    error.value = err.message || 'Error al cargar detalles del turno'
  } finally {
    loadingDetalle.value = false
  }
}

function cambiarTurno(nuevoTurno) {
  turnoActivo.value = nuevoTurno
  cargarDetalle(nuevoTurno)
}

// Lifecycle
onMounted(() => {
  cargarResumen()
  cargarDetalle(turnoActivo.value)
})
</script>

<style scoped>
table {
  border-collapse: collapse;
}

tbody tr:hover {
  background-color: #f0f4ff !important;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
