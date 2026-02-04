<template>
  <!-- Mensaje móvil: deshabilitado en pantallas pequeñas -->
  <div class="md:hidden p-4">
    <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 text-sm">
      Esta página de carga (Uster) está disponible solo en escritorio (pantallas medianas o mayores).
    </div>
  </div>
  <div class="hidden md:flex w-full h-screen flex-col p-1">
    <main
      class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col overflow-y-auto uster-component">
      <!-- Top: compact carpeta selector on a single line for desktop -->
      <div class="flex-shrink-0 mb-3">
        <div class="flex items-center gap-3">
          <label class="text-sm font-semibold text-slate-700 mr-2 shrink-0">Carpeta de archivos Uster:</label>

          <div class="flex-1 min-w-0">
            <div
              class="px-3 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-800 truncate shadow-sm focus-within:ring-2 focus-within:ring-blue-500"
              :title="folderPathFull">
              {{ folderPathFull || folderPath || selectedFolderName || 'Ninguna carpeta seleccionada' }}
              <span v-if="!isAbsolutePath" class="text-xs text-slate-500 ml-2">(ruta no absoluta disponible por
                seguridad)</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button @click="selectFolder" title="Seleccionar carpeta con archivos de Uster"
              class="hidden md:inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 7a2 2 0 012-2h3l2 3h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              Seleccionar
            </button>

            <button @click="selectFolder" title="Seleccionar carpeta con archivos de Uster"
              class="inline-flex md:hidden items-center p-2 border border-slate-200 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md"
              aria-label="Seleccionar carpeta">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M3 7a2 2 0 012-2h3l2 3h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
            </button>

            <button v-if="hasPersistedHandle" @click="refreshFolder" title="Actualizar archivos de Uster"
              class="hidden md:inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>
            <button v-if="hasPersistedHandle" @click="refreshFolder" title="Actualizar archivos de Uster"
              class="inline-flex md:hidden items-center p-2 border border-slate-200 bg-white text-slate-700 rounded-md hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md"
              aria-label="Actualizar carpeta">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
                stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>

            <!-- Revalidar button removed from UI -->
            <input ref="folderInput" type="file" webkitdirectory directory multiple class="hidden"
              @change="onFolderInputChange" />
          </div>

        </div>
      </div>
      <!-- scanStatus moved below the left list as per UX request -->

      <!-- Middle: three columns (left: list, middle: compact preview, right: Nro/Titulo) -->
      <div class="grid uster-grid" style="grid-template-columns: 440px 160px 270px;">
        <!-- Columna 1: Lista de Ensayos, Botones y Estado -->
        <div class="flex flex-col gap-3">
          <div class="scan-container rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs scan-table">
              <colgroup>
                <col class="col-ensayo" />
                <col class="col-par" />
                <col class="col-tbl" />
                <col class="col-imp" />
                <col class="col-ne" />
                <col class="col-maq" />
              </colgroup>
              <thead>
                <tr class="bg-gradient-to-r from-slate-50 to-slate-100">
                  <th
                    class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs col-ensayo">
                    Ensayo</th>
                  <th
                    class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs col-par">
                    .PAR</th>
                  <th
                    class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs col-tbl">
                    .TBL</th>
                  <th
                    class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs col-imp">
                    Estado</th>
                  <th
                    class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs col-ne">
                    Ne</th>
                  <th
                    class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs col-maq">
                    Maq.</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(item, idx) in scanDisplayList" :key="idx"
                  class="hover:bg-blue-50/30 cursor-pointer transition-colors duration-150"
                  @click="item.testnr && selectRow(item.testnr)"
                  :class="{ 'bg-blue-50': selectedTestnr === item.testnr }">
                  <td class="px-3 py-2 border-b border-slate-200 text-xs text-center text-slate-700 col-ensayo">{{ item.testnr || '' }}
                  </td>
                  <td class="px-3 py-2 border-b border-slate-200 text-center text-xs col-par">
                    <svg v-if="item.hasPar" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mx-auto"
                      :class="item.imp === true ? 'text-green-600' : 'text-slate-400'" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td class="px-3 py-2 border-b border-slate-200 text-center text-xs col-tbl">
                    <svg v-if="item.hasTbl" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mx-auto"
                      :class="item.imp === true ? 'text-green-600' : 'text-slate-400'" fill="none" viewBox="0 0 24 24"
                      stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </td>
                  <td class="px-3 py-2 border-b border-slate-200 text-center text-xs col-imp">
                    <span v-if="item.imp === true" title="Guardado en la base de datos">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600 mx-auto" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  </td>
                  <td class="px-3 py-2 border-b border-slate-200 text-center font-mono text-xs text-slate-700 col-ne">{{ item.nomcount
                    || '' }}</td>
                  <td class="px-3 py-2 border-b border-slate-200 text-center font-mono text-xs text-slate-700 col-maq">{{ item.maschnr
                    || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="text-sm text-slate-600 font-medium">
            {{ scanStatusDisplay }}
          </div>

          <!-- Filtros de visualización -->
          <div class="mt-2 bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div class="flex items-center gap-4 text-xs">
              <label
                class="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors duration-150">
                <input type="checkbox" v-model="filterShowAll"
                  @change="() => { if (filterShowAll) { filterShowNotSaved = false; filterShowSaved = false; clearSelection(); } }"
                  class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-400" />
                <span class="text-slate-700 font-medium">Mostrar todos</span>
              </label>
              <label
                class="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors duration-150">
                <input type="checkbox" v-model="filterShowNotSaved"
                  @change="() => { if (filterShowNotSaved) { filterShowAll = false; filterShowSaved = false; clearSelection(); } }"
                  class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-400" />
                <span class="text-slate-700 font-medium">No guardados</span>
              </label>
              <label
                class="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-2 py-1.5 rounded-lg transition-colors duration-150">
                <input type="checkbox" v-model="filterShowSaved"
                  @change="() => { if (filterShowSaved) { filterShowAll = false; filterShowNotSaved = false; clearSelection(); } }"
                  class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-400" />
                <span class="text-slate-700 font-medium">Guardados</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Columna 2: Nro / Titulo (ahora en el medio) -->
        <div style="width:160px;">
          <!-- Input para ESTIRAJE -->
          <div class="mb-2 rounded-xl border border-slate-200 bg-white p-2">
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs font-semibold text-slate-700">Estiraje</label>
              <input 
                ref="estirajeInput"
                v-model="estiraje" 
                type="text" 
                maxlength="5"
                :disabled="!selectedTestnr"
                @input="handleEstirajeInput"
                @keydown.enter.prevent="handleEstirajeEnter"
                @keydown="handleEstirajeKeydown"
                @keydown.down.prevent="focusPasadorAndSelectSi"
                :class="[
                  'w-16 px-2 py-0.5 text-sm text-center border border-slate-300 rounded focus:outline-none transition-all',
                  !selectedTestnr ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-white text-slate-900 hover:bg-slate-50 focus:ring-2 focus:ring-yellow-300 focus:border-yellow-300 focus:bg-yellow-50'
                ]"
              />
            </div>
          </div>

          <!-- Radio buttons para PASADOR -->
          <div class="mb-2 rounded-xl border border-slate-200 bg-white p-2">
            <div class="flex items-center justify-between gap-2">
              <label class="text-xs font-semibold text-slate-700">Pasador</label>
              <div class="flex items-center gap-3">
                <label class="flex items-center gap-1 cursor-pointer">
                  <input 
                    ref="pasadorSiInput"
                    v-model="pasador" 
                    type="radio" 
                    value="Si"
                    :disabled="!selectedTestnr"
                    @keydown="handlePasadorKeydown"
                    :class="[
                      'w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-2 focus:ring-blue-500',
                      !selectedTestnr ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    ]"
                  />
                  <span :class="['text-xs', !selectedTestnr ? 'text-slate-400' : 'text-slate-700']">Si</span>
                </label>
                <label class="flex items-center gap-1 cursor-pointer">
                  <input 
                    ref="pasadorNoInput"
                    v-model="pasador" 
                    type="radio" 
                    value="No"
                    :disabled="!selectedTestnr"
                    @keydown="handlePasadorKeydown"
                    :class="[
                      'w-3.5 h-3.5 text-blue-600 border-slate-300 focus:ring-2 focus:ring-blue-500',
                      !selectedTestnr ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                    ]"
                  />
                  <span :class="['text-xs', !selectedTestnr ? 'text-slate-400' : 'text-slate-700']">No</span>
                </label>
              </div>
            </div>
          </div>

          <!-- fixed-height container that shows 10 rows and scrolls when there are more -->
          <div class="titulo-container rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs titulo-table">
              <thead>
                <tr class="bg-gradient-to-r from-slate-50 to-slate-100">
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs"
                    style="width:70px">Huso</th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs"
                    style="width:90px">Titulo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, idx) in tituloList" :key="idx"
                  class="hover:bg-blue-50/30 transition-colors duration-150">
                  <td class="px-3 py-2 border-b border-slate-200 text-xs text-center text-slate-700 font-mono" style="width:70px">
                    <div v-if="r.srcIndex !== null">
                      {{ r.nro }}
                    </div>
                    <div v-else class="text-xs text-slate-400">—</div>
                  </td>
                  <td class="px-1 py-0 border-b border-slate-200 text-xs text-center" style="width:90px">
                    <div v-if="r.srcIndex !== null">
                      <input :id="'titulo-input-' + r.srcIndex" v-model="tblData[r.srcIndex].TITULO" inputmode="decimal"
                        maxlength="5" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                        @focus="onTituloFocus(r.srcIndex)" @blur="onTituloBlur(r.srcIndex)"
                        @input="onTituloInput(r.srcIndex, $event)" @keydown.enter.prevent="focusNextTitulo(r.srcIndex)"
                        @keydown.up.prevent="focusPrevTitulo(r.srcIndex)"
                        @keydown.down.prevent="focusNextTituloWrap(r.srcIndex)"
                        :class="['w-full box-border px-1 py-0.5 text-sm text-center border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:border-blue-500 transition-all', isFocusedIndex === r.srcIndex ? 'bg-yellow-50 ring-2 ring-yellow-400' : 'bg-white hover:bg-slate-50']"
                        style="box-sizing: border-box; margin:0; border-radius:0;" />
                    </div>
                    <div v-else class="text-xs text-slate-400">—</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Columna 3: Detalle Compacto (moved to right) -->
        <div>
          <div class="rounded-xl border border-slate-200 overflow-hidden bg-white">
            <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs compact-table">
              <colgroup>
                <col class="col-dato" />
                <col class="col-valor" />
              </colgroup>
              <thead>
                <tr class="bg-gradient-to-r from-slate-50 to-slate-100">
                  <th
                    class="px-3 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 text-xs col-dato">
                    Dato</th>
                  <th
                    class="px-3 py-3 text-left font-semibold text-slate-700 border-b border-slate-200 text-xs col-valor">
                    Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in compactFields" :key="c.code" class="hover:bg-blue-50/30 transition-colors duration-150">
                  <td class="px-3 py-2 border-b border-slate-200 font-medium text-xs text-slate-700 col-dato">{{ c.label }}</td>
                  <td class="px-3 py-2 border-b border-slate-200 font-mono text-xs text-slate-700 col-valor">
                    <!-- Select para Tipo Material -->
                    <select 
                      v-if="c.code === 'MATCLASS'" 
                      v-model="matclass"
                      class="w-[calc(100%-5px)] px-2 py-1 border border-slate-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="Hilo">Hilo</option>
                      <option value="Hilo de fantasia">Hilo de fantasia</option>
                    </select>
                    <!-- Resto de campos como antes -->
                    <span v-else>{{ getFieldValueByCode(c.code) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="mt-3 flex gap-2">
            <button ref="saveButton" v-if="canSave" @click="saveCurrentTest" :disabled="isSaving"
              @keydown.up.prevent="focusLastTitulo"
              class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 shadow-sm hover:shadow-md">
              <span v-if="!isSaving">Guardar</span>
              <span v-else>Guardando...</span>
            </button>
            <button v-if="selectedTestnr && isTestSaved" @click="deleteCurrentTest" :disabled="isDeleting"
              class="inline-flex items-center gap-2 px-3 py-1 border border-red-300 bg-white text-red-700 rounded-md text-sm font-medium hover:bg-red-50 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 shadow-sm hover:shadow-md">
              <span v-if="!isDeleting">Eliminar</span>
              <span v-else>Eliminando...</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom: TBL import results (full width) -->
      <div v-if="tblData.length" class="mt-4 rounded-xl border border-slate-200">
        <div class="_minimal-scroll" style="overflow-x:auto;">
          <table class="w-full text-sm border-collapse tbl-import-table compact-table"
            :style="{ minWidth: tblMinWidth + 'px', tableLayout: 'fixed' }">
            <colgroup>
              <col :style="{ width: indexColWidth + 'px' }" />
              <col v-for="(c, ci) in tblColumns" :key="ci" :style="{ width: getColWidth(c) + 'px' }" />
            </colgroup>
            <thead>
              <tr class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0">
                <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs">#</th>
                <th v-for="c in tblColumns" :key="c"
                  class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200 text-xs">{{ c }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, idx) in tblData" :key="idx" class="hover:bg-blue-50/30 transition-colors duration-150">
                <td class="px-3 py-2 border-b border-slate-200 text-xs text-center">{{ idx + 1 }}</td>
                <td v-for="c in tblColumns" :key="c"
                  class="px-3 py-2 border-b border-slate-200 font-mono text-xs text-center text-slate-700">{{ r[c] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick, watch } from 'vue'
import Swal from 'sweetalert2'

// refs and state
const folderInput = ref(null)
const saveButton = ref(null)
const estirajeInput = ref(null)
const pasadorSiInput = ref(null)
const pasadorNoInput = ref(null)
const selectedFolderName = ref('')
const scanList = ref([])
const selectedTestnr = ref('')
const scanStatus = ref('')

const fileText = ref('')
const folderPath = ref('')
const hasPersistedHandle = ref(false)
const folderPathFull = ref('')
const isAbsolutePath = ref(false)

// Campo editable para ESTIRAJE (ingreso manual del usuario)
const estiraje = ref('')
// Flag to avoid reinsertar el punto cuando el usuario está borrando
const estirajeWasDeleting = ref(false)

// Campo para PASADOR (Si/No)
const pasador = ref('')

// Campo editable para MATCLASS (tipo de material)
const matclass = ref('')

// Watch para guardar cambios de matclass en scanList automáticamente
watch(matclass, (newValue) => {
  if (selectedTestnr.value && newValue) {
    const item = scanList.value.find(x => x.testnr === selectedTestnr.value)
    if (item) {
      item.matclass = newValue
    }
  }
})

// Filtros para la lista de ensayos
const filterShowAll = ref(false)
const filterShowNotSaved = ref(true) // Por defecto mostrar no guardados
const filterShowSaved = ref(false)

// Watch para limpiar la UI cuando no hay ensayos en la lista filtrada
watch(() => {
  // Contar ensayos reales (no placeholders) en la lista filtrada
  let items = scanList.value || []
  
  if (filterShowNotSaved.value) {
    items = items.filter(item => item.testnr && item.imp !== true)
  } else if (filterShowSaved.value) {
    items = items.filter(item => item.testnr && item.imp === true)
  }
  
  return items.length
}, (count) => {
  console.log('🔍 Watcher ejecutado: count =', count, 'selectedTestnr =', selectedTestnr.value)
  // Si no hay ensayos reales en la lista filtrada, limpiar COMPLETAMENTE
  if (count === 0 && selectedTestnr.value) {
    console.log('✅ Limpiando interfaz porque no hay ensayos en la lista filtrada')
    clearSelection()
  }
})

function getTestnrFromName(name) {
  if (!name) return null
  const s = String(name)
  // First, prefer patterns like STCxx_00260 (common in low-number tests)
  let m = s.match(/STC\d{2}[_-]?(\d{5})/i)
  if (m && m[1]) return m[1]
  // Next, prefer an underscore-delimited 5-digit block: _00260_ or _00260.
  m = s.match(/_(\d{5})(?:[_.]|$)/)
  if (m && m[1]) return m[1]
  // Fallback: any first sequence of 5 digits
  m = s.match(/(\d{5})/)
  return m ? m[1] : null
}

function onTituloInput(srcIndex, ev) {
  try {
    // read raw typed value
    let raw = String((ev && ev.target && ev.target.value) || '')
    // accept comma as decimal separator and normalize to dot
    raw = raw.replace(',', '.')
    // sanitize: allow only digits and a single dot; allow up to 2 decimal digits
    raw = raw.replace(/[^0-9.]/g, '')

    // Detect if this input event was a deletion (Backspace / Delete).
    // If so, do NOT auto-insert the decimal separator to allow the user to remove it.
    const inputType = ev && ev.inputType ? String(ev.inputType) : ''
    const isDeleting = inputType.startsWith('delete') || inputType.startsWith('history')

    // Auto-format: when user types 2 digits without a dot, automatically add the dot
    // but skip this auto-insert if the user is deleting (Backspace/Delete).
    const parts = raw.split('.')
    if (parts.length === 1) {
      if (!isDeleting && parts[0].length === 2) {
        // User has typed exactly 2 digits with no dot - add the dot automatically
        raw = parts[0] + '.'
      } else {
        // Still typing integer part, limit to 2 digits
        raw = parts[0].slice(0, 2)
      }
    } else {
      // Dot already present, limit integer to 2 and decimal to 2
      const intPart = parts[0].slice(0, 2)
      const decPart = (parts[1] || '').slice(0, 2)
      raw = intPart + '.' + decPart
    }

    // write sanitized value back to the model (do not touch DOM directly; let Vue update input)
    if (tblData.value && tblData.value[srcIndex]) tblData.value[srcIndex]['TITULO'] = raw

    // Auto-advance: if user has completed the format ##.## (5 chars total), move to next input
    // Check if we have the complete format: 2 digits + dot + 2 digits = 5 characters
    if (raw.length === 5 && raw.includes('.')) {
      const dotPos = raw.indexOf('.')
      // Verify format: 2 digits before dot, 2 digits after dot
      if (dotPos === 2 && raw.length - dotPos - 1 === 2) {
        // small timeout to ensure the input value is applied before moving focus
        setTimeout(() => focusNextTituloWrap(srcIndex), 0)
      }
    }
  } catch (err) { console.warn('onTituloInput error', err) }
}

async function selectFolder() {
  try {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      // use File System Access API
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker()
      // save handle for persistence
      try { await saveDirHandleToIDB(dirHandle); hasPersistedHandle.value = true } catch (err) { console.warn('saveDirHandleToIDB failed', err) }
      selectedFolderName.value = dirHandle.name || 'Carpeta seleccionada'
      // folderPathFull: browsers do not expose full filesystem absolute path for security.
      // We store a best-effort display value. The user can override manually.
      folderPathFull.value = dirHandle.name || ''
      isAbsolutePath.value = false
      // scan directory and populate list
      try {
        await scanDirectory(dirHandle)
      } catch (err) { console.warn('scanDirectory error', err) }
      // no snapshot persistence: we persist only the DirectoryHandle in IDB
      return
    }
  } catch (err) { console.warn('selectFolder error', err) }
  // fallback: trigger webkitdirectory input
  try {
    if (folderInput.value) {
      folderInput.value.click()
    } else {
      console.warn('No se pudo abrir el selector de carpeta: input no disponible')
      try { Swal.fire({ icon: 'error', title: 'No se pudo abrir el selector', text: 'El selector de carpetas no está disponible en este contexto.' }) } catch { scanStatus.value = 'No se pudo abrir el selector de carpetas.' }
    }
  } catch (err) { console.warn('No se pudo abrir el selector de carpeta', err); try { Swal.fire({ icon: 'error', title: 'Error', text: String(err) }) } catch { scanStatus.value = String(err) } }
}

// openLocalPicker removed: no fallback local opener required

// --- File System Access persistence helpers (IndexedDB) ---
function openDb() {
  return new Promise((resolve, reject) => {
    // Open without forcing a version number to avoid VersionError when DB already has a higher version.
    // If the object store is missing and an upgrade is required, onupgradeneeded will run.
    let req
    try {
      req = window.indexedDB.open('carga-uster')
    } catch (err) {
      return reject(err)
    }
    req.onupgradeneeded = () => {
      const db = req.result
      try {
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
      } catch (e) {
        console.warn('openDb onupgradeneeded error', e)
      }
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
    const r = store.put(dirHandle, 'dir')
    r.onsuccess = () => resolve(true)
    r.onerror = () => reject(r.error)
  })
}

async function getDirHandleFromIDB() {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly')
    const store = tx.objectStore('handles')
    const r = store.get('dir')
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function verifyPermission(handle, mode = 'read') {
  // Check if permission was already granted. If not, request it.
  if (!handle) return false
  try {
    // @ts-ignore
    const opts = { mode }
    // @ts-ignore
    if (await handle.queryPermission(opts) === 'granted') return true
    // @ts-ignore
    if (await handle.requestPermission(opts) === 'granted') return true
  } catch (err) {
    console.warn('verifyPermission error', err)
  }
  return false
}

/* deleted: deleteDirHandleFromIDB - removed because cache-clearing UI was removed */

// revalidateFolder removed: permission revalidation handled in refreshFolder and onMounted flow

async function refreshFolder() {
  try {
    const dirHandle = await getDirHandleFromIDB()
    if (!dirHandle) return
    const ok = await verifyPermission(dirHandle, 'read')
    if (!ok) {
      try {
        const res = await Swal.fire({
          icon: 'warning',
          title: 'Permisos insuficientes',
          text: 'No se concedieron permisos de lectura para la carpeta almacenada. Debes seleccionar la carpeta de nuevo para otorgar permisos.',
          confirmButtonText: 'Seleccionar carpeta',
          showCancelButton: true,
          cancelButtonText: 'Cancelar'
        })
        if (res.isConfirmed) await selectFolder()
      } catch (err) { console.warn('Swal error', err) }
      return
    }
    await scanDirectory(dirHandle)
  } catch (err) { console.warn('refreshFolder error', err) }
}

// Manual path editing removed: UI simplified to selector + refresh
async function scanDirectory(dirHandle) {
  console.log('Iniciando scanDirectory con handle:', dirHandle.name);
  const map = {};
  let fileCount = 0;
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      fileCount++;
      if (!handle || handle.kind !== 'file') continue;
      const ln = String(name || '').toLowerCase();
      if (!(ln.endsWith('.par') || ln.endsWith('.tbl'))) continue;

      const t = getTestnrFromName(name);
      if (!t) continue;

      if (!map[t]) {
        map[t] = { testnr: t, hasPar: false, hasTbl: false, parHandle: null, tblHandle: null, imp: false, nomcount: null, maschnr: null };
      }
      if (ln.endsWith('.par')) {
        map[t].hasPar = true;
        map[t].parHandle = handle;
        try {
          const f = await handle.getFile();
          const txt = await f.text();
          map[t].nomcount = extractTsvCell(txt, 15, 5) || '';
          map[t].maschnr = extractTsvCell(txt, 13, 5) || '';
          map[t].matclass = extractTsvCell(txt, 14, 8) || '';
        } catch (err) {
          console.warn('Error leyendo .PAR durante el escaneo', name, err);
        }
      }
      if (ln.endsWith('.tbl')) {
        map[t].hasTbl = true;
        map[t].tblHandle = handle;
      }
    }
  } catch (err) {
    console.error('Error durante el bucle de escaneo de directorio:', err);
    scanStatus.value = `Error al escanear: ${err.message}`;
  }

  console.log(`Escaneo finalizado. Total de archivos en el directorio: ${fileCount}. Ensayos mapeados: ${Object.keys(map).length}`);

  let newScanList = Object.values(map).sort((a, b) => a.testnr.localeCompare(b.testnr));

  if (newScanList.length > 0) {
    console.log('Llamando a checkExistingTests...');
    try {
      const existingTests = await checkExistingTests(newScanList.map(item => item.testnr));
      console.log('existingTests recibido:', existingTests);
      console.log('Tipo de existingTests:', typeof existingTests, Array.isArray(existingTests));

      const existingSet = new Set(existingTests);
      console.log('existingSet creado:', existingSet);

      // **LA CORRECCIÓN ESTÁ AQUÍ**
      // Creamos un array completamente nuevo usando .map() para asegurar la reactividad
      newScanList = newScanList.map(item => {
        const isInDb = existingSet.has(item.testnr);
        console.log(`Verificando ${item.testnr}: existingSet.has() = ${isInDb}`);
        return {
          ...item, // Copiamos todas las propiedades existentes del item
          imp: isInDb // Sobrescribimos 'imp' con el valor correcto
        };
      });

      console.log('checkExistingTests completado. Lista para actualizar el DOM:', newScanList);
    } catch (err) {
      console.error('Fallo en la llamada a checkExistingTests desde scanDirectory', err);
    }
  }

  scanList.value = newScanList;
  // Forzar a Vue a esperar la actualización del DOM antes de continuar
  await nextTick();
  console.log('scanList.value ha sido asignado y el DOM actualizado.', scanList.value);
  console.log('Verificación de valores imp:', scanList.value.map(item => ({ testnr: item.testnr, imp: item.imp })));

  selectedFolderName.value = dirHandle.name || 'Carpeta seleccionada';
  const count = scanList.value.length;
  scanStatus.value = count ? (`Encontrados ${count} ensayos`) : 'No se encontraron archivos .PAR/.TBL válidos en la carpeta seleccionada';
}


async function checkExistingTests(testnrs) {
  if (!testnrs || testnrs.length === 0) {
    console.log('checkExistingTests: No hay testnrs para verificar.');
    return [];
  }
  console.log('checkExistingTests: Verificando los siguientes testnrs:', testnrs);
  try {
    const endpoint = '/api/uster/status';
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testnrs }),
      credentials: 'include'
    });

    if (!resp.ok) {
      console.error('checkExistingTests: La respuesta del servidor no fue OK.', resp.status, resp.statusText);
      const errorText = await resp.text();
      console.error('checkExistingTests: Respuesta de error del servidor:', errorText);
      return [];
    }

    const data = await resp.json();
    console.log('checkExistingTests: Datos recibidos del servidor:', data);

    if (data && Array.isArray(data.existing)) {
      return data.existing;
    }
    return [];
  } catch (err) {
    console.error('Error en checkExistingTests:', err);
    // Devuelve un array vacío en caso de error para no romper el flujo
    return [];
  }
}

