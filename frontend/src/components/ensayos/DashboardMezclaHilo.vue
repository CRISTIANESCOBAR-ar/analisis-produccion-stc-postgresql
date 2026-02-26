<template>
  <div class="flex flex-col h-screen bg-slate-50 overflow-hidden">

    <!-- ══════════════════════ HEADER ══════════════════════ -->
    <div class="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
      <div class="flex items-center justify-between mb-3">
        <div>
          <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span class="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg text-base">🏭</span>
            Dashboard Mezcla → Hilo
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">Comparativa de calidad entre lotes — Semáforo de aptitud para Tejeduría</p>
        </div>
        <div v-if="rows.length > 0" class="text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-lg font-mono">
          {{ lotesList.length }} lotes · {{ allNes.length }} título{{allNes.length !== 1 ? 's' : ''}}
        </div>
      </div>

      <!-- Inputs -->
      <div class="flex gap-3 items-end flex-wrap">
        <div class="flex-1 min-w-48">
          <label class="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">
            Lotes a comparar <span class="text-slate-400 normal-case font-normal">(separados por coma)</span>
          </label>
          <input v-model="lotesInput" type="text" placeholder="ej: 107, 108, 109"
            class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all"
            @keyup.enter="analizar" />
        </div>
        <div class="w-36">
          <label class="text-[10px] uppercase font-bold text-slate-500 tracking-widest block mb-1">Ne (opc.)</label>
          <input v-model="neFilter" type="text" placeholder="ej: 10/1"
            class="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 transition-all" />
        </div>
        <button @click="analizar" :disabled="loading || !lotesInput.trim()"
          class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          :class="loading ? 'bg-slate-200 text-slate-500' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg'">
          <span v-if="loading" class="animate-spin inline-block">⟳</span>
          <span v-else>📊</span>
          {{ loading ? 'Consultando...' : 'Comparar' }}
        </button>
      </div>
    </div>

    <!-- ══════════════════════ BODY ══════════════════════ -->
    <div class="flex-1 overflow-auto p-6 space-y-5">

      <!-- Estado inicial -->
      <div v-if="!hasData && !loading" class="flex flex-col items-center justify-center h-full text-slate-400 py-16">
        <div class="text-6xl mb-4">🏭</div>
        <p class="text-lg font-semibold text-slate-500">Ingresá los lotes a comparar</p>
        <p class="text-sm mt-1">Ejemplo: <code class="bg-slate-100 px-2 py-0.5 rounded text-slate-600">107, 108, 109</code></p>
        <div class="mt-6 grid grid-cols-3 gap-4 text-center text-xs text-slate-400">
          <div class="bg-white border border-slate-100 rounded-xl p-4">
            <div class="text-2xl mb-1">🌿</div><div class="font-medium text-slate-500">HVI Fibra</div>
            <div class="mt-1">STR · SCI · MIC · UHML</div>
          </div>
          <div class="bg-white border border-slate-100 rounded-xl p-4">
            <div class="text-2xl mb-1">🧵</div><div class="font-medium text-slate-500">Uster Hilo</div>
            <div class="mt-1">CVm% · Neps · Vellosidad</div>
          </div>
          <div class="bg-white border border-slate-100 rounded-xl p-4">
            <div class="text-2xl mb-1">⚡</div><div class="font-medium text-slate-500">Tensorapid</div>
            <div class="mt-1">Tenacidad · Elongación</div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-24 text-slate-400">
        <div class="text-center">
          <div class="text-5xl mb-4 animate-pulse">📊</div>
          <p class="font-medium text-slate-500">Consultando HVI + Uster + Tensorapid...</p>
        </div>
      </div>

      <!-- ── SEMÁFORO CARDS ── -->
      <div v-if="hasData">
        <div class="flex items-center gap-2 mb-3">
          <h2 class="font-bold text-slate-700 text-sm uppercase tracking-wide">🚦 Semáforo de Aptitud</h2>
          <span class="text-xs text-slate-400">Evaluación por proceso</span>
        </div>
        <div class="grid gap-4" :class="lotesList.length <= 2 ? 'grid-cols-' + lotesList.length : lotesList.length === 3 ? 'grid-cols-3' : 'grid-cols-4'">
          <div v-for="mistura in lotesList" :key="`card-${mistura}`"
            class="bg-white rounded-2xl border-2 p-5 transition-all"
            :class="semaforo(mistura).borderClass">

            <!-- Card header -->
            <div class="flex items-start justify-between mb-3">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold uppercase tracking-widest" :class="semaforo(mistura).textClass">
                    Lote {{ mistura }}
                  </span>
                  <span v-if="Number(mistura) === Number(loteActual)"
                    class="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold">
                    ACTUAL
                  </span>
                </div>
                <div class="text-sm font-bold mt-0.5" :class="semaforo(mistura).textClass">
                  {{ semaforo(mistura).label }}
                </div>
              </div>
              <div class="text-3xl leading-none">{{ semaforo(mistura).icon }}</div>
            </div>

            <!-- Key metrics grid -->
            <div class="grid grid-cols-2 gap-1.5 text-xs mb-3">
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">STR Fibra</div>
                <div class="font-bold" :class="thresholdClass(getHVI(mistura, 'str'), 27, 25, false)">
                  {{ fmt(getHVI(mistura, 'str')) }} <span class="font-normal text-slate-400">g/tex</span>
                </div>
              </div>
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Tenacidad</div>
                <div class="font-bold" :class="thresholdClass(getHiloFirst(mistura, 'tenacidad'), 16, 14.5, false)">
                  {{ fmt(getHiloFirst(mistura, 'tenacidad')) }} <span class="font-normal text-slate-400">cN/tx</span>
                </div>
              </div>
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Neps +200%</div>
                <div class="font-bold" :class="thresholdClass(getHiloFirst(mistura, 'neps_200'), 500, 700, true)">
                  {{ fmt(getHiloFirst(mistura, 'neps_200')) }} <span class="font-normal text-slate-400">/km</span>
                </div>
              </div>
              <div class="bg-slate-50 rounded-lg p-2">
                <div class="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">CVm%</div>
                <div class="font-bold" :class="thresholdClass(getHiloFirst(mistura, 'cvm'), 12, 13, true)">
                  {{ fmt(getHiloFirst(mistura, 'cvm')) }}<span class="font-normal text-slate-400">%</span>
                </div>
              </div>
            </div>

            <!-- Issues -->
            <div v-if="semaforo(mistura).issues.length" class="space-y-1">
              <div v-for="issue in semaforo(mistura).issues" :key="issue"
                class="text-[10px] px-2 py-1 rounded flex items-start gap-1"
                :class="semaforo(mistura).level === 'rojo' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'">
                {{ issue }}
              </div>
            </div>
            <div v-else class="text-[10px] text-emerald-600 bg-emerald-50 rounded px-2 py-1">
              ✓ Sin alertas críticas
            </div>

            <!-- Metadata -->
            <div class="mt-3 pt-3 border-t border-slate-100 text-[9px] text-slate-400 flex gap-3">
              <span>{{ getHVI(mistura, 'n_fardos') ?? '–' }} fardos HVI</span>
              <span>{{ getHiloCount(mistura) }} ensayos Uster</span>
            </div>
          </div>
        </div>
      </div>

      <!-- ── TABLA COMPARATIVA ── -->
      <div v-if="hasData" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
            <span>📋</span> Tabla Comparativa
          </h2>
          <div class="flex items-center gap-3 text-[10px] text-slate-400 uppercase tracking-widest">
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-200 border border-emerald-400 inline-block"></span>Óptimo
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-200 border border-amber-400 inline-block"></span>Precaución
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-full bg-red-200 border border-red-400 inline-block"></span>Crítico
            </span>
          </div>
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50 text-slate-600 border-b border-slate-100">
                <th class="text-left px-5 py-3 font-bold w-52 text-slate-500">Variable</th>
                <th v-for="mistura in lotesList" :key="`th-${mistura}`"
                  class="text-center px-4 py-3 font-bold min-w-28"
                  :class="Number(mistura) === Number(loteActual) ? 'bg-blue-50 text-blue-700' : 'text-slate-600'">
                  Lote {{ mistura }}
                  <span v-if="Number(mistura) === Number(loteActual)"
                    class="ml-1 text-[8px] bg-blue-200 text-blue-800 rounded px-1">actual</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <!-- ── HVI Section ── -->
              <tr class="bg-blue-50/50">
                <td colspan="100" class="px-5 py-2 font-bold text-blue-600 text-[10px] uppercase tracking-widest">
                  🌿 Fibra — HVI
                </td>
              </tr>
              <tr v-for="fila in HVI_ROWS" :key="`hvi-row-${fila.key}`"
                class="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                <td class="px-5 py-2.5 text-slate-600 font-medium">
                  {{ fila.label }}
                  <div v-if="fila.unit" class="text-[9px] text-slate-400">{{ fila.unit }}</div>
                </td>
                <td v-for="(mistura, idx) in lotesList" :key="`hvi-${mistura}-${fila.key}`"
                  class="px-4 py-2.5 text-center font-mono"
                  :class="[
                    Number(mistura) === Number(loteActual) ? 'bg-blue-50/40' : '',
                    fila.thresholds ? cellBg(getHVI(mistura, fila.key), fila.thresholds[0], fila.thresholds[1], fila.inverse) : ''
                  ]">
                  <span class="font-bold text-slate-700">
                    {{ fmt(getHVI(mistura, fila.key), fila.dec) }}
                  </span>
                  <span v-if="idx > 0 && getHVI(lotesList[0], fila.key) != null && getHVI(mistura, fila.key) != null"
                    class="ml-1 text-[9px]" :class="trendClass(getHVI(lotesList[0], fila.key), getHVI(mistura, fila.key), fila.inverse)">
                    {{ trendArrow(getHVI(lotesList[0], fila.key), getHVI(mistura, fila.key)) }}
                  </span>
                </td>
              </tr>

              <!-- ── Hilo section per Ne ── -->
              <template v-for="ne in allNes" :key="`ne-${ne}`">
                <tr class="bg-purple-50/50">
                  <td colspan="100" class="px-5 py-2 font-bold text-purple-600 text-[10px] uppercase tracking-widest">
                    🧵 Hilo — Ne {{ ne }} / 1 (Uster + Tensorapid)
                  </td>
                </tr>
                <tr v-for="fila in HILO_ROWS" :key="`hilo-${ne}-${fila.key}`"
                  class="border-t border-slate-50 hover:bg-slate-50 transition-colors">
                  <td class="px-5 py-2.5 text-slate-600 font-medium">
                    {{ fila.label }}
                    <div v-if="fila.unit" class="text-[9px] text-slate-400">{{ fila.unit }}</div>
                  </td>
                  <td v-for="(mistura, idx) in lotesList" :key="`hilo-${mistura}-${ne}-${fila.key}`"
                    class="px-4 py-2.5 text-center font-mono"
                    :class="[
                      Number(mistura) === Number(loteActual) ? 'bg-blue-50/40' : '',
                      getHilo(mistura, ne, fila.key) != null && fila.thresholds
                        ? cellBg(getHilo(mistura, ne, fila.key), fila.thresholds[0], fila.thresholds[1], fila.inverse) : ''
                    ]">
                    <template v-if="getHilo(mistura, ne, fila.key) != null">
                      <span class="font-bold text-slate-700">
                        {{ fmt(getHilo(mistura, ne, fila.key), fila.dec) }}
                      </span>
                      <span v-if="idx > 0 && getHilo(lotesList[0], ne, fila.key) != null"
                        class="ml-1 text-[9px]"
                        :class="trendClass(getHilo(lotesList[0], ne, fila.key), getHilo(mistura, ne, fila.key), fila.inverse)">
                        {{ trendArrow(getHilo(lotesList[0], ne, fila.key), getHilo(mistura, ne, fila.key)) }}
                      </span>
                    </template>
                    <span v-else class="text-slate-200">—</span>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── NARRATIVA IA ── -->
      <div v-if="hasData" class="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 class="font-bold text-slate-700 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span>✨</span> Informe con IA
            </h2>
            <p class="text-[10px] text-slate-400 mt-0.5">Análisis predictivo en lenguaje natural • Gemini 2.0 Flash con fallback local</p>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="narrativaFuente" class="text-[10px] px-2 py-0.5 rounded-full font-bold"
              :class="narrativaFuente === 'gemini' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'">
              {{ narrativaFuente === 'gemini' ? '✨ Gemini' : '⚡ Local' }}
            </span>
            <button @click="generarNarrativa(true)" :disabled="loadingNarrativa || !hasData"
              class="px-3 py-2 rounded-xl font-bold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600">
              ⚡ Local
            </button>
            <button @click="generarNarrativa(false)" :disabled="loadingNarrativa"
              class="px-5 py-2 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm hover:shadow-md"
              :class="loadingNarrativa ? 'bg-slate-200 text-slate-500' : narrativa ? 'bg-slate-700 hover:bg-slate-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'">
              <span v-if="loadingNarrativa" class="animate-spin inline-block">⟳</span>
              <span v-else>{{ narrativa ? '↺' : '✨' }}</span>
              {{ loadingNarrativa ? 'Analizando...' : narrativa ? 'Regenerar' : 'Generar Informe' }}
            </button>
          </div>
        </div>

        <div class="p-6">
          <div v-if="!narrativa && !loadingNarrativa" class="text-center py-6 text-slate-400">
            <div class="text-3xl mb-2">✨</div>
            <p class="text-sm">Generá un resumen en lenguaje natural con análisis predictivo para producción</p>
            <p class="text-xs mt-1 text-slate-300">✨ Gemini — si hay cuota disponible • ⚡ Local — siempre disponible, instantáneo</p>
          </div>
          <div v-if="loadingNarrativa" class="flex items-center gap-3 text-slate-500 py-4">
            <span class="animate-spin text-xl inline-block">⟳</span>
            <span class="text-sm">Analizando datos...</span>
          </div>
          <div v-if="narrativaAviso && narrativa" class="text-amber-700 text-xs bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-3 flex items-center gap-2">
            <span>⚠️</span> {{ narrativaAviso }}
          </div>
          <div v-if="narrativa && !loadingNarrativa"
            class="bg-slate-50 rounded-xl border border-slate-100 p-5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed font-mono">
            {{ narrativa }}
          </div>
          <div v-if="narrativaError" class="text-red-600 text-sm bg-red-50 rounded-xl p-4 mt-3">
            ⚠️ {{ narrativaError }}
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

