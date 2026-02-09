<template>
  <div class="w-full h-screen flex flex-col p-2 bg-slate-50">
    <!-- Overlay de carga -->
    <div v-if="cargando" class="fixed inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-[9999]">
      <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
        <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
        <span class="text-xl text-slate-800 font-bold">Cargando métricas...</span>
      </div>
    </div>

    <!-- Header -->
    <div class="flex items-center justify-between gap-4 bg-white rounded-xl shadow-sm px-4 py-3 mb-3 border border-slate-200">
      <div class="flex items-center gap-4">
        <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-9 w-auto object-contain opacity-90" />
        <div>
          <h3 class="text-base font-semibold text-slate-800">Gráfico de Métricas Diarias</h3>
          <p class="text-xs text-slate-400">Análisis multi-variable con escalas normalizadas</p>
        </div>
      </div>
      
      <div class="flex items-center gap-3">
        <!-- Selector de fechas -->
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500">Desde:</label>
          <input type="date" v-model="fechaInicio" class="px-2 py-1.5 border border-slate-200 rounded-md text-sm" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs font-medium text-slate-500">Hasta:</label>
          <input type="date" v-model="fechaFin" class="px-2 py-1.5 border border-slate-200 rounded-md text-sm" />
        </div>
        <button @click="cargarDatos" :disabled="cargando"
          class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-md">
          {{ cargando ? 'Cargando...' : 'Actualizar' }}
        </button>
        <button @click="exportarExcel" :disabled="cargando || datos.length === 0"
          class="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-md flex items-center gap-1">
          <span>📥</span> Exportar Excel
        </button>
      </div>
    </div>

    <!-- Panel principal -->
    <div class="flex-1 flex gap-3 min-h-0 relative">
      <!-- Botón toggle para panel -->
      <button @click="panelVisible = !panelVisible" 
        class="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white hover:bg-slate-50 border border-slate-300 rounded-r-lg px-2 py-6 shadow-md transition-all duration-300"
        :class="panelVisible ? 'left-[288px]' : 'left-0'"
        :title="panelVisible ? 'Ocultar panel' : 'Mostrar panel'">
        <span class="text-lg" :class="panelVisible ? 'rotate-0' : 'rotate-180'">◀</span>
      </button>
      
      <!-- Panel izquierdo: Selector de métricas -->
      <div v-show="panelVisible" class="w-72 bg-white rounded-xl shadow-sm border border-slate-200 p-4 overflow-y-auto flex-shrink-0 transition-all duration-300">
        <h4 class="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <span class="text-lg">📊</span> Métricas a Graficar
        </h4>
        
        <!-- Tipo de normalización -->
        <div class="mb-4 p-3 bg-slate-50 rounded-lg">
          <label class="text-xs font-medium text-slate-600 mb-2 block">Tipo de Escala:</label>
          <select v-model="tipoNormalizacion" class="w-full px-2 py-1.5 border border-slate-200 rounded text-sm">
            <option value="normalizada">Normalizada (0-100%)</option>
            <option value="zscore">Z-Score (desviaciones)</option>
            <option value="original">Valores Originales</option>
          </select>
        </div>

        <!-- Grupos de métricas -->
        <div class="space-y-4">
          <!-- Fibra HVI -->
          <div class="border border-amber-200 rounded-lg p-3 bg-amber-50/50">
            <div class="flex items-center justify-between mb-2">
              <h5 class="text-xs font-semibold text-amber-800">🧵 Fibra HVI</h5>
              <button @click="toggleGrupo('fibra')" class="text-xs text-amber-600 hover:underline">
                {{ grupoSeleccionado('fibra') ? 'Quitar' : 'Todos' }}
              </button>
            </div>
            <div class="grid grid-cols-2 gap-1">
              <label v-for="m in metricasFibra" :key="m.key" 
                class="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-amber-100 rounded px-1 py-0.5">
                <input type="checkbox" v-model="metricasSeleccionadas" :value="m.key" 
                  class="rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                <span :style="{ color: m.color }">●</span>
                <span class="text-slate-700">{{ m.label }}</span>
              </label>
            </div>
          </div>

          <!-- Producción URDIDORA -->
          <div class="border border-purple-200 rounded-lg p-3 bg-purple-50/50">
            <h5 class="text-xs font-semibold text-purple-800 mb-2">🔄 Urdidora</h5>
            <div class="space-y-1">
              <label v-for="m in metricasUrdidora" :key="m.key"
                class="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-purple-100 rounded px-1 py-0.5">
                <input type="checkbox" v-model="metricasSeleccionadas" :value="m.key"
                  class="rounded border-purple-300 text-purple-600 focus:ring-purple-500" />
                <span :style="{ color: m.color }">●</span>
                <span class="text-slate-700">{{ m.label }}</span>
              </label>
            </div>
          </div>

          <!-- Producción ÍNDIGO -->
          <div class="border border-indigo-200 rounded-lg p-3 bg-indigo-50/50">
            <h5 class="text-xs font-semibold text-indigo-800 mb-2">🌀 Índigo</h5>
            <div class="space-y-1">
              <label v-for="m in metricasIndigo" :key="m.key"
                class="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-indigo-100 rounded px-1 py-0.5">
                <input type="checkbox" v-model="metricasSeleccionadas" :value="m.key"
                  class="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500" />
                <span :style="{ color: m.color }">●</span>
                <span class="text-slate-700">{{ m.label }}</span>
              </label>
            </div>
          </div>

          <!-- Tejeduría -->
          <div class="border border-emerald-200 rounded-lg p-3 bg-emerald-50/50">
            <h5 class="text-xs font-semibold text-emerald-800 mb-2">🧶 Tejeduría</h5>
            <div class="space-y-1">
              <label v-for="m in metricasTejeduria" :key="m.key"
                class="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-emerald-100 rounded px-1 py-0.5">
                <input type="checkbox" v-model="metricasSeleccionadas" :value="m.key"
                  class="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
                <span :style="{ color: m.color }">●</span>
                <span class="text-slate-700">{{ m.label }}</span>
              </label>
            </div>
          </div>

          <!-- Calidad -->
          <div class="border border-rose-200 rounded-lg p-3 bg-rose-50/50">
            <h5 class="text-xs font-semibold text-rose-800 mb-2">✅ Calidad</h5>
            <div class="space-y-1">
              <label v-for="m in metricasCalidad" :key="m.key"
                class="flex items-center gap-1.5 text-xs cursor-pointer hover:bg-rose-100 rounded px-1 py-0.5">
                <input type="checkbox" v-model="metricasSeleccionadas" :value="m.key"
                  class="rounded border-rose-300 text-rose-600 focus:ring-rose-500" />
                <span :style="{ color: m.color }">●</span>
                <span class="text-slate-700">{{ m.label }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Info de rangos -->
        <div v-if="rangos && metricasSeleccionadas.length > 0" class="mt-4 p-3 bg-slate-100 rounded-lg">
          <h5 class="text-xs font-semibold text-slate-600 mb-2">📈 Rangos Originales</h5>
          <div class="space-y-1 max-h-40 overflow-y-auto">
            <div v-for="key in metricasSeleccionadas" :key="key" class="text-[10px] text-slate-600 flex justify-between">
              <span>{{ getMetricaInfo(key)?.label }}</span>
              <span v-if="rangos[key]" class="font-mono">
                {{ formatNumber(rangos[key].min) }} - {{ formatNumber(rangos[key].max) }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Panel derecho: Gráfico -->
      <div class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 p-4 flex flex-col min-h-0">
        <div class="flex items-center justify-between mb-3">
          <!-- Botón toggle panel -->
          <button @click="panelVisible = !panelVisible" 
            class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-md flex items-center gap-1.5 transition-colors"
            :title="panelVisible ? 'Ocultar panel de métricas' : 'Mostrar panel de métricas'">
            <span class="text-base">{{ panelVisible ? '◀' : '▶' }}</span>
            <span>{{ panelVisible ? 'Ocultar Panel' : 'Mostrar Panel' }}</span>
          </button>
          
          <h4 class="text-sm font-semibold text-slate-700">
            {{ tipoNormalizacion === 'normalizada' ? 'Valores Normalizados (0-100%)' : 
               tipoNormalizacion === 'zscore' ? 'Z-Score (Desviaciones Estándar)' : 'Valores Originales' }}
          </h4>
          <span class="text-xs text-slate-500">{{ datos.length }} días | {{ metricasSeleccionadas.length }} métricas</span>
        </div>
        
        <div class="flex-1 min-h-0">
          <canvas ref="chartCanvas"></canvas>
        </div>

        <!-- Leyenda personalizada -->
        <div v-if="metricasSeleccionadas.length > 0" class="mt-3 pt-3 border-t border-slate-100">
          <div class="flex flex-wrap gap-3 justify-center">
            <div v-for="key in metricasSeleccionadas" :key="key" 
              class="flex items-center gap-1.5 text-xs text-slate-600">
              <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: getMetricaInfo(key)?.color }"></span>
              <span>{{ getMetricaInfo(key)?.label }}</span>
              <span v-if="rangos[key]" class="text-slate-400 text-[10px]">
                ({{ formatNumber(rangos[key].avg) }} avg)
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'
import * as XLSX from 'xlsx'

Chart.register(...registerables)

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

// Estado
const cargando = ref(false)
const datos = ref([])
const rangos = ref({})
const chartCanvas = ref(null)
let chartInstance = null

// Fechas (últimos 30 días por defecto)
const fechaFin = ref(new Date().toISOString().split('T')[0])
const fechaInicio = ref(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

// Tipo de normalización
const tipoNormalizacion = ref('normalizada')

// Control de visibilidad del panel
const panelVisible = ref(true)

// Métricas seleccionadas
const metricasSeleccionadas = ref(['SCI', 'MIC', 'EFICIENCIA_TELAR', 'CALIDAD_PERCENT'])

// Definición de métricas por grupo
const metricasFibra = [
  { key: 'SCI', label: 'SCI', color: '#f59e0b' },
  { key: 'MIC', label: 'MIC', color: '#d97706' },
  { key: 'MAT', label: 'MAT', color: '#b45309' },
  { key: 'UHML', label: 'UHML', color: '#92400e' },
  { key: 'UI', label: 'UI', color: '#78350f' },
  { key: 'SF', label: 'SF', color: '#fbbf24' },
  { key: 'STR', label: 'STR', color: '#fcd34d' },
  { key: 'ELG', label: 'ELG', color: '#fde68a' },
  { key: 'RD', label: 'RD', color: '#fef3c7' },
  { key: 'PLUS_B', label: '+b', color: '#fffbeb' }
]

const metricasUrdidora = [
  { key: 'RU106_URDIDORA', label: 'RU10⁶ Urdidora', color: '#9333ea' }
]

const metricasIndigo = [
  { key: 'METROS_INDIGO', label: 'Metros Índigo', color: '#6366f1' },
  { key: 'R103_INDIGO', label: 'R10³ Índigo', color: '#4f46e5' },
  { key: 'VELOCIDAD_INDIGO', label: 'Velocidad Índigo', color: '#4338ca' }
]

const metricasTejeduria = [
  { key: 'EFICIENCIA_TELAR', label: 'Eficiencia %', color: '#10b981' },
  { key: 'RU105_TELAR', label: 'RU10⁵ Telar', color: '#059669' },
  { key: 'RT105_TELAR', label: 'RT10⁵ Telar', color: '#047857' }
]

const metricasCalidad = [
  { key: 'CALIDAD_PERCENT', label: 'Calidad %', color: '#f43f5e' },
  { key: 'PTS_100M2', label: 'Pts 100m²', color: '#e11d48' }
]

// Todas las métricas combinadas
const todasLasMetricas = computed(() => [
  ...metricasFibra,
  ...metricasUrdidora,
  ...metricasIndigo,
  ...metricasTejeduria,
  ...metricasCalidad
])

// Obtener info de una métrica
function getMetricaInfo(key) {
  return todasLasMetricas.value.find(m => m.key === key)
}

// Toggle grupo completo
function toggleGrupo(grupo) {
  const metricas = grupo === 'fibra' ? metricasFibra : []
  const keys = metricas.map(m => m.key)
  const todosSeleccionados = keys.every(k => metricasSeleccionadas.value.includes(k))
  
  if (todosSeleccionados) {
    metricasSeleccionadas.value = metricasSeleccionadas.value.filter(k => !keys.includes(k))
  } else {
    metricasSeleccionadas.value = [...new Set([...metricasSeleccionadas.value, ...keys])]
  }
}

function grupoSeleccionado(grupo) {
  const metricas = grupo === 'fibra' ? metricasFibra : []
  return metricas.every(m => metricasSeleccionadas.value.includes(m.key))
}

// Formatear números
function formatNumber(val) {
  if (val === null || val === undefined) return '-'
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'))
  if (isNaN(num)) return '-'
  if (Math.abs(num) >= 1000) return num.toLocaleString('es-ES', { maximumFractionDigits: 0 })
  if (Math.abs(num) >= 10) return num.toFixed(1)
  return num.toFixed(2)
}

function parseDateString(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const str = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return new Date(`${str.slice(0, 10)}T12:00:00`)
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) {
    const [dd, mm, yyyy] = str.slice(0, 10).split('/')
    return new Date(`${yyyy}-${mm}-${dd}T12:00:00`)
  }
  const fallback = new Date(str)
  return isNaN(fallback) ? null : fallback
}

function dateKeyFrom(value) {
  const date = parseDateString(value)
  if (!date || isNaN(date)) return null
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Normalizar valor (0-100)
function normalizar(valor, min, max) {
  if (valor === null || valor === undefined || isNaN(valor)) return null
  if (max === min) return 50
  return ((valor - min) / (max - min)) * 100
}

// Z-Score
function zScore(valor, avg, std) {
  if (valor === null || valor === undefined || isNaN(valor) || std === 0) return null
  return (valor - avg) / std
}

// Calcular desviación estándar
function calcularStd(valores) {
  const filtrados = valores.filter(v => v !== null && v !== undefined && !isNaN(v))
  if (filtrados.length === 0) return 0
  const avg = filtrados.reduce((a, b) => a + b, 0) / filtrados.length
  const squareDiffs = filtrados.map(v => Math.pow(v - avg, 2))
  return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / filtrados.length)
}

// Cargar datos de los 3 endpoints y combinarlos
async function cargarDatos() {
  cargando.value = true
  try {
    const params = `fechaInicio=${fechaInicio.value}&fechaFin=${fechaFin.value}`
    
    // Llamar a los 3 endpoints en paralelo
    const [resCalidad, resProduccion, resFibra] = await Promise.all([
      fetch(`${API_URL}/metricas-diarias-calidad?${params}`),
      fetch(`${API_URL}/metricas-diarias-produccion?${params}`),
      fetch(`${API_URL}/metricas-diarias-fibra?${params}`)
    ])
    
    const [dataCalidad, dataProduccion, dataFibra] = await Promise.all([
      resCalidad.ok ? resCalidad.json() : { datos: [], rangos: {} },
      resProduccion.ok ? resProduccion.json() : { datos: [], rangos: {} },
      resFibra.ok ? resFibra.json() : { datos: [], rangos: {} }
    ])

    
    // Combinar datos por fecha
    const datosPorFecha = {}
    const upsertPorFecha = (d) => {
      const fechaKey = dateKeyFrom(d.FECHA_DB || d.FECHA)
      if (!fechaKey) return
      if (!datosPorFecha[fechaKey]) {
        datosPorFecha[fechaKey] = { FECHA_DB: fechaKey, FECHA: d.FECHA || fechaKey }
      }
      Object.assign(datosPorFecha[fechaKey], d, { FECHA_DB: fechaKey })
    }
    
    // Agregar datos de calidad
    dataCalidad.datos?.forEach(upsertPorFecha)
    
    // Agregar datos de producción
    dataProduccion.datos?.forEach(upsertPorFecha)
    
    // Agregar datos de fibra
    dataFibra.datos?.forEach(upsertPorFecha)
    
    // Convertir a array ordenado por fecha
    datos.value = Object.values(datosPorFecha).sort((a, b) => a.FECHA_DB.localeCompare(b.FECHA_DB))

    
    // Combinar rangos
    rangos.value = {
      ...dataCalidad.rangos,
      ...dataProduccion.rangos,
      ...dataFibra.rangos
    }
    
    await nextTick()
    renderizarGrafico()
  } catch (error) {
    console.error('Error cargando métricas:', error)
  } finally {
    cargando.value = false
  }
}

// Exportar a Excel con valores reales (no normalizados)
function exportarExcel() {
  if (datos.value.length === 0) return
  
  // Definir columnas por sector (en orden)
  const columnas = [
    { key: 'FECHA', label: 'Fecha', sector: '' },
    // Fibra HVI
    { key: 'SCI', label: 'SCI', sector: 'Fibra' },
    { key: 'MIC', label: 'MIC', sector: 'Fibra' },
    { key: 'MAT', label: 'MAT', sector: 'Fibra' },
    { key: 'UHML', label: 'UHML', sector: 'Fibra' },
    { key: 'UI', label: 'UI', sector: 'Fibra' },
    { key: 'SF', label: 'SF', sector: 'Fibra' },
    { key: 'STR', label: 'STR', sector: 'Fibra' },
    { key: 'ELG', label: 'ELG', sector: 'Fibra' },
    { key: 'RD', label: 'RD', sector: 'Fibra' },
    { key: 'PLUS_B', label: '+b', sector: 'Fibra' },
    // Urdidora
    { key: 'RU106_URDIDORA', label: 'RU10⁶', sector: 'Urdidora' },
    // Índigo
    { key: 'METROS_INDIGO', label: 'Metros', sector: 'Índigo' },
    { key: 'R103_INDIGO', label: 'R10³', sector: 'Índigo' },
    { key: 'VELOCIDAD_INDIGO', label: 'Velocidad', sector: 'Índigo' },
    // Tejeduría
    { key: 'EFICIENCIA_TELAR', label: 'Eficiencia %', sector: 'Tejeduría' },
    { key: 'RU105_TELAR', label: 'RU10⁵', sector: 'Tejeduría' },
    { key: 'RT105_TELAR', label: 'RT10⁵', sector: 'Tejeduría' },
    // Calidad
    { key: 'CALIDAD_PERCENT', label: 'Calidad %', sector: 'Calidad' },
    { key: 'PTS_100M2', label: 'Pts/100m²', sector: 'Calidad' },
    { key: 'METROS_1ERA', label: 'Metros 1era', sector: 'Calidad' }
  ]
  
  // Crear fila de sectores (para agrupar visualmente)
  const filaSectores = columnas.map(c => c.sector)
  
  // Crear fila de encabezados
  const filaHeaders = columnas.map(c => c.label)
  
  // Crear filas de datos con valores reales
  const filaDatos = datos.value.map(d => {
    return columnas.map(col => {
      if (col.key === 'FECHA') {
        const fecha = parseDateString(d.FECHA_DB || d.FECHA)
        return fecha
          ? fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
          : ''
      }
      const valor = d[col.key]
      return valor !== null && valor !== undefined ? valor : ''
    })
  })
  
  // Crear hoja con sectores + headers + datos
  const wsData = [filaSectores, filaHeaders, ...filaDatos]
  const ws = XLSX.utils.aoa_to_sheet(wsData)
  
  // Ajustar anchos de columnas
  ws['!cols'] = columnas.map((col, i) => ({ wch: i === 0 ? 12 : 10 }))
  
  // Crear libro
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Métricas Diarias')
  
  // Agregar hoja de rangos/estadísticas
  const statsData = [
    ['Métrica', 'Mínimo', 'Máximo', 'Promedio', 'Sector'],
    ...columnas.filter(c => c.key !== 'FECHA').map(col => {
      const rango = rangos.value[col.key]
      return [
        col.label,
        rango?.min ?? '-',
        rango?.max ?? '-',
        rango?.avg ? rango.avg.toFixed(2) : '-',
        col.sector
      ]
    })
  ]
  const wsStats = XLSX.utils.aoa_to_sheet(statsData)
  wsStats['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, wsStats, 'Estadísticas')
  
  // Descargar archivo
  const ahora = new Date()
  const fechaArchivo = ahora.toISOString().split('T')[0]
  const horaArchivo = ahora.toTimeString().split(' ')[0].replace(/:/g, '')
  XLSX.writeFile(wb, `Metricas_Diarias_${fechaInicio.value}_a_${fechaFin.value}_${fechaArchivo}_${horaArchivo}.xlsx`)
}

// Renderizar gráfico
function renderizarGrafico() {
  if (!chartCanvas.value || datos.value.length === 0) return
  
  // Destruir gráfico anterior
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const ctx = chartCanvas.value.getContext('2d')
  const labels = datos.value.map(d => {
    const date = parseDateString(d.FECHA_DB || d.FECHA)
    return date ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : ''
  })


  // Crear datasets según métricas seleccionadas
  const useDualAxis = tipoNormalizacion.value === 'original'
  const axisForKey = (key) => {
    if (!useDualAxis) return 'y'
    if (key === 'EFICIENCIA_TELAR') return 'yLeft'
    if (key === 'RU105_TELAR' || key === 'RT105_TELAR') return 'yRight'
    return 'yLeft'
  }

  const datasets = metricasSeleccionadas.value.map(key => {
    const info = getMetricaInfo(key)
    if (!info) return null

    let data
    if (tipoNormalizacion.value === 'normalizada' && rangos.value[key]) {
      const { min, max } = rangos.value[key]
      data = datos.value.map(d => normalizar(d[key], min, max))
    } else if (tipoNormalizacion.value === 'zscore' && rangos.value[key]) {
      const valores = datos.value.map(d => d[key])
      const std = calcularStd(valores)
      const avg = rangos.value[key].avg
      data = datos.value.map(d => zScore(d[key], avg, std))
    } else {
      data = datos.value.map(d => d[key])
    }

    const isEficiencia = key === 'EFICIENCIA_TELAR'
    const useBar = useDualAxis && isEficiencia

    return {
      type: useBar ? 'bar' : 'line',
      label: info.label,
      data,
      yAxisID: axisForKey(key),
      borderColor: info.color,
      backgroundColor: useBar ? info.color + '80' : info.color + '20',
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: useBar ? 0 : 0.3,
      fill: false,
      ...(useBar ? { barPercentage: 0.7, categoryPercentage: 0.8 } : {})
    }
  }).filter(Boolean)


  const xTickRotation = labels.length > 14 ? 90 : 0

  chartInstance = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false // Usamos leyenda personalizada
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const key = metricasSeleccionadas.value[context.datasetIndex]
              const valorOriginal = datos.value[context.dataIndex]?.[key]
              const info = getMetricaInfo(key)
              
              if (tipoNormalizacion.value === 'original') {
                return `${info?.label}: ${formatNumber(valorOriginal)}`
              } else {
                return `${info?.label}: ${formatNumber(context.parsed.y)} (orig: ${formatNumber(valorOriginal)})`
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: xTickRotation, minRotation: xTickRotation, font: { size: 10 } }
        },
        ...(useDualAxis ? {
          yLeft: {
            type: 'linear',
            position: 'left',
            title: { display: true, text: 'Eficiencia %' },
            grid: { color: '#f1f5f9' }
          },
          yRight: {
            type: 'linear',
            position: 'right',
            title: { display: true, text: 'RU/RT 10^5' },
            grid: { drawOnChartArea: false }
          }
        } : {
          y: {
            title: {
              display: true,
              text: tipoNormalizacion.value === 'normalizada' ? 'Valor Normalizado (%)' :
                    tipoNormalizacion.value === 'zscore' ? 'Z-Score (σ)' : 'Valor Original'
            },
            grid: { color: '#f1f5f9' }
          }
        })
      }
    }
  })
}

// Watch para actualizar gráfico cuando cambian las selecciones
watch([metricasSeleccionadas, tipoNormalizacion], () => {
  if (datos.value.length > 0) {
    renderizarGrafico()
  }
}, { deep: true })

onMounted(() => {
  cargarDatos()
})

onUnmounted(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>

<style scoped>
input[type="checkbox"] {
  width: 14px;
  height: 14px;
}
</style>
