<template>
  <div class="w-full h-screen flex flex-col p-1">
    <!-- Debug badge (solo visible en desarrollo) -->
    <div v-if="showDebug" class="fixed bottom-2 right-2 z-50 bg-black/70 text-white text-xs px-2 py-1 rounded shadow">
      w: {{ viewportWidth }} | isMobile: {{ isMobile }}
    </div>
    <!-- Layout móvil controlado por runtime (isMobile) -->
    <template v-if="isMobile">
      <main
        class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
        <h3 class="text-lg font-semibold text-slate-800 mb-3">Gráficos de Ensayos</h3>
        <!-- Fila 1: Ne (4.5ch) + Ver (métrica) -->
        <div class="mb-2 flex items-center gap-3 w-full">
          <span class="text-sm text-slate-600 shrink-0">Ne:</span>
          <select v-model="ne" class="px-1 py-1 border rounded-md text-sm shrink-0"
            style="width:4.5ch;min-width:4.5ch;max-width:4.5ch;">
            <option value="">-</option>
            <option v-for="opt in neOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <span class="text-sm text-slate-600 shrink-0">Ver:</span>
          <select v-model="metric"
            class="px-2 py-1 border rounded-md text-sm flex-1 min-w-0 overflow-hidden text-ellipsis">
            <option v-for="m in metrics" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </div>
        <!-- Fila 2: LCL, Prom., UCL -->
        <div class="mb-3 flex items-center gap-4 text-slate-700 text-xs flex-wrap">
          <div class="whitespace-nowrap"><span class="font-semibold">LCL:</span> {{ format2(summary.lcl) }}</div>
          <div class="whitespace-nowrap"><span class="font-semibold">Prom.:</span> {{ format2(summary.mean) }}</div>
          <div class="whitespace-nowrap"><span class="font-semibold">UCL:</span> {{ format2(summary.ucl) }}</div>
        </div>
        <div v-if="loading" class="text-sm text-slate-600 py-8 text-center flex-1">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
          <p class="mt-2">Cargando datos para graficar...</p>
        </div>
        <div v-else class="flex-1 min-h-0 flex flex-col">
          <div class="flex-1 min-h-0 relative">
            <div ref="chartEl" class="w-full h-full"></div>
            <div v-if="noData" class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="bg-white/80 px-4 py-2 rounded-md text-sm text-slate-700">No hay datos numéricos para la
                métrica seleccionada.</div>
            </div>
          </div>
          <div class="mt-2 text-sm text-slate-700 text-center"><span class="font-semibold">Total de ensayos:</span> {{
            summary.count }}</div>
        </div>
      </main>
    </template>

    <!-- Layout escritorio -->
    <template v-else>
      <main
        class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
        <div class="flex items-center justify-between mb-3 flex-shrink-0">
          <div class="flex items-center gap-2">
            <div v-tippy="{ content: dataSourceTooltip, placement: 'bottom', theme: 'custom' }"
              class="flex items-center justify-center w-8 h-8 rounded-full"
              :class="dataSource === 'firebase' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'">
              <svg v-if="dataSource === 'firebase'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5"
                viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z" />
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h3 class="text-lg font-semibold text-slate-800">Visualizador de Ensayos</h3>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <label class="text-sm text-slate-600">Ver</label>
              <select v-model="metric" class="px-2 py-1 border rounded-md text-sm">
                <option v-for="m in metrics" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>
            <div class="flex items-center gap-2">
              <VueSelect v-model="oe" :options="oeOptions" clearable :searchable class="w-36" />
              <span class="text-sm text-slate-600">Ne</span>
              <VueSelect v-model="ne" :options="neOptions" clearable :searchable class="w-36" />
              <button @click="applyFilters" class="px-2 py-1 bg-blue-600 text-white rounded text-sm">Aplicar</button>
              <button @click="clearFilters" class="px-2 py-1 bg-white border rounded text-sm">Limpiar</button>
            </div>
          </div>
        </div>

        <div v-if="loading" class="text-sm text-slate-600 py-8 text-center flex-1">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
          <p class="mt-2">Cargando datos para graficar...</p>
        </div>

        <div v-else class="flex-1 min-h-0 flex flex-col">
          <div v-if="fetchError"
            class="mb-3 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-700 flex-shrink-0">
            <div class="flex items-start justify-between gap-3">
              <div>
                <div class="font-semibold">Error cargando datos</div>
                <div class="mt-1">{{ fetchError }}</div>
              </div>
              <div class="flex items-center gap-2">
                <button @click="loadData()" class="px-3 py-1 bg-white border rounded text-sm">Reintentar</button>
                <button @click="loadSampleData()" class="px-3 py-1 bg-blue-600 text-white rounded text-sm">Usar datos de
                  ejemplo</button>
              </div>
            </div>
          </div>

          <div class="mb-3 text-sm text-slate-600 flex-shrink-0">
            <template v-if="appliedOe || appliedNe">
              <span class="mr-2">Filtros aplicados:</span>
              <span v-if="appliedOe" class="inline-block mr-2 px-2 py-0.5 bg-slate-100 text-slate-700 rounded">OE: {{
                appliedOe }}</span>
              <span v-if="appliedNe" class="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded">Ne: {{
                appliedNe }}</span>
            </template>
          </div>

          <div class="flex mb-3 items-center gap-6 text-slate-700 text-sm flex-shrink-0">
            <div><span class="font-semibold">Ens.:</span> {{ summary.count }}</div>
            <div><span class="font-semibold">LCL:</span> {{ format2(summary.lcl) }}</div>
            <div><span class="font-semibold">Prom.:</span> {{ format2(summary.mean) }}</div>
            <div><span class="font-semibold">UCL:</span> {{ format2(summary.ucl) }}</div>
          </div>

          <div class="flex-1 min-h-0 relative">
            <div ref="chartEl" class="w-full h-full"></div>
            <div v-if="noData" class="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div class="bg-white/80 px-4 py-2 rounded-md text-sm text-slate-700">No hay datos numéricos para la
                métrica
                seleccionada.</div>
            </div>
          </div>
        </div>
      </main>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
