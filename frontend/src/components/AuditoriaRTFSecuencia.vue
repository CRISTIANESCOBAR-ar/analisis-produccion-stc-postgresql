<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main
      ref="mainContentRef"
      class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col relative"
    >
      <!-- Header -->
      <div class="flex flex-col gap-2 flex-shrink-0 mb-3">
        <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-8 lg:h-10 w-auto object-contain" />
            <div>
              <h3 class="text-base lg:text-lg font-semibold text-slate-800">Auditoría RTF — Secuencia Benninger</h3>
              <p class="text-xs text-slate-500">ÍNDIGO · todos los archivos ordenados por contador (NNN) del nombre</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              @click="cargar"
              :disabled="cargando"
              class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
            >
              <svg v-if="cargando" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {{ cargando ? 'Cargando…' : 'Cargar / Actualizar' }}
            </button>
          </div>
        </div>

        <!-- Badges de resumen -->
        <div v-if="rows.length > 0" class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div class="flex flex-wrap gap-1.5 text-xs">
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 font-semibold">
              🗃 {{ rows.length }} archivos RTF
            </span>
            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-100 text-green-800 font-semibold">
              ✓ {{ stats.conPartida }} vinculados
            </span>
            <span v-if="stats.sinPartida > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-semibold">
              ✗ {{ stats.sinPartida }} sin PARTIDA
            </span>
            <span v-if="stats.manual > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-semibold">
              ✏ {{ stats.manual }} manuales
            </span>
            <span v-if="stats.retrocesos > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-semibold">
              ↩ {{ stats.retrocesos }} retroceso{{ stats.retrocesos > 1 ? 's' : '' }}
              <span v-if="stats.graves > 0" class="ml-1 bg-red-600 text-white rounded px-1.5 py-0 text-[10px]">{{ stats.graves }} graves</span>
            </span>
            <span v-if="stats.duplicadas > 0" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 font-semibold">
              = {{ stats.duplicadas }} duplicadas
            </span>
          </div>
          <!-- Toggle solo anomalías -->
          <button
            v-if="stats.retrocesos > 0 || stats.duplicadas > 0"
            @click="soloAnomalias = !soloAnomalias"
            :class="soloAnomalias ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'"
            class="px-3 py-1 rounded-lg text-xs font-semibold transition-colors border border-transparent"
          >
            ⚠ {{ soloAnomalias ? 'Mostrando solo anomalías' : 'Ver solo anomalías' }}
          </button>
          <!-- Botón aplicar sugerencias de alta confianza -->
          <button
            v-if="sugerenciasAltaConf.length > 0"
            @click="aplicarTodasSugerencias"
            :disabled="guardando"
            class="px-3 py-1 rounded-lg text-xs font-semibold transition-colors bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⚡ Aplicar {{ sugerenciasAltaConf.length }} sugerencia{{ sugerenciasAltaConf.length > 1 ? 's' : '' }} de alta confianza
          </button>
          <!-- Info de ordenamiento activo -->
          <div class="text-xs text-slate-400 italic ml-auto">
            Ordenado por: <span class="font-medium text-slate-600">{{ sortLabel }}</span>
            {{ sortDir === 'asc' ? '↑' : '↓' }}
            &nbsp;·&nbsp;Clic en encabezado para reordenar
          </div>
        </div>
      </div>

      <!-- Loading overlay -->
      <div
        v-if="cargando"
        class="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-50 rounded-2xl"
      >
        <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
          <span class="text-xl text-slate-800 font-bold">Consultando…</span>
        </div>
      </div>

      <!-- Error -->
      <div v-if="errorMsg" class="mt-4 p-4 bg-red-50 border border-red-300 rounded-lg text-red-700 text-sm flex-shrink-0">
        {{ errorMsg }}
      </div>

      <!-- Tabla -->
      <div v-if="rows.length > 0" class="flex-1 overflow-auto min-h-0 border border-slate-200 rounded-lg">
        <table class="w-full min-w-[1200px] text-xs text-left font-[Verdana]">
          <thead class="text-xs text-slate-700 bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th
                v-for="col in columnas.filter(c => !c.hidden)"
                :key="col.key"
                @click="setSort(col.key)"
                class="px-2 py-2 font-bold border-b border-slate-200 cursor-pointer select-none whitespace-nowrap hover:bg-slate-100 transition-colors"
                :class="col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'"
              >
                {{ col.label }}
                <span v-if="sortKey === col.key" class="ml-1 text-blue-600">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
                <span v-else class="ml-1 text-slate-300">⇅</span>
              </th>
              <th class="px-2 py-2 border-b border-slate-200 w-8"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, i) in rowsOrdenadas"
              :key="row.source_file"
              :class="rowBgClass(row)"
              class="transition-colors hover:brightness-95"
            >
              <!-- Sec. (NNN) -->
              <td class="px-2 py-1.5 text-center font-mono font-bold" :class="row.seq_num === -1 ? 'text-amber-600' : 'text-slate-700'">
                {{ row.seq_num === -1 ? '∅' : String(row.seq_num).padStart(3, '0') }}
              </td>

              <!-- receita -->
              <td class="px-2 py-1.5 text-slate-700">{{ row.receita || '–' }}</td>

              <!-- comeco_fmt (parseado) -->
              <td class="px-2 py-1.5 font-mono text-center" :class="comeco_fmt_class(row)" :title="row.comeco_raw || ''">
                {{ row.comeco_fmt || '–' }}
              </td>

              <!-- match_partida -->
              <td class="px-2 py-1.5 font-mono font-semibold text-slate-800">
                {{ row.match_partida || '–' }}
              </td>

              <!-- match_rolada -->
              <td class="px-2 py-1.5 font-mono text-slate-700">
                {{ row.match_rolada || '–' }}
              </td>

              <!-- anomalia -->
              <td class="px-2 py-1.5 text-center">
                <span v-if="row._anomalia" :class="anomaliaClass(row)" class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap">
                  <template v-if="row._anomalia === 'grave'">↩ GRAVE <span class="ml-0.5 opacity-90">–{{ row._diff }}</span></template>
                  <template v-else-if="row._anomalia === 'retroceso'">↩ –{{ row._diff }}</template>
                  <template v-else>= dup</template>
                </span>
                <span v-else class="text-slate-300 text-[10px]">✓</span>
              </td>

              <!-- match_mode -->
              <td class="px-2 py-1.5 text-slate-500 text-[11px]">{{ row.match_mode || '–' }}</td>

              <!-- metros_raw -->
              <td class="px-2 py-1.5 text-right font-mono font-semibold text-blue-700">
                {{ row.metros_raw || '–' }}
              </td>

              <!-- acción editar -->
              <td class="px-1 py-1 text-center">
                <div class="flex gap-0.5 justify-center items-center">
                  <button
                    v-if="(row._anomalia === 'grave' || row._anomalia === 'retroceso' || row._anomalia === 'duplicada') && row._sug_conf === 'alta' && row._sug_partida && row._sug_partida !== row.match_partida"
                    @click.stop="aplicarSugerencia(row)"
                    :disabled="guardando"
                    :title="`⚡ Aplicar: ${row._sug_partida} / ${row._sug_rolada || '–'}`"
                    class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-amber-100 text-amber-400 hover:text-amber-700 transition-colors disabled:opacity-40"
                  >⚡</button>
                  <button
                    @click.stop="abrirModal(row)"
                    class="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-blue-100 text-slate-400 hover:text-blue-700 transition-colors"
                    title="Editar vínculo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
          <tfoot class="bg-slate-100 font-bold text-slate-700 sticky bottom-0 shadow-inner">
            <tr>
              <td :colspan="columnas.filter(c => !c.hidden).length + 1" class="px-2 py-2 text-xs">
                {{ rows.length }} archivos · {{ stats.conPartida }} vinculados · {{ stats.sinPartida }} sin partida
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Empty state (antes de cargar) -->
      <div v-else-if="!cargando && !errorMsg && !cargado" class="flex-1 flex flex-col items-center justify-center text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-lg font-medium">Presiona "Cargar / Actualizar" para ver la secuencia</p>
      </div>
      <div v-else-if="!cargando && !errorMsg && cargado && rows.length === 0" class="flex-1 flex flex-col items-center justify-center text-slate-400">
        <p class="text-lg font-medium">No hay registros en la tabla</p>
      </div>
    </main>

    <!-- ── Modal de edición ──────────────────────────────────────────── -->
    <Teleport to="body">
      <div
        v-if="modal.open"
        class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
        @click.self="cerrarModal"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
            <div>
              <h4 class="text-sm font-bold text-slate-800">Editar vínculo RTF</h4>
              <p class="text-xs text-slate-400 mt-0.5 font-mono break-all">{{ modal.row?.source_file }}</p>
            </div>
            <button @click="cerrarModal" class="text-slate-400 hover:text-slate-700 mt-0.5 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <!-- Tabs -->
          <div class="flex border-b border-slate-200">
            <button
              @click="modal.tab = 'vincular'"
              :class="modal.tab === 'vincular' ? 'border-blue-600 text-blue-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'"
              class="flex-1 py-2.5 text-xs border-b-2 transition-colors"
            >🔗 Cambiar vínculo</button>
            <button
              @click="modal.tab = 'no_apta'"
              :class="modal.tab === 'no_apta' ? 'border-red-500 text-red-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'"
              class="flex-1 py-2.5 text-xs border-b-2 transition-colors"
            >🚫 Marcar no apta</button>
          </div>

          <!-- Contenido -->
          <div class="px-5 py-4 space-y-3">

            <!-- Tab: Vincular -->
            <template v-if="modal.tab === 'vincular'">
              <!-- Info box de sugerencia -->
              <div v-if="modal.sugerencia"
                class="p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-col gap-1.5 text-xs">
                <div class="flex items-center gap-1 font-bold text-blue-800">
                  💡 Sugerencia basada en secuencia (NNN)
                  <span
                    :class="modal.sugerencia.conf === 'alta' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'"
                    class="ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold"
                  >Confianza {{ modal.sugerencia.conf }}</span>
                </div>
                <div class="text-blue-700">
                  Vecino anterior válido:
                  <span class="font-mono font-bold">{{ modal.sugerencia.partida }}</span>
                  &nbsp;·&nbsp;
                  <span class="font-mono">{{ modal.sugerencia.rolada || '–' }}</span>
                </div>
                <div class="text-slate-400">
                  Vínculo actual (sospechoso):
                  <span class="font-mono line-through">{{ modal.sugerencia.actualPartida || '–' }}</span>
                  / {{ modal.sugerencia.actualRolada || '–' }}
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Rolada <span class="text-red-500">*</span></label>
                <input v-model="modal.form.rolada" type="text" placeholder="Ej. 5427"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Partida <span class="text-red-500">*</span></label>
                <input v-model="modal.form.partida" type="text" placeholder="Ej. 0542701"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Observación</label>
                <input v-model="modal.form.observacion" type="text" placeholder="Opcional"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <p v-if="modal.error" class="text-xs text-red-600">{{ modal.error }}</p>
            </template>

            <!-- Tab: No apta -->
            <template v-if="modal.tab === 'no_apta'">
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                El RTF se marcará como <strong>no apta</strong>. Quedará excluido del análisis de secuencia y de los pendientes de vinculación, pero no se eliminarán sus datos.
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Motivo <span class="text-red-500">*</span></label>
                <select v-model="modal.form.motivo"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="" disabled>— Seleccionar —</option>
                  <option v-for="opt in NO_APTA_REASON_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-semibold text-slate-700 mb-1">Observación</label>
                <input v-model="modal.form.observacion" type="text" placeholder="Opcional"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <p v-if="modal.error" class="text-xs text-red-600">{{ modal.error }}</p>
            </template>
          </div>

          <!-- Footer -->
          <div class="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">
            <button @click="cerrarModal" class="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">Cancelar</button>
            <button
              @click="guardarEdicion"
              :disabled="guardando"
              :class="modal.tab === 'no_apta' ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300' : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300'"
              class="px-4 py-2 text-sm text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              {{ guardando ? 'Guardando…' : (modal.tab === 'no_apta' ? '🚫 Marcar no apta' : '🔗 Guardar vínculo') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || ''

