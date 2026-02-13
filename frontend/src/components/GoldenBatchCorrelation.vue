<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <div class="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">Motor de Correlación "Golden Batch"</h1>
        <div class="text-sm text-gray-500">
          Eficiencia Ajustada (OEE) = Producción / (Tiempo Total - Paradas Exógenas)
        </div>
      </div>
      
      <!-- Date Filters -->
      <div class="flex items-center space-x-4 bg-white p-2 rounded shadow-sm border">
        <div class="flex flex-col">
          <label class="text-xs text-gray-500 font-bold ml-1 mb-1">Desde</label>
          <CustomDatepicker 
            v-model="startDate" 
            :showButtons="false"
            placeholder="dd/mm/aaaa"
          />
        </div>
        <div class="text-gray-400 mt-4">→</div>
        <div class="flex flex-col">
          <label class="text-xs text-gray-500 font-bold ml-1 mb-1">Hasta</label>
          <CustomDatepicker 
            v-model="endDate" 
            :showButtons="false"
            placeholder="dd/mm/aaaa"
            :alignRight="true"
          />
        </div>
        <button 
          @click="resetFilters"
          class="ml-2 mt-4 text-xs text-indigo-600 hover:text-indigo-800 underline"
        >
          Limpiar
        </button>
      </div>
    </div>

    <!-- Banner de Carga / Error -->
    <div v-if="loading" class="bg-indigo-50 border border-indigo-200 rounded-lg p-5 mb-8 flex items-center gap-4 shadow-sm">
      <div class="animate-spin rounded-full h-8 w-8 border-3 border-indigo-200 border-t-indigo-600 shrink-0"></div>
      <div>
        <div class="font-semibold text-indigo-800 text-base">Calculando correlaciones Golden Batch...</div>
        <div class="text-sm text-indigo-600 mt-0.5">
          {{ loadingMessage }}
        </div>
      </div>
    </div>

    <div v-if="errorMsg && !loading" class="bg-red-50 border border-red-200 rounded-lg p-5 mb-8 flex items-center gap-4 shadow-sm">
      <span class="text-2xl">&#9888;</span>
      <div class="flex-1">
        <div class="font-semibold text-red-800">Error cargando datos</div>
        <div class="text-sm text-red-600 mt-0.5">{{ errorMsg }}</div>
      </div>
      <button @click="retry" class="px-4 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-colors">Reintentar</button>
    </div>

    <!-- Summary Cards (Calculated from Filtered Data) -->
    <div v-if="filteredSummary.length" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div 
        v-for="item in filteredSummary" 
        :key="item.estado"
        :class="[
          'p-5 rounded-lg shadow border-l-4 transition-transform duration-150 cursor-pointer hover:scale-102 hover:shadow-md',
          item.estado.includes('EXITO') ? 'bg-green-50 border-green-500' : 
          item.estado.includes('BAJA') ? 'bg-red-50 border-red-500' : 'bg-white border-blue-500'
        ]"
        @click="openModal(item.estado)"
      >
        <h3 class="font-bold text-lg mb-2">{{ item.estado }}</h3>
        <div class="text-3xl font-extrabold mb-4">{{ item.volumen }} <span class="text-sm font-normal text-gray-500">lotes</span></div>
        
        <div class="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div class="text-gray-500">SCI Avg</div>
            <div class="font-semibold">{{ item.sci }}</div>
          </div>
          <div>
            <div class="text-gray-500">Resistencia</div>
            <div class="font-semibold">{{ item.str }} g/tex</div>
          </div>
          <div>
            <div class="text-gray-500">Micronaire</div>
            <div class="font-semibold">{{ item.mic }}</div>
          </div>
          <div>
            <div class="text-gray-500">Rot. Urdimbre</div>
            <div class="font-semibold">{{ item.rot_urd }}</div>
          </div>
        </div>
      </div>
    </div>



    <!-- Analysis Text (Dynamic) -->
    <div v-if="analysis" class="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8 rounded shadow-sm">
      <h3 class="text-blue-800 font-bold text-lg mb-2">Conclusiones del Análisis ({{ analysis.periodo }})</h3>
      
      <!-- Falsos Negativos (Simulado / Placeholder si no hay datos originales) -->
      <div class="mb-4 hidden"> <!-- Oculto temporalmente hasta tener Eficiencia Original -->
        <h4 class="font-bold text-blue-700">Rescate de "Falsos Negativos"</h4>
        <ul class="list-disc ml-6 text-gray-700 mt-1 space-y-1">
          <li><strong>XX lotes</strong> salieron de la zona roja (<span class="text-red-500 font-bold">"Baja"</span>) al descontar tiempos muertos exógenos.</li>
        </ul>
      </div>

      <div class="mb-4">
        <h4 class="font-bold text-blue-700">Validación de la Hipótesis del "Golden Batch"</h4>
        <p class="text-gray-700 mt-1">En el periodo seleccionado, observamos la siguiente correlación:</p>
        <ul class="list-disc ml-6 text-gray-700 mt-1 space-y-1">
          <li>
            Los lotes de <strong class="text-green-700">Éxito</strong> mantienen un <strong>SCI promedio de {{ analysis.exito.sci }}</strong> 
            y Roturas de <strong>{{ analysis.exito.rot }}</strong> ({{ analysis.exito.rotEval }}).
          </li>
          <li>
            Los lotes de <strong class="text-red-700">Baja eficiencia</strong> presentan un SCI inferior (~{{ analysis.baja.sci }}) 
            y Roturas más altas ({{ analysis.baja.rot }}).
          </li>
        </ul>
      </div>

      <div>
        <h4 class="font-bold text-blue-700">💡 Dato Clave para Compras</h4>
        <p class="text-gray-700 mt-1">
           Con un promedio de SCI de <strong>{{ analysis.exito.sci }}</strong> en los lotes exitosos, 
           {{ analysis.comprasConclusion }}
        </p>
      </div>
    </div>

    <!-- Charts Area -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Chart 1: SCI vs Efficiency -->
      <div class="bg-white p-4 rounded-lg shadow">
        <h3 class="font-bold text-gray-700 mb-4">Correlación SCI vs Eficiencia</h3>
        <div class="h-80 relative">
          <Scatter v-if="chartDataSCI" :data="chartDataSCI" :options="chartOptions" />
        </div>
      </div>
      
      <!-- Chart 2: Strength vs Efficiency -->
      <div class="bg-white p-4 rounded-lg shadow">
        <h3 class="font-bold text-gray-700 mb-4">Correlación Resistencia vs Eficiencia</h3>
        <div class="h-80 relative">
          <Scatter v-if="chartDataSTR" :data="chartDataSTR" :options="chartOptions" />
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <!-- ... existing table ... -->
      <div class="px-6 py-4 border-b">
         <h3 class="font-bold text-gray-700">Detalle de Lotes (Top 100 Recientes)</h3>
      </div>
      <!-- Reduced table placeholder for brevity if needed or keep existing -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
           <!-- ... existing entries ... -->
           <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Fecha</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Turno</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Artículo</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Lote Fibra</th>
              <th class="px-4 py-3 text-gray-500 uppercase">Mistura</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">Efic. Tejido</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">SCI</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">STR</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">MIC</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">Rot Urd</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(row, idx) in filteredPoints.slice(0, 50)" :key="idx" class="hover:bg-gray-50">
              <td class="px-4 py-2 text-gray-900 whitespace-nowrap">{{ formatDate(row.DATA) }}</td>
              <td class="px-4 py-2 text-gray-600">{{ row.TURNO }}</td>
              <td class="px-4 py-2 text-gray-600 text-xs">{{ row.ARTICULO }}</td>
              <td class="px-4 py-2 text-gray-600 font-mono text-xs">{{ row.LOTE_FIBRA_TEXT }}</td>
              <td class="px-4 py-2 text-gray-600 text-xs">{{ row.MISTURA }}</td>
              <td class="px-4 py-2 text-right font-bold w-24" :class="getEffClass(row.EFIC_TEJ)">
                {{ row.EFIC_TEJ }}%
              </td>
              <td class="px-4 py-2 text-right text-gray-600">{{ row.SCI }}</td>
              <td class="px-4 py-2 text-right text-gray-600">{{ row.STR }}</td>
              <td class="px-4 py-2 text-right text-gray-600">{{ row.MIC }}</td>
              <td class="px-4 py-2 text-right text-gray-600">{{ row.RU_105 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Modal Detalle por Categoría -->
    <Teleport to="body">
      <div v-if="isModalOpen" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" @click.self="closeModal">
        <div class="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between px-6 py-3 border-b border-slate-200 shrink-0">
            <div class="flex items-center gap-3">
              <h3 class="text-lg font-bold text-slate-800">Detalle de Lotes</h3>
              <span :class="[
                'px-3 py-1 rounded-full text-sm font-bold',
                modalCategory.includes('EXITO') ? 'bg-green-100 text-green-800' :
                modalCategory.includes('BAJA') ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
              ]">{{ modalCategory }}</span>
              <span class="text-sm text-slate-500">{{ modalData.length }} lotes</span>
            </div>
            <button @click="closeModal" class="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" title="Cerrar">
              <svg class="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <!-- Table -->
          <div class="flex-1 overflow-auto min-h-0">
            <table class="min-w-full text-xs border-collapse">
              <thead class="bg-slate-50 sticky top-0 z-10">
                <tr class="text-slate-500 text-[10px] uppercase tracking-wider">
                  <th colspan="3" class="px-2 py-1.5 text-center font-semibold border-b-2 border-r-2 border-slate-300 bg-slate-100">Urdidora</th>
                  <th colspan="7" class="px-2 py-1.5 text-center font-semibold border-b-2 border-r-2 border-slate-300 bg-blue-50">Índigo</th>
                  <th colspan="3" class="px-2 py-1.5 text-center font-semibold border-b-2 border-r-2 border-slate-300 bg-emerald-50">Tejeduría</th>
                  <th class="px-2 py-1.5 text-center font-semibold border-b-2 border-r-2 border-slate-300 bg-amber-50">Mistura</th>
                  <th colspan="3" class="px-2 py-1.5 text-center font-semibold border-b-2 border-slate-300 bg-purple-50">HVI</th>
                </tr>
                <tr class="text-slate-600 text-[10px] bg-slate-50">
                  <!-- Urdidora -->
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Rolada</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Lote</th>
                  <th class="px-2 py-1.5 text-center border-b border-r-2 border-slate-300 font-medium">Rot 10⁶</th>
                  <!-- Índigo -->
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Fecha</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Base</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Color</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">R10³</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Cav 10⁵</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Vel.Nom</th>
                  <th class="px-2 py-1.5 text-center border-b border-r-2 border-slate-300 font-medium">Vel.Prom</th>
                  <!-- Tejeduría -->
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Efic.%</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">RU10⁵</th>
                  <th class="px-2 py-1.5 text-center border-b border-r-2 border-slate-300 font-medium">RT10⁵</th>
                  <!-- Mistura -->
                  <th class="px-2 py-1.5 text-center border-b border-r-2 border-slate-300 font-medium">Mezcla</th>
                  <!-- HVI -->
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">SCI Avg</th>
                  <th class="px-2 py-1.5 text-center border-b border-r border-slate-200 font-medium">Micronaire</th>
                  <th class="px-2 py-1.5 text-center border-b border-slate-200 font-medium">Resistencia</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(row, idx) in modalData" :key="idx" class="hover:bg-slate-50 transition-colors">
                  <!-- Urdidora -->
                  <td class="px-2 py-1.5 text-center font-semibold text-slate-800 border-r border-slate-200">{{ row.ROLADA }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 font-mono border-r border-slate-200">{{ row.LOTE_FIBRA_TEXT }}</td>
                  <td class="px-2 py-1.5 text-center text-emerald-600 font-semibold border-r-2 border-slate-300">{{ formatNum(row.ROT_URD_URDI, 2) }}</td>
                  <!-- Índigo -->
                  <td class="px-2 py-1.5 text-center text-slate-500 text-xs border-r border-slate-200">{{ formatDate(row.INDIGO_FECHA) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200 text-xs">{{ (row.INDIGO_BASE || '-').substring(0, 10) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{{ row.INDIGO_COLOR || '-' }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{{ formatNum(row.INDIGO_R, 2) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{{ formatNum(row.INDIGO_CAVALOS, 1) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{{ formatNum(row.INDIGO_VEL_NOM, 0) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r-2 border-slate-300">{{ formatNum(row.INDIGO_VEL_REAL, 0) }}</td>
                  <!-- Tejeduría -->
                  <td class="px-2 py-1.5 text-center font-bold" :class="getEffClass(row.EFIC_TEJ)">{{ formatNum(row.EFIC_TEJ, 2) }}%</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{{ formatNum(row.RU_105, 2) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r-2 border-slate-300">{{ formatNum(row.RT_105, 2) }}</td>
                  <!-- Mistura -->
                  <td class="px-2 py-1.5 text-center text-slate-700 font-medium border-r-2 border-slate-300">{{ row.MISTURA || '-' }}</td>
                  <!-- HVI -->
                  <td class="px-2 py-1.5 text-center text-purple-700 font-semibold border-r border-slate-200">{{ formatNum(row.SCI, 1) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600 border-r border-slate-200">{{ formatNum(row.MIC, 2) }}</td>
                  <td class="px-2 py-1.5 text-center text-slate-600">{{ formatNum(row.STR, 2) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Footer -->
          <div class="px-6 py-2 border-t border-slate-200 bg-slate-50 text-xs text-slate-500 shrink-0 flex justify-between">
            <span>Rot 10⁶ = (Rupturas × 10⁶) / (Metros × NumFios) · R10³ = (Rupturas × 10³) / Metros · Cav 10⁵ = (Cavalos × 10⁵) / Metros</span>
            <button @click="closeModal" class="px-4 py-1 bg-slate-600 text-white rounded text-xs font-medium hover:bg-slate-700 transition-colors">Cerrar</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>



<script setup>
import { ref, onMounted, computed } from 'vue'
import CustomDatepicker from './CustomDatepicker.vue'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Scatter } from 'vue-chartjs'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)

// State
const summary = ref([]) // From Backend (optional now)
const points = ref([])  // Raw Data
const loading = ref(true)
const errorMsg = ref('')

// Filters
const startDate = ref('')
const endDate = ref('')
const loadingMessage = ref('Conectando con la base de datos...')

// Modal state
const isModalOpen = ref(false)
const modalCategory = ref('')
const modalData = ref([])


onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  loadingMessage.value = 'Conectando con la base de datos...'
  try {
    loadingMessage.value = 'Consultando vista Golden Batch (OEE)... esto puede tomar unos segundos'
    await fetchPoints()
    
    // Inicializar fechas con el rango completo de datos disponibles
    if (points.value.length > 0) {
      const dates = points.value
        .map(p => p.DATA)
        .filter(d => d)
        .map(d => d.substring(0, 10)) // Asegurar formato YYYY-MM-DD
        .sort()
      
      if (dates.length > 0) {
        startDate.value = dates[0]
        endDate.value = dates[dates.length - 1]
        loadingMessage.value = `Procesando ${points.value.length} lotes del ${formatDateSimple(dates[0])} al ${formatDateSimple(dates[dates.length - 1])}...`
      }
    }
  } catch (e) {
    errorMsg.value = e.message || 'Error desconocido'
  } finally {
    loading.value = false
  }
}

function retry() {
  loadData()
}

function resetFilters() {
  if (points.value.length > 0) {
    const dates = points.value
      .map(p => p.DATA)
      .filter(d => d)
      .map(d => d.substring(0, 10))
      .sort()
    
    if (dates.length > 0) {
      startDate.value = dates[0]
      endDate.value = dates[dates.length - 1]
    } else {
      startDate.value = ''
      endDate.value = ''
    }
  } else {
    startDate.value = ''
    endDate.value = ''
  }
}

async function fetchPoints() {
  const res = await fetch('/api/golden-batch/points')
  if (!res.ok) throw new Error(`API Points Error: ${res.statusText}`)
  const data = await res.json()
  // Convert strings to numbers for charts and modal
  points.value = data.rows.map(r => ({
    ...r,
    EFIC_TEJ: safeFloat(r.EFIC_TEJ),
    SCI: safeFloat(r.SCI),
    STR: safeFloat(r.STR),
    MIC: safeFloat(r.MIC),
    RU_105: safeFloat(r.RU_105),
    RT_105: safeFloat(r.RT_105),
    ROT_URD_URDI: safeFloat(r.ROT_URD_URDI),
    INDIGO_R: safeFloat(r.INDIGO_R),
    INDIGO_CAVALOS: safeFloat(r.INDIGO_CAVALOS),
    INDIGO_VEL_REAL: safeFloat(r.INDIGO_VEL_REAL),
    INDIGO_VEL_NOM: safeFloat(r.INDIGO_VEL_NOM),
    LOTE_FIBRA_TEXT: stripZeros(r.LOTE_FIBRA_TEXT),
    MISTURA: stripZeros(r.MISTURA)
  }))
}

// Modal functions
function openModal(estado) {
  modalCategory.value = estado
  // Filter points by category
  modalData.value = filteredPoints.value.filter(p => {
    if (estado.includes('EXITO')) return p.EFIC_TEJ >= 90
    if (estado.includes('BAJA')) return p.EFIC_TEJ < 85
    return p.EFIC_TEJ >= 85 && p.EFIC_TEJ < 90 // NORMAL
  })
  isModalOpen.value = true
}

function closeModal() {
  isModalOpen.value = false
  modalCategory.value = ''
  modalData.value = []
}

// Computed Data
const filteredPoints = computed(() => {
  if (!points.value.length) return []
  return points.value.filter(p => {
    // Parse fecha. Backend viene como YYYY-MM-DD o ISO
    const pDate = new Date(p.DATA) 
    if (startDate.value) {
      const start = new Date(startDate.value)
      if (pDate < start) return false
    }
    if (endDate.value) {
      const end = new Date(endDate.value)
      // Ajustar end a final del dia o comparar fechas puras
      // Input date es "yyyy-mm-dd", pDate puede tener hora. 
      // Asumamos pDate es Date obj (00:00 UTC si viene solo fecha).
      if (pDate > end) return false
    }
    return true
  })
})

const filteredSummary = computed(() => {
  const data = filteredPoints.value
  if (!data.length) return []

  // Definir acumuladores
  const groups = {
    'EXITO (>90%)': { count: 0, sci: 0, str: 0, mic: 0, rot: 0 },
    'BAJA (<85%)': { count: 0, sci: 0, str: 0, mic: 0, rot: 0 },
    'NORMAL': { count: 0, sci: 0, str: 0, mic: 0, rot: 0 }
  }

  data.forEach(p => {
    let key = 'NORMAL'
    if (p.EFIC_TEJ >= 90) key = 'EXITO (>90%)'
    else if (p.EFIC_TEJ < 85) key = 'BAJA (<85%)'

    const g = groups[key]
    g.count++
    g.sci += (p.SCI || 0)
    g.str += (p.STR || 0)
    g.mic += (p.MIC || 0)
    g.rot += (p.RU_105 || 0)
  })

  // Calcular promedios
  const result = Object.keys(groups).map(k => {
    const g = groups[k]
    return {
      estado: k,
      volumen: g.count,
      sci: g.count ? (g.sci / g.count).toFixed(1) : '-',
      str: g.count ? (g.str / g.count).toFixed(1) : '-',
      mic: g.count ? (g.mic / g.count).toFixed(2) : '-',
      rot_urd: g.count ? (g.rot / g.count).toFixed(1) : '-'
    }
  }).filter(r => r.volumen > 0) // Mostrar solo grupos con datos?
  
  // Ordenar: Exito, Normal, Baja
  return result.sort((a, b) => {
    if (a.estado.includes('EXITO')) return -1
    if (b.estado.includes('EXITO')) return 1
    if (a.estado.includes('NORMAL')) return -1
    if (b.estado.includes('NORMAL')) return 1
    return 0
  })
})

const analysis = computed(() => {
  const summary = filteredSummary.value
  if (!summary.length) return null

  const exito = summary.find(s => s.estado.includes('EXITO')) || { sci: '-', rot_urd: '-' }
  const baja = summary.find(s => s.estado.includes('BAJA')) || { sci: '-', rot_urd: '-' }
  
  const sciExito = parseFloat(exito.sci) || 0
  
  // Lógica dinámica para la conclusión de compras
  let comprasTxt = "se sugiere mantener el monitoreo actual."
  if (sciExito > 0) {
      if (sciExito < 112.5) {
          comprasTxt = "se confirma que es posible obtener >90% de eficiencia con fibras de SCI moderado, permitiendo mayor flexibilidad en compras."
      } else {
          comprasTxt = "se observa que la alta eficiencia está ligada a un SCI robusto, sugiriendo priorizar calidad de fibra."
      }
  }

  // Formato fechas
  const p1 = startDate.value ? formatDateSimple(startDate.value) : 'Inicio'
  const p2 = endDate.value ? formatDateSimple(endDate.value) : 'Fin'

  return {
    periodo: `${p1} a ${p2}`,
    exito: {
      sci: exito.sci,
      rot: exito.rot_urd,
      rotEval: (parseFloat(exito.rot_urd) < 2.5) ? 'bajas' : 'moderadas'
    },
    baja: {
      sci: baja.sci,
      rot: baja.rot_urd
    },
    comprasConclusion: comprasTxt
  }
})

const chartDataSCI = computed(() => ({
  datasets: [{
    label: 'SCI vs Eficiencia',
    fill: false,
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
    data: filteredPoints.value.map(p => ({ x: p.SCI, y: p.EFIC_TEJ }))
  }]
}))

const chartDataSTR = computed(() => ({
  datasets: [{
    label: 'Resistencia vs Eficiencia',
    fill: false,
    borderColor: '#059669',
    backgroundColor: '#059669',
    data: filteredPoints.value.map(p => ({ x: p.STR, y: p.EFIC_TEJ }))
  }]
}))

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      title: { display: true, text: 'Eficiencia (%)' },
      min: 70,
      max: 100
    }
  }
}

// Helpers
function safeFloat(val) {
  if (val === null || val === undefined || val === '') return null
  const num = parseFloat(String(val).replace(',', '.'))
  return isNaN(num) ? null : num
}

function stripZeros(val) {
  if (!val) return val
  return String(val).replace(/^0+/, '') || '0'
}

function formatDate(d) {
  if (!d) return '-'
  const dateObj = new Date(d)
  if (isNaN(dateObj)) return String(d)
  return dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC' })
}

function formatNum(val, decimals = 2) {
  if (val === null || val === undefined || val === '' || Number.isNaN(val)) return '-'
  // Si viene como string '45,2', normalizar
  let numStr = String(val).replace(',', '.')
  let num = parseFloat(numStr)
  if (isNaN(num)) return '-'
  return num.toFixed(decimals)
}

function formatDateSimple(isoStr) {
    if(!isoStr) return ''
    const parts = isoStr.split('-') // yyyy-mm-dd
    if(parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    return isoStr
}

function getEffClass(val) {
  if (val >= 90) return 'text-green-600'
  if (val < 85) return 'text-red-600'
  return 'text-blue-600'
}
</script>
