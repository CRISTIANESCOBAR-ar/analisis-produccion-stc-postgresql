<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <!-- Header con filtros -->
      <div v-if="!articuloSeleccionado" class="flex items-center justify-between gap-4 flex-shrink-0 mb-2">
        <h3 class="text-lg font-semibold text-slate-800">Análisis de Mesa de Test</h3>
        
        <div class="relative flex-1 max-w-md mx-4">
          <div class="relative">
            <span class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input 
              v-model="filtroTexto" 
              type="text" 
              placeholder="Buscar por artículo, nombre, color o trama..." 
              class="w-full pl-9 pr-8 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
            <button 
              v-if="filtroTexto" 
              @click="filtroTexto = ''" 
              class="absolute inset-y-0 right-0 pr-2 flex items-center text-slate-400 hover:text-slate-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <input 
              v-model="filtroEnProduccion" 
              type="checkbox" 
              id="chkEnProduccion"
              class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2"
            />
            <label for="chkEnProduccion" class="text-sm text-slate-600 cursor-pointer select-none">En Producción</label>
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm text-slate-600">Desde:</label>
            <input 
              v-model="fechaInicial" 
              type="date" 
              @change="cargarListaArticulos"
              class="px-2 py-1 border border-slate-300 rounded-md text-sm"
            />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-sm text-slate-600">Hasta:</label>
            <input 
              v-model="fechaFinal" 
              type="date" 
              @change="cargarListaArticulos"
              class="px-2 py-1 border border-slate-300 rounded-md text-sm"
            />
          </div>
        </div>
      </div>

      <!-- Lista de Artículos (vista principal) -->
      <div v-if="!articuloSeleccionado" class="flex-1 min-h-0 flex flex-col">
        <!-- Tabla de artículos -->
        <div class="overflow-auto w-full flex-1 min-h-0 rounded-xl border border-slate-200 pb-0">
          <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
            <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-20">
              <tr>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Articulo')">
                  Artículo {{ sortIcon('Articulo') }}
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Color')">
                  Color {{ sortIcon('Color') }}
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Id')">
                  ID {{ sortIcon('Id') }}
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Nombre')">
                  Nombre {{ sortIcon('Nombre') }}
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Trama')">
                  Trama {{ sortIcon('Trama') }}
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Metros_TEST')">
                  Metros TEST {{ sortIcon('Metros_TEST') }}
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Metros_REV')">
                  Metros REV {{ sortIcon('Metros_REV') }}
                </th>
                <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200 cursor-pointer hover:bg-slate-200" @click="toggleSort('Prod')">
                  Prod. {{ sortIcon('Prod') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="loadingLista">
                <td colspan="8" class="px-2 py-4 text-center text-slate-500">
                  <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
                  <p class="mt-2">Cargando artículos...</p>
                </td>
              </tr>
              <tr v-else-if="articulosFiltrados.length === 0">
                <td colspan="8" class="px-2 py-4 text-center text-slate-500">
                  No hay artículos disponibles para la fecha seleccionada
                </td>
              </tr>
              <tr 
                v-else
                v-for="item in articulosFiltrados" 
                :key="item.ARTIGO_COMPLETO"
                @click="seleccionarArticulo(item)"
                class="border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150 cursor-pointer"
              >
                <td class="px-2 py-2 text-center text-slate-700 font-mono">{{ item.Articulo }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ item.Color || '-' }}</td>
                <td class="px-2 py-2 text-center text-slate-700 font-semibold">{{ item.Id || '-' }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ item.Nombre || '-' }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ item.Trama || '-' }}</td>
                <td class="px-2 py-2 text-center text-slate-700 font-mono">{{ formatNumber(item.Metros_TEST) }}</td>
                <td class="px-2 py-2 text-center text-slate-700 font-mono">{{ formatNumber(item.Metros_REV) }}</td>
                <td class="px-2 py-2 text-center text-slate-700">{{ item.Prod || '-' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Vista de Gráfico (cuando se selecciona un artículo) -->
      <div v-else class="flex-1 min-h-0 flex flex-col relative overflow-hidden">
        <!-- Toolbar Flotante -->
        <div class="bg-white/95 backdrop-blur shadow-md border-b border-slate-200 px-3 py-2 flex flex-nowrap items-center gap-2 mb-2">
          <button 
            @click="volverALista" 
            class="p-1.5 bg-slate-600 text-white rounded-md hover:bg-slate-700 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          
          <div class="flex-1 flex flex-nowrap items-center gap-2">
            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-600 font-medium whitespace-nowrap">Inicio:</label>
              <input 
                v-model="fechaInicial" 
                type="date" 
                class="px-2 py-1 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div class="flex items-center gap-2">
              <label class="text-xs text-slate-600 font-medium whitespace-nowrap">Hasta:</label>
              <input 
                v-model="fechaFinal" 
                type="date" 
                class="px-2 py-1 border border-slate-300 rounded-md text-sm"
              />
            </div>

            <div class="flex items-center gap-1.5">
              <label class="text-xs text-slate-600 font-medium whitespace-nowrap">Métrica:</label>
              <select v-model="metricaActiva" class="px-2 py-1.5 border border-slate-300 rounded-md text-sm max-w-[180px] truncate">
                <option v-for="m in metricas" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>

            <div class="flex items-center gap-1.5">
              <label class="text-xs text-slate-600 font-medium whitespace-nowrap">Aprob:</label>
              <select v-model="filtroAprobacion" class="px-2 py-1.5 border border-slate-300 rounded-md text-sm max-w-[100px]">
                <option value="A">Aprobado</option>
                <option value="R">Reprobado</option>
                <option value="all">Todos</option>
              </select>
            </div>

            <div class="flex items-center gap-1.5">
              <label class="text-xs text-slate-600 font-medium whitespace-nowrap">Repr:</label>
              <select v-model="filtroReproceso" class="px-2 py-1.5 border border-slate-300 rounded-md text-sm max-w-[120px]">
                <option value="sin">Sin Reprocesos</option>
                <option value="con">Con Reprocesos</option>
                <option value="all">Todos</option>
              </select>
            </div>
            
            <button 
              @click="loadData" 
              class="p-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center flex-shrink-0 ml-auto"
              :disabled="loading"
            >
              <svg v-if="loading" class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Contenido Principal -->
        <div class="flex-1 min-h-0 flex flex-col pt-2">
          <!-- Indicador de carga del gráfico -->
          <div v-if="loading" class="flex-1 flex items-center justify-center">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-blue-600"></div>
              <p class="mt-3 text-sm text-slate-600">Cargando datos del gráfico...</p>
            </div>
          </div>

          <!-- Error -->
          <div v-else-if="error" class="flex-1 flex items-center justify-center">
            <div class="text-center p-6 bg-red-50 border border-red-200 rounded-md max-w-md">
              <div class="text-red-700 font-semibold mb-2">Error al cargar datos</div>
              <div class="text-red-600 text-sm">{{ error }}</div>
              <button @click="loadData" class="mt-4 px-4 py-2 bg-red-600 text-white rounded text-sm">
                Reintentar
              </button>
            </div>
          </div>

          <!-- Gráfico -->
          <div v-else-if="datos.length > 0" class="flex-1 min-h-0 flex flex-col">
            <!-- Stats resumen -->
            <div class="mb-2 p-2 bg-slate-50 border border-slate-200 rounded-md flex items-center gap-6 text-sm flex-shrink-0">
              <div class="font-semibold text-slate-700">{{ articuloSeleccionado.Articulo }} - {{ articuloSeleccionado.Nombre || 'Sin nombre' }}</div>
              <div class="text-slate-600"><span class="font-semibold">Total ensayos:</span> {{ datosGrafico.length }}</div>
              <div class="text-slate-600"><span class="font-semibold">Período:</span> {{ periodoTexto }}</div>
            </div>

            <!-- Canvas para Chart.js -->
            <div class="flex-1 min-h-0 relative" style="min-height: 400px;">
              <canvas ref="chartCanvas" style="max-height: 100%;"></canvas>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick, computed } from 'vue'
import { Chart, registerables } from 'chart.js'
import { formatNumber as formatNum } from '@/utils/formatters'

Chart.register(...registerables)

// Estrategia despliegue (Podman/servidor): usar misma origin y rutas relativas.
// En dev, Vite ya proxyfía /api hacia el backend. Si alguna vez se necesita,
// se puede fijar VITE_API_BASE en build (ej: https://mi-servidor).
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

const apiUrl = (path) => `${API_BASE}${path}`

// Estado reactivo - Lista de artículos
const listaArticulos = ref([])
const loadingLista = ref(false)
const sortState = ref([{ key: 'Nombre', dir: 'asc' }])
const filtroTexto = ref('')
const filtroEnProduccion = ref(true)
const articuloSeleccionado = ref(null)

// Estado reactivo - Gráfico
const fechaInicial = ref('2024-01-01')
const fechaFinal = ref(new Date().toISOString().split('T')[0])
const metricaActiva = ref('Ancho_MESA')
const filtroAprobacion = ref('A')
const filtroReproceso = ref('sin')
const datos = ref([])
const loading = ref(false)
const error = ref(null)
const chartCanvas = ref(null)
let chartInstance = null

// Métricas disponibles con campos MIN/STD/MAX
const metricas = [
  { label: 'Ancho - Mesa de Revisión', value: 'Ancho_MESA', min: 'Ancho_MIN', std: 'Ancho_STD', max: 'Ancho_MAX' },
  { label: 'Peso - Mesa de Revisión', value: 'Peso_MESA', min: 'Peso_MIN', std: 'Peso_STD', max: 'Peso_MAX' },
  { label: 'Ancho [cm] - Mesa de TEST', value: 'Ancho_TEST', min: 'Ancho_MIN', std: 'Ancho_STD', max: 'Ancho_MAX' },
  { label: 'Peso [gr/m²] - Mesa de TEST', value: 'Peso_TEST', min: 'Peso_MIN', std: 'Peso_STD', max: 'Peso_MAX' },
  { label: 'Potencial [%] - Mesa de TEST', value: 'Potencial', min: null, std: 'Potencial_STD', max: null },
  { label: 'Encogimiento Urdimbre %', value: 'ENC_URD_%', min: 'ENC_URD_MIN_%', std: 'ENC_URD_STD_%', max: 'ENC_URD_MAX_%' },
  { label: 'Encogimiento Trama %', value: 'ENC_TRA_%', min: 'ENC_TRA_MIN_%', std: 'ENC_TRA_STD_%', max: 'ENC_TRA_MAX_%' },
  { label: 'SK1 [%] - Mesa de TEST', value: '%_SK1', min: 'Skew_MIN', std: 'Skew_STD', max: 'Skew_MAX' },
  { label: 'SK2 [%] - Mesa de TEST', value: '%_SK2', min: 'Skew_MIN', std: 'Skew_STD', max: 'Skew_MAX' },
  { label: 'SK3 [%] - Mesa de TEST', value: '%_SK3', min: 'Skew_MIN', std: 'Skew_STD', max: 'Skew_MAX' },
  { label: 'SK4 [%] - Mesa de TEST', value: '%_SK4', min: 'Skew_MIN', std: 'Skew_STD', max: 'Skew_MAX' },
  { label: 'Skew %', value: '%_SKE', min: 'Skew_MIN', std: 'Skew_STD', max: 'Skew_MAX' },
  { label: 'Variación Stretch Trama %', value: '%_STT', min: '%_STT_MIN', std: '%_STT_STD', max: '%_STT_MAX' },
  { label: 'Pasadas Terminadas', value: 'Pasadas_Terminadas', min: 'Pasadas_MIN', std: 'Pasadas_STD', max: 'Pasadas_MAX' },
  { label: 'MESA de REVISIÓN - Peso [Oz/Yd²]', value: 'Peso_MESA_OzYd²', min: 'Peso_MIN_OzYd²', std: 'Peso_STD_OzYd²', max: 'Peso_MAX_OzYd²' }
]

// Computed: datos filtrados para el gráfico
const datosGrafico = computed(() => {
  return datos.value.filter(d => {
    if (filtroAprobacion.value !== 'all') {
      if (d.Ap !== filtroAprobacion.value) return false
    }

    if (filtroReproceso.value === 'sin') {
      if (d.R && d.R.trim() === 'R') return false
    } else if (filtroReproceso.value === 'con') {
      if (!d.R || d.R.trim() !== 'R') return false
    }

    return true
  })
})

// Computed: artículos filtrados y ordenados
const articulosFiltrados = computed(() => {
  let lista = [...listaArticulos.value]
  
  if (filtroTexto.value) {
    const buscar = filtroTexto.value.toLowerCase()
    lista = lista.filter(item => 
      (item.Articulo || '').toLowerCase().includes(buscar) ||
      (item.Nombre || '').toLowerCase().includes(buscar) ||
      (item.Color || '').toLowerCase().includes(buscar) ||
      (item.Trama || '').toLowerCase().includes(buscar)
    )
  }

  if (filtroEnProduccion.value) {
    lista = lista.filter(item => item.Prod === 'S')
  }
  
  if (sortState.value.length > 0) {
    lista.sort((a, b) => {
      for (const { key, dir } of sortState.value) {
        const aVal = a[key]
        const bVal = b[key]
        let cmp = 0
        if (key === 'Metros_TEST' || key === 'Metros_REV' || key === 'Id') {
          const aNum = Number(aVal || 0)
          const bNum = Number(bVal || 0)
          cmp = aNum - bNum
        } else {
          const aStr = (aVal ?? '').toString()
          const bStr = (bVal ?? '').toString()
          cmp = aStr.localeCompare(bStr)
        }
        if (cmp !== 0) {
          return dir === 'asc' ? cmp : -cmp
        }
      }
      return 0
    })
  }
  
  return lista
})

const toggleSort = (key) => {
  const idx = sortState.value.findIndex(s => s.key === key)
  if (idx === -1) {
    // No estaba ordenado, agregar ASC
    sortState.value = [{ key, dir: 'asc' }]
    return
  }
  const current = sortState.value[idx]
  if (current.dir === 'asc') {
    // Cambiar a DESC
    sortState.value = [{ key, dir: 'desc' }]
  } else {
    // Quitar ordenamiento (triple estado)
    sortState.value = []
  }
}

const sortIcon = (key) => {
  const s = sortState.value.find(x => x.key === key)
  if (!s) return ''
  return s.dir === 'asc' ? '↑' : '↓'
}

// Computed: texto del período
const periodoTexto = computed(() => {
  if (datosGrafico.value.length === 0) return '-'
  const fechas = datosGrafico.value.map(d => d.Fecha).filter(Boolean).sort()
  if (fechas.length === 0) return '-'
  const primera = formatFechaCorta(fechas[0])
  const ultima = formatFechaCorta(fechas[fechas.length - 1])
  return primera === ultima ? primera : `${primera} - ${ultima}`
})

const formatFechaCorta = (iso) => {
  if (!iso || typeof iso !== 'string') return '-'
  const parts = iso.split('-')
  if (parts.length !== 3) return iso
  const [y, m, d] = parts
  return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y.slice(-2)}`
}

const formatNumber = formatNum

const cargarListaArticulos = async () => {
  if (!fechaInicial.value) {
    error.value = 'Debes ingresar una fecha inicial'
    return
  }

  loadingLista.value = true

  try {
    let url = apiUrl(`/api/produccion/calidad/articulos-mesa-test?fecha_inicial=${fechaInicial.value}`)
    if (fechaFinal.value) {
      url += `&fecha_final=${fechaFinal.value}`
    }
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Error HTTP: ${response.status}`)
    }

    const data = await response.json()
    listaArticulos.value = data
    console.log(`Cargados ${data.length} artículos`)

  } catch (err) {
    console.error('Error cargando lista de artículos:', err)
    error.value = err.message
    listaArticulos.value = []
  } finally {
    loadingLista.value = false
  }
}

