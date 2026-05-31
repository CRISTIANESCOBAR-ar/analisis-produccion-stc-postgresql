<template>
  <div class="w-full h-screen px-2 md:px-4 py-3 flex flex-col relative">

    <!-- Overlay de carga -->
    <div v-if="loading" class="fixed inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-[9999]">
      <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
        <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Calculando mapa de calor</span>
          <span class="text-base text-slate-800 font-bold">{{ startDate }} → {{ endDate }}</span>
        </div>
      </div>
    </div>

    <!-- Barra de controles -->
    <div class="flex items-center gap-2 flex-wrap mb-3 bg-white rounded-xl shadow border border-slate-200 px-3 py-2 shrink-0">

      <!-- Presets de período -->
      <div class="flex rounded border border-slate-300 overflow-hidden text-xs">
        <button
          v-for="p in presets" :key="p.label"
          class="px-2.5 py-1.5 font-semibold border-r border-slate-300 last:border-0 transition-colors"
          :class="activePreset === p.label ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          @click="applyPreset(p)"
        >{{ p.label }}</button>
      </div>

      <!-- Rango personalizado -->
      <div class="flex items-center gap-1.5 text-xs">
        <span class="text-slate-400 whitespace-nowrap">Del</span>
        <input type="date" v-model="startDate" @change="onCustomDate"
          class="px-2 py-1 border border-slate-300 rounded text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
        <span class="text-slate-400">al</span>
        <input type="date" v-model="endDate" @change="onCustomDate"
          class="px-2 py-1 border border-slate-300 rounded text-xs text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" />
      </div>

      <!-- Divider -->
      <div class="w-px h-6 bg-slate-200 hidden sm:block"></div>

      <!-- Trama -->
      <select v-model="selectedTrama" @change="loadData"
        class="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500">
        <option v-for="t in availableTramas" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- TopN -->
      <div class="flex items-center gap-1.5 text-xs">
        <span class="text-slate-500 whitespace-nowrap">Top defectos:</span>
        <div class="flex rounded border border-slate-300 overflow-hidden">
          <button
            v-for="n in [5, 10, 15, 20]" :key="n"
            class="px-2 py-1 font-semibold border-r border-slate-300 last:border-0 transition-colors"
            :class="topN === n ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
            @click="topN = n"
          >{{ n }}</button>
        </div>
      </div>

      <!-- Ordenar por total -->
      <button
        @click="sortByTotal = !sortByTotal"
        class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded border transition-colors"
        :class="sortByTotal ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'"
      >
        <span>{{ sortByTotal ? '▼ Mayor problema primero' : '↑ Ordenar por Telar' }}</span>
      </button>

      <!-- Título -->
      <span class="ml-auto text-sm font-bold text-slate-700 hidden lg:block">🔥 Mapa Calor: Telar × Defecto</span>
      <span v-if="fetchError" class="text-[11px] text-red-500 ml-2">{{ fetchError }}</span>
    </div>

    <!-- Contenido principal -->
    <div class="flex-1 min-h-0 flex flex-col gap-2 overflow-hidden">

      <!-- Sin datos -->
      <div v-if="!loading && rawData.length === 0 && !fetchError" class="flex-1 flex flex-col items-center justify-center gap-3 text-slate-300">
        <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        <span class="text-sm">Sin datos para el período seleccionado</span>
      </div>

      <!-- Tabla de calor -->
      <div v-if="matrix.telares.length > 0" class="flex-1 min-h-0 overflow-auto bg-white rounded-xl shadow border border-slate-200">
        <table class="text-xs border-collapse">
          <!-- Encabezado sticky -->
          <thead class="sticky top-0 z-20">
            <tr class="bg-slate-50">
              <!-- Cabecera Telar (sticky izq) -->
              <th class="sticky left-0 z-30 bg-slate-100 px-3 py-2 border border-slate-300 text-slate-700 font-bold text-center whitespace-nowrap min-w-20">
                Telar
              </th>

              <!-- Cabeceras de defectos -->
              <th
                v-for="d in matrix.defectos" :key="d.desc_defeito"
                class="px-2 py-1.5 border border-slate-200 text-center bg-slate-50 min-w-20 max-w-28"
                :title="d.desc_defeito + ' (' + d.cod_def + ')'"
              >
                <div class="flex flex-col items-center gap-0.5">
                  <span
                    class="text-[9px] font-bold px-1 rounded whitespace-nowrap"
                    :class="{
                      'text-blue-600 bg-blue-50':     defectoSector(d.cod_def) === 'INDI',
                      'text-purple-600 bg-purple-50': defectoSector(d.cod_def) === 'HILA',
                      'text-green-700 bg-green-50':   defectoSector(d.cod_def) === 'TEJE',
                      'text-orange-600 bg-orange-50': defectoSector(d.cod_def) === 'ACAB',
                      'text-slate-400 bg-slate-100':  defectoSector(d.cod_def) === '—',
                    }"
                  >{{ defectoSector(d.cod_def) }}</span>
                  <span class="text-[10px] font-semibold text-slate-700 truncate max-w-24 block leading-tight text-left w-full" :title="d.desc_defeito">
                    {{ d.desc_defeito }}
                  </span>
                  <span class="text-[9px] text-slate-400 font-mono self-start">{{ d.cod_def }}</span>
                </div>
              </th>

              <!-- Cabecera Total (sticky der) -->
              <th class="sticky right-0 z-30 bg-blue-50 px-3 py-2 border border-blue-200 text-blue-800 font-bold text-center whitespace-nowrap min-w-18">
                TOTAL<br/><span class="text-[9px] font-normal text-blue-600">pts/100m²</span>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr
              v-for="(telar, ti) in sortedTelares" :key="telar"
              class="group hover:outline hover:outline-1 hover:outline-blue-300 hover:outline-offset-[-1px] transition-all"
            >
              <!-- Número de telar (sticky izq) -->
              <td class="sticky left-0 z-10 px-3 py-1.5 border border-slate-300 font-bold text-orange-700 text-center whitespace-nowrap"
                :class="ti % 2 === 0 ? 'bg-white' : 'bg-slate-50/80'">
                <span class="text-base">{{ String(telar).padStart(2, '0') }}</span>
              </td>

              <!-- Celdas de defecto -->
              <td
                v-for="d in matrix.defectos" :key="d.desc_defeito"
                class="px-1.5 py-1.5 border border-slate-200 text-center tabular-nums font-semibold transition-all cursor-default"
                :style="cellStyle(matrix.cells[telar]?.[d.desc_defeito])"
                :title="`Telar ${String(telar).padStart(2,'0')} · ${d.desc_defeito}\n${(matrix.cells[telar]?.[d.desc_defeito] || 0).toFixed(2)} pts/100m²`"
              >
                <template v-if="matrix.cells[telar]?.[d.desc_defeito]">
                  {{ matrix.cells[telar][d.desc_defeito].toFixed(1) }}
                </template>
                <template v-else>
                  <span class="text-slate-200 text-[9px] select-none">·</span>
                </template>
              </td>

              <!-- Fila Total (sticky der) -->
              <td class="sticky right-0 z-10 px-3 py-1.5 border border-blue-200 font-bold text-center tabular-nums"
                :class="[
                  ti % 2 === 0 ? 'bg-blue-50' : 'bg-blue-50/70',
                  rowTotalClass(matrix.totalByTelar[telar])
                ]">
                {{ (matrix.totalByTelar[telar] || 0).toFixed(1) }}
              </td>
            </tr>
          </tbody>

          <!-- Footer: totales por columna (pts crudos) -->
          <tfoot class="sticky bottom-0 z-20">
            <tr class="bg-slate-100">
              <td class="sticky left-0 z-30 bg-slate-100 px-2 py-1.5 border border-slate-300 text-slate-600 font-bold text-center text-[10px] whitespace-nowrap leading-tight">
                Total pts<br/>(todos los telares)
              </td>
              <td
                v-for="d in matrix.defectos" :key="d.desc_defeito"
                class="px-1.5 py-1.5 border border-slate-200 text-center tabular-nums text-slate-700 font-semibold text-[10px]"
              >
                {{ Number(matrix.totalByDefecto[d.desc_defeito] || 0).toLocaleString('es-AR') }}
              </td>
              <td class="sticky right-0 z-30 bg-blue-100 px-3 py-1.5 border border-blue-200 text-blue-800 font-bold text-center tabular-nums text-[10px]">
                {{ Number(Object.values(matrix.totalByDefecto).reduce((s, v) => s + v, 0)).toLocaleString('es-AR') }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Leyenda de colores + stats -->
      <div v-if="matrix.telares.length > 0" class="flex flex-wrap items-center gap-4 px-3 py-2 bg-white rounded-xl shadow border border-slate-200 shrink-0 text-xs">
        <span class="text-slate-500 font-semibold whitespace-nowrap">Escala Pts/100m²:</span>
        <div class="flex items-center gap-1">
          <div class="w-5 h-5 rounded border border-slate-200" style="background:hsl(120,60%,92%)"></div>
          <span class="text-slate-500">Bajo (&lt;2)</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-5 h-5 rounded border border-slate-200" style="background:hsl(80,70%,78%)"></div>
          <span class="text-slate-500">Medio (2–4)</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-5 h-5 rounded border border-slate-200" style="background:hsl(40,85%,65%)"></div>
          <span class="text-slate-500">Alto (4–7)</span>
        </div>
        <div class="flex items-center gap-1">
          <div class="w-5 h-5 rounded border border-slate-200" style="background:hsl(0,90%,52%)"></div>
          <span class="text-white text-[9px] font-bold -ml-5 pl-1 pr-0.5">{{ maxVal.toFixed(0) }}</span>
          <span class="text-slate-500">Crítico (máx)</span>
        </div>
        <span class="text-slate-300">|</span>
        <span class="text-slate-500">
          Máx actual: <strong class="text-red-600">{{ maxVal.toFixed(2) }}</strong> pts/100m²
        </span>
        <span class="text-slate-500">
          {{ matrix.telares.length }} telares × {{ matrix.defectos.length }} defectos
        </span>
        <span class="text-slate-400">
          {{ startDate }} → {{ endDate }}
        </span>
      </div>

    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL  = API_BASE ? `${API_BASE}/api` : '/api'

// ── Date helpers ───────────────────────────────────────────────────────────
function toIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const _today = new Date(); _today.setHours(0, 0, 0, 0)
const _yesterday = new Date(_today); _yesterday.setDate(_yesterday.getDate() - 1)

function daysAgo(n) {
  const d = new Date(_yesterday)
  d.setDate(d.getDate() - n + 1)
  return toIso(d)
}

// ── Estado ─────────────────────────────────────────────────────────────────
const startDate     = ref(daysAgo(30))
const endDate       = ref(toIso(_yesterday))
const activePreset  = ref('30d')
const selectedTrama = ref('Todas')
const availableTramas = ['Todas', 'ALG 100%', 'P + E', 'POL 100%']
const topN          = ref(10)
const sortByTotal   = ref(true)
const loading       = ref(false)
const fetchError    = ref('')
const rawData       = ref([])

// ── Period presets ────────────────────────────────────────────────────────
const presets = [
  { label: '7d',  days: 7  },
  { label: '15d', days: 15 },
  { label: '30d', days: 30 },
  { label: '3M',  days: 90 },
]

function applyPreset(p) {
  activePreset.value = p.label
  startDate.value    = daysAgo(p.days)
  endDate.value      = toIso(_yesterday)
  loadData()
}

function onCustomDate() {
  activePreset.value = 'custom'
  if (startDate.value && endDate.value) loadData()
}

// ── Sector de defecto ─────────────────────────────────────────────────────
function defectoSector(cod) {
  const first = String(cod || '').trim()[0]
  if (first === '1') return 'INDI'
  if (first === '2') return 'HILA'
  if (first === '3') return 'TEJE'
  if (first === '4') return 'ACAB'
  return '—'
}

// ── Pivot de filas planas → matriz ────────────────────────────────────────
const matrix = computed(() => {
  if (!rawData.value.length) return { telares: [], defectos: [], cells: {}, totalByTelar: {}, totalByDefecto: {} }

  // Sumar pts_totales por defecto (para rankear top-N)
  const defectoAgg  = {}
  const telarSet    = new Set()

  for (const row of rawData.value) {
    const t = Number(row.Telar)
    const d = row.desc_defeito
    if (!defectoAgg[d]) defectoAgg[d] = { cod_def: row.cod_def, pts: 0 }
    defectoAgg[d].pts += Number(row.pts_totales) || 0
    telarSet.add(t)
  }

  // Top N defectos ordenados por pts totales
  const topDefectos = Object.entries(defectoAgg)
    .sort((a, b) => b[1].pts - a[1].pts)
    .slice(0, topN.value)
    .map(([desc, info]) => ({ desc_defeito: desc, cod_def: info.cod_def }))

  const topSet = new Set(topDefectos.map(d => d.desc_defeito))

  // Construir celdas y totales
  const cells           = {}
  const totalByTelar    = {}
  const totalByDefecto  = {}

  for (const row of rawData.value) {
    if (!topSet.has(row.desc_defeito)) continue
    const t    = Number(row.Telar)
    const d    = row.desc_defeito
    const v100 = Number(row.pts_100m2) || 0
    const vpts = Number(row.pts_totales) || 0

    if (!cells[t]) cells[t] = {}
    cells[t][d] = v100

    // Total por telar: suma de pts_100m2 de todos los defectos visibles
    // (válido porque el denominador de área es el mismo para todos los defectos del mismo telar)
    totalByTelar[t] = (totalByTelar[t] || 0) + v100

    // Total por defecto: pts crudos acumulados (para el footer)
    totalByDefecto[d] = (totalByDefecto[d] || 0) + vpts
  }

  const telares = [...telarSet].sort((a, b) => a - b)

  return { telares, defectos: topDefectos, cells, totalByTelar, totalByDefecto }
})

// Telares ordenados (por total DESC o por número ASC)
const sortedTelares = computed(() => {
  if (!sortByTotal.value) return matrix.value.telares
  return [...matrix.value.telares].sort(
    (a, b) => (matrix.value.totalByTelar[b] || 0) - (matrix.value.totalByTelar[a] || 0)
  )
})

// Valor máximo pts_100m2 en toda la matriz (para escala de color)
const maxVal = computed(() => {
  if (!rawData.value.length) return 1
  return Math.max(...rawData.value.map(r => Number(r.pts_100m2) || 0), 1)
})

// ── Color de celda (HSL verde→rojo) ──────────────────────────────────────
function cellStyle(value) {
  if (!value || value <= 0) return { background: '#f8fafc', color: '#e2e8f0' }
  const ratio = Math.min(value / maxVal.value, 1)
  const hue   = Math.round(120 * (1 - ratio))       // 120=verde, 0=rojo
  const light = Math.round(92 - ratio * 38)          // 92% → 54%
  const sat   = Math.round(60 + ratio * 30)          // 60% → 90%
  return {
    background: `hsl(${hue}, ${sat}%, ${light}%)`,
    color: ratio > 0.55 ? '#ffffff' : '#1e293b',
  }
}

function rowTotalClass(value) {
  if (!value || value <= 0) return 'text-slate-400'
  const ratio = (value || 0) / (maxVal.value * topN.value)
  if (ratio >= 0.35) return 'text-red-700 text-base'
  if (ratio >= 0.18) return 'text-amber-700'
  return 'text-green-700'
}

// ── Carga de datos ─────────────────────────────────────────────────────────
async function loadData() {
  if (!startDate.value || !endDate.value) return
  loading.value    = true
  fetchError.value = ''
  rawData.value    = []
  try {
    const params = new URLSearchParams({ startDate: startDate.value, endDate: endDate.value })
    if (selectedTrama.value !== 'Todas') params.set('trama', selectedTrama.value)
    const res = await fetch(`${API_URL}/calidad/heatmap-telar-defecto?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    rawData.value = await res.json()
  } catch (e) {
    fetchError.value = `Error: ${e.message}`
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
/* Ensure sticky columns have correct layering */
thead tr th:first-child,
tbody tr td:first-child,
tfoot tr td:first-child { box-shadow: 2px 0 4px rgba(0,0,0,0.06); }

thead tr th:last-child,
tbody tr td:last-child,
tfoot tr td:last-child  { box-shadow: -2px 0 4px rgba(0,0,0,0.06); }

tbody tr:hover td { filter: brightness(0.94); }
</style>