// NOTE: require installing echarts: `npm install echarts`
import * as echarts from 'echarts'
import VueSelect from 'vue3-select-component'
import { useRegistroStore } from '../stores/registro.js'
import { fetchAllStatsData, getDataSource } from '../services/dataService'

const loading = ref(false)
const rows = ref([])
const chartEl = ref(null)
let chart = null
const noData = ref(false)
const fetchError = ref(null)

// Debug state
const showDebug = ref(import.meta?.env?.DEV === true)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0)

// Runtime flag para layout móvil (<768px) con matchMedia para mayor precisión
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
let mq = null
if (typeof window !== 'undefined') {
  mq = window.matchMedia('(max-width: 767px)')
  isMobile.value = mq.matches
}
function updateIsMobile() {
  const width = typeof window !== 'undefined' ? window.innerWidth : 1024
  const mediaMatch = mq ? mq.matches : (width < 768)
  isMobile.value = mediaMatch
}
function handleResize() {
  updateIsMobile()
  viewportWidth.value = typeof window !== 'undefined' ? window.innerWidth : 0
  // Redimensionar chart si existe para evitar cortes
  if (chart) {
    try { chart.resize() } catch { /* ignore */ }
  }
}

// Data source indicator
const dataSource = computed(() => getDataSource())
const dataSourceTooltip = computed(() => {
  return dataSource.value === 'firebase'
    ? 'Datos desde Firebase (Producción)'
    : 'Datos desde Oracle (Localhost)'
})

// filtros OE / Ne (inputs) y filtros aplicados
const oe = ref('')
const ne = ref('')
const appliedOe = ref('')
const appliedNe = ref('')

// listas únicas para sugerencias (combobox)
const availableOe = computed(() => {
  const s = new Set()
  for (const r of rows.value) {
    const v = r.OE || r.oe
    if (v != null && String(v).trim() !== '') s.add(String(v))
  }
  return Array.from(s).sort()
})

const availableNe = computed(() => {
  const s = new Set()
  for (const r of rows.value) {
    const v = r.Ne || r.ne
    if (v != null && String(v).trim() !== '') s.add(String(v))
  }
  return Array.from(s).sort()
})

const oeOptions = computed(() => availableOe.value.map(v => ({ label: String(v), value: String(v) })))
const neOptions = computed(() => availableNe.value.map(v => ({ label: String(v), value: String(v) })))

const metrics = [
  { value: 'Tenac.', label: 'Tenacidad (Tenac.)' },
  { value: 'Fuerza B', label: 'Fuerza B' },
  { value: 'Elong. %', label: 'Elong. %' },
  { value: 'CVm %', label: 'CVm %' },
  { value: 'Titulo', label: 'Título (TITULO)' }
]

const metric = ref('Tenac.')

// pinia store for sync
const registro = useRegistroStore()

// debounce timers
let oeTimer = null
let neTimer = null

