<template>
  <div class="md:hidden p-4">
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 text-sm">
      Esta pantalla de conciliacion RTF esta disponible solo en escritorio.
    </div>
  </div>

  <div class="hidden md:flex w-full h-screen flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col overflow-hidden">
      <div class="shrink-0 mb-3 flex items-center gap-3">
        <label class="text-sm font-semibold text-slate-700 shrink-0">Carpeta de archivos RTF:</label>

        <div class="flex-1 min-w-0">
          <div
            class="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-800 truncate shadow-sm"
            :title="folderPathDisplay"
          >
            {{ folderPathDisplay || selectedFolderName || 'Ninguna carpeta seleccionada' }}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            @click="selectFolder"
            class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm"
          >
            Seleccionar
          </button>

          <button
            v-if="hasPersistedHandle"
            @click="refreshFolder"
            class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm"
          >
            Actualizar
          </button>

          <input ref="folderInput" type="file" webkitdirectory directory multiple class="hidden" @change="onFolderInputChange" />
        </div>
      </div>

      <div class="shrink-0 mb-3 flex flex-wrap items-center gap-2">
        <button
          @click="runAutomaticMatch"
          :disabled="isMatching || !pendingRows.length"
          class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
        >
          {{ isMatching ? 'Matcheando...' : 'Matcheo automatico' }}
        </button>

        <button
          @click="applyAutoHighConfidence"
          :disabled="isSaving || !highConfidenceRows.length"
          class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          {{ isSaving ? 'Guardando...' : 'Aplicar automaticos (alta confianza)' }}
        </button>

        <label class="flex items-center gap-2 text-xs text-slate-700 ml-2">
          <input type="checkbox" v-model="showOnlyPending" class="rounded" />
          Mostrar solo no guardados
        </label>

        <div class="text-xs text-slate-600 ml-auto">
          {{ summaryText }}
        </div>
      </div>

      <!-- Panel: Archivos sin match en BD -->
      <div class="shrink-0 mb-2 border border-amber-200 rounded-lg bg-amber-50 overflow-hidden">
        <button
          @click="toggleSinMatch"
          class="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
        >
          <span class="flex items-center gap-2">
            <span>⚠️</span>
            Archivos sin match en BD
            <span
              v-if="sinMatchTotal !== null"
              class="px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold"
            >{{ sinMatchTotal }}</span>
            <span v-if="sinMatchLoading" class="text-amber-600 font-normal">cargando...</span>
          </span>
          <svg
            class="w-3.5 h-3.5 transition-transform duration-200"
            :class="{ 'rotate-180': sinMatchOpen }"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div v-if="sinMatchOpen" class="border-t border-amber-200">
          <div v-if="sinMatchRows.length === 0 && !sinMatchLoading" class="px-3 py-3 text-xs text-amber-700">
            No hay archivos sin match.
          </div>
          <div v-else class="overflow-auto max-h-52">
            <table class="min-w-full text-xs">
              <thead class="bg-amber-100 sticky top-0">
                <tr>
                  <th class="px-2 py-1.5 text-left font-semibold text-amber-900">Archivo</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-amber-900">Rolada</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-amber-900">Receita</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-amber-900">Comeco</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-amber-900">Fim</th>
                  <th class="px-2 py-1.5 text-left font-semibold text-amber-900">Razón</th>
                  <th class="px-2 py-1.5 text-center font-semibold text-amber-900">Acción</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sinMatchRows"
                  :key="row.source_file"
                  :class="sinMatchLinked.has(row.source_file) ? 'bg-green-50 line-through opacity-60' : 'bg-white hover:bg-amber-50'"
                  class="border-b border-amber-100 transition-colors"
                >
                  <td class="px-2 py-1.5 font-medium text-slate-800 max-w-[200px] truncate" :title="row.source_file">
                    {{ row.source_file.split(/[\\/]/).pop() }}
                  </td>
                  <td class="px-2 py-1.5 font-mono text-slate-700">{{ row.match_rolada || '–' }}</td>
                  <td class="px-2 py-1.5 text-slate-600">{{ row.receita || '–' }}</td>
                  <td class="px-2 py-1.5 font-mono text-slate-600" :title="row.comeco_raw || ''">{{ row.comeco_fmt || '–' }}</td>
                  <td class="px-2 py-1.5 font-mono text-slate-600" :title="row.fim_raw || ''">{{ row.fim_fmt || '–' }}</td>
                  <td class="px-2 py-1.5 text-slate-500 max-w-[180px] truncate" :title="row.match_reason || ''">
                    {{ row.match_reason || '–' }}
                  </td>
                  <td class="px-2 py-1.5 text-center">
                    <button
                      v-if="!sinMatchLinked.has(row.source_file)"
                      @click="abrirRelinkModal(row)"
                      class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                      title="Vincular manualmente a una partida/rolada"
                    >
                      🔗 Vincular
                    </button>
                    <span v-else class="text-green-700 font-semibold text-[11px]">✓ Vinculado</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="sinMatchTotal > sinMatchRows.length" class="px-3 py-1.5 text-[11px] text-amber-700 border-t border-amber-200">
            Mostrando {{ sinMatchRows.length }} de {{ sinMatchTotal }}. Exporta desde la sección Verificación Partidas Rolada para ver todos.
          </div>
        </div>
      </div>

      <div class="shrink-0 mb-2 text-sm text-slate-600 min-h-[20px]">
        {{ scanStatus }}
      </div>

      <div class="grid grid-cols-[560px_1fr] gap-3 flex-1 min-h-0">
        <div class="rounded-xl border border-slate-200 overflow-hidden bg-white min-h-0 flex flex-col">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-100 border-b border-slate-200">
              <tr>
                <th class="px-2 py-2 text-left">Archivo</th>
                <th class="px-2 py-2 text-left">Comeco</th>
                <th class="px-2 py-2 text-left">Partida sugerida</th>
                <th class="px-2 py-2 text-left">Conf.</th>
                <th class="px-2 py-2 text-left">Estado</th>
              </tr>
            </thead>
          </table>

          <div class="overflow-auto flex-1 min-h-0">
            <table class="min-w-full text-xs">
              <tbody>
                <tr
                  v-for="row in displayRows"
                  :key="row.sourceFile"
                  class="border-b border-slate-100 cursor-pointer hover:bg-slate-50"
                  :class="selectedSourceFile === row.sourceFile ? 'bg-blue-50' : ''"
                  @click="selectedSourceFile = row.sourceFile"
                >
                  <td class="px-2 py-2 align-top w-[190px]">
                    <div class="font-medium text-slate-800 truncate" :title="row.fileName">{{ row.fileName }}</div>
                    <div class="text-[11px] text-slate-500 truncate" :title="row.header.idRolo">{{ row.header.idRolo || 'sin #ID Rolo' }}</div>
                  </td>
                  <td class="px-2 py-2 align-top w-[120px]">{{ row.header.comeco || 'sin dato' }}</td>
                  <td class="px-2 py-2 align-top w-[120px]">
                    <div v-if="row.suggested" class="font-semibold text-slate-700">{{ row.suggested.partida || 'sin partida' }}</div>
                    <div v-else class="text-slate-400">-</div>
                  </td>
                  <td class="px-2 py-2 align-top w-[70px]">
                    <span
                      class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      :class="confidenceClass(row.confidence)"
                    >
                      {{ row.confidence || 'none' }}
                    </span>
                  </td>
                  <td class="px-2 py-2 align-top">
                    <span
                      class="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                      :class="row.saved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'"
                    >
                      {{ row.saved ? 'Guardado' : 'Pendiente' }}
                    </span>
                  </td>
                </tr>
                <tr v-if="!displayRows.length">
                  <td colspan="5" class="px-3 py-8 text-center text-slate-500">No hay archivos para mostrar.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-3 flex flex-col min-h-0">
          <template v-if="selectedRow">
            <div class="text-sm font-semibold text-slate-800 mb-2">Detalle del RTF</div>

            <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
              <div>
                <span class="text-slate-500">Archivo:</span>
                <button
                  v-if="selectedRow.rawRtfText"
                  @click="openFileInApp(selectedRow)"
                  class="ml-1 text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  :title="'Abrir ' + selectedRow.fileName"
                >{{ selectedRow.fileName }}</button>
                <span v-else class="ml-1">{{ selectedRow.fileName }}</span>
              </div>
              <div><span class="text-slate-500">#ID Rolo:</span> {{ selectedRow.header.idRolo || '-' }}</div>
              <div><span class="text-slate-500">Indicativo:</span> {{ selectedRow.header.indicativo || '-' }}</div>
              <div><span class="text-slate-500">Receita:</span> {{ selectedRow.header.receita || '-' }}</div>
              <div><span class="text-slate-500">Comeco:</span> {{ selectedRow.header.comeco || '-' }}</div>
              <div><span class="text-slate-500">Fim:</span> {{ selectedRow.header.fim || '-' }}</div>
              <div><span class="text-slate-500">Duracao:</span> {{ selectedRow.header.duracao || '-' }}</div>
              <div><span class="text-slate-500">Metros:</span> {{ selectedRow.header.metros || '-' }}</div>
              <div><span class="text-slate-500">Vel. m/min:</span> {{ selectedRow.header.velMMin || '-' }}</div>
              <div><span class="text-slate-500">Score Gap:</span> {{ selectedRow.scoreGap || 0 }}</div>
            </div>

            <div class="text-sm font-semibold text-slate-800 mb-1">Candidatos tb_produccion (INDIGO)</div>

            <div class="overflow-auto border border-slate-200 rounded-lg flex-1 min-h-0">
              <table class="min-w-full text-xs">
                <thead class="bg-slate-100">
                  <tr>
                    <th class="px-2 py-1">Sel.</th>
                    <th class="px-2 py-1 text-left">Partida</th>
                    <th class="px-2 py-1 text-left">Rolada</th>
                    <th class="px-2 py-1 text-left">DT/Hora Inicio</th>
                    <th class="px-2 py-1 text-left">Metragem</th>
                    <th class="px-2 py-1 text-left">Velocidade</th>
                    <th class="px-2 py-1 text-left">Base</th>
                    <th class="px-2 py-1 text-left">Diff Inicio</th>
                    <th class="px-2 py-1 text-left">Score</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(cand, idx) in selectedRow.candidates"
                    :key="`${selectedRow.sourceFile}-${idx}`"
                    class="border-t border-slate-100"
                  >
                    <td class="px-2 py-1">
                      <input
                        type="radio"
                        :name="`cand-${selectedRow.sourceFile}`"
                        :checked="isCandidateSelected(selectedRow, cand)"
                        @change="selectCandidate(selectedRow.sourceFile, cand)"
                      />
                    </td>
                    <td class="px-2 py-1">{{ cand.partida || '-' }}</td>
                    <td class="px-2 py-1">{{ cand.rolada || '-' }}</td>
                    <td class="px-2 py-1">{{ cand.dtInicio || '-' }} {{ cand.horaInicio || '' }}</td>
                    <td class="px-2 py-1">{{ formatMetric(cand.metragemPartida, 'm', 0) }}</td>
                    <td class="px-2 py-1">{{ formatMetric(cand.velocidadeMediaPartida, 'm/min', 1) }}</td>
                    <td class="px-2 py-1">{{ cand.baseUrdume || '-' }}</td>
                    <td class="px-2 py-1">{{ formatSeconds(cand.startDiffSec) }}</td>
                    <td class="px-2 py-1 font-semibold">{{ cand.score }}</td>
                  </tr>
                  <tr v-if="!selectedRow.candidates.length">
                    <td colspan="9" class="px-3 py-4 text-slate-500 text-center">Sin candidatos. Revisa fecha/hora o CSV de produccion.</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="mt-3 flex items-center gap-2">
              <button
                @click="confirmSelectedRow"
                :disabled="isSaving || !selectedRow.selectedCandidate || selectedRow.saved"
                class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
              >
                Confirmar vinculo
              </button>

              <button
                @click="registerNoAptaRow"
                :disabled="isSaving || selectedRow.saved"
                class="inline-flex items-center px-3 py-1.5 rounded-md text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                Registrar no apta
              </button>

              <span v-if="selectedRow.saved" class="text-xs text-emerald-700 font-semibold">Este archivo ya esta vinculado.</span>
              <span v-else class="text-xs text-slate-500">Usa este boton para resolver casos dudosos manualmente.</span>
            </div>
          </template>

          <template v-else>
            <div class="h-full flex items-center justify-center text-sm text-slate-500">
              Selecciona un archivo RTF para revisar el match.
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import Swal from 'sweetalert2'

