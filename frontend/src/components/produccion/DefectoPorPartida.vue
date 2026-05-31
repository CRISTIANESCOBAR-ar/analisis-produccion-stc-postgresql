<template>
  <div class="w-full h-screen px-2 md:px-4 py-3 flex flex-col relative">

    <!-- Overlay de carga (panel izquierdo) -->
    <div v-if="loadingDefectos" class="fixed inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-9999 transition-all duration-300">
      <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
        <div class="relative">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Cargando defectos de</span>
          <span class="text-xl text-slate-800 font-bold">{{ displayDate }}</span>
        </div>
      </div>
    </div>

    <!-- Barra de controles -->
    <div class="flex items-center gap-2 flex-wrap mb-3 bg-white rounded-xl shadow border border-slate-200 px-3 py-2 shrink-0">

      <!-- Datepicker -->
      <div class="custom-datepicker" ref="datepickerRef">
        <input
          ref="datepickerInputRef"
          type="text"
          :value="displayDate"
          class="datepicker-input-compact"
          placeholder="Selecciona una fecha"
          @click="toggleCalendar"
          @keydown.left.prevent="cambiarFecha(-1)"
          @keydown.right.prevent="cambiarFecha(1)"
          @blur="handleBlur"
          readonly
        />
        <span class="calendar-icon" @click="toggleCalendar">📅</span>
        <div v-if="showCalendar" class="calendar-dropdown">
          <div class="calendar-header">
            <button class="calendar-nav-btn" @click.stop="changeMonth(-1)">&lt;</button>
            <div class="calendar-selects">
              <select :value="calendarMonth" @change="updateMonth" @click.stop class="calendar-select">
                <option v-for="(m, i) in monthNames" :key="i" :value="i">{{ m }}</option>
              </select>
              <select :value="calendarYear" @change="updateYear" @click.stop class="calendar-select">
                <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>
            <button class="calendar-nav-btn" @click.stop="changeMonth(1)">&gt;</button>
          </div>
          <div class="calendar-weekdays">
            <span v-for="d in ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']" :key="d">{{ d }}</span>
          </div>
          <div class="calendar-days">
            <button
              v-for="day in calendarDays"
              :key="day.key"
              :class="['calendar-day', { 'other-month': day.otherMonth, selected: day.selected, today: day.today }]"
              @click.stop="selectDate(day)"
              :disabled="day.otherMonth"
            >{{ day.day }}</button>
          </div>
        </div>
      </div>

      <!-- Flechas día -->
      <button class="inline-flex items-center justify-center px-1.5 py-1.5 border border-slate-300 bg-linear-to-b from-slate-50 to-slate-100 text-slate-700 rounded text-xs font-bold hover:from-slate-100 hover:to-slate-200 transition-all" @click="cambiarFecha(-1)" @mousedown.prevent tabindex="-1" :disabled="loadingDefectos">&lt;</button>
      <button class="inline-flex items-center justify-center px-1.5 py-1.5 border border-slate-300 bg-linear-to-b from-slate-50 to-slate-100 text-slate-700 rounded text-xs font-bold hover:from-slate-100 hover:to-slate-200 transition-all" @click="cambiarFecha(1)"  @mousedown.prevent tabindex="-1" :disabled="loadingDefectos">&gt;</button>

      <!-- Toggle Día / Mes -->
      <div class="flex rounded border border-slate-300 overflow-hidden text-xs ml-1">
        <button
          class="px-3 py-1.5 font-semibold transition-colors"
          :class="mode === 'day' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          @click="setMode('day')"
        >Día</button>
        <button
          class="px-3 py-1.5 font-semibold border-l border-slate-300 transition-colors"
          :class="mode === 'month' ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'"
          @click="setMode('month')"
        >Mes</button>
      </div>

      <!-- Filtro Trama -->
      <select
        v-model="selectedTrama"
        @change="onTramaChange"
        class="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option v-for="t in availableTramas" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- Título -->
      <span class="ml-auto text-sm font-bold text-slate-700 hidden md:block">
        🔎 Defecto → Partidas – Tejeduría
      </span>

      <!-- Errores -->
      <span v-if="errorDefectos" class="text-[11px] text-red-500 ml-2">{{ errorDefectos }}</span>
    </div>

    <!-- Contenido: dos paneles -->
    <div class="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-3 flex-1 min-h-0 overflow-hidden">

      <!-- ── PANEL IZQUIERDO: Ranking de defectos ─────────────────────────── -->
      <div class="flex flex-col bg-white rounded-xl shadow border border-slate-200 overflow-hidden min-h-0">
        <div class="flex items-center justify-between bg-gray-100 text-slate-800 px-2 py-1.5 text-xs font-semibold border-b border-slate-200 shrink-0">
          <span>
            Pts/100m² por Defecto
            <span class="font-normal text-slate-500"> — {{ mode === 'day' ? displayDate : mesLabel }}</span>
            <span v-if="selectedTrama !== 'Todas'" class="ml-1 text-blue-600 font-normal">· {{ selectedTrama }}</span>
          </span>
          <span class="text-[10px] text-slate-400 font-normal shrink-0">Click para ver partidas</span>
        </div>

        <div class="overflow-auto flex-1 min-h-0">
          <div v-if="loadingDefectos" class="flex items-center justify-center py-10 text-xs text-slate-400">Cargando…</div>
          <table v-else-if="defectos.rows.length > 0" class="text-xs border-collapse w-full">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-50">
                <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-slate-400 whitespace-nowrap">COD</th>
                <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-slate-400 whitespace-nowrap">SEC</th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700">DEFECTO</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 whitespace-nowrap bg-blue-50">PTS/100M²</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap">TOTAL</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-600">%</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in defectos.rows"
                :key="row.desc_defeito"
                class="cursor-pointer transition-colors"
                :class="[
                  selectedDefecto === row.desc_defeito
                    ? 'bg-blue-100 ring-1 ring-inset ring-blue-400'
                    : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 hover:bg-blue-50'
                ]"
                @click="selectDefecto(row)"
              >
                <td class="px-2 py-1.5 border border-slate-200 text-center tabular-nums text-slate-400 font-mono text-[10px]">{{ row.cod_def }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-center text-[10px] font-bold whitespace-nowrap"
                  :class="{
                    'text-blue-600':   defectoSector(row.cod_def) === 'INDI',
                    'text-purple-600': defectoSector(row.cod_def) === 'HILA',
                    'text-green-700':  defectoSector(row.cod_def) === 'TEJE',
                    'text-orange-600': defectoSector(row.cod_def) === 'ACAB',
                    'text-slate-400':  defectoSector(row.cod_def) === '—',
                  }">{{ defectoSector(row.cod_def) }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-slate-800 whitespace-nowrap">
                  <span class="flex items-center gap-1">
                    <span v-if="selectedDefecto === row.desc_defeito" class="text-blue-500 text-[10px]">▶</span>
                    {{ row.desc_defeito }}
                  </span>
                </td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums font-semibold bg-blue-50"
                  :class="ptsColor(row.pts_100m2)">{{ Number(row.pts_100m2).toFixed(2) }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-800">{{ Number(row.pts_totales).toLocaleString('es-AR') }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600">{{ Number(row.porcentaje).toFixed(1) }}%</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-slate-100 font-bold sticky bottom-0 z-10">
                <td class="px-2 py-1.5 border border-slate-300" colspan="2"></td>
                <td class="px-2 py-1.5 border border-slate-300 text-slate-700">Total</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-blue-800 bg-blue-100">{{ Number(defectos.total.pts_100m2).toFixed(2) }}</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-800">{{ Number(defectos.total.pts_totales).toLocaleString('es-AR') }}</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-600">100%</td>
              </tr>
            </tfoot>
          </table>
          <div v-else-if="!loadingDefectos && !errorDefectos" class="flex items-center justify-center py-16 text-sm text-slate-400">
            Sin datos para {{ displayDate }}
          </div>
        </div>
      </div>

      <!-- ── PANEL DERECHO: Partidas con el defecto seleccionado ──────────── -->
      <div class="flex flex-col bg-white rounded-xl shadow border border-slate-200 overflow-hidden min-h-0">
        <div class="flex items-center justify-between bg-gray-100 text-slate-800 px-2 py-1.5 text-xs font-semibold border-b border-slate-200 shrink-0">
          <span v-if="selectedDefecto">
            Partidas · <span class="text-blue-700">{{ selectedDefecto }}</span>
            <span v-if="partidas.length" class="ml-1 text-slate-400 font-normal">({{ partidas.length }})</span>
          </span>
          <span v-else class="text-slate-400 font-normal">Selecciona un defecto del panel izquierdo</span>
          <span v-if="loadingPartidas" class="text-[10px] text-slate-400 italic">Cargando…</span>
          <span v-if="errorPartidas" class="text-[10px] text-red-500">{{ errorPartidas }}</span>
        </div>

        <div class="overflow-auto flex-1 min-h-0">

          <!-- Placeholder -->
          <div v-if="!selectedDefecto && !loadingPartidas" class="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span class="text-sm">Selecciona un defecto para ver las partidas involucradas</span>
          </div>

          <!-- Tabla de partidas -->
          <div v-if="loadingPartidas" class="flex items-center justify-center py-10 text-xs text-slate-400">Cargando partidas…</div>

          <table v-else-if="partidas.length > 0" class="text-xs border-collapse w-full">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-50">
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700 whitespace-nowrap">Partida</th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700">Nombre Artículo</th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-500 whitespace-nowrap">Trama</th>
                <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-orange-600 whitespace-nowrap">Telar</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap">Pts [un]</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 whitespace-nowrap bg-blue-50">Pts/100m²</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-amber-700 whitespace-nowrap">% del total</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap">Efic.%</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap">RU 105</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap">RT 105</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in partidas"
                :key="row.Partida"
                :class="i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 hover:bg-blue-50'"
                class="transition-colors"
              >
                <td class="px-2 py-1.5 border border-slate-200 font-mono font-semibold text-slate-800 whitespace-nowrap">{{ row.Partida }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-slate-700 max-w-48 truncate" :title="row.NombreArticulo">{{ row.NombreArticulo }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-slate-500 whitespace-nowrap text-[10px]">{{ row.Trama }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-center font-bold text-orange-700">{{ row.Telar || '—' }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-800">{{ Number(row.pts_defecto).toLocaleString('es-AR') }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums font-semibold bg-blue-50"
                  :class="ptsColor(row.pts_100m2_defecto)">{{ Number(row.pts_100m2_defecto).toFixed(2) }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums"
                  :class="Number(row.pct_del_total) >= 50 ? 'text-red-600 font-semibold' : Number(row.pct_del_total) >= 25 ? 'text-amber-600' : 'text-slate-600'">
                  {{ Number(row.pct_del_total).toFixed(1) }}%
                </td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ row.EficienciaPct != null ? Number(row.EficienciaPct).toFixed(1) + '%' : '—' }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ row.RU105 != null ? Number(row.RU105).toFixed(1) : '—' }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ row.RT105 != null ? Number(row.RT105).toFixed(1) : '—' }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-slate-100 font-bold sticky bottom-0 z-10">
                <td class="px-2 py-1.5 border border-slate-300 text-slate-700" colspan="4">Total ({{ partidas.length }} partidas)</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-800">{{ fmtInt(totalesPartidas.pts) }}</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-blue-800 bg-blue-100">{{ totalesPartidas.pts100.toFixed(2) }}</td>
                <td class="px-2 py-1.5 border border-slate-300" colspan="4"></td>
              </tr>
            </tfoot>
          </table>

          <!-- Sin partidas para defecto seleccionado -->
          <div v-else-if="selectedDefecto && !loadingPartidas && !errorPartidas" class="flex items-center justify-center py-16 text-sm text-slate-400">
            Sin partidas con "{{ selectedDefecto }}" en el período seleccionado.
          </div>

        </div>
      </div>

    </div><!-- fin dos paneles -->
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL  = API_BASE ? `${API_BASE}/api` : '/api'

// ── Fecha ──────────────────────────────────────────────────────────────────
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
const defaultDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

const selectedDate = ref(defaultDate)

// ── Modo & Trama ───────────────────────────────────────────────────────────
const mode            = ref('day')
const selectedTrama   = ref('Todas')
const availableTramas = ['Todas', 'ALG 100%', 'P + E', 'POL 100%']

// ── Estado panel izquierdo ────────────────────────────────────────────────
const loadingDefectos = ref(false)
const errorDefectos   = ref('')
const defectos        = ref({ rows: [], total: { pts_totales: 0, pts_100m2: 0, area_m2: 0 } })

// ── Estado panel derecho ──────────────────────────────────────────────────
const selectedDefecto  = ref(null)
const loadingPartidas  = ref(false)
const errorPartidas    = ref('')
const partidas         = ref([])

// ── Datepicker ─────────────────────────────────────────────────────────────
const showCalendar       = ref(false)
const calendarMonth      = ref(new Date().getMonth())
const calendarYear       = ref(new Date().getFullYear())
const datepickerRef      = ref(null)
const datepickerInputRef = ref(null)

const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const years = computed(() => {
  const cy = new Date().getFullYear()
  const arr = []
  for (let y = 2020; y <= cy + 1; y++) arr.push(y)
  return arr
})

const displayDate = computed(() => {
  if (!selectedDate.value) return ''
  try {
    const [year, month, day] = selectedDate.value.split('-').map(Number)
    const fecha = new Date(year, month - 1, day)
    const dias  = ['dom','lun','mar','mié','jue','vie','sáb']
    return `${dias[fecha.getDay()]} ${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`
  } catch { return '' }
})

const mesLabel = computed(() => {
  if (!selectedDate.value) return ''
  const [, m, d] = selectedDate.value.split('-').map(Number)
  return `${monthNames[m - 1]} (01/${String(m).padStart(2,'0')} – ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')})`
})

const calendarDays = computed(() => {
  const days    = []
  const first   = new Date(calendarYear.value, calendarMonth.value, 1)
  const last    = new Date(calendarYear.value, calendarMonth.value + 1, 0)
  const today   = new Date(); today.setHours(0,0,0,0)
  let selVal    = null
  if (selectedDate.value) {
    const [y, m, d] = selectedDate.value.split('-').map(Number)
    selVal = new Date(y, m - 1, d)
  }
  for (let i = 0; i < first.getDay(); i++) {
    const dt = new Date(calendarYear.value, calendarMonth.value, -first.getDay() + i + 1)
    days.push({ day: dt.getDate(), otherMonth: true, key: `prev-${i}` })
  }
  for (let i = 1; i <= last.getDate(); i++) {
    days.push({
      day: i, otherMonth: false,
      selected: selVal && selVal.getDate()===i && selVal.getMonth()===calendarMonth.value && selVal.getFullYear()===calendarYear.value,
      today: today.getDate()===i && today.getMonth()===calendarMonth.value && today.getFullYear()===calendarYear.value,
      key: `current-${i}`,
    })
  }
  const rem = 42 - days.length
  for (let i = 1; i <= rem; i++) days.push({ day: i, otherMonth: true, key: `next-${i}` })
  return days
})

function toggleCalendar() {
  showCalendar.value = !showCalendar.value
  if (showCalendar.value && selectedDate.value) {
    const [y, m] = selectedDate.value.split('-').map(Number)
    calendarMonth.value = m - 1
    calendarYear.value  = y
  }
}

function changeMonth(offset) {
  calendarMonth.value += offset
  if (calendarMonth.value > 11) { calendarMonth.value = 0; calendarYear.value++ }
  else if (calendarMonth.value < 0) { calendarMonth.value = 11; calendarYear.value-- }
}

function selectDate(day) {
  if (day.otherMonth) return
  const y = calendarYear.value
  const m = (calendarMonth.value + 1).toString().padStart(2, '0')
  const d = day.day.toString().padStart(2, '0')
  selectedDate.value = `${y}-${m}-${d}`
  showCalendar.value = false
  reloadAll()
}

function updateMonth(e) { calendarMonth.value = parseInt(e.target.value) }
function updateYear(e)  { calendarYear.value  = parseInt(e.target.value) }

function cambiarFecha(dias) {
  if (!selectedDate.value) return
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  fecha.setDate(fecha.getDate() + dias)
  const ny = fecha.getFullYear()
  const nm = (fecha.getMonth() + 1).toString().padStart(2, '0')
  const nd = fecha.getDate().toString().padStart(2, '0')
  selectedDate.value = `${ny}-${nm}-${nd}`
  reloadAll()
}

function handleBlur() {
  setTimeout(() => {
    if (datepickerRef.value && !datepickerRef.value.contains(document.activeElement)) {
      showCalendar.value = false
    }
  }, 250)
}

function handleClickOutside(event) {
  if (datepickerRef.value && !datepickerRef.value.contains(event.target)) {
    showCalendar.value = false
  }
}

// ── Modo y trama ───────────────────────────────────────────────────────────
function setMode(m) {
  mode.value = m
  reloadAll()
}

function onTramaChange() {
  reloadAll()
}

// ── Helpers de UI ──────────────────────────────────────────────────────────
function defectoSector(cod) {
  const first = String(cod || '').trim()[0]
  if (first === '1') return 'INDI'
  if (first === '2') return 'HILA'
  if (first === '3') return 'TEJE'
  if (first === '4') return 'ACAB'
  return '—'
}

function fmtInt(v) { return v != null ? Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—' }

function ptsColor(v) {
  const n = Number(v)
  if (n <= 0) return 'text-slate-400'
  if (n <= 3) return 'text-green-700'
  if (n <= 6) return 'text-amber-600'
  return 'text-red-600'
}

// ── Totales footer panel derecho ──────────────────────────────────────────
const totalesPartidas = computed(() => {
  const arr = partidas.value
  if (!arr.length) return { pts: 0, pts100: 0 }
  const pts     = arr.reduce((s, r) => s + (Number(r.pts_defecto) || 0), 0)
  // Pts/100m² del defecto sobre el total de área de todas las partidas
  // Como cada partida tiene su propia área, no podemos simplemente sumar — mostramos el promedio ponderado
  const areaSum = arr.reduce((s, r) => {
    // pts_100m2 = pts_defecto * 100 / area_m2 → area_m2 = pts_defecto * 100 / pts_100m2
    const p100 = Number(r.pts_100m2_defecto)
    return s + (p100 > 0 ? (Number(r.pts_defecto) * 100 / p100) : 0)
  }, 0)
  const pts100 = areaSum > 0 ? Math.round(pts * 100 / areaSum * 100) / 100 : 0
  return { pts, pts100 }
})

// ── Carga panel izquierdo ─────────────────────────────────────────────────
async function loadDefectos() {
  if (!selectedDate.value) return
  loadingDefectos.value = true
  errorDefectos.value   = ''
  defectos.value        = { rows: [], total: { pts_totales: 0, pts_100m2: 0, area_m2: 0 } }
  try {
    const params = new URLSearchParams({ date: selectedDate.value, mode: mode.value })
    if (selectedTrama.value !== 'Todas') params.set('trama', selectedTrama.value)
    const res = await fetch(`${API_URL}/calidad/defectos-por-tipo?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    defectos.value = await res.json()
  } catch (e) {
    errorDefectos.value = `Error: ${e.message}`
  } finally {
    loadingDefectos.value = false
  }
}

// ── Selección de defecto y carga del panel derecho ─────────────────────────
function selectDefecto(row) {
  if (selectedDefecto.value === row.desc_defeito) {
    // deseleccionar
    selectedDefecto.value = null
    partidas.value = []
    return
  }
  selectedDefecto.value = row.desc_defeito
  loadPartidas()
}

async function loadPartidas() {
  if (!selectedDate.value || !selectedDefecto.value) return
  loadingPartidas.value = true
  errorPartidas.value   = ''
  partidas.value        = []
  try {
    const params = new URLSearchParams({
      date:    selectedDate.value,
      mode:    mode.value,
      defecto: selectedDefecto.value,
    })
    if (selectedTrama.value !== 'Todas') params.set('trama', selectedTrama.value)
    const res = await fetch(`${API_URL}/calidad/partidas-por-defecto?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    partidas.value = await res.json()
  } catch (e) {
    errorPartidas.value = `Error: ${e.message}`
  } finally {
    loadingPartidas.value = false
  }
}

// ── Recarga completa (fecha/modo/trama cambian) ────────────────────────────
function reloadAll() {
  selectedDefecto.value = null
  partidas.value        = []
  loadDefectos()
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  loadDefectos()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.custom-datepicker { position: relative; display: inline-flex; align-items: center; }

.datepicker-input-compact {
  padding: 4px 28px 4px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-size: 11px;
  background: white;
  cursor: pointer;
  color: #334155;
  min-width: 140px;
  outline: none;
  transition: border-color 0.15s;
}
.datepicker-input-compact:hover { border-color: #94a3b8; }
.datepicker-input-compact:focus { border-color: #3b82f6; }

.calendar-icon { position: absolute; right: 6px; font-size: 13px; cursor: pointer; user-select: none; }

.calendar-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 1000;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 8px;
  min-width: 240px;
}

.calendar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.calendar-nav-btn { padding: 4px 8px; border: 1px solid #e2e8f0; background: white; border-radius: 4px; cursor: pointer; font-size: 11px; color: #475569; }
.calendar-nav-btn:hover { background: #f1f5f9; }
.calendar-selects { display: flex; gap: 4px; }
.calendar-select { padding: 2px 4px; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 11px; color: #374151; background: white; cursor: pointer; outline: none; }

.calendar-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; margin-bottom: 4px; }
.calendar-weekdays span { text-align: center; font-size: 9px; color: #94a3b8; font-weight: 600; padding: 2px; }

.calendar-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
.calendar-day { padding: 4px 2px; text-align: center; font-size: 10px; border: none; background: none; border-radius: 3px; cursor: pointer; color: #374151; transition: background 0.1s; }
.calendar-day:hover:not(:disabled) { background: #eff6ff; }
.calendar-day.selected { background: #2563eb; color: white; font-weight: 600; }
.calendar-day.today { font-weight: 700; color: #2563eb; }
.calendar-day.other-month { color: #cbd5e1; cursor: default; }
.calendar-day:disabled { cursor: default; }
</style>
