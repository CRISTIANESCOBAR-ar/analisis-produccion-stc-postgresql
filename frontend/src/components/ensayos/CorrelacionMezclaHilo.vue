<template>
  <div class="flex flex-col h-screen bg-slate-50 overflow-hidden">

    <!-- ===== HEADER ===== -->
    <div class="shrink-0 bg-white border-b border-slate-200 px-6 py-4">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span class="p-1.5 bg-purple-100 text-purple-600 rounded-lg text-base">🔬</span>
            Correlación Mezcla → Hilo
          </h1>
          <p class="text-xs text-slate-400 mt-0.5">Analiza qué variables HVI impactan en la calidad del hilo (Uster + Tensorapid)</p>
        </div>
        <div v-if="resultados.n > 0" class="flex items-center gap-3 text-xs text-slate-500">
          <span class="bg-slate-100 px-2 py-1 rounded font-mono">{{ resultados.n }} ensayos cruzados</span>
          <span class="bg-green-100 text-green-700 px-2 py-1 rounded font-mono">{{ correlacionesSignificativas.length }} correlaciones |r|≥0.3</span>
        </div>
      </div>

      <!-- Filtros -->
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-[1fr_1fr_auto_auto_auto]">
        <!-- Variables HVI (Causa) -->
        <div class="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <p class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
            <span class="w-2 h-2 bg-blue-500 rounded-full"></span> Causa — Variables HVI
          </p>
          <div class="flex flex-wrap gap-2">
            <label v-for="v in HVI_VARS" :key="v.key"
              class="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg border text-xs font-medium transition-all"
              :class="selectedHVI.includes(v.key)
                ? 'border-blue-400 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-blue-300'"
            >
              <input type="checkbox" class="hidden" :value="v.key" v-model="selectedHVI" />
              {{ v.label }}
            </label>
          </div>
        </div>

        <!-- Variables Hilo (Efecto) -->
        <div class="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <p class="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-2 flex items-center gap-1">
            <span class="w-2 h-2 bg-purple-500 rounded-full"></span> Efecto — Variables Hilo
          </p>
          <div class="flex flex-wrap gap-2">
            <label v-for="v in HILO_VARS" :key="v.key"
              class="flex items-center gap-1.5 cursor-pointer px-2.5 py-1 rounded-lg border text-xs font-medium transition-all"
              :class="selectedHilo.includes(v.key)
                ? 'border-purple-400 bg-purple-50 text-purple-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-purple-300'"
            >
              <input type="checkbox" class="hidden" :value="v.key" v-model="selectedHilo" />
              {{ v.label }}
            </label>
          </div>
        </div>

        <!-- Fechas -->
        <div class="flex flex-col gap-2">
          <div>
            <label class="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Desde</label>
            <input type="date" v-model="fechaInicio"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300 w-full" />
          </div>
          <div>
            <label class="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Hasta</label>
            <input type="date" v-model="fechaFin"
              class="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300 w-full" />
          </div>
        </div>

        <!-- Título Ne (opcional) -->
        <div>
          <label class="text-[10px] text-slate-500 font-bold uppercase tracking-widest block mb-1">Título Ne (opt.)</label>
          <input type="text" v-model="neTitulo" placeholder="ej: 10/1"
            class="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-300 w-full" />
        </div>

        <!-- Botón Analizar -->
        <div class="flex items-end">
          <button @click="analizar" :disabled="loading || selectedHVI.length === 0 || selectedHilo.length === 0"
            class="w-full px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            :class="loading ? 'bg-slate-200 text-slate-500' : 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg'">
            <span v-if="loading" class="animate-spin">⟳</span>
            <span v-else>🔍</span>
            {{ loading ? 'Analizando...' : 'Analizar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ===== BODY ===== -->
    <div class="flex-1 overflow-auto p-6 space-y-6">

      <!-- Estado inicial -->
      <div v-if="!analized && !loading" class="flex flex-col items-center justify-center h-full text-slate-400">
        <div class="text-6xl mb-4">📊</div>
        <p class="text-lg font-semibold">Seleccioná variables y rango de fechas para comenzar</p>
        <p class="text-sm mt-1">El sistema cruzará datos HVI de la mezcla con los ensayos Uster y Tensorapid del hilo resultante</p>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex flex-col items-center justify-center h-64 gap-4">
        <div class="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
        <p class="text-slate-500 text-sm font-medium">Cruzando datos HVI ↔ Uster/Tensorapid...</p>
      </div>

      <!-- Sin datos -->
      <div v-if="analized && !loading && resultados.n === 0"
        class="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
        <div class="text-3xl mb-2">⚠️</div>
        <p class="text-yellow-700 font-semibold">No se encontraron ensayos cruzados en el período seleccionado</p>
        <p class="text-yellow-600 text-sm mt-1">
          Verificá que los números de lote en tb_uster_par coincidan con los MISTURA de tb_calidad_fibra.
        </p>
      </div>

      <template v-if="analized && !loading && resultados.n > 0">

        <!-- ===== RESUMEN AUTOMÁTICO ===== -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 class="text-sm font-black uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-2">
            <span class="p-1 bg-blue-100 text-blue-600 rounded-md text-xs">🤖</span>
            Resumen Automático
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div v-for="item in resumenAutomatico" :key="item.key"
              class="p-3 rounded-xl border text-xs"
              :class="item.clase">
              <div class="font-black text-[10px] uppercase tracking-wider mb-1 opacity-70">{{ item.titulo }}</div>
              <div class="font-semibold leading-snug">{{ item.texto }}</div>
              <div class="mt-1 opacity-60">r = {{ item.r }} · n={{ item.n }}</div>
            </div>
            <div v-if="resumenAutomatico.length === 0"
              class="col-span-3 text-center text-slate-400 py-4 text-sm">
              No se detectaron correlaciones significativas (|r| ≥ 0.3) con los datos disponibles.
              Puede que se necesiten más muestras o un rango de fechas más amplio.
            </div>
          </div>
        </div>

        <!-- ===== MATRIZ DE CORRELACIÓN ===== -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 class="text-sm font-black uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-2">
            <span class="p-1 bg-purple-100 text-purple-600 rounded-md text-xs">📐</span>
            Matriz de Correlación (r de Pearson)
          </h2>
          <div class="overflow-auto">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr>
                  <th class="px-3 py-2 text-left text-slate-500 font-bold bg-slate-50 border border-slate-200 rounded-tl-lg">HVI \ Hilo</th>
                  <th v-for="hv in selectedHiloFiltradas" :key="hv.key"
                    class="px-3 py-2 text-center font-bold bg-purple-50 text-purple-700 border border-slate-200 whitespace-nowrap">
                    {{ hv.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="hv in selectedHVIFiltradas" :key="hv.key">
                  <td class="px-3 py-2 font-bold bg-blue-50 text-blue-700 border border-slate-200 whitespace-nowrap">{{ hv.label }}</td>
                  <td v-for="yv in selectedHiloFiltradas" :key="yv.key"
                    class="px-3 py-2 text-center border border-slate-200 font-mono font-bold"
                    :class="getCeldaClase(hv.key, yv.key)">
                    {{ getCeldaValor(hv.key, yv.key) }}
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="flex gap-4 mt-3 text-[10px] text-slate-500">
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Fuerte ≥ 0.7</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-yellow-100 border border-yellow-300"></span> Moderado 0.5–0.7</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-orange-50 border border-orange-200"></span> Leve 0.3–0.5</span>
              <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-slate-50 border border-slate-200"></span> Sin datos / débil</span>
            </div>
          </div>
        </div>

        <!-- ===== SCATTER PLOTS ===== -->
        <div v-if="scatterPairs.length > 0">
          <h2 class="text-sm font-black uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-2">
            <span class="p-1 bg-emerald-100 text-emerald-600 rounded-md text-xs">📈</span>
            Gráficos de Dispersión
            <span class="text-[10px] text-slate-400 font-normal normal-case">(solo correlaciones con |r| ≥ 0.3 y n ≥ 3)</span>
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <div v-for="pair in scatterPairs" :key="`${pair.hvi_var}-${pair.hilo_var}`"
              class="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div class="flex items-start justify-between mb-3">
                <div>
                  <div class="text-xs font-black text-slate-700">
                    {{ labelHVI(pair.hvi_var) }} → {{ labelHilo(pair.hilo_var) }}
                  </div>
                  <div class="text-[10px] text-slate-400 mt-0.5">{{ pair.n }} pares · R²={{ pair.r2 }}</div>
                </div>
                <div class="text-right">
                  <span class="text-lg font-black" :class="getRColor(pair.r)">r={{ pair.r }}</span>
                  <div class="text-[10px]" :class="getRColor(pair.r)">{{ getRLabel(pair.r) }}</div>
                </div>
              </div>
              <div class="h-44">
                <Scatter :data="getChartData(pair)" :options="getChartOptions(pair)" />
              </div>
              <div class="mt-2 text-[10px] text-slate-400 text-center">
                Pendiente: {{ pair.slope > 0 ? '+' : '' }}{{ pair.slope }} por unidad de {{ labelHVI(pair.hvi_var) }}
              </div>
            </div>
          </div>
        </div>

        <!-- ===== NARRATIVA IA ===== -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
              <span class="p-1 bg-amber-100 text-amber-600 rounded-md text-xs">✨</span>
              Análisis en Lenguaje Natural (IA)
            </h2>
            <button v-if="!narrativa && !cargandoNarrativa"
              @click="generarNarrativa"
              class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2">
              <span>🧠</span> Interpretar resultados
            </button>
            <button v-if="narrativa && !cargandoNarrativa"
              @click="generarNarrativa"
              class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs rounded-lg transition-all flex items-center gap-1.5">
              <span>🔄</span> Regenerar
            </button>
          </div>

          <!-- Resumen automático (siempre visible) -->
          <div v-if="resumenNarrativoCorto" class="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <p class="text-xs text-slate-600 leading-relaxed">{{ resumenNarrativoCorto }}</p>
          </div>

          <!-- Estado loading narrativa -->
          <div v-if="cargandoNarrativa" class="flex items-center gap-3 py-6 justify-center">
            <div class="w-6 h-6 border-2 border-amber-200 border-t-amber-500 rounded-full animate-spin"></div>
            <span class="text-sm text-slate-500">Generando análisis con IA...</span>
          </div>

          <!-- Narrativa Gemini -->
          <div v-if="narrativa && !cargandoNarrativa"
            class="prose prose-sm max-w-none text-slate-700 leading-relaxed"
            v-html="narrativaHtml">
          </div>
        </div>

        <!-- ===== TABLA DETALLE ===== -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-sm font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
              <span class="p-1 bg-slate-100 text-slate-500 rounded-md text-xs">🗃️</span>
              Datos Cruzados ({{ resultados.datos.length }} registros)
            </h2>
            <span class="text-[10px] text-slate-400">Mostrando primeros 100</span>
          </div>
          <div class="overflow-auto max-h-72">
            <table class="w-full text-xs border-collapse">
              <thead class="sticky top-0 bg-slate-50">
                <tr>
                  <th class="px-2 py-2 text-left text-slate-500 border border-slate-200 font-bold">Lote</th>
                  <th class="px-2 py-2 text-center text-slate-500 border border-slate-200 font-bold">Mistura</th>
                  <th class="px-2 py-2 text-center text-slate-500 border border-slate-200 font-bold">Ne</th>
                  <th class="px-2 py-2 text-center text-slate-500 border border-slate-200 font-bold">Fecha</th>
                  <th v-if="selectedHVI.includes('str')" class="px-2 py-2 text-center text-blue-600 border border-slate-200 font-bold">STR</th>
                  <th v-if="selectedHVI.includes('sci')" class="px-2 py-2 text-center text-blue-600 border border-slate-200 font-bold">SCI</th>
                  <th v-if="selectedHVI.includes('mic')" class="px-2 py-2 text-center text-blue-600 border border-slate-200 font-bold">MIC</th>
                  <th v-if="selectedHVI.includes('uhml')" class="px-2 py-2 text-center text-blue-600 border border-slate-200 font-bold">UHML</th>
                  <th v-if="selectedHilo.includes('cvm')" class="px-2 py-2 text-center text-purple-600 border border-slate-200 font-bold">CVm%</th>
                  <th v-if="selectedHilo.includes('vellosidad')" class="px-2 py-2 text-center text-purple-600 border border-slate-200 font-bold">H</th>
                  <th v-if="selectedHilo.includes('neps_200')" class="px-2 py-2 text-center text-purple-600 border border-slate-200 font-bold">Neps</th>
                  <th v-if="selectedHilo.includes('thin_50')" class="px-2 py-2 text-center text-purple-600 border border-slate-200 font-bold">Thin</th>
                  <th v-if="selectedHilo.includes('thick_50')" class="px-2 py-2 text-center text-purple-600 border border-slate-200 font-bold">Thick</th>
                  <th v-if="selectedHilo.includes('tenacidad')" class="px-2 py-2 text-center text-purple-600 border border-slate-200 font-bold">Tenac.</th>
                  <th v-if="selectedHilo.includes('elongacion')" class="px-2 py-2 text-center text-purple-600 border border-slate-200 font-bold">Elon.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in resultados.datos.slice(0, 100)" :key="idx"
                  class="hover:bg-slate-50 transition-colors"
                  :class="idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'">
                  <td class="px-2 py-1.5 border border-slate-100 font-mono text-slate-600">{{ row.lote_raw }}</td>
                  <td class="px-2 py-1.5 border border-slate-100 text-center font-mono text-slate-500">{{ row.mistura_num }}</td>
                  <td class="px-2 py-1.5 border border-slate-100 text-center">{{ row.ne_titulo }}</td>
                  <td class="px-2 py-1.5 border border-slate-100 text-center text-slate-400">{{ row.fecha }}</td>
                  <td v-if="selectedHVI.includes('str')" class="px-2 py-1.5 border border-slate-100 text-center text-blue-600 font-mono">{{ row.str ?? '—' }}</td>
                  <td v-if="selectedHVI.includes('sci')" class="px-2 py-1.5 border border-slate-100 text-center text-blue-600 font-mono">{{ row.sci ?? '—' }}</td>
                  <td v-if="selectedHVI.includes('mic')" class="px-2 py-1.5 border border-slate-100 text-center text-blue-600 font-mono">{{ row.mic ?? '—' }}</td>
                  <td v-if="selectedHVI.includes('uhml')" class="px-2 py-1.5 border border-slate-100 text-center text-blue-600 font-mono">{{ row.uhml ?? '—' }}</td>
                  <td v-if="selectedHilo.includes('cvm')" class="px-2 py-1.5 border border-slate-100 text-center text-purple-600 font-mono">{{ row.cvm ?? '—' }}</td>
                  <td v-if="selectedHilo.includes('vellosidad')" class="px-2 py-1.5 border border-slate-100 text-center text-purple-600 font-mono">{{ row.vellosidad ?? '—' }}</td>
                  <td v-if="selectedHilo.includes('neps_200')" class="px-2 py-1.5 border border-slate-100 text-center text-purple-600 font-mono">{{ row.neps_200 ?? '—' }}</td>
                  <td v-if="selectedHilo.includes('thin_50')" class="px-2 py-1.5 border border-slate-100 text-center text-purple-600 font-mono">{{ row.thin_50 ?? '—' }}</td>
                  <td v-if="selectedHilo.includes('thick_50')" class="px-2 py-1.5 border border-slate-100 text-center text-purple-600 font-mono">{{ row.thick_50 ?? '—' }}</td>
                  <td v-if="selectedHilo.includes('tenacidad')" class="px-2 py-1.5 border border-slate-100 text-center text-purple-600 font-mono">{{ row.tenacidad ?? '—' }}</td>
                  <td v-if="selectedHilo.includes('elongacion')" class="px-2 py-1.5 border border-slate-100 text-center text-purple-600 font-mono">{{ row.elongacion ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js'
import { Scatter } from 'vue-chartjs'

ChartJS.register(LinearScale, PointElement, LineElement, Tooltip, Legend)

// =============================================
// CONSTANTES
// =============================================
const HVI_VARS = [
  { key: 'str',  label: 'STR (g/tex)' },
  { key: 'sci',  label: 'SCI' },
  { key: 'mic',  label: 'MIC' },
  { key: 'uhml', label: 'UHML (mm)' }
]

const HILO_VARS = [
  { key: 'cvm',        label: 'CVm%' },
  { key: 'vellosidad', label: 'Vellosidad H' },
  { key: 'neps_200',   label: 'Neps 200/km' },
  { key: 'thin_50',    label: 'Thin -50/km' },
  { key: 'thick_50',   label: 'Thick +50/km' },
  { key: 'tenacidad',  label: 'Tenacidad (cN/tex)' },
  { key: 'elongacion', label: 'Elongación (%)' }
]

// =============================================
// STATE
// =============================================
const selectedHVI  = ref(['str', 'sci', 'mic', 'uhml'])
const selectedHilo = ref(['cvm', 'neps_200', 'tenacidad', 'vellosidad'])
const fechaInicio  = ref((() => { const d = new Date(); d.setMonth(d.getMonth() - 6); return d.toISOString().split('T')[0] })())
const fechaFin     = ref(new Date().toISOString().split('T')[0])
const neTitulo     = ref('')

const loading          = ref(false)
const analized         = ref(false)
const cargandoNarrativa = ref(false)
const narrativa        = ref('')

const resultados = ref({ n: 0, datos: [], correlaciones: [] })

// =============================================
// COMPUTED - filtros
// =============================================
const selectedHVIFiltradas  = computed(() => HVI_VARS.filter(v => selectedHVI.value.includes(v.key)))
const selectedHiloFiltradas = computed(() => HILO_VARS.filter(v => selectedHilo.value.includes(v.key)))

const correlacionesSignificativas = computed(() =>
  resultados.value.correlaciones.filter(c =>
    Math.abs(c.r) >= 0.3 &&
    selectedHVI.value.includes(c.hvi_var) &&
    selectedHilo.value.includes(c.hilo_var)
  )
)

const scatterPairs = computed(() =>
  correlacionesSignificativas.value
    .filter(c => c.n >= 3)
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 12) // máximo 12 gráficos
)

// =============================================
// RESUMEN AUTOMÁTICO (sin IA)
// =============================================
const resumenAutomatico = computed(() => {
  return correlacionesSignificativas.value
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 9)
    .map(c => {
      const absR = Math.abs(c.r)
      const dir  = c.slope < 0 ? 'baja' : 'sube'
      const dirNeg = c.slope < 0  // para variables donde menor es mejor (CVm, neps, etc.)
      const menorasMejor = ['cvm', 'neps_200', 'thin_50', 'thick_50', 'vellosidad']
      const mejora = menorasMejor.includes(c.hilo_var) ? dirNeg : !dirNeg
      let clase = ''
      let titulo = ''
      if (absR >= 0.7) {
        clase = mejora
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
        titulo = mejora ? '✅ Correlación fuerte — Favorable' : '⚠️ Correlación fuerte — Desfavorable'
      } else if (absR >= 0.5) {
        clase = mejora
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-orange-50 border-orange-200 text-orange-800'
        titulo = mejora ? '↑ Correlación moderada — Favorable' : '↓ Correlación moderada — Desfavorable'
      } else {
        clase = 'bg-slate-50 border-slate-200 text-slate-600'
        titulo = 'Correlación leve'
      }
      const unitHVI = c.hvi_var === 'str' ? 'g/tex' : c.hvi_var === 'uhml' ? 'mm' : c.hvi_var === 'mic' ? '' : ''
      const lhvi  = labelHVI(c.hvi_var)
      const lhilo = labelHilo(c.hilo_var)
      return {
        key:   `${c.hvi_var}-${c.hilo_var}`,
        titulo,
        clase,
        r:   c.r,
        n:   c.n,
        texto: `Cuando ${lhvi} ${dir === 'sube' ? 'sube' : 'baja'} 1${unitHVI ? ' ' + unitHVI : ''}, ${lhilo} ${dir === 'sube' ? 'aumenta' : 'disminuye'} ${Math.abs(c.slope).toFixed(3)} unidades. R²=${c.r2}`
      }
    })
})

// Resumen narrativo corto (siempre visible, sin IA)
const resumenNarrativoCorto = computed(() => {
  if (resultados.value.n === 0) return ''
  const n = resultados.value.n
  const top = correlacionesSignificativas.value
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    .slice(0, 3)

  if (top.length === 0) {
    return `Análisis sobre ${n} ensayos cruzados. No se detectaron correlaciones estadísticamente significativas (|r| ≥ 0.3). Esto puede indicar que se necesita mayor volumen de datos, que existe alta variabilidad en el proceso, o que las variables seleccionadas no tienen relación lineal directa.`
  }

  const frases = top.map(c => {
    const dir = c.slope < 0 ? 'reduce' : 'incrementa'
    return `${labelHVI(c.hvi_var)} ${dir} el ${labelHilo(c.hilo_var)} (r=${c.r})`
  })

  return `Sobre ${n} ensayos cruzados, las relaciones más persistentes detectadas son: ${frases.join('; ')}. Los gráficos de dispersión muestran la distribución real de los datos. Para un análisis técnico detallado, usá el botón "Interpretar resultados".`
})

// =============================================
// NARRATIVA GEMINI (html parseado)
// =============================================
const narrativaHtml = computed(() => {
  if (!narrativa.value) return ''
  // Conversión básica de Markdown a HTML
  let html = narrativa.value
    .replace(/## (.+)/g, '<h3 class="font-black text-slate-800 mt-4 mb-2 text-sm">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>')
  return `<p class="mb-2">${html}</p>`
})

// =============================================
// HELPERS
// =============================================
function labelHVI(key)  { return HVI_VARS.find(v => v.key === key)?.label ?? key }
function labelHilo(key) { return HILO_VARS.find(v => v.key === key)?.label ?? key }

function getCeldaValor(hviKey, hiloKey) {
  const c = resultados.value.correlaciones.find(
    x => x.hvi_var === hviKey && x.hilo_var === hiloKey
  )
  return c ? c.r : '—'
}

function getCeldaClase(hviKey, hiloKey) {
  const c = resultados.value.correlaciones.find(
    x => x.hvi_var === hviKey && x.hilo_var === hiloKey
  )
  if (!c) return 'bg-slate-50 text-slate-300'
  const abs = Math.abs(c.r)
  if (abs >= 0.7) return c.r > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
  if (abs >= 0.5) return c.r > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-100 text-orange-700'
  if (abs >= 0.3) return 'bg-yellow-50 text-yellow-700'
  return 'bg-slate-50 text-slate-400'
}

function getRColor(r) {
  const abs = Math.abs(r)
  if (abs >= 0.7) return r > 0 ? 'text-green-600' : 'text-red-600'
  if (abs >= 0.5) return r > 0 ? 'text-emerald-600' : 'text-orange-600'
  if (abs >= 0.3) return 'text-yellow-600'
  return 'text-slate-400'
}

function getRLabel(r) {
  const abs = Math.abs(r)
  if (abs >= 0.7) return 'Fuerte'
  if (abs >= 0.5) return 'Moderado'
  if (abs >= 0.3) return 'Leve'
  return 'Débil'
}

// =============================================
// CHART DATA / OPTIONS
// =============================================
const COLORS = {
  positive: 'rgba(99, 102, 241, 0.7)',   // indigo
  negative: 'rgba(239, 68, 68, 0.7)',    // red
  line:     'rgba(148, 163, 184, 0.8)'   // slate
}

function getChartData(pair) {
  const color = pair.slope >= 0 ? COLORS.positive : COLORS.negative
  // Línea de regresión
  const xs = pair.puntos.map(p => p.x)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const linePts = [
    { x: xMin, y: pair.slope * xMin + pair.intercept },
    { x: xMax, y: pair.slope * xMax + pair.intercept }
  ]
  return {
    datasets: [
      {
        label: 'Datos',
        data: pair.puntos.map(p => ({ x: p.x, y: p.y, lote: p.lote })),
        backgroundColor: color,
        pointRadius: 5,
        pointHoverRadius: 7,
        type: 'scatter'
      },
      {
        label: 'Tendencia',
        data: linePts,
        type: 'line',
        borderColor: COLORS.line,
        borderWidth: 1.5,
        pointRadius: 0,
        borderDash: [4, 4],
        tension: 0
      }
    ]
  }
}

function getChartOptions(pair) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const d = ctx.raw
            return d.lote
              ? `${d.lote}: (${d.x}, ${d.y})`
              : `(${d.x}, ${d.y})`
          }
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: labelHVI(pair.hvi_var), font: { size: 10 }, color: '#6366f1' },
        ticks: { font: { size: 9 } }
      },
      y: {
        title: { display: true, text: labelHilo(pair.hilo_var), font: { size: 10 }, color: '#a855f7' },
        ticks: { font: { size: 9 } }
      }
    }
  }
}