const rows     = ref([])
const cargando = ref(false)
const cargado  = ref(false)
const errorMsg = ref('')
const guardando = ref(false)

const NO_APTA_REASON_OPTIONS = [
  { value: 'DESPERDICIO',       label: 'Desperdicio / descarte' },
  { value: 'FALLA_MECANICA',    label: 'Falla mecánica del proceso' },
  { value: 'FUERA_PARAMETRO',   label: 'Fuera de parámetro operativo' },
  { value: 'SIN_DESTINO_TELAR', label: 'Sin destino a telar' },
  { value: 'OTRO',              label: 'Otro' },
]

const modal = reactive({
  open: false,
  tab: 'vincular',
  row: null,
  form: { rolada: '', partida: '', motivo: '', observacion: '' },
  error: '',
  sugerencia: null,
})

function abrirModal(row) {
  modal.open  = true
  modal.tab   = 'vincular'
  modal.row   = row
  modal.error = ''
  const esSospechosa = (row._anomalia === 'grave' || row._anomalia === 'retroceso' || row._anomalia === 'duplicada')
                      && row._sug_partida
                      && row._sug_partida !== row.match_partida
  modal.sugerencia = esSospechosa ? {
    partida:        row._sug_partida,
    rolada:         row._sug_rolada,
    conf:           row._sug_conf,
    actualPartida:  row.match_partida,
    actualRolada:   row.match_rolada,
  } : null
  modal.form = {
    rolada:      esSospechosa ? (row._sug_rolada  || '') : (row.match_rolada  || ''),
    partida:     esSospechosa ? (row._sug_partida || '') : (row.match_partida || ''),
    motivo:      '',
    observacion: '',
  }
}

