<template>
  <div class="w-full flex-1 flex flex-col min-h-0 overflow-y-auto p-2 gap-3">

    <!-- Header con navegación de fecha -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
      <div class="flex items-center gap-3">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
          📊 Seguimiento Diario
        </h2>
        <div class="flex items-center gap-1">
          <button @click="irFechaAnterior" :disabled="!fechaAnterior"
            class="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="px-3 py-1 bg-slate-100 rounded-lg text-sm font-bold text-slate-800 font-mono min-w-[110px] text-center">
            {{ fechaActual || '...' }}
          </span>
          <button @click="irFechaSiguiente" :disabled="!fechaSiguiente"
            class="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        <button @click="cargarDatos" :disabled="loading"
          class="p-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300">
          <svg v-if="loading" class="animate-spin h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
          </svg>
          <span v-else class="text-xs font-bold">🔄</span>
        </button>
      </div>

      <!-- KPIs -->
      <div v-if="totales" class="flex items-center gap-3 text-xs flex-wrap">
        <span class="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 font-semibold text-slate-700">
          {{ totales.total_articulos }} artículos · {{ totales.total_ensayos }} ensayos
        </span>
        <span v-if="totales.enc_urd_promedio !== null" class="px-2.5 py-1 rounded-lg border font-bold"
          :class="totales.enc_urd_promedio > -1.0 ? 'bg-red-50 border-red-300 text-red-800' : totales.enc_urd_promedio > -1.2 ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-emerald-50 border-emerald-300 text-emerald-800'">
          Enc.Urd Prom: {{ totales.enc_urd_promedio }}%
        </span>
        <span v-if="totales.enc_urd_critico > 0" class="px-2.5 py-1 bg-red-100 border border-red-300 text-red-800 rounded-lg font-extrabold">
          🔴 {{ totales.enc_urd_critico }} CRÍTICO{{ totales.enc_urd_critico > 1 ? 'S' : '' }}
        </span>
        <span v-if="totales.enc_urd_alerta > 0" class="px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-800 rounded-lg font-bold">
          🟡 {{ totales.enc_urd_alerta }} alerta{{ totales.enc_urd_alerta > 1 ? 's' : '' }}
        </span>
      </div>
    </div>

    <!-- TABLA DE ARTÍCULOS DEL DÍA -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] flex-shrink-0">
        <span class="font-bold text-slate-800">Artículos del día — Click en "📈 Tendencia" o en Enc.Urd % para abrir gráfico</span>
        <div class="flex items-center gap-3 text-slate-600">
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span> En meta [-1.5, -1.0]</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Alerta/Deriva</span>
          <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span> Fuera de rango / Crítico</span>
        </div>
      </div>

      <div class="overflow-auto flex-1 min-h-0">
        <table class="w-full table-auto text-xs border-collapse">
          <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-10">
            <tr>
              <th class="px-3 py-2 text-left font-bold text-slate-700 border-b-2 border-slate-200 min-w-[180px]">Artículo</th>
              <th class="px-2 py-2 text-center font-bold text-slate-600 border-b-2 border-slate-200">Ensayos</th>
              <!-- Enc.Urd % -->
              <th class="px-2 py-2 text-center font-extrabold text-blue-800 border-b-2 border-blue-300 bg-blue-50/60 min-w-[100px]">Enc.Urd %</th>
              <th class="px-2 py-2 text-center font-bold text-slate-600 border-b-2 border-slate-200">Enc.Tra %</th>
              <th class="px-2 py-2 text-center font-bold text-slate-700 border-b-2 border-slate-200">Ancho TEST</th>
              <th class="px-2 py-2 text-center font-bold text-blue-700 border-b-2 border-blue-200 bg-blue-50/30">Ancho MESA</th>
              <th class="px-2 py-2 text-center font-bold text-slate-500 border-b-2 border-slate-200">Ancho Espec</th>
              <th class="px-2 py-2 text-center font-bold text-slate-700 border-b-2 border-slate-200">Peso TEST</th>
              <th class="px-2 py-2 text-center font-bold text-blue-700 border-b-2 border-blue-200 bg-blue-50/30">Peso MESA</th>
              <th class="px-2 py-2 text-center font-bold text-slate-500 border-b-2 border-slate-200">Peso Espec</th>
              <th class="px-2 py-2 text-center font-bold text-slate-700 border-b-2 border-slate-200">Acción</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="11" class="py-8 text-center text-slate-500">
                <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
                <p class="mt-2 text-xs">Cargando artículos del día...</p>
              </td>
            </tr>
            <tr v-else-if="articulosAgrupados.length === 0">
              <td colspan="11" class="py-8 text-center text-slate-500">No hay ensayos registrados para esta fecha</td>
            </tr>
            <tr v-for="art in articulosAgrupados" :key="art.articulo"
              class="border-b border-slate-100 hover:bg-blue-50/30 transition-colors"
              :class="articuloExpandido === art.articulo ? 'bg-blue-50/50' : ''">
              <!-- Artículo -->
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <button @click="toggleDetalle(art.articulo)" class="text-[10px] text-slate-400 hover:text-blue-600">
                    {{ articuloExpandido === art.articulo ? '▼' : '▶' }}
                  </button>
                  <div>
                    <div class="font-mono font-extrabold text-slate-900 cursor-pointer hover:text-blue-700" @click="abrirGrafico(art, 'enc_urd')">
                      {{ art.articuloCorto }}
                    </div>
                    <div class="text-[10px] text-slate-500">{{ art.nombre }} · {{ art.trama || '' }}</div>
                  </div>
                </div>
              </td>
              <!-- Ensayos -->
              <td class="px-2 py-2.5 text-center font-mono font-bold text-slate-700 cursor-pointer" @click="toggleDetalle(art.articulo)">
                {{ art.count }}
              </td>
              <!-- Enc.Urd % - Clic para ver gráfico -->
              <td class="px-2 py-2.5 text-center font-mono font-extrabold text-sm bg-blue-50/40 cursor-pointer hover:bg-blue-100 transition-colors"
                :class="encUrdColorClass(art.encUrdAvg)"
                @click="abrirGrafico(art, 'enc_urd')"
                title="Haga clic para ver gráfico de tendencia de Enc.Urd %">
                <div class="flex items-center justify-center gap-1">
                  <span>{{ art.encUrdAvg !== null ? art.encUrdAvg.toFixed(2) + '%' : '-' }}</span>
                  <span class="text-[10px]">📈</span>
                </div>
              </td>
              <!-- Enc.Trama % -->
              <td class="px-2 py-2.5 text-center font-mono text-slate-700">{{ art.encTramaAvg !== null ? art.encTramaAvg.toFixed(2) : '-' }}</td>
              <!-- Ancho TEST -->
              <td class="px-2 py-2.5 text-center font-mono cursor-pointer hover:bg-slate-100"
                :class="rangoColorClass(art.anchoTestAvg, art.anchoMin, art.anchoMax)"
                @click="abrirGrafico(art, 'ancho')">
                {{ art.anchoTestAvg !== null ? art.anchoTestAvg.toFixed(1) : '-' }}
              </td>
              <!-- Ancho MESA -->
              <td class="px-2 py-2.5 text-center font-mono bg-blue-50/20" :class="art.anchoMesaAvg !== null ? rangoColorClass(art.anchoMesaAvg, art.anchoMin, art.anchoMax) : 'text-slate-400'">
                {{ art.anchoMesaAvg !== null ? art.anchoMesaAvg.toFixed(1) : '—' }}
              </td>
              <!-- Ancho Espec -->
              <td class="px-2 py-2.5 text-center text-[10px] text-slate-500">
                {{ art.anchoMin ? `${art.anchoMin}-` : '' }}<strong>{{ art.anchoStd || '-' }}</strong>{{ art.anchoMax ? `-${art.anchoMax}` : '' }}
              </td>
              <!-- Peso TEST -->
              <td class="px-2 py-2.5 text-center font-mono cursor-pointer hover:bg-slate-100"
                :class="rangoColorClass(art.pesoTestAvg, art.pesoMin, art.pesoMax)"
                @click="abrirGrafico(art, 'peso')">
                {{ art.pesoTestAvg !== null ? art.pesoTestAvg.toFixed(1) : '-' }}
              </td>
              <!-- Peso MESA -->
              <td class="px-2 py-2.5 text-center font-mono bg-blue-50/20" :class="art.pesoMesaAvg !== null ? rangoColorClass(art.pesoMesaAvg, art.pesoMin, art.pesoMax) : 'text-slate-400'">
                {{ art.pesoMesaAvg !== null ? art.pesoMesaAvg.toFixed(1) : '—' }}
              </td>
              <!-- Peso Espec -->
              <td class="px-2 py-2.5 text-center text-[10px] text-slate-500">
                {{ art.pesoMin ? `${art.pesoMin}-` : '' }}<strong>{{ art.pesoStd || '-' }}</strong>{{ art.pesoMax ? `-${art.pesoMax}` : '' }}
              </td>
              <!-- Acciones -->
              <td class="px-2 py-2.5 text-center">
                <div class="flex items-center justify-center gap-1">
                  <button @click="abrirGrafico(art, 'enc_urd')"
                    class="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
                    title="Ver tendencia histórica de Enc.Urd %">
                    📈 Tendencia
                  </button>
                  <button @click="toggleDetalle(art.articulo)"
                    class="px-1.5 py-1 bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 rounded text-[11px] font-bold">
                    {{ articuloExpandido === art.articulo ? 'Ocultar' : 'Partidas' }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detalle expandido: partidas del artículo seleccionado -->
      <div v-if="articuloExpandido && partidasExpandidas.length > 0"
        class="border-t-2 border-blue-300 bg-blue-50/30 px-4 py-3 flex-shrink-0 max-h-60 overflow-auto">
        <div class="flex items-center justify-between mb-2">
          <div class="text-xs font-bold text-blue-800">
            Detalle de ensayos del día: {{ articuloExpandido }} ({{ partidasExpandidas.length }} registros)
          </div>
          <button @click="articuloExpandido = null" class="text-xs text-slate-500 hover:text-slate-800">✕ Cerrar</button>
        </div>
        <table class="w-full text-[11px] table-auto">
          <thead class="bg-blue-100/50">
            <tr>
              <th class="px-2 py-1 text-left font-semibold text-blue-900">Partida</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Maq</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Turno</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Hora</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Ap</th>
              <th class="px-2 py-1 text-center font-bold text-blue-900 bg-blue-100">Enc.Urd%</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Enc.Tra%</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Ancho T</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Peso T</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Ancho M</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Peso M</th>
              <th class="px-2 py-1 text-center font-semibold text-blue-900">Metros</th>
              <th class="px-2 py-1 text-left font-semibold text-blue-900">Obs</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in partidasExpandidas" :key="i" class="border-b border-blue-100 hover:bg-blue-100/30">
              <td class="px-2 py-1 font-mono text-slate-800">{{ p.Partida }}</td>
              <td class="px-2 py-1 text-center text-slate-600">{{ p.Maquina || '-' }}</td>
              <td class="px-2 py-1 text-center text-slate-600">{{ p.Turno || '-' }}</td>
              <td class="px-2 py-1 text-center text-slate-600">{{ p.Hora || '-' }}</td>
              <td class="px-2 py-1 text-center">
                <span class="px-1 py-0.5 rounded text-[9px] font-bold" :class="p.Ap === 'A' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'">{{ p.Ap || '-' }}</span>
              </td>
              <td class="px-2 py-1 text-center font-mono font-bold bg-blue-50/30" :class="encUrdColorClass(parseFloat(p.EncUrd))">{{ p.EncUrd ?? '-' }}</td>
              <td class="px-2 py-1 text-center font-mono text-slate-700">{{ p.EncTrama ?? '-' }}</td>
              <td class="px-2 py-1 text-center font-mono text-slate-700">{{ p.AnchoTest ?? '-' }}</td>
              <td class="px-2 py-1 text-center font-mono text-slate-700">{{ p.PesoTest ?? '-' }}</td>
              <td class="px-2 py-1 text-center font-mono" :class="p.AnchoMesa ? 'text-blue-700 font-semibold' : 'text-slate-400'">{{ p.AnchoMesa ?? '—' }}</td>
              <td class="px-2 py-1 text-center font-mono" :class="p.PesoMesa ? 'text-blue-700 font-semibold' : 'text-slate-400'">{{ p.PesoMesa ?? '—' }}</td>
              <td class="px-2 py-1 text-center font-mono text-slate-600">{{ p.MetrosTest ?? '-' }}</td>
              <td class="px-2 py-1 text-slate-500 truncate max-w-[100px]" :title="p.Obs || ''">{{ p.Obs || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL DE GRÁFICO DE TENDENCIA DINÁMICA -->
    <div v-if="modalGraficoAbierto" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div class="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in">
        
        <!-- Modal Header -->
        <div class="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-xl">📈</span>
              <h3 class="text-base font-bold text-slate-800">
                Tendencia de Variable: <span class="font-mono text-blue-700">{{ articuloSeleccionadoGrafico?.articulo }}</span>
              </h3>
              <span v-if="articuloSeleccionadoGrafico?.nombre" class="text-xs text-slate-500 font-semibold">
                ({{ articuloSeleccionadoGrafico.nombre }})
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              Fecha analizada: <strong class="text-slate-800 font-mono">{{ fechaActual }}</strong> 
              · Ventana: <span class="font-mono font-semibold">{{ rangoGrafico.inicio }}</span> a <span class="font-mono font-semibold">{{ rangoGrafico.fin }}</span>
              <span v-if="esUltimoDiaGrafico" class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                📅 (30 días atrás hasta hoy)
              </span>
              <span v-else class="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                📅 (Centrado ±15 días de fecha analizada)
              </span>
            </p>
          </div>
          <button @click="cerrarGrafico" class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 text-lg font-bold">
            ✕
          </button>
        </div>

        <!-- Selector de Variable (Tabs inside Modal) -->
        <div class="px-5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <div class="flex items-center gap-2">
            <button @click="variableGrafico = 'enc_urd'; renderizarGrafico()"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              :class="variableGrafico === 'enc_urd' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-200 border'">
              🎯 Encogimiento Urdido %
            </button>
            <button @click="variableGrafico = 'ancho'; renderizarGrafico()"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              :class="variableGrafico === 'ancho' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-200 border'">
              📏 Ancho (TEST vs MESA)
            </button>
            <button @click="variableGrafico = 'peso'; renderizarGrafico()"
              class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              :class="variableGrafico === 'peso' ? 'bg-blue-600 text-white shadow' : 'bg-white text-slate-700 hover:bg-slate-200 border'">
              ⚖️ Peso (g/m²)
            </button>
          </div>
          <div class="text-xs text-slate-600 flex items-center gap-3">
            <span class="flex items-center gap-1 font-semibold"><span class="w-3 h-0.5 bg-blue-600 inline-block"></span> Promedio</span>
            <span class="flex items-center gap-1 font-semibold"><span class="w-3 h-0.5 bg-slate-400 border-t border-dashed inline-block"></span> Min / Max</span>
            <span v-if="variableGrafico === 'enc_urd'" class="flex items-center gap-1 font-semibold text-emerald-700"><span class="w-3 h-0.5 bg-emerald-500 inline-block"></span> Meta (-1.5%)</span>
            <span v-if="variableGrafico === 'enc_urd'" class="flex items-center gap-1 font-semibold text-red-700"><span class="w-3 h-0.5 bg-red-500 inline-block"></span> Crítico (-1.0%)</span>
          </div>
        </div>

        <!-- Body con Canvas de Chart.js -->
        <div class="p-4 flex-1 min-h-[340px] flex flex-col justify-center relative bg-white">
          <div v-if="cargandoGrafico" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
              <p class="mt-2 text-xs font-semibold text-slate-600">Cargando serie histórica de tendencias...</p>
            </div>
          </div>
          <div class="w-full h-full min-h-[320px] relative">
            <canvas ref="chartCanvas"></canvas>
          </div>
        </div>

        <!-- Footer del Modal -->
        <div class="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
          <div class="flex items-center gap-4">
            <span v-if="especificacionGrafico?.UrdMin">
              Ficha Urdido: <strong class="font-mono text-slate-800">{{ especificacionGrafico.UrdMin }}%</strong> a <strong class="font-mono text-slate-800">{{ especificacionGrafico.UrdMax }}%</strong>
            </span>
            <span v-if="especificacionGrafico?.AnchoStd">
              Ficha Ancho: <strong class="font-mono text-slate-800">{{ especificacionGrafico.AnchoStd }} cm</strong> (Min: {{ especificacionGrafico.AnchoMin }} / Max: {{ especificacionGrafico.AnchoMax }})
            </span>
          </div>
          <button @click="cerrarGrafico" class="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold">
            Cerrar
          </button>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const apiUrl = (path) => `${API_BASE}${path}`

const loading = ref(false)
const fechaActual = ref(null)
const fechasDisponibles = ref([])
const totales = ref(null)
const ensayos = ref([])
const articuloExpandido = ref(null)

// Estado del Modal de Gráfico
const modalGraficoAbierto = ref(false)
const cargandoGrafico = ref(false)
const articuloSeleccionadoGrafico = ref(null)
const variableGrafico = ref('enc_urd') // 'enc_urd' | 'ancho' | 'peso'
const datosGrafico = ref(null)
const rangoGrafico = ref({ inicio: '', fin: '' })
const esUltimoDiaGrafico = ref(false)
const especificacionGrafico = ref(null)
const chartCanvas = ref(null)
let chartInstance = null

// Navegación de fechas
const fechaAnterior = computed(() => {
  if (!fechaActual.value || !fechasDisponibles.value.length) return null
  const idx = fechasDisponibles.value.indexOf(fechaActual.value)
  return idx >= 0 && idx < fechasDisponibles.value.length - 1 ? fechasDisponibles.value[idx + 1] : null
})
const fechaSiguiente = computed(() => {
  if (!fechaActual.value || !fechasDisponibles.value.length) return null
  const idx = fechasDisponibles.value.indexOf(fechaActual.value)
  return idx > 0 ? fechasDisponibles.value[idx - 1] : null
})
const irFechaAnterior = () => { if (fechaAnterior.value) { fechaActual.value = fechaAnterior.value; cargarDatos() } }
const irFechaSiguiente = () => { if (fechaSiguiente.value) { fechaActual.value = fechaSiguiente.value; cargarDatos() } }

// Agrupar ensayos por artículo para mostrar resumen
const articulosAgrupados = computed(() => {
  if (!ensayos.value.length) return []
  const map = {}
  for (const e of ensayos.value) {
    const key = e.Articulo
    if (!map[key]) {
      map[key] = {
        articulo: key,
        articuloCorto: key?.substring(0, 10) || key,
        nombre: e.Nombre || '',
        color: e.Color || '',
        trama: e.Trama || '',
        count: 0,
        encUrdSum: 0, encUrdCount: 0,
        encTramaSum: 0, encTramaCount: 0,
        anchoTestSum: 0, anchoTestCount: 0,
        pesoTestSum: 0, pesoTestCount: 0,
        anchoMesaSum: 0, anchoMesaCount: 0,
        pesoMesaSum: 0, pesoMesaCount: 0,
        anchoMin: parseFloat(e.AnchoMin) || null,
        anchoStd: parseFloat(e.AnchoStd) || null,
        anchoMax: parseFloat(e.AnchoMax) || null,
        pesoMin: parseFloat(e.PesoMin) || null,
        pesoStd: parseFloat(e.PesoStd) || null,
        pesoMax: parseFloat(e.PesoMax) || null,
        urdMin: parseFloat(e.UrdMin) || null,
        urdMax: parseFloat(e.UrdMax) || null,
      }
    }
    const a = map[key]
    a.count++
    const eu = parseFloat(e.EncUrd); if (!isNaN(eu)) { a.encUrdSum += eu; a.encUrdCount++ }
    const et = parseFloat(e.EncTrama); if (!isNaN(et)) { a.encTramaSum += et; a.encTramaCount++ }
    const at = parseFloat(e.AnchoTest); if (!isNaN(at)) { a.anchoTestSum += at; a.anchoTestCount++ }
    const pt = parseFloat(e.PesoTest); if (!isNaN(pt)) { a.pesoTestSum += pt; a.pesoTestCount++ }
    const am = parseFloat(e.AnchoMesa); if (!isNaN(am)) { a.anchoMesaSum += am; a.anchoMesaCount++ }
    const pm = parseFloat(e.PesoMesa); if (!isNaN(pm)) { a.pesoMesaSum += pm; a.pesoMesaCount++ }
  }
  return Object.values(map).map(a => ({
    ...a,
    encUrdAvg: a.encUrdCount > 0 ? a.encUrdSum / a.encUrdCount : null,
    encTramaAvg: a.encTramaCount > 0 ? a.encTramaSum / a.encTramaCount : null,
    anchoTestAvg: a.anchoTestCount > 0 ? a.anchoTestSum / a.anchoTestCount : null,
    pesoTestAvg: a.pesoTestCount > 0 ? a.pesoTestSum / a.pesoTestCount : null,
    anchoMesaAvg: a.anchoMesaCount > 0 ? a.anchoMesaSum / a.anchoMesaCount : null,
    pesoMesaAvg: a.pesoMesaCount > 0 ? a.pesoMesaSum / a.pesoMesaCount : null,
  })).sort((a, b) => {
    const sa = estadoPrioridad(a)
    const sb = estadoPrioridad(b)
    if (sa !== sb) return sa - sb
    return (a.articulo || '').localeCompare(b.articulo || '')
  })
})

// Partidas del artículo expandido
const partidasExpandidas = computed(() => {
  if (!articuloExpandido.value) return []
  return ensayos.value.filter(e => e.Articulo === articuloExpandido.value)
})

const toggleDetalle = (articulo) => {
  articuloExpandido.value = articuloExpandido.value === articulo ? null : articulo
}

// Cargar datos principales del día
const cargarDatos = async () => {
  loading.value = true
  articuloExpandido.value = null
  try {
    const url = fechaActual.value
      ? apiUrl(`/api/produccion/calidad/resumen-dia-anterior?fecha=${fechaActual.value}`)
      : apiUrl(`/api/produccion/calidad/resumen-dia-anterior`)
    const res = await fetch(url)
    const data = await res.json()
    fechaActual.value = data.target_date
    fechasDisponibles.value = data.fechas_disponibles || []
    totales.value = data.totales
    ensayos.value = data.ensayos || []
  } catch (err) {
    console.error('Error cargando datos:', err)
  } finally {
    loading.value = false
  }
}

// ===== LÓGICA Y MANEJO DEL GRÁFICO DE TENDENCIAS =====

const abrirGrafico = async (art, variable = 'enc_urd') => {
  articuloSeleccionadoGrafico.value = art
  variableGrafico.value = variable
  modalGraficoAbierto.value = true
  cargandoGrafico.value = true

  try {
    const url = apiUrl(`/api/produccion/calidad/seguimiento-tendencias?articulo=${encodeURIComponent(art.articulo)}&fecha_referencia=${fechaActual.value}`)
    const res = await fetch(url)
    const data = await res.json()
    
    datosGrafico.value = data.diario || []
    rangoGrafico.value = data.rango || { inicio: '', fin: '' }
    esUltimoDiaGrafico.value = data.es_ultimo_dia || false
    especificacionGrafico.value = data.especificacion || null

    await nextTick()
    renderizarGrafico()
  } catch (err) {
    console.error('Error cargando tendencia para el gráfico:', err)
  } finally {
    cargandoGrafico.value = false
  }
}

const cerrarGrafico = () => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  modalGraficoAbierto.value = false
}

const renderizarGrafico = async () => {
  if (!chartCanvas.value || !datosGrafico.value) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const diario = datosGrafico.value
  const labels = diario.map(d => {
    const parts = String(d.Fecha).split('T')[0].split('-')
    return `${parts[2]}/${parts[1]}`
  })

  let datasets = []
  let yMin = undefined
  let yMax = undefined

  if (variableGrafico.value === 'enc_urd') {
    const avgData = diario.map(d => d.EncUrdAvg !== null ? parseFloat(d.EncUrdAvg) : null)
    const minData = diario.map(d => d.EncUrdMin !== null ? parseFloat(d.EncUrdMin) : null)
    const maxData = diario.map(d => d.EncUrdMax !== null ? parseFloat(d.EncUrdMax) : null)

    // Resaltar la fecha analizada con punto gigante
    const targetIdx = diario.findIndex(d => String(d.Fecha).split('T')[0] === fechaActual.value)
    const pointRadius = labels.map((_, i) => i === targetIdx ? 8 : 4)
    const pointHoverRadius = labels.map((_, i) => i === targetIdx ? 11 : 6)
    const pointBackgroundColor = labels.map((_, i) => i === targetIdx ? '#1d4ed8' : '#3b82f6')
    const pointBorderColor = labels.map((_, i) => i === targetIdx ? '#ffffff' : '#ffffff')
    const pointBorderWidth = labels.map((_, i) => i === targetIdx ? 3 : 1.5)

    datasets = [
      {
        label: 'Enc.Urd Promedio %',
        data: avgData,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 3,
        tension: 0.2,
        fill: false,
        pointRadius,
        pointHoverRadius,
        pointBackgroundColor,
        pointBorderColor,
        pointBorderWidth
      },
      {
        label: 'Mínimo %',
        data: minData,
        borderColor: '#94a3b8',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 2,
        fill: false
      },
      {
        label: 'Máximo %',
        data: maxData,
        borderColor: '#94a3b8',
        borderWidth: 1.5,
        borderDash: [4, 4],
        pointRadius: 2,
        fill: false
      },
      {
        label: 'Meta Ideal (-1.5%)',
        data: labels.map(() => -1.5),
        borderColor: '#10b981',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false
      },
      {
        label: 'Crítico (-1.0%)',
        data: labels.map(() => -1.0),
        borderColor: '#ef4444',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false
      }
    ]
  } else if (variableGrafico.value === 'ancho') {
    const testData = diario.map(d => d.AnchoTestAvg !== null ? parseFloat(d.AnchoTestAvg) : null)
    const mesaData = diario.map(d => d.AnchoMesaAvg !== null ? parseFloat(d.AnchoMesaAvg) : null)
    const stdVal = especificacionGrafico.value?.AnchoStd ? parseFloat(especificacionGrafico.value.AnchoStd) : null
    const minVal = especificacionGrafico.value?.AnchoMin ? parseFloat(especificacionGrafico.value.AnchoMin) : null
    const maxVal = especificacionGrafico.value?.AnchoMax ? parseFloat(especificacionGrafico.value.AnchoMax) : null

    datasets = [
      {
        label: 'Ancho TEST (cm)',
        data: testData,
        borderColor: '#2563eb',
        borderWidth: 3,
        tension: 0.2,
        fill: false
      },
      {
        label: 'Ancho MESA Revisión (cm)',
        data: mesaData,
        borderColor: '#8b5cf6',
        borderWidth: 2.5,
        tension: 0.2,
        fill: false
      }
    ]
    if (stdVal) {
      datasets.push({
        label: `Especificación (${stdVal} cm)`,
        data: labels.map(() => stdVal),
        borderColor: '#10b981',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false
      })
    }
    if (minVal && maxVal) {
      datasets.push({
        label: `Límites (${minVal} - ${maxVal} cm)`,
        data: labels.map(() => minVal),
        borderColor: '#ef4444',
        borderWidth: 1,
        borderDash: [4, 4],
        pointRadius: 0,
        fill: false
      })
    }
  } else if (variableGrafico.value === 'peso') {
    const testData = diario.map(d => d.PesoTestAvg !== null ? parseFloat(d.PesoTestAvg) : null)
    const mesaData = diario.map(d => d.PesoMesaAvg !== null ? parseFloat(d.PesoMesaAvg) : null)
    const stdVal = especificacionGrafico.value?.PesoStd ? parseFloat(especificacionGrafico.value.PesoStd) : null

    datasets = [
      {
        label: 'Peso TEST (g/m²)',
        data: testData,
        borderColor: '#2563eb',
        borderWidth: 3,
        tension: 0.2,
        fill: false
      },
      {
        label: 'Peso MESA Revisión (g/m²)',
        data: mesaData,
        borderColor: '#059669',
        borderWidth: 2.5,
        tension: 0.2,
        fill: false
      }
    ]
    if (stdVal) {
      datasets.push({
        label: `Std (${stdVal} g/m²)`,
        data: labels.map(() => stdVal),
        borderColor: '#f59e0b',
        borderWidth: 2,
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false
      })
    }
  }

  const ctx = chartCanvas.value.getContext('2d')
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
          position: 'top',
          labels: { font: { size: 11, weight: 'bold' } }
        },
        tooltip: {
          callbacks: {
            title: (items) => {
              if (!items.length) return ''
              const idx = items[0].dataIndex
              const d = diario[idx]
              return `Fecha: ${d.Fecha} (${d.EnsayosCount} ensayo${d.EnsayosCount > 1 ? 's' : ''})`
            }
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { size: 10, weight: '600' } }
        },
        y: {
          grid: { color: '#e2e8f0' },
          ticks: { font: { size: 11, weight: '600' } }
        }
      }
    }
  })
}