// no snapshot persistence function: we persist only the DirectoryHandle in IDB

async function onFolderInputChange(e) {
  try {
    const files = (e && e.target && e.target.files) || []
    const map = {}
    for (let i = 0; i < files.length; i++) {
      const f = files[i]
      const name = f.name || ''
      const ln = name.toLowerCase()
      if (!(ln.endsWith('.par') || ln.endsWith('.tbl'))) continue
      const t = getTestnrFromName(name)
      if (!t) continue
      if (!map[t]) map[t] = { testnr: t, hasPar: false, hasTbl: false, parHandle: null, tblHandle: null, imp: null, nomcount: null, maschnr: null }
      if (ln.endsWith('.par')) {
        map[t].hasPar = true
        map[t].parHandle = f
        try {
          const txt = await f.text()
          map[t].nomcount = extractTsvCell(txt, 15, 5) || ''
          map[t].maschnr = extractTsvCell(txt, 13, 5) || ''
          map[t].matclass = extractTsvCell(txt, 14, 8) || ''
        } catch (err) { console.warn('reading .PAR fallback', name, err) }
      }
      if (ln.endsWith('.tbl')) {
        map[t].hasTbl = true
        map[t].tblHandle = f
      }
    }
    scanList.value = Object.values(map).sort((a, b) => a.testnr.localeCompare(b.testnr))
    selectedFolderName.value = 'Carpeta seleccionada (local)'
    scanStatus.value = scanList.value.length ? (`Encontrados ${scanList.value.length} ensayos (fallback)`) : 'No se encontraron archivos .PAR/.TBL en la selección local'
    // After scanning, check which ones are already in the DB
    if (scanList.value.length > 0) {
      await checkExistingTests(scanList.value.map(item => item.testnr))
    }
    // derive a best-effort folder path from the first file's webkitRelativePath
    if (files.length > 0 && files[0].webkitRelativePath) {
      const rel = files[0].webkitRelativePath
      const parts = rel.split('/')
      if (parts.length > 1) folderPath.value = parts.slice(0, parts.length - 1).join('/')
    }
    hasPersistedHandle.value = false
    // when using fallback, set folderPathFull to the derived relative path
    folderPathFull.value = folderPath.value || ''
    isAbsolutePath.value = false
  } catch (err) { console.warn('onFolderInputChange error', err) }
}

