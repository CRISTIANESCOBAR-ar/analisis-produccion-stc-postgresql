<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">🧪</span>
            <h3 class="text-lg font-semibold text-slate-800">Resumen Semanal Hilanderia</h3>
          </div>
          <CustomDatepicker v-model="startDate" label="Desde" :show-buttons="false" />
          <CustomDatepicker v-model="endDate" label="Hasta" :show-buttons="false" />
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="loadRows"
            v-tippy="{ content: 'Refrescar datos', placement: 'bottom', theme: 'custom' }"
            class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M21 12a9 9 0 1 1-3-6.7" stroke-linecap="round" stroke-linejoin="round"></path>
              <polyline points="21 3 21 9 15 9" stroke-linecap="round" stroke-linejoin="round"></polyline>
            </svg>
            <span>Refrescar</span>
          </button>
          <button
            @click="exportToExcel"
            :disabled="!weeklyRows.length"
            v-tippy="{ content: 'Exportar a Excel', placement: 'bottom', theme: 'custom' }"
            class="inline-flex items-center gap-1 px-2 py-1 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors duration-150 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z" stroke-linecap="round" stroke-linejoin="round"></path>
              <path d="M9 13l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            <span>Excel</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-slate-600 py-8 text-center flex-1">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
        <p class="mt-2">Cargando...</p>
      </div>

      <div v-else class="flex-1 min-h-0 flex flex-col">
        <div v-if="weeklyRows.length === 0" class="text-sm text-slate-600 py-8 text-center">No hay datos para el rango seleccionado.</div>

        <div v-else class="overflow-auto _minimal-scroll w-full flex-1 min-h-0 rounded-xl border border-slate-200">
          <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
            <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-20">
              <!-- Fila de agrupación superior -->
              <tr>
                <th rowspan="2" class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">Mes</th>
                <th rowspan="2" class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">Semana</th>
                <th rowspan="2" class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <div class="flex items-center justify-center gap-1">
                    <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Ne</span>
                    <select
                      v-model="selectedNe"
                      class="w-full bg-transparent text-xs font-semibold text-slate-700"
                      style="width:9.33ch;min-width:9.33ch;max-width:9.33ch;"
                    >
                      <option value="">Todos</option>
                      <option v-for="ne in availableNes" :key="ne" :value="ne">{{ ne }}</option>
                    </select>
                  </div>
                </th>
                <th rowspan="2" class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <span>Ne<br>Promedio</span>
                </th>
                <th rowspan="2" class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200">
                  <span>Desv<br>%</span>
                </th>
                <th colspan="6" class="px-2 py-1 text-center font-bold text-emerald-700 border-b-2 border-b-slate-200 border-l-2 border-l-emerald-500 border-r-2 border-r-emerald-500 bg-emerald-100">
                  HVI - Calidad Fibra
                </th>
                <th colspan="8" class="px-2 py-1 text-center font-bold text-slate-700 border-b-2 border-b-slate-200 bg-slate-100">
                  USTER + TENSORAPID - Calidad Hilo
                </th>
              </tr>
              <!-- Fila de headers individuales -->
              <tr>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200 border-l-2 border-l-emerald-500 bg-emerald-50">
                  <select v-model="selectedHviKeys[0]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in hviOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200 bg-emerald-50">
                  <span>Desv<br>%</span>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200 bg-emerald-50">
                  <select v-model="selectedHviKeys[1]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in hviOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200 bg-emerald-50">
                  <span>Desv<br>%</span>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200 bg-emerald-50">
                  <select v-model="selectedHviKeys[2]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in hviOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200 border-r-2 border-r-emerald-500 bg-emerald-50">
                  <span>Desv<br>%</span>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <select v-model="selectedMetricKeys[0]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <span>Desv<br>%</span>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <select v-model="selectedMetricKeys[1]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <span>Desv<br>%</span>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <select v-model="selectedMetricKeys[2]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <span>Desv<br>%</span>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <select v-model="selectedMetricKeys[3]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b-2 border-slate-200">
                  <span>Desv<br>%</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in weeklyRows" :key="row.key" class="border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150">
                <td class="px-2 py-2 text-center text-slate-700 capitalize">{{ formatMonthYear(row.month, row.year) }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.week }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.neDisplay }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.tituloAvg }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.tituloDev }}</td>
                <td class="px-2 py-2 text-center text-slate-700 bg-emerald-50/30 border-l-2 border-l-emerald-500">{{ row.hviMetricA.avg }}</td>
                <td class="px-2 py-2 text-center text-slate-700 bg-emerald-50/30">{{ row.hviMetricA.dev }}</td>
                <td class="px-2 py-2 text-center text-slate-700 bg-emerald-50/30">{{ row.hviMetricB.avg }}</td>
                <td class="px-2 py-2 text-center text-slate-700 bg-emerald-50/30">{{ row.hviMetricB.dev }}</td>
                <td class="px-2 py-2 text-center text-slate-700 bg-emerald-50/30">{{ row.hviMetricC.avg }}</td>
                <td class="px-2 py-2 text-center text-slate-700 bg-emerald-50/30 border-r-2 border-r-emerald-500">{{ row.hviMetricC.dev }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricA.avg }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricA.dev }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricB.avg }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricB.dev }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricC.avg }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricC.dev }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricD.avg }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.metricD.dev }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import * as ExcelJS from 'exceljs'
