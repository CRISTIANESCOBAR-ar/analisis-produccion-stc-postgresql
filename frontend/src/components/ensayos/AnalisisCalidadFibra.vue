<template>
  <div class="flex flex-col h-full overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 p-4">
    <!-- Header unificado -->
    <div class="flex items-center justify-between gap-4 mb-4 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm border border-slate-200 relative z-[100]">
      <!-- Título -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <span class="text-xl">🧬</span>
        <h1 class="text-lg font-bold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
          Análisis Calidad Fibra
        </h1>
      </div>
      
      <!-- Barra separadora -->
      <div class="h-6 w-px bg-slate-300 flex-shrink-0"></div>
      
      <!-- Radio buttons para agrupación -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <label class="text-sm font-semibold text-slate-700">Agrupación:</label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            v-model="groupMode"
            value="detailed"
            class="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
          />
          <span class="text-sm text-slate-700">MISTURA + SEQ</span>
        </label>
        <label class="flex items-center gap-1.5 cursor-pointer">
          <input
            type="radio"
            v-model="groupMode"
            value="aggregated"
            class="w-3.5 h-3.5 text-emerald-600 focus:ring-emerald-500"
          />
          <span class="text-sm text-slate-700">Solo MISTURA</span>
        </label>
      </div>

      <!-- Barra separadora -->
      <div class="h-6 w-px bg-slate-300 flex-shrink-0"></div>

      <!-- Datepickers -->
      <div class="flex items-center gap-3 flex-shrink-0">
        <CustomDatepicker v-model="startDate" label="Desde" :show-buttons="false" />
        <CustomDatepicker v-model="endDate" label="Hasta" :show-buttons="false" />
      </div>
      
      <!-- Botones de acción -->
      <div class="flex items-center gap-2 ml-auto flex-shrink-0">
        <button
          @click="loadData"
          :disabled="loading"
          v-tippy="{ content: 'Refrescar datos', placement: 'bottom' }"
          class="w-9 h-9 flex items-center justify-center bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
        >
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-3-6.7" stroke-linecap="round" stroke-linejoin="round"></path>
            <polyline points="21 3 21 9 15 9" stroke-linecap="round" stroke-linejoin="round"></polyline>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
        </button>
        
        <button
          @click="exportToExcel"
          :disabled="loading || filteredRows.length === 0"
          v-tippy="{ content: 'Exportar a Excel', placement: 'bottom' }"
          class="w-9 h-9 flex items-center justify-center bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
        >
          <span class="text-lg">📊</span>
        </button>
      </div>
    </div>

    <!-- Tabla -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <p class="text-slate-600">Cargando datos...</p>
      </div>
    </div>

    <div v-else-if="filteredRows.length === 0" class="flex-1 flex items-center justify-center">
      <p class="text-slate-600 text-sm">No hay datos para el rango seleccionado.</p>
    </div>

    <div v-else class="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-md">
      <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
        <thead class="bg-gradient-to-r from-emerald-50 to-teal-50 sticky top-0 z-[5]">
          <tr>
            <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200">Fecha/Hora</th>
            <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200">MISTURA</th>
            <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200">
              {{ groupMode === 'detailed' ? 'SEQ' : 'SEQ Count' }}
            </th>
            <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b-2 border-b-slate-200">LOTE_FIAC</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">SCI</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">MST</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">MIC</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">MAT</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">UHML</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">UI</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">SF</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">STR</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">ELG</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">RD</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">+b</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">TIPO</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">TrCNT</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">TrAR</th>
            <th class="px-3 py-2 text-center font-semibold text-emerald-700 border-b-2 border-b-slate-200">TRID</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in filteredRows"
            :key="row.key"
            class="border-t border-slate-100 hover:bg-emerald-50/30 transition-colors duration-150"
          >
            <td class="px-3 py-2 text-center text-slate-700 text-xs">{{ row.fechaHora }}</td>
            <td class="px-3 py-2 text-center text-slate-700 font-medium">{{ row.mistura }}</td>
            <td class="px-3 py-2 text-center text-slate-700">{{ row.seq }}</td>
            <td class="px-3 py-2 text-center text-slate-700">{{ row.loteFiac }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.SCI }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.MST }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.MIC }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.MAT }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.UHML }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.UI }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.SF }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.STR }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.ELG }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.RD }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.PLUS_B }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.TIPO }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.TRCNT }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.TRAR }}</td>
            <td class="px-3 py-2 text-center text-emerald-700">{{ row.TRID }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { fetchCalidadFibra } from '../../services/dataService'
import ExcelJS from 'exceljs'
import CustomDatepicker from '../CustomDatepicker.vue'

const loading = ref(false)
const groupMode = ref('detailed') // 'detailed' o 'aggregated'
const startDate = ref('')
const endDate = ref('')
const rawData = ref([])

// Función para quitar ceros a la izquierda
const removeLeadingZeros = (value) => {
  if (!value) return ''
  const num = parseInt(String(value), 10)
  return isNaN(num) ? value : String(num)
}

// Función para parsear fecha en formato DD/MM/YYYY
const parseDate = (dateStr) => {
  if (!dateStr) return null
  const parts = String(dateStr).split('/')
  if (parts.length !== 3) return null
  // DD/MM/YYYY -> YYYY-MM-DD
  const [day, month, year] = parts
  const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
  return isNaN(date.getTime()) ? null : date
}

// Función para formatear fecha y hora
const formatDateTime = (fecha, hora) => {
  if (!fecha) return '—'
  const date = parseDate(fecha)
  if (!date) return '—'
  
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = String(date.getFullYear()).slice(-2)
  
  let timeStr = '00:00'
  if (hora) {
    // Manejar diferentes formatos de hora
    let horaStr = String(hora).trim()
    
    // Si ya tiene formato HH:MM, usarlo directamente
    if (horaStr.includes(':')) {
      const parts = horaStr.split(':')
      const hh = parts[0].padStart(2, '0')
      const mm = (parts[1] || '00').padStart(2, '0')
      timeStr = `${hh}:${mm}`
    } else {
      // Si es número, convertir (ej: 205 -> 02:05, 2005 -> 20:05)
      horaStr = horaStr.padStart(4, '0')
      const hh = horaStr.slice(0, 2)
      const mm = horaStr.slice(2, 4)
      timeStr = `${hh}:${mm}`
    }
  }
  
  return `${day}/${month}/${year} ${timeStr}`
}

// Función para parsear números en formato europeo (1.234,56 -> 1234.56)
const parseEuropeanNumber = (str) => {
  if (!str) return 0
  // Remover puntos de miles y reemplazar coma decimal por punto
  const normalized = String(str).replace(/\./g, '').replace(',', '.')
  return parseFloat(normalized)
}

// Función para calcular promedio ponderado
const calcWeightedAvg = (records, field) => {
  let totalPeso = 0
  let sumaPonderada = 0
  
  records.forEach(rec => {
    const peso = parseEuropeanNumber(rec.PESO)
    const valor = parseEuropeanNumber(rec[field])
    if (!isNaN(peso) && !isNaN(valor) && peso > 0 && valor !== 0) {
      totalPeso += peso
      sumaPonderada += valor * peso
    }
  })
  
  if (totalPeso === 0) return '—'
  const avg = sumaPonderada / totalPeso
  return avg.toFixed(2)
}

// Función para obtener el valor más común o concatenar múltiples
const getTipoValue = (records) => {
  if (!records || records.length === 0) return '—'
  const tipos = records.map(r => r.TIPO).filter(t => t)
  if (tipos.length === 0) return '—'
  
  // Obtener el más frecuente
  const freq = {}
  tipos.forEach(t => freq[t] = (freq[t] || 0) + 1)
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0]
}