onMounted(() => {
  // colocar el título en la pestaña del navegador
  if (typeof window !== 'undefined' && typeof window.document !== 'undefined') window.document.title = 'Uster';
  (async () => {
    try {
      // try to load persisted DirectoryHandle from IDB and re-scan if permission
      let dirHandle = null
      try { dirHandle = await getDirHandleFromIDB() } catch { /* ignore */ }
      if (dirHandle) {
        const ok = await verifyPermission(dirHandle, 'read')
        if (ok) {
          try {
            await scanDirectory(dirHandle)
          } catch (err) { console.warn('scanDirectory onMounted error', err) }
          hasPersistedHandle.value = true
          // folderPathFull: cannot expose absolute path; use handle.name as best-effort
          folderPathFull.value = dirHandle.name || ''
          isAbsolutePath.value = false
          return
        }
        // have handle but no permission: prompt user to re-select so browser can grant permissions
        selectedFolderName.value = dirHandle.name || 'Carpeta (sin permisos)'
        try {
          const r = await Swal.fire({
            icon: 'warning',
            title: 'Permisos requeridos',
            text: 'La carpeta guardada no tiene permisos de lectura. Selecciona la carpeta nuevamente para reautorizar el acceso.',
            confirmButtonText: 'Seleccionar carpeta',
            showCancelButton: true,
            cancelButtonText: 'Cancelar'
          })
          if (r.isConfirmed) await selectFolder()
        } catch (err) { console.warn('Swal error', err) }
        return
      }
    } catch (err) { console.warn('onMounted load snapshot error', err) }
  })()
})

// Función para limpiar la selección actual (deseleccionar ensayo y limpiar datos)
function clearSelection() {
  selectedTestnr.value = ''
  fileText.value = ''
  selectedName.value = ''
  selectedFile.value = null
  selectedTblName.value = ''
  tblFile.value = null
  tblText.value = ''
  tblData.value = []
  tblTestnr.value = ''
  estiraje.value = ''
  pasador.value = ''
  matclass.value = 'Hilo'
  isFocusedIndex.value = null
}

async function selectRow(testnr) {
  // Select the TESTNR and load associated files (PAR/TBL) so preview and Save are available.
  selectedTestnr.value = testnr
  
  // Cargar ESTIRAJE y MATCLASS desde scanList si existen
  const item = scanList.value.find(x => x.testnr === testnr)
  if (item && item.estiraje) {
    estiraje.value = item.estiraje
  } else {
    estiraje.value = ''
  }
  if (item && item.pasador) {
    pasador.value = item.pasador
  } else {
    pasador.value = ''
  }
  
  try {
    await loadSelectedFiles()
    
    // NO limpiar los campos TITULO si vienen del archivo TBL
    // El archivo TBL ya fue guardado con los valores de Titulo editados
    // Solo debemos limpiarlos si el archivo NO tiene datos
    // (esto se maneja automáticamente porque parseTblText preserva los valores)
    
    // Solo restaurar matclass desde scanList si fue cambiado manualmente a "Hilo de fantasia"
    // No restaurar si es "Hilo" porque detectFlameInObs() puede haberlo detectado automáticamente
    const savedMatclass = item && item.matclass
    if (savedMatclass && savedMatclass === 'Hilo de fantasia') {
      matclass.value = savedMatclass
    }
    // Si matclass en scanList es "Hilo", dejamos que detectFlameInObs() determine el valor correcto
  } catch (err) { console.warn('selectRow loadSelectedFiles failed', err) }

  // After files are loaded and DOM updated, focus the ESTIRAJE input first for editing.
  try {
    await nextTick()
    
    // Primero intentar enfocar el campo ESTIRAJE
    if (estirajeInput.value) {
      try {
        estirajeInput.value.focus()
        if (typeof estirajeInput.value.select === 'function') estirajeInput.value.select()
        return
      } catch (err) {
        console.warn('Could not focus estiraje input', err)
      }
    }
    
    // Fallback: Look for inputs with id prefix 'titulo-input-' (guard against SSR/environment without document)
    let inputs = []
    if (typeof globalThis !== 'undefined' && globalThis.document && globalThis.document.querySelectorAll) {
      inputs = Array.from(globalThis.document.querySelectorAll('input[id^="titulo-input-"]'))
        .filter(i => !i.disabled && i.offsetParent !== null)
    }

    if (inputs.length > 0) {
      const first = inputs[0]
      try {
        // Determine srcIndex from element id (format: titulo-input-<index>) and mark focused index for styling
        const m = String(first.id || '').match(/titulo-input-(\d+)/)
        if (m) {
          const idx = Number(m[1])
          isFocusedIndex.value = idx
        }
        // Ensure it's scrolled into view and focused
        if (typeof first.scrollIntoView === 'function') first.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        first.focus()
        if (typeof first.select === 'function') first.select()
      } catch { /* noop */ }
      return
    }

    // Fallback final: focus the save button if present
    if (saveButton && saveButton.value) {
      try { saveButton.value.focus() } catch { /* noop */ }
    }
  } catch (err) {
    console.warn('selectRow focus error', err)
  }
}


// TBL file (new)
const tblData = ref([]) // array of parsed rows
const tblTestnr = ref('')

// permitir 1-2 dígitos en la parte entera y hasta 2 decimales (ej. 1.25 .. 99.99)
const tituloMaskRe = /^\d{1,2}(?:\.\d{1,2})?$/
const tituloIntegerRe = /^\d{1,2}$/

// index of the input currently focused (for styling)
const isFocusedIndex = ref(null)