function cerrarModal() {
  modal.open       = false
  modal.row        = null
  modal.sugerencia = null
}

async function aplicarSugerencia(row) {
  if (!row._sug_partida || guardando.value) return
  guardando.value = true
  try {
    const res = await fetch(`${API_URL}/api/benninger-rtf/relink`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{
        sourceFile: row.source_file,
        partida:    row._sug_partida,
        rolada:     row._sug_rolada || null,
        mode:       'manual',
        reason:     `AUTO_SUGERENCIA_NNN: vecino_anterior=${row._sug_partida}`,
      }] }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.savedCount) {
      const idx = rows.value.findIndex(r => r.source_file === row.source_file)
      if (idx !== -1) {
        rows.value[idx] = {
          ...rows.value[idx],
          match_partida:    row._sug_partida,
          match_rolada:     row._sug_rolada || null,
          match_mode:       'manual',
          match_reason:     `AUTO_SUGERENCIA_NNN`,
          match_confidence: 'manual',
          match_score:      100,
        }
      }
    }
  } catch (err) {
    errorMsg.value = `Error aplicando sugerencia: ${err.message}`
  } finally {
    guardando.value = false
  }
}

async function aplicarTodasSugerencias() {
  const candidatas = sugerenciasAltaConf.value
  if (!candidatas.length || guardando.value) return
  guardando.value = true
  try {
    const items = candidatas.map(r => ({
      sourceFile: r.source_file,
      partida:    r._sug_partida,
      rolada:     r._sug_rolada || null,
      mode:       'manual',
      reason:     'AUTO_SUGERENCIA_NNN',
    }))
    const res = await fetch(`${API_URL}/api/benninger-rtf/relink`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (data.savedCount > 0) {
      // Actualizar en memoria todas las enviadas
      for (const item of items) {
        const idx = rows.value.findIndex(r => r.source_file === item.sourceFile)
        if (idx !== -1) {
          rows.value[idx] = {
            ...rows.value[idx],
            match_partida:    item.partida,
            match_rolada:     item.rolada,
            match_mode:       'manual',
            match_reason:     'AUTO_SUGERENCIA_NNN',
            match_confidence: 'manual',
            match_score:      100,
          }
        }
      }
    }
  } catch (err) {
    errorMsg.value = `Error en aplicar todas: ${err.message}`
  } finally {
    guardando.value = false
  }
}

async function guardarEdicion() {
  modal.error = ''
  const row = modal.row
  if (!row) return

  let mode, reason, partida, rolada

  if (modal.tab === 'vincular') {
    const p = modal.form.partida.trim()
    const r = modal.form.rolada.trim()
    if (!p && !r) { modal.error = 'Ingrese al menos Rolada o Partida.'; return }
    mode    = 'manual'
    partida = p || null
    rolada  = r || null
    reason  = modal.form.observacion.trim() ? `USER_MANUAL_RELINK: ${modal.form.observacion.trim()}` : 'USER_MANUAL_RELINK'
  } else {
    if (!modal.form.motivo) { modal.error = 'Seleccione un motivo.'; return }
    mode    = `manual_no_apta`
    partida = modal.form.partida.trim() || null
    rolada  = modal.form.rolada.trim()  || null
    const obs = modal.form.observacion.trim()
    reason  = obs ? `${modal.form.motivo}: ${obs}` : modal.form.motivo
  }

  guardando.value = true
  try {
    const res = await fetch(`${API_URL}/api/benninger-rtf/relink`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: [{ sourceFile: row.source_file, partida, rolada, mode, reason }] }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    if (!data.savedCount) {
      modal.error = (data.errors || [])[0]?.error || 'Error desconocido'
      return
    }
    // Actualizar la fila en memoria sin recargar toda la tabla
    const idx = rows.value.findIndex(r => r.source_file === row.source_file)
    if (idx !== -1) {
      rows.value[idx] = {
        ...rows.value[idx],
        match_partida:    partida,
        match_rolada:     rolada,
        match_mode:       mode,
        match_reason:     reason,
        match_confidence: 'manual',
        match_score:      100,
      }
    }
    cerrarModal()
  } catch (err) {
    modal.error = `Error de conexión: ${err.message}`
  } finally {
    guardando.value = false
  }
}
const sortKey       = ref('seq_num')
const sortDir       = ref('asc')
const soloAnomalias = ref(false)

const columnas = [
  { key: 'seq_num',          label: 'Sec.',        align: 'center' },
  { key: 'source_file',      label: 'Archivo',     align: 'left',   hidden: true  },
  { key: 'receita',          label: 'Receita',     align: 'left'   },
  { key: 'comeco_raw',       label: 'Inicio (raw)',align: 'left',   hidden: true  },
  { key: 'comeco_fmt',       label: 'Inicio (fmt)',align: 'center' },
  { key: 'match_partida',    label: 'Partida',     align: 'left'   },
  { key: 'match_rolada',     label: 'Rolada',      align: 'left'   },
  { key: '_anomalia',        label: 'Anomalía',    align: 'center' },
  { key: 'match_score',      label: 'Score',       align: 'right',  hidden: true  },
  { key: 'match_confidence', label: 'Confianza',   align: 'center', hidden: true  },
  { key: 'match_mode',       label: 'Modo',        align: 'left'   },
  { key: 'match_reason',     label: 'Razón',       align: 'left',   hidden: true  },
  { key: 'metros_raw',       label: 'Metros',      align: 'right'  },
]

const sortLabelMap = {
  seq_num:          'Sec. (NNN)',
  source_file:      'Archivo',
  receita:          'Receita',
  comeco_raw:       'Inicio raw',
  comeco_fmt:       'Inicio parseado',
  match_partida:    'Partida',
  match_rolada:     'Rolada',
  _anomalia:        'Anomalía',
  match_score:      'Score',
  match_confidence: 'Confianza',
  match_mode:       'Modo',
  match_reason:     'Razón',
  metros_raw:       'Metros',
}
const sortLabel = computed(() => sortLabelMap[sortKey.value] || sortKey.value)

// ── Helpers de anomalía ────────────────────────────────────────────────────
function partidaNum(v) {
  if (!v || !String(v).trim()) return null
  const n = parseInt(String(v).replace(/\D/g, ''), 10)
  return isNaN(n) ? null : n
}

// Anota cada fila con _anomalia / _diff / _partida_num,
// SIEMPRE en orden de seq_num (independiente del sort activo)
// Paso 2: calcula _sug_partida/_sug_rolada/_sug_conf para filas sospechosas
const rowsConAnomalia = computed(() => {
  const sorted = [...rows.value].sort((a, b) => a.seq_num - b.seq_num)
  let prevNum = null

  // Paso 1: anotar anomalías
  const result = sorted.map(row => {
    const num = partidaNum(row.match_partida)
    let anomalia = null
    let diff = 0
    const esNoApta = String(row.match_mode || '').includes('no_apta')
    if (!esNoApta && num !== null && prevNum !== null) {
      if (num < prevNum) {
        diff = prevNum - num
        anomalia = diff >= 10 ? 'grave' : 'retroceso'
      } else if (num === prevNum) {
        anomalia = 'duplicada'
      }
    }
    if (!esNoApta && num !== null) prevNum = num
    return { ...row, _anomalia: anomalia, _diff: diff, _partida_num: num,
             _sug_partida: null, _sug_rolada: null, _sug_conf: null }
  })

  // Paso 2: sugerencias para retrocesos, graves Y duplicatas interpolables
  // Una fila es "válida" como referencia si NO es retroceso/grave (duplicadas sí valen)
  const esValida = r => (r._anomalia === null || r._anomalia === 'duplicada')
                      && r.match_partida
                      && !String(r.match_mode || '').includes('no_apta')

  for (let i = 0; i < result.length; i++) {
    const row = result[i]
    const esDup = row._anomalia === 'duplicada'
    if (row._anomalia !== 'grave' && row._anomalia !== 'retroceso' && !esDup) continue

    if (esDup) {
      // Interpolación: buscar la siguiente fila con partida DIFERENTE (saltando no_apta)
      let nextDiff = null
      let idxNextDiff = -1
      for (let j = i + 1; j < result.length; j++) {
        if (String(result[j].match_mode || '').includes('no_apta')) continue
        if (result[j]._partida_num !== null && result[j]._partida_num !== row._partida_num) {
          nextDiff = result[j]; idxNextDiff = j; break
        }
      }
      if (!nextDiff) continue

      // Es aislada si entre i+1 e idxNextDiff solo hay filas no_apta (sin más dups de la misma partida)
      const isIsolated = result.slice(i + 1, idxNextDiff)
        .every(r => String(r.match_mode || '').includes('no_apta'))

      if (isIsolated) {
        const gapAfterBlock = nextDiff._partida_num - row._partida_num
        if (gapAfterBlock === 2) {
          const sugNum = row._partida_num + 1
          const refLen = String(row.match_partida || '').replace(/\D/g, '').length || 7
          row._sug_partida = String(sugNum).padStart(refLen, '0')
          row._sug_rolada  = String(Math.floor(sugNum / 100))
          row._sug_conf    = 'alta'
        } else if (gapAfterBlock > 2) {
          row._sug_conf = 'media'
        }
      }
      continue
    }

    // Retroceso / grave: heredar vecino anterior válido
    let prevValid = null
    for (let j = i - 1; j >= 0; j--) {
      if (esValida(result[j])) { prevValid = result[j]; break }
    }
    let nextValid = null
    for (let j = i + 1; j < result.length; j++) {
      if (esValida(result[j])) { nextValid = result[j]; break }
    }

    if (prevValid) {
      row._sug_partida = prevValid.match_partida
      row._sug_rolada  = prevValid.match_rolada
      const pNum = partidaNum(prevValid.match_partida)
      const nNum = nextValid ? partidaNum(nextValid.match_partida) : null
      // Alta confianza si los dos vecinos apuntan a partidas muy cercanas (rango ≤ 2)
      row._sug_conf = (!nNum || Math.abs(nNum - pNum) <= 2) ? 'alta' : 'media'
    }
  }

  return result
})

const stats = computed(() => {
  const conPartida  = rows.value.filter(r => r.match_partida && String(r.match_partida).trim()).length
  const sinPartida  = rows.value.length - conPartida
  const manual      = rows.value.filter(r => String(r.match_mode || '').includes('manual')).length
  const retrocesos  = rowsConAnomalia.value.filter(r => r._anomalia === 'retroceso' || r._anomalia === 'grave').length
  const graves      = rowsConAnomalia.value.filter(r => r._anomalia === 'grave').length
  const duplicadas  = rowsConAnomalia.value.filter(r => r._anomalia === 'duplicada').length
  return { conPartida, sinPartida, manual, retrocesos, graves, duplicadas }
})

// Filas sospechosas con sugerencia de alta confianza (sin partida correcta aún)
const sugerenciasAltaConf = computed(() =>
  rowsConAnomalia.value.filter(r =>
    (r._anomalia === 'grave' || r._anomalia === 'retroceso' || r._anomalia === 'duplicada') &&
    r._sug_conf === 'alta' &&
    r._sug_partida &&
    r._sug_partida !== r.match_partida
  )
)

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDir.value = 'asc'
  }
}

