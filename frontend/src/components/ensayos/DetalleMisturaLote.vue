<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-2">
    <!-- Header -->
    <div class="mb-2 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 p-3">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
            <span class="text-2xl">📊</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
              Detalle MISTURA por Lote de Hilandería
            </h1>
            <p class="text-sm text-slate-600 mt-0.5">Análisis detallado de fardos por productor y lote</p>
          </div>
        </div>

        <!-- Input búsqueda -->
        <div class="flex items-center gap-3">
          <div class="relative">
            <input
              v-model="loteFiacInput"
              @keyup.enter="buscarDetalle"
              type="number"
              placeholder="Ingrese LOTE_FIAC"
              class="w-48 px-4 py-2.5 pr-10 border-2 border-blue-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-medium"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-blue-400">🔍</span>
          </div>
          <button
            @click="buscarDetalle"
            :disabled="cargando || !loteFiacInput"
            class="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            <span v-if="cargando" class="animate-spin">⏳</span>
            <span>{{ cargando ? 'Buscando...' : 'Buscar' }}</span>
          </button>
          <button
            v-if="datosAgrupados.length > 0"
            @click="exportarExcel"
            :disabled="exportando"
            class="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
          >
            <span v-if="exportando" class="animate-spin">⏳</span>
            <span>{{ exportando ? 'Exportando...' : '📊 Exportar Excel' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="cargando" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p class="text-slate-600">Cargando datos...</p>
      </div>
    </div>

    <!-- Sin resultados -->
    <div v-else-if="!cargando && datosAgrupados.length === 0 && busquedaRealizada" class="text-center py-20">
      <div class="text-6xl mb-4">📭</div>
      <h3 class="text-xl font-semibold text-slate-700 mb-2">No se encontraron datos</h3>
      <p class="text-slate-500">No hay registros para el LOTE_FIAC: {{ loteFiacBuscado }}</p>
    </div>

    <!-- Tabla de resultados -->
    <div v-else-if="datosAgrupados.length > 0" class="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
      <div class="overflow-x-auto" style="padding: 0; margin: 0;">
        <table class="w-full text-xs divide-y divide-slate-200" style="border-collapse: collapse; margin: 0;">
          <thead class="bg-gradient-to-r from-blue-600 to-indigo-600 text-white sticky top-0">
            <tr>
              <th class="px-3 py-1 text-left font-semibold text-xs leading-tight">Lote<br>Hilandería</th>
              <th class="px-3 py-1 text-left font-semibold text-xs">Proveedor</th>
              <th class="px-3 py-1 text-left font-semibold text-xs leading-tight">Lote<br>Proveedor</th>
              <th class="px-3 py-1 text-center font-semibold text-xs">Calidad</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">Fardos</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">Total (kg)</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">%</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">SCI</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">MST</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">MIC</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">MAT</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">UHML</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">UI</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">SF</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">STR</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">ELG</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">RD</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">+B</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">TrCNT</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">TrAR</th>
              <th class="px-3 py-1 text-right font-semibold text-xs">TRID</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="(grupo, gIdx) in datosAgrupados" :key="'grupo-' + gIdx">
              <!-- Fila subtotal PRODUTOR -->
              <tr class="bg-gradient-to-r from-blue-50 to-indigo-50 border-t-2 border-blue-300 font-bold">
                <td class="px-3 py-2 text-slate-700">{{ formatLoteFiac(grupo.loteFiac) }}</td>
                <td class="px-3 py-2 text-slate-700">{{ grupo.produtor }}</td>
                <td class="px-3 py-2 text-blue-700">Total</td>
                <td class="px-3 py-2 text-center text-slate-700">-</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.qtde, 0) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.peso, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatPercent(grupo.subtotalProductor.porcentaje) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.SCI, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.MST, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.MIC, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.MAT, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.UHML, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.UI, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.SF, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.STR, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.ELG, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.RD, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.PLUS_B, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.TrCNT, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.TrAR, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(grupo.subtotalProductor.TRID, 0) }}</td>
              </tr>

              <!-- Filas LOTE + QUALIDADE -->
              <tr 
                v-for="(loteGrupo, lIdx) in grupo.lotes" 
                :key="'lote-' + gIdx + '-' + lIdx"
                class="border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150"
              >
                <td class="px-3 py-2 text-slate-700">{{ formatLoteFiac(grupo.loteFiac) }}</td>
                <td class="px-3 py-2 text-slate-700"></td>
                <td class="px-3 py-2 pl-4 text-slate-700">{{ loteGrupo.lote }}</td>
                <td class="px-3 py-2 text-center text-slate-700">{{ loteGrupo.qualidade }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.qtde, 0) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.peso, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatPercent(loteGrupo.subtotalLote.porcentaje) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.SCI, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.MST, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.MIC, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.MAT, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.UHML, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.UI, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.SF, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.STR, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.ELG, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.RD, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.PLUS_B, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.TrCNT, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.TrAR, 2) }}</td>
                <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(loteGrupo.subtotalLote.TRID, 0) }}</td>
              </tr>
            </template>

            <!-- Fila TOTAL GENERAL -->
            <tr v-if="totalGeneral" class="bg-gradient-to-r from-indigo-100 to-blue-100 border-t-4 border-indigo-400 font-bold">
              <td class="px-3 py-2 text-slate-700">{{ formatLoteFiac(totalGeneral.loteFiac) }}</td>
              <td class="px-3 py-2 text-indigo-700">Total</td>
              <td class="px-3 py-2 text-slate-700"></td>
              <td class="px-3 py-2 text-center text-slate-700">-</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.qtde, 0) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.peso, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">100,00%</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.SCI, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.MST, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.MIC, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.MAT, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.UHML, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.UI, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.SF, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.STR, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.ELG, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.RD, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.PLUS_B, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.TrCNT, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.TrAR, 2) }}</td>
              <td class="px-3 py-2 text-right text-slate-700">{{ formatNumber(totalGeneral.TRID, 0) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ExcelJS from 'exceljs'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Estado
const loteFiacInput = ref('')
const loteFiacBuscado = ref('')
const cargando = ref(false)
const exportando = ref(false)
const busquedaRealizada = ref(false)
const filasCrudas = ref([])

// Variables HVI para promedios ponderados
const variablesHVI = ['SCI', 'MST', 'MIC', 'MAT', 'UHML', 'UI', 'SF', 'STR', 'ELG', 'RD', 'PLUS_B', 'TrCNT', 'TrAR', 'TRID']

// Construir columna QUALIDADE (TP + CLASSIFIC)
function construirQualidade(tp, classific) {
  const tpVal = (tp || '').trim()
  const classVal = (classific || '').trim()
  
  if (tpVal && classVal) {
    return `${tpVal} ${classVal}`
  } else if (tpVal) {
    return tpVal
  } else if (classVal) {
    return classVal
  }
  return '-'
}

// Buscar detalle de mistura
async function buscarDetalle() {
  if (!loteFiacInput.value) {
    alert('Por favor ingrese un LOTE_FIAC')
    return
  }

  cargando.value = true
  busquedaRealizada.value = true
  loteFiacBuscado.value = loteFiacInput.value

  try {
    const response = await fetch(`${API_URL}/detalle-mistura/${loteFiacInput.value}`)
    const data = await response.json()

    if (data.success) {
      filasCrudas.value = data.filas
    } else {
      console.error('Error:', data.error)
      alert('Error al cargar datos: ' + data.error)
      filasCrudas.value = []
    }
  } catch (error) {
    console.error('Error:', error)
    alert('Error de conexión al cargar datos')
    filasCrudas.value = []
  } finally {
    cargando.value = false
  }
}

// Calcular promedio ponderado por peso
function calcularPromedioPonderado(filas, variable) {
  const pesoTotal = filas.reduce((sum, f) => sum + (parseFloat(f.PESO) || 0), 0)
  if (pesoTotal === 0) return null

  const sumaPonderada = filas.reduce((sum, f) => {
    const peso = parseFloat(f.PESO) || 0
    const valor = parseFloat(f[variable])
    if (isNaN(valor)) return sum
    return sum + (peso * valor)
  }, 0)

  return sumaPonderada / pesoTotal
}

// Agrupar datos por PRODUTOR > LOTE + QUALIDADE (sin filas individuales)
const datosAgrupados = computed(() => {
  const grupos = {}

  // Agrupar por PRODUTOR
  filasCrudas.value.forEach(fila => {
    const produtor = fila.PRODUTOR || 'SIN PRODUTOR'
    if (!grupos[produtor]) {
      grupos[produtor] = []
    }
    grupos[produtor].push(fila)
  })

  // Calcular peso total general para porcentajes
  const pesoTotalGeneral = filasCrudas.value.reduce((sum, f) => sum + (parseFloat(f.PESO) || 0), 0)

  // Crear estructura con subtotales por PRODUTOR y LOTE+QUALIDADE
  return Object.keys(grupos).map(produtor => {
    const filasProductor = grupos[produtor]
    
    // Calcular subtotales del produtor
    const qtdeTotal = filasProductor.reduce((sum, f) => sum + (parseFloat(f.QTDE) || 0), 0)
    const pesoTotal = filasProductor.reduce((sum, f) => sum + (parseFloat(f.PESO) || 0), 0)
    const porcentajeTotal = pesoTotalGeneral > 0 ? (pesoTotal / pesoTotalGeneral) * 100 : 0

    // Promedios ponderados de variables HVI del produtor
    const subtotalProductor = {
      qtde: qtdeTotal,
      peso: pesoTotal,
      porcentaje: porcentajeTotal,
      qualidade: '-'
    }

    variablesHVI.forEach(variable => {
      subtotalProductor[variable] = calcularPromedioPonderado(filasProductor, variable)
    })

    // Agrupar filas del produtor por LOTE + QUALIDADE
    const lotesQualidadeMap = {}
    filasProductor.forEach(fila => {
      const lote = fila.LOTE || 'SIN LOTE'
      const qualidade = construirQualidade(fila.TP, fila.CLASSIFIC)
      const key = `${lote}|${qualidade}`
      
      if (!lotesQualidadeMap[key]) {
        lotesQualidadeMap[key] = {
          lote,
          qualidade,
          filas: []
        }
      }
      lotesQualidadeMap[key].filas.push(fila)
    })

    // Crear array de lotes+qualidade con sus subtotales
    const lotes = Object.values(lotesQualidadeMap).map(grupo => {
      const filasGrupo = grupo.filas
      
      // Calcular subtotales del grupo
      const qtdeGrupo = filasGrupo.reduce((sum, f) => sum + (parseFloat(f.QTDE) || 0), 0)
      const pesoGrupo = filasGrupo.reduce((sum, f) => sum + (parseFloat(f.PESO) || 0), 0)
      const porcentajeGrupo = pesoTotalGeneral > 0 ? (pesoGrupo / pesoTotalGeneral) * 100 : 0

      // Promedios ponderados de variables HVI del grupo
      const subtotalLote = {
        qtde: qtdeGrupo,
        peso: pesoGrupo,
        porcentaje: porcentajeGrupo,
        qualidade: grupo.qualidade
      }

      variablesHVI.forEach(variable => {
        subtotalLote[variable] = calcularPromedioPonderado(filasGrupo, variable)
      })

      return {
        lote: grupo.lote,
        qualidade: grupo.qualidade,
        subtotalLote
      }
    })

    return {
      produtor,
      loteFiac: filasProductor[0]?.LOTE_FIAC || '',
      subtotalProductor,
      lotes
    }
  })
})

// Total general ponderado
const totalGeneral = computed(() => {
  if (filasCrudas.value.length === 0) return null

  const qtdeTotal = filasCrudas.value.reduce((sum, f) => sum + (parseFloat(f.QTDE) || 0), 0)
  const pesoTotal = filasCrudas.value.reduce((sum, f) => sum + (parseFloat(f.PESO) || 0), 0)

  const total = {
    loteFiac: filasCrudas.value[0]?.LOTE_FIAC || '',
    qtde: qtdeTotal,
    peso: pesoTotal,
    qualidade: construirQualidade(filasCrudas.value[0]?.TP, filasCrudas.value[0]?.CLASSIFIC)
  }

  variablesHVI.forEach(variable => {
    total[variable] = calcularPromedioPonderado(filasCrudas.value, variable)
  })

  return total
})

// Formatear números
function formatNumber(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) return '-'
  return parseFloat(value).toLocaleString('es-AR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

// Formatear porcentaje
function formatPercent(value) {
  if (value === null || value === undefined || isNaN(value)) return '-'
  return `${parseFloat(value).toFixed(2)}%`
}

// Formatear LOTE_FIAC (eliminar ceros a la izquierda)
function formatLoteFiac(value) {
  if (!value) return ''
  return parseInt(value, 10).toString()
}

// Exportar a Excel
async function exportarExcel() {
  if (datosAgrupados.value.length === 0) {
    alert('No hay datos para exportar')
    return
  }

  exportando.value = true

  try {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Detalle MISTURA')

    // Configurar columnas
    worksheet.columns = [
      { header: 'Lote\nHilandería', key: 'loteFiac', width: 14 },
      { header: 'Proveedor', key: 'produtor', width: 20 },
      { header: 'Lote\nProveedor', key: 'lote', width: 14 },
      { header: 'Calidad', key: 'qualidade', width: 12 },
      { header: 'Fardos', key: 'qtde', width: 10 },
      { header: 'Total (kg)', key: 'peso', width: 12 },
      { header: '%', key: 'porcentaje', width: 8.5 },
      { header: 'SCI', key: 'SCI', width: 8 },
      { header: 'MST', key: 'MST', width: 8 },
      { header: 'MIC', key: 'MIC', width: 8 },
      { header: 'MAT', key: 'MAT', width: 8 },
      { header: 'UHML', key: 'UHML', width: 8 },
      { header: 'UI', key: 'UI', width: 8 },
      { header: 'SF', key: 'SF', width: 8 },
      { header: 'STR', key: 'STR', width: 8 },
      { header: 'ELG', key: 'ELG', width: 8 },
      { header: 'RD', key: 'RD', width: 8 },
      { header: '+B', key: 'PLUS_B', width: 8 },
      { header: 'TrCNT', key: 'TrCNT', width: 8 },
      { header: 'TrAR', key: 'TrAR', width: 8 },
      { header: 'TRID', key: 'TRID', width: 8 }
    ]

    // Estilo del header
    const headerRow = worksheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    }
    headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    headerRow.height = 30

    // Agregar datos
    datosAgrupados.value.forEach(grupo => {
      // Fila subtotal PRODUTOR
      const subtotalRow = worksheet.addRow({
        loteFiac: parseInt(grupo.loteFiac, 10),
        produtor: grupo.produtor,
        lote: 'Total',
        qualidade: '-',
        qtde: grupo.subtotalProductor.qtde,
        peso: grupo.subtotalProductor.peso,
        porcentaje: grupo.subtotalProductor.porcentaje,
        SCI: grupo.subtotalProductor.SCI,
        MST: grupo.subtotalProductor.MST,
        MIC: grupo.subtotalProductor.MIC,
        MAT: grupo.subtotalProductor.MAT,
        UHML: grupo.subtotalProductor.UHML,
        UI: grupo.subtotalProductor.UI,
        SF: grupo.subtotalProductor.SF,
        STR: grupo.subtotalProductor.STR,
        ELG: grupo.subtotalProductor.ELG,
        RD: grupo.subtotalProductor.RD,
        PLUS_B: grupo.subtotalProductor.PLUS_B,
        TrCNT: grupo.subtotalProductor.TrCNT,
        TrAR: grupo.subtotalProductor.TrAR,
        TRID: grupo.subtotalProductor.TRID
      })

      // Estilo fila subtotal produtor
      subtotalRow.font = { bold: true }
      subtotalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      subtotalRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Aplicar formato numérico
      subtotalRow.getCell('qtde').numFmt = '#,##0'
      subtotalRow.getCell('peso').numFmt = '#,##0.00'
      subtotalRow.getCell('porcentaje').numFmt = '0.00%'
      subtotalRow.getCell('porcentaje').value = grupo.subtotalProductor.porcentaje / 100
      
      // Formato variables HVI
      variablesHVI.forEach(variable => {
        const cell = subtotalRow.getCell(variable)
        if (cell.value !== null && cell.value !== undefined) {
          cell.numFmt = ['SCI', 'TRID'].includes(variable) ? '#,##0' : '#,##0.00'
        }
      })

      // Filas LOTE + QUALIDADE
      grupo.lotes.forEach(loteGrupo => {
        const loteRow = worksheet.addRow({
          loteFiac: parseInt(grupo.loteFiac, 10),
          produtor: '',
          lote: loteGrupo.lote,
          qualidade: loteGrupo.qualidade,
          qtde: loteGrupo.subtotalLote.qtde,
          peso: loteGrupo.subtotalLote.peso,
          porcentaje: loteGrupo.subtotalLote.porcentaje,
          SCI: loteGrupo.subtotalLote.SCI,
          MST: loteGrupo.subtotalLote.MST,
          MIC: loteGrupo.subtotalLote.MIC,
          MAT: loteGrupo.subtotalLote.MAT,
          UHML: loteGrupo.subtotalLote.UHML,
          UI: loteGrupo.subtotalLote.UI,
          SF: loteGrupo.subtotalLote.SF,
          STR: loteGrupo.subtotalLote.STR,
          ELG: loteGrupo.subtotalLote.ELG,
          RD: loteGrupo.subtotalLote.RD,
          PLUS_B: loteGrupo.subtotalLote.PLUS_B,
          TrCNT: loteGrupo.subtotalLote.TrCNT,
          TrAR: loteGrupo.subtotalLote.TrAR,
          TRID: loteGrupo.subtotalLote.TRID
        })

        loteRow.alignment = { vertical: 'middle', horizontal: 'center' }

        // Aplicar formato numérico
        loteRow.getCell('qtde').numFmt = '#,##0'
        loteRow.getCell('peso').numFmt = '#,##0.00'
        loteRow.getCell('porcentaje').numFmt = '0.00%'
        loteRow.getCell('porcentaje').value = loteGrupo.subtotalLote.porcentaje / 100
        
        // Formato variables HVI
        variablesHVI.forEach(variable => {
          const cell = loteRow.getCell(variable)
          if (cell.value !== null && cell.value !== undefined) {
            cell.numFmt = ['SCI', 'TRID'].includes(variable) ? '#,##0' : '#,##0.00'
          }
        })
      })
    })

    // Fila TOTAL GENERAL
    if (totalGeneral.value) {
      const totalRow = worksheet.addRow({
        loteFiac: parseInt(totalGeneral.value.loteFiac, 10),
        produtor: 'Total',
        lote: '',
        qualidade: '-',
        qtde: totalGeneral.value.qtde,
        peso: totalGeneral.value.peso,
        porcentaje: 100,
        SCI: totalGeneral.value.SCI,
        MST: totalGeneral.value.MST,
        MIC: totalGeneral.value.MIC,
        MAT: totalGeneral.value.MAT,
        UHML: totalGeneral.value.UHML,
        UI: totalGeneral.value.UI,
        SF: totalGeneral.value.SF,
        STR: totalGeneral.value.STR,
        ELG: totalGeneral.value.ELG,
        RD: totalGeneral.value.RD,
        PLUS_B: totalGeneral.value.PLUS_B,
        TrCNT: totalGeneral.value.TrCNT,
        TrAR: totalGeneral.value.TrAR,
        TRID: totalGeneral.value.TRID
      })

      // Estilo fila total
      totalRow.font = { bold: true, size: 12 }
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFC7D2FE' }
      }
      totalRow.alignment = { vertical: 'middle', horizontal: 'center' }

      // Aplicar formato numérico
      totalRow.getCell('qtde').numFmt = '#,##0'
      totalRow.getCell('peso').numFmt = '#,##0.00'
      totalRow.getCell('porcentaje').numFmt = '0.00%'
      totalRow.getCell('porcentaje').value = 1
      
      // Formato variables HVI
      variablesHVI.forEach(variable => {
        const cell = totalRow.getCell(variable)
        if (cell.value !== null && cell.value !== undefined) {
          cell.numFmt = ['SCI', 'TRID'].includes(variable) ? '#,##0' : '#,##0.00'
        }
      })
    }

    // Aplicar bordes solo a las columnas con datos (A-U, 21 columnas)
    worksheet.eachRow((row, rowNumber) => {
      // Solo aplicar bordes a las primeras 21 columnas
      for (let i = 1; i <= 21; i++) {
        const cell = row.getCell(i)
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      }
    })

    // Generar archivo
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `DetalleMistura_LOTE_${loteFiacBuscado.value}_${new Date().toISOString().split('T')[0]}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error exportando Excel:', error)
    alert('Error al exportar a Excel: ' + error.message)
  } finally {
    exportando.value = false
  }
}
</script>

<style scoped>
/* Eliminar padding del contenedor */
.overflow-x-auto {
  padding: 0 !important;
  margin: 0 !important;
}

/* Ancho mínimo para celdas de la tabla */
table th,
table td {
  white-space: nowrap;
}

table {
  border-collapse: collapse;
  margin: 0;
}

/* Efecto hover en filas */
tbody tr:hover {
  background-color: rgba(241, 245, 249, 0.5);
}

/* Scroll horizontal suave */
.overflow-x-auto {
  scrollbar-width: thin;
  scrollbar-color: rgba(100, 116, 139, 0.5) rgba(226, 232, 240, 0.8);
}

.overflow-x-auto::-webkit-scrollbar {
  height: 8px;
}

.overflow-x-auto::-webkit-scrollbar-track {
  background: rgba(226, 232, 240, 0.8);
  border-radius: 8px;
}

.overflow-x-auto::-webkit-scrollbar-thumb {
  background: rgba(100, 116, 139, 0.5);
  border-radius: 8px;
}

.overflow-x-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(100, 116, 139, 0.7);
}
</style>