// Display list for scan (left table) that always shows up to maxRows placeholders
const scanDisplayList = computed(() => {
  const maxRows = 10;
  let items = [];

  // Clonamos cada item para asegurar que Vue detecte cualquier cambio en sus propiedades
  if (Array.isArray(scanList.value)) {
    items = scanList.value.map(item => ({ ...item }));
  }

  // Aplicar filtros según los checkboxes seleccionados
  if (filterShowAll.value) {
    // Mostrar todos, no filtrar
  } else if (filterShowNotSaved.value) {
    // Mostrar solo los no guardados (imp !== true)
    items = items.filter(item => item.testnr && item.imp !== true);
  } else if (filterShowSaved.value) {
    // Mostrar solo los guardados (imp === true)
    items = items.filter(item => item.testnr && item.imp === true);
  }

  // Si la lista es más grande que maxRows, la mostramos completa y el scroll se activará.
  if (items.length >= maxRows) {
    return items;
  }

  // Si la lista es más pequeña, la rellenamos con placeholders hasta llegar a maxRows.
  const placeholder = { testnr: '', hasPar: false, hasTbl: false, imp: null, nomcount: '', maschnr: '' };
  while (items.length < maxRows) {
    items.push(placeholder);
  }

  return items;
});

// Computed para mostrar el estado de la lista según el filtro activo
const scanStatusDisplay = computed(() => {
  if (!scanStatus.value) return '';

  // Si no hay escaneo realizado, mostrar el mensaje original
  if (!scanList.value.length) return scanStatus.value;

  const total = scanList.value.length;

  if (filterShowAll.value) {
    return `Encontrados ${total} ensayos (mostrando todos)`;
  } else if (filterShowNotSaved.value) {
    const notSaved = scanList.value.filter(item => item.testnr && item.imp !== true).length;
    return `Encontrados ${total} ensayos (${notSaved} no guardados)`;
  } else if (filterShowSaved.value) {
    const saved = scanList.value.filter(item => item.testnr && item.imp === true).length;
    return `Encontrados ${total} ensayos (${saved} guardados)`;
  }

  return scanStatus.value;
});

// columns to display (based on mapping order)
const tblColumns = [
  'TESTNR', 'NO', 'U%_%', 'CVM_%', 'INDICE_%', 'CVM_1M_%', 'CVM_3M_%', 'CVM_10M_%', 'TITULO', 'TITULO_REL_±_%', 'H', 'SH', 'SH_1M', 'SH_3M', 'SH_10M', 'DELG_-30%_KM', 'DELG_-40%_KM', 'DELG_-50%_KM', 'DELG_-60%_KM', 'GRUE_35%_KM', 'GRUE_50%_KM', 'GRUE_70%_KM', 'GRUE_100%_KM', 'NEPS_140%_KM', 'NEPS_200%_KM', 'NEPS_280%_KM', 'NEPS_400%_KM'
]

// mapping of field names to column index (1-based) and notes
const tblFields = [
  { name: 'TESTNR', col: null, note: 'Extraer del nombre de archivo: caracteres 7..11' },
  { name: 'NO', col: 1 },
  { name: 'U%_%', col: 2 },
  { name: 'CVM_%', col: 3 },
  { name: 'INDICE_%', col: 4 },
  { name: 'CVM_1M_%', col: 5 },
  { name: 'CVM_3M_%', col: 6 },
  { name: 'CVM_10M_%', col: 7 },
  { name: 'TITULO', col: 9 },
  { name: 'TITULO_REL_±_%', col: 10 },
  { name: 'H', col: 11 },
  { name: 'SH', col: 12 },
  { name: 'SH_1M', col: 13 },
  { name: 'SH_3M', col: 14 },
  { name: 'SH_10M', col: 15 },
  { name: 'DELG_-30%_KM', col: 17 },
  { name: 'DELG_-40%_KM', col: 18 },
  { name: 'DELG_-50%_KM', col: 19 },
  { name: 'DELG_-60%_KM', col: 20 },
  { name: 'GRUE_35%_KM', col: 21 },
  { name: 'GRUE_50%_KM', col: 22 },
  { name: 'GRUE_70%_KM', col: 23 },
  { name: 'GRUE_100%_KM', col: 24 },
  { name: 'NEPS_140%_KM', col: 25 },
  { name: 'NEPS_200%_KM', col: 26 },
  { name: 'NEPS_280%_KM', col: 27 },
  { name: 'NEPS_400%_KM', col: 28 }
]


// --- File reading helpers (restore removed helpers) ---
const selectedName = ref('')
const selectedFile = ref(null)
const selectedTblName = ref('')
const tblFile = ref(null)
const tblText = ref('')

async function readFileFromHandle(h) {
  if (!h) return ''
  try {
    // If it's already a File-like object
    if (typeof h.text === 'function') {
      return await h.text()
    }
    // If it's a FileSystemFileHandle
    if (typeof h.getFile === 'function') {
      const f = await h.getFile()
      return await f.text()
    }
    return ''
  } catch (err) {
    console.warn('readFileFromHandle error', err)
    return ''
  }
}

async function setFile(h, name) {
  try {
    selectedFile.value = h
    selectedName.value = name || (h && h.name) || ''
    const txt = await readFileFromHandle(h)
    fileText.value = txt || ''
    
    // Auto-detectar "Flame" en OBS y ajustar MATCLASS
    await detectFlameInObs()
  } catch (err) { console.warn('setFile error', err) }
}

// Detectar "Flame" en OBS y ajustar MATCLASS automáticamente
async function detectFlameInObs() {
  try {
    // Esperar a que Vue actualice el DOM y los valores computados
    await nextTick()
    
    // Cargar el valor actual de MATCLASS del archivo PAR
    const matclassFromFile = getFieldValueByCode('MATCLASS')
    matclass.value = matclassFromFile || 'Hilo'
    
    // Obtener el valor de OBS
    const obs = getFieldValueByCode('OBS')
    
    // Si OBS contiene "flame" (case-insensitive), cambiar a "Hilo de fantasia"
    if (obs && String(obs).toLowerCase().includes('flame')) {
      matclass.value = 'Hilo de fantasia'
      console.log('🔥 Flame detectado en OBS, cambiando a "Hilo de fantasia"')
    } else {
      console.log('📝 OBS:', obs, '- MATCLASS:', matclass.value)
    }
  } catch (err) {
    console.warn('detectFlameInObs error', err)
  }
}

async function setTblFile(h, name) {
  try {
    tblFile.value = h
    selectedTblName.value = name || (h && h.name) || ''
    tblText.value = await readFileFromHandle(h)
    await parseTblText(tblText.value)
  } catch (err) { console.warn('setTblFile error', err) }
}

async function parseTblText(text) {
  try {
    if (!text) {
      tblData.value = []
      tblTestnr.value = ''
      return
    }
    // split keeping empty lines so we can stop at the first empty row
    const rawLines = text.split(/\r?\n/)
    const out = []

    // Per spec: data rows start at line 6 (1-based). That means index 5 in 0-based array.
    for (let i = 5; i < rawLines.length; i++) {
      const line = rawLines[i]
      if (line == null) break
      // stop at first empty line (only whitespace)
      if (String(line).trim() === '') break

      const cols = String(line).split('\t')
      const obj = {}

      // Always set TESTNR from the currently selected TESTNR (TBL files don't include TESTNR column)
      obj['TESTNR'] = selectedTestnr.value ? String(selectedTestnr.value) : ''

      // Mapear cada campo usando tblFields (que define el índice correcto de columna)
      // Esto permite omitir columnas 8 y 16 correctamente
      for (const field of tblFields) {
        if (field.col === null) continue // Skip TESTNR (ya lo asignamos arriba)

        // col es 1-based, pero el array cols es 0-based
        const colIndex = field.col - 1
        obj[field.name] = (cols[colIndex] != null) ? String(cols[colIndex]).trim() : ''
      }

      // ensure SEQNO is sequential starting at 1
      obj['SEQNO'] = out.length + 1
      out.push(obj)
    }

    tblData.value = out
    if (out.length > 0) tblTestnr.value = selectedTestnr.value || ''
    else tblTestnr.value = ''
  } catch (err) {
    console.warn('parseTblText error', err)
    tblData.value = []
    tblTestnr.value = ''
  }
}

async function loadSelectedFiles() {
  try {
    if (!selectedTestnr.value) return
    const it = scanList.value.find(x => String(x.testnr) === String(selectedTestnr.value))
    if (!it) return
    // load PAR if available
    if (it.parHandle) {
      await setFile(it.parHandle, it.parHandle.name || ('PAR_' + it.testnr))
    } else {
      fileText.value = ''
      selectedName.value = ''
      selectedFile.value = null
    }
    // load TBL if available
    if (it.tblHandle) {
      await setTblFile(it.tblHandle, it.tblHandle.name || ('TBL_' + it.testnr))
    } else {
      tblData.value = []
      tblTestnr.value = ''
      selectedTblName.value = ''
      tblFile.value = null
    }
  } catch (err) { console.warn('loadSelectedFiles error', err) }
}

async function updateTblFileWithTitulos() {
  try {
    // Encontrar el handle del archivo .TBL actual
    const it = scanList.value.find(x => String(x.testnr) === String(selectedTestnr.value))
    // Preferir el handle encontrado en la lista mapeada; si no existe, usar el handle actualmente cargado (tblFile)
    const handle = (it && it.tblHandle) || tblFile.value || null
    if (!handle) {
      console.warn('No se encontró ningún handle para el archivo .TBL (ni en scanList ni en tblFile)')
      return false
    }

    // Verificar si es un FileSystemFileHandle con capacidad de escritura (createWritable)
    if (typeof handle.createWritable !== 'function') {
      console.warn('El archivo .TBL no soporta escritura (modo fallback). handle:', handle)
      try {
        // Mostrar al usuario un aviso para re-seleccionar la carpeta si quiere guardar cambios en disco
        await Swal.fire({
          icon: 'info',
          title: 'No es posible guardar aquí',
          text: 'El archivo fue abierto mediante selección de archivos y no permite escribir de vuelta. Selecciona la carpeta usando "Seleccionar carpeta" para habilitar guardado.',
          confirmButtonText: 'Seleccionar carpeta'
        })
      } catch { /* noop */ }
      return false
    }

    // Leer el contenido actual del archivo
    const currentText = tblText.value
    if (!currentText) {
      console.warn('No hay contenido del archivo .TBL para actualizar')
      return false
    }

    // Dividir en líneas preservando los saltos de línea originales
    const lines = currentText.split(/\r?\n/)
    const lineEnding = currentText.includes('\r\n') ? '\r\n' : '\n'

    // Actualizar las líneas de datos (empiezan en índice 5, línea 6 en 1-based)
    for (let i = 0; i < tblData.value.length; i++) {
      const row = tblData.value[i]
      const lineIndex = 5 + i // Las filas de datos empiezan en la línea 6 (índice 5)

      if (lineIndex >= lines.length) break

      const titulo = row['TITULO'] || ''
      if (titulo === '') continue // Si no hay título, no modificar

      // Formatear el título a 6 caracteres (con espacios si es necesario)
      // El formato es ##.## pero necesitamos asegurar 6 caracteres de ancho
      let formattedTitulo = String(titulo).padStart(6, ' ')
      if (formattedTitulo.length > 6) formattedTitulo = formattedTitulo.slice(0, 6)

      // Obtener la línea actual y dividirla por tabuladores
      const currentLine = lines[lineIndex]
      const cols = currentLine.split('\t')

      // La columna 9 (1-based) es el índice 8 (0-based)
      // Reemplazar solo esa columna
      if (cols.length > 8) {
        cols[8] = formattedTitulo
        lines[lineIndex] = cols.join('\t')
      }
    }

    // Reconstruir el contenido completo del archivo
    const newContent = lines.join(lineEnding)

    // Escribir de vuelta al archivo usando File System Access API
    const writable = await handle.createWritable()
    await writable.write(newContent)
    await writable.close()

    console.log('Archivo .TBL actualizado exitosamente con los valores de Titulo')
    return true
  } catch (err) {
    console.error('Error al actualizar el archivo .TBL:', err)
    return false
  }
}

