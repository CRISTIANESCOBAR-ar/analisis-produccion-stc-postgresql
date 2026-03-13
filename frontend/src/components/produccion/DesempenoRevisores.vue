<template>
  <div
    class="w-full h-screen flex flex-col p-1"
    @keydown="handleKeydown"
    tabindex="0"
    ref="containerRef"
  >
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col overflow-hidden">

      <!-- ── Header ─────────────────────────────────────────── -->
      <div class="flex items-center justify-between gap-4 mb-3 shrink-0">
        <div class="flex items-center gap-4 flex-wrap">
          <img src="/LogoSantana.jpg" alt="Logo Santana" class="h-8 w-auto object-contain shrink-0" />

          <!-- DatePicker -->
          <div class="filter-inline fecha-nav">
            <label class="sr-only">Fecha:</label>
            <div class="fecha-controls">
              <div class="custom-datepicker" ref="datepickerRef">
                <input
                  type="text"
                  v-model="displayDate"
                  class="filter-input datepicker-input"
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
                      <select :value="currentMonth.getMonth()" @change="updateMonth" @click.stop class="calendar-select">
                        <option v-for="(month, index) in monthNames" :key="index" :value="index">{{ month }}</option>
                      </select>
                      <select :value="currentMonth.getFullYear()" @change="updateYear" @click.stop class="calendar-select">
                        <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
                      </select>
                    </div>
                    <button class="calendar-nav-btn" @click.stop="changeMonth(1)">&gt;</button>
                  </div>
                  <div class="calendar-weekdays">
                    <span v-for="day in ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']" :key="day">{{ day }}</span>
                  </div>
                  <div class="calendar-days">
                    <button
                      v-for="day in calendarDays"
                      :key="day.key"
                      :class="['calendar-day', { 'other-month': day.otherMonth, 'selected': day.selected, 'today': day.today }]"
                      @click.stop="selectDate(day)"
                      :disabled="day.otherMonth"
                    >{{ day.day }}</button>
                  </div>
                </div>
              </div>
              <div class="flex gap-1.5">
                <button
                  class="inline-flex items-center justify-center px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm"
                  @click="cambiarFecha(-1)"
                  @mousedown.prevent
                  tabindex="-1"
                  :disabled="loading"
                >&lt;</button>
                <button
                  class="inline-flex items-center justify-center px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm"
                  @click="cambiarFecha(1)"
                  @mousedown.prevent
                  tabindex="-1"
                  :disabled="loading"
                >&gt;</button>
              </div>
            </div>
          </div>

          <span class="text-lg font-bold text-slate-700">Desempeño de Revisores</span>

          <span v-if="loading" class="text-xs text-slate-400 animate-pulse">Cargando...</span>
        </div>
      </div>

      <!-- ── Error ───────────────────────────────────────────── -->
      <div v-if="error" class="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 shrink-0">
        ⚠️ {{ error }}
      </div>

      <!-- ── Two-panel layout ────────────────────────────────── -->
      <div
        class="flex-1 min-h-0 overflow-hidden grid gap-2"
        :class="sidebarCollapsed ? 'grid-cols-[32px_1fr]' : 'grid-cols-1 lg:grid-cols-[420px_1fr]'"
        style="transition: grid-template-columns 0.2s ease;"
      >

        <!-- ── Left: summary table ──────────────────────────── -->
        <div class="flex flex-col gap-2 min-h-0 overflow-hidden">

          <!-- Collapsed strip -->
          <div
            v-if="sidebarCollapsed"
            class="flex flex-col items-center gap-2 h-full py-2"
          >
            <button
              @click="sidebarCollapsed = false"
              class="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700 shadow-sm transition-colors"
              title="Mostrar tabla de revisores"
            >▶</button>
            <!-- Rotated label -->
            <span
              class="text-[10px] font-semibold text-slate-400 select-none"
              style="writing-mode: vertical-rl; transform: rotate(180deg); letter-spacing: 0.05em;"
            >{{ calidadData.length }} revisores</span>
          </div>

          <!-- Expanded table -->
          <template v-if="!sidebarCollapsed">
          <div class="flex items-center justify-between shrink-0">
            <span class="text-sm font-semibold text-slate-700">
              {{ calidadData.length }} revisores
            </span>
            <button
              @click="sidebarCollapsed = true"
              class="w-6 h-6 flex items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 shadow-sm transition-colors text-xs"
              title="Colapsar tabla"
            >◀</button>
          </div>
          <div class="overflow-auto flex-1 rounded-xl border border-slate-200">
            <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
              <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-20">
                <tr>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Revisor</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Metros Día</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Calidad %</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Pts 100 m²</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Rollos 1era</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Sin Pts [un]</th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Sin Pts [%]</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in calidadData"
                  :key="row.Revisor"
                  @click="selectRevisor(row)"
                  :class="{
                    'bg-indigo-50 border-indigo-200': selectedRevisor?.Revisor === row.Revisor,
                    'hover:bg-blue-50/30': selectedRevisor?.Revisor !== row.Revisor
                  }"
                  class="border-t border-slate-100 transition-colors duration-150 cursor-pointer"
                >
                  <td class="px-2 py-[0.3rem] text-center font-medium text-slate-700">
                    <span v-if="selectedRevisor?.Revisor === row.Revisor" class="text-indigo-600 font-bold">▶ </span>
                    {{ row.Revisor }}
                  </td>
                  <td class="px-2 py-[0.3rem] text-center font-bold text-slate-700">{{ formatInteger(row.Mts_Total) }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ formatNumber(row.Calidad_Perc) }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ formatNumber(row.Pts_100m2) }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Rollos_1era }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Rollos_Sin_Pts }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ formatNumber(row.Perc_Sin_Pts) }}</td>
                </tr>
                <!-- Totals row -->
                <tr v-if="calidadData.length > 0" class="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td class="px-2 py-[0.3rem] text-center text-slate-800">Total</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-800">{{ formatInteger(totals.Mts_Total) }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-800">{{ formatNumber(totals.Calidad_Perc) }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-800">{{ formatNumber(totals.Pts_100m2) }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-800">{{ totals.Rollos_1era }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-800">{{ totals.Rollos_Sin_Pts }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-800">{{ formatNumber(totals.Perc_Sin_Pts) }}</td>
                </tr>
                <!-- Empty -->
                <tr v-if="!loading && calidadData.length === 0">
                  <td colspan="7" class="px-4 py-8 text-center text-slate-400 text-xs">
                    Sin datos para la fecha seleccionada
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Legend -->
          <div class="shrink-0 text-[10px] text-slate-500 mt-1 space-y-0.5">
            <div>• Clic en un revisor para ver su gráfico de desempeño →</div>
            <div>• Las teclas ← → navegan entre días</div>
          </div>
          </template>
        </div>

        <!-- ── Right: chart panel ──────────────────────────── -->
        <div class="flex flex-col gap-2 min-h-0 overflow-hidden">

          <!-- Empty state -->
          <div
            v-if="!selectedRevisor"
            class="flex-1 flex flex-col items-center justify-center text-slate-400 rounded-xl border border-dashed border-slate-200"
          >
            <div class="text-4xl mb-2">📊</div>
            <p class="text-sm font-medium">Seleccioná un revisor</p>
            <p class="text-xs mt-1">para ver su gráfico de velocidad y metros por pieza</p>
          </div>

          <!-- Chart content -->
          <template v-else>
            <!-- Chart header / stats bar -->
            <div class="shrink-0 flex items-center justify-between flex-wrap gap-2">
              <div class="flex items-center flex-wrap gap-x-4 gap-y-1">
                <span class="text-sm font-semibold text-slate-700">
                  {{ selectedRevisor.Revisor }}
                  <span class="ml-1 text-xs font-normal text-slate-500">— {{ displayDate }}</span>
                </span>
                <div class="flex items-center gap-3 text-xs text-slate-600 divide-x divide-slate-200">
                  <span class="pr-3">
                    <span class="text-slate-400">Metros Día</span>
                    <span class="ml-1 font-bold text-slate-800">{{ formatInteger(selectedRevisor.Mts_Total) }}</span>
                  </span>
                  <span class="px-3">
                    <span class="text-slate-400">Calidad %</span>
                    <span class="ml-1 font-semibold" :class="Number(selectedRevisor.Calidad_Perc) >= 97 ? 'text-emerald-600' : Number(selectedRevisor.Calidad_Perc) >= 93 ? 'text-amber-600' : 'text-red-600'">
                      {{ formatNumber(selectedRevisor.Calidad_Perc) }}
                    </span>
                  </span>
                  <span class="px-3">
                    <span class="text-slate-400">Pts 100 m²</span>
                    <span class="ml-1 font-semibold text-slate-700">{{ formatNumber(selectedRevisor.Pts_100m2) }}</span>
                  </span>
                  <span class="px-3">
                    <span class="text-slate-400">Rollos 1era</span>
                    <span class="ml-1 font-semibold text-slate-700">{{ selectedRevisor.Rollos_1era }}</span>
                  </span>
                  <span class="px-3">
                    <span class="text-slate-400">Sin Pts</span>
                    <span class="ml-1 font-semibold text-slate-700">{{ selectedRevisor.Rollos_Sin_Pts }}</span>
                    <span class="ml-1 text-slate-400">/</span>
                    <span class="ml-1 font-semibold" :class="Number(selectedRevisor.Perc_Sin_Pts) >= 20 ? 'text-red-600' : Number(selectedRevisor.Perc_Sin_Pts) >= 10 ? 'text-amber-600' : 'text-slate-700'">
                      {{ formatNumber(selectedRevisor.Perc_Sin_Pts) }}%
                    </span>
                  </span>
                </div>
              </div>
              <div v-if="loadingChart" class="text-xs text-slate-400 animate-pulse">Cargando piezas...</div>
            </div>

            <!-- Stats chips -->
            <div v-if="chartStats && !loadingChart" class="shrink-0 flex flex-wrap gap-2 text-xs">
              <span class="px-2 py-0.5 bg-indigo-50 border border-indigo-200 rounded-full text-indigo-700 font-medium">
                Turno {{ chartStats.turno }} (ini. {{ chartStats.turnoLabel }})
              </span>
              <span class="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-slate-700">
                1ª pieza: {{ chartStats.primerPiezaHora }}
              </span>
              <span class="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-slate-700">
                Total: <b>{{ formatInteger(chartStats.totalMetros) }}</b> m
              </span>
              <span class="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-full text-slate-700">
                Piezas: <b>{{ chartStats.totalPiezas }}</b>
              </span>
              <span class="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 font-medium">
                m/min jornada: <b>{{ formatNumber(chartStats.mminJornada) }}</b>
              </span>
              <span class="px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-blue-700 font-medium">
                m/min entre piezas: <b>{{ formatNumber(chartStats.mminEntrePiezas) }}</b>
              </span>
            </div>

            <!-- Canvas wrapper -->
            <div class="relative flex-1 min-h-0" style="min-height: 300px;">
              <div v-if="loadingChart" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10 rounded">
                <div class="text-sm text-slate-400 animate-pulse">Construyendo gráfico...</div>
              </div>
              <canvas ref="chartCanvas" style="width:100%;height:100%;"></canvas>
            </div>

            <!-- Chart legend -->
            <div class="shrink-0 flex flex-wrap gap-4 text-[11px] text-slate-600 mt-1">
              <span class="flex items-center gap-1">
                <span class="inline-block w-3 h-3 rounded" style="background:rgba(34,197,94,0.75)"></span>
                PRIMEIRA
              </span>
              <span class="flex items-center gap-1">
                <span class="inline-block w-3 h-3 rounded" style="background:rgba(249,115,22,0.75)"></span>
                SEGUNDA
              </span>
              <span class="flex items-center gap-1">
                <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:rgb(99,102,241)"></span>
                m/min (eje der.)
              </span>
              <span class="text-slate-400 italic">
                ⏸ Descuento automático 11:30–12:00 en el cálculo de velocidad
              </span>
            </div>
          </template>
        </div>

      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, onUnmounted } from 'vue'
import { Chart, registerables } from 'chart.js'
import { useDatabase } from '@/composables/useDatabase'

Chart.register(...registerables)

const db = useDatabase()
const containerRef = ref(null)
const datepickerRef = ref(null)
const sidebarCollapsed = ref(false)

// ── Date state ─────────────────────────────────────────────────────
const selectedDate = ref('')
const showCalendar = ref(false)
const calendarMonth = ref(new Date().getMonth())
const calendarYear = ref(new Date().getFullYear())
const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

const years = computed(() => {
  const cur = new Date().getFullYear()
  const list = []
  for (let y = 2020; y <= cur + 1; y++) list.push(y)
  return list
})

const currentMonth = computed(() => new Date(calendarYear.value, calendarMonth.value))

const displayDate = computed(() => {
  if (!selectedDate.value) return ''
  const [year, month, day] = selectedDate.value.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  const dias = ['dom','lun','mar','mié','jue','vie','sáb']
  return `${dias[d.getDay()]} ${day.toString().padStart(2,'0')}/${month.toString().padStart(2,'0')}/${year}`
})

const calendarDays = computed(() => {
  const days = []
  const firstDay = new Date(calendarYear.value, calendarMonth.value, 1)
  const lastDay = new Date(calendarYear.value, calendarMonth.value + 1, 0)
  const prevLastDay = new Date(calendarYear.value, calendarMonth.value, 0)
  const startDow = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const prevDaysInMonth = prevLastDay.getDate()
  const today = new Date()

  for (let i = startDow - 1; i >= 0; i--) {
    days.push({ day: prevDaysInMonth - i, otherMonth: true, key: `prev-${i}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calendarYear.value, calendarMonth.value, d)
    const dateStr = `${calendarYear.value}-${String(calendarMonth.value + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    days.push({
      day: d,
      otherMonth: false,
      selected: selectedDate.value === dateStr,
      today: date.toDateString() === today.toDateString(),
      dateStr,
      key: `cur-${d}`
    })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ day: d, otherMonth: true, key: `next-${d}` })
  }
  return days
})

function toggleCalendar() {
  showCalendar.value = !showCalendar.value
  if (showCalendar.value && selectedDate.value) {
    const [y, m] = selectedDate.value.split('-').map(Number)
    calendarYear.value = y
    calendarMonth.value = m - 1
  }
}

function handleBlur() {
  setTimeout(() => { showCalendar.value = false }, 200)
}

function changeMonth(d) {
  const date = new Date(calendarYear.value, calendarMonth.value + d)
  calendarYear.value = date.getFullYear()
  calendarMonth.value = date.getMonth()
}

function updateMonth(e) { calendarMonth.value = parseInt(e.target.value) }
function updateYear(e) { calendarYear.value = parseInt(e.target.value) }

function selectDate(day) {
  if (day.otherMonth) return
  selectedDate.value = day.dateStr
  showCalendar.value = false
  loadData()
}

function cambiarFecha(delta) {
  if (!selectedDate.value) return
  const [year, month, day] = selectedDate.value.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  d.setDate(d.getDate() + delta)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  selectedDate.value = `${y}-${m}-${dd}`
  loadData()
}

function handleKeydown(e) {
  if (e.key === 'ArrowLeft') { e.preventDefault(); cambiarFecha(-1) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); cambiarFecha(1) }
}

// ── Summary data ───────────────────────────────────────────────────
const calidadData = ref([])
const loading = ref(false)
const error = ref(null)

const totals = computed(() => {
  const data = calidadData.value
  if (!data.length) return { Mts_Total:0, Calidad_Perc:0, Pts_100m2:0, Rollos_1era:0, Rollos_Sin_Pts:0, Perc_Sin_Pts:0 }
  const sumMts = data.reduce((s, r) => s + Number(r.Mts_Total || 0), 0)
  const sumR1  = data.reduce((s, r) => s + Number(r.Rollos_1era || 0), 0)
  const sumSin = data.reduce((s, r) => s + Number(r.Rollos_Sin_Pts || 0), 0)
  const wCal   = sumMts > 0 ? data.reduce((s,r) => s + Number(r.Calidad_Perc||0)*Number(r.Mts_Total||0),0)/sumMts : 0
  const wPts   = sumMts > 0 ? data.reduce((s,r) => s + Number(r.Pts_100m2||0)*Number(r.Mts_Total||0),0)/sumMts : 0
  const wSin   = sumR1 > 0 ? (sumSin / sumR1) * 100 : 0
  return { Mts_Total:sumMts, Calidad_Perc:wCal, Pts_100m2:wPts, Rollos_1era:sumR1, Rollos_Sin_Pts:sumSin, Perc_Sin_Pts:wSin }
})

async function loadData() {
  if (!selectedDate.value) return
  loading.value = true
  error.value = null

  // Clear selection when date changes
  if (selectedRevisor.value) {
    selectedRevisor.value = null
    destroyChart()
    piezasProcesadas.value = []
  }

  try {
    const params = { startDate: selectedDate.value, endDate: selectedDate.value }
    const result = await db.getRevisionCQ(params)
    calidadData.value = Array.isArray(result) ? result : []
  } catch (err) {
    error.value = err.message
    calidadData.value = []
  } finally {
    loading.value = false
  }
}

// ── Chart state ────────────────────────────────────────────────────
const selectedRevisor = ref(null)
const piezasProcesadas = ref([])
const loadingChart = ref(false)
const chartCanvas = ref(null)
let chartInstance = null

const chartStats = computed(() => {
  const piezas = piezasProcesadas.value
  if (!piezas.length) return null
  const turno = piezas[0]._turno
  const turnoLabel = piezas[0]._turnoLabel
  const primerPiezaHora = formatHora(piezas[0].Hora)
  const totalMetros = piezas.reduce((s, p) => s + (Number(p.Metragem) || 0), 0)
  const totalPiezas = piezas.length

  // m/min jornada: total metros / (ultimo tFin - turnoStart)
  const turnoStart = piezas[0]._turnoStart
  const lastTFin = piezas[piezas.length - 1]._tFin
  const jornadaMin = Math.max(1, lastTFin - turnoStart)
  const mminJornada = totalMetros / jornadaMin

  // m/min entre piezas: sum of (metros / durNeta) weighted by metros
  const sumMetrosDelta = piezas.filter(p => p._durNeta > 0).reduce((s,p) => s + Number(p.Metragem), 0)
  const sumMinDelta = piezas.filter(p => p._durNeta > 0).reduce((s,p) => s + p._durNeta, 0)
  const mminEntrePiezas = sumMinDelta > 0 ? sumMetrosDelta / sumMinDelta : 0

  return { turno, turnoLabel, primerPiezaHora, totalMetros, totalPiezas, mminJornada, mminEntrePiezas }
})

async function selectRevisor(row) {
  const name = row.Revisor
  selectedRevisor.value = row
  piezasProcesadas.value = []
  destroyChart()
  loadingChart.value = true
  error.value = null

  try {
    const raw = await db.getDesempenoPiezas(selectedDate.value, name)
    if (!raw || !raw.length) {
      piezasProcesadas.value = []
      loadingChart.value = false
      return
    }
    piezasProcesadas.value = procesarPiezas(raw)
    loadingChart.value = false
    await nextTick()
    await nextTick()
    renderChart()
  } catch (err) {
    error.value = err.message
    piezasProcesadas.value = []
    loadingChart.value = false
  }
}

// ── Velocity calculation ───────────────────────────────────────────

function horaToMins(horaStr) {
  const s = String(horaStr || '').replace(/[^0-9]/g, '').padStart(4, '0').slice(-4)
  const hh = parseInt(s.slice(0, 2))
  const mm = parseInt(s.slice(2, 4))
  if (!isFinite(hh) || !isFinite(mm)) return null
  return hh * 60 + mm
}

function detectTurno(rawMins) {
  if (rawMins >= 360 && rawMins < 840)  return { turno:'A', turnoStart:360,  turnoLabel:'06:00' }
  if (rawMins >= 840 && rawMins < 1320) return { turno:'B', turnoStart:840,  turnoLabel:'14:00' }
  return                                       { turno:'C', turnoStart:1320, turnoLabel:'22:00' }
}

// Descuento de descanso: [11:30, 12:00] = [690, 720] minutos
function descansoDescuento(tIni, tFin) {
  const BREAK_INI = 690
  const BREAK_FIN = 720
  if (tFin <= BREAK_INI || tIni >= BREAK_FIN) return 0
  return Math.min(tFin, BREAK_FIN) - Math.max(tIni, BREAK_INI)
}

function procesarPiezas(rawPiezas) {
  // Parse and sort
  const sorted = rawPiezas
    .map(p => ({ ...p, _rawMins: horaToMins(p.Hora) }))
    .filter(p => p._rawMins !== null)
    .sort((a, b) => a._rawMins - b._rawMins)

  if (!sorted.length) return []

  const { turno, turnoStart, turnoLabel } = detectTurno(sorted[0]._rawMins)

  // For turno C (22:00+), pieces crossing midnight get +1440
  const withEffective = sorted.map(p => {
    let eff = p._rawMins
    if (turno === 'C' && p._rawMins < 360) eff += 1440
    return { ...p, _effectiveMins: eff }
  }).sort((a, b) => a._effectiveMins - b._effectiveMins)

  return withEffective.map((p, idx) => {
    const tFin = p._effectiveMins
    const tIni = idx === 0 ? turnoStart : withEffective[idx - 1]._effectiveMins
    const durBruta = Math.max(0, tFin - tIni)
    const descuento = descansoDescuento(tIni, tFin)
    const durNeta = Math.max(1, durBruta - descuento)
    const metragem = Number(p.Metragem) || 0
    const mmin = durNeta > 0 ? +(metragem / durNeta).toFixed(2) : null

    return {
      ...p,
      _turno: turno,
      _turnoStart: turnoStart,
      _turnoLabel: turnoLabel,
      _tIni: tIni,
      _tFin: tFin,
      _durBruta: durBruta,
      _durNeta: durNeta,
      _mmin: mmin
    }
  })
}

// ── Chart rendering ────────────────────────────────────────────────

function destroyChart() {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
}

function renderChart() {
  const piezas = piezasProcesadas.value
  if (!piezas.length || !chartCanvas.value) return

  destroyChart()

  const labels = piezas.map(p => formatHora(p.Hora))

  const barColors = piezas.map(p => {
    const q = String(p.Qualidade || '').toUpperCase()
    return q.includes('PRIMEIRA')
      ? 'rgba(34,197,94,0.75)'
      : 'rgba(249,115,22,0.75)'
  })
  const barBorders = piezas.map(p => {
    const q = String(p.Qualidade || '').toUpperCase()
    return q.includes('PRIMEIRA') ? 'rgb(22,163,74)' : 'rgb(234,88,12)'
  })

  const ctx = chartCanvas.value.getContext('2d')

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          type: 'bar',
          label: 'Metros',
          data: piezas.map(p => Number(p.Metragem) || 0),
          backgroundColor: barColors,
          borderColor: barBorders,
          borderWidth: 1,
          yAxisID: 'yMetros',
          order: 2
        },
        {
          type: 'line',
          label: 'm/min',
          data: piezas.map(p => p._mmin),
          borderColor: 'rgb(99,102,241)',
          backgroundColor: 'rgba(99,102,241,0.15)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 7,
          pointBackgroundColor: 'rgb(99,102,241)',
          pointBorderColor: 'white',
          pointBorderWidth: 1.5,
          fill: false,
          tension: 0.25,
          yAxisID: 'yVelocidad',
          order: 1,
          spanGaps: true
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 11 } }
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.93)',
          titleFont: { size: 11, weight: 'bold' },
          bodyFont: { size: 11 },
          padding: 10,
          callbacks: {
            title(items) {
              const idx = items[0].dataIndex
              const p = piezas[idx]
              return [
                `${p.NombreArticulo || '-'}`,
                `Partida ${p.Partida}  |  ${formatHora(p.Hora)}  |  ${p.Qualidade}`
              ]
            },
            label(item) {
              if (item.datasetIndex === 0) {
                return `  Metros: ${item.formattedValue} m`
              }
              return `  Velocidad: ${item.formattedValue} m/min`
            },
            afterBody(items) {
              const idx = items[0].dataIndex
              const p = piezas[idx]
              const lines = ['  ─────────────────────────']
              if (p.Pts100m2 != null)      lines.push(`  Pts/100m²:     ${p.Pts100m2}`)
              if (p.EficienciaPct != null)  lines.push(`  Efic. telar:   ${p.EficienciaPct}%`)
              if (p.RT105 != null)          lines.push(`  RT/105:         ${p.RT105}`)
              if (p.RU105 != null)          lines.push(`  RU/105:         ${p.RU105}`)
              if (p.Telar)                  lines.push(`  Nro telar:      ${p.Telar}`)
              lines.push('  ─────────────────────────')
              lines.push(`  t_ini: ${formatMinutos(p._tIni)}  →  t_fin: ${formatMinutos(p._tFin)}`)
              lines.push(`  Tiempo bruto: ${p._durBruta} min  |  neto: ${p._durNeta} min`)
              // Contextual warning
              if (p.EficienciaPct != null && p.EficienciaPct < 85 && p._mmin != null) {
                lines.push('  ⚠ Efic. baja → tejido difícil esperado')
              }
              if (p.RT105 != null && p.RT105 > 3 && p._mmin != null) {
                lines.push('  ⚠ RT alta → más defectos esperables')
              }
              if (p.RU105 != null && p.RU105 > 3 && p._mmin != null) {
                lines.push('  ⚠ RU alta → más defectos esperables')
              }
              return lines
            }
          }
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 90,
            minRotation: 45,
            font: { size: 9 },
            autoSkip: false
          },
          grid: { display: false }
        },
        yMetros: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Metros / pieza',
            font: { size: 11 }
          },
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { size: 10 } }
        },
        yVelocidad: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'm/min',
            font: { size: 11 }
          },
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { font: { size: 10 } }
        }
      }
    }
  })
}