// --- Sync local filters with Pinia store (two-way)
// when store changes (e.g., from ResumenEnsayos), update local inputs
watch(() => registro.oeFilter, (v) => {
  if (v !== oe.value) {
    oe.value = v || ''
    appliedOe.value = v || ''
    renderChart()
  }
})

watch(() => registro.neFilter, (v) => {
  if (v !== ne.value) {
    ne.value = v || ''
    appliedNe.value = v || ''
    renderChart()
  }
})

// when local inputs change, debounce and update store + applied filters
watch(oe, (val) => {
  if (oeTimer) clearTimeout(oeTimer)
  oeTimer = setTimeout(() => {
    const v = val ? String(val).trim() : ''
    appliedOe.value = v
    registro.setOeFilter(v)
    renderChart()
  }, 350)
})

watch(ne, (val) => {
  if (neTimer) clearTimeout(neTimer)
  neTimer = setTimeout(() => {
    const v = val ? String(val).trim() : ''
    appliedNe.value = v
    registro.setNeFilter(v)
    renderChart()
  }, 350)
})

function parseNum(v) {
  if (v == null || v === '') return NaN
  const s = String(v).replace(/,/g, '.') // accept commas as decimals
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : NaN
}

async function loadData() {
  loading.value = true
  noData.value = false
  fetchError.value = null

  try {
    // Usar el mismo servicio que ResumenEnsayos
    const allData = await fetchAllStatsData()

    const usterParDocs = Array.isArray(allData.usterPar) ? allData.usterPar : []
    const usterTblDocs = Array.isArray(allData.usterTbl) ? allData.usterTbl : []
    const tensorParDocs = Array.isArray(allData.tensorapidPar) ? allData.tensorapidPar : []
    const tensorTblDocs = Array.isArray(allData.tensorapidTbl) ? allData.tensorapidTbl : []

    console.log('📊 Datos cargados desde Firebase:', {
      usterPar: usterParDocs.length,
      usterTbl: usterTblDocs.length,
      tensorapidPar: tensorParDocs.length,
      tensorapidTbl: tensorTblDocs.length
    })

    // Debug: mostrar primeros 3 documentos de usterPar para verificar estructura
    console.log('🔍 Primeros 3 usterPar:', usterParDocs.slice(0, 3).map(p => ({
      testnr: p.TESTNR || p.testnr,
      nomcount: p.NOMCOUNT || p.nomcount,
      matclass: p.MATCLASS || p.matclass
    })))

    // Helper: formatear fecha a dd/mm/yy
    function formatFecha(val) {
      if (!val) return ''
      try {
        let d
        if (val.toDate) d = val.toDate()
        else if (val instanceof Date) d = val
        else if (typeof val === 'string') d = new Date(val)
        else return ''

        if (isNaN(d.getTime())) return ''
        const dd = String(d.getDate()).padStart(2, '0')
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        const yy = String(d.getFullYear()).slice(-2)
        return `${dd}/${mm}/${yy}`
      } catch {
        return ''
      }
    }

    // Helper: formatear OE (quitar ceros a la izquierda, separar letras)
    function formatOE(val) {
      if (!val) return ''
      let s = String(val).trim()
      if (/^0+\d+\s+\S+/.test(s)) {
        s = s.replace(/^0+(\d+)\s+/, '$1 ')
        return s
      }
      const m = s.match(/^0*(\d+)([A-Za-z]+)/)
      if (m) return `${parseInt(m[1], 10)} ${m[2].toUpperCase()}`
      if (/^0+\d+$/.test(s)) return String(parseInt(s, 10))
      return s
    }

    // Helper: formatear Ne con 'Flame' si es hilo de fantasía (igual que ResumenEnsayos)
    function formatNe(nomcount, matclass) {
      if (nomcount == null || nomcount === '') return ''
      let ne = String(nomcount).trim()
      if (matclass && String(matclass).toLowerCase() === 'hilo de fantasia') {
        return ne + 'Flame'
      }
      return ne
    }

    // Agrupar USTER_TBL por TESTNR
    const usterTblByTestnr = new Map()
    usterTblDocs.forEach(row => {
      const testnr = String(row.TESTNR || row.testnr || '')
      if (!testnr) return
      if (!usterTblByTestnr.has(testnr)) usterTblByTestnr.set(testnr, [])
      usterTblByTestnr.get(testnr).push(row)
    })

    // Mapear USTER_TESTNR -> TENSORAPID_PAR TESTNRs
    const tensorLinkMap = new Map()
    tensorParDocs.forEach(row => {
      const usterTestnr = String(row.USTER_TESTNR || row.uster_testnr || '')
      const tensorTestnr = String(row.TESTNR || row.testnr || '')
      if (!usterTestnr || !tensorTestnr) return
      if (!tensorLinkMap.has(usterTestnr)) tensorLinkMap.set(usterTestnr, [])
      tensorLinkMap.get(usterTestnr).push(tensorTestnr)
    })

    // Agrupar TENSORAPID_TBL por TESTNR
    const tensorTblByTestnr = new Map()
    tensorTblDocs.forEach(row => {
      const testnr = String(row.TESTNR || row.testnr || '')
      if (!testnr) return
      if (!tensorTblByTestnr.has(testnr)) tensorTblByTestnr.set(testnr, [])
      tensorTblByTestnr.get(testnr).push(row)
    })

    // Helper: calcular promedio de un campo
    function calcAvg(rows, field) {
      if (!rows || !rows.length) return null
      const values = rows.map(r => {
        const v = r[field] || r[field.toLowerCase()] || r[field.toUpperCase()]
        return typeof v === 'number' ? v : parseFloat(v)
      }).filter(v => !isNaN(v) && v != null)

      if (!values.length) return null
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      return Number(avg.toFixed(2))
    }

    // Construir filas para los gráficos
    rows.value = usterParDocs.map(par => {
      const testnr = String(par.TESTNR || par.testnr || '')
      const usterRows = usterTblByTestnr.get(testnr) || []
      const tensorTestnrs = tensorLinkMap.get(testnr) || []

      // Agregar todas las filas de TensorRapid vinculadas
      const tensorRows = []
      tensorTestnrs.forEach(tt => {
        const tRows = tensorTblByTestnr.get(tt) || []
        tensorRows.push(...tRows)
      })

      return {
        Ensayo: testnr,
        Fecha: formatFecha(par.TIME_STAMP || par.time_stamp),
        OE: formatOE(par.MASCHNR || par.maschnr),
        Ne: formatNe(par.NOMCOUNT || par.nomcount, par.MATCLASS || par.matclass),
        'CVm %': calcAvg(usterRows, 'CVM_PERCENT'),
        'Delg -30%': calcAvg(usterRows, 'DELG_MINUS30_KM'),
        'Delg -40%': calcAvg(usterRows, 'DELG_MINUS40_KM'),
        'Delg -50%': calcAvg(usterRows, 'DELG_MINUS50_KM'),
        'Grue +35%': calcAvg(usterRows, 'GRUE_35_KM'),
        'Grue +50%': calcAvg(usterRows, 'GRUE_50_KM'),
        'Neps +140%': calcAvg(usterRows, 'NEPS_140_KM'),
        'Neps +280%': calcAvg(usterRows, 'NEPS_280_KM'),
        'Titulo': calcAvg(usterRows, 'TITULO'),
        'Fuerza B': calcAvg(tensorRows, 'FUERZA_B'),
        'Elong. %': calcAvg(tensorRows, 'ELONGACION'),
        'Tenac.': calcAvg(tensorRows, 'TENACIDAD'),
        'Trabajo B': calcAvg(tensorRows, 'TRABAJO')
      }
    })

    // Debug: mostrar todos los valores Ne para verificar
    console.log('📋 Todos los Ne:', rows.value.map(r => ({ testnr: r.Ensayo, ne: r.Ne })))

  } catch (err) {
    console.error('Error cargando datos:', err)
    rows.value = []
    fetchError.value = String(err && err.message ? err.message : err) || 'Error desconocido al obtener datos'
  } finally {
    loading.value = false
  }
}