const folderInput = ref(null)
const selectedFolderName = ref('')
const folderPathDisplay = ref('')
const hasPersistedHandle = ref(false)
const scanStatus = ref('')

const rtfRows = ref([])
const showOnlyPending = ref(true)
const selectedSourceFile = ref('')

// Sin-match panel
const sinMatchOpen    = ref(false)
const sinMatchLoading = ref(false)
const sinMatchRows    = ref([])
const sinMatchTotal   = ref(null)
const sinMatchLinked  = ref(new Set()) // source_files vinculados en esta sesión

async function toggleSinMatch() {
  sinMatchOpen.value = !sinMatchOpen.value
  if (sinMatchOpen.value && sinMatchRows.value.length === 0) {
    await loadSinMatch()
  }
}

async function loadSinMatch() {
  sinMatchLoading.value = true
  try {
    const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
    const API_URL  = API_BASE ? `${API_BASE}/api` : '/api'
    const res  = await fetch(`${API_URL}/benninger-rtf/sin-match?limit=500`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    sinMatchRows.value  = data.rows  || []
    sinMatchTotal.value = data.total ?? sinMatchRows.value.length
  } catch (e) {
    console.error('Error cargando sin-match:', e)
  } finally {
    sinMatchLoading.value = false
  }
}

async function abrirRelinkModal(row) {
  const fileName = row.source_file.split(/[\\/]/).pop()
  const rolada   = row.match_rolada || ''

  const { value: formValues, isConfirmed } = await Swal.fire({
    title: 'Vincular manualmente',
    html: `
      <div style="font-size:12px;color:#475569;margin-bottom:12px;word-break:break-all;">${fileName}</div>
      <div style="display:flex;flex-direction:column;gap:8px;text-align:left;">
        <label style="font-size:12px;font-weight:600;color:#334155;">Rolada <span style="color:#ef4444">*</span></label>
        <input id="rl-rolada" class="swal2-input" style="margin:0;" placeholder="Ej. 5421" value="${rolada}" />
        <label style="font-size:12px;font-weight:600;color:#334155;">Partida <span style="color:#ef4444">*</span></label>
        <input id="rl-partida" class="swal2-input" style="margin:0;" placeholder="Ej. 0542106" />
        <label style="font-size:12px;color:#64748b;">Observación (opcional)</label>
        <input id="rl-obs" class="swal2-input" style="margin:0;" placeholder="Ej. sin archivo para turno 1" />
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: '🔗 Vincular',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const html = Swal.getHtmlContainer()
      const roladaVal  = html.querySelector('#rl-rolada')?.value?.trim()
      const partidaVal = html.querySelector('#rl-partida')?.value?.trim()
      const obsVal     = html.querySelector('#rl-obs')?.value?.trim()
      if (!roladaVal && !partidaVal) {
        Swal.showValidationMessage('Ingrese al menos Rolada o Partida')
        return false
      }
      return { rolada: roladaVal, partida: partidaVal, observacion: obsVal }
    }
  })

  if (!isConfirmed || !formValues) return

  try {
    const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
    const API_URL  = API_BASE ? `${API_BASE}/api` : '/api'

    const res = await fetch(`${API_URL}/benninger-rtf/relink`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          sourceFile:  row.source_file,
          rolada:      formValues.rolada  || null,
          partida:     formValues.partida || null,
          reason:      formValues.observacion
            ? `USER_MANUAL_RELINK: ${formValues.observacion}`
            : 'USER_MANUAL_RELINK'
        }]
      })
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    if ((data.savedCount || 0) > 0) {
      // Marcar como vinculado en UI sin recargar toda la lista
      sinMatchLinked.value = new Set([...sinMatchLinked.value, row.source_file])
      sinMatchTotal.value  = Math.max(0, (sinMatchTotal.value || 0) - 1)
      Swal.fire({
        icon: 'success', title: 'Vinculado',
        text: `${fileName} → Rolada ${formValues.rolada || '–'} / Partida ${formValues.partida || '–'}`,
        toast: true, position: 'top-end',
        showConfirmButton: false, timer: 3000, timerProgressBar: true
      })
    } else {
      const errMsg = (data.errors || [])[0]?.error || 'Error desconocido'
      Swal.fire({ icon: 'error', title: 'Error al vincular', text: errMsg })
    }
  } catch (e) {
    console.error('Error en relink:', e)
    Swal.fire({ icon: 'error', title: 'Error de conexión', text: e.message })
  }
}

const isMatching = ref(false)
const isSaving = ref(false)
const RTF_PARSE_VERSION = 'rtf-full-v1'
const NO_APTA_REASON_OPTIONS = [
  { value: 'DESPERDICIO', label: 'Desperdicio / descarte' },
  { value: 'FALLA_MECANICA', label: 'Falla mecanica del proceso' },
  { value: 'FUERA_PARAMETRO', label: 'Fuera de parametro operativo' },
  { value: 'SIN_DESTINO_TELAR', label: 'Sin destino a telar' },
  { value: 'OTRO', label: 'Otro' }
]

function openDb() {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('benninger-rtf-matcher')
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function saveDirHandleToIDB(dirHandle) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite')
    const store = tx.objectStore('handles')
    const req = store.put(dirHandle, 'dir')
    req.onsuccess = () => resolve(true)
    req.onerror = () => reject(req.error)
  })
}

async function getDirHandleFromIDB() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly')
    const store = tx.objectStore('handles')
    const req = store.get('dir')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function verifyPermission(handle, mode = 'read') {
  if (!handle) return false
  const opts = { mode }
  if (await handle.queryPermission(opts) === 'granted') return true
  if (await handle.requestPermission(opts) === 'granted') return true
  return false
}

function normalizeLoose(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function rtfToPlainText(raw) {
  let text = String(raw || '')

  text = text.replace(/\\'[0-9a-fA-F]{2}/g, (m) => {
    const code = Number.parseInt(m.slice(2), 16)
    return Number.isFinite(code) ? String.fromCharCode(code) : ''
  })
  text = text.replace(/\\par[d]?/g, '\n')
  text = text.replace(/\\tab/g, '\t')
  text = text.replace(/\\[a-zA-Z]+-?\d* ?/g, '')
  text = text.replace(/[{}]/g, ' ')
  text = text.replace(/\r/g, '')
  text = text.replace(/[ \t]+\n/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')

  return text
}

async function readRtfFileText(file) {
  if (!file) return ''

  try {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    const decoded1252 = new TextDecoder('windows-1252').decode(bytes)
    const decodedUtf8 = new TextDecoder('utf-8').decode(bytes)

    const bad1252 = (decoded1252.match(/[Ã�]/g) || []).length
    const badUtf8 = (decodedUtf8.match(/[Ã�]/g) || []).length
    return badUtf8 < bad1252 ? decodedUtf8 : decoded1252
  } catch {
    return await file.text()
  }
}

function extractField(lines, keyLike) {
  const keyNorm = normalizeLoose(keyLike)
  for (const line of lines) {
    const parts = line.split(':')
    if (parts.length < 2) continue
    const left = normalizeLoose(parts[0])
    if (!left.includes(keyNorm)) continue
    return parts.slice(1).join(':').trim()
  }
  return ''
}

function extractMetricValue(normalizedText, patterns, unit) {
  for (const pattern of patterns) {
    const m = normalizedText.match(pattern)
    if (!m) continue
    const value = String(m[1] || '').trim()
    if (!value) continue
    return `${value} ${unit}`
  }
  return ''
}

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function extractMetricNumber(normalizedText, patterns) {
  for (const pattern of patterns) {
    const m = normalizedText.match(pattern)
    if (!m) continue
    const n = toNumberOrNull(m[1])
    if (Number.isFinite(n)) return n
  }
  return null
}

function findCodeLine(lines, code) {
  const escaped = String(code || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^\\s*${escaped}\\s*:`, 'i')
  return (Array.isArray(lines) ? lines : []).find((line) => re.test(String(line || ''))) || ''
}

function extractCodeNumber(lines, code) {
  const codeLine = findCodeLine(lines, code)
  if (!codeLine) return null

  const rightSide = codeLine.split(':').slice(1).join(':')
  if (!rightSide) return null

  const matches = [...rightSide.matchAll(/-?[0-9]+(?:[.,][0-9]+)?/g)]
  if (!matches.length) return null

  // The effective configured value is typically the last numeric token on the line.
  return toNumberOrNull(matches[matches.length - 1][0])
}

function formatMetricFromCode(lines, code, unit) {
  const value = extractCodeNumber(lines, code)
  if (!Number.isFinite(value)) return ''
  return `${value} ${unit}`
}

function parseRtfHeader(rawText) {
  const plain = rtfToPlainText(rawText)
  const plainNorm = normalizeLoose(plain)
  const lines = plain
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const metros = formatMetricFromCode(lines, '1x014', 'm') || extractMetricValue(
    plainNorm,
    [
      /1x014\s*:\s*comprimento\s+de\s+saida\s*([0-9]+(?:[.,][0-9]+)?)\s*m\b/i,
      /1x014\s*:\s*.{0,120}?([0-9]+(?:[.,][0-9]+)?)\s*m\b/i
    ],
    'm'
  )

  const velMMin = formatMetricFromCode(lines, '1s102', 'm/min') || extractMetricValue(
    plainNorm,
    [
      /1s102\s*:\s*velo\.?\s*de\s*producao\s*tingindo\s*([0-9]+(?:[.,][0-9]+)?)\s*m\/min\b/i,
      /1s102\s*:\s*.{0,120}?([0-9]+(?:[.,][0-9]+)?)\s*m\/min\b/i
    ],
    'm/min'
  )

  const stretchAplicado = extractCodeNumber(lines, '1s034')
  const humedadSalida = extractCodeNumber(lines, '1s068')
  const tensionPlegador = extractCodeNumber(lines, '1s054')
  const gomaReal = extractCodeNumber(lines, '1a41')
  const presionExprimido = extractCodeNumber(lines, '1s086')

  const timelineCodeMap = [
    { punto: 'M12', code: '1s002' },
    { punto: 'M13', code: '1s003' },
    { punto: 'M14', code: '1s004' },
    { punto: 'M15', code: '1s005' },
    { punto: 'M17', code: '2s007' },
    { punto: 'M18', code: '2s008' },
    { punto: 'M20', code: '1s009' },
    { punto: 'M21', code: '1s010' },
    { punto: 'M22', code: '1s011' },
    { punto: 'M24', code: '1s012' },
    { punto: 'M25', code: '1s013' },
    { punto: 'M26', code: '1s014' },
    { punto: 'S800', code: '1s054' }
  ]

  const tensionTimeline = timelineCodeMap
    .map(({ punto, code }) => {
      const tensionN = extractCodeNumber(lines, code)
      if (!Number.isFinite(tensionN)) return null
      return { punto, tensionN: Number(tensionN.toFixed(3)) }
    })
    .filter(Boolean)

  return {
    idRolo: extractField(lines, 'id rolo'),
    indicativo: extractField(lines, 'indicativo'),
    comeco: extractField(lines, 'comeco'),
    fim: extractField(lines, 'fim'),
    duracao: extractField(lines, 'duracao'),
    receita: extractField(lines, 'receita'),
    metros,
    velMMin,
    stretchAplicado,
    humedadSalida,
    tensionPlegador,
    gomaReal,
    presionExprimido,
    '1S034': stretchAplicado,
    '1S068': humedadSalida,
    '1S054': tensionPlegador,
    '1A41': gomaReal,
    '1S086': presionExprimido,
    tensionTimeline
  }
}

function confidenceClass(confidence) {
  if (confidence === 'high') return 'bg-emerald-100 text-emerald-700'
  if (confidence === 'medium') return 'bg-amber-100 text-amber-700'
  if (confidence === 'low') return 'bg-orange-100 text-orange-700'
  return 'bg-slate-100 text-slate-600'
}

function formatSeconds(seconds) {
  const sec = Number(seconds)
  if (!Number.isFinite(sec)) return '-'
  if (sec < 60) return `${Math.round(sec)}s`
  const min = sec / 60
  return `${min.toFixed(1)}m`
}

function formatMetric(value, unit, decimals = 0) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '-'
  return `${n.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })} ${unit}`
}

function formatFibraQuality(fibra) {
  if (!fibra) return '-'
  const parts = []
  if (Number.isFinite(Number(fibra.mic))) parts.push(`MIC ${Number(fibra.mic).toFixed(2)}`)
  if (Number.isFinite(Number(fibra.str))) parts.push(`STR ${Number(fibra.str).toFixed(2)}`)
  if (Number.isFinite(Number(fibra.sci))) parts.push(`SCI ${Number(fibra.sci).toFixed(1)}`)
  return parts.length ? parts.join(' | ') : '-'
}

const pendingRows = computed(() => rtfRows.value.filter((row) => !row.saved))
const highConfidenceRows = computed(() => pendingRows.value.filter((row) => row.confidence === 'high' && row.suggested))

const displayRows = computed(() => {
  const list = showOnlyPending.value ? pendingRows.value : rtfRows.value
  return [...list].sort((a, b) => a.fileName.localeCompare(b.fileName))
})

const selectedRow = computed(() => {
  return rtfRows.value.find((row) => row.sourceFile === selectedSourceFile.value) || null
})

const summaryText = computed(() => {
  const total = rtfRows.value.length
  const saved = rtfRows.value.filter((r) => r.saved).length
  const high = rtfRows.value.filter((r) => r.confidence === 'high').length
  const mediumLow = rtfRows.value.filter((r) => r.confidence === 'medium' || r.confidence === 'low').length
  return `Total ${total} | Guardados ${saved} | Alta conf. ${high} | Dudosos ${mediumLow}`
})

function mergeRows(rowsFromApi) {
  const bySource = new Map(rowsFromApi.map((row) => [row.sourceFile, row]))
  rtfRows.value = rtfRows.value.map((row) => {
    const incoming = bySource.get(row.sourceFile)
    if (!incoming) return row

    const selectedCandidate = incoming.suggested || null
    return {
      ...row,
      candidates: incoming.candidates || [],
      suggested: incoming.suggested || null,
      selectedCandidate,
      confidence: incoming.confidence || 'none',
      scoreGap: incoming.scoreGap || 0,
      decision: incoming.decision || 'review',
      saved: incoming.saved === true ? true : row.saved,
      matchError: incoming.error || null
    }
  })
}

async function selectFolder() {
  try {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      const dirHandle = await window.showDirectoryPicker()
      await saveDirHandleToIDB(dirHandle)
      hasPersistedHandle.value = true
      selectedFolderName.value = dirHandle.name || 'Carpeta seleccionada'
      folderPathDisplay.value = dirHandle.name || ''
      await scanDirectory(dirHandle)
      return
    }
  } catch (err) {
    console.warn('selectFolder error:', err)
  }

  if (folderInput.value) {
    folderInput.value.click()
  }
}