// ── Formatters ─────────────────────────────────────────────────────

function formatNumber(num) {
  if (num === null || num === undefined) return '-'
  const n = Number(num)
  if (!isFinite(n)) return '-'
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n)
}

function formatInteger(num) {
  if (num === null || num === undefined) return '-'
  const n = Number(num)
  if (!isFinite(n)) return '-'
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

function formatHora(hora) {
  if (!hora) return '-'
  const s = String(hora).replace(/[^0-9]/g, '').padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2, 4)}`
}

function formatMinutos(mins) {
  if (mins === null || mins === undefined) return '-'
  // Handle values > 1440 (turno C crossing midnight)
  const normalized = ((Math.round(mins) % 1440) + 1440) % 1440
  const hh = String(Math.floor(normalized / 60)).padStart(2, '0')
  const mm = String(normalized % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

// ── Lifecycle ──────────────────────────────────────────────────────

onMounted(() => {
  const today = new Date()
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const y = yesterday.getFullYear()
  const m = String(yesterday.getMonth() + 1).padStart(2, '0')
  const d = String(yesterday.getDate()).padStart(2, '0')
  selectedDate.value = `${y}-${m}-${d}`

  if (containerRef.value) containerRef.value.focus()
  loadData()
})

onUnmounted(() => {
  destroyChart()
})
</script>

<style scoped>
/* ── DatePicker (same as RevisionCQ) ──────────────────────────────── */
.filter-inline {
  display: flex;
  align-items: center;
  gap: 6px;
}
.filter-label {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}
.filter-input {
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  background: white;
  color: #334155;
  outline: none;
  transition: border-color 0.15s;
}
.filter-input:focus { border-color: #3b82f6; }

.fecha-controls { display: flex; align-items: center; gap: 6px; }

.custom-datepicker { position: relative; display: inline-flex; align-items: center; }
.datepicker-input  { padding-right: 28px; min-width: 152px; cursor: pointer; }
.calendar-icon     { position: absolute; right: 7px; font-size: 13px; cursor: pointer; pointer-events: all; }

.calendar-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  z-index: 9999;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  padding: 10px;
  min-width: 280px;
}
.calendar-header   { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.calendar-selects  { display: flex; gap: 4px; }
.calendar-select   { font-size: 12px; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px 4px; }
.calendar-nav-btn  { padding: 3px 8px; border: 1px solid #e2e8f0; border-radius: 6px; background: white; cursor: pointer; font-size: 13px; }
.calendar-nav-btn:hover { background: #f1f5f9; }

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 4px;
}
.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.calendar-day {
  padding: 5px 2px;
  text-align: center;
  font-size: 12px;
  border-radius: 5px;
  cursor: pointer;
  background: white;
  border: none;
  color: #334155;
}
.calendar-day:hover:not(:disabled) { background: #eff6ff; color: #2563eb; }
.calendar-day.selected             { background: #2563eb; color: white; font-weight: 700; }
.calendar-day.today                { font-weight: 700; color: #0ea5e9; }
.calendar-day.other-month          { color: #cbd5e1; cursor: default; }
</style>
