<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main
      ref="mainContentRef"
      class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col relative"
    >
      <!-- Header -->
      <div class="flex flex-col gap-2 flex-shrink-0 mb-3">

        <!-- Fila: logo + título + búsqueda -->
        <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-8 lg:h-10 w-auto object-contain" />
            <div>
              <h3 class="text-base lg:text-lg font-semibold text-slate-800">Verificación Partidas + RTF</h3>
              <p class="text-xs text-slate-500">ROLADA ÍNDIGO — cobertura de archivos Benninger</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <label for="rolada-vpr" class="text-sm font-medium text-slate-700 whitespace-nowrap">ROLADA:</label>
            <input
              id="rolada-vpr"
              v-model.number="roladaInput"
              type="number"
              placeholder="N° Rolada"
              min="1"
              class="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-28 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              @keyup.enter="buscarRolada"
            />
            <button
              @click="buscarRolada"
              :disabled="!roladaInput || cargando"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
              v-tippy="{ content: 'Buscar partidas e inspeccionar cobertura RTF', placement: 'bottom' }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              Buscar
            </button>
          </div>
        </div>

        <!-- Fila: badges de resumen + leyenda -->
        <div v-if="filas.length > 0" class="flex flex-wrap items-center gap-x-4 gap-y-2">
          <!-- Stats -->
          <div class="flex flex-wrap gap-1.5 text-xs">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
              📋 {{ stats.totalPartidas }} partidas en prod.
            </span>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 font-semibold">
              ✓ {{ stats.conRtf }} con RTF
            </span>
            <span
              v-if="stats.sinRtf > 0"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-semibold"
            >
              ✗ {{ stats.sinRtf }} sin RTF
            </span>
            <span
              v-if="stats.rtfHuerfanos > 0"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold"
            >
              ? {{ stats.rtfHuerfanos }} RTF {{ stats.rtfHuerfanos === 1 ? 'huérfano' : 'huérfanos' }}
            </span>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
              🗃 {{ stats.totalRtf }} archivos RTF
            </span>
          </div>
          <!-- Leyenda -->
          <div class="flex flex-wrap gap-3 text-xs text-slate-500">
            <span class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded-sm bg-green-100 border border-green-400"></span>
              matched
            </span>
            <span class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded-sm bg-red-100 border border-red-400"></span>
              sin RTF
            </span>
            <span class="flex items-center gap-1">
              <span class="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-400"></span>
              RTF huérfano
            </span>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div
        v-if="cargando"
        class="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-50 rounded-2xl"
      >
        <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
          <span class="text-xl text-slate-800 font-bold">Consultando...</span>
        </div>
      </div>

      <!-- Tabla -->
      <div v-if="filas.length > 0" class="flex-1 overflow-auto min-h-0 border border-slate-200 rounded-lg">
        <table class="w-full min-w-[1600px] text-xs text-left font-[Verdana]">
          <thead class="text-xs text-slate-700 bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-center w-8">St.</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200">Partida</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200">Base</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-center">Inicio Prod.</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-center">Fin Prod.</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-right">Metros</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-right">Veloc.</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 min-w-[280px]">Archivo RTF</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200">Receita</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-center">Inicio RTF</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-center">Fin RTF</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200 text-right">Score</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200">Confianza</th>
              <th class="px-2 py-2 font-bold border-b border-slate-200">Modo</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in filas"
              :key="i"
              :class="[rowBgClass(row), groupBorderClass(row, i)]"
              class="transition-colors"
            >
              <!-- Estado -->
              <td class="px-2 py-1.5 text-center">
                <span
                  :class="badgeClass(row)"
                  class="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold leading-none"
                  :title="rowTitle(row)"
                >{{ rowIcon(row) }}</span>
              </td>

              <!-- Datos de producción -->
              <td class="px-2 py-1.5 font-mono font-semibold text-slate-800">
                {{ formatPartida(row.PARTIDA) || '–' }}
              </td>
              <td class="px-2 py-1.5 text-slate-700 max-w-[120px] truncate" :title="row.BASE_URDUME || ''">
                {{ row.BASE_URDUME || '–' }}
              </td>
              <td class="px-2 py-1.5 text-center font-mono">{{ row.HORA_INICIAL || '–' }}</td>
              <td class="px-2 py-1.5 text-center font-mono">{{ row.HORA_FINAL || '–' }}</td>
              <td class="px-2 py-1.5 text-right font-mono">
                {{ row.METROS != null ? formatNumber(row.METROS) : '–' }}
              </td>
              <td class="px-2 py-1.5 text-right font-mono text-blue-700">
                {{ row.VELOC != null ? formatNumber(row.VELOC) : '–' }}
              </td>

              <!-- Datos RTF -->
              <td class="px-2 py-1.5 min-w-[280px] truncate text-slate-600" :title="row.SOURCE_FILE || ''">
                {{ row.SOURCE_FILE ? basename(row.SOURCE_FILE) : '–' }}
              </td>
              <td class="px-2 py-1.5 text-slate-600">{{ row.RECEITA || '–' }}</td>
              <td class="px-2 py-1.5 text-center font-mono text-slate-600" :title="row.COMECO_RAW || ''">
                {{ row.COMECO_FMT || '–' }}
              </td>
              <td class="px-2 py-1.5 text-center font-mono text-slate-600" :title="row.FIM_RAW || ''">
                {{ row.FIM_FMT || '–' }}
              </td>
              <td class="px-2 py-1.5 text-right font-mono">
                {{ row.MATCH_SCORE != null ? Number(row.MATCH_SCORE).toFixed(1) : '–' }}
              </td>
              <td class="px-2 py-1.5">
                <span
                  v-if="row.MATCH_CONFIDENCE"
                  :class="confidenceClass(row.MATCH_CONFIDENCE)"
                  class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                >{{ row.MATCH_CONFIDENCE }}</span>
                <span v-else class="text-slate-400">–</span>
              </td>
              <td class="px-2 py-1.5 text-slate-500">{{ row.MATCH_MODE || '–' }}</td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-100 font-bold text-slate-800 sticky bottom-0 shadow-inner">
            <tr>
              <td class="px-2 py-2" colspan="5">
                TOTAL — {{ stats.totalPartidas }} partidas · {{ filas.length }} filas
              </td>
              <td class="px-2 py-2 text-right font-mono">{{ formatNumber(totalMetros) }}</td>
              <td class="px-2 py-2" colspan="8"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Empty state -->
      <div v-else-if="!cargando && roladaBuscada" class="flex-1 flex flex-col items-center justify-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mb-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <p class="text-lg font-medium">Sin resultados</p>
        <p class="text-sm">No hay datos para ROLADA <span class="font-semibold">{{ roladaBuscada }}</span></p>
      </div>

      <!-- Initial state -->
      <div v-else-if="!cargando" class="flex-1 flex flex-col items-center justify-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mb-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <line x1="10" y1="9" x2="8" y2="9"></line>
        </svg>
        <p class="text-lg font-medium">Ingrese un número de ROLADA</p>
        <p class="text-sm">Muestra partidas de producción y su cobertura de archivos RTF Benninger</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import Swal from 'sweetalert2'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

