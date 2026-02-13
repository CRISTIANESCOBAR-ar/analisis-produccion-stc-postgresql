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

    <!-- Summary Cards (Calculated from Filtered Data) -->
    <div v-if="filteredSummary.length" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div 
        v-for="item in filteredSummary" 
        :key="item.estado"
        :class="[
          'p-5 rounded-lg shadow border-l-4',

          item.estado.includes('EXITO') ? 'bg-green-50 border-green-500' : 
          item.estado.includes('BAJA') ? 'bg-red-50 border-red-500' : 'bg-white border-blue-500'
        ]"
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

    <div v-else-if="loading" class="flex flex-col justify-center items-center py-10">
       <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
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


onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    // Solo necesitamos los puntos, el resumen lo calculamos dinámico
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
  // Convert strings to numbers for charts
  points.value = data.rows.map(r => ({
    ...r,
    EFIC_TEJ: parseFloat(r.EFIC_TEJ),
    SCI: parseFloat(r.SCI),
    STR: parseFloat(r.STR),
    MIC: parseFloat(r.MIC),
    RU_105: parseFloat(r.RU_105)
  }))
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
function formatDate(d) {
  if (!d) return '-'
  const dateObj = new Date(d)
  if (isNaN(dateObj)) return String(d)
  return dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC' })
}

function formatNum(val, decimals = 2) {
  if (val === null || val === undefined || val === '') return '-'
  // Si viene como string '45,2', normalizar
  let numStr = String(val).replace(',', '.')
  let num = parseFloat(numStr)
  if (isNaN(num)) return val
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