async function refreshFolder() {
  try {
    const dirHandle = await getDirHandleFromIDB()
    if (!dirHandle) return
    const ok = await verifyPermission(dirHandle, 'read')
    if (!ok) {
      await Swal.fire({
        icon: 'warning',
        title: 'Permisos requeridos',
        text: 'Selecciona la carpeta nuevamente para refrescar el escaneo.'
      })
      return
    }
    await scanDirectory(dirHandle)
  } catch (err) {
    console.warn('refreshFolder error:', err)
  }
}

async function scanDirectory(dirHandle) {
  const rows = []
  let fileCount = 0

  for await (const [name, handle] of dirHandle.entries()) {
    if (!handle || handle.kind !== 'file') continue
    if (!String(name || '').toLowerCase().endsWith('.rtf')) continue

    fileCount += 1
    const file = await handle.getFile()
    const text = await readRtfFileText(file)
    const plainText = rtfToPlainText(text)
    const header = parseRtfHeader(text)

    rows.push({
      sourceFile: name,
      fileName: name,
      header,
      rawRtfText: text,
      plainText,
      parseVersion: RTF_PARSE_VERSION,
      saved: false,
      candidates: [],
      suggested: null,
      selectedCandidate: null,
      confidence: 'none',
      scoreGap: 0,
      decision: 'review',
      matchError: null
    })
  }

  rtfRows.value = rows.sort((a, b) => a.fileName.localeCompare(b.fileName))
  await refreshSavedStatus()

  if (rtfRows.value.length) {
    selectedSourceFile.value = rtfRows.value[0].sourceFile
  }

  scanStatus.value = fileCount
    ? `Escaneo completado. ${fileCount} archivos RTF detectados.`
    : 'No se encontraron archivos .rtf en la carpeta seleccionada.'
}

