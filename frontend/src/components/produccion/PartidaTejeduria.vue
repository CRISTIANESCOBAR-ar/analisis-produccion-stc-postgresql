<template>
  <div class="w-full h-screen flex flex-col p-1" ref="containerRef">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col overflow-y-auto">

      <!-- ── Barra superior ──────────────────────────────────────────────── -->
      <div class="flex items-center gap-4 mb-3 flex-wrap">
        <img src="/LogoSantana.jpg" alt="Logo" class="h-8 w-auto object-contain shrink-0" />
        <span class="text-base font-semibold text-slate-700 shrink-0">Partida en Producción – TEJEDURÍA</span>

        <!-- Buscador de partida -->
        <div class="flex items-center gap-2 ml-auto">
          <label class="text-sm font-medium text-slate-600">Partida:</label>
          <input
            v-model="inputPartida"
            type="text"
            placeholder="ej. 1-5352.16 ó 1535216"
            class="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-blue-400"
            @keyup.enter="buscar"
          />
          <button
            @click="buscar"
            :disabled="cargando || !inputPartida.trim()"
            class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span v-if="cargando">⏳ Buscando…</span>
            <span v-else>🔍 Buscar</span>
          </button>
          <button
            v-if="datos"
            @click="imprimir"
            class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors border border-slate-300"
            title="Imprimir / Exportar"
          >🖨️</button>
        </div>
      </div>

      <!-- ── Error ───────────────────────────────────────────────────────── -->
      <div v-if="error" class="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        ⚠️ {{ error }}
      </div>

      <!-- ── No encontrada ───────────────────────────────────────────────── -->
      <div v-if="datos && !datos.encontrada" class="mb-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm text-center">
        No se encontraron registros de TEJEDURÍA para la partida <strong>{{ inputPartidaBuscada }}</strong>.
      </div>

      <!-- ════════════════════════════════════════════════════════════════════
           REPORTE
      ═══════════════════════════════════════════════════════════════════════ -->
      <div v-if="datos && datos.encontrada" ref="reporteRef" class="flex flex-col gap-0">

        <!-- ── Cabecera tipo formulario ───────────────────────────────────── -->
        <div class="border border-slate-400 rounded-t-lg overflow-hidden print:rounded-none">

          <!-- Título -->
          <div class="grid grid-cols-[auto_1fr_auto_auto] items-stretch bg-white border-b border-slate-300">
            <div class="px-3 py-2 border-r border-slate-300 flex items-center">
              <img src="/LogoSantana.jpg" alt="Logo" class="h-9 w-auto object-contain" />
            </div>
            <div class="px-4 py-2 flex items-center justify-center font-semibold text-sm text-slate-700 border-r border-slate-300">
              SANTANA TEXTIL CHACO S.A. – UNIDAD V &nbsp;·&nbsp; "EFICIENCIA Y PARADAS"
            </div>
            <div class="px-3 py-2 text-xs font-medium text-slate-500 border-r border-slate-300 flex items-center">Sector</div>
            <div class="px-3 py-2 text-xs font-medium text-slate-500 flex items-center">Partida</div>
          </div>

          <!-- Sector / Partida -->
          <div class="grid grid-cols-[auto_1fr_auto_auto] items-stretch border-b border-slate-300">
            <div class="col-span-2 px-4 py-1.5 bg-white border-r border-slate-300 text-sm text-slate-500 italic flex items-center">&nbsp;</div>
            <div class="px-4 py-1.5 font-bold text-sm bg-slate-800 text-white border-r border-slate-300 uppercase tracking-wide flex items-center">TEJEDURÍA</div>
            <div class="px-4 py-1.5 font-bold text-sm text-blue-700 flex items-center">{{ inputPartidaBuscada }}</div>
          </div>

          <!-- Artículo / Nombre / Telar -->
          <div class="grid grid-cols-[80px_1fr_80px_1fr_60px_50px] items-center border-b border-slate-300 bg-slate-50">
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Artículo:</div>
            <div class="px-2 py-1 text-sm font-bold text-slate-800 border-r border-slate-200">{{ enc.articulo }}</div>
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Nombre:</div>
            <div class="px-2 py-1 text-sm font-bold text-slate-800 border-r border-slate-200">{{ enc.nombre }}</div>
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Telar:</div>
            <div class="px-2 py-1 text-sm font-bold text-blue-700">{{ enc.telar }}</div>
          </div>

          <!-- Trama / Pasadas / Grupo -->
          <div class="grid grid-cols-[80px_1fr_80px_50px_60px_50px] items-center border-b border-slate-300 bg-white">
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Trama:</div>
            <div class="px-2 py-1 text-sm font-medium text-slate-800 border-r border-slate-200">{{ enc.trama }}</div>
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Pasadas:</div>
            <div class="px-2 py-1 text-sm font-bold text-slate-800 border-r border-slate-200">{{ enc.pasadas ?? '–' }}</div>
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Grupo:</div>
            <div class="px-2 py-1 text-sm font-bold text-slate-800">{{ enc.grupo }}</div>
          </div>

          <!-- Base / Roturas URDIDORA / Roturas INDIGO -->
          <div class="grid grid-cols-[80px_1fr_140px_80px_140px_80px] items-center border-b border-slate-300 bg-slate-50">
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Base:</div>
            <div class="px-2 py-1 text-sm font-medium text-slate-800 border-r border-slate-200">{{ enc.base }}</div>
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Roturas URDIDORA 106:</div>
            <div class="px-2 py-1 text-sm font-bold" :class="colorRotUrd">
              {{ enc.rot_urd_106 != null ? enc.rot_urd_106.toFixed(2).replace('.', ',') : '–' }}
            </div>
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200 border-l border-slate-200">Roturas INDIGO 103:</div>
            <div class="px-2 py-1 text-sm font-bold" :class="colorRotInd">
              {{ enc.rot_ind_103 != null ? enc.rot_ind_103.toFixed(2).replace('.', ',') : '–' }}
            </div>
          </div>

          <!-- OE's / Lote -->
          <div class="grid grid-cols-[80px_1fr_60px_1fr] items-center bg-white">
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">OE's:</div>
            <div class="px-2 py-1 text-sm font-bold text-slate-800 border-r border-slate-200">{{ enc.oes || '–' }}</div>
            <div class="px-2 py-1 text-xs font-semibold text-slate-500 border-r border-slate-200">Lote:</div>
            <div class="px-2 py-1 text-sm font-bold text-slate-800">{{ enc.lote || '–' }}</div>
          </div>
        </div>

        <!-- ── Tabla de datos ──────────────────────────────────────────────── -->
        <div class="overflow-x-auto border border-t-0 border-slate-400 rounded-b-lg">
          <table class="w-full text-xs border-collapse">
            <thead>
              <tr class="bg-slate-700 text-white">
                <th class="px-2 py-2 text-center border-r border-slate-600 font-semibold whitespace-nowrap">Fecha</th>
                <th class="px-2 py-2 text-center border-r border-slate-600 font-semibold">Tur</th>
                <th class="px-2 py-2 text-center border-r border-slate-600 font-semibold">Partida</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Metros<br>Crudos</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Metros<br>Termin.</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Metros Term.<br>Acumul.</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Paradas<br>Trama</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Paradas<br>Urdimbre</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Total<br>Paradas</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Eficiencia<br>%</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Roturas<br>TRAMA 105</th>
                <th class="px-2 py-2 text-right border-r border-slate-600 font-semibold whitespace-nowrap">Roturas<br>URDIDO 105</th>
                <th class="px-2 py-2 text-right font-semibold">RPM</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in datos.registros"
                :key="i"
                :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'"
                class="hover:bg-blue-50 transition-colors"
              >
                <td class="px-2 py-1 text-center border-r border-slate-200 whitespace-nowrap">{{ formatFecha(r.fecha) }}</td>
                <td class="px-2 py-1 text-center border-r border-slate-200 font-semibold">{{ r.turno }}</td>
                <td class="px-2 py-1 text-center border-r border-slate-200 whitespace-nowrap">{{ r.partida }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ fmtNum(r.metros_crudos, 0) }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ fmtNum(r.metros_term, 0) }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200 font-medium text-blue-700">{{ fmtNum(r.metros_term_acum, 0) }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ r.paradas_trama }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200">{{ r.paradas_urdimbre }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200 font-semibold">{{ r.total_paradas }}</td>
                <td class="px-2 py-1 text-right border-r border-slate-200" :class="colorEfi(r.eficiencia)">
                  {{ r.eficiencia != null ? r.eficiencia.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1 text-right border-r border-slate-200" :class="colorRt(r.rt_105)">
                  {{ r.rt_105 != null ? r.rt_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1 text-right border-r border-slate-200" :class="colorRt(r.ru_105)">
                  {{ r.ru_105 != null ? r.ru_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1 text-right">{{ r.rpm != null ? r.rpm : '–' }}</td>
              </tr>
            </tbody>
            <!-- Fila de totales -->
            <tfoot>
              <tr class="bg-slate-800 text-white font-bold">
                <td colspan="3" class="px-2 py-1.5 text-center border-r border-slate-600 text-xs">TOTAL / PROMEDIO</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">{{ fmtNum(tot.metros_crudos, 0) }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">{{ fmtNum(tot.metros_term, 0) }}</td>
                <td class="px-2 py-1.5 border-r border-slate-600"></td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">{{ tot.paradas_trama }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">{{ tot.paradas_urdimbre }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">{{ tot.total_paradas }}</td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">
                  {{ tot.eficiencia != null ? tot.eficiencia.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">
                  {{ tot.rt_105 != null ? tot.rt_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1.5 text-right border-r border-slate-600">
                  {{ tot.ru_105 != null ? tot.ru_105.toFixed(1) : '–' }}
                </td>
                <td class="px-2 py-1.5 text-right">{{ tot.rpm != null ? tot.rpm : '–' }}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- ── Barra de info inferior ─────────────────────────────────────── -->
        <div class="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
          <span>{{ datos.registros.length }} registros (turnos)</span>
          <span v-if="enc.roladas?.length">
            Rolada(s): <strong class="text-slate-700">{{ enc.roladas.join(', ') }}</strong>
          </span>
        </div>

        <!-- ── Historial de máquinas ────────────────────────────────────────── -->
        <div v-if="hist.length" class="mt-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-bold uppercase tracking-wide text-slate-600">Recorrido por Máquinas</span>
            <span class="text-[10px] bg-slate-200 text-slate-600 rounded-full px-2 py-0.5 font-semibold">{{ hist.length }}</span>
          </div>
          <div class="overflow-x-auto border border-slate-300 rounded-lg">
            <table class="w-full text-xs border-collapse">
              <thead>
                <tr class="bg-slate-600 text-white">
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">#</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">Máquina</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">Partida</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">Sector</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">Fecha<br>Inicial</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">Hora<br>Ini</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">Fecha<br>Final</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold whitespace-nowrap">Hora<br>Fin</th>
                  <th class="px-2 py-2 text-right border-r border-slate-500 font-semibold whitespace-nowrap">Metros</th>
                  <th class="px-2 py-2 text-left border-r border-slate-500 font-semibold whitespace-nowrap">Artículo</th>
                  <th class="px-2 py-2 text-center border-r border-slate-500 font-semibold">Color</th>
                  <th class="px-2 py-2 text-left font-semibold">Nombre</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(h, i) in hist"
                  :key="i"
                  :class="i % 2 === 0 ? 'bg-white' : 'bg-slate-50'"
                  class="hover:bg-blue-50 transition-colors"
                >
                  <td class="px-2 py-1 text-center border-r border-slate-200 text-slate-400 font-semibold">{{ i + 1 }}</td>
                  <td class="px-2 py-1 text-center border-r border-slate-200 font-bold text-blue-700">{{ h.maquina }}</td>
                  <td class="px-2 py-1 text-center border-r border-slate-200 font-mono font-semibold text-slate-700">{{ h.partida_display || '–' }}</td>
                  <td class="px-2 py-1 text-center border-r border-slate-200">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                      :class="{
                        'bg-blue-100 text-blue-700':   h.seletor === 'TECELAGEM',
                        'bg-amber-100 text-amber-700':  h.seletor === 'URDIDEIRA' || h.seletor === 'URDIDORA',
                        'bg-indigo-100 text-indigo-700': h.seletor === 'INDIGO',
                        'bg-slate-100 text-slate-600':  !['TECELAGEM','URDIDEIRA','URDIDORA','INDIGO'].includes(h.seletor)
                      }">{{ h.seletor }}</span>
                  </td>
                  <td class="px-2 py-1 text-center border-r border-slate-200 whitespace-nowrap">{{ formatFecha(h.dt_inicio) }}</td>
                  <td class="px-2 py-1 text-center border-r border-slate-200 font-mono">{{ fmtHora(h.hora_inicio) }}</td>
                  <td class="px-2 py-1 text-center border-r border-slate-200 whitespace-nowrap">{{ formatFecha(h.dt_final) }}</td>
                  <td class="px-2 py-1 text-center border-r border-slate-200 font-mono">{{ fmtHora(h.hora_final) }}</td>
                  <td class="px-2 py-1 text-right border-r border-slate-200 font-semibold">{{ fmtNum(h.metros, 0) }}</td>
                  <td class="px-2 py-1 border-r border-slate-200">{{ h.artigo || '–' }}</td>
                  <td class="px-2 py-1 text-center border-r border-slate-200">{{ h.cor || '–' }}</td>
                  <td class="px-2 py-1">{{ h.nm_mercado || '–' }}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr class="bg-slate-700 text-white font-bold">
                  <td colspan="8" class="px-2 py-1.5 text-center border-r border-slate-600 text-xs">TOTAL</td>
                  <td class="px-2 py-1.5 text-right border-r border-slate-600">
                    {{ fmtNum(hist.reduce((s, h) => s + (h.metros || 0), 0), 0) }}
                  </td>
                  <td colspan="3" class="px-2 py-1.5"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- ── Estado inicial ─────────────────────────────────────────────── -->
      <div v-if="!datos && !cargando && !error" class="flex-1 flex flex-col items-center justify-center text-slate-400 gap-3">
        <span class="text-5xl">🏭</span>
        <p class="text-sm">Ingrese un número de partida y presione <strong>Buscar</strong></p>
        <p class="text-xs text-slate-300">Ejemplo: 1-5352.16</p>
      </div>

    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const inputPartida       = ref('')
const inputPartidaBuscada = ref('')
const cargando           = ref(false)
const error              = ref(null)
const datos              = ref(null)

const enc = computed(() => datos.value?.encabezado || {})
const tot = computed(() => datos.value?.totales || {})
const hist = computed(() => datos.value?.historial || [])

// Convierte "1-5352.16" → "1535216" (elimina máscara)
function normalizarPartida(raw) {
  return raw.replace(/[^a-zA-Z0-9]/g, '')
}

// ── Buscar ──────────────────────────────────────────────────────────────────
async function buscar() {
  const raw = inputPartida.value.trim()
  if (!raw) return
  const p = normalizarPartida(raw)
  cargando.value = true
  error.value = null
  datos.value = null
  inputPartidaBuscada.value = raw   // mostrar con máscara en UI
  try {
    const res = await fetch(`${API}/api/produccion/partida-tejeduria?partida=${encodeURIComponent(p)}`)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j.error || `HTTP ${res.status}`)
    }
    datos.value = await res.json()
  } catch (e) {
    error.value = e.message
  } finally {
    cargando.value = false
  }
}

// ── Formateo ────────────────────────────────────────────────────────────────
function formatFecha(f) {
  if (!f) return '–'
  const d = new Date(f)
  if (isNaN(d)) return String(f).substring(0, 10)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtNum(v, dec = 1) {
  if (v == null) return '–'
  const n = parseFloat(v)
  if (isNaN(n)) return '–'
  return n.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

// "13.20" → "13:20" ; "18:40:00" → "18:40"
function fmtHora(h) {
  if (!h) return '–'
  const s = String(h).trim()
  // Si el DB ya devuelve formato TIME "HH:MM:SS" o "HH:MM"
  if (s.includes(':')) return s.substring(0, 5)
  // Formato europeo "13.20" → "13:20"
  const parts = s.split('.')
  const hh = parts[0].padStart(2, '0')
  const mm = (parts[1] || '00').padEnd(2, '0').substring(0, 2)
  return `${hh}:${mm}`
}

// ── Colores condicionales ────────────────────────────────────────────────────
function colorEfi(v) {
  if (v == null) return ''
  if (v >= 90) return 'text-green-700 font-semibold'
  if (v >= 80) return 'text-amber-600 font-semibold'
  return 'text-red-600 font-semibold'
}

function colorRt(v) {
  if (v == null) return ''
  if (v <= 2)  return 'text-green-700'
  if (v <= 4)  return 'text-amber-600'
  return 'text-red-600 font-semibold'
}

const colorRotUrd = computed(() => {
  const v = enc.value.rot_urd_106
  if (v == null) return 'text-slate-800'
  if (v <= 1) return 'text-green-700 font-bold'
  if (v <= 2) return 'text-amber-600 font-bold'
  return 'text-red-600 font-bold'
})

const colorRotInd = computed(() => {
  const v = enc.value.rot_ind_103
  if (v == null) return 'text-slate-800'
  if (v <= 1) return 'text-green-700 font-bold'
  if (v <= 2) return 'text-amber-600 font-bold'
  return 'text-red-600 font-bold'
})

// ── Imprimir ─────────────────────────────────────────────────────────────────
function imprimir() {
  window.print()
}
</script>
