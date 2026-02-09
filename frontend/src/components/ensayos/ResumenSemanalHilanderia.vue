<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div class="flex items-center gap-2">
          <span class="text-lg">🧪</span>
          <h3 class="text-lg font-semibold text-slate-800">Resumen Semanal Hilanderia</h3>
        </div>
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
      </div>

      <div class="flex flex-wrap items-end gap-4 mb-3">
        <CustomDatepicker v-model="startDate" label="Desde" :show-buttons="false" />
        <CustomDatepicker v-model="endDate" label="Hasta" :show-buttons="false" />

        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-600 font-medium">Ne</label>
          <select
            v-model="selectedNe"
            class="px-2 py-1 border border-slate-200 rounded-md text-sm text-slate-700 bg-white"
            style="width:10ch;min-width:10ch;max-width:10ch;"
          >
            <option value="">Todos</option>
            <option v-for="ne in availableNes" :key="ne" :value="ne">{{ ne }}</option>
          </select>
        </div>

        <div class="flex items-center gap-2">
          <label class="text-sm text-slate-600 font-medium">Titulo estandar</label>
          <input
            v-model="standardTitleInput"
            type="text"
            inputmode="decimal"
            class="w-24 px-2 py-1 border border-slate-200 rounded-md text-sm text-slate-700"
            placeholder="Ej: 10"
          />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-3">
        <div v-for="(key, idx) in selectedMetricKeys" :key="idx" class="flex items-center gap-2">
          <label class="text-xs text-slate-500 font-semibold uppercase tracking-wide">Columna {{ idx + 1 }}</label>
          <select
            v-model="selectedMetricKeys[idx]"
            class="flex-1 px-2 py-1 border border-slate-200 rounded-md text-sm text-slate-700 bg-white"
          >
            <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
          </select>
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
              <tr>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Año</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Mes</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Semana</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Titulo estandar</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Titulo Ne promedio</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvio %</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                  <select v-model="selectedMetricKeys[0]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvio %</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                  <select v-model="selectedMetricKeys[1]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvio %</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                  <select v-model="selectedMetricKeys[2]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvio %</th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                  <select v-model="selectedMetricKeys[3]" class="w-full bg-transparent text-xs font-semibold text-slate-700">
                    <option v-for="opt in metricOptions" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
                  </select>
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvio %</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in weeklyRows" :key="row.key" class="border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150">
                <td class="px-2 py-2 text-center text-slate-700">{{ row.year }}</td>
                <td class="px-2 py-2 text-center text-slate-700 capitalize">{{ row.month }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.week }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.standardTitle }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.tituloAvg }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ row.tituloDev }}</td>
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
import { fetchAllStatsData } from '../../services/dataService'
import CustomDatepicker from '../CustomDatepicker.vue'

const loading = ref(false)
const rows = ref([])

const startDate = ref('')
const endDate = ref('')
const selectedNe = ref('')
const standardTitleInput = ref('10')

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

function formatNe(nomcount, matclass) {
  if (nomcount == null || nomcount === '') return ''
  let ne = String(nomcount).trim()
  const neNum = parseFloat(ne.replace(',', '.'))
  if (!isNaN(neNum)) {
    ne = String(parseFloat(ne.replace(',', '.')))
  }
  if (matclass && String(matclass).toLowerCase() === 'hilo de fantasia') {
    return `${ne}Flame`
  }
  return ne
}

function formatNumber(val, maxDecimals = 2) {
  if (val == null || !Number.isFinite(val)) return '—'
  const fixed = val.toFixed(maxDecimals)
  const trimmed = fixed.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
  return trimmed.replace('.', ',')
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
    if (row.Ne != null && row.Ne !== '') {
      set.add(String(row.Ne))
    }
  }
  return Array.from(set).sort((a, b) => {
    const na = parseFloat(String(a).replace(',', '.'))
    const nb = parseFloat(String(b).replace(',', '.'))
    if (!isNaN(na) && !isNaN(nb)) return na - nb
    return a.localeCompare(b)
  })
})

const filteredRows = computed(() => {
  if (!rows.value || rows.value.length === 0) return []
  const start = startDate.value ? new Date(`${startDate.value}T00:00:00`) : null
  const end = endDate.value ? new Date(`${endDate.value}T23:59:59`) : null
  const ne = selectedNe.value ? String(selectedNe.value) : ''

  return rows.value.filter(row => {
    if (ne && String(row.Ne || '') !== ne) return false
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

  return baseline
})

const standardTitleNumber = computed(() => {
  const n = parseNumber(standardTitleInput.value)
  if (n != null) return n
  const fromNe = selectedNe.value ? parseNumber(selectedNe.value) : null
  return fromNe != null ? fromNe : null
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
    const tituloDev = standard != null ? calcDevTitle(tituloAvg, standard) : null

    const metricKeys = selectedMetricKeys.value
    const metrics = metricKeys.map(key => {
      const avg = calcAvg(group.rows, key)
      const base = baseline[key]
      return {
        avg: formatNumber(avg, 2),
        dev: formatNumber(calcDevMetric(avg, base), 1)
      }
    })

    results.push({
      key: group.key,
      year: group.year,
      week: group.week,
      month: monthName,
      standardTitle: standard != null ? formatNumber(standard, 2) : '—',
      tituloAvg: formatNumber(tituloAvg, 2),
      tituloDev: formatNumber(tituloDev, 1),
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

async function loadRows() {
  loading.value = true
  try {
    const allDataFetched = await fetchAllStatsData()
    const parArr = Array.isArray(allDataFetched.usterPar) ? allDataFetched.usterPar : []
    const tblArr = Array.isArray(allDataFetched.usterTbl) ? allDataFetched.usterTbl : []
    const tensorTblArr = Array.isArray(allDataFetched.tensorapidTbl) ? allDataFetched.tensorapidTbl : []
    const tensorParArr = Array.isArray(allDataFetched.tensorapidPar) ? allDataFetched.tensorapidPar : []

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
      const ne = formatNe(neValue, row.MATCLASS)

      return {
        Ensayo: testnr,
        TIME_STAMP: timeStamp,
        Ne: ne,
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

watch(selectedNe, (newVal) => {
  if (!newVal) return
  const parsed = parseNumber(newVal)
  if (parsed != null) standardTitleInput.value = String(parsed)
})

onMounted(() => {
  loadRows()
})
</script>
