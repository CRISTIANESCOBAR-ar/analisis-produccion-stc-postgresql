<template>
  <div class="w-full h-screen px-2 md:px-4 py-3 flex flex-col relative">

    <!-- Overlay de carga -->
    <div v-if="loading" class="fixed inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-9999 transition-all duration-300">
      <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
        <div class="relative">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Cargando evolución de PONTOS</span>
          <span class="text-xl text-slate-800 font-bold">{{ rangoLabel }}</span>
        </div>
      </div>
    </div>

    <!-- Barra de controles -->
    <div class="flex items-center gap-2 flex-wrap mb-3 bg-white rounded-xl shadow border border-slate-200 px-3 py-2 shrink-0">

      <!-- Fecha Desde -->
      <label class="text-[10px] text-slate-400 font-semibold uppercase">Desde</label>
      <input
        type="date"
        v-model="fechaDesde"
        class="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <!-- Fecha Hasta -->
      <label class="text-[10px] text-slate-400 font-semibold uppercase">Hasta</label>
      <input
        type="date"
        v-model="fechaHasta"
        class="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <!-- Filtro Sector -->
      <select
        v-model="selectedSector"
        class="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option v-for="s in sectores" :key="s.value" :value="s.value">{{ s.label }}</option>
      </select>

      <!-- Filtro Base -->
      <select
        v-if="basesDisponibles.length > 0"
        v-model="selectedBase"
        class="px-2 py-1.5 text-xs border border-slate-300 rounded bg-white text-slate-800 hover:border-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        <option value="">Todas las Bases</option>
        <option v-for="b in basesDisponibles" :key="b" :value="b">{{ b }}</option>
      </select>

      <!-- Botón buscar -->
      <button
        class="px-4 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
        @click="loadData"
        :disabled="loading"
      >Buscar</button>

      <!-- Título -->
      <span class="ml-auto text-sm font-bold text-slate-700 hidden md:block">
        📊 Evolución PONTOS por Rolada
      </span>

      <!-- Errores -->
      <span v-if="error" class="text-[11px] text-red-500 ml-2">{{ error }}</span>
    </div>

    <!-- Contenido: dos paneles -->
    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-3 flex-1 min-h-0 overflow-hidden">

      <!-- ── PANEL IZQUIERDO: Ranking de defectos ─────────────────────────── -->
      <div class="flex flex-col bg-white rounded-xl shadow border border-slate-200 overflow-hidden min-h-0">
        <div class="flex items-center justify-between bg-gray-100 text-slate-800 px-2 py-1.5 text-xs font-semibold border-b border-slate-200 shrink-0">
          <span>
            Ranking Defectos
            <span class="font-normal text-slate-500"> — {{ rangoLabel }}</span>
            <span v-if="selectedSector !== 'todos'" class="ml-1 text-blue-600 font-normal">· {{ selectedSector }}</span>
          </span>
          <span class="text-[10px] text-slate-400 font-normal shrink-0">Click para ver evolución</span>
        </div>

        <div class="overflow-auto flex-1 min-h-0">
          <div v-if="loading" class="flex items-center justify-center py-10 text-xs text-slate-400">Cargando…</div>
          <table v-else-if="filteredDefectos.length > 0" class="text-xs border-collapse w-full">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-50">
                <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-slate-400 whitespace-nowrap">COD</th>
                <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-slate-400 whitespace-nowrap">SEC</th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700">DEFECTO</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 whitespace-nowrap bg-blue-50">PTS TOTAL</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-slate-600 whitespace-nowrap">ROL. AFECT.</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in filteredDefectos"
                :key="row.cod_def"
                class="cursor-pointer transition-colors"
                :class="[
                  selectedDefecto === row.cod_def
                    ? 'bg-blue-100 ring-1 ring-inset ring-blue-400'
                    : i % 2 === 0 ? 'bg-white hover:bg-blue-50' : 'bg-slate-50 hover:bg-blue-50'
                ]"
                @click="selectDefecto(row)"
              >
                <td class="px-2 py-1.5 border border-slate-200 text-center tabular-nums text-slate-400 font-mono text-[10px]">{{ row.cod_def }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-center text-[10px] font-bold whitespace-nowrap"
                  :class="sectorColor(row.sector)">{{ row.sector.substring(0, 4) }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-slate-800 whitespace-nowrap">
                  <span class="flex items-center gap-1">
                    <span v-if="selectedDefecto === row.cod_def" class="text-blue-500 text-[10px]">▶</span>
                    {{ row.desc_defeito }}
                  </span>
                </td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums font-semibold bg-blue-50"
                  :class="ptsColor(row.pts_totales)">{{ fmtInt(row.pts_totales) }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600">{{ row.roladas_afectadas }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-slate-100 font-bold sticky bottom-0 z-10">
                <td class="px-2 py-1.5 border border-slate-300" colspan="2"></td>
                <td class="px-2 py-1.5 border border-slate-300 text-slate-700">Total ({{ filteredDefectos.length }})</td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-blue-800 bg-blue-100">{{ fmtInt(totalFilteredPts) }}</td>
                <td class="px-2 py-1.5 border border-slate-300"></td>
              </tr>
            </tfoot>
          </table>
          <div v-else-if="!loading && !error" class="flex items-center justify-center py-16 text-sm text-slate-400">
            Sin datos para el período seleccionado
          </div>
        </div>
      </div>

      <!-- ── PANEL DERECHO: Evolución por Rolada ──────────────────────────── -->
      <div class="flex flex-col bg-white rounded-xl shadow border border-slate-200 overflow-hidden min-h-0">
        <div class="flex items-center justify-between bg-gray-100 text-slate-800 px-2 py-1.5 text-xs font-semibold border-b border-slate-200 shrink-0">
          <div class="flex items-center gap-2">
            <span v-if="selectedDefecto">
              Evolución por Rolada ·
              <span class="text-blue-700">{{ selectedRow?.desc_defeito }}</span>
              <span class="ml-1 text-slate-400 font-normal">({{ Object.keys(selectedRow?.por_rolada || {}).length }} roladas)</span>
            </span>
            <span v-else class="text-slate-400 font-normal">Selecciona un defecto del panel izquierdo</span>
          </div>
          
          <button
            v-if="selectedDefecto"
            @click="showFibra = !showFibra"
            class="px-2 py-1 text-[10px] uppercase font-bold rounded transition-colors"
            :class="showFibra ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'"
          >
            {{ showFibra ? 'Ocultar Fibra/OE' : 'Mostrar Fibra/OE' }}
          </button>
        </div>

        <div class="overflow-auto flex-1 min-h-0">

          <!-- Placeholder -->
          <div v-if="!selectedDefecto && !loading" class="flex flex-col items-center justify-center h-full gap-3 text-slate-300">
            <svg class="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <span class="text-sm">Selecciona un defecto para ver la evolución por rolada</span>
          </div>

          <!-- Tabla de evolución por rolada -->
          <table v-if="selectedDefecto && roladaEntries.length > 0" class="text-xs border-collapse w-full">
            <thead class="sticky top-0 z-10">
              <tr class="bg-slate-50">
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700 whitespace-nowrap sticky left-0 bg-slate-50 z-20">ROLADA</th>
                <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-slate-700 whitespace-nowrap bg-slate-50">BASE</th>
                <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 whitespace-nowrap bg-blue-50">PONTOS</th>
                <th class="px-3 py-1.5 border border-slate-200 text-left font-semibold text-slate-500 min-w-[120px]">BARRA</th>
                <template v-if="showFibra">
                  <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-purple-700 bg-purple-50 whitespace-nowrap">MAQ. OE</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-purple-700 bg-purple-50 whitespace-nowrap">LOTE</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-purple-700 bg-purple-50 whitespace-nowrap">FECHA</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-left font-semibold text-emerald-700 bg-emerald-50 whitespace-nowrap">MEZCLA</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-center font-semibold text-emerald-700 bg-emerald-50 whitespace-nowrap">F.INGRESO</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 bg-blue-50" title="Metros Calidad">MTS</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 bg-blue-50" title="Calidad %">CAL.%</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 bg-blue-50" title="Puntos Totales / 100m²">PTS/100m²</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-blue-700 bg-blue-50" title="Puntos del Defecto Seleccionado / 100m²">DEF.PTS/100m²</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Spinning Consistency Index">SCI</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Moisture">MST</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Micronaire">MIC</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Maturity">MAT</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Upper Half Mean Length">UHML</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Uniformity Index">UI</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Short Fiber">SF</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Strength">STR</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Elongation">ELG</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Reflectance">RD</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Yellowness">+b</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Trash Count">TrCNT</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Trash Area">TrAR</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-emerald-700 bg-emerald-50" title="Trash ID">TRID</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-amber-700 bg-amber-50">BCO%</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-amber-700 bg-amber-50">GRI%</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-amber-700 bg-amber-50">LG%</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-amber-700 bg-amber-50">AMA%</th>
                  <th class="px-2 py-1.5 border border-slate-200 text-right font-semibold text-amber-700 bg-amber-50">LA%</th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(entry, i) in roladaEntries"
                :key="entry.rolada"
                :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'"
                class="transition-colors hover:bg-blue-50"
              >
                <td class="px-2 py-1.5 border border-slate-200 font-mono font-semibold text-slate-800 whitespace-nowrap sticky left-0 z-10"
                  :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'">{{ entry.rolada }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-slate-500 font-mono text-[11px] whitespace-nowrap"
                  :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'">{{ data.basesUrdume?.[entry.rolada] || '—' }}</td>
                <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums font-semibold"
                  :class="ptsColor(entry.pts)">{{ fmtInt(entry.pts) }}</td>
                <td class="px-3 py-1.5 border border-slate-200">
                  <div class="flex items-center gap-2">
                    <div class="h-4 rounded-sm transition-all duration-300"
                      :class="barColor(entry.pts)"
                      :style="{ width: barWidth(entry.pts) + '%', minWidth: entry.pts > 0 ? '4px' : '0' }"></div>
                    <span v-if="entry.pts > 0" class="text-[10px] text-slate-400 tabular-nums">{{ pctOfMax(entry.pts) }}%</span>
                  </div>
                </td>
                <template v-if="showFibra">
                  <td class="px-2 py-1.5 border border-slate-200 text-center font-mono text-[10px] text-slate-600 bg-purple-50/30 whitespace-nowrap">{{ data.fibraMap?.[entry.rolada]?.maq_oe || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-center font-mono text-[10px] text-slate-600 bg-purple-50/30 whitespace-nowrap">{{ data.fibraMap?.[entry.rolada]?.lote || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-center font-mono text-[10px] text-slate-600 bg-purple-50/30 whitespace-nowrap">{{ data.fibraMap?.[entry.rolada]?.fecha || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-left font-mono text-[10px] text-slate-600 bg-emerald-50/30 min-w-[120px]">{{ data.fibraMap?.[entry.rolada]?.mezcla || '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-center font-mono text-[10px] text-slate-600 bg-emerald-50/30 whitespace-nowrap">{{ data.fibraMap?.[entry.rolada]?.f_ingreso || '—' }}</td>
                  
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-blue-50/30">{{ fmtInt(data.fibraMap?.[entry.rolada]?.mts_cal) }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-blue-50/30">{{ data.fibraMap?.[entry.rolada]?.cal_pct ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums font-semibold" :class="ptsColor(data.fibraMap?.[entry.rolada]?.pts_100m2)">{{ data.fibraMap?.[entry.rolada]?.pts_100m2 ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums font-semibold" :class="ptsColor(calcDefPts100m2(entry.pts, data.fibraMap?.[entry.rolada]))">{{ calcDefPts100m2(entry.pts, data.fibraMap?.[entry.rolada]) ?? '—' }}</td>

                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.sci ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.mst ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.mic ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.mat ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.uhml ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.ui ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.sf ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.str ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.elg ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.rd ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.plus_b ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.trcnt ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.trar ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-emerald-50/30">{{ data.fibraMap?.[entry.rolada]?.trid ?? '—' }}</td>

                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-amber-50/30">{{ data.fibraMap?.[entry.rolada]?.bco_pct ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-amber-50/30">{{ data.fibraMap?.[entry.rolada]?.gri_pct ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-amber-50/30">{{ data.fibraMap?.[entry.rolada]?.lg_pct ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-amber-50/30">{{ data.fibraMap?.[entry.rolada]?.ama_pct ?? '—' }}</td>
                  <td class="px-2 py-1.5 border border-slate-200 text-right tabular-nums text-slate-600 bg-amber-50/30">{{ data.fibraMap?.[entry.rolada]?.la_pct ?? '—' }}</td>
                </template>
              </tr>
            </tbody>
            <tfoot>
              <tr class="bg-slate-100 font-bold sticky bottom-0 z-10">
                <td class="px-2 py-1.5 border border-slate-300 text-slate-700 sticky left-0 bg-slate-100 z-20">Total ({{ roladaEntries.length }} roladas)</td>
                <td class="px-2 py-1.5 border border-slate-300"></td>
                <td class="px-2 py-1.5 border border-slate-300 text-right tabular-nums text-blue-800 bg-blue-100">{{ fmtInt(totalRolada) }}</td>
                <td class="px-2 py-1.5 border border-slate-300"></td>
                <td v-if="showFibra" class="px-2 py-1.5 border border-slate-300" colspan="28"></td>
              </tr>
            </tfoot>
          </table>

          <div v-else-if="selectedDefecto && roladaEntries.length === 0 && !loading" class="flex items-center justify-center py-16 text-sm text-slate-400">
            Sin datos de rolada para este defecto
          </div>
        </div>
      </div>

    </div><!-- fin dos paneles -->
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL  = API_BASE ? `${API_BASE}/api` : '/api'

// ── Fechas ───────────────────────────────────────────────────────────────────
const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const fechaDesde = ref(toISO(firstOfMonth))
const fechaHasta = ref(toISO(today))

// ── Sector ────────────────────────────────────────────────────────────────────
const selectedSector = ref('todos')
const sectores = [
  { value: 'todos',       label: 'Todos los Sectores' },
  { value: 'INDIGO',      label: 'Índigo (1xx)' },
  { value: 'HILANDERIA',  label: 'Hilandería (2xx)' },
  { value: 'TEJEDURIA',   label: 'Tejeduría (3xx)' },
  { value: 'ACABAMENTO',  label: 'Acabamento (4xx)' },
]

// ── Estado ────────────────────────────────────────────────────────────────────
const loading = ref(false)
const error   = ref('')
const data    = ref({ defectos: [], roladas: [], basesUrdume: {}, fibraMap: {}, totalPts: 0 })

const selectedDefecto = ref(null)
const selectedBase = ref('')
const showFibra = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────
const basesDisponibles = computed(() => {
  const basesSet = new Set()
  Object.values(data.value.basesUrdume || {}).forEach(b => {
    if (b) basesSet.add(String(b).substring(0, 10).trim())
  })
  return [...basesSet].sort()
})

const filteredDefectos = computed(() => {
  if (!selectedBase.value) return data.value.defectos

  return data.value.defectos.map(def => {
    const filteredPorRolada = {}
    let newTotal = 0
    for (const [rolada, pts] of Object.entries(def.por_rolada || {})) {
      const baseRaw = data.value.basesUrdume?.[rolada] || ''
      const base10 = String(baseRaw).substring(0, 10).trim()
      if (base10 === selectedBase.value) {
        filteredPorRolada[rolada] = pts
        newTotal += pts
      }
    }
    return {
      ...def,
      por_rolada: filteredPorRolada,
      pts_totales: newTotal,
      roladas_afectadas: Object.keys(filteredPorRolada).length
    }
  }).filter(def => def.pts_totales > 0)
    .sort((a, b) => b.pts_totales - a.pts_totales)
})

const totalFilteredPts = computed(() => {
  return filteredDefectos.value.reduce((s, d) => s + d.pts_totales, 0)
})

const rangoLabel = computed(() => {
  if (!fechaDesde.value || !fechaHasta.value) return ''
  const [, md, dd] = fechaDesde.value.split('-')
  const [, mh, dh] = fechaHasta.value.split('-')
  return `${dd}/${md} — ${dh}/${mh}`
})

const selectedRow = computed(() => {
  if (!selectedDefecto.value) return null
  return filteredDefectos.value.find(d => d.cod_def === selectedDefecto.value)
})

const roladaEntries = computed(() => {
  if (!selectedRow.value) return []
  const porRolada = selectedRow.value.por_rolada || {}
  return Object.entries(porRolada)
    .map(([rolada, pts]) => ({ rolada, pts: Number(pts) || 0 }))
    .sort((a, b) => a.rolada.localeCompare(b.rolada))
})

const maxPtsRolada = computed(() => {
  return roladaEntries.value.reduce((mx, e) => Math.max(mx, e.pts), 0)
})

const totalRolada = computed(() => {
  return roladaEntries.value.reduce((s, e) => s + e.pts, 0)
})

// ── Helpers de UI ──────────────────────────────────────────────────────────────
const calcDefPts100m2 = (pts, fibraData) => {
  if (!fibraData || !fibraData.mts_cal || !fibraData.largura || fibraData.mts_cal === 0 || fibraData.largura === 0) return null
  return Number(((pts * 10000) / (fibraData.mts_cal * fibraData.largura)).toFixed(2))
}

function sectorColor(sector) {
  if (sector === 'INDIGO')      return 'text-blue-600'
  if (sector === 'HILANDERIA')  return 'text-purple-600'
  if (sector === 'TEJEDURIA')   return 'text-green-700'
  if (sector === 'ACABAMENTO')  return 'text-orange-600'
  return 'text-slate-400'
}

function ptsColor(v) {
  const n = Number(v)
  if (n <= 0) return 'text-slate-400'
  if (n <= 10) return 'text-green-700'
  if (n <= 30) return 'text-amber-600'
  return 'text-red-600'
}

function barColor(v) {
  const n = Number(v)
  if (n <= 10) return 'bg-green-400'
  if (n <= 30) return 'bg-amber-400'
  return 'bg-red-400'
}

function barWidth(pts) {
  if (!maxPtsRolada.value || pts <= 0) return 0
  return Math.round((pts / maxPtsRolada.value) * 100)
}

function pctOfMax(pts) {
  if (!maxPtsRolada.value) return '0'
  return Math.round((pts / maxPtsRolada.value) * 100)
}

function fmtInt(v) {
  return v != null ? Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : '—'
}

// ── Selección ──────────────────────────────────────────────────────────────────
function selectDefecto(row) {
  if (selectedDefecto.value === row.cod_def) {
    selectedDefecto.value = null
    return
  }
  selectedDefecto.value = row.cod_def
}

// ── Carga de datos ────────────────────────────────────────────────────────────
async function loadData() {
  if (!fechaDesde.value || !fechaHasta.value) return
  loading.value = true
  error.value   = ''
  data.value    = { defectos: [], roladas: [], basesUrdume: {}, fibraMap: {}, totalPts: 0 }
  selectedDefecto.value = null
  try {
    const params = new URLSearchParams({
      fechaDesde: fechaDesde.value,
      fechaHasta: fechaHasta.value,
    })
    if (selectedSector.value !== 'todos') {
      params.set('sector', selectedSector.value)
    }
    const res = await fetch(`${API_URL}/calidad/pontos-por-rolada?${params}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data.value = await res.json()
  } catch (e) {
    error.value = `Error: ${e.message}`
  } finally {
    loading.value = false
  }
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────
onMounted(() => {
  loadData()
})
</script>

<style scoped>
/* estilos mínimos, todo el diseño está en TailwindCSS classes */
</style>