// =============================================
// ACCIONES
// =============================================
async function analizar() {
  if (selectedHVI.value.length === 0 || selectedHilo.value.length === 0) return
  loading.value  = true
  analized.value = false
  narrativa.value = ''

  try {
    const params = new URLSearchParams({
      fecha_inicio: fechaInicio.value,
      fecha_fin:    fechaFin.value,
      ...(neTitulo.value ? { ne_titulo: neTitulo.value } : {})
    })
    const res  = await fetch(`/api/correlacion/mezcla-hilo?${params}`)
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    resultados.value = json
  } catch (err) {
    alert('Error al obtener datos: ' + err.message)
  } finally {
    loading.value  = false
    analized.value = true
  }
}

async function generarNarrativa() {
  if (resultados.value.n === 0) return
  cargandoNarrativa.value = true

  try {
    const res = await fetch('/api/correlacion/narrativa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        correlaciones: resultados.value.correlaciones.filter(c =>
          selectedHVI.value.includes(c.hvi_var) &&
          selectedHilo.value.includes(c.hilo_var)
        ),
        n:            resultados.value.n,
        fecha_inicio: fechaInicio.value,
        fecha_fin:    fechaFin.value,
        ne_titulo:    neTitulo.value || null,
        model:        'gemini-2.0-flash'
      })
    })
    const json = await res.json()
    if (!json.success) throw new Error(json.error)
    narrativa.value = json.narrativa
  } catch (err) {
    alert('Error al generar narrativa: ' + err.message)
  } finally {
    cargandoNarrativa.value = false
  }
}
</script>