// ── State ──────────────────────────────────────────────────────────────────
const lotesInput    = ref('107, 108, 109')
const neFilter      = ref('')
const loading       = ref(false)
const rows          = ref([])
const narrativa     = ref('')
const narrativaError= ref('')
const narrativaFuente = ref('')   // 'gemini' | 'local'
const narrativaAviso  = ref('')
const loadingNarrativa = ref(false)

// ── Definición de filas de tabla ──────────────────────────────────────────
const HVI_ROWS = [
  { key: 'str',       label: 'STR — Tenacidad Fibra', unit: 'g/tex',   dec: 2, thresholds: [27, 25],   inverse: false },
  { key: 'sci',       label: 'SCI — Índice Hilabilidad', unit: '',      dec: 1, thresholds: [145, 130], inverse: false },
  { key: 'mic',       label: 'MIC — Finura / Madurez', unit: 'mic',    dec: 3, thresholds: null,       inverse: false },
  { key: 'uhml',      label: 'UHML — Longitud', unit: 'mm',            dec: 2, thresholds: null,       inverse: false },
  { key: 'ui',        label: 'UI — Uniformidad Fibra', unit: '%',      dec: 2, thresholds: [84, 82],   inverse: false },
  { key: 'elg_fibra', label: 'ELG — Elong. Fibra', unit: '%',          dec: 2, thresholds: null,       inverse: false },
  { key: 'n_fardos',  label: 'Fardos analizados', unit: '',            dec: 0, thresholds: null,       inverse: false },
]

