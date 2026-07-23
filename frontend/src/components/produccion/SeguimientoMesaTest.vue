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

    <!-- TABLA DE ARTÍCULOS DEL DÍA (agrupados) -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center justify-between text-[11px] flex-shrink-0">
        <span class="font-bold text-slate-800">Artículos del día — Promedios y Estado de Variables</span>
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
              <th class="px-2 py-2 text-center font-extrabold text-blue-800 border-b-2 border-blue-300 bg-blue-50/60 min-w-[90px]">Enc.Urd %</th>
              <th class="px-2 py-2 text-center font-bold text-slate-600 border-b-2 border-slate-200">Enc.Tra %</th>
              <th class="px-2 py-2 text-center font-bold text-slate-700 border-b-2 border-slate-200">Ancho TEST</th>
              <th class="px-2 py-2 text-center font-bold text-blue-700 border-b-2 border-blue-200 bg-blue-50/30">Ancho MESA</th>
              <th class="px-2 py-2 text-center font-bold text-slate-500 border-b-2 border-slate-200">Ancho Espec</th>
              <th class="px-2 py-2 text-center font-bold text-slate-700 border-b-2 border-slate-200">Peso TEST</th>
              <th class="px-2 py-2 text-center font-bold text-blue-700 border-b-2 border-blue-200 bg-blue-50/30">Peso MESA</th>
              <th class="px-2 py-2 text-center font-bold text-slate-500 border-b-2 border-slate-200">Peso Espec</th>
              <th class="px-2 py-2 text-center font-bold text-slate-700 border-b-2 border-slate-200">Estado</th>
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
              class="border-b border-slate-100 hover:bg-blue-50/30 transition-colors cursor-pointer"
              :class="articuloExpandido === art.articulo ? 'bg-blue-50/50' : ''"
              @click="toggleDetalle(art.articulo)">
              <!-- Artículo -->
              <td class="px-3 py-2.5">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] text-slate-400">{{ articuloExpandido === art.articulo ? '▼' : '▶' }}</span>
                  <div>
                    <div class="font-mono font-extrabold text-slate-900">{{ art.articuloCorto }}</div>
                    <div class="text-[10px] text-slate-500">{{ art.nombre }} · {{ art.trama || '' }}</div>
                  </div>
                </div>
              </td>
              <!-- Ensayos -->
              <td class="px-2 py-2.5 text-center font-mono font-bold text-slate-700">{{ art.count }}</td>
              <!-- Enc.Urd % -->
              <td class="px-2 py-2.5 text-center font-mono font-extrabold text-sm bg-blue-50/40" :class="encUrdColorClass(art.encUrdAvg)">
                {{ art.encUrdAvg !== null ? art.encUrdAvg.toFixed(2) + '%' : '-' }}
              </td>
              <!-- Enc.Trama % -->
              <td class="px-2 py-2.5 text-center font-mono text-slate-700">{{ art.encTramaAvg !== null ? art.encTramaAvg.toFixed(2) : '-' }}</td>
              <!-- Ancho TEST -->
              <td class="px-2 py-2.5 text-center font-mono" :class="rangoColorClass(art.anchoTestAvg, art.anchoMin, art.anchoMax)">
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
              <td class="px-2 py-2.5 text-center font-mono" :class="rangoColorClass(art.pesoTestAvg, art.pesoMin, art.pesoMax)">
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
              <!-- Estado global -->
              <td class="px-2 py-2.5 text-center">
                <span class="px-2 py-1 rounded-full text-[10px] font-extrabold border inline-flex items-center gap-1"
                  :class="estadoBadgeClass(art)">
                  {{ estadoIcon(art) }} {{ estadoLabel(art) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Detalle expandido: partidas del artículo seleccionado -->
      <div v-if="articuloExpandido && partidasExpandidas.length > 0"
        class="border-t-2 border-blue-300 bg-blue-50/30 px-4 py-3 flex-shrink-0 max-h-60 overflow-auto">
        <div class="text-xs font-bold text-blue-800 mb-2">
          Detalle de ensayos: {{ articuloExpandido }} ({{ partidasExpandidas.length }} registros)
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const apiUrl = (path) => `${API_BASE}${path}`

const loading = ref(false)
const fechaActual = ref(null)
const fechasDisponibles = ref([])
const totales = ref(null)
const ensayos = ref([])
const articuloExpandido = ref(null)

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
    // Mostrar primero los que tienen desvío
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

// Cargar datos
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

// ===== Helpers de color y estado =====

// Encogimiento Urdido: Meta [-1.5, -1.0], Crítico > -1.0
const encUrdColorClass = (val) => {
  if (val === null || isNaN(val)) return 'text-slate-400'
  if (val > -1.0) return 'text-red-700'
  if (val > -1.2) return 'text-amber-700'
  if (val >= -1.6) return 'text-emerald-700'
  return 'text-slate-700'
}

// Genérico: comparar valor contra min/max
const rangoColorClass = (val, min, max) => {
  if (val === null || isNaN(val)) return 'text-slate-400'
  if (min !== null && val < min) return 'text-red-700 font-bold'
  if (max !== null && val > max) return 'text-red-700 font-bold'
  return 'text-slate-800'
}

// Estado global del artículo (prioridad para ordenar: menor = peor)
const estadoPrioridad = (art) => {
  if (art.encUrdAvg !== null && art.encUrdAvg > -1.0) return 0 // CRÍTICO
  const anchoFuera = art.anchoTestAvg !== null && art.anchoMin !== null && art.anchoMax !== null &&
    (art.anchoTestAvg < art.anchoMin || art.anchoTestAvg > art.anchoMax)
  const pesoFuera = art.pesoTestAvg !== null && art.pesoMin !== null && art.pesoMax !== null &&
    (art.pesoTestAvg < art.pesoMin || art.pesoTestAvg > art.pesoMax)
  if (anchoFuera || pesoFuera) return 1 // FUERA DE RANGO
  if (art.encUrdAvg !== null && art.encUrdAvg > -1.2) return 2 // ALERTA
  return 3 // OK
}

const estadoIcon = (art) => {
  const p = estadoPrioridad(art)
  if (p === 0) return '🔴'
  if (p === 1) return '🔴'
  if (p === 2) return '🟡'
  return '🟢'
}

const estadoLabel = (art) => {
  const p = estadoPrioridad(art)
  if (p === 0) return 'Enc.Urd CRÍTICO'
  if (p === 1) return 'FUERA RANGO'
  if (p === 2) return 'Alerta'
  return 'OK'
}

const estadoBadgeClass = (art) => {
  const p = estadoPrioridad(art)
  if (p <= 1) return 'bg-red-100 text-red-800 border-red-300'
  if (p === 2) return 'bg-amber-100 text-amber-800 border-amber-300'
  return 'bg-emerald-100 text-emerald-800 border-emerald-300'
}

onMounted(() => { cargarDatos() })
</script>