const rowsOrdenadas = computed(() => {
  const base = soloAnomalias.value
    ? rowsConAnomalia.value.filter(r => r._anomalia)
    : [...rowsConAnomalia.value]
  const data = base
  data.sort((a, b) => {
    let va = a[sortKey.value]
    let vb = b[sortKey.value]

    // Anomalía: ordenar por severidad
    if (sortKey.value === '_anomalia') {
      const order = { grave: 3, retroceso: 2, duplicada: 1 }
      const na = order[va] ?? 0
      const nb = order[vb] ?? 0
      return sortDir.value === 'asc' ? na - nb : nb - na
    }

    // Ordenar numéricamente si corresponde
    if (sortKey.value === 'seq_num' || sortKey.value === 'match_score' || sortKey.value === 'metros_raw') {
      // metros_raw viene como "2500 m" → extraer número
      const parse = (v) => {
        if (v == null) return -Infinity
        const n = parseFloat(String(v).replace(/[^\d.]/g, ''))
        return isNaN(n) ? -Infinity : n
      }
      if (sortKey.value === 'metros_raw') {
        return sortDir.value === 'asc' ? parse(va) - parse(vb) : parse(vb) - parse(va)
      }
    }
    if (sortKey.value === 'seq_num' || sortKey.value === 'match_score') {
      va = va == null ? -Infinity : Number(va)
      vb = vb == null ? -Infinity : Number(vb)
      return sortDir.value === 'asc' ? va - vb : vb - va
    }

    // match_partida: puede ser texto tipo "P-12345" → extraer número
    if (sortKey.value === 'match_partida') {
      const na = va ? parseInt(String(va).replace(/\D/g, ''), 10) : -1
      const nb = vb ? parseInt(String(vb).replace(/\D/g, ''), 10) : -1
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir.value === 'asc' ? na - nb : nb - na
      }
    }

    // match_rolada: numérico si aplica
    if (sortKey.value === 'match_rolada') {
      const na = va ? parseInt(String(va).replace(/\D/g, ''), 10) : -1
      const nb = vb ? parseInt(String(vb).replace(/\D/g, ''), 10) : -1
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir.value === 'asc' ? na - nb : nb - na
      }
    }

    // Texto
    const sa = String(va ?? '').toLowerCase()
    const sb = String(vb ?? '').toLowerCase()
    if (sa < sb) return sortDir.value === 'asc' ? -1 : 1
    if (sa > sb) return sortDir.value === 'asc' ? 1 : -1
    return 0
  })
  return data
})