const HILO_ROWS = [
  { key: 'tenacidad',  label: 'Tenacidad', unit: 'cN/tex', dec: 2, thresholds: [16, 14.5],  inverse: false },
  { key: 'elongacion', label: 'Elongación', unit: '%',     dec: 2, thresholds: [8, 7.5],    inverse: false },
  { key: 'cvm',        label: 'CVm% — Irregularidad', unit: '%', dec: 2, thresholds: [12, 13], inverse: true },
  { key: 'vellosidad', label: 'H — Vellosidad', unit: '',  dec: 2, thresholds: null,         inverse: true },
  { key: 'neps_200',   label: 'Neps +200%', unit: '/km',  dec: 1, thresholds: [500, 700],   inverse: true },
  { key: 'thin_50',    label: 'Puntos Delgados −50%', unit: '/km', dec: 1, thresholds: null, inverse: true },
  { key: 'thick_50',   label: 'Puntos Gruesos +50%', unit: '/km', dec: 1, thresholds: null,  inverse: true },
  { key: 'n_uster',    label: 'Ensayos Uster', unit: '',  dec: 0, thresholds: null,          inverse: false },
]

// ── Computed ───────────────────────────────────────────────────────────────
const hasData     = computed(() => rows.value.length > 0)
const lotesList   = computed(() => [...new Set(rows.value.map(r => r.mistura))].sort((a, b) => Number(a) - Number(b)))
const loteActual  = computed(() => lotesList.value.length ? lotesList.value[lotesList.value.length - 1] : null)
const allNes      = computed(() => {
  const nes = [...new Set(rows.value.filter(r => r.ne != null).map(r => String(r.ne)))]
  return nes.sort((a, b) => parseFloat(a) - parseFloat(b))
})