const roladaInput = ref(null)
const roladaBuscada = ref(null)
const filas = ref([])
const cargando = ref(false)
const mainContentRef = ref(null)

// ─── Stats ───────────────────────────────────────────────────────────────────
const stats = computed(() => {
  const setProd    = new Set()
  const setConRtf  = new Set()
  let rtfHuerfanos = 0
  let totalRtf     = 0

  filas.value.forEach(row => {
    if (row.ROW_TYPE !== 'rtf_orphan' && row.PARTIDA) {
      setProd.add(row.PARTIDA)
    }
    if (row.ROW_TYPE === 'matched' && row.PARTIDA) {
      setConRtf.add(row.PARTIDA)
      totalRtf++
    }
    if (row.ROW_TYPE === 'rtf_orphan') {
      rtfHuerfanos++
      totalRtf++
    }
  })

  return {
    totalPartidas: setProd.size,
    conRtf:        setConRtf.size,
    sinRtf:        setProd.size - setConRtf.size,
    rtfHuerfanos,
    totalRtf
  }
})

// Total metros sin doble conteo (misma partida puede repetirse por múltiples RTFs)
const totalMetros = computed(() => {
  const seen = new Set()
  let total  = 0
  filas.value.forEach(row => {
    if (row.ROW_TYPE !== 'rtf_orphan' && row.PARTIDA && !seen.has(row.PARTIDA)) {
      seen.add(row.PARTIDA)
      total += parseFloat(row.METROS) || 0
    }
  })
  return total
})

