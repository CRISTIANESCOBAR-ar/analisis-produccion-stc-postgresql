<template>
  <div class="px-4 pt-3 max-w-[1600px] mx-auto font-sans h-[calc(100vh-8px)] min-h-[500px] max-h-[800px]">

    <!-- Header condensado -->
    <div class="flex flex-wrap items-center gap-3 mb-4 pb-3 border-b border-gray-200">
      <h1 class="text-base font-semibold text-gray-800 tracking-tight whitespace-nowrap">Performance Mensual de Revisores</h1>
      <div class="flex items-center gap-3 ml-auto">
        <input type="month" v-model="mesInicio" class="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50" />
        <span class="text-gray-400 text-xs">→</span>
        <input type="month" v-model="mesFin" class="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50" />
        <select v-model="tramaSeleccionada" class="border border-gray-200 rounded-md px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-gray-50">
          <option>Todas</option>
          <option>ALG 100%</option>
          <option>P + E</option>
          <option>POL 100%</option>
        </select>
        <button @click="loadData" class="bg-gray-800 text-white p-1.5 rounded-md hover:bg-gray-700 transition-colors" title="Consultar">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-center py-12 text-gray-400 text-sm">Cargando datos...</div>

    <!-- Sin datos -->
    <div v-else-if="!loading && rawData.length === 0 && consultado" class="text-center py-12 text-gray-300 text-sm">
      Sin datos para el período seleccionado.
    </div>

    <!-- Contenido principal -->
    <template v-if="!loading && rawData.length > 0">
      <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.45fr)] gap-5 h-[calc(100vh-60px)] min-h-[400px] max-h-[760px]">

        <!-- Tabla resumen -->
        <div class="flex flex-col h-full">
          <div class="overflow-x-auto overflow-y-auto rounded-lg border border-gray-100 flex-1 min-h-[250px] max-h-full">
            <table class="w-full text-xs">
              <thead>
                <tr class="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                  <th class="px-3 py-2.5 text-left font-medium">Revisor</th>
                  <th class="px-2 py-2.5 text-right font-medium">Días</th>
                  <th class="px-2 py-2.5 text-right font-medium">Media Mts</th>
                  <th class="px-2 py-2.5 text-right font-medium">Efic.</th>
                  <th class="px-2 py-2.5 text-right font-medium">Pts/100m²</th>
                  <th class="px-2 py-2.5 text-right font-medium">Sin Pts</th>
                  <th class="px-2 py-2.5 text-center font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in resumenRevisores"
                  :key="r.Revisor"
                  class="border-b border-gray-50 cursor-pointer transition-all duration-150"
                  :class="r.Revisor === revisorSeleccionado ? 'bg-blue-50/70' : 'hover:bg-gray-50/60'"
                  @click="revisorSeleccionado = r.Revisor"
                >
                  <td class="px-3 py-2 text-left font-medium text-gray-700 whitespace-nowrap">
                    <span class="inline-block w-1.5 h-1.5 rounded-full mr-1.5" :class="r.Revisor === revisorSeleccionado ? 'bg-blue-500' : 'bg-gray-200'"></span>
                    {{ r.Revisor }}
                  </td>
                  <td class="px-2 py-2 text-right text-gray-500">{{ r.diasTrab }}</td>
                  <td class="px-2 py-2 text-right font-semibold text-gray-800">{{ formatNum(r.mediaDiaria) }}</td>
                  <td class="px-2 py-2 text-right" :class="eficColor(r.eficMesa)">{{ r.eficMesa }}%</td>
                  <td class="px-2 py-2 text-right text-gray-600">{{ r.pts100m2 }}</td>
                  <td class="px-2 py-2 text-right" :class="sinPtsColor(r.sinPtsPct)">{{ r.sinPtsPct }}%</td>
                  <td class="px-2 py-2 text-center">
                    <span v-for="a in r.alertas" :key="a" class="inline-block text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      :class="a.includes('↓ Pts') ? 'bg-red-50 text-red-500' : a.includes('↑ Sin Pts') ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-500'">
                      {{ a }}
                    </span>
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="border-t border-gray-200 text-gray-500">
                  <td class="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wider">Promedio</td>
                  <td class="px-2 py-2 text-right">{{ promedioGeneral.diasTrab }}</td>
                  <td class="px-2 py-2 text-right font-semibold">{{ formatNum(promedioGeneral.mediaDiaria) }}</td>
                  <td class="px-2 py-2 text-right">{{ promedioGeneral.eficMesa }}%</td>
                  <td class="px-2 py-2 text-right">{{ promedioGeneral.pts100m2 }}</td>
                  <td class="px-2 py-2 text-right">{{ promedioGeneral.sinPtsPct }}%</td>
                  <td class="px-2 py-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Gráfico -->
        <div v-if="revisorSeleccionado" class="bg-white rounded-lg border border-gray-100 p-4 flex flex-col h-full">
          <div class="flex-1 min-h-[520px] max-h-[720px]">
            <canvas ref="chartCanvas" style="height:100%;max-height:700px;"></canvas>
          </div>
        </div>
        <div v-else class="rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xs min-h-[520px] max-h-[720px] h-full">
          Seleccione un revisor
        </div>
      </div>

      <!-- Evolución mensual -->
      <template v-if="revisorSeleccionado">
        <p class="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">Evolución mensual — {{ revisorSeleccionado }}</p>
        <div class="overflow-x-auto rounded-lg border border-gray-100 mb-4">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-[10px] text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th class="px-3 py-2.5 text-left font-medium">Mes</th>
                <th class="px-2 py-2.5 text-right font-medium">Días</th>
                <th class="px-2 py-2.5 text-right font-medium">Metros</th>
                <th class="px-2 py-2.5 text-right font-medium">Media/día</th>
                <th class="px-2 py-2.5 text-right font-medium">Efic.</th>
                <th class="px-2 py-2.5 text-right font-medium">Pts/100m²</th>
                <th class="px-2 py-2.5 text-right font-medium">Rollos 1era</th>
                <th class="px-2 py-2.5 text-right font-medium">Sin Pts</th>
                <th class="px-2 py-2.5 text-right font-medium">Sin Pts%</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(m, i) in mesesRevisor"
                :key="m.Mes"
                class="border-b border-gray-50 transition-colors hover:bg-gray-50/40"
              >
                <td class="px-3 py-2 text-left font-medium text-gray-700">{{ formatMes(m.Mes) }}</td>
                <td class="px-2 py-2 text-right text-gray-500">{{ m.Dias_Trabajados }}</td>
                <td class="px-2 py-2 text-right text-gray-600">{{ formatNum(m.Mts_Total) }}</td>
                <td class="px-2 py-2 text-right font-semibold text-gray-800">{{ formatNum(m.Media_Diaria_Mts) }}</td>
                <td class="px-2 py-2 text-right" :class="eficColor(calcEfic(m.Media_Diaria_Mts))">{{ calcEfic(m.Media_Diaria_Mts) }}%</td>
                <td class="px-2 py-2 text-right text-gray-600">{{ m.Pts_100m2 ?? '-' }}</td>
                <td class="px-2 py-2 text-right text-gray-500">{{ m.Rollos_1era }}</td>
                <td class="px-2 py-2 text-right" :class="m.Rollos_Sin_Pts > 0 ? 'text-amber-600 font-medium' : 'text-gray-500'">{{ m.Rollos_Sin_Pts }}</td>
                <td class="px-2 py-2 text-right" :class="sinPtsColor(m.Perc_Sin_Pts)">{{ m.Perc_Sin_Pts ?? 0 }}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useDatabase } from '@/composables/useDatabase'