// ── Helpers de datos ──────────────────────────────────────────────────────
function getHVI(mistura, key) {
  const row = rows.value.find(r => String(r.mistura) === String(mistura))
  if (!row) return null
  const v = row[key]
  return v != null ? parseFloat(v) : null
}

function getHilo(mistura, ne, key) {
  const row = rows.value.find(r => String(r.mistura) === String(mistura) && String(r.ne) === String(ne))
  if (!row) return null
  const v = row[key]
  return v != null ? parseFloat(v) : null
}

function getHiloFirst(mistura, key) {
  const neRows = rows.value.filter(r => String(r.mistura) === String(mistura) && r.ne != null)
  if (!neRows.length) return null
  // Promedio del primer Ne disponible (o el único)
  const first = neRows[0]
  return first[key] != null ? parseFloat(first[key]) : null
}

function getHiloCount(mistura) {
  const neRows = rows.value.filter(r => String(r.mistura) === String(mistura) && r.ne != null)
  const total = neRows.reduce((acc, r) => acc + (Number(r.n_uster) || 0), 0)
  return total || '–'
}

function fmt(val, dec = 2) {
  if (val == null || isNaN(val)) return '–'
  return Number(val).toFixed(dec)
}

// ── Semáforo ──────────────────────────────────────────────────────────────
function semaforo(mistura) {
  const hiloRows = rows.value.filter(r => String(r.mistura) === String(mistura) && r.ne != null)
  let level = 'verde'
  const issues = []

  for (const r of hiloRows) {
    const ten = r.tenacidad != null ? parseFloat(r.tenacidad) : null
    const elo = r.elongacion != null ? parseFloat(r.elongacion) : null
    const nps = r.neps_200 != null ? parseFloat(r.neps_200) : null
    const cvm = r.cvm != null ? parseFloat(r.cvm) : null

    if (ten != null) {
      if (ten < 14.5) { level = 'rojo'; issues.push(`Ne${r.ne}: Tenacidad ${ten} cN/tex — CRÍTICO Telar`) }
      else if (ten < 16.0) { if (level === 'verde') level = 'amarillo'; issues.push(`Ne${r.ne}: Tenacidad ${ten} cN/tex — precaución`) }
    }
    if (elo != null && elo < 7.5) {
      if (level === 'verde') level = 'amarillo'
      issues.push(`Ne${r.ne}: Elongación ${elo}% — riesgo rotura Urdidora`)
    }
    if (nps != null && nps > 700) {
      level = 'rojo'
      issues.push(`Ne${r.ne}: Neps ${nps}/km — riesgo en Índigo`)
    }
    if (cvm != null && cvm > 13.0) {
      if (level === 'verde') level = 'amarillo'
      issues.push(`Ne${r.ne}: CVm% ${cvm}% — masa irregular`)
    }
  }

  // Si no hay datos de hilo, evaluar solo por HVI STR
  if (hiloRows.length === 0) {
    const str = getHVI(mistura, 'str')
    if (str != null) {
      if (str < 25.0) { level = 'rojo'; issues.push(`STR ${str} g/tex — límite bajo`) }
      else if (str < 27.0) { if (level === 'verde') level = 'amarillo'; issues.push(`STR ${str} g/tex — margen ajustado`) }
    }
    if (!issues.length) issues.push('Solo datos HVI disponibles')
  }

  return {
    level,
    issues: issues.slice(0, 3),
    icon:        { verde: '✅', amarillo: '⚠️', rojo: '🔴' }[level],
    label:       { verde: 'APTO TELAR', amarillo: 'PRECAUCIÓN', rojo: 'CRÍTICO' }[level],
    borderClass: { verde: 'border-emerald-300 shadow-emerald-50', amarillo: 'border-amber-300 shadow-amber-50', rojo: 'border-red-300 shadow-red-50' }[level],
    textClass:   { verde: 'text-emerald-700', amarillo: 'text-amber-700', rojo: 'text-red-700' }[level],
  }
}

