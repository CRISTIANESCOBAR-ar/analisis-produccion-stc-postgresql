<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <div class="mb-6 flex justify-between items-center">
      <h1 class="text-3xl font-bold text-gray-800">Motor de Correlación "Golden Batch"</h1>
      <div class="text-sm text-gray-500">
        Eficiencia Ajustada (OEE) = Producción / (Tiempo Total - Paradas Exógenas)
      </div>
    </div>

    <!-- Summary Cards -->
    <div v-if="summary.length" class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div 
        v-for="item in summary" 
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

    <div v-else class="flex flex-col justify-center items-center py-10">
       <div v-if="loading" class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
       <div v-else class="text-red-600 font-bold">
          Error cargando datos: {{ errorMsg }}
          <button @click="retry" class="ml-4 underline">Reintentar</button>
       </div>
    </div>

    <!-- Analysis Text -->
    <div class="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8 rounded shadow-sm">
      <h3 class="text-blue-800 font-bold text-lg mb-2">Conclusiones del Ajuste (OEE)</h3>
      
      <div class="mb-4">
        <h4 class="font-bold text-blue-700">Rescate de "Falsos Negativos"</h4>
        <ul class="list-disc ml-6 text-gray-700 mt-1 space-y-1">
          <li><strong>48 lotes</strong> salieron de la zona roja (<span class="text-red-500 font-bold">"Baja"</span>) al descontar tiempos muertos exógenos (Energía, Aire, Mantenimiento Preventivo).</li>
          <li><strong>4 lotes adicionales</strong> entraron al exclusivo club del <span class="text-green-600 font-bold">"Éxito" (>90%)</span>. Antes se descartaban injustamente por paradas externas pese a tener materia prima excelente.</li>
        </ul>
      </div>

      <div class="mb-4">
        <h4 class="font-bold text-blue-700">Validación de la Hipótesis del "Golden Batch"</h4>
        <p class="text-gray-700 mt-1">Aún con el reacomodo, la correlación se mantiene intacta:</p>
        <ul class="list-disc ml-6 text-gray-700 mt-1 space-y-1">
          <li>Los lotes de <strong>Éxito</strong> mantienen un <strong>SCI superior (~112)</strong> y Roturas bajas (2.1).</li>
          <li>Los lotes de <strong>Baja eficiencia</strong> siguen teniendo un SCI pobre (~105) y Roturas altas (3.0).</li>
        </ul>
      </div>

      <div>
        <h4 class="font-bold text-blue-700">💡 Dato Clave para Compras</h4>
        <p class="text-gray-700 mt-1">
           Los nuevos lotes en "Éxito" bajaron ligeramente el promedio de SCI de 113.7 a <strong>112.3</strong>. 
           Esto sugiere que con un <strong>SCI de 112</strong> ya es posible obtener >90% de eficiencia si se controlan las paradas externas. 
           Esto permite mayor flexibilidad en la compra de fibra.
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
      <div class="px-6 py-4 border-b">
        <h3 class="font-bold text-gray-700">Detalle de Lotes (Top 100 Recientes)</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 text-sm">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Fecha</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Turno</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Artículo</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Lote Fibra</th>
              <th class="px-4 py-3 text-left font-medium text-gray-500 uppercase">Mistura</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">Efic. Tejido</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">SCI</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">STR</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">MIC</th>
              <th class="px-4 py-3 text-right font-medium text-gray-500 uppercase">Rot Urd</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(row, idx) in points.slice(0, 500)" :key="idx" class="hover:bg-gray-50">
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

const summary = ref([])
const points = ref([])
const loading = ref(true)
const errorMsg = ref('')

onMounted(async () => {
  await loadData()
})

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    await Promise.all([fetchSummary(), fetchPoints()])
  } catch (e) {
    errorMsg.value = e.message || 'Error desconocido'
  } finally {
    loading.value = false
  }
}

function retry() {
  loadData()
}

async function fetchSummary() {
  const res = await fetch('/api/golden-batch/summary')
  if (!res.ok) throw new Error(`API Summary Error: ${res.statusText}`)
  const data = await res.json()
  summary.value = data.rows
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

const chartDataSCI = computed(() => ({
  datasets: [{
    label: 'SCI vs Eficiencia',
    fill: false,
    borderColor: '#4f46e5',
    backgroundColor: '#4f46e5',
    data: points.value.map(p => ({ x: p.SCI, y: p.EFIC_TEJ }))
  }]
}))

const chartDataSTR = computed(() => ({
  datasets: [{
    label: 'Resistencia vs Eficiencia',
    fill: false,
    borderColor: '#059669',
    backgroundColor: '#059669',
    data: points.value.map(p => ({ x: p.STR, y: p.EFIC_TEJ }))
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
  // Si viene ISO (yyyy-mm-dd), convertimos de forma segura
  const dateObj = new Date(d)
  if (isNaN(dateObj)) return String(d) // Fallback si falla
  return dateObj.toLocaleDateString('es-ES', { timeZone: 'UTC' }) // Importante UTC si viene sin hora
}

function getEffClass(val) {
  if (val >= 90) return 'text-green-600'
  if (val < 85) return 'text-red-600'
  return 'text-blue-600'
}
</script>