import { fetchAllStatsData } from '../../services/dataService'
import CustomDatepicker from '../CustomDatepicker.vue'

const loading = ref(false)
const rows = ref([])

const startDate = ref('')
const endDate = ref('')
const selectedNe = ref('')
const standardTitleInput = ref('10')

const hviOptions = [
  { key: 'SCI', label: 'SCI' },
  { key: 'MST', label: 'MST' },
  { key: 'MIC', label: 'MIC' },
  { key: 'MAT', label: 'MAT' },
  { key: 'UHML', label: 'UHML' },
  { key: 'UI', label: 'UI' },
  { key: 'SF', label: 'SF' },
  { key: 'STR', label: 'STR' },
  { key: 'ELG', label: 'ELG' },
  { key: 'RD', label: 'RD' },
  { key: '+b', label: '+b' },
  { key: 'TrCNT', label: 'TrCNT' },
  { key: 'TrAR', label: 'TrAR' },
  { key: 'TRID', label: 'TRID' }
]

const metricOptions = [
  { key: 'CVm %', label: 'CVm %' },
  { key: 'Delg -30%', label: 'Delg -30%' },
  { key: 'Delg -40%', label: 'Delg -40%' },
  { key: 'Delg -50%', label: 'Delg -50%' },
  { key: 'Grue +35%', label: 'Grue +35%' },
  { key: 'Grue +50%', label: 'Grue +50%' },
  { key: 'Neps +140%', label: 'Neps +140%' },
  { key: 'Neps +280%', label: 'Neps +280%' },
  { key: 'Fuerza B', label: 'Fuerza B' },
  { key: 'Elong. %', label: 'Elong. %' },
  { key: 'Tenac.', label: 'Tenac.' },
  { key: 'Trabajo B', label: 'Trabajo B' }
]

const selectedHviKeys = ref(['MIC', 'STR', 'UHML'])
const selectedMetricKeys = ref(['Fuerza B', 'Elong. %', 'Tenac.', 'Trabajo B'])

const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