// ── Color helpers ─────────────────────────────────────────────────────────
// thresholds: [bueno, minimo] donde valores > bueno = verde, entre minimo-bueno = amarillo, < minimo = rojo
// inverse = true invierte la lógica (menor = mejor, ej: neps)
function thresholdClass(val, good, warn, inverse = false) {
  if (val == null) return 'text-slate-400'
  const v = parseFloat(val)
  if (inverse) {
    if (v <= good)  return 'text-emerald-600'
    if (v <= warn)  return 'text-amber-600'
    return 'text-red-600'
  } else {
    if (v >= good)  return 'text-emerald-600'
    if (v >= warn)  return 'text-amber-600'
    return 'text-red-600'
  }
}

function cellBg(val, good, warn, inverse = false) {
  if (val == null) return ''
  const v = parseFloat(val)
  if (inverse) {
    if (v <= good)  return 'bg-emerald-50'
    if (v <= warn)  return 'bg-amber-50'
    return 'bg-red-50'
  } else {
    if (v >= good)  return 'bg-emerald-50'
    if (v >= warn)  return 'bg-amber-50'
    return 'bg-red-50'
  }
}

function trendArrow(base, current) {
  if (base == null || current == null) return ''
  const diff = parseFloat(current) - parseFloat(base)
  if (Math.abs(diff) < 0.01) return '='
  return diff > 0 ? '↑' : '↓'
}