async function cargar() {
  cargando.value = true
  errorMsg.value = ''
  try {
    const res = await fetch(`${API_URL}/api/benninger-rtf/audit`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    rows.value  = data.rows || []
    cargado.value = true
  } catch (err) {
    errorMsg.value = `Error al cargar datos: ${err.message}`
  } finally {
    cargando.value = false
  }
}

// ── Estilos ──────────────────────────────────────────────────────────────────

function rowBgClass(row) {
  if (!row.match_partida || !String(row.match_partida).trim()) return 'bg-red-50'
  if (row._anomalia === 'grave')     return 'bg-red-100'
  if (row._anomalia === 'retroceso') return 'bg-orange-50'
  if (row._anomalia === 'duplicada') return 'bg-yellow-50'
  if (String(row.match_mode || '').includes('manual')) return 'bg-purple-50'
  const conf = String(row.match_confidence || '').toLowerCase()
  if (conf === 'high')   return 'bg-green-50'
  if (conf === 'medium') return 'bg-yellow-50'
  if (conf === 'low')    return 'bg-orange-50'
  return ''
}

function anomaliaClass(row) {
  if (row._anomalia === 'grave')     return 'bg-red-600 text-white'
  if (row._anomalia === 'retroceso') return 'bg-orange-200 text-orange-900'
  if (row._anomalia === 'duplicada') return 'bg-yellow-200 text-yellow-900'
  return ''
}

function comeco_fmt_class(row) {
  // Sin fecha parseada → neutral
  if (!row.comeco_fmt) return 'text-slate-400'
  return 'text-slate-700'
}

function scoreClass(score) {
  const s = Number(score)
  if (s >= 80) return 'text-green-700 font-semibold'
  if (s >= 50) return 'text-yellow-700 font-semibold'
  return 'text-red-700 font-semibold'
}

function confidenceClass(conf) {
  const c = String(conf || '').toLowerCase()
  if (c === 'high')   return 'bg-green-100 text-green-800'
  if (c === 'medium') return 'bg-yellow-100 text-yellow-800'
  if (c === 'low')    return 'bg-orange-100 text-orange-800'
  if (c === 'manual') return 'bg-purple-100 text-purple-800'
  return 'bg-slate-100 text-slate-600'
}

onMounted(() => {
  cargar()
})

</script>