/* parseTblText restored */

// computed list mapping NO -> Nro and TITULO -> Titulo for the selected TESTNR
// Always return exactly `maxRows` entries: real rows (with srcIndex) first, then placeholders
const tituloList = computed(() => {
  const out = []
  const maxRows = 10
  if (!tblData.value || !Array.isArray(tblData.value) || !selectedTestnr.value) {
    // return placeholders when no data/selection
    for (let i = 0; i < maxRows; i++) out.push({ nro: '', titulo: '', srcIndex: null })
    return out
  }

  // collect rows that match the selected TESTNR
  const matched = []
  for (let i = 0; i < tblData.value.length; i++) {
    const r = tblData.value[i]
    if ((r && (r['TESTNR'] || '')) === String(selectedTestnr.value)) {
      matched.push({ nro: r['NO'] || '', titulo: r['TITULO'] || '', srcIndex: i })
    }
  }

  // If there are more than maxRows, return them all (we'll allow scrolling).
  if (matched.length > maxRows) return matched

  // otherwise push the actual rows and pad with placeholders up to maxRows
  for (let i = 0; i < matched.length; i++) out.push(matched[i])
  while (out.length < maxRows) out.push({ nro: '', titulo: '', srcIndex: null })
  return out
})

// per-column widths for the imported TBL table
const indexColWidth = 25
const defaultTblColWidth = 80
// override widths for specific columns (name -> px)
const tblColWidthMap = {
  // reduce TESTNR width 20% (defaultTblColWidth * 0.8)
  TESTNR: Math.round(defaultTblColWidth * 0.8),
  // reduce NO width to 50% of default
  NO: Math.round(defaultTblColWidth * 0.5),
  // reduce U%_% width by 40% (keep 60% of default)
  'U%_%': Math.round(defaultTblColWidth * 0.6),
  // reduce CVM_% width by 40% (keep 60% of default)
  'CVM_%': Math.round(defaultTblColWidth * 0.6)
  ,
  // reduce TITULO width by 30% (keep 70% of default)
  'TITULO': Math.round(defaultTblColWidth * 0.7)
  ,
  // reduce INDICE_% width by 30% (keep 70% of default)
  'INDICE_%': Math.round(defaultTblColWidth * 0.7),
  // reduce H/SH related columns to 50% of default
  H: Math.round(defaultTblColWidth * 0.5),
  SH: Math.round(defaultTblColWidth * 0.5),
  SH_1M: Math.round(defaultTblColWidth * 0.5),
  SH_3M: Math.round(defaultTblColWidth * 0.5),
  SH_10M: Math.round(defaultTblColWidth * 0.5)
}
const getColWidth = (name) => tblColWidthMap[name] || defaultTblColWidth
const tblMinWidth = computed(() => {
  // include index column + all tblColumns
  return indexColWidth + tblColumns.reduce((s, c) => s + getColWidth(c), 0)
})

// rows from tblData that correspond to the currently selected TESTNR
const currentTblRows = computed(() => {
  if (!selectedTestnr.value || !Array.isArray(tblData.value)) return []
  return tblData.value.filter(r => String(r['TESTNR'] || '') === String(selectedTestnr.value))
})

// whether we can save: need a selected TESTNR and at least one row or a parsed .PAR preview
const canSave = computed(() => {
  return (selectedTestnr.value && (currentTblRows.value.length > 0 || fileText.value))
})
const isSaving = ref(false)
const isDeleting = ref(false)

// Computed para saber si el ensayo actual está guardado en Oracle
const isTestSaved = computed(() => {
  if (!selectedTestnr.value) return false
  const item = scanList.value.find(x => x.testnr === selectedTestnr.value)
  return item && item.imp === true
})

function buildParObject() {
  // Build par object from oracleFields (prefer fileText; fallback to scanList values)
  const par = {}
  for (const f of oracleFields) {
    const key = f.field
    const val = getFieldValueByCode(key)
    if (val !== '') par[key] = val
  }
  // ensure TESTNR present
  if (!par.TESTNR) par.TESTNR = selectedTestnr.value || ''
  // include ESTIRAJE from manual input
  if (estiraje.value) par.ESTIRAJE = estiraje.value
  // include PASADOR from radio button selection
  if (pasador.value) par.PASADOR = pasador.value
  // include MATCLASS from manual selection (override PAR file value)
  if (matclass.value) par.MATCLASS = matclass.value
  return par
}

/* async function saveCurrentTest() {
  if (!canSave.value) return
  const par = buildParObject()
  const tblRows = currentTblRows.value.map((r, idx) => ({
    SEQNO: r.SEQNO != null ? Number(r.SEQNO) : (idx + 1),
    NO: r['NO'] != null ? (isNaN(Number(r['NO'])) ? null : Number(r['NO'])) : null,
    TIEMPO_ROTURA: r['TIEMPO_ROTURA'] != null ? (isNaN(Number(r['TIEMPO_ROTURA'])) ? null : Number(r['TIEMPO_ROTURA'])) : null,
    FUERZA_B: r['FUERZA_B'] != null ? (isNaN(Number(r['FUERZA_B'])) ? null : Number(r['FUERZA_B'])) : null,
    ELONGACION: r['ELONGACION'] != null ? (isNaN(Number(r['ELONGACION'])) ? null : Number(r['ELONGACION'])) : null,
    TENACIDAD: r['TENACIDAD'] != null ? (isNaN(Number(r['TENACIDAD'])) ? null : Number(r['TENACIDAD'])) : null,
    TRABAJO: r['TRABAJO'] != null ? (isNaN(Number(r['TRABAJO'])) ? null : Number(r['TRABAJO'])) : null
  })) */
async function saveCurrentTest() {
  if (!canSave.value) return
  const par = buildParObject()

  const tblRows = currentTblRows.value.map((r, idx) => ({
    SEQNO: r.SEQNO != null ? Number(r.SEQNO) : (idx + 1),
    NO: r['NO'] != null ? (isNaN(Number(r['NO'])) ? null : Number(r['NO'])) : null,
    'U%_%': r['U%_%'] != null ? r['U%_%'] : '',
    'CVM_%': r['CVM_%'] != null ? r['CVM_%'] : '',
    'INDICE_%': r['INDICE_%'] != null ? r['INDICE_%'] : '',
    'CVM_1M_%': r['CVM_1M_%'] != null ? r['CVM_1M_%'] : '',
    'CVM_3M_%': r['CVM_3M_%'] != null ? r['CVM_3M_%'] : '',
    'CVM_10M_%': r['CVM_10M_%'] != null ? r['CVM_10M_%'] : '',
    TITULO: r['TITULO'] != null ? r['TITULO'] : '',
    'TITULO_REL_±_%': r['TITULO_REL_±_%'] != null ? r['TITULO_REL_±_%'] : '',
    H: r['H'] != null ? r['H'] : '',
    SH: r['SH'] != null ? r['SH'] : '',
    SH_1M: r['SH_1M'] != null ? r['SH_1M'] : '',
    SH_3M: r['SH_3M'] != null ? r['SH_3M'] : '',
    SH_10M: r['SH_10M'] != null ? r['SH_10M'] : '',
    'DELG_-30%_KM': r['DELG_-30%_KM'] != null ? r['DELG_-30%_KM'] : '',
    'DELG_-40%_KM': r['DELG_-40%_KM'] != null ? r['DELG_-40%_KM'] : '',
    'DELG_-50%_KM': r['DELG_-50%_KM'] != null ? r['DELG_-50%_KM'] : '',
    'DELG_-60%_KM': r['DELG_-60%_KM'] != null ? r['DELG_-60%_KM'] : '',
    'GRUE_35%_KM': r['GRUE_35%_KM'] != null ? r['GRUE_35%_KM'] : '',
    'GRUE_50%_KM': r['GRUE_50%_KM'] != null ? r['GRUE_50%_KM'] : '',
    'GRUE_70%_KM': r['GRUE_70%_KM'] != null ? r['GRUE_70%_KM'] : '',
    'GRUE_100%_KM': r['GRUE_100%_KM'] != null ? r['GRUE_100%_KM'] : '',
    'NEPS_140%_KM': r['NEPS_140%_KM'] != null ? r['NEPS_140%_KM'] : '',
    'NEPS_200%_KM': r['NEPS_200%_KM'] != null ? r['NEPS_200%_KM'] : '',
    'NEPS_280%_KM': r['NEPS_280%_KM'] != null ? r['NEPS_280%_KM'] : '',
    'NEPS_400%_KM': r['NEPS_400%_KM'] != null ? r['NEPS_400%_KM'] : ''
  }))

  if (isSaving.value) return
  isSaving.value = true
  try {
    // Toast no bloqueante mientras se guarda
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Guardando...',
      showConfirmButton: false,
      timer: 30000,
      timerProgressBar: true
    })

    const endpoint = '/api/uster/upload'

    const fetchWithTimeout = (url, opts = {}, timeout = 30000) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout contacting server')), timeout)
        fetch(url, opts).then(r => { clearTimeout(timer); resolve(r) }).catch(e => { clearTimeout(timer); reject(e) })
      })
    }

    const resp = await fetchWithTimeout(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ par, tbl: tblRows }),
      credentials: 'include'
    }, 30000)

    let data = null
    try { data = await resp.json() } catch { data = null }
    if (!resp.ok) throw new Error(data && data.error ? data.error : (data && data.message) || `HTTP ${resp.status}`)

    // Actualizar el archivo .TBL con los valores de Titulo editados ANTES de hacer cualquier otra cosa
    // Esto es CRÍTICO: debe ejecutarse antes de marcar imp=true y antes de limpiar cualquier dato
    try {
      const tblUpdated = await updateTblFileWithTitulos()
      if (tblUpdated) {
        console.log('Archivo .TBL actualizado con éxito')
      }
    } catch (err) {
      console.warn('No se pudo actualizar el archivo .TBL (esto es normal en modo fallback):', err)
    }

    const savedItem = scanList.value.find(item => item.testnr === par.TESTNR)
    if (savedItem) {
      savedItem.imp = true
      // Guardar valores de ESTIRAJE y MATCLASS en scanList para persistencia local
      if (estiraje.value) {
        savedItem.estiraje = estiraje.value
      }
      if (pasador.value) {
        savedItem.pasador = pasador.value
      }
      if (matclass.value) {
        savedItem.matclass = matclass.value
      }
      // Forzar a Vue a esperar la actualización del DOM
      await nextTick();
    }

    // Limpia los inputs de TITULO correspondientes al TESTNR guardado
    try {
      for (let i = 0; i < tblData.value.length; i++) {
        const r = tblData.value[i]
        if (r && String(r['TESTNR']) === String(par.TESTNR)) {
          // limpiar el campo TITULO para que el input quede vacío tras guardar
          r['TITULO'] = ''
        }
      }
    } catch { /* noop */ }

    // Seleccionar y activar el siguiente ensayo.
    // Si el filtro está en 'No guardados', elegimos el primer ensayo no guardado.
    // En otro caso, elegimos el siguiente ensayo en la lista (rotando si es necesario).
    try {
      let nextTestnr = null
      const list = Array.isArray(scanList.value) ? scanList.value : []
      
      // Encontrar el índice del ensayo actual
      const currentIdx = list.findIndex(i => String(i.testnr) === String(par.TESTNR))
      
      if (currentIdx !== -1) {
        // Buscar hacia adelante desde la posición actual
        for (let j = currentIdx + 1; j < list.length; j++) {
          const item = list[j]
          if (!item || !item.testnr) continue
          
          // Verificar si cumple con el filtro actual
          if (filterShowNotSaved.value) {
            // Si filtramos no guardados, buscamos el siguiente que NO esté guardado
            if (item.imp !== true) {
              nextTestnr = item.testnr
              break
            }
          } else if (filterShowSaved.value) {
            // Si filtramos guardados, buscamos el siguiente que SI esté guardado
            if (item.imp === true) {
              nextTestnr = item.testnr
              break
            }
          } else {
            // Si mostramos todos, tomamos el siguiente
            nextTestnr = item.testnr
            break
          }
        }
      }

      if (nextTestnr) {
        // Limpiar todos los campos TITULO del ensayo actual antes de avanzar
        if (Array.isArray(tblData.value)) {
          for (const row of tblData.value) {
            if (row) row['TITULO'] = ''
          }
        }
        // Limpiar la selección anterior antes de cargar el siguiente
        clearSelection()
        await nextTick()
        // Esperar un tick para que el DOM esté estable y luego seleccionar
        await selectRow(nextTestnr)
        // after selectRow, focus will be placed on first titulo input
      } else {
        // No hay siguiente ensayo (ej. se guardó el último no-guardado y la lista filtrada quedó vacía)
        // Usar clearSelection() que ahora limpia TODAS las variables correctamente
        clearSelection()
        // Forzar actualización del DOM
        await nextTick()
        await nextTick()
        // Limpiar el input de carpeta
        if (folderInput.value) {
          folderInput.value.value = ''
        }
      }
    } catch (err) { console.warn('auto-advance after save failed', err) }

    // Toast de éxito que desaparece automáticamente
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Ensayo ${par.TESTNR} guardado`,
      text: `${data.inserted || tblRows.length} filas`,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (err) {
    console.error('saveCurrentTest error', err)
    // Para errores sí mostramos un modal (no toast) para que el usuario pueda leer el detalle
    try {
      await Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: String(err && err.message ? err.message : err),
        confirmButtonText: 'Cerrar'
      })
    } catch { /* ignore */ }
  } finally {
    isSaving.value = false
  }
}

async function deleteCurrentTest() {
  if (!selectedTestnr.value || !isTestSaved.value) return

  // Confirmar antes de eliminar
  const result = await Swal.fire({
    title: '¿Eliminar ensayo?',
    text: `¿Estás seguro de eliminar el ensayo ${selectedTestnr.value} de la base de datos?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#dc2626',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar'
  })

  if (!result.isConfirmed) return

  if (isDeleting.value) return
  isDeleting.value = true

  try {
    // Toast no bloqueante mientras se elimina
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'info',
      title: 'Eliminando...',
      showConfirmButton: false,
      timer: 30000,
      timerProgressBar: true
    })

    const endpoint = '/api/uster/delete'

    const fetchWithTimeout = (url, opts = {}, timeout = 30000) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout contacting server')), timeout)
        fetch(url, opts).then(r => { clearTimeout(timer); resolve(r) }).catch(e => { clearTimeout(timer); reject(e) })
      })
    }

    const resp = await fetchWithTimeout(endpoint, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testnr: selectedTestnr.value }),
      credentials: 'include'
    }, 30000)

    let data = null
    try { data = await resp.json() } catch { data = null }
    if (!resp.ok) throw new Error(data && data.error ? data.error : (data && data.message) || `HTTP ${resp.status}`)

    // Actualizar el estado en scanList: quitar el icono de guardado
    const deletedItem = scanList.value.find(item => item.testnr === selectedTestnr.value)
    if (deletedItem) {
      deletedItem.imp = false
      await nextTick()
    }

    // Toast de éxito
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: `Ensayo ${selectedTestnr.value} eliminado`,
      text: data.message || 'Eliminado correctamente',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (err) {
    console.error('deleteCurrentTest error', err)
    await Swal.fire({
      icon: 'error',
      title: 'Error al eliminar',
      text: String(err && err.message ? err.message : err),
      confirmButtonText: 'Cerrar'
    })
  } finally {
    isDeleting.value = false
  }
}