function trendClass(base, current, inverse = false) {
  if (base == null || current == null) return 'text-slate-300'
  const diff = parseFloat(current) - parseFloat(base)
  if (Math.abs(diff) < 0.01) return 'text-slate-400'
  const better = inverse ? diff < 0 : diff > 0
  return better ? 'text-emerald-500' : 'text-red-400'
}

// ── API calls ─────────────────────────────────────────────────────────────
async function analizar() {
  if (!lotesInput.value.trim() || loading.value) return
  loading.value = true
  rows.value = []
  narrativa.value = ''
  narrativaError.value = ''

  try {
    const lotesClean = lotesInput.value.replace(/[^0-9,]/g, '').replace(/,+/g, ',').replace(/^,|,$/g, '')
    const params = new URLSearchParams({ lotes: lotesClean })
    if (neFilter.value.trim()) params.set('ne', neFilter.value.trim())

    const res = await fetch(`/api/dashboard/mezcla-lotes?${params}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Error al obtener datos')
    rows.value = data.rows || []
  } catch (err) {
    console.error('[DashboardMezclaHilo]', err)
    rows.value = []
  } finally {
    loading.value = false
  }
}

async function generarNarrativa(soloLocal = false) {
  if (loadingNarrativa.value || !rows.value.length) return
  loadingNarrativa.value = true
  narrativa.value = ''
  narrativaError.value = ''
  narrativaFuente.value = ''
  narrativaAviso.value = ''

  try {
    const res = await fetch('/api/dashboard/narrativa-lotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: rows.value,
        loteActual: loteActual.value,
        modo: soloLocal ? 'local' : undefined
      })
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Error al generar')
    narrativa.value = data.narrativa
    narrativaFuente.value = data.fuente || 'local'
    narrativaAviso.value = data.aviso || ''
  } catch (err) {
    narrativaError.value = err.message
  } finally {
    loadingNarrativa.value = false
  }
}
</script>