// ===== Helpers de color y estado =====

const encUrdColorClass = (val) => {
  if (val === null || isNaN(val)) return 'text-slate-400'
  if (val > -1.0) return 'text-red-700'
  if (val > -1.2) return 'text-amber-700'
  if (val >= -1.6) return 'text-emerald-700'
  return 'text-slate-700'
}

const rangoColorClass = (val, min, max) => {
  if (val === null || isNaN(val)) return 'text-slate-400'
  if (min !== null && val < min) return 'text-red-700 font-bold'
  if (max !== null && val > max) return 'text-red-700 font-bold'
  return 'text-slate-800'
}

const estadoPrioridad = (art) => {
  if (art.encUrdAvg !== null && art.encUrdAvg > -1.0) return 0
  const anchoFuera = art.anchoTestAvg !== null && art.anchoMin !== null && art.anchoMax !== null &&
    (art.anchoTestAvg < art.anchoMin || art.anchoTestAvg > art.anchoMax)
  const pesoFuera = art.pesoTestAvg !== null && art.pesoMin !== null && art.pesoMax !== null &&
    (art.pesoTestAvg < art.pesoMin || art.pesoTestAvg > art.pesoMax)
  if (anchoFuera || pesoFuera) return 1
  if (art.encUrdAvg !== null && art.encUrdAvg > -1.2) return 2
  return 3
}

onMounted(() => { cargarDatos() })
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fade-in {
  animation: fadeIn 0.18s ease-out forwards;
}
</style>