function onTituloFocus(srcIndex) {
  isFocusedIndex.value = srcIndex
}

function validateAndNormalizeTitulo(srcIndex) {
  const raw = (tblData.value && tblData.value[srcIndex] && String(tblData.value[srcIndex]['TITULO'] || '').trim()) || ''
  if (raw === '') return true

  // helper to clamp and format to 2 decimals
  // allow range 0.01 .. 99.99 per user request
  function clampAndFormat(n) {
    if (Number.isNaN(n)) return ''
    if (n < 0.01) n = 0.01
    if (n > 99.99) n = 99.99
    const s = Number(n).toFixed(2)
    const parts = String(s).split('.')
    parts[0] = parts[0].padStart(2, '0')
    return parts.join('.')
  }

  // if integer like '7' or '12' convert to '7.00' or '12.00'
  if (tituloIntegerRe.test(raw)) {
    const formatted = clampAndFormat(Number(raw))
    if (formatted !== '') {
      if (tblData.value && tblData.value[srcIndex]) tblData.value[srcIndex]['TITULO'] = formatted
      return true
    }
  }

  // allow up to two decimals: try parse and validate range
  if (tituloMaskRe.test(raw)) {
    const n = parseFloat(raw)
    const formatted = clampAndFormat(n)
    if (formatted !== '') {
      if (tblData.value && tblData.value[srcIndex]) tblData.value[srcIndex]['TITULO'] = formatted
      return true
    }
  }

  // sanitize fallback: keep up to 2 integer digits and up to 2 decimals
  let sanitized = raw.replace(/[^0-9.]/g, '')
  const parts = sanitized.split('.')
  if (parts.length === 1) sanitized = parts[0].slice(0, 2)
  else sanitized = parts[0].slice(0, 2) + '.' + (parts[1] || '').slice(0, 2)

  if (sanitized === '') {
    if (tblData.value && tblData.value[srcIndex]) tblData.value[srcIndex]['TITULO'] = ''
    return true
  }
  const n2 = parseFloat(sanitized)
  const formatted2 = clampAndFormat(n2)
  if (formatted2 !== '') {
    if (tblData.value && tblData.value[srcIndex]) tblData.value[srcIndex]['TITULO'] = formatted2
    return true
  }
  // fallback clear
  if (tblData.value && tblData.value[srcIndex]) tblData.value[srcIndex]['TITULO'] = ''
  return true
}

function onTituloBlur(srcIndex) {
  validateAndNormalizeTitulo(srcIndex)
  // remove focus marker
  if (isFocusedIndex.value === srcIndex) isFocusedIndex.value = null
}

function focusNextTitulo(srcIndex) {
  // validate current first (onTituloBlur will run after blur when focus moves)
  // find position of current in tituloList
  const list = tituloList.value || []
  const pos = list.findIndex(x => x.srcIndex === srcIndex)
  if (pos === -1) return

  // validate and normalize current before moving
  const ok = validateAndNormalizeTitulo(srcIndex)
  if (!ok) return

  // Buscar el siguiente input válido (con srcIndex !== null)
  let nextValidIndex = -1
  for (let i = pos + 1; i < list.length; i++) {
    if (list[i].srcIndex !== null) {
      nextValidIndex = i
      break
    }
  }

  if (nextValidIndex !== -1) {
    // Hay un siguiente input válido: enfocarlo
    const next = list[nextValidIndex]
    nextTick(() => {
      if (typeof window !== 'undefined' && window.document) {
        const el = window.document.getElementById('titulo-input-' + next.srcIndex)
        if (el) {
          el.focus()
          try { el.select && el.select() } catch (err) { console.warn('select error', err) }
        }
      }
    })
  } else {
    // No hay más inputs: saltar al botón Guardar si existe
    nextTick(() => {
      if (saveButton.value && canSave.value && !isSaving.value) {
        saveButton.value.focus()
      }
    })
  }
}

function focusNextTituloWrap(srcIndex) {
  const list = tituloList.value || []
  const pos = list.findIndex(x => x.srcIndex === srcIndex)
  if (pos === -1 || list.length === 0) return
  const ok = validateAndNormalizeTitulo(srcIndex)
  if (!ok) return

  // Buscar el siguiente input válido (con srcIndex !== null)
  let nextValidIndex = -1
  for (let i = pos + 1; i < list.length; i++) {
    if (list[i].srcIndex !== null) {
      nextValidIndex = i
      break
    }
  }

  if (nextValidIndex !== -1) {
    // Hay un siguiente input válido: enfocarlo
    const next = list[nextValidIndex]
    nextTick(() => {
      if (typeof window !== 'undefined' && window.document) {
        const el = window.document.getElementById('titulo-input-' + next.srcIndex)
        if (el) {
          el.focus()
          try { el.select && el.select() } catch (err) { console.warn('select error', err) }
        }
      }
    })
  } else {
    // No hay más inputs válidos: saltar al botón Guardar si existe
    nextTick(() => {
      if (saveButton.value && canSave.value && !isSaving.value) {
        saveButton.value.focus()
      }
    })
  }
}

function focusPrevTitulo(srcIndex) {
  const list = tituloList.value || []
  const pos = list.findIndex(x => x.srcIndex === srcIndex)
  if (pos === -1 || list.length === 0) return
  
  const ok = validateAndNormalizeTitulo(srcIndex)
  if (!ok) return
  
  // Si estamos en el primer titulo, ir a Pasador
  if (pos === 0) {
    nextTick(() => {
      // Ir al radio button que esté seleccionado, o Si por defecto
      if (pasador.value === 'No' && pasadorNoInput.value) {
        pasadorNoInput.value.focus()
      } else if (pasadorSiInput.value) {
        pasadorSiInput.value.focus()
      }
    })
    return
  }
  
  // Si no, ir al titulo anterior
  const prev = list[pos - 1]
  if (prev) {
    nextTick(() => {
      if (typeof window !== 'undefined' && window.document) {
        const el = window.document.getElementById('titulo-input-' + prev.srcIndex)
        if (el) {
          el.focus()
          try { el.select && el.select() } catch (err) { console.warn('select error', err) }
        }
      }
    })
  }
}

function focusLastTitulo() {
  // Cuando se presiona Up desde el botón Guardar, ir al último titulo
  const list = tituloList.value || []
  // Buscar el último input válido (con srcIndex !== null)
  let lastValidIndex = -1
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].srcIndex !== null) {
      lastValidIndex = i
      break
    }
  }

  if (lastValidIndex !== -1) {
    const last = list[lastValidIndex]
    nextTick(() => {
      if (typeof window !== 'undefined' && window.document) {
        const el = window.document.getElementById('titulo-input-' + last.srcIndex)
        if (el) {
          el.focus()
          try { el.select && el.select() } catch (err) { console.warn('select error', err) }
        }
      }
    })
  }
}

function focusFirstTitulo() {
  // Enfocar el primer input de titulo válido
  const list = tituloList.value || []
  const first = list.find(x => x.srcIndex !== null)
  if (first) {
    nextTick(() => {
      if (typeof window !== 'undefined' && window.document) {
        const el = window.document.getElementById('titulo-input-' + first.srcIndex)
        if (el) {
          el.focus()
          try { el.select && el.select() } catch (err) { console.warn('select error', err) }
        }
      }
    })
  }
}