function parseNumber(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number' && Number.isFinite(val)) return val
  const raw = String(val).trim()
  if (!raw || raw === '—') return null
  const normalized = raw.replace(/%/g, '').replace(/\s+/g, '').replace(/,/g, '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

// Extrae el número del lote (ej: HD-106-26 → 106, HV 56-25 → 56)
function formatLote(lote) {
  if (!lote || lote === '') return ''
  const str = String(lote).trim()
  // Buscar patrón: separador (- o espacio) + dígitos + separador (- o espacio)
  const match = str.match(/[\s-](\d+)[\s-]/)
  if (match && match[1]) {
    return match[1]
  }
  // Si no hay match, devolver el valor original
  return str
}

function formatNe(nomcount, matclass) {
  if (nomcount == null || nomcount === '') return ''
  const raw = String(nomcount).trim()
  let ne = raw
  const neNum = parseFloat(ne.replace(',', '.'))
  if (!isNaN(neNum)) {
    ne = String(parseFloat(ne.replace(',', '.')))
  }
  const matclassText = matclass ? String(matclass).toLowerCase().trim() : ''
  const isFlame = /flame/i.test(raw) || matclassText.includes('flame') || matclassText.includes('fantasia')
  if (isFlame) {
    return `${ne}Flame`
  }
  return ne
}

function parseStandardTitleFromNe(neValue) {
  if (!neValue) return null
  const match = String(neValue).trim().match(/^(\d+(?:[\.,]\d+)?)/)
  if (!match) return null
  const normalized = match[1].replace(',', '.')
  const n = Number(normalized)
  return Number.isFinite(n) ? normalized : null
}

function formatMonthYear(monthName, year) {
  if (!monthName || !year) return ''
  const mmm = String(monthName).slice(0, 3)
  const yy = String(year).slice(-2)
  return `${mmm}-${yy}`
}

function getRowNeDisplay(row) {
  if (row.Ne != null && row.Ne !== '') return String(row.Ne)
  const matclass = row.MATCLASS ?? row.matclass ?? row.Matclass ?? row.MatClass ?? null
  return formatNe(row.NOMCOUNT ?? row.Ne, matclass)
}

function formatNumber(val, maxDecimals = 2) {
  if (val == null || !Number.isFinite(val)) return '—'
  const fixed = val.toFixed(maxDecimals)
  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  const [intPart, decPart] = trimmed.split('.')
  const intWithSeparator = Math.abs(parseInt(intPart)) >= 1000 
    ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : intPart
  return decPart ? `${intWithSeparator},${decPart}` : intWithSeparator
}

function parseRowDate(row) {
  const raw = row.TIME_STAMP || row.TIME || row.TIMESTAMP || row.Fecha || row.fecha || row.FECHA || null
  if (!raw) return null
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = raw > 1000000000000 ? new Date(raw) : new Date(raw * 1000)
    return isNaN(d.getTime()) ? null : d
  }
  const s = String(raw).trim()
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (match) {
    const day = parseInt(match[1], 10)
    const month = parseInt(match[2], 10) - 1
    let year = parseInt(match[3], 10)
    if (year < 100) year += 2000
    const d = new Date(year, month, day)
    return isNaN(d.getTime()) ? null : d
  }
  const fallback = new Date(s)
  return isNaN(fallback.getTime()) ? null : fallback
}

function getISOWeekInfo(date) {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((temp - yearStart) / 86400000 + 1) / 7)
  return { year: temp.getUTCFullYear(), week }
}