// ─── Helpers de visualización ────────────────────────────────────────────────
function formatPartida(val) {
  if (!val) return ''
  return String(val).replace(/^0+/, '')
}

function formatNumber(num) {
  if (num === null || num === undefined || num === '') return ''
  const n = parseFloat(num)
  if (isNaN(n)) return ''
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n)
}

function basename(path) {
  if (!path) return ''
  return path.split(/[\\/]/).pop()
}

function rowBgClass(row) {
  switch (row.ROW_TYPE) {
    case 'matched':    return 'bg-green-50 hover:bg-green-100'
    case 'unmatched':  return 'bg-red-50 hover:bg-red-100'
    case 'rtf_orphan': return 'bg-amber-50 hover:bg-amber-100'
    default:           return 'bg-white hover:bg-slate-50'
  }
}

// Borde superior más grueso cuando cambia la PARTIDA (separador visual de grupos)
function groupBorderClass(row, index) {
  if (index === 0) return 'border-b border-slate-200'
  const prev = filas.value[index - 1]
  const currKey = row.PARTIDA || row.SOURCE_FILE || ''
  const prevKey = prev.PARTIDA || prev.SOURCE_FILE || ''
  return currKey !== prevKey
    ? 'border-t-2 border-slate-400 border-b border-slate-200'
    : 'border-b border-slate-100'
}

function badgeClass(row) {
  switch (row.ROW_TYPE) {
    case 'matched':    return 'bg-green-500 text-white'
    case 'unmatched':  return 'bg-red-500 text-white'
    case 'rtf_orphan': return 'bg-amber-500 text-white'
    default:           return 'bg-slate-400 text-white'
  }
}

function rowIcon(row) {
  switch (row.ROW_TYPE) {
    case 'matched':    return '✓'
    case 'unmatched':  return '✗'
    case 'rtf_orphan': return '?'
    default:           return '·'
  }
}

function rowTitle(row) {
  switch (row.ROW_TYPE) {
    case 'matched':    return 'Partida con archivo RTF asociado'
    case 'unmatched':  return 'Partida sin ningún archivo RTF'
    case 'rtf_orphan': return 'Archivo RTF cuya partida no existe en producción para esta rolada'
    default:           return ''
  }
}

function confidenceClass(confidence) {
  const c = String(confidence || '').toLowerCase()
  if (c === 'high'   || c === 'alta')  return 'bg-green-100 text-green-800'
  if (c === 'medium' || c === 'media') return 'bg-yellow-100 text-yellow-800'
  if (c === 'low'    || c === 'baja')  return 'bg-red-100 text-red-800'
  return 'bg-slate-100 text-slate-700'
}

// ─── Búsqueda ────────────────────────────────────────────────────────────────
async function buscarRolada() {
  if (!roladaInput.value) {
    Swal.fire({
      icon: 'warning', title: 'Campo requerido',
      text: 'Por favor ingrese un número de ROLADA',
      toast: true, position: 'top-end',
      showConfirmButton: false, timer: 3000, timerProgressBar: true
    })
    return
  }

  cargando.value      = true
  roladaBuscada.value = roladaInput.value
  filas.value         = []

  try {
    const response = await fetch(
      `${API_URL}/produccion/partidas-rtf-por-rolada?rolada=${roladaInput.value}`
    )
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    filas.value = data

    if (data.length === 0) {
      Swal.fire({
        icon: 'info', title: 'Sin resultados',
        text: `No hay datos para ROLADA ${roladaInput.value}`,
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000, timerProgressBar: true
      })
    }
  } catch (error) {
    console.error('Error al buscar partidas RTF por rolada:', error)
    Swal.fire({
      icon: 'error', title: 'Error de conexión',
      text: 'No se pudo realizar la consulta. Verifique la conexión con la API.',
      toast: true, position: 'top-end',
      showConfirmButton: false, timer: 3000, timerProgressBar: true
    })
  } finally {
    cargando.value = false
  }
}
</script>