const seleccionarArticulo = (item) => {
  articuloSeleccionado.value = item
  loadData()
}

const volverALista = () => {
  articuloSeleccionado.value = null
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  datos.value = []
}

const loadData = async () => {
  if (!articuloSeleccionado.value || !fechaInicial.value) {
    error.value = 'Debes seleccionar un artículo'
    return
  }
  
  const articulo = articuloSeleccionado.value.ARTIGO_COMPLETO

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  loading.value = true
  error.value = null

  try {
    let url = apiUrl(`/api/produccion/calidad/analisis-mesa-test?articulo=${encodeURIComponent(articulo)}&fecha_inicial=${fechaInicial.value}`)
    if (fechaFinal.value) {
      url += `&fecha_final=${fechaFinal.value}`
    }
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || `Error HTTP: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data || data.length === 0) {
      error.value = `No se encontraron datos para el artículo "${articulo}" en el período seleccionado`
      datos.value = []
      return
    }
    
    datos.value = data
    loading.value = false
    
    await nextTick()
    await nextTick()
    
    let intentos = 0
    while (!chartCanvas.value && intentos < 5) {
      await new Promise(resolve => setTimeout(resolve, 100))
      intentos++
    }
    
    if (!chartCanvas.value) {
      error.value = 'Error: No se pudo inicializar el área del gráfico'
      return
    }
    
    renderChart()

  } catch (err) {
    console.error('Error cargando datos:', err)
    error.value = err.message
    datos.value = []
    loading.value = false
  }
}

const renderChart = () => {
  if (!chartCanvas.value || datosGrafico.value.length === 0) {
    if (chartInstance) {
      chartInstance.destroy()
      chartInstance = null
    }
    return
  }

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const metricaConfig = metricas.find(m => m.value === metricaActiva.value)
  if (!metricaConfig) return

  const labels = datosGrafico.value.map(d => d.Fecha || '-')
  const valoresReales = datosGrafico.value.map(d => d[metricaActiva.value])
  const valoresMin = datosGrafico.value.map(d => d[metricaConfig.min])
  const valoresStd = datosGrafico.value.map(d => d[metricaConfig.std])
  const valoresMax = datosGrafico.value.map(d => d[metricaConfig.max])
  
  const calcularRotacion = () => {
    const numLabels = labels.length
    const canvasWidth = chartCanvas.value.clientWidth || 1000
    const espacioPorLabel = canvasWidth / numLabels
    
    if (espacioPorLabel > 60) {
      return { min: 0, max: 0 }
    } else if (espacioPorLabel < 40) {
      return { min: 90, max: 90 }
    } else {
      return { min: 45, max: 45 }
    }
  }
  
  const rotacion = calcularRotacion()
  
  try {
    const ctx = chartCanvas.value.getContext('2d')
    
    chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Valor Real',
            data: valoresReales,
            borderColor: 'rgb(37, 99, 235)',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 2,
            pointHoverBackgroundColor: 'rgb(37, 99, 235)',
            pointHoverBorderColor: 'white',
            tension: 0.3
          },
          {
            label: 'Límite Mínimo',
            data: valoresMin,
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Estándar',
            data: valoresStd,
            borderColor: 'rgb(34, 197, 94)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false
          },
          {
            label: 'Límite Máximo',
            data: valoresMax,
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          datalabels: {
            display: false
          },
          legend: {
            display: true,
            position: 'bottom',
            labels: {
              usePointStyle: true,
              pointStyle: 'line',
              padding: 20
            }
          },
          title: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            padding: 12,
            titleColor: 'white',
            titleFont: {
              size: 13,
              weight: 'bold'
            },
            bodyColor: 'white',
            bodyFont: {
              size: 12
            },
            bodySpacing: 6,
            borderColor: 'rgba(255, 255, 255, 0.2)',
            borderWidth: 1,
            displayColors: true,
            callbacks: {
              title: (items) => {
                if (!items || items.length === 0) return ''
                const lbl = items[0].label
                return formatFechaCorta(lbl)
              },
              label: (context) => {
                const datasetLabel = context.dataset.label || ''
                const value = context.parsed.y
                if (datasetLabel === 'Valor Real') {
                  return `${datasetLabel}: ${value.toFixed(2)}`
                }
                return `${datasetLabel}: ${value}`
              },
              afterBody: (items) => {
                if (!items || items.length === 0) return []
                const index = items[0].dataIndex
                const dato = datosGrafico.value[index]
                return [
                  '',
                  `Partida: ${dato.Partida || '-'}`,
                  `Máquina: ${dato.Maquina || '-'}`
                ]
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: false
            },
            ticks: {
              maxRotation: rotacion.max,
              minRotation: rotacion.min,
              autoSkip: true,
              maxTicksLimit: rotacion.max === 0 ? 20 : undefined,
              callback: (value, index) => {
                const lbl = labels[index]
                return formatFechaCorta(lbl)
              }
            }
          },
          y: {
            title: {
              display: true,
              text: metricaConfig.label
            }
          }
        }
      }
    })
  } catch (err) {
    console.error('Error creando Chart.js:', err)
    error.value = `Error renderizando gráfico: ${err.message}`
  }
}

watch([metricaActiva, filtroAprobacion, filtroReproceso], () => {
  if (datos.value.length > 0 && chartCanvas.value) {
    renderChart()
  }
})

watch(chartCanvas, (newVal) => {
  if (newVal && datos.value.length > 0 && !chartInstance && !loading.value) {
    nextTick(() => renderChart())
  }
})

onMounted(() => {
  if (fechaInicial.value) {
    cargarListaArticulos()
  }
})

onBeforeUnmount(() => {
  if (chartInstance) {
    chartInstance.destroy()
  }
})
</script>