// Función para enfocar el campo Pasador (radio button Si por defecto)
// Función para manejar input en el campo Estiraje
function handleEstirajeInput(event) {
  const input = event.target
  let value = input.value

  // Eliminar cualquier carácter que no sea dígito o punto
  value = value.replace(/[^0-9.]/g, '')

  // Permitir solo un punto y eliminar puntos duplicados
  const parts = value.split('.')
  if (parts.length > 2) {
    // Si hay más de un punto, mantener solo el primero
    value = parts[0] + '.' + parts.slice(1).join('')
  }

  // Limitar a 3 dígitos antes del punto y 1 después
  if (value.includes('.')) {
    const [integer, decimal] = value.split('.')
    value = integer.slice(0, 3) + '.' + (decimal || '').slice(0, 1)
  } else {
    value = value.slice(0, 3)
  }

  // Auto-insertar punto después de 3 dígitos si no hay punto
  if (!estirajeWasDeleting.value && value.length === 3 && !value.includes('.')) {
    value = value + '.'
  }

  // Actualizar el valor
  estiraje.value = value

  // Si el formato está completo (###.# o #.#, ##.#), saltar automáticamente
  if (/^\d{1,3}\.\d$/.test(value)) {
    focusPasadorAndSelectSi()
  }

  // Resetear el flag de borrado después de aplicar la máscara
  estirajeWasDeleting.value = false
}

// Función para manejar Enter en Estiraje
function handleEstirajeEnter() {
  // Si el usuario ingresó solo ###. (con punto pero sin decimal), completar a ###.0
  if (/^\d{3}\.$/.test(estiraje.value)) {
    estiraje.value = estiraje.value + '0'
  }
  focusPasadorAndSelectSi()
}

// Función para prevenir entrada de punto duplicado
function handleEstirajeKeydown(event) {
  // Marcar si el usuario está borrando para no reinsertar el punto automáticamente
  estirajeWasDeleting.value = event.key === 'Backspace' || event.key === 'Delete'

  // Si presiona punto y ya hay uno, prevenir
  if (event.key === '.' && estiraje.value.includes('.')) {
    event.preventDefault()
  }
}

// Función para enfocar Pasador y pre-seleccionar "Sí"
function focusPasadorAndSelectSi() {
  if (!selectedTestnr.value) return
  pasador.value = 'Si'
  nextTick(() => {
    if (pasadorSiInput.value) {
      pasadorSiInput.value.focus()
    }
  })
}

function focusPasador() {
  if (!selectedTestnr.value) return
  nextTick(() => {
    if (pasadorSiInput.value) {
      pasadorSiInput.value.focus()
    }
  })
}

// Función para manejar navegación con teclado en radio buttons de Pasador
function handlePasadorKeydown(event) {
  const key = event.key
  
  // Enter: confirmar selección y pasar a Titulos
  if (key === 'Enter') {
    event.preventDefault()
    focusFirstTitulo()
    return
  }
  
  // Flecha abajo: pasar a Titulos
  if (key === 'ArrowDown') {
    event.preventDefault()
    focusFirstTitulo()
    return
  }
  
  // Flecha arriba: volver a Estiraje
  if (key === 'ArrowUp') {
    event.preventDefault()
    if (estirajeInput.value) {
      estirajeInput.value.focus()
      try { estirajeInput.value.select && estirajeInput.value.select() } catch (err) { /* ignore */ }
    }
    return
  }
  
  // Flecha izquierda: seleccionar Si
  if (key === 'ArrowLeft') {
    event.preventDefault()
    pasador.value = 'Si'
    nextTick(() => {
      if (pasadorSiInput.value) pasadorSiInput.value.focus()
    })
    return
  }
  
  // Flecha derecha: seleccionar No
  if (key === 'ArrowRight') {
    event.preventDefault()
    pasador.value = 'No'
    nextTick(() => {
      if (pasadorNoInput.value) pasadorNoInput.value.focus()
    })
    return
  }
}

function extractTsvCell(text, rowIndex, colIndex) {
  if (text == null) return null
  const lines = text.split(/\r?\n/)
  if (lines.length < rowIndex) return null
  let row = lines[rowIndex - 1]
  if (row && row.charCodeAt(0) === 0xFEFF) row = row.slice(1)
  const cols = row.split('\t')
  if (colIndex - 1 >= cols.length) return null
  return cols[colIndex - 1]
}

function getCell(row, col) {
  if (!fileText.value) return ''
  const v = extractTsvCell(fileText.value, row, col)
  return v == null ? '' : v
}

// Oracle mapping: field -> row, col (1-based)
const oracleFields = [
  { field: 'CATALOG', row: 3, col: 1 },
  { field: 'TESTNR', row: 8, col: 5 },
  { field: 'TIME', row: 9, col: 5 },
  { field: 'LOTE', row: 10, col: 5 },
  { field: 'SORTIMENT', row: 11, col: 5 },
  { field: 'ARTICLE', row: 12, col: 5 },
  { field: 'MASCHNR', row: 13, col: 5 },
  { field: 'MATCLASS', row: 14, col: 8 },
  { field: 'NOMCOUNT', row: 15, col: 5 },
  { field: 'NOMTWIST', row: 16, col: 5 },
  { field: 'USCODE', row: 17, col: 8 },
  { field: 'FB_MIC', row: 18, col: 5 },
  { field: 'FB_TIPO', row: 18, col: 8 },
  { field: 'FB_LONG', row: 18, col: 9 },
  { field: 'FB_PORC', row: 18, col: 12 },
  { field: 'LABORANT', row: 21, col: 5 },
  { field: 'OBS', row: 22, col: 5 },
  { field: 'TUNAME', row: 27, col: 5 },
  { field: 'GROUPS', row: 28, col: 5 },
  { field: 'WITHIN', row: 29, col: 5 },
  { field: 'TOTAL', row: 30, col: 5 },
  { field: 'SPEED', row: 31, col: 5 },
  { field: 'TESTTIME', row: 32, col: 5 },
  { field: 'SLOT', row: 33, col: 5 },
  { field: 'ABSORBERPRESSURE', row: 34, col: 5 }
]

// compact fields to show as essential summary (label + code)
const compactFields = [
  { label: 'Nro Test', code: 'TESTNR' },
  { label: 'Hilo', code: 'NOMCOUNT' },
  { label: 'Tipo Material', code: 'MATCLASS' },
  { label: 'Maquina', code: 'MASCHNR' },
  { label: 'Lote', code: 'LOTE' },
  { label: 'Total Test', code: 'TOTAL' },
  { label: 'Fecha y Hora', code: 'TIME' },
  { label: 'Laboratorista', code: 'LABORANT' },
  { label: 'Observaciones', code: 'OBS' }
]

function getFieldValueByCode(code) {
  // prefer using the parsed fileText when available
  const def = oracleFields.find(x => x.field === code)
  if (def && fileText.value) {
    const v = getCell(def.row, def.col)
    if (v) {
      if (code === 'TIME') return formatTimestampToDatetime(v)
      return v
    }
  }
  // fallback to values gathered during scanning (scanList)
  const item = scanList.value.find(x => x.testnr === selectedTestnr.value)
  if (item) {
    if (code === 'NOMCOUNT') return item.nomcount || ''
    if (code === 'MASCHNR') return item.maschnr || ''
    if (code === 'TESTNR') return item.testnr || ''
    if (code === 'MATCLASS') return item.matclass || ''
  }
  // last resort: empty string
  return ''
}