function formatDateInput(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const availableNes = computed(() => {
  const set = new Set()
  for (const row of rows.value || []) {
    const displayNe = getRowNeDisplay(row)
    if (displayNe) set.add(displayNe)
  }
  return Array.from(set).sort((a, b) => {
    const na = parseFloat(String(a).replace(',', '.'))
    const nb = parseFloat(String(b).replace(',', '.'))
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })
})

// Calcula promedio ponderado por peso de una variable HVI para un conjunto de lotes
function calcHviWeightedAvg(lotes, hviKey) {
  if (!window.calidadFibraByLote) return null
  
  const hviFieldMap = {
    'SCI': 'SCI',
    'MST': 'MST',
    'MIC': 'MIC',
    'MAT': 'MAT',
    'UHML': 'UHML',
    'UI': 'UI',
    'SF': 'SF',
    'STR': 'STR',
    'ELG': 'ELG',
    'RD': 'RD',
    '+b': 'PLUS_B',
    'TrCNT': 'TrCNT',
    'TrAR': 'TrAR',
    'TRID': 'TRID'
  }
  
  const fieldName = hviFieldMap[hviKey] || hviKey
  
  let totalPeso = 0
  let sumaPonderada = 0
  
  lotes.forEach(lote => {
    const registros = window.calidadFibraByLote.get(lote) || []
    registros.forEach(reg => {
      const peso = parseNumber(reg.PESO ?? reg.peso)
      const valor = parseNumber(reg[fieldName])
      if (peso != null && valor != null) {
        totalPeso += peso
        sumaPonderada += valor * peso
      }
    })
  })
  
  if (totalPeso === 0) return null
  return sumaPonderada / totalPeso
}

const filteredRows = computed(() => {
  if (!rows.value || rows.value.length === 0) return []
  const start = startDate.value ? new Date(`${startDate.value}T00:00:00`) : null
  const end = endDate.value ? new Date(`${endDate.value}T23:59:59`) : null
  const ne = selectedNe.value ? String(selectedNe.value) : ''

  return rows.value.filter(row => {
    if (ne && getRowNeDisplay(row) !== ne) return false
    const d = parseRowDate(row)
    if (!d) return false
    if (start && d < start) return false
    if (end && d > end) return false
    return true
  })
})

const baselineStats = computed(() => {
  const list = filteredRows.value
  if (!list.length) return {}

  const baseline = {}
  const titleValues = list.map(r => parseNumber(r.Titulo)).filter(v => v != null)
  baseline.Titulo = titleValues.length ? titleValues.reduce((a, b) => a + b, 0) / titleValues.length : null

  for (const opt of metricOptions) {
    const values = list.map(r => parseNumber(r[opt.key])).filter(v => v != null)
    baseline[opt.key] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  }
  
  // Calcular baseline HVI (promedio ponderado de todos los lotes del período)
  const allLotes = [...new Set(list.map(r => r.Lote).filter(l => l))]
  for (const opt of hviOptions) {
    baseline[opt.key] = calcHviWeightedAvg(allLotes, opt.key)
  }

  return baseline
})

const standardTitleNumber = computed(() => {
  const n = parseNumber(standardTitleInput.value)
  if (n != null) return n
  const fromNeRaw = selectedNe.value ? parseStandardTitleFromNe(selectedNe.value) : null
  const fromNe = fromNeRaw != null ? parseNumber(fromNeRaw) : null
  return fromNe != null ? fromNe : null
})

watch(selectedNe, value => {
  const parsed = parseStandardTitleFromNe(value)
  if (parsed != null) {
    standardTitleInput.value = parsed
  }
})

const weeklyRows = computed(() => {
  const list = filteredRows.value
  if (!list.length) return []

  const groups = new Map()
  list.forEach(row => {
    const d = parseRowDate(row)
    if (!d) return
    const { year, week } = getISOWeekInfo(d)
    const key = `${year}-W${week}`
    if (!groups.has(key)) {
      groups.set(key, { key, year, week, dates: [], rows: [] })
    }
    const entry = groups.get(key)
    entry.dates.push(d)
    entry.rows.push(row)
  })

  const baseline = baselineStats.value
  const standard = standardTitleNumber.value

  const calcAvg = (rows, key) => {
    const values = rows.map(r => parseNumber(r[key])).filter(v => v != null)
    if (!values.length) return null
    return values.reduce((a, b) => a + b, 0) / values.length
  }

  const calcDevTitle = (avg, standard) => {
    if (avg == null || standard == null || standard === 0) return null
    return ((standard - avg) / standard) * 100
  }

  const calcDevMetric = (avg, base) => {
    if (avg == null || base == null || base === 0) return null
    return ((avg - base) / base) * 100
  }

  const results = []
  groups.forEach(group => {
    const datesSorted = group.dates.slice().sort((a, b) => a - b)
    const monthName = datesSorted.length ? monthNames[datesSorted[0].getMonth()] : ''
    const tituloAvg = calcAvg(group.rows, 'Titulo')
    
    // Si no hay Ne seleccionado (Todos), usar el promedio global como referencia
    // Si hay Ne seleccionado, usar el standard (manual o extraído del Ne)
    const referenceTitle = selectedNe.value ? standard : baseline.Titulo
    const tituloDev = referenceTitle != null ? calcDevTitle(tituloAvg, referenceTitle) : null

    const metricKeys = selectedMetricKeys.value
    const metrics = metricKeys.map(key => {
      const avg = calcAvg(group.rows, key)
      const base = baseline[key]
      const dev = calcDevMetric(avg, base)
      return {
        avgRaw: avg,
        devRaw: dev,
        avg: formatNumber(avg, 2),
        dev: formatNumber(dev, 1)
      }
    })

    // Calcular métricas HVI (promedio ponderado por peso)
    const weekLotes = [...new Set(group.rows.map(r => r.Lote).filter(l => l))]
    const hviKeys = selectedHviKeys.value
    const hviMetrics = hviKeys.map(key => {
      const avg = calcHviWeightedAvg(weekLotes, key)
      const base = baseline[key]
      const dev = calcDevMetric(avg, base)
      return {
        avgRaw: avg,
        devRaw: dev,
        avg: formatNumber(avg, 2),
        dev: formatNumber(dev, 1)
      }
    })

    results.push({
      key: group.key,
      year: group.year,
      week: group.week,
      month: monthName,
      neDisplay: selectedNe.value ? String(selectedNe.value) : 'Todos',
      standardTitle: standard != null ? formatNumber(standard, 2) : '—',
      tituloAvgRaw: tituloAvg,
      tituloDevRaw: tituloDev,
      tituloAvg: formatNumber(tituloAvg, 2),
      tituloDev: formatNumber(tituloDev, 1),
      hviMetricA: hviMetrics[0],
      hviMetricB: hviMetrics[1],
      hviMetricC: hviMetrics[2],
      metricA: metrics[0],
      metricB: metrics[1],
      metricC: metrics[2],
      metricD: metrics[3]
    })
  })

  return results.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    return a.week - b.week
  })
})