async function onFolderInputChange(event) {
  try {
    const files = Array.from(event?.target?.files || [])
    const rows = []

    for (const file of files) {
      if (!String(file.name || '').toLowerCase().endsWith('.rtf')) continue
      const text = await readRtfFileText(file)
      const plainText = rtfToPlainText(text)
      const header = parseRtfHeader(text)
      const relative = String(file.webkitRelativePath || file.name || '')

      rows.push({
        sourceFile: relative || file.name,
        fileName: file.name,
        header,
        rawRtfText: text,
        plainText,
        parseVersion: RTF_PARSE_VERSION,
        saved: false,
        candidates: [],
        suggested: null,
        selectedCandidate: null,
        confidence: 'none',
        scoreGap: 0,
        decision: 'review',
        matchError: null
      })
    }

    rtfRows.value = rows.sort((a, b) => a.fileName.localeCompare(b.fileName))
    folderPathDisplay.value = files[0]?.webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : 'Carpeta local'
    selectedFolderName.value = 'Carpeta local'
    hasPersistedHandle.value = false

    await refreshSavedStatus()

    if (rtfRows.value.length) {
      selectedSourceFile.value = rtfRows.value[0].sourceFile
    }

    scanStatus.value = rtfRows.value.length
      ? `Escaneo local completado. ${rtfRows.value.length} archivos RTF detectados.`
      : 'No se encontraron archivos .rtf en la seleccion.'
  } catch (err) {
    console.warn('onFolderInputChange error:', err)
    scanStatus.value = `Error leyendo carpeta: ${err.message}`
  }
}