function formatTimestampToDatetime(value) {
  if (value == null) return ''
  const s = String(value).trim()
  if (s === '') return ''
  // try numeric
  const n = Number(s)
  if (!Number.isFinite(n)) return s
  // assume seconds if plausible (< 1e12), otherwise milliseconds
  let ms = n
  if (Math.abs(n) < 1e12) ms = n * 1000
  const d = new Date(ms)
  if (isNaN(d.getTime())) return s
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yyyy = d.getFullYear()
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`
}
</script>

<style scoped>
.fixed-table {
  table-layout: fixed;
  width: 100%;
}

/* Use the UI font for tables in this component to match ResumenEnsayos.vue
   (overrides global monospace rules for .col-* through higher specificity) */
.fixed-table,
.compact-table,
.fixed-table th,
.fixed-table td,
.compact-table th,
.compact-table td {
  font-family: var(--ui-font) !important;
}

/* Table font is now provided globally in src/index.css */

.compact-table {
  table-layout: fixed;
  width: 100%;
}

/* Remove extra spacing from table borders so container height matches rows exactly */
.scan-table,
.titulo-table,
.compact-table {
  border-collapse: collapse;
  border-spacing: 0;
}

/* Remove bottom border on the last visible tbody row to avoid a small gap
   caused by borders/pixel rounding when the container height matches rows */
.scan-table tbody tr:last-child td,
.titulo-table tbody tr:last-child td,
.compact-table tbody tr:last-child td {
  border-bottom: none !important;
}

/* Unificar altura/padding de los encabezados en las tablas principales del componente
   para que "Ensayos encontrados", "Huso/Titulo" y "Dato/Valor" coincidan. */
.uster-component table thead th {
  /* altura consistente */
  padding-top: 0.45rem;
  padding-bottom: 0.45rem;
  min-height: var(--titulo-header-h, 2.5rem) !important;
  line-height: 1.1;
  vertical-align: middle;
}

/* Ensure headers specifically match the titulo header size */
.uster-component .scan-table thead th,
.uster-component .titulo-table thead th,
.uster-component .compact-table thead th {
  padding-top: 0.5rem !important;
  padding-bottom: 0.5rem !important;
  min-height: var(--titulo-header-h, 2.5rem) !important;
}

/* Anchos fijos para columnas */
.col-ensayo {
  /* Aumentado para dar más espacio a la columna "Ensayo" en la lista izquierda */
  width: 82px;
}

.col-par,
.col-tbl {
  width: 53px;
}

.col-imp {
  /* aumentamos ligeramente para recibir 10% del ancho de .col-ne */
  width: 65px;
}

.col-ne {
  /* reducido ~10% respecto al valor actual (54px -> ~49px) */
  width: 49px;
}

.col-maq {
  /* reducido ~5% (78px -> ~74px) */
  width: 74px;
}

/* Columnas tabla compacta */
.col-dato {
  /* Increased by ~15% to give more room to the 'Dato' column */
  width: 115px;
}

.col-valor {
  /* Reduced to compensate the increase on .col-dato so total width stays similar */
  width: 165px;
}

/* ensure table cells use border-box so widths include borders/padding */
table.text-sm,
table.text-sm th,
table.text-sm td,
table.text-xs,
table.text-xs th,
table.text-xs td {
  box-sizing: border-box;
  /* Use the UI font for table text to keep rows predictable */
  font-family: var(--ui-font);
}

/* Make sure scan-table cells have explicit, small vertical padding and constrained line-height
   so each row fits exactly in the computed --titulo-row-h value and the scroll container
   doesn't need to show a vertical scrollbar. */
.uster-component .scan-table tbody td,
.uster-component .scan-table tbody th {
  padding-top: 0.25rem !important;
  /* 4px */
  padding-bottom: 0.25rem !important;
  /* 4px */
  line-height: 1 !important;
  height: var(--titulo-row-h, 2rem) !important;
  vertical-align: middle !important;
  box-sizing: border-box !important;
  overflow: hidden;
}

/* Nro/Titulo small column: fixed visible area for 10 rows and sticky header */
.titulo-container {
  /* height = header + 10 rows. Use explicit height so it matches scan-container exactly */
  height: var(--titulo-total-h);
  overflow-y: auto;
  /* prevent horizontal scrollbar caused by small overflows */
  overflow-x: hidden;
}

/* Monospace for the imported TBL data table for better alignment of numeric columns */
.tbl-import-table,
.tbl-import-table th,
.tbl-import-table td {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Helvetica Neue', monospace;
}

/* Center headers and cells horizontally and vertically for imported TBL table */
.tbl-import-table th,
.tbl-import-table td {
  text-align: center;
  vertical-align: middle;
}

/* Make the imported-TBL table header sticky when its wrapper scrolls vertically. */
.tbl-import-table thead th {
  position: sticky;
  top: 0;
  z-index: 5;
  /* match the light header background used elsewhere */
  background: #f7fafc;
  /* subtle separator so header reads above rows */
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04);
}

/* Ensure titulo, scan and compact Dato/Valor tables share the same header sizing
   Use the --titulo-header-h variable so all header heights stay consistent across the component */
.titulo-table thead th,
.scan-table thead th,
.compact-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: inherit;
  /* spacing consistent with --titulo-header-h */
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  min-height: var(--titulo-header-h, 2.5rem);
  vertical-align: middle;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.03);
}

/* Add left indentation (sangría) to Dato/Valor headers and cells (only the small compact table) */
.compact-dato thead th,
.compact-dato tbody td {
  padding-left: 0.5rem;
}

/* Ensure the compact Dato/Valor table uses the same header height and padding */
.compact-table thead th {
  padding-top: 0.5rem;
  padding-bottom: 0.5rem;
  min-height: var(--titulo-header-h, 2.5rem);
  vertical-align: middle;
}

.titulo-table tbody tr {
  /* hint row height to keep 10 visible rows — unified with other tables */
  height: var(--titulo-row-h, 2rem) !important;
}

.titulo-table td input {
  /* Ajustar altura del input para el nuevo diseño con px-2 py-1.5 (0.5rem horizontal, 0.375rem vertical)
     Fila actual: 2rem (var(--titulo-row-h))
     Padding vertical del td: py-2 = 0.5rem arriba + 0.5rem abajo = 1rem
     Espacio disponible para input: 2rem - 1rem = 1rem
     Con py-1.5 del input (0.375rem × 2 = 0.75rem) + border (2px) + contenido (~0.875rem)
     Input debe ser: ~1.5rem máximo para no expandir la fila */
  height: 1.5rem;
  line-height: 1;
  padding: 0.25rem 0.5rem !important;
  box-sizing: border-box;
}

.scan-container {
  /* Scan list (left) fixed area for exactly 10 rows */
  /* use the same header/row height variables as the Nro/Titulo column
     so both tables visually align */
  /* Use same total height as titulo-container */
  height: var(--titulo-total-h);
  overflow-y: auto;
  /* prevent horizontal scrollbar caused by column widths or long content */
  overflow-x: hidden;
}

.scan-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: inherit;
}

.scan-table tbody tr {
  height: var(--titulo-row-h, 2rem) !important;
}

/* Ensure the compact table uses the same row height so all tables align visually */
.compact-table tbody tr {
  height: var(--titulo-row-h, 2rem) !important;
}

/* Minimal, non-intrusive adjustments to equalize visible row height across tables
   without changing table structure (no display:block trick). These reduce
   vertical padding and ensure inputs/checks don't expand rows. */
.uster-component .scan-table tbody td,
.uster-component .compact-table tbody td {
  padding-top: 0.25rem !important;
  /* 4px */
  padding-bottom: 0.25rem !important;
  /* 4px */
  line-height: 1 !important;
  box-sizing: border-box !important;
  vertical-align: middle !important;
}

/* Reduce vertical gap for titulo cells so inputs sit flush with their cells
   and focusing doesn't trigger row height changes */
.uster-component .titulo-table tbody td,
.uster-component .titulo-table tbody th {
  /* Remove vertical padding so the input can sit flush with the cell.
     Use zero padding to eliminate any visible gap between the input
     and the table cell borders. */
  padding-top: 0 !important;
  padding-bottom: 0 !important;
  box-sizing: border-box !important;
}

/* Ensure the row elements keep the expected height and don't expand */
.uster-component .scan-table tbody tr,
.uster-component .titulo-table tbody tr,
.uster-component .compact-table tbody tr {
  height: var(--titulo-row-h, 2rem) !important;
  max-height: var(--titulo-row-h, 2rem) !important;
}

/* Inputs in the titulo-table should fit within the row without increasing height */
.uster-component .titulo-table td input {
  /* Fill the full cell height and sit flush: remove vertical padding on
     the td (above) and make the input 100% height. Keep box-sizing so
     the input border doesn't increase layout size. */
  box-sizing: border-box !important;
  display: block !important;
  width: 100% !important;
  height: 100% !important;
  max-height: 100% !important;
  margin: 0 !important;
  padding: 0 0.5rem !important;
  border-radius: 0 !important;
  line-height: 1 !important;
}

/* When the input receives focus, reduce its inner padding/height just a
   touch to compensate for focus rings / shadows that can add visual
   overflow on some browsers. This prevents the focused input from
   increasing row height. */
.uster-component .titulo-table td input:focus {
  height: calc(var(--titulo-row-h, 2rem) - 0.8rem) !important;
  max-height: calc(var(--titulo-row-h, 2rem) - 0.8rem) !important;
  padding-top: 0.06rem !important;
  padding-bottom: 0.06rem !important;
  outline: none !important;
}

/* Constrain checkboxes and svg icons so they don't push row height */
.uster-component .scan-table tbody td input[type="checkbox"],
.uster-component .scan-table tbody td svg {
  width: 1rem !important;
  height: 1rem !important;
  vertical-align: middle !important;
}

/* Tighten vertical padding on scan table cells to match titulo-table and avoid forcing extra row height */
.scan-table tbody td,
.scan-table tbody th {
  padding-top: 0.25rem !important;
  /* 4px */
  padding-bottom: 0.25rem !important;
  /* 4px */
}

/* Make titulo-table cells use the same vertical padding so rows align */
.titulo-table tbody td,
.titulo-table tbody th {
  padding-top: 0.06rem !important;
  padding-bottom: 0.06rem !important;
}

/* Ensure checkbox and svg icon sizes don't push row heights: center and constrain */
.scan-table tbody td input[type="checkbox"],
.scan-table tbody td svg {
  display: inline-block;
  height: 1rem;
  width: 1rem;
  vertical-align: middle;
}

/* Defensive: ensure tables don't force horizontal scroll beyond their containers */
table.text-sm,
table.w-full {
  max-width: 100%;
  overflow-wrap: anywhere;
}

/* Custom minimal/futuristic vertical scrollbar for visible scrollable areas in this component
   (applies to the left list, the Nro/Titulo column, and any overflow-auto wrappers such as
   the imported-TBL results wrapper). Supports Firefox + WebKit. */
.titulo-container,
.scan-container,
.overflow-auto {
  /* Firefox */
  scrollbar-width: thin;
  /* thumb then track */
  scrollbar-color: rgba(99, 102, 241, 0.35) transparent;
}

/* WebKit-based browsers */
.titulo-container::-webkit-scrollbar,
.scan-container::-webkit-scrollbar,
.overflow-auto::-webkit-scrollbar {
  width: 8px;
}

.titulo-container::-webkit-scrollbar-track,
.scan-container::-webkit-scrollbar-track,
.overflow-auto::-webkit-scrollbar-track {
  background: transparent;
}

.titulo-container::-webkit-scrollbar-thumb,
.scan-container::-webkit-scrollbar-thumb,
.overflow-auto::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.35);
  /* indigo tint */
  border-radius: 999px;
  border: 2px solid transparent;
  /* visually slimmer */
  background-clip: padding-box;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.14);
  transition: background 160ms linear, box-shadow 160ms linear;
}

.titulo-container::-webkit-scrollbar-thumb:hover,
.scan-container::-webkit-scrollbar-thumb:hover,
.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.65);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.24);
}

/* Small accessibility: slightly enlarge hit area on hover via transparent outline */
.titulo-container::-webkit-scrollbar-thumb:active,
.scan-container::-webkit-scrollbar-thumb:active,
.overflow-auto::-webkit-scrollbar-thumb:active {
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.28);
}


/* set concrete variables so row heights match exactly (including small margin) */
.uster-component {
  /* tweak these values if you want slightly larger/smaller rows */
  --titulo-row-h: 2rem;
  /* row height used for Nro/Titulo and scan rows */
  --titulo-header-h: 2.5rem;
  /* increased 25% */
  /* header height used in calculations (was 2rem) */
  /* total height for the visible list (header + 10 rows + small gap) */
  /* total height = header + 10 rows (no extra gap) */
  /* Slightly reduce total to account for table borders and avoid extra gap under last row */
  /* decrease by a couple pixels to compensate for borders and rounding */
  --titulo-total-h: calc(var(--titulo-header-h) + (var(--titulo-row-h) * 10) - 4px);
}

/* Grid gap controls for the three-column layout in Uster.vue
   Default: wider gap (2ch). On small screens (<820px) reduce to half (1ch). */
.uster-grid {
  gap: 0.5rem 2ch;
  align-items: start;
}

@media (max-width: 820px) {
  .uster-grid {
    gap: 0.5rem 1ch;
  }
}

/* Responsive adjustments for the "Ensayos encontrados" table (scan-table).
   - Hide less important columns on narrow screens (Ne, Maq)
   - Reduce widths of others to fit the layout
   - Keep the essential columns visible: Ensayo, .PAR, .TBL, Imp. */
@media (max-width: 820px) {
  /* On narrow screens we must update the <col> widths because
     `table-layout: fixed` respects <col> sizing before th/td rules.
     Set both col.* and th/td rules to ensure the column actually shrinks. */

  /* Ensayo: shrink where there is available space */
  .scan-table col.col-ensayo,
  .scan-table th.col-ensayo,
  .scan-table td.col-ensayo {
    /* reduced 20% from 48px → 38px */
    width: 30px;
    min-width: 20px;
  }

  /* .PAR and .TBL: small checkboxes, make them tighter */
  /* Set .PAR and .TBL to 26px on narrow screens as requested */
  .scan-table col.col-par,
  .scan-table th.col-par,
  .scan-table td.col-par,
  .scan-table col.col-tbl,
  .scan-table th.col-tbl,
  .scan-table td.col-tbl {
    width: 22px;
    min-width: 18px;
  }

  /* Imp., Ne, Maq: content is short (Sí/No or 1-4 chars) — keep visible but narrow */
  .scan-table col.col-imp,
  .scan-table th.col-imp,
  .scan-table td.col-imp {
    width: 28px;
    min-width: 20px;
  }

  .scan-table col.col-ne,
  .scan-table th.col-ne,
  .scan-table td.col-ne,
  .scan-table col.col-maq,
  .scan-table th.col-maq,
  .scan-table td.col-maq {
    width: 30px;
    min-width: 22px;
  }

  /* Slightly tighten the header paddings to keep rows compact on very narrow screens */
  .scan-table thead th {
    padding-top: 0.375rem;
    padding-bottom: 0.375rem;
  }
}

/* Micro-adjust: compensate subpixel rounding by nudging tables up slightly.
   This uses translateY to remove a tiny visible gap under the last visible row
   caused by fractional-pixel rounding in different browsers. Change value to
   -0.5px or -2px if you want a smaller/larger nudge. */
.uster-component .titulo-container table,
.uster-component .scan-container table,
.uster-component .compact-table {
  transform: translateY(-1px);
  /* preserve existing stacking and layout behavior */
  will-change: transform;
}

/* Custom checkbox colors for .PAR and .TBL columns based on saved state */
.scan-table input[type="checkbox"].accent-green-600 {
  accent-color: #16a34a !important;
  filter: none !important;
  opacity: 1 !important;
}

.scan-table input[type="checkbox"].accent-slate-400 {
  accent-color: #94a3b8 !important;
  filter: grayscale(0.3) !important;
  opacity: 0.7 !important;
}
</style>






