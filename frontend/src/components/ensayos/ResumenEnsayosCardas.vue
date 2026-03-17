<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <div class="flex flex-col gap-2 mb-3 flex-shrink-0">
        <div class="@container flex items-center gap-2 flex-wrap">
          <h3 class="text-lg font-semibold text-slate-800 whitespace-nowrap">Resumen Ensayos Cardas</h3>

          <div class="ml-0 @[900px]:ml-2 flex items-center gap-2">
            <input
              v-model="q"
              type="search"
              placeholder="Buscar..."
              aria-label="Buscar ensayos cardas"
              class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-32 @[1150px]:w-auto"
            />
            <button
              v-if="q || turnoQuery || tipoQuery || maquinaQuery"
              @click="clearFilters"
              class="inline-flex items-center gap-1 px-2 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md"
            >
              Limpiar
            </button>
          </div>

          <div class="flex-1 flex items-center justify-end gap-2 flex-wrap">
            <div class="flex items-center gap-2 flex-wrap">
              <label class="text-sm text-slate-600">Turno:</label>
              <select v-model="turnoQuery" class="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900 min-w-[80px]">
                <option value="">Todos</option>
                <option v-for="turno in availableTurnos" :key="turno" :value="turno">{{ turno }}</option>
              </select>

              <label class="text-sm text-slate-600">Tipo:</label>
              <select v-model="tipoQuery" class="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900 min-w-[160px]">
                <option value="">Todos</option>
                <option v-for="tipo in availableTipos" :key="tipo" :value="tipo">{{ tipo }}</option>
              </select>

              <label class="text-sm text-slate-600">Maq.:</label>
              <select v-model="maquinaQuery" class="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900 min-w-[90px]">
                <option value="">Todas</option>
                <option v-for="maquina in availableMaquinas" :key="maquina" :value="maquina">{{ maquina }}</option>
              </select>
            </div>

            <button
              @click="loadRows"
              class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md"
            >
              Refrescar
            </button>

            <button
              @click="exportToExcel"
              class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md"
            >
              Exportar
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between text-xs text-slate-500">
          <div>{{ filteredRows.length }} ensayos visibles de {{ rows.length }}</div>
          <div v-if="rows.length">Actualizado: {{ lastLoadedAt }}</div>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-slate-600 py-8 text-center flex-1">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
        <p class="mt-2">Cargando...</p>
      </div>

      <div v-else class="flex-1 min-h-0 flex flex-col">
        <div v-if="rows.length === 0" class="text-sm text-slate-600 py-8 text-center">No hay ensayos CARDAS guardados.</div>

        <div v-else class="flex-1 min-h-0 flex flex-col">
          <div v-if="filteredRows.length === 0" class="text-sm text-slate-600 mb-4 py-4 text-center bg-slate-50 rounded-lg flex-shrink-0">
            No hay coincidencias para los filtros.
          </div>

          <div class="overflow-auto _minimal-scroll w-full flex-1 min-h-0 rounded-xl border border-slate-200 pb-0">
            <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
              <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-20">
                <tr>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Ensayo</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Fecha</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Hora</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Turno</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Lote</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Maq.</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Tipo</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Ne</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Tit. Prom</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Tit. Desv</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Tit. CV %</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">U %</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">CVm %</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">CVm 1m</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">CVm 3m</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">CVm 10m</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Tit. Uster</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Tit. Rel %</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in pagedRows"
                  :key="idx"
                  class="border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150 cursor-pointer"
                  @click="openDetail(row)"
                >
                  <td class="px-2 py-2 text-center">{{ row.Ensayo }}</td>
                  <td class="px-2 py-2 text-center whitespace-nowrap">{{ row.Fecha }}</td>
                  <td class="px-2 py-2 text-center whitespace-nowrap">{{ row.Hora }}</td>
                  <td class="px-2 py-2 text-center font-semibold">{{ row.Turno }}</td>
                  <td class="px-2 py-2 text-center">{{ row.Lote }}</td>
                  <td class="px-2 py-2 text-center">{{ row.Maq }}</td>
                  <td class="px-2 py-2 text-center">{{ row.Tipo }}</td>
                  <td class="px-2 py-2 text-center">{{ row.Ne }}</td>
                  <td class="px-2 py-2 text-center">{{ row['Tit. Prom'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['Tit. Desv'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['Tit. CV %'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['U %'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['CVm %'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['CVm 1m'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['CVm 3m'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['CVm 10m'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['Tit. Uster'] }}</td>
                  <td class="px-2 py-2 text-center">{{ row['Tit. Rel %'] }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="flex items-center justify-between mt-3 flex-shrink-0 gap-3 flex-wrap">
            <div class="text-xs text-slate-500">
              Mostrando {{ startDisplay }}-{{ endDisplay }} de {{ filteredRows.length }}
            </div>

            <div class="flex items-center gap-2 text-sm">
              <label class="text-slate-600">Filas:</label>
              <select v-model.number="pageSize" class="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900">
                <option :value="25">25</option>
                <option :value="50">50</option>
                <option :value="100">100</option>
                <option :value="0">Todas</option>
              </select>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1" class="px-2 py-1 border border-slate-200 rounded-lg disabled:opacity-40">Anterior</button>
              <span class="text-slate-600">{{ page }} / {{ totalPages }}</span>
              <button @click="page = Math.min(totalPages, page + 1)" :disabled="page >= totalPages" class="px-2 py-1 border border-slate-200 rounded-lg disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <div v-if="detailVisible" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" @click.self="closeDetail">
      <div class="w-full max-w-6xl max-h-[92vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div>
            <div class="text-lg font-semibold text-slate-800">Ensayo {{ detailRow?.Ensayo || '—' }}</div>
            <div class="text-xs text-slate-500">{{ detailRow?.FechaHora || '' }} · Maq. {{ detailRow?.Maq || '—' }} · {{ detailRow?.Tipo || '—' }}</div>
          </div>
          <button @click="closeDetail" class="px-3 py-1 border border-slate-200 rounded-lg text-sm hover:bg-slate-100">Cerrar</button>
        </div>

        <div class="flex-1 min-h-0 overflow-auto p-4 space-y-4">
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3"><span class="font-semibold">Catalogo:</span> {{ detailRow?.Catalogo || '—' }}</div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3"><span class="font-semibold">Lote:</span> {{ detailRow?.Lote || '—' }}</div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3"><span class="font-semibold">Laboratorista:</span> {{ detailRow?.Laboratorista || '—' }}</div>
            <div class="bg-slate-50 border border-slate-200 rounded-lg p-3"><span class="font-semibold">Style:</span> {{ detailRow?.Style || '—' }}</div>
          </div>

          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800">Titulos de Cinta</div>
            <div class="p-4 grid grid-cols-2 lg:grid-cols-6 gap-3 text-sm">
              <div class="bg-white border border-slate-200 rounded-lg p-3"><span class="font-semibold">Titulo 1:</span> {{ detailTitulos[0] ?? '—' }}</div>
              <div class="bg-white border border-slate-200 rounded-lg p-3"><span class="font-semibold">Titulo 2:</span> {{ detailTitulos[1] ?? '—' }}</div>
              <div class="bg-white border border-slate-200 rounded-lg p-3"><span class="font-semibold">Titulo 3:</span> {{ detailTitulos[2] ?? '—' }}</div>
              <div class="bg-white border border-slate-200 rounded-lg p-3"><span class="font-semibold">Prom:</span> {{ detailRow?.['Tit. Prom'] || '—' }}</div>
              <div class="bg-white border border-slate-200 rounded-lg p-3"><span class="font-semibold">Desv:</span> {{ detailRow?.['Tit. Desv'] || '—' }}</div>
              <div class="bg-white border border-slate-200 rounded-lg p-3"><span class="font-semibold">CV %:</span> {{ detailRow?.['Tit. CV %'] || '—' }}</div>
            </div>
          </div>

          <div class="rounded-xl border border-slate-200 overflow-hidden">
            <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 text-sm font-semibold text-slate-800">Detalle TBL</div>
            <div class="overflow-auto max-h-[45vh]">
              <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
                <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10">
                  <tr>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">Seq</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">No</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">U %</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">CVm %</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">CVm 1m</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">CVm 3m</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">CVm 10m</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">Tit. Uster</th>
                    <th class="px-2 py-2 text-center font-semibold text-slate-700">Tit. Rel %</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in detailTblRows" :key="row.SEQNO" class="border-t border-slate-100">
                    <td class="px-2 py-2 text-center">{{ row.SEQNO }}</td>
                    <td class="px-2 py-2 text-center">{{ row.NO_ }}</td>
                    <td class="px-2 py-2 text-center">{{ row.U_PERCENT }}</td>
                    <td class="px-2 py-2 text-center">{{ row.CVM_PERCENT }}</td>
                    <td class="px-2 py-2 text-center">{{ row.CVM_1M_PERCENT }}</td>
                    <td class="px-2 py-2 text-center">{{ row.CVM_3M_PERCENT }}</td>
                    <td class="px-2 py-2 text-center">{{ row.CVM_10M_PERCENT }}</td>
                    <td class="px-2 py-2 text-center">{{ row.TITULO_MACHINE }}</td>
                    <td class="px-2 py-2 text-center">{{ row.TITULO_REL_PERC }}</td>
                  </tr>
                  <tr v-if="!detailTblRows.length">
                    <td colspan="9" class="px-3 py-6 text-center text-slate-500">Sin detalle TBL.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import ExcelJS from 'exceljs'

const loading = ref(false)
const rows = ref([])
const allTblRows = ref([])
const q = ref('')
const turnoQuery = ref('')
const tipoQuery = ref('')
const maquinaQuery = ref('')
const page = ref(1)
const pageSize = ref(25)
const lastLoadedAt = ref('')

const detailVisible = ref(false)
const detailRow = ref(null)
const detailTblRows = ref([])
const detailTitulos = ref([])

function parseDateFromRaw(value) {
  if (value == null || value === '') return null
  const raw = String(value).trim()

  if (/^\d+$/.test(raw)) {
    const numeric = Number(raw)
    if (!Number.isFinite(numeric)) return null
    const date = new Date(raw.length >= 13 ? numeric : numeric * 1000)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (match) {
    let year = Number(match[3])
    if (year < 100) year += 2000
    const date = new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0))
    return Number.isNaN(date.getTime()) ? null : date
  }

  const parsed = Date.parse(raw)
  if (Number.isNaN(parsed)) return null
  const date = new Date(parsed)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date) {
  if (!date) return '—'
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  return `${dd}/${mm}/${yy}`
}

function formatTime(date) {
  if (!date) return '—'
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mi}`
}

function formatDateTime(date) {
  if (!date) return '—'
  return `${formatDate(date)} ${formatTime(date)}`
}

function getTurnoFromDate(date) {
  if (!date) return ''
  const h = date.getHours()
  if (h >= 6 && h <= 13) return 'A'
  if (h >= 14 && h <= 21) return 'B'
  return 'C'
}

function toNumber(value) {
  if (value == null || value === '') return null
  const normalized = String(value).replace(',', '.').replace(/[^0-9.+\-eE]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatMetric(value, decimals = 2) {
  const number = toNumber(value)
  if (number == null) return '—'
  return Number(number.toFixed(decimals)).toString()
}

function calcAvg(rows, field) {
  const values = (rows || []).map((r) => toNumber(r[field])).filter((n) => n != null)
  if (!values.length) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

function formatMachine(value) {
  if (value == null || value === '') return '—'
  const raw = String(value).trim()
  const numeric = Number.parseInt(raw.replace(/\D+/g, ''), 10)
  return Number.isFinite(numeric) ? String(numeric).padStart(3, '0') : raw
}

function machineSortValue(value) {
  const numeric = Number.parseInt(String(value || '').replace(/\D+/g, ''), 10)
  return Number.isFinite(numeric) ? numeric : Number.MAX_SAFE_INTEGER
}

const availableTurnos = computed(() => [...new Set(rows.value.map((r) => r.Turno).filter(Boolean))].sort())
const availableTipos = computed(() => [...new Set(rows.value.map((r) => r.Tipo).filter(Boolean))].sort((a, b) => a.localeCompare(b)))
const availableMaquinas = computed(() => {
  return [...new Set(rows.value.map((r) => r.Maq).filter(Boolean))].sort((a, b) => machineSortValue(a) - machineSortValue(b))
})

const searchFields = ['Ensayo', 'Fecha', 'Hora', 'Turno', 'Lote', 'Maq', 'Tipo', 'Ne', 'Catalogo', 'Laboratorista', 'Style']

const filteredRows = computed(() => {
  const term = String(q.value || '').trim().toLowerCase()
  const parts = term ? term.split(/\s+/).filter(Boolean) : []

  return (rows.value || []).filter((row) => {
    const textMatch = !parts.length || parts.every((part) => {
      return searchFields.some((field) => String(row[field] ?? '').toLowerCase().includes(part))
    })

    const turnoMatch = !turnoQuery.value || row.Turno === turnoQuery.value
    const tipoMatch = !tipoQuery.value || row.Tipo === tipoQuery.value
    const maquinaMatch = !maquinaQuery.value || row.Maq === maquinaQuery.value

    return textMatch && turnoMatch && tipoMatch && maquinaMatch
  })
})

const totalPages = computed(() => {
  if (pageSize.value === 0) return 1
  return Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value))
})

const pagedRows = computed(() => {
  if (pageSize.value === 0) return filteredRows.value
  const start = (page.value - 1) * pageSize.value
  return filteredRows.value.slice(start, start + pageSize.value)
})

const startDisplay = computed(() => {
  if (!filteredRows.value.length) return 0
  if (pageSize.value === 0) return 1
  return (page.value - 1) * pageSize.value + 1
})

const endDisplay = computed(() => {
  if (!filteredRows.value.length) return 0
  if (pageSize.value === 0) return filteredRows.value.length
  return Math.min(filteredRows.value.length, page.value * pageSize.value)
})

watch([filteredRows, pageSize], () => {
  page.value = 1
})

function clearFilters() {
  q.value = ''
  turnoQuery.value = ''
  tipoQuery.value = ''
  maquinaQuery.value = ''
}

async function openDetail(row) {
  detailRow.value = row
  detailTblRows.value = (allTblRows.value || []).filter((r) => String(r.TESTNR) === String(row.Ensayo))
  detailTitulos.value = []
  detailVisible.value = true

  try {
    const response = await fetch(`/api/uster-cardas/titulos?testnr=${encodeURIComponent(row.Ensayo)}`)
    const data = await response.json()
    detailTitulos.value = Array.isArray(data?.rows) ? data.rows.map((r) => formatMetric(r.TITULO, 3)) : []
  } catch {
    detailTitulos.value = []
  }
}

function closeDetail() {
  detailVisible.value = false
  detailRow.value = null
  detailTblRows.value = []
  detailTitulos.value = []
}

async function loadRows() {
  loading.value = true
  try {
    const [parResponse, tblResponse] = await Promise.all([
      fetch('/api/uster-cardas/par'),
      fetch('/api/uster-cardas/tbl'),
    ])

    const parData = await parResponse.json()
    const tblData = await tblResponse.json()

    if (!parResponse.ok) throw new Error(parData?.error || 'No se pudo cargar PAR CARDAS')
    if (!tblResponse.ok) throw new Error(tblData?.error || 'No se pudo cargar TBL CARDAS')

    const parRows = Array.isArray(parData?.rows) ? parData.rows : []
    const tblRows = Array.isArray(tblData?.rows) ? tblData.rows : []
    allTblRows.value = tblRows

    const tblByTestnr = new Map()
    for (const row of tblRows) {
      const testnr = String(row.TESTNR || '')
      if (!testnr) continue
      if (!tblByTestnr.has(testnr)) tblByTestnr.set(testnr, [])
      tblByTestnr.get(testnr).push(row)
    }

    const data = parRows.map((row) => {
      const testnr = String(row.TESTNR || '')
      const date = parseDateFromRaw(row.TIME_STAMP)
      const tblList = tblByTestnr.get(testnr) || []

      return {
        Ensayo: testnr,
        FechaHora: formatDateTime(date),
        Fecha: formatDate(date),
        Hora: formatTime(date),
        _timeMs: date ? date.getTime() : 0,
        Turno: getTurnoFromDate(date),
        Lote: row.LOTE || '—',
        Maq: formatMachine(row.MASCHNR),
        Tipo: row.MACHINE_FAMILY || '—',
        Ne: formatMetric(row.NOMCOUNT, 2),
        Catalogo: row.CATALOG || '—',
        Laboratorista: row.LABORANT || '—',
        Style: row.STYLE || '—',
        'Tit. Prom': formatMetric(row.TITULO_AVG, 3),
        'Tit. Desv': formatMetric(row.TITULO_STDDEV, 4),
        'Tit. CV %': formatMetric(row.TITULO_CV, 2),
        'U %': formatMetric(calcAvg(tblList, 'U_PERCENT'), 2),
        'CVm %': formatMetric(calcAvg(tblList, 'CVM_PERCENT'), 2),
        'CVm 1m': formatMetric(calcAvg(tblList, 'CVM_1M_PERCENT'), 2),
        'CVm 3m': formatMetric(calcAvg(tblList, 'CVM_3M_PERCENT'), 2),
        'CVm 10m': formatMetric(calcAvg(tblList, 'CVM_10M_PERCENT'), 2),
        'Tit. Uster': formatMetric(calcAvg(tblList, 'TITULO_MACHINE'), 3),
        'Tit. Rel %': formatMetric(calcAvg(tblList, 'TITULO_REL_PERC'), 2),
      }
    })

    data.sort((a, b) => {
      // Ordenar por fecha/hora (descendente - más recientes primero) para agrupar rondas
      if (b._timeMs !== a._timeMs) return b._timeMs - a._timeMs
      // Dentro de la misma ronda (fecha/hora), ordenar por máquina (ascendente)
      return machineSortValue(a.Maq) - machineSortValue(b.Maq)
    })

    rows.value = data
    lastLoadedAt.value = formatDateTime(new Date())
  } catch (err) {
    console.error('Failed to load cardas summary', err)
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el resumen CARDAS.' })
  } finally {
    loading.value = false
  }
}

async function exportToExcel() {
  try {
    if (!filteredRows.value.length) {
      Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay registros para exportar.' })
      return
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Resumen Cardas')
    const headers = ['Ensayo', 'Fecha', 'Hora', 'Turno', 'Lote', 'Maq', 'Tipo', 'Ne', 'Tit. Prom', 'Tit. Desv', 'Tit. CV %', 'U %', 'CVm %', 'CVm 1m', 'CVm 3m', 'CVm 10m', 'Tit. Uster', 'Tit. Rel %', 'Catalogo', 'Laboratorista', 'Style']

    sheet.columns = headers.map((header) => ({ header, key: header, width: Math.max(12, header.length + 2) }))
    filteredRows.value.forEach((row) => {
      const output = {}
      headers.forEach((header) => {
        output[header] = row[header] ?? ''
      })
      sheet.addRow(output)
    })

    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `resumen-cardas-${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error exporting cardas summary', err)
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar el resumen CARDAS.' })
  }
}

onMounted(() => {
  loadRows()
})
</script>