async function refreshSavedStatus() {
  if (!rtfRows.value.length) return

  try {
    const response = await fetch('/api/benninger-rtf/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileNames: rtfRows.value.map((row) => row.sourceFile) })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    const existing = new Set((data.existing || []).map((v) => String(v)))
    // noMatch: están en la BD pero sin match válido → tratar como pendientes
    const noMatch   = new Set((data.noMatch  || []).map((v) => String(v)))

    rtfRows.value = rtfRows.value.map((row) => ({
      ...row,
      saved: existing.has(row.sourceFile) && !noMatch.has(row.sourceFile)
    }))
  } catch (err) {
    console.warn('refreshSavedStatus error:', err)
  }
}

async function runAutomaticMatch() {
  const filesToMatch = pendingRows.value.map((row) => ({
    sourceFile: row.sourceFile,
    header: row.header,
    rawRtfText: row.rawRtfText || null,
    plainText: row.plainText || null,
    parseVersion: row.parseVersion || RTF_PARSE_VERSION
  }))

  if (!filesToMatch.length) {
    scanStatus.value = 'No hay archivos pendientes para matchear.'
    return
  }

  const BATCH_SIZE = 30
  const totalBatches = Math.ceil(filesToMatch.length / BATCH_SIZE)

  isMatching.value = true
  scanStatus.value = `Ejecutando matcheo automatico (0/${totalBatches} lotes)...`

  const accSummary = { high: 0, medium: 0, low: 0, none: 0 }

  try {
    for (let i = 0; i < filesToMatch.length; i += BATCH_SIZE) {
      const batch = filesToMatch.slice(i, i + BATCH_SIZE)
      const batchNum = Math.floor(i / BATCH_SIZE) + 1
      scanStatus.value = `Matcheo automatico: lote ${batchNum}/${totalBatches}...`

      const response = await fetch('/api/benninger-rtf/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: batch, autoConfirmHighConfidence: false })
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      mergeRows(data.rows || [])

      accSummary.high += data.summary?.high || 0
      accSummary.medium += data.summary?.medium || 0
      accSummary.low += data.summary?.low || 0
      accSummary.none += data.summary?.none || 0
    }

    const doubt = accSummary.medium + accSummary.low
    scanStatus.value = `Matcheo completado. Alta confianza: ${accSummary.high}. Casos dudosos: ${doubt}.`
  } catch (err) {
    scanStatus.value = `Error en matcheo automatico: ${err.message}`
  } finally {
    isMatching.value = false
  }
}

async function applyAutoHighConfidence() {
  const items = highConfidenceRows.value.map((row) => ({
    sourceFile: row.sourceFile,
    header: row.header,
    rawRtfText: row.rawRtfText || null,
    plainText: row.plainText || null,
    parseVersion: row.parseVersion || RTF_PARSE_VERSION,
    selected: row.suggested,
    confidence: row.confidence,
    mode: 'auto',
    reason: 'AUTO_HIGH_CONFIDENCE',
    candidates: row.candidates,
    scoreGap: row.scoreGap
  }))

  if (!items.length) {
    scanStatus.value = 'No hay filas de alta confianza para guardar automaticamente.'
    return
  }

  isSaving.value = true

  try {
    const response = await fetch('/api/benninger-rtf/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const data = await response.json()
    const savedSet = new Set((data.saved || []).map((row) => row.sourceFile))
    rtfRows.value = rtfRows.value.map((row) => ({
      ...row,
      saved: savedSet.has(row.sourceFile) ? true : row.saved
    }))

    scanStatus.value = `Guardado automatico completado. ${data.savedCount || 0} vinculaciones aplicadas.`
  } catch (err) {
    scanStatus.value = `Error guardando automaticos: ${err.message}`
  } finally {
    isSaving.value = false
  }
}

function isCandidateSelected(row, candidate) {
  if (!row.selectedCandidate) return false
  return row.selectedCandidate.partida === candidate.partida
    && row.selectedCandidate.rolada === candidate.rolada
    && row.selectedCandidate.dtInicio === candidate.dtInicio
    && row.selectedCandidate.horaInicio === candidate.horaInicio
}

function selectCandidate(sourceFile, candidate) {
  rtfRows.value = rtfRows.value.map((row) => {
    if (row.sourceFile !== sourceFile) return row
    return { ...row, selectedCandidate: candidate }
  })
}

function openFileInApp(row) {
  if (!row?.rawRtfText) return
  const blob = new Blob([row.rawRtfText], { type: 'application/rtf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = row.fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

function advanceToNextRow() {
  const rows = displayRows.value
  const idx = rows.findIndex((r) => r.sourceFile === selectedSourceFile.value)
  if (idx === -1 || rows.length <= 1) return
  const next = rows[idx + 1] ?? rows[idx - 1] ?? null
  if (next) selectedSourceFile.value = next.sourceFile
}

function resolveRowCandidate(row) {
  if (!row) return null
  if (row.selectedCandidate) return row.selectedCandidate
  if (row.suggested) return row.suggested
  return null
}

function inferRoladaForNoApta(row) {
  const current = resolveRowCandidate(row)
  if (current?.rolada) return String(current.rolada)

  const partida = String(current?.partida || '').trim()
  if (!partida) return ''

  const sibling = rtfRows.value.find((candidateRow) => {
    if (!candidateRow || candidateRow.sourceFile === row.sourceFile) return false
    const candidate = resolveRowCandidate(candidateRow)
    if (!candidate?.rolada) return false
    return String(candidate.partida || '').trim() === partida
  })

  return sibling ? String(resolveRowCandidate(sibling)?.rolada || '') : ''
}

async function confirmSelectedRow() {
  const row = selectedRow.value
  if (!row || !row.selectedCandidate || row.saved) return

  isSaving.value = true
  try {
    const response = await fetch('/api/benninger-rtf/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          sourceFile: row.sourceFile,
          header: row.header,
          rawRtfText: row.rawRtfText || null,
          plainText: row.plainText || null,
          parseVersion: row.parseVersion || RTF_PARSE_VERSION,
          selected: row.selectedCandidate,
          confidence: row.confidence,
          mode: 'manual',
          reason: 'USER_VALIDATED',
          candidates: row.candidates,
          scoreGap: row.scoreGap
        }]
      })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    if ((data.savedCount || 0) > 0) {
      advanceToNextRow()
      rtfRows.value = rtfRows.value.map((item) =>
        item.sourceFile === row.sourceFile ? { ...item, saved: true } : item
      )
      scanStatus.value = 'Vinculo confirmado manualmente.'
    } else {
      scanStatus.value = 'No se pudo confirmar el vinculo seleccionado.'
    }
  } catch (err) {
    scanStatus.value = `Error al confirmar vinculo: ${err.message}`
  } finally {
    isSaving.value = false
  }
}

async function registerNoAptaRow() {
  const row = selectedRow.value
  if (!row || row.saved) return

  const baseCandidate = resolveRowCandidate(row)
  const defaultPartida = String(baseCandidate?.partida || '').trim()
  const defaultRolada = inferRoladaForNoApta(row)

  const reasonOptionsHtml = NO_APTA_REASON_OPTIONS
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join('')

  const result = await Swal.fire({
    title: 'Registrar lote no apta',
    html: `
      <div style="display:flex;flex-direction:column;gap:8px;text-align:left;">
        <label style="font-size:12px;color:#334155;">Partida (opcional)</label>
        <input id="no-apta-partida" class="swal2-input" style="margin:0;" placeholder="Ej. 0475714" />
        <label style="font-size:12px;color:#334155;">Rolada (requerida)</label>
        <input id="no-apta-rolada" class="swal2-input" style="margin:0;" placeholder="Ej. 2307271457" />
        <label style="font-size:12px;color:#334155;">Motivo</label>
        <select id="no-apta-motivo" class="swal2-select" style="margin:0;">${reasonOptionsHtml}</select>
        <label style="font-size:12px;color:#334155;">Observacion (opcional)</label>
        <textarea id="no-apta-observacion" class="swal2-textarea" style="margin:0;" placeholder="Detalle operativo para auditoria"></textarea>
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar no apta',
    cancelButtonText: 'Cancelar',
    didOpen: () => {
      const htmlContainer = Swal.getHtmlContainer()
      if (!htmlContainer) return
      const partidaInput = htmlContainer.querySelector('#no-apta-partida')
      const roladaInput = htmlContainer.querySelector('#no-apta-rolada')
      const motivoInput = htmlContainer.querySelector('#no-apta-motivo')
      if (partidaInput) partidaInput.value = defaultPartida
      if (roladaInput) roladaInput.value = defaultRolada
      if (motivoInput) motivoInput.value = NO_APTA_REASON_OPTIONS[0]?.value || 'DESPERDICIO'
    },
    preConfirm: () => {
      const htmlContainer = Swal.getHtmlContainer()
      if (!htmlContainer) return null

      const partida = String(htmlContainer.querySelector('#no-apta-partida')?.value || '').trim()
      const rolada = String(htmlContainer.querySelector('#no-apta-rolada')?.value || '').trim()
      const motivo = String(htmlContainer.querySelector('#no-apta-motivo')?.value || '').trim() || 'OTRO'
      const observacion = String(htmlContainer.querySelector('#no-apta-observacion')?.value || '').trim()

      if (!rolada) {
        Swal.showValidationMessage('La rolada es requerida para registrar no apta.')
        return null
      }

      return { partida, rolada, motivo, observacion }
    }
  })

  if (!result.isConfirmed || !result.value) return

  const payload = result.value
  const selectedNoApta = {
    partida: payload.partida || null,
    rolada: payload.rolada || null
  }

  isSaving.value = true
  try {
    const response = await fetch('/api/benninger-rtf/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: [{
          sourceFile: row.sourceFile,
          header: row.header,
          rawRtfText: row.rawRtfText || null,
          plainText: row.plainText || null,
          parseVersion: row.parseVersion || RTF_PARSE_VERSION,
          selected: selectedNoApta,
          confidence: 'none',
          mode: 'manual_no_apta',
          reason: `NO_APTA_${payload.motivo}`,
          noApta: {
            motivo: payload.motivo,
            observacion: payload.observacion || null
          },
          candidates: row.candidates,
          scoreGap: row.scoreGap
        }]
      })
    })

    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()

    if ((data.savedCount || 0) > 0) {
      advanceToNextRow()
      rtfRows.value = rtfRows.value.map((item) => {
        if (item.sourceFile !== row.sourceFile) return item
        return {
          ...item,
          selectedCandidate: selectedNoApta,
          confidence: 'none',
          decision: 'no_apta',
          saved: true
        }
      })
      scanStatus.value = 'Registro no apta guardado y asociado por rolada.'
    } else {
      scanStatus.value = 'No se pudo guardar el registro no apta.'
    }
  } catch (err) {
    scanStatus.value = `Error guardando no apta: ${err.message}`
  } finally {
    isSaving.value = false
  }
}

onMounted(async () => {
  if (typeof document !== 'undefined') document.title = 'Benninger RTF'

  try {
    const dirHandle = await getDirHandleFromIDB()
    if (!dirHandle) return

    const ok = await verifyPermission(dirHandle, 'read')
    if (!ok) return

    hasPersistedHandle.value = true
    selectedFolderName.value = dirHandle.name || 'Carpeta seleccionada'
    folderPathDisplay.value = dirHandle.name || ''

    await scanDirectory(dirHandle)
  } catch (err) {
    console.warn('onMounted BenningerRTF error:', err)
  }
})
</script>