import { Chart, registerables } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'

Chart.register(...registerables, ChartDataLabels)

const db = useDatabase()

// Revisores activos (lista blanca)
const REVISORES_ACTIVOS = [
  'Maximiliano', 'INOCENCIO', 'GEREMIAS', 'Alejandro G',
  'Fabio', 'Facundo', 'Hugo', 'CarlosD', 'Nahuel Jonatan'
]

// Velocidades mesa (m/min)
const VELOCIDADES_MESA = [32, 32.5, 31, 33.7, 32.5, 31, 30.5, 31]
const VEL_MEDIA = VELOCIDADES_MESA.reduce((a, b) => a + b, 0) / VELOCIDADES_MESA.length // 31.78
const TURNO_MINUTOS = 450 // 480 - 30 descanso
const METROS_TEORICOS = Math.round(VEL_MEDIA * TURNO_MINUTOS) // ~14299

const hoy = new Date()
const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`
const mesHace3 = (() => {
  const d = new Date(hoy)
  d.setMonth(d.getMonth() - 2)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()

const mesInicio = ref(mesHace3)
const mesFin = ref(mesActual)
const tramaSeleccionada = ref('Todas')
const rawData = ref([])
const loading = ref(false)
const consultado = ref(false)
const revisorSeleccionado = ref(null)
const chartCanvas = ref(null)
let chartInstance = null

const MESES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function formatMes(yyyymm) {
  const [y, m] = yyyymm.split('-')
  return `${MESES_NOMBRES[parseInt(m, 10) - 1]} ${y.slice(-2)}`
}

function formatNum(n) {
  if (n == null) return '-'
  return Number(n).toLocaleString('es-AR')
}

function calcEfic(mediaDiaria) {
  if (!mediaDiaria || mediaDiaria === 0) return 0
  return Math.round((mediaDiaria / METROS_TEORICOS) * 1000) / 10
}

function eficColor(pct) {
  if (pct >= 75) return 'text-emerald-500 font-medium'
  if (pct >= 55) return 'text-amber-500 font-medium'
  return 'text-rose-400 font-medium'
}

function sinPtsColor(pct) {
  if (pct == null) return 'text-gray-500'
  if (pct >= 25) return 'text-rose-500 font-medium'
  if (pct >= 15) return 'text-amber-500 font-medium'
  return 'text-gray-500'
}

// Detectar tendencia lineal simple (pendiente)
function tendencia(values) {
  if (values.length < 2) return 0
  const n = values.length
  const xMean = (n - 1) / 2
  const yMean = values.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean)
    den += (i - xMean) ** 2
  }
  return den === 0 ? 0 : num / den
}

const revisores = computed(() => {
  const set = new Set(rawData.value.map(r => r.Revisor).filter(r => REVISORES_ACTIVOS.includes(r)))
  return Array.from(set).sort()
})

const resumenRevisores = computed(() => {
  const map = {}
  for (const r of rawData.value) {
    if (!REVISORES_ACTIVOS.includes(r.Revisor)) continue
    if (!map[r.Revisor]) {
      map[r.Revisor] = { mtsTotal: 0, diasTrab: 0, pts100m2Vals: [], sinPtsPctVals: [], rollos1era: 0, sinPtsUn: 0, meses: [] }
    }
    const e = map[r.Revisor]
    e.mtsTotal += Number(r.Mts_Total) || 0
    e.diasTrab += Number(r.Dias_Trabajados) || 0
    e.rollos1era += Number(r.Rollos_1era) || 0
    e.sinPtsUn += Number(r.Rollos_Sin_Pts) || 0
    if (r.Pts_100m2 != null) e.pts100m2Vals.push(Number(r.Pts_100m2))
    if (r.Perc_Sin_Pts != null) e.sinPtsPctVals.push(Number(r.Perc_Sin_Pts))
  }

  return Object.entries(map).map(([revisor, e]) => {
    const mediaDiaria = e.diasTrab > 0 ? Math.round(e.mtsTotal / e.diasTrab) : 0
    const eficMesa = calcEfic(mediaDiaria)
    const pts100m2 = e.pts100m2Vals.length > 0
      ? Math.round(e.pts100m2Vals.reduce((a, b) => a + b, 0) / e.pts100m2Vals.length * 10) / 10
      : 0
    const sinPtsPct = e.rollos1era > 0 ? Math.round(e.sinPtsUn / e.rollos1era * 1000) / 10 : 0

    const alertas = []
    const slopePts = tendencia(e.pts100m2Vals)
    const slopeSinPts = tendencia(e.sinPtsPctVals)
    if (slopePts < -0.3 && e.pts100m2Vals.length >= 2) alertas.push('⚠️ ↓ Pts/100m²')
    if (slopeSinPts > 1.5 && e.sinPtsPctVals.length >= 2) alertas.push('⚠️ ↑ Sin Pts')
    if (alertas.length === 0 && e.pts100m2Vals.length >= 2) alertas.push('✓ Estable')

    return { Revisor: revisor, diasTrab: e.diasTrab, mtsTotal: e.mtsTotal, mediaDiaria, eficMesa, pts100m2, rollos1era: e.rollos1era, sinPtsUn: e.sinPtsUn, sinPtsPct, alertas }
  }).sort((a, b) => b.mediaDiaria - a.mediaDiaria)
})

const promedioGeneral = computed(() => {
  const list = resumenRevisores.value
  if (!list.length) return { diasTrab: 0, mtsTotal: 0, mediaDiaria: 0, eficMesa: 0, pts100m2: 0, rollos1era: 0, sinPtsUn: 0, sinPtsPct: 0 }
  const avg = (arr, key) => Math.round(arr.reduce((s, r) => s + r[key], 0) / arr.length)
  const avgDec = (arr, key) => Math.round(arr.reduce((s, r) => s + r[key], 0) / arr.length * 10) / 10
  return {
    diasTrab: avg(list, 'diasTrab'),
    mtsTotal: avg(list, 'mtsTotal'),
    mediaDiaria: avg(list, 'mediaDiaria'),
    eficMesa: avgDec(list, 'eficMesa'),
    pts100m2: avgDec(list, 'pts100m2'),
    rollos1era: avg(list, 'rollos1era'),
    sinPtsUn: avg(list, 'sinPtsUn'),
    sinPtsPct: avgDec(list, 'sinPtsPct'),
  }
})

const mesesRevisor = computed(() => {
  if (!revisorSeleccionado.value) return []
  return rawData.value.filter(r => r.Revisor === revisorSeleccionado.value)
})

async function loadData() {
  loading.value = true
  consultado.value = true
  try {
    const startDate = mesInicio.value + '-01'
    const [y, m] = mesFin.value.split('-')
    const lastDay = new Date(Number(y), Number(m), 0).getDate()
    const endDate = `${mesFin.value}-${String(lastDay).padStart(2, '0')}`

    const data = await db.getPerformanceMensual({
      startDate,
      endDate,
      tramas: tramaSeleccionada.value
    })
    rawData.value = data || []
    if (revisores.value.length > 0 && !revisores.value.includes(revisorSeleccionado.value)) {
      revisorSeleccionado.value = revisores.value[0]
    }
  } catch (e) {
    console.error('Error cargando performance mensual:', e)
    rawData.value = []
  } finally {
    loading.value = false
  }
}

function renderChart() {
  if (chartInstance) { chartInstance.destroy(); chartInstance = null }
  const canvas = chartCanvas.value
  if (!canvas || mesesRevisor.value.length === 0) return

  const labels = mesesRevisor.value.map(m => formatMes(m.Mes))
  const mediaDiariaData = mesesRevisor.value.map(m => Number(m.Media_Diaria_Mts) || 0)
  const pts100m2Data = mesesRevisor.value.map(m => Number(m.Pts_100m2) || 0)
  const sinPtsData = mesesRevisor.value.map(m => Number(m.Perc_Sin_Pts) || 0)
  const promMediaDiaria = promedioGeneral.value.mediaDiaria

  chartInstance = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Media Diaria (m)',
          data: mediaDiariaData,
          backgroundColor: mediaDiariaData.map(v => v >= promMediaDiaria ? 'rgba(16,185,129,0.6)' : 'rgba(244,63,94,0.55)'),
          borderColor: 'transparent',
          borderRadius: 4,
          borderSkipped: false,
          yAxisID: 'y',
          order: 2,
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: '#6b7280',
            font: { size: 10, weight: '500' },
            formatter: v => v.toLocaleString('es-AR')
          }
        },
        {
          type: 'line',
          label: 'Pts/100m²',
          data: pts100m2Data,
          borderColor: 'rgb(99,102,241)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: '#fff',
          pointBorderColor: 'rgb(99,102,241)',
          pointBorderWidth: 2,
          tension: 0.4,
          yAxisID: 'y1',
          order: 1,
          datalabels: {
            anchor: 'end',
            align: 'top',
            color: 'rgb(99,102,241)',
            font: { size: 9 },
            formatter: v => v.toFixed(1)
          }
        },
        {
          type: 'line',
          label: '% Sin Pts',
          data: sinPtsData,
          borderColor: 'rgb(245,158,11)',
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderDash: [4, 3],
          pointRadius: 3.5,
          pointBackgroundColor: '#fff',
          pointBorderColor: 'rgb(245,158,11)',
          pointBorderWidth: 1.5,
          tension: 0.4,
          yAxisID: 'y1',
          order: 1,
          datalabels: {
            anchor: 'end',
            align: 'bottom',
            color: 'rgb(245,158,11)',
            font: { size: 9 },
            formatter: v => v.toFixed(1) + '%'
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        title: {
          display: true,
          text: `${revisorSeleccionado.value || ''}   ·   Prom. gral: ${formatNum(promedioGeneral.value.mediaDiaria)} m/día   ·   Teórico 100%: ${formatNum(METROS_TEORICOS)} m`,
          font: { size: 11, weight: '500' },
          color: '#6366f1',
          padding: { bottom: 8, top: 2 }
        },
        tooltip: {
          backgroundColor: '#f3f4f6', // gris claro
          titleColor: '#1e3a8a', // azul oscuro
          bodyColor: '#1e3a8a',
          borderColor: '#cbd5e1',
          borderWidth: 1,
          titleFont: { weight: 'bold', size: 16, family: 'inherit' },
          bodyFont: { size: 15, family: 'inherit' },
          displayColors: false,
          padding: 10,
        },
        legend: {
          position: 'bottom',
          labels: { boxWidth: 10, boxHeight: 10, padding: 14, font: { size: 10 }, usePointStyle: true, pointStyle: 'circle' }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, color: '#9ca3af' }
        },
        y: {
          type: 'linear',
          position: 'left',
          title: { display: true, text: 'Metros/día', font: { size: 10 }, color: '#9ca3af' },
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.04)' },
          ticks: { font: { size: 9 }, color: '#9ca3af' }
        },
        y1: {
          type: 'linear',
          position: 'right',
          title: { display: true, text: 'Pts/100m² · %Sin Pts', font: { size: 10 }, color: '#9ca3af' },
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 9 }, color: '#9ca3af' }
        }
      }
    }
  })
}

watch([mesesRevisor, revisorSeleccionado], () => {
  nextTick(() => renderChart())
})

onMounted(() => {
  loadData()
})
</script>