const exportToExcel = async () => {
  if (!weeklyRows.value.length) return

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'STC Dashboard'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet('Resumen Semanal')
  worksheet.pageSetup = {
    paperSize: 9,
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 }
  }

  const headers = [
    'Mes',
    'Semana',
    'Ne',
    'Ne Promedio',
    'Desv %',
    ...selectedHviKeys.value.flatMap(key => [key, 'Desv %']),
    ...selectedMetricKeys.value.flatMap(key => [key, 'Desv %'])
  ]

  worksheet.addRow(headers)

  headers.forEach((_, idx) => {
    const col = worksheet.getColumn(idx + 1)
    col.width = idx === 0 ? 9 : idx === 2 ? 10 : 11
  })

  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    }
  })

  weeklyRows.value.forEach(row => {
    const hviMetrics = [row.hviMetricA, row.hviMetricB, row.hviMetricC]
    const hviValues = hviMetrics.flatMap(metric => [
      metric.avgRaw,
      metric.devRaw
    ])

    const metrics = [row.metricA, row.metricB, row.metricC, row.metricD]
    const metricValues = metrics.flatMap(metric => [
      metric.avgRaw,
      metric.devRaw
    ])

    worksheet.addRow([
      formatMonthYear(row.month, row.year),
      row.week,
      row.neDisplay,
      row.tituloAvgRaw,
      row.tituloDevRaw,
      ...hviValues,
      ...metricValues
    ])
  })

  const lastRow = worksheet.rowCount
  for (let i = 2; i <= lastRow; i += 1) {
    const row = worksheet.getRow(i)
    row.alignment = { vertical: 'middle', horizontal: 'center' }
    row.getCell(2).numFmt = '0'
    row.getCell(4).numFmt = '0.00'
    row.getCell(5).numFmt = '0.0'
    
    // Aplicar formato a columnas HVI (3 métricas × 2 columnas cada una = 6 columnas)
    for (let hviIdx = 0; hviIdx < selectedHviKeys.value.length; hviIdx++) {
      const colIndex = 6 + (hviIdx * 2) // Columna HVI valor
      const devColIndex = colIndex + 1 // Columna HVI desvío
      row.getCell(colIndex).numFmt = '0.00'
      row.getCell(devColIndex).numFmt = '0.0'
    }
    
    // Aplicar formato a columnas USTER/TENSOR (después de las HVI)
    const hviColumnsCount = selectedHviKeys.value.length * 2
    for (let metricIdx = 0; metricIdx < selectedMetricKeys.value.length; metricIdx++) {
      const metricKey = selectedMetricKeys.value[metricIdx]
      const colIndex = 6 + hviColumnsCount + (metricIdx * 2) // Columna de la métrica
      const devColIndex = colIndex + 1 // Columna del desvío
      
      // Formato especial para "Fuerza B" y "Trabajo B" (valores mayores a 999)
      if (metricKey === 'Fuerza B' || metricKey === 'Trabajo B') {
        row.getCell(colIndex).numFmt = '#,##0.00'
      } else {
        row.getCell(colIndex).numFmt = '0.00'
      }
      row.getCell(devColIndex).numFmt = '0.0'
    }
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: lastRow, column: headers.length }
  }

  worksheet.views = [{ state: 'frozen', ySplit: 1 }]

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  const now = new Date()
  const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '')
  const from = startDate.value || 'inicio'
  const to = endDate.value || 'fin'
  link.href = url
  link.download = `Resumen_Semanal_Hilanderia_${from}_${to}_${hhmmss}.xlsx`
  link.click()
  window.URL.revokeObjectURL(url)
}