function loadSampleData() {
  // Small synthetic dataset to preview charts locally
  rows.value = Array.from({ length: 12 }).map((_, i) => {
    return {
      Ensayo: 1000 + i,
      'Tenac.': (20 + i * 0.8).toFixed(2),
      'Fuerza B': (150 + i * 2).toFixed(2),
      'Elong. %': (5 + i * 0.2).toFixed(2),
      'CVm %': (2 + (i % 3) * 0.5).toFixed(2),
      TITULO: (30 + i).toFixed(2)
    }
  })
  fetchError.value = null
  // mantener filtros aplicados al usar datos de ejemplo
  nextTick(() => renderChart())
}

function buildSeries() {
  const x = []
  const y = []

  const source = rows.value.filter(r => {
    if (appliedOe.value) {
      const v = r.OE || r.oe
      if (!v || String(v).toLowerCase().indexOf(appliedOe.value.toLowerCase()) === -1) return false
    }
    if (appliedNe.value) {
      const v = r.Ne || r.ne
      if (!v || String(v).toLowerCase().indexOf(appliedNe.value.toLowerCase()) === -1) return false
    }
    return true
  })

  for (const r of source) {
    const ens = r.Ensayo || r.testnr || r.Testnr || r.Ens || ''
    const raw = r[metric.value] ?? r[metric.value.replace('.', '')]
    const n = parseNum(raw)
    if (!Number.isFinite(n)) continue
    x.push(String(ens))
    y.push(n)
  }
  return { x, y }
}

