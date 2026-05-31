<template>
  <div class="w-full h-screen px-2 md:px-4 py-3 flex flex-col relative">

    <!-- Overlay de carga -->
    <div v-if="loading" class="fixed inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-9999 transition-all duration-300">
      <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
        <div class="relative">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="h-8 w-8 bg-blue-600 rounded-full animate-pulse opacity-10"></div>
          </div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Cargando datos de</span>
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
                <option v-for="(month, index) in monthNames" :key="index" :value="index">{{ month }}</option>
              </select>
              <select :value="calendarYear" @change="updateYear" @click.stop class="calendar-select">
                <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
              </select>
            </div>
            <button class="calendar-nav-btn" @click.stop="changeMonth(1)">&gt;</button>
          </div>
          <div class="calendar-weekdays">
            <span v-for="day in ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']" :key="day">{{ day }}</span>
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
      <button class="inline-flex items-center justify-center px-1.5 py-1.5 border border-slate-300 bg-linear-to-b from-slate-50 to-slate-100 text-slate-700 rounded text-xs font-bold hover:from-slate-100 hover:to-slate-200 transition-all duration-150" @click="cambiarFecha(-1)" @mousedown.prevent tabindex="-1" :disabled="loading">&lt;</button>
      <button class="inline-flex items-center justify-center px-1.5 py-1.5 border border-slate-300 bg-linear-to-b from-slate-50 to-slate-100 text-slate-700 rounded text-xs font-bold hover:from-slate-100 hover:to-slate-200 transition-all duration-150" @click="cambiarFecha(1)"  @mousedown.prevent tabindex="-1" :disabled="loading">&gt;</button>

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
        @change="loadPartidas"
        class="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option v-for="t in availableTramas" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- Título -->
      <span class="ml-auto text-sm font-bold text-slate-700 hidden md:block">
        🔢 Pts/100m² por Partida – Tejeduría
      </span>

      <!-- Error -->
      <span v-if="fetchError" class="text-[11px] text-red-500 ml-2">{{ fetchError }}</span>
    </div>

    <!-- Contenido principal -->
    <div class="flex gap-3 flex-1 min-h-0 overflow-hidden">

      <!-- Tabla de partidas (panel izquierdo, scrollable) -->
      <div class="flex flex-col bg-white rounded-xl shadow border border-slate-200 overflow-hidden flex-1 min-w-0">
        <div class="flex items-center justify-between bg-gray-100 text-slate-800 px-2 py-1.5 text-xs font-semibold border-b border-slate-200 shrink-0">
          <span>
            Partidas
            <span class="font-normal text-slate-500"> — {{ mode === 'day' ? displayDate : mesLabel }}</span>
            <span v-if="partidas.length" class="ml-1 text-slate-400 font-normal">({{ partidas.length }})</span>
          </span>
          <span class="text-[10px] text-slate-400 font-normal">Click en fila para ver defectos</span>
        </div>

        <div class="overflow-auto flex-1 min-h-0">
          <table class="text-xs border-collapse w-full">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-50">
                <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('HoraInicio')">
                  Hora {{ sortCol === 'HoraInicio' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('Partida')">
                  Partida {{ sortCol === 'Partida' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700">Nombre Artículo</th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-500 whitespace-nowrap">Trama</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('MetrosRevisados')">
                  Metros {{ sortCol === 'MetrosRevisados' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('CalidadPct')">
                  Cal.% {{ sortCol === 'CalidadPct' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 whitespace-nowrap cursor-pointer hover:bg-slate-100 bg-blue-50" @click="sortBy('Pts100m2')">
                  Pts/100m² {{ sortCol === 'Pts100m2' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('TotalRollos')">
                  Total [un] {{ sortCol === 'TotalRollos' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('SinPuntos')">
                  Sin Pts [un] {{ sortCol === 'SinPuntos' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-500 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('SinPuntosPct')">
                  Sin Pts [%] {{ sortCol === 'SinPuntosPct' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-orange-600 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('Telar')">
                  Telar {{ sortCol === 'Telar' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('EficienciaPct')">
                  Efic.% {{ sortCol === 'EficienciaPct' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('RU105')">
                  RU 105 {{ sortCol === 'RU105' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-700 whitespace-nowrap cursor-pointer hover:bg-slate-100" @click="sortBy('RT105')">
                  RT 105 {{ sortCol === 'RT105' ? (sortDir === 'asc' ? '▲' : '▼') : '' }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="(row, i) in sortedPartidas" :key="row.Partida">
                <!-- Fila de partida -->
                <tr
                  class="cursor-pointer transition-colors"
                  :class="[
                    selectedPartida === row.Partida
                      ? 'bg-blue-100 ring-1 ring-blue-400'
                      : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 hover:bg-blue-50'
                  ]"
                  @click="togglePartida(row)"
                >
                  <td class="px-2 py-1.5 border border-slate-200 text-center tabular-nums text-slate-500 font-mono text-[10px]">{{ row.HoraInicio || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 font-mono font-semibold text-slate-800 whitespace-nowrap">
                    <span class="flex items-center gap-1">
                      <span class="text-blue-500 text-[10px]">{{ selectedPartida === row.Partida ? '▼' : '▶' }}</span>
                      {{ row.Partida }}
                    </span>
                  </td>
                  <td class="px-2 py-1.5 border border-slate-200 text-slate-700 max-w-50 truncate" :title="row.NombreArticulo">{{ row.NombreArticulo || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-slate-500 whitespace-nowrap text-[10px]">{{ row.Trama || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ fmtInt(row.MetrosRevisados) }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums"
                    :class="Number(row.CalidadPct) >= 95 ? 'text-green-700' : Number(row.CalidadPct) >= 90 ? 'text-amber-600' : 'text-red-600'">
                    {{ fmtDec(row.CalidadPct, 1) }}%
                  </td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums font-bold bg-blue-50"
                    :class="ptsColor(row.Pts100m2)">
                    {{ fmtDec(row.Pts100m2, 2) }}
                  </td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ fmtInt(row.TotalRollos) }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-500">{{ fmtInt(row.SinPuntos) }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-500">{{ fmtDec(row.SinPuntosPct, 1) }}%</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-center font-bold text-orange-700">{{ row.Telar || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ row.EficienciaPct != null ? fmtDec(row.EficienciaPct, 1) + '%' : '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ row.RU105 != null ? fmtDec(row.RU105, 1) : '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-700">{{ row.RT105 != null ? fmtDec(row.RT105, 1) : '—' }}</td>
                </tr>

                <!-- Fila expandida: defectos de esta partida -->
                <tr v-if="selectedPartida === row.Partida" :key="row.Partida + '-defectos'">
                  <td colspan="14" class="px-0 py-0 border-x border-b border-blue-200 bg-blue-50">
                    <div class="px-4 py-3">

                      <!-- Cabecera defectos -->
                      <div class="flex items-center gap-2 mb-2">
                        <span class="text-xs font-bold text-blue-800">🔍 Defectos de partida {{ row.Partida }}</span>
                        <span v-if="loadingDefectos" class="text-[10px] text-slate-400 italic">Cargando…</span>
                        <span v-if="defectosError" class="text-[10px] text-red-500">{{ defectosError }}</span>
                      </div>

                      <!-- Tabla defectos -->
                      <div v-if="!loadingDefectos && defectos.rows.length > 0" class="overflow-x-auto">
                        <table class="text-xs border-collapse">
                          <thead>
                            <tr class="bg-blue-100">
                              <th class="px-2 py-1 border border-blue-200 text-center font-semibold text-slate-500 whitespace-nowrap">COD</th>
                              <th class="px-2 py-1 border border-blue-200 text-center font-semibold text-slate-500 whitespace-nowrap">SEC</th>
                              <th class="px-2 py-1 border border-blue-200 text-left font-semibold text-slate-700">DEFECTO</th>
                              <th class="px-2 py-1 border border-blue-200 text-right font-semibold text-blue-700 whitespace-nowrap">PTS/100M²</th>
                              <th class="px-2 py-1 border border-blue-200 text-right font-semibold text-slate-700 whitespace-nowrap">TOTAL [un]</th>
                              <th class="px-2 py-1 border border-blue-200 text-right font-semibold text-slate-700">%</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr
                              v-for="(d, di) in defectos.rows"
                              :key="d.desc_defeito"
                              :class="di % 2 === 0 ? 'bg-white' : 'bg-blue-50/50'"
                              class="hover:bg-blue-100/60 transition-colors"
                            >
                              <td class="px-2 py-1 border border-blue-200 text-center tabular-nums text-slate-400 font-mono text-[10px]">{{ d.cod_def }}</td>
                              <td class="px-2 py-1 border border-blue-200 text-center text-[10px] font-bold whitespace-nowrap"
                                :class="{
                                  'text-blue-600':   defectoSector(d.cod_def) === 'INDI',
                                  'text-purple-600': defectoSector(d.cod_def) === 'HILA',
                                  'text-green-700':  defectoSector(d.cod_def) === 'TEJE',
                                  'text-orange-600': defectoSector(d.cod_def) === 'ACAB',
                                  'text-slate-400':  defectoSector(d.cod_def) === '—',
                                }">{{ defectoSector(d.cod_def) }}</td>
                              <td class="px-2 py-1 border border-blue-200 text-slate-800 whitespace-nowrap">{{ d.desc_defeito }}</td>
                              <td class="px-2 py-1 border border-blue-200 text-right tabular-nums font-semibold text-blue-700">{{ Number(d.pts_100m2).toFixed(2) }}</td>
                              <td class="px-2 py-1 border border-blue-200 text-right tabular-nums text-slate-800">{{ Number(d.pts_totales).toLocaleString('es-AR') }}</td>
                              <td class="px-2 py-1 border border-blue-200 text-right tabular-nums text-slate-600">{{ Number(d.porcentaje).toFixed(1) }}%</td>
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr class="bg-blue-100 font-bold">
                              <td class="px-2 py-1 border border-blue-200"></td>
                              <td class="px-2 py-1 border border-blue-200"></td>
                              <td class="px-2 py-1 border border-blue-200 text-slate-800">Total</td>
                              <td class="px-2 py-1 border border-blue-200 text-right tabular-nums text-blue-800">{{ Number(defectos.total.pts_100m2).toFixed(2) }}</td>
                              <td class="px-2 py-1 border border-blue-200 text-right tabular-nums text-slate-800">{{ Number(defectos.total.pts_totales).toLocaleString('es-AR') }}</td>
                              <td class="px-2 py-1 border border-blue-200 text-right tabular-nums text-slate-600">100%</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      <!-- Sin defectos -->
                      <div v-else-if="!loadingDefectos && !defectosError" class="text-[11px] text-slate-400 italic">
                        Sin defectos registrados para esta partida en el período seleccionado.
                      </div>

                    </div>
                  </td>
                </tr>
              </template>
            </tbody>

            <!-- Footer totales -->
            <tfoot v-if="sortedPartidas.length > 0">
              <tr class="bg-slate-100 font-bold sticky bottom-0 z-10">
                <td class="px-2 py-1.5 border border-slate-300 text-center text-slate-400 text-[10px]">—</td>
                <td class="px-2 py-1.5 border border-slate-300 text-slate-700 whitespace-nowrap" colspan="3">Total ({{ sortedPartidas.length }} partidas)</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-800">{{ fmtInt(totales.metros) }}</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-700">{{ fmtDec(totales.calPct, 1) }}%</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-blue-800 bg-blue-100">{{ fmtDec(totales.pts100m2, 2) }}</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-800">{{ fmtInt(totales.rollos) }}</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-500">{{ fmtInt(totales.sinPts) }}</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-slate-500">{{ fmtDec(totales.sinPtsPct, 1) }}%</td>
                <td class="px-2 py-1.5 border border-slate-300" colspan="4"></td>
              </tr>
            </tfoot>
          </table>

          <!-- Sin datos -->
          <div v-if="!loading && partidas.length === 0 && !fetchError" class="flex items-center justify-center py-16 text-sm text-slate-400">
            Sin datos para {{ displayDate }}
          </div>
        </div>
      </div>

    </div><!-- fin contenido principal -->
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL  = API_BASE ? `${API_BASE}/api` : '/api'

// ── Fecha ──────────────────────────────────────────────────────────────────
const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)
const defaultDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

const selectedDate = ref(defaultDate)

// ── Modo & Trama ───────────────────────────────────────────────────────────
const mode          = ref('day')   // 'day' | 'month'
const selectedTrama = ref('Todas')
const availableTramas = ['Todas', 'ALG 100%', 'P + E', 'POL 100%']

// ── Estado ─────────────────────────────────────────────────────────────────
const loading        = ref(false)
const fetchError     = ref('')
const partidas       = ref([])
const sortCol        = ref('Pts100m2')
const sortDir        = ref('desc')

// Defectos de la partida seleccionada
const selectedPartida  = ref(null)
const loadingDefectos  = ref(false)
const defectosError    = ref('')
const defectos         = ref({ rows: [], total: { pts_totales: 0, pts_100m2: 0, area_m2: 0 } })

// ── Datepicker ─────────────────────────────────────────────────────────────
const showCalendar      = ref(false)
const calendarMonth     = ref(new Date().getMonth())
const calendarYear      = ref(new Date().getFullYear())
const datepickerRef     = ref(null)
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
    if (!year || !month || !day) return ''
    const fecha = new Date(year, month - 1, day)
    const dias  = ['dom','lun','mar','mié','jue','vie','sáb']
    const dia   = dias[fecha.getDay()]
    const diaNum = fecha.getDate().toString().padStart(2, '0')
    const mes   = (fecha.getMonth() + 1).toString().padStart(2, '0')
    return `${dia} ${diaNum}/${mes}/${fecha.getFullYear()}`
  } catch { return '' }
})

const mesLabel = computed(() => {
  if (!selectedDate.value) return ''
  const [, m, d] = selectedDate.value.split('-').map(Number)
  return `${monthNames[m - 1]} (01/${String(m).padStart(2,'0')} – ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')})`
})

const calendarDays = computed(() => {
  const days     = []
  const firstDay = new Date(calendarYear.value, calendarMonth.value, 1)
  const lastDay  = new Date(calendarYear.value, calendarMonth.value + 1, 0)
  const today    = new Date(); today.setHours(0, 0, 0, 0)
  let selectedVal = null
  if (selectedDate.value) {
    const [y, m, d] = selectedDate.value.split('-').map(Number)
    selectedVal = new Date(y, m - 1, d)
  }

  for (let i = 0; i < firstDay.getDay(); i++) {
    const date = new Date(calendarYear.value, calendarMonth.value, -firstDay.getDay() + i + 1)
    days.push({ day: date.getDate(), otherMonth: true, key: `prev-${i}` })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const curr = new Date(calendarYear.value, calendarMonth.value, i)
    days.push({
      day: i, otherMonth: false,
      selected: selectedVal && selectedVal.getDate() === i && selectedVal.getMonth() === calendarMonth.value && selectedVal.getFullYear() === calendarYear.value,
      today: today.getDate() === i && today.getMonth() === calendarMonth.value && today.getFullYear() === calendarYear.value,
      key: `current-${i}`,
      date: curr,
    })
  }
  const remaining = 42 - days.length
  for (let i = 1; i <= remaining; i++) days.push({ day: i, otherMonth: true, key: `next-${i}` })
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
  loadPartidas()
}

function updateMonth(e) { calendarMonth.value = parseInt(e.target.value) }
function updateYear(e)  { calendarYear.value  = parseInt(e.target.value) }

function cambiarFecha(dias) {
  if (!selectedDate.value) return
  const [y, m, d] = selectedDate.value.split('-').map(Number)
  const fecha = new Date(y, m - 1, d)
  fecha.setDate(fecha.getDate() + dias)
  const newY = fecha.getFullYear()
  const newM = (fecha.getMonth() + 1).toString().padStart(2, '0')
  const newD = fecha.getDate().toString().padStart(2, '0')
  selectedDate.value = `${newY}-${newM}-${newD}`
  loadPartidas()
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

// ── Modo ──────────────────────────────────────────────────────────────────
function setMode(m) {
  mode.value = m
  selectedPartida.value = null
  loadPartidas()
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

// ── Formateo ───────────────────────────────────────────────────────────────
function fmtInt(v)        { return v != null ? Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—' }
function fmtDec(v, dec=2) { return v != null ? Number(v).toFixed(dec) : '—' }
function ptsColor(v) {
  const n = Number(v)
  if (n <= 0)  return 'text-slate-400'
  if (n <= 3)  return 'text-green-700'
  if (n <= 6)  return 'text-amber-600'
  return 'text-red-600'
}

// ── Ordenamiento ───────────────────────────────────────────────────────────
function sortBy(col) {
  if (sortCol.value === col) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortCol.value = col
    sortDir.value = col === 'Pts100m2' ? 'desc' : 'asc'
  }
}

const sortedPartidas = computed(() => {
  const arr = [...partidas.value]
  const col = sortCol.value
  const dir = sortDir.value === 'asc' ? 1 : -1
  arr.sort((a, b) => {
    const av = a[col] == null ? (dir > 0 ? Infinity : -Infinity) : a[col]
    const bv = b[col] == null ? (dir > 0 ? Infinity : -Infinity) : b[col]
    if (typeof av === 'string') return av.localeCompare(bv) * dir
    return (Number(av) - Number(bv)) * dir
  })
  return arr
})

// ── Totales footer ─────────────────────────────────────────────────────────
const totales = computed(() => {
  const arr = sortedPartidas.value
  if (!arr.length) return { metros: 0, calPct: 0, pts100m2: 0, rollos: 0, sinPts: 0, sinPtsPct: 0 }
  const totalMetros  = arr.reduce((s, r) => s + (Number(r.MetrosRevisados) || 0), 0)
  const totalRollos  = arr.reduce((s, r) => s + (Number(r.TotalRollos) || 0), 0)
  const sinPts       = arr.reduce((s, r) => s + (Number(r.SinPuntos) || 0), 0)
  // Cal% ponderada por metros
  const calW = arr.reduce((s, r) => s + (Number(r.CalidadPct) || 0) * (Number(r.MetrosRevisados) || 0), 0)
  // Pts100m2 ponderada por metros de PRIMEIRA (usamos metros * calidad% como proxy)
  const ptsW = arr.reduce((s, r) => s + (Number(r.Pts100m2) || 0) * (Number(r.MetrosRevisados) || 0) * ((Number(r.CalidadPct) || 100) / 100), 0)
  const denW = arr.reduce((s, r) => s + (Number(r.MetrosRevisados) || 0) * ((Number(r.CalidadPct) || 100) / 100), 0)
  return {
    metros:   totalMetros,
    calPct:   totalMetros > 0 ? calW / totalMetros : 0,
    pts100m2: denW > 0 ? ptsW / denW : 0,
    rollos:   totalRollos,
    sinPts,
    sinPtsPct: totalRollos > 0 ? sinPts / totalRollos * 100 : 0,
  }
})

// ── Carga de partidas ──────────────────────────────────────────────────────
async function loadPartidas() {
  if (!selectedDate.value) return
  loading.value    = true
  fetchError.value = ''
  selectedPartida.value = null
  try {
    const params = new URLSearchParams({
      date: selectedDate.value,
      mode: mode.value,
    })
    if (selectedTrama.value && selectedTrama.value !== 'Todas') {
      params.set('trama', selectedTrama.value)
    }
    const res = await fetch(`${API_URL}/calidad/pts-por-partida?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    partidas.value = await res.json()
  } catch (e) {
    fetchError.value = `Error: ${e.message}`
    partidas.value   = []
  } finally {
    loading.value = false
  }
}

// ── Toggle y carga de defectos ─────────────────────────────────────────────
async function togglePartida(row) {
  if (selectedPartida.value === row.Partida) {
    selectedPartida.value = null
    return
  }
  selectedPartida.value = row.Partida
  await loadDefectos(row.Partida)
}

async function loadDefectos(partida) {
  loadingDefectos.value = true
  defectosError.value   = ''
  defectos.value        = { rows: [], total: { pts_totales: 0, pts_100m2: 0, area_m2: 0 } }
  try {
    const params = new URLSearchParams({
      date:    selectedDate.value,
      mode:    mode.value,
      partida,
    })
    const res = await fetch(`${API_URL}/calidad/defectos-por-partida?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    defectos.value = await res.json()
  } catch (e) {
    defectosError.value = `Error cargando defectos: ${e.message}`
  } finally {
    loadingDefectos.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  loadPartidas()
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
/* ── Datepicker (igual que CalidadSectoresTabla) ── */
.custom-datepicker {
  position: relative;
  display: inline-flex;
  align-items: center;
}

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

.calendar-icon {
  position: absolute;
  right: 6px;
  font-size: 13px;
  cursor: pointer;
  user-select: none;
  pointer-events: auto;
}

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

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.calendar-nav-btn {
  padding: 4px 8px;
  border: 1px solid #e2e8f0;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: #475569;
}
.calendar-nav-btn:hover { background: #f1f5f9; }

.calendar-selects {
  display: flex;
  gap: 4px;
}

.calendar-select {
  padding: 2px 4px;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
  color: #374151;
  background: white;
  cursor: pointer;
  outline: none;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  margin-bottom: 4px;
}
.calendar-weekdays span {
  text-align: center;
  font-size: 9px;
  color: #94a3b8;
  font-weight: 600;
  padding: 2px;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.calendar-day {
  padding: 4px 2px;
  text-align: center;
  font-size: 10px;
  border: none;
  background: none;
  border-radius: 3px;
  cursor: pointer;
  color: #374151;
  transition: background 0.1s;
}
.calendar-day:hover:not(:disabled)  { background: #eff6ff; }
.calendar-day.selected              { background: #2563eb; color: white; font-weight: 600; }
.calendar-day.today                 { font-weight: 700; color: #2563eb; }
.calendar-day.other-month           { color: #cbd5e1; cursor: default; }
.calendar-day:disabled              { cursor: default; }
</style>