async function loadRows() {
  loading.value = true
  try {
    const allDataFetched = await fetchAllStatsData()
    const parArr = Array.isArray(allDataFetched.usterPar) ? allDataFetched.usterPar : []
    const tblArr = Array.isArray(allDataFetched.usterTbl) ? allDataFetched.usterTbl : []
    const tensorTblArr = Array.isArray(allDataFetched.tensorapidTbl) ? allDataFetched.tensorapidTbl : []
    const tensorParArr = Array.isArray(allDataFetched.tensorapidPar) ? allDataFetched.tensorapidPar : []
    const calidadFibraArr = Array.isArray(allDataFetched.calidadFibra) ? allDataFetched.calidadFibra : []

    const tblByTestnr = new Map()
    tblArr.forEach(row => {
      const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
      if (testnr) {
        if (!tblByTestnr.has(testnr)) tblByTestnr.set(testnr, [])
        tblByTestnr.get(testnr).push(row)
      }
    })

    const tensorTblByTestnr = new Map()
    tensorTblArr.forEach(row => {
      const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
      if (testnr) {
        if (!tensorTblByTestnr.has(testnr)) tensorTblByTestnr.set(testnr, [])
        tensorTblByTestnr.get(testnr).push(row)
      }
    })

    const tensorParByUster = new Map()
    tensorParArr.forEach(row => {
      const usterTestnr = String(row.USTER_TESTNR ?? row.uster_testnr ?? row.usterTestnr ?? '')
      if (!usterTestnr) return
      if (!tensorParByUster.has(usterTestnr)) tensorParByUster.set(usterTestnr, [])
      tensorParByUster.get(usterTestnr).push(row)
    })

    // Mapa de calidad fibra por LOTE_FIAC
    const calidadFibraByLote = new Map()
    calidadFibraArr.forEach(row => {
      const loteFiacRaw = String(row.LOTE_FIAC ?? row.lote_fiac ?? '')
      if (!loteFiacRaw) return
      
      // Convertir a número para eliminar ceros a la izquierda: "0000000104" → "104"
      const loteFiac = String(parseInt(loteFiacRaw, 10))
      
      if (loteFiac && loteFiac !== 'NaN') {
        if (!calidadFibraByLote.has(loteFiac)) calidadFibraByLote.set(loteFiac, [])
        calidadFibraByLote.get(loteFiac).push(row)
      }
    })
    
    // Guardar en scope global para uso en weeklyRows
    window.calidadFibraByLote = calidadFibraByLote

    const calcAvg = (rows, field) => {
      const values = rows
        .map(r => r[field])
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(v => Number(String(v).replace(',', '.')))
        .filter(n => !isNaN(n))

      if (values.length === 0) return ''
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      return Number(avg.toFixed(2)).toString()
    }

    const data = parArr.map(row => {
      const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
      const tblRows = tblByTestnr.get(testnr) || []

      let tensorPar = null
      if (tensorParByUster.has(testnr)) {
        const list = tensorParByUster.get(testnr)
        tensorPar = list.slice().sort((a, b) => {
          const da = new Date(a.TIME_STAMP || a.time_stamp || 0)
          const db = new Date(b.TIME_STAMP || b.time_stamp || 0)
          return db - da
        })[0]
      }

      let tensorTblRows = []
      if (tensorPar && tensorPar.TESTNR) {
        tensorTblRows = tensorTblByTestnr.get(String(tensorPar.TESTNR)) || []
      }

      const timeStampRaw = row.TIME_STAMP || row.TIME || row.TIMESTAMP || row.CREATED_AT || row.created_at || null
      let timeStamp = null
      if (timeStampRaw) {
        if (timeStampRaw instanceof Date) {
          timeStamp = timeStampRaw
        } else if (typeof timeStampRaw === 'string') {
          const match = timeStampRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/) 
          if (match) {
            const day = parseInt(match[1], 10)
            const month = parseInt(match[2], 10) - 1
            let year = parseInt(match[3], 10)
            if (year < 100) year += 2000
            const hour = match[4] ? parseInt(match[4], 10) : 0
            const minute = match[5] ? parseInt(match[5], 10) : 0
            const second = match[6] ? parseInt(match[6], 10) : 0
            timeStamp = new Date(year, month, day, hour, minute, second)
          } else {
            timeStamp = new Date(timeStampRaw)
          }
        } else {
          timeStamp = new Date(timeStampRaw)
        }
      }

      const neValue = row.NOMCOUNT ?? row.Ne ?? row.NE ?? row.titulo ?? row.TITULO ?? ''
      const matclass = row.MATCLASS ?? row.matclass ?? row.Matclass ?? row.MatClass ?? null
      const ne = formatNe(neValue, matclass)
      
      const loteRaw = row.LOTE ?? row.Lote ?? row.lote ?? ''
      const loteNumero = formatLote(loteRaw)

      return {
        Ensayo: testnr,
        TIME_STAMP: timeStamp,
        Ne: ne,
        Lote: loteNumero,
        Titulo: calcAvg(tblRows, 'TITULO'),
        'CVm %': calcAvg(tblRows, 'CVM_PERCENT') || calcAvg(tblRows, 'CVM_%'),
        'Delg -30%': calcAvg(tblRows, 'DELG_MINUS30_KM') || calcAvg(tblRows, 'DELG_-30%'),
        'Delg -40%': calcAvg(tblRows, 'DELG_MINUS40_KM') || calcAvg(tblRows, 'DELG_-40%'),
        'Delg -50%': calcAvg(tblRows, 'DELG_MINUS50_KM') || calcAvg(tblRows, 'DELG_-50%'),
        'Grue +35%': calcAvg(tblRows, 'GRUE_35_KM') || calcAvg(tblRows, 'GRUE_+35%'),
        'Grue +50%': calcAvg(tblRows, 'GRUE_50_KM') || calcAvg(tblRows, 'GRUE_+50%'),
        'Neps +140%': calcAvg(tblRows, 'NEPS_140_KM') || calcAvg(tblRows, 'NEPS_+140%'),
        'Neps +280%': calcAvg(tblRows, 'NEPS_280_KM') || calcAvg(tblRows, 'NEPS_+280%'),
        'Fuerza B': calcAvg(tensorTblRows, 'FUERZA_B'),
        'Elong. %': calcAvg(tensorTblRows, 'ELONGACION'),
        'Tenac.': calcAvg(tensorTblRows, 'TENACIDAD'),
        'Trabajo B': calcAvg(tensorTblRows, 'TRABAJO')
      }
    })

    rows.value = data.filter(r => r.TIME_STAMP)

    if (rows.value.length > 0) {
      const dates = rows.value.map(r => r.TIME_STAMP).filter(d => d instanceof Date && !isNaN(d))
      const maxDate = dates.length ? new Date(Math.max(...dates)) : new Date()
      const minDate = dates.length ? new Date(Math.min(...dates)) : new Date()

      if (!endDate.value) endDate.value = formatDateInput(maxDate)
      if (!startDate.value) {
        const start = new Date(maxDate)
        start.setDate(start.getDate() - 90)
        if (start < minDate) startDate.value = formatDateInput(minDate)
        else startDate.value = formatDateInput(start)
      }

      if (!selectedNe.value && availableNes.value.length > 0) {
        selectedNe.value = availableNes.value[0]
      }
    }
  } catch (err) {
    console.error('Error cargando resumen semanal', err)
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el resumen semanal.' })
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadRows()
})
</script>