function applyFilters() {
  appliedOe.value = oe.value ? oe.value.trim() : ''
  appliedNe.value = ne.value ? ne.value.trim() : ''
  // re-render chart with filters
  renderChart()
}

function clearFilters() {
  oe.value = ''
  ne.value = ''
  appliedOe.value = ''
  appliedNe.value = ''
  renderChart()
}

// apply filters while typing (debounced) and sync to store
watch(oe, (v) => {
  if (oeTimer) clearTimeout(oeTimer)
  oeTimer = setTimeout(() => {
    const trimmed = v ? String(v).trim() : ''
    appliedOe.value = trimmed
    // sync to store if different
    if (registro && registro.oeFilter !== trimmed) registro.setOeFilter(trimmed)
    renderChart()
  }, 350)
})

watch(ne, (v) => {
  if (neTimer) clearTimeout(neTimer)
  neTimer = setTimeout(() => {
    const trimmed = v ? String(v).trim() : ''
    appliedNe.value = trimmed
    if (registro && registro.neFilter !== trimmed) registro.setNeFilter(trimmed)
    renderChart()
  }, 350)
})

// react to external changes from the registro store (ResumenEnsayos sync)
watch(() => registro.oeFilter, (v) => {
  if (v == null) v = ''
  if (v !== oe.value) oe.value = v
  if (v !== appliedOe.value) {
    appliedOe.value = v
    renderChart()
  }
})

watch(() => registro.neFilter, (v) => {
  if (v == null) v = ''
  if (v !== ne.value) ne.value = v
  if (v !== appliedNe.value) {
    appliedNe.value = v
    renderChart()
  }
})

function renderChart() {
  if (!chartEl.value) return
  if (!chart) chart = echarts.init(chartEl.value)
  const { x, y } = buildSeries()
  noData.value = x.length === 0

  const option = {
    title: { text: metrics.find(m => m.value === metric.value)?.label || metric.value, left: 'center' },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: x, name: 'Ensayo', axisLabel: { rotate: 45 } },
    yAxis: { type: 'value', name: metric.value },
    series: [
      {
        data: y,
        type: 'line',
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 2 }
      }
    ],
    toolbox: { feature: { saveAsImage: {} } },
    grid: { left: 60, right: 30, bottom: 80 }
  }

  chart.setOption(option)
}

// Resumen para la barra (reacciona a filtros y métrica)
const summary = computed(() => {
  const { y } = buildSeries()
  const count = y.length
  if (count === 0) return { count: 0, mean: null, lcl: null, ucl: null }
  const mean = y.reduce((a, b) => a + b, 0) / count
  const variance = y.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / count
  const std = Math.sqrt(variance)
  const ucl = mean + 3 * std
  const lcl = mean - 3 * std
  return { count, mean, ucl, lcl }
})

function format2(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toFixed(2)
}

onMounted(async () => {
  await loadData()
  await nextTick()
  renderChart()
  window.addEventListener('resize', handleResize)
  // Log inicial para diagnóstico
  console.log('[GraficosEnsayos] mount width=', viewportWidth.value, 'isMobile=', isMobile.value)
  if (mq) {
    try {
      mq.addEventListener('change', (e) => {
        isMobile.value = e.matches
        viewportWidth.value = typeof window !== 'undefined' ? window.innerWidth : 0
        console.log('[GraficosEnsayos] matchMedia change width=', viewportWidth.value, 'isMobile=', isMobile.value)
      })
    } catch { /* ignore */ }
  }
})

onBeforeUnmount(() => {
  try { window.removeEventListener('resize', handleResize) } catch { /* ignore */ }
  try { chart && chart.dispose() } catch { /* ignore */ }
})

watch(metric, () => {
  renderChart()
})

</script>

<style scoped>
.echarts-hidden {
  display: none
}
</style>
