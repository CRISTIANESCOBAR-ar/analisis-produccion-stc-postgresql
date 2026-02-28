<template>
  <div class="w-full h-screen flex flex-col p-1 relative">
    <!-- Loading Overlay -->
    <div v-if="loading" class="fixed inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-[9999] transition-all duration-300">
      <div class="bg-white rounded-2xl shadow-2xl px-8 py-6 flex flex-col items-center gap-3">
        <svg class="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
        <p class="text-gray-700 font-medium">Generando informe...</p>
        <p class="text-gray-400 text-sm">Consultando datos del mes</p>
      </div>
    </div>

    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <!-- Header con navegación -->
      <div class="flex justify-between items-center mb-4 gap-4">
        <h1 class="text-2xl font-bold text-gray-800">Informe STC Diario</h1>

        <!-- Navegación de fecha -->
        <div class="flex items-center gap-2">
          <button @click="previousMonth" class="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors" title="Mes anterior">
            ≪
          </button>
          <button @click="previousDay" class="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors" title="Día anterior">
            ‹
          </button>
          <input
            type="date"
            v-model="selectedDate"
            @change="loadData"
            class="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button @click="nextDay" class="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors" title="Día siguiente">
            ›
          </button>
          <button @click="nextMonth" class="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors" title="Mes siguiente">
            ≫
          </button>
          <button @click="goToYesterday" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            Ayer
          </button>
          <button @click="loadData" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
            ↻ Actualizar
          </button>
          <button @click="exportToExcel" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-2">
            📊 Exportar Excel
          </button>
        </div>
      </div>

      <!-- Información del mes -->
      <div class="mb-3 flex items-center gap-4 text-sm">
        <span class="font-semibold text-gray-700">Mes: {{ monthName }} {{ year }}</span>
        <span class="text-gray-600">Día seleccionado: {{ formatDate(selectedDate) }}</span>
        <span class="text-gray-600">Días del mes: {{ daysInMonth }}</span>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && hasLoadedOnce && daysData.length === 0" class="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
        <span class="text-5xl">📊</span>
        <p class="text-lg font-semibold text-gray-600">No hay datos para este período</p>
        <p class="text-sm">No se encontraron datos de producción para el mes seleccionado.</p>
        <button @click="loadData" class="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Actualizar</button>
      </div>

      <!-- Tabla de datos -->
      <div v-else class="flex-1 overflow-auto border border-gray-200 rounded-lg">
        <table class="min-w-full divide-y divide-gray-200 text-xs">
          <colgroup>
            <col style="width: 60px;"> <!-- Día -->
            <!-- INDIGO -->
            <col style="width: 70px;" span="6">
            <!-- TECELAGEM -->
            <col style="width: 70px;" span="8">
            <!-- ACABAMENTO -->
            <col style="width: 70px;" span="3">
            <!-- CALIDAD -->
            <col style="width: 70px;" span="7">
          </colgroup>

          <thead class="sticky top-0 z-10">
            <!-- Fila 1: Sectores -->
            <tr style="background-color: #2563eb;">
              <th style="background-color: #2563eb; color: white;" class="px-2 py-2 text-center font-bold border-r border-blue-500"></th>
              <th colspan="6" style="background-color: #2563eb; color: white;" class="px-2 py-2 text-center font-bold border-r border-blue-500">INDIGO</th>
              <th colspan="8" style="background-color: #2563eb; color: white;" class="px-2 py-2 text-center font-bold border-r border-blue-500">TECELAGEM</th>
              <th colspan="3" style="background-color: #2563eb; color: white;" class="px-2 py-2 text-center font-bold border-r border-blue-500">ACABAMENTO</th>
              <th colspan="7" style="background-color: #2563eb; color: white;" class="px-2 py-2 text-center font-bold">CALIDAD</th>
            </tr>

            <!-- Fila 2: Columnas -->
            <tr class="bg-gray-100">
              <th class="px-2 py-2 text-center font-semibold text-gray-700 border-r">Día</th>

              <!-- INDIGO -->
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Efic.%</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Produc.</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Meta</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Saldo</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Meta Ajust.</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700 border-r">Veloc.</th>

              <!-- TECELAGEM -->
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Telares</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Batidas</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">RPM</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Efic.%</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Produc.</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Meta</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Saldo</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700 border-r">Meta Ajust.</th>

              <!-- ACABAMENTO -->
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Produc.</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Meta</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700 border-r">Saldo</th>

              <!-- CALIDAD -->
              <th class="px-2 py-2 text-center font-semibold text-gray-700">1ª Qual.%</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Pts/100m²</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Produc.</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Meta</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Saldo</th>
              <th class="px-2 py-2 text-center font-semibold text-gray-700">Meta Ajust.</th>
            </tr>
          </thead>

          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="day in daysData" :key="day.dayNumber"
                :class="day.hasData ? 'hover:bg-blue-50' : 'bg-gray-50'"
                class="transition-colors">
              <td class="px-2 py-1 text-center font-medium text-gray-900 border-r">
                {{ day.dayLabel }}
              </td>

              <!-- INDIGO -->
              <td class="px-2 py-1 text-right" :class="getCellClass(day.indigo?.eficiencia)">
                {{ formatNumber(day.indigo?.eficiencia, 1) }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatNumber(day.indigo?.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(day.indigo?.meta, 0) }}</td>
              <td class="px-2 py-1 text-right" :class="getSaldoClass(day.indigo?.saldo)">
                {{ formatNumber(day.indigo?.saldo, 0) }}
              </td>
              <td class="px-2 py-1 text-right text-blue-700 font-medium">
                {{ formatNumber(day.indigo?.metaAjustada, 0) }}
              </td>
              <td class="px-2 py-1 text-right border-r">{{ formatNumber(day.indigo?.velocidad, 1) }}</td>

              <!-- TECELAGEM -->
              <td class="px-2 py-1 text-right">{{ formatTelares(day.tecelagem?.telares) }}</td>
              <td class="px-2 py-1 text-right">{{ formatNumber(day.tecelagem?.batidas, 1) }}</td>
              <td class="px-2 py-1 text-right">{{ formatNumber(day.tecelagem?.rpm, 0) }}</td>
              <td class="px-2 py-1 text-right" :class="getCellClass(day.tecelagem?.eficiencia)">
                {{ formatNumber(day.tecelagem?.eficiencia, 1) }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatNumber(day.tecelagem?.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(day.tecelagem?.meta, 0) }}</td>
              <td class="px-2 py-1 text-right" :class="getSaldoClass(day.tecelagem?.saldo)">
                {{ formatNumber(day.tecelagem?.saldo, 0) }}
              </td>
              <td class="px-2 py-1 text-right text-blue-700 font-medium border-r">
                {{ formatNumber(day.tecelagem?.metaAjustada, 0) }}
              </td>

              <!-- ACABAMENTO -->
              <td class="px-2 py-1 text-right">{{ formatNumber(day.acabamento?.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(day.acabamento?.meta, 0) }}</td>
              <td class="px-2 py-1 text-right border-r" :class="getSaldoClass(day.acabamento?.saldo)">
                {{ formatNumber(day.acabamento?.saldo, 0) }}
              </td>

              <!-- CALIDAD -->
              <td class="px-2 py-1 text-right" :class="getCellClass(day.acabamento?.primeraCalidad)">
                {{ formatNumber(day.acabamento?.primeraCalidad, 2) }}
              </td>
              <td class="px-2 py-1 text-right">{{ formatNumber(day.calidad?.puntos100m2, 2) }}</td>
              <td class="px-2 py-1 text-right">{{ formatNumber(day.calidad?.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(day.calidad?.meta, 0) }}</td>
              <td class="px-2 py-1 text-right" :class="getSaldoClass(day.calidad?.saldo)">
                {{ formatNumber(day.calidad?.saldo, 0) }}
              </td>
              <td class="px-2 py-1 text-right text-blue-700 font-medium">
                {{ formatNumber(day.calidad?.metaAjustada, 0) }}
              </td>
            </tr>
          </tbody>

          <!-- TOTALES -->
          <tfoot>
            <tr class="bg-blue-50 font-bold border-t-2 border-blue-600">
              <td class="px-2 py-2 text-left">TOTAL</td>
              <!-- INDIGO -->
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right">{{ formatNumber(totales.indigo.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(totales.indigo.meta, 0) }}</td>
              <td class="px-2 py-1 text-right" :class="getSaldoClass(totales.indigo.saldo)">
                {{ formatNumber(totales.indigo.saldo, 0) }}
              </td>
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right border-r"></td>

              <!-- TECELAGEM -->
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right">{{ formatNumber(totales.tecelagem.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(totales.tecelagem.meta, 0) }}</td>
              <td class="px-2 py-1 text-right" :class="getSaldoClass(totales.tecelagem.saldo)">
                {{ formatNumber(totales.tecelagem.saldo, 0) }}
              </td>
              <td class="px-2 py-1 text-right border-r"></td>

              <!-- ACABAMENTO -->
              <td class="px-2 py-1 text-right">{{ formatNumber(totales.acabamento.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(totales.acabamento.meta, 0) }}</td>
              <td class="px-2 py-1 text-right border-r" :class="getSaldoClass(totales.acabamento.saldo)">
                {{ formatNumber(totales.acabamento.saldo, 0) }}
              </td>

              <!-- CALIDAD -->
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right"></td>
              <td class="px-2 py-1 text-right">{{ formatNumber(totales.calidad.produccion, 0) }}</td>
              <td class="px-2 py-1 text-right text-gray-600">{{ formatNumber(totales.calidad.meta, 0) }}</td>
              <td class="px-2 py-1 text-right" :class="getSaldoClass(totales.calidad.saldo)">
                {{ formatNumber(totales.calidad.saldo, 0) }}
              </td>
              <td class="px-2 py-1 text-right"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ExcelJS from 'exceljs'
import { useErrorHandler } from '@/composables/useErrorHandler'
import { useNotifications } from '@/composables/useNotifications'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

// Composables
const { handleError, tryCatch } = useErrorHandler()
const notifications = useNotifications()

const selectedDate = ref('')
const loading = ref(false)
const daysData = ref([])
const hasLoadedOnce = ref(false)

// Computed properties
const year = computed(() => new Date(selectedDate.value).getFullYear())
const month = computed(() => new Date(selectedDate.value).getMonth())

const monthName = computed(() => {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return months[month.value]
})

const daysInMonth = computed(() => new Date(year.value, month.value + 1, 0).getDate())

// Totales
const totales = computed(() => {
  const result = {
    indigo: { produccion: 0, meta: 0, saldo: 0 },
    tecelagem: { produccion: 0, meta: 0, saldo: 0 },
    acabamento: { produccion: 0, meta: 0, saldo: 0 },
    calidad: { produccion: 0, meta: 0, saldo: 0 }
  }

  daysData.value.forEach(day => {
    result.indigo.produccion += day.indigo?.produccion || 0
    result.indigo.meta += day.indigo?.meta || 0
    result.tecelagem.produccion += day.tecelagem?.produccion || 0
    result.tecelagem.meta += day.tecelagem?.meta || 0
    result.acabamento.produccion += day.acabamento?.produccion || 0
    result.acabamento.meta += day.acabamento?.meta || 0
    result.calidad.produccion += day.calidad?.produccion || 0
    result.calidad.meta += day.calidad?.meta || 0
  })

  result.indigo.saldo = result.indigo.produccion - result.indigo.meta
  result.tecelagem.saldo = result.tecelagem.produccion - result.tecelagem.meta
  result.acabamento.saldo = result.acabamento.produccion - result.acabamento.meta
  result.calidad.saldo = result.calidad.produccion - result.calidad.meta

  return result
})

// Funciones de navegación
function goToYesterday() {
  const now = new Date()
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const y = yesterday.getFullYear()
  const m = String(yesterday.getMonth() + 1).padStart(2, '0')
  const d = String(yesterday.getDate()).padStart(2, '0')
  selectedDate.value = `${y}-${m}-${d}`
  loadData()
}

function previousDay() {
  const date = new Date(selectedDate.value)
  date.setDate(date.getDate() - 1)
  selectedDate.value = date.toISOString().split('T')[0]
  loadData()
}

function nextDay() {
  const date = new Date(selectedDate.value)
  date.setDate(date.getDate() + 1)
  selectedDate.value = date.toISOString().split('T')[0]
  loadData()
}

function previousMonth() {
  const [yr, mo] = selectedDate.value.split('-').map(Number)
  let newYear = yr
  let newMonth = mo - 1
  if (newMonth === 0) { newMonth = 12; newYear-- }
  const lastDay = new Date(newYear, newMonth, 0).getDate()
  selectedDate.value = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  loadData()
}

function nextMonth() {
  const [yr, mo] = selectedDate.value.split('-').map(Number)
  let newYear = yr
  let newMonth = mo + 1
  if (newMonth === 13) { newMonth = 1; newYear++ }
  const lastDay = new Date(newYear, newMonth, 0).getDate()
  selectedDate.value = `${newYear}-${String(newMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  loadData()
}

// Cargar datos
async function loadData() {
  loading.value = true

  const result = await tryCatch(async () => {
    const res = await fetch(`${API_URL}/informe-diario?fecha=${selectedDate.value}`)
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || `Error HTTP ${res.status}`)
    }
    return res.json()
  }, 'Cargar Informe Diario')

  if (result) {
    daysData.value = result.days || []
  }

  hasLoadedOnce.value = true
  loading.value = false
}

// Formateo
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  const fixed = num.toFixed(decimals)
  const [integerPart, decimalPart] = fixed.split('.')
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decimals > 0 ? `${formattedInteger},${decimalPart}` : formattedInteger
}

function formatTelares(value) {
  if (value === null || value === undefined || value === '') return '-'
  const num = Number(value)
  if (isNaN(num)) return '-'
  if (Math.abs(num - Math.round(num)) < 0.01) return formatNumber(num, 0)
  return formatNumber(num, 1)
}

function getCellClass(value) {
  if (!value) return ''
  if (value >= 80) return 'bg-green-100 text-green-800 font-semibold'
  if (value >= 60) return 'bg-yellow-100 text-yellow-800'
  if (value < 60) return 'bg-red-100 text-red-800'
  return ''
}

function getSaldoClass(value) {
  if (!value) return ''
  if (value > 0) return 'text-green-700 font-semibold'
  if (value < 0) return 'text-red-700 font-semibold'
  return ''
}


// Exportar a Excel — formato idéntico a Informe_STC.xlsx
async function exportToExcel() {
  if (!daysData.value || daysData.value.length === 0) {
    notifications.warning('No hay datos para exportar')
    return
  }

  try {
    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Produccion STC')

    /* ─── Colour constants ─── */
    const C_NAVY   = 'FF001C62'
    const C_WHITE  = 'FFFFFFFF'
    const C_BLACK  = 'FF000000'
    const C_INDIGO = 'FF91DFFB'
    const C_TECEL  = 'FFFFFF99'
    const C_ACAB   = 'FFA9D08E'

    const mkFill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
    const fillNavy   = mkFill(C_NAVY)
    const fillIndigo = mkFill(C_INDIGO)
    const fillTecel  = mkFill(C_TECEL)
    const fillAcab   = mkFill(C_ACAB)
    const FONT = (opts = {}) => ({ name: 'Calibri', size: 11, ...opts })

    const SCOLS = 26  // A–Z (26 columns matching reference)
    const dim = daysInMonth.value
    const ac = { horizontal: 'center', vertical: 'middle' }

    /* Sector fill by column number */
    const sFill = (c) => {
      if (c >= 2 && c <= 7) return fillIndigo    // INDIGO
      if (c >= 8 && c <= 17) return fillTecel    // TECELAGEM
      if (c >= 18 && c <= 20) return fillAcab    // ACABAMENTO
      return null                                 // CALIDAD = sin relleno
    }

    /* Borders by column — medium at sector boundaries */
    const bdr = (c) => {
      const b = { top: { style: 'thin' }, bottom: { style: 'thin' } }
      b.left  = (c === 2 || c === 8 || c === 18) ? { style: 'medium' } : { style: 'thin' }
      b.right = (c === 7 || c === 20) ? { style: 'medium' } : { style: 'thin' }
      return b
    }

    /* ── Column widths (from reference) ── */
    const widths = [9.86, 9.71, 9.71, 14, 9.71, 10.86, 7.14,
      7.29, 8.14, 6.86, 9.71, 10.29, 13.43, 6.14, 10.29, 10.29, 10.29,
      10, 10, 13.29, 9.71, 7.57, 11.29, 9.71, 10.29, 9.71]
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w })

    /* ═══════ ROW 1  — TITLE BAR  ═══════ */
    ws.mergeCells(1, 1, 1, SCOLS)
    const r1c = ws.getCell('A1')
    r1c.value = `Producción de Indigo, Tejeduría, Acabado y Revisión Denim. ${monthName.value} ${year.value}`
    r1c.font = FONT({ size: 15, bold: true, color: { argb: C_WHITE } })
    r1c.fill = fillNavy
    r1c.alignment = ac
    r1c.border = { bottom: { style: 'medium' } }
    ws.getRow(1).height = 20.25

    /* ═══════ ROW 2  — METAS  ═══════ */
    const r2 = ws.getRow(2)
    r2.height = 23.25
    const mBold = FONT({ bold: true, color: { argb: C_BLACK } })
    const mVal  = FONT({ color: { argb: C_BLACK } })

    // Apply sector fills + bottom border to all cells in row 2
    for (let c = 1; c <= SCOLS; c++) {
      const cell = r2.getCell(c)
      const sf = sFill(c)
      if (sf) cell.fill = sf
      cell.alignment = ac
      cell.border = { bottom: { style: 'medium' } }
    }
    // INDIGO meta
    r2.getCell(2).value = 'Metas Indigo';   r2.getCell(2).font = mBold
    r2.getCell(4).value = totales.value.indigo.meta
    r2.getCell(4).numFmt = '#,##0';          r2.getCell(4).font = mVal
    // TECELAGEM meta
    r2.getCell(12).value = 'Meta Tejeduría'; r2.getCell(12).font = mBold
    r2.getCell(13).value = totales.value.tecelagem.meta
    r2.getCell(13).numFmt = '#,##0';         r2.getCell(13).font = mVal
    // ACABAMENTO meta
    r2.getCell(19).value = 'Meta Acabado';   r2.getCell(19).font = mBold
    r2.getCell(20).value = totales.value.acabamento.meta
    r2.getCell(20).numFmt = '#,##0';         r2.getCell(20).font = mVal
    // CALIDAD meta
    r2.getCell(24).value = 'Meta Revisión';  r2.getCell(24).font = mBold
    ws.mergeCells(2, 25, 2, 26)
    r2.getCell(25).value = totales.value.calidad.meta
    r2.getCell(25).numFmt = '#,##0';         r2.getCell(25).font = mVal

    /* ═══════ ROW 3  — COLUMN HEADERS  ═══════ */
    ws.getRow(3).height = 37.5
    const hdr = [
      'Dia', 'Eficiencia diaria', 'Produc.', 'Meta Diaria', 'Saldo',
      'Meta Ajustada', 'Veloc Média',
      'Telares produc.', 'Batidas', 'RPM', 'Eficiencia diaria', 'Produc.',
      'Meta Diaria', 'Dias', 'Saldo', 'Meta Ajustada', 'Produc. Encerrada',
      'Produc.', 'Meta Diaria', 'Saldo',
      '1ª Qual.', 'Pontos\n/100m²', 'Produção', 'Meta Diária', 'Saldo', 'Meta Ajustada'
    ]
    hdr.forEach((h, i) => {
      const col = i + 1
      const cell = ws.getRow(3).getCell(col)
      cell.value = h
      cell.font = FONT({ italic: true, color: { argb: C_BLACK } })
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      const sf = sFill(col)
      if (sf) cell.fill = sf
      cell.border = bdr(col)
    })

    /* ═══════ DATA ROWS (4 … 4+dim−1) ═══════ */
    const DR = 4

    // Compute "Dias" countdown (remaining working days)
    const sampleMeta = daysData.value.find(d => d.tecelagem?.meta > 0)?.tecelagem?.meta
    const workDays = sampleMeta > 0 ? Math.round(totales.value.tecelagem.meta / sampleMeta) : dim
    let diasCtr = workDays

    daysData.value.forEach((day, idx) => {
      const rn = DR + idx
      const row = ws.getRow(rn)
      row.height = 15.95

      /* helper — set cell with sector style */
      const sc = (col, val, fmt, italic) => {
        const cell = row.getCell(col)
        if (val != null) cell.value = val
        if (fmt && val != null) cell.numFmt = fmt
        cell.font = FONT(italic ? { italic: true } : {})
        cell.alignment = ac
        const sf = sFill(col)
        if (sf) cell.fill = sf
        cell.border = bdr(col)
      }

      // Col A: Día (Date object → formatted)
      const dt = new Date(year.value, month.value, day.dayNumber)
      const cA = row.getCell(1)
      cA.value = dt
      cA.numFmt = 'dd- ddd'
      cA.font = FONT({ italic: true })
      cA.alignment = { horizontal: 'left', vertical: 'middle' }
      cA.border = { left: { style: 'thin' }, bottom: { style: 'thin' } }

      // Default fill + border for all data cells (even if empty)
      for (let c = 2; c <= SCOLS; c++) {
        const cell = row.getCell(c)
        cell.font = FONT()
        cell.alignment = ac
        const sf = sFill(c)
        if (sf) cell.fill = sf
        cell.border = bdr(c)
      }

      /* ── INDIGO (cols 2-7) — NOT italic ── */
      const ind = day.indigo
      if (ind) {
        sc(2, ind.eficiencia, '0.0')
        sc(3, ind.produccion, '#,##0')
        sc(4, ind.meta, '#,##0')
        sc(5, ind.saldo != null ? ind.saldo : null, '#,##0_ ;-#,##0 ')
        sc(6, ind.metaAjustada, '#,##0')
        sc(7, ind.velocidad, '0.0')
      }

      /* ── TECELAGEM (cols 8-17) — mostly italic ── */
      const tel = day.tecelagem
      if (tel) {
        sc(8,  tel.telares, '0', true)
        sc(9,  tel.batidas, '0.00', true)
        sc(10, tel.rpm, '#,##0', true)
        sc(11, tel.eficiencia, '0.0', true)
        sc(12, tel.produccion, '#,##0', true)
        sc(13, tel.meta, '#,##0')                    // not italic
        if (tel.produccion > 0 || tel.meta > 0) {
          sc(14, diasCtr, '#,##0')                   // Dias countdown
          diasCtr--
        }
        sc(15, tel.saldo != null ? tel.saldo : null, '#,##0_ ;-#,##0 ')
        sc(16, tel.metaAjustada, '#,##0', true)
        // col 17 = Produc. Encerrada — data not available yet
      }

      /* ── ACABAMENTO (cols 18-20) — NOT italic ── */
      const ab = day.acabamento
      if (ab) {
        sc(18, ab.produccion, '#,##0')
        sc(19, ab.meta, '#,##0')
        sc(20, ab.saldo != null ? ab.saldo : null, '#,##0_ ;[Red]-#,##0 ')
      }

      /* ── CALIDAD (cols 21-26) — NOT italic, no sector fill ── */
      sc(21, day.acabamento?.primeraCalidad ?? null, '0.00')
      sc(22, day.calidad?.puntos100m2 ?? null, '#,##0.00')
      sc(23, day.calidad?.produccion ?? null, '#,##0')
      sc(24, day.calidad?.meta ?? null, '#,##0')
      sc(25, day.calidad?.saldo != null ? day.calidad.saldo : null, '#,##0_ ;[Red]-#,##0 ')
      sc(26, day.calidad?.metaAjustada ?? null, '#,##0')
    })

    /* ═══════ TOTALS ROW  ═══════ */
    const tRn = DR + dim
    const tr = ws.getRow(tRn)
    tr.height = 15.95
    const t = totales.value
    const bF = FONT({ bold: true, color: { argb: C_BLACK } })

    const setT = (col, val, fmt, fontOverride) => {
      const c = tr.getCell(col)
      if (val != null) c.value = val
      if (fmt && val != null) c.numFmt = fmt
      c.font = fontOverride || bF
      c.alignment = ac
    }

    // Averages
    const dI = daysData.value.filter(d => d.indigo?.eficiencia > 0)
    const avgEfI = dI.length ? dI.reduce((s, d) => s + d.indigo.eficiencia, 0) / dI.length : null

    const vD = daysData.value.filter(d => d.indigo?.velocidad > 0 && d.indigo?.produccion > 0)
    const avgVel = vD.length
      ? vD.reduce((s, d) => s + d.indigo.velocidad * d.indigo.produccion, 0) / vD.reduce((s, d) => s + d.indigo.produccion, 0) : null

    const tD = daysData.value.filter(d => d.tecelagem?.telares > 0)
    const avgTel = tD.length ? tD.reduce((s, d) => s + d.tecelagem.telares, 0) / tD.length : null

    const bD = daysData.value.filter(d => d.tecelagem?.batidas > 0 && d.tecelagem?.produccion > 0)
    const avgBat = bD.length
      ? bD.reduce((s, d) => s + d.tecelagem.batidas * d.tecelagem.produccion, 0) / bD.reduce((s, d) => s + d.tecelagem.produccion, 0) : null

    const rD = daysData.value.filter(d => d.tecelagem?.rpm > 0 && d.tecelagem?.produccion > 0)
    const avgRpm = rD.length
      ? rD.reduce((s, d) => s + d.tecelagem.rpm * d.tecelagem.produccion, 0) / rD.reduce((s, d) => s + d.tecelagem.produccion, 0) : null

    const eT = daysData.value.filter(d => d.tecelagem?.eficiencia > 0)
    const avgEfT = eT.length ? eT.reduce((s, d) => s + d.tecelagem.eficiencia, 0) / eT.length : null

    const qD = daysData.value.filter(d => d.acabamento?.primeraCalidad > 0 && d.calidad?.produccion > 0)
    const avgQ = qD.length
      ? qD.reduce((s, d) => s + d.acabamento.primeraCalidad * d.calidad.produccion, 0) / qD.reduce((s, d) => s + d.calidad.produccion, 0) : null

    const pD = daysData.value.filter(d => d.calidad?.puntos100m2 > 0 && d.calidad?.produccion > 0)
    const avgP = pD.length
      ? pD.reduce((s, d) => s + d.calidad.puntos100m2 * d.calidad.produccion, 0) / pD.reduce((s, d) => s + d.calidad.produccion, 0) : null

    // INDIGO totals
    setT(2, avgEfI, '0.0')
    setT(3, t.indigo.produccion, '#,##0')
    setT(4, t.indigo.meta, '#,##0')
    setT(5, t.indigo.saldo, '#,##0_ ;[Red]-#,##0 ')
    setT(7, avgVel, '0.0')

    // TECELAGEM totals
    setT(8, avgTel, '#,##0')
    setT(9, avgBat, '#,##0.00')
    setT(10, avgRpm, '#,##0')
    setT(11, avgEfT, '0.0', FONT({ italic: true }))  // italic, NOT bold
    setT(12, t.tecelagem.produccion, '#,##0')
    setT(13, t.tecelagem.meta, '#,##0')
    setT(15, t.tecelagem.saldo, '#,##0_ ;[Red]-#,##0 ')

    // ACABAMENTO totals
    setT(18, t.acabamento.produccion, '#,##0')
    setT(19, t.acabamento.meta, '#,##0')
    setT(20, t.acabamento.saldo, '#,##0_ ;-#,##0 ')

    // CALIDAD totals
    setT(21, avgQ, '0.00')
    setT(22, avgP, '#,##0.00')
    setT(23, t.calidad.produccion, '#,##0')
    setT(24, t.calidad.meta, '#,##0')
    setT(25, t.calidad.saldo, '#,##0_ ;-#,##0 ')

    /* ═══════ DOWNLOAD  ═══════ */
    const fecha = selectedDate.value.replace(/-/g, '')
    const now = new Date()
    const ts = [now.getHours(), now.getMinutes(), now.getSeconds()]
      .map(v => String(v).padStart(2, '0')).join('')

    const buffer = await wb.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Informe_STC_${fecha}_${ts}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)

    notifications.success('Excel exportado correctamente')
  } catch (error) {
    handleError(error, 'Exportar Excel')
  }
}

onMounted(() => {
  goToYesterday()
})
</script>

<style scoped>
table {
  border-collapse: separate;
  border-spacing: 0;
}

thead th {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: white;
}

td.border-r,
th.border-r {
  border-right: 2px solid #cbd5e1;
}
</style>