// Datos filtrados y agrupados
const filteredRows = computed(() => {
  console.log('🔄 Recalculando filteredRows...')
  console.log('📊 rawData.value.length:', rawData.value.length)
  console.log('📅 startDate:', startDate.value, 'endDate:', endDate.value)
  console.log('🔧 groupMode:', groupMode.value)
  
  if (!rawData.value || rawData.value.length === 0) return []
  
  // Filtrar por fechas si están definidas
  let filtered = rawData.value
  if (startDate.value || endDate.value) {
    filtered = filtered.filter(row => {
      const fecha = parseDate(row.DT_ENTRADA_PROD)
      if (!fecha) return false
      
      if (startDate.value) {
        const desde = new Date(startDate.value)
        desde.setHours(0, 0, 0, 0)
        if (fecha < desde) return false
      }
      if (endDate.value) {
        const hasta = new Date(endDate.value)
        hasta.setHours(23, 59, 59, 999)
        if (fecha > hasta) return false
      }
      return true
    })
  }
  
  console.log('✅ Después del filtro de fechas:', filtered.length, 'registros')
  if (filtered.length > 0) {
    console.log('📦 Primer registro filtrado:', filtered[0])
  }
  
  if (groupMode.value === 'detailed') {
    console.log('📋 Modo DETALLADO: agrupando por MISTURA + SEQ')
    // Modo detallado: agrupar por MISTURA + SEQ
    const groups = new Map()
    
    filtered.forEach(row => {
      // Manejar casos donde MISTURA o SEQ no existen
      if (!row.MISTURA || !row.SEQ) {
        console.warn('⚠️ Registro sin MISTURA o SEQ:', row)
        return
      }
      
      const mistura = removeLeadingZeros(row.MISTURA)
      const seq = removeLeadingZeros(row.SEQ)
      const key = `${mistura}_${seq}`
      
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(row)
    })
    
    console.log('🗂️ Grupos MISTURA+SEQ creados:', groups.size)
    const results = []
    groups.forEach((records, key) => {
      const firstRecord = records[0]
      const mistura = removeLeadingZeros(firstRecord.MISTURA)
      const seq = removeLeadingZeros(firstRecord.SEQ)
      
      // Obtener LOTE_FIAC únicos
      const lotes = [...new Set(records.map(r => removeLeadingZeros(r.LOTE_FIAC)).filter(l => l))]
      
      results.push({
        key,
        fechaHora: formatDateTime(firstRecord.DT_ENTRADA_PROD, firstRecord.HR_ENTRADA_PROD),
        mistura,
        seq,
        loteFiac: lotes.join(', ') || '—',
        SCI: calcWeightedAvg(records, 'SCI'),
        MST: calcWeightedAvg(records, 'MST'),
        MIC: calcWeightedAvg(records, 'MIC'),
        MAT: calcWeightedAvg(records, 'MAT'),
        UHML: calcWeightedAvg(records, 'UHML'),
        UI: calcWeightedAvg(records, 'UI'),
        SF: calcWeightedAvg(records, 'SF'),
        STR: calcWeightedAvg(records, 'STR'),
        ELG: calcWeightedAvg(records, 'ELG'),
        RD: calcWeightedAvg(records, 'RD'),
        PLUS_B: calcWeightedAvg(records, 'PLUS_B'),
        TIPO: getTipoValue(records),
        TRCNT: calcWeightedAvg(records, 'TRCNT'),
        TRAR: calcWeightedAvg(records, 'TRAR'),
        TRID: calcWeightedAvg(records, 'TRID')
      })
    })
    
    console.log('✅ Resultados modo detallado:', results.length)
    // Ordenar por MISTURA y SEQ
    return results.sort((a, b) => {
      const mistA = parseInt(a.mistura) || 0
      const mistB = parseInt(b.mistura) || 0
      if (mistA !== mistB) return mistA - mistB
      const seqA = parseInt(a.seq) || 0
      const seqB = parseInt(b.seq) || 0
      return seqA - seqB
    })
    
  } else {
    console.log('📊 Modo AGREGADO: agrupando solo por MISTURA')
    // Modo agregado: agrupar solo por MISTURA
    const groups = new Map()
    
    filtered.forEach(row => {
      // Manejar casos donde MISTURA no existe
      if (!row.MISTURA) {
        console.warn('⚠️ Registro sin MISTURA:', row)
        return
      }
      
      const mistura = removeLeadingZeros(row.MISTURA)
      if (!groups.has(mistura)) groups.set(mistura, [])
      groups.get(mistura).push(row)
    })
    
    console.log('🗂️ Grupos MISTURA creados:', groups.size)
    const results = []
    groups.forEach((records, mistura) => {
      const firstRecord = records[0]
      
      // Contar SEQ únicos
      const seqUnicos = new Set(records.map(r => removeLeadingZeros(r.SEQ)).filter(s => s))
      
      // Obtener LOTE_FIAC únicos
      const lotes = [...new Set(records.map(r => removeLeadingZeros(r.LOTE_FIAC)).filter(l => l))]
      
      results.push({
        key: mistura,
        fechaHora: formatDateTime(firstRecord.DT_ENTRADA_PROD, firstRecord.HR_ENTRADA_PROD),
        mistura,
        seq: seqUnicos.size,
        loteFiac: lotes.join(', ') || '—',
        SCI: calcWeightedAvg(records, 'SCI'),
        MST: calcWeightedAvg(records, 'MST'),
        MIC: calcWeightedAvg(records, 'MIC'),
        MAT: calcWeightedAvg(records, 'MAT'),
        UHML: calcWeightedAvg(records, 'UHML'),
        UI: calcWeightedAvg(records, 'UI'),
        SF: calcWeightedAvg(records, 'SF'),
        STR: calcWeightedAvg(records, 'STR'),
        ELG: calcWeightedAvg(records, 'ELG'),
        RD: calcWeightedAvg(records, 'RD'),
        PLUS_B: calcWeightedAvg(records, 'PLUS_B'),
        TIPO: getTipoValue(records),
        TRCNT: calcWeightedAvg(records, 'TRCNT'),
        TRAR: calcWeightedAvg(records, 'TRAR'),
        TRID: calcWeightedAvg(records, 'TRID')
      })
    })
    
    console.log('✅ Resultados modo agregado:', results.length)
    // Ordenar por MISTURA
    return results.sort((a, b) => {
      const mistA = parseInt(a.mistura) || 0
      const mistB = parseInt(b.mistura) || 0
      return mistA - mistB
    })
  }
})

