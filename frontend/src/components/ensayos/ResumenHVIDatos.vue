<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <div class="flex flex-col gap-2 mb-3 flex-shrink-0">
        <div class="@container flex items-center gap-2 flex-wrap">
          <h3 class="text-lg font-semibold text-slate-800 whitespace-nowrap">Resumen Datos HVI</h3>

          <div class="ml-0 @[900px]:ml-2 flex items-center gap-2">
            <input
              v-model="q"
              type="search"
              placeholder="Buscar..."
              aria-label="Buscar lotes HVI"
              class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-32 @[1150px]:w-auto"
            />
            <button
              v-if="q"
              @click="clearSearch"
              class="inline-flex items-center gap-1 px-2 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md"
            >
              Limpiar
            </button>
          </div>

          <div class="flex-1 flex items-center justify-end gap-2">
            <button
              @click="loadData"
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
        <div v-if="rows.length === 0" class="text-sm text-slate-600 py-8 text-center">No hay datos HVI disponibles.</div>

        <div v-else class="flex-1 min-h-0 flex flex-col">
          <div v-if="filteredRows.length === 0" class="text-sm text-slate-600 mb-4 py-4 text-center bg-slate-50 rounded-lg flex-shrink-0">
            No hay coincidencias para la búsqueda.
          </div>

          <div class="overflow-auto _minimal-scroll w-full flex-1 min-h-0 rounded-xl border border-slate-200 pb-0">
            <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
              <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-20">
                <tr>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Lote</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Proveedor</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Grado</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Fecha</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Tipo</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Cantidad</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Color</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Cort</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Fardo</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">SCI</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">MST</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">MIC</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">MAT</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">UHML</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">UI</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">SF</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">STR</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">ELG</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">RD</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">PLUS B</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">TR CNT</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">TR AR</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">TRID</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in pagedRows"
                  :key="idx"
                  class="border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150"
                >
                  <td class="px-2 py-2 text-center whitespace-nowrap font-semibold">{{ row.lote }}</td>
                  <td class="px-2 py-2 text-center whitespace-nowrap">{{ row.proveedor || '—' }}</td>
                  <td class="px-2 py-2 text-center whitespace-nowrap">{{ row.grado || '—' }}</td>
                  <td class="px-2 py-2 text-center whitespace-nowrap">{{ row.fecha || '—' }}</td>
                  <td class="px-2 py-2 text-center whitespace-nowrap">{{ row.ensayo_tipo || '—' }}</td>
                  <td class="px-2 py-2 text-center">{{ row.cantidad || '—' }}</td>
                  <td class="px-2 py-2 text-center whitespace-nowrap">{{ row.color || '—' }}</td>
                  <td class="px-2 py-2 text-center">{{ row.cort || '—' }}</td>
                  <td class="px-2 py-2 text-center">{{ row.fardo || '—' }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.sci) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.mst) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.mic) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.mat) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.uhml) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.ui) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.sf) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.str) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.elg) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.rd) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.plus_b) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.tr_cnt) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.tr_ar) }}</td>
                  <td class="px-2 py-2 text-center">{{ formatNumber(row.trid) }}</td>
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import Swal from 'sweetalert2'
import ExcelJS from 'exceljs'

const loading = ref(false)
const rows = ref([])
const q = ref('')
const page = ref(1)
const pageSize = ref(25)
const lastLoadedAt = ref('')

function formatNumber(value) {
  if (value === null || value === undefined || value === '') return '—'
  const num = Number(value)
  if (isNaN(num)) return '—'
  return num.toFixed(2)
}

const filteredRows = computed(() => {
  const term = String(q.value || '').trim().toLowerCase()
  if (!term) return rows.value

  return rows.value.filter((row) => {
    return (
      String(row.lote || '').toLowerCase().includes(term) ||
      String(row.proveedor || '').toLowerCase().includes(term) ||
      String(row.grado || '').toLowerCase().includes(term) ||
      String(row.color || '').toLowerCase().includes(term)
    )
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

function clearSearch() {
  q.value = ''
}

async function loadData() {
  loading.value = true
  try {
    const response = await fetch('/api/hvi/ensayos-detalles')
    const data = await response.json()

    if (!response.ok) throw new Error(data?.error || 'No se pudo cargar los datos HVI')

    rows.value = Array.isArray(data?.rows) ? data.rows : []
    lastLoadedAt.value = new Date().toLocaleTimeString('es-AR', { hour12: false })
  } catch (err) {
    console.error('Failed to load HVI data', err)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo cargar los datos HVI.'
    })
  } finally {
    loading.value = false
  }
}

async function exportToExcel() {
  try {
    if (!filteredRows.value.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos',
        text: 'No hay registros para exportar.'
      })
      return
    }

    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('Datos HVI')
    const headers = [
      'Lote',
      'Proveedor',
      'Grado',
      'Fecha',
      'Tipo',
      'Cantidad',
      'Color',
      'Cort',
      'Fardo',
      'SCI',
      'MST',
      'MIC',
      'MAT',
      'UHML',
      'UI',
      'SF',
      'STR',
      'ELG',
      'RD',
      'PLUS_B',
      'TR_CNT',
      'TR_AR',
      'TRID'
    ]

    sheet.columns = headers.map((header) => ({
      header,
      key: header.toLowerCase().replace(/_/g, '_'),
      width: Math.max(12, header.length + 2)
    }))

    filteredRows.value.forEach((row) => {
      const output = {
        lote: row.lote || '',
        proveedor: row.proveedor || '',
        grado: row.grado || '',
        fecha: row.fecha || '',
        tipo: row.ensayo_tipo || '',
        cantidad: row.cantidad || '',
        color: row.color || '',
        cort: row.cort || '',
        fardo: row.fardo || '',
        sci: row.sci ?? '',
        mst: row.mst ?? '',
        mic: row.mic ?? '',
        mat: row.mat ?? '',
        uhml: row.uhml ?? '',
        ui: row.ui ?? '',
        sf: row.sf ?? '',
        str: row.str ?? '',
        elg: row.elg ?? '',
        rd: row.rd ?? '',
        plus_b: row.plus_b ?? '',
        tr_cnt: row.tr_cnt ?? '',
        tr_ar: row.tr_ar ?? '',
        trid: row.trid ?? ''
      }
      sheet.addRow(output)
    })

    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `resumen-hvi-datos-${new Date().toISOString().slice(0, 10)}.xlsx`
    link.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Error exporting HVI data', err)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo exportar los datos HVI.'
    })
  }
}

onMounted(() => {
  loadData()
})
</script>