async function loadData() {
  loading.value = true
  try {
    console.log('🔌 Iniciando carga de datos de calidad fibra...')
    const result = await fetchCalidadFibra()
    console.log('✅ fetchCalidadFibra completado. Resultado:', result)
    rawData.value = result.rows || result || []
    console.log('📦 Datos cargados:', rawData.value.length, 'registros')
    if (rawData.value.length > 0) {
      console.log('📦 Primer registro:', rawData.value[0])
      console.log('📦 Campos disponibles:', Object.keys(rawData.value[0]))
    } else {
      console.warn('⚠️ No se recibieron registros desde el backend')
    }
  } catch (error) {
    console.error('❌ Error cargando datos:', error)
    console.error('❌ Error completo:', error.message, error.stack)
    rawData.value = []
  } finally {
    loading.value = false
  }
}

async function exportToExcel() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Calidad Fibra')
  
  const headers = [
    'Fecha/Hora', 'MISTURA', groupMode.value === 'detailed' ? 'SEQ' : 'SEQ Count', 'LOTE_FIAC',
    'SCI', 'MST', 'MIC', 'MAT', 'UHML', 'UI', 'SF', 'STR', 'ELG', 'RD', '+b', 'TIPO', 'TRCNT', 'TRAR', 'TRID'
  ]
  
  worksheet.addRow(headers)
  
  const headerRow = worksheet.getRow(1)
  headerRow.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    }
  })
  
  filteredRows.value.forEach(row => {
    worksheet.addRow([
      row.fechaHora, row.mistura, row.seq, row.loteFiac,
      row.SCI, row.MST, row.MIC, row.MAT, row.UHML, row.UI, row.SF,
      row.STR, row.ELG, row.RD, row.PLUS_B, row.TIPO, row.TRCNT, row.TRAR, row.TRID
    ])
  })
  
  worksheet.columns.forEach((col, idx) => {
    col.width = idx === 0 ? 14 : 10
  })
  
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  const now = new Date()
  const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  link.download = `Analisis_Calidad_Fibra_${timestamp}.xlsx`
  link.click()
  window.URL.revokeObjectURL(url)
}

onMounted(() => {
  // Establecer fechas por defecto - últimos 30 días
  const hoy = new Date()
  endDate.value = hoy.toISOString().split('T')[0]
  const hace30Dias = new Date(hoy)
  hace30Dias.setDate(hace30Dias.getDate() - 30)
  startDate.value = hace30Dias.toISOString().split('T')[0]
  
  loadData()
})
</script>
