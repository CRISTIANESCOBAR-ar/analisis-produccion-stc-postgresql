<template>
	<!-- Mensaje móvil: deshabilitado en pantallas pequeñas -->
	<div class="md:hidden p-4">
		<div class="bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 text-sm">
			Esta página de carga (TensoRapid) está disponible solo en escritorio (pantallas medianas o mayores).
		</div>
	</div>
	<div class="hidden md:flex w-full h-screen flex-col p-1 tenso-component">
		<main
			class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col overflow-y-auto">
			<!-- Selector de carpeta (con título principal delante) -->
			<div class="flex-shrink-0 mb-3 flex items-center gap-3">
				<div class="text-2xl font-semibold text-slate-800 mr-4">Datos TensoRapid</div>
				<label class="text-sm font-semibold text-slate-700 mr-2 shrink-0">Carpeta TensoRapid:</label>
				<div class="w-64 min-w-0">
					<div class="px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-sm text-slate-800 truncate"
						:title="tensoFolderPathFull">
						{{ tensoFolderPathFull || 'Ninguna carpeta seleccionada' }}
					</div>
				</div>
				<div class="flex items-center gap-2">
					<button @click="selectTensoFolder"
						class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
							stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
								d="M3 7a2 2 0 012-2h3l2 3h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
						</svg>
						Seleccionar
					</button>
					<button @click="refreshTensoFolder"
						class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24"
							stroke="currentColor">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						Actualizar
					</button>
					<input ref="tensoFolderInputLocal" type="file" webkitdirectory directory multiple class="hidden"
						@change="onTensoFolderInputChangeLocal" />
				</div>
			</div>

			<!-- Contenedor que agrupa filtros, tablas y estado -->
			<div class="flex-1 flex flex-col mt-2 bg-white rounded-2xl shadow-sm p-4 border border-slate-200 min-h-0">
				<!-- Top row: filtros a la izquierda y título Datos .TBL a la derecha (si hay datos) -->
				<div class="flex-shrink-0 mt-2 flex items-center justify-between gap-4">
					<div class="flex items-center gap-4">
						<label class="inline-flex items-center text-sm cursor-pointer">
							<input type="radio" name="tenso-filter" v-model="filterMode" value="all"
								class="mr-2 text-indigo-600 focus:ring-indigo-500" />
							<span class="text-slate-700 font-medium">Todos</span>
						</label>
						<label class="inline-flex items-center text-sm cursor-pointer">
							<input type="radio" name="tenso-filter" v-model="filterMode" value="not"
								class="mr-2 text-indigo-600 focus:ring-indigo-500" />
							<span class="text-slate-700 font-medium">No guardados</span>
						</label>
						<label class="inline-flex items-center text-sm cursor-pointer">
							<input type="radio" name="tenso-filter" v-model="filterMode" value="saved"
								class="mr-2 text-indigo-600 focus:ring-indigo-500" />
							<span class="text-slate-700 font-medium">Guardados</span>
						</label>
					</div>
					<!-- Título Datos .TBL alineado a la derecha en la misma línea -->
					<div v-if="parsedTblData.length" class="ml-4">
						<h5 class="font-semibold text-lg text-slate-800 mb-0">
							Datos .TBL — TESTNR: {{ tblTestnr }}
							<span v-if="formattedTimeDate" class="ml-2 text-slate-600">• {{ formattedTimeDate }}</span>
						</h5>
					</div>
				</div>

				<!-- Grid de dos columnas: tabla de ensayos a la izquierda y datos TBL a la derecha -->
				<!-- Left column fixed, right column flexible to avoid TBL dropping below -->
				<div class="flex-1 min-h-0 mt-4 flex flex-col xl:flex-row gap-4 tenso-grid">
					<!-- Columna izquierda: Tabla de ensayos encontrados -->
					<div class="flex flex-col h-full min-h-0 xl:w-[60%] flex-shrink-0">
						<div class="flex-1 min-h-0 overflow-y-auto _minimal-scroll">
							<table class="text-xs border-collapse fixed-table scan-table w-full">
								<colgroup>
									<col class="col-ensayo" />
									<col class="col-par" />
									<col class="col-tbl" />
									<col class="col-imp" />
									<col class="col-ne" />
									<col class="col-maq" />
									<col style="width: 72px" />
									<!-- Acción increased by ~15% (212px -> 244px) -->
									<col class="col-accion" />
								</colgroup>
								<thead class="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100 z-10">
									<tr>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											Ensayo</th>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											.PAR</th>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											.TBL</th>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											Estado</th>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											Ne</th>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											Maq.</th>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											USTER</th>
										<th
											class="px-2 py-1 border border-slate-200 text-xs text-center font-semibold text-slate-700">
											Acción</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="(item, idx) in tensoDisplayList" :key="idx"
										class="hover:bg-blue-50/30 cursor-pointer transition-colors duration-150"
										:class="{ 'bg-blue-50': selectedTensoTestnr === item.testnr }"
										@click="loadTensoTestFiles(item.testnr)">
										<td
											class="px-2 py-[0.3rem] border border-slate-200 text-xs text-center text-slate-700">
											{{
												item.testnr || '' }}</td>
										<td class="px-2 py-[0.3rem] border border-slate-200 text-center text-xs"><input
												type="checkbox" disabled :checked="item.hasPar" /></td>
										<td class="px-2 py-[0.3rem] border border-slate-200 text-center text-xs"><input
												type="checkbox" disabled :checked="item.hasTbl" /></td>
										<td class="px-2 py-[0.3rem] border border-slate-200 text-center text-xs">
											<span v-if="item.saved === true" title="Guardado en la base de datos">
												<svg xmlns="http://www.w3.org/2000/svg"
													class="h-4 w-4 text-green-600 mx-auto" fill="none"
													viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
													<path stroke-linecap="round" stroke-linejoin="round"
														d="M5 13l4 4L19 7" />
												</svg>
											</span>
										</td>
										<td
											class="px-2 py-[0.3rem] border border-slate-200 text-center text-xs font-mono text-slate-700">
											{{ item.nomcount || '' }}</td>
										<td
											class="px-2 py-[0.3rem] border border-slate-200 text-center text-xs font-mono text-slate-700">
											{{ item.maschnr || '' }}</td>
										<td class="px-2 py-[0.3rem] border border-slate-200 text-center text-xs"
											@click.stop>
											<input v-if="item.testnr" type="text" v-model="item.usterTestnr"
												:placeholder="item.saved ? '05410' : ''" maxlength="5"
												inputmode="numeric" :readonly="item.saved && !item.isEditing"
												:ref="el => setInputRef(el, item.testnr)"
												@focus="handleUsterInputFocus(item)"
												@input="formatUsterTestnr(item, $event)"
												@keydown.enter="focusActionButtons(item)"
												@keydown.right.prevent="focusActionButtons(item)" :class="[
													'w-full px-2 py-1 text-xs text-center border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-yellow-400 font-mono transition-colors',
													item.saved && !item.isEditing ? 'bg-slate-100 text-slate-900 cursor-default' : 'text-slate-900',
													selectedTensoTestnr === item.testnr ? 'bg-yellow-50 ring-2 ring-yellow-400' : 'hover:bg-slate-50 focus:bg-yellow-50'
												]" />
										</td>
										<td class="px-2 py-[0.3rem] border border-slate-200 text-center text-xs"
											@click.stop>
											<!-- Botón Editar (solo si está guardado y no está editando) -->
											<transition name="fade" mode="out-in">
												<div v-if="item.testnr && item.saved && !item.isEditing"
													class="flex items-center gap-1 justify-center">
													<button @click.stop="startEditing(item)"
														:ref="el => setEditButtonRef(el, item.testnr)"
														@keydown.left.prevent="focusUsterInput(item)"
														@keydown.right.prevent="focusDeleteButton(item)"
														class="inline-flex items-center justify-center w-28 gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4"
															fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round"
																stroke-width="2"
																d="M15.232 5.232l3.536 3.536M9 11l6-6 3 3-6 6H9v-3z" />
														</svg>
														Editar
													</button>
													<button v-if="!item.isEditing" @click.stop="deleteTensorapid(item)"
														:disabled="isDeleting"
														:ref="el => setDeleteButtonRef(el, item.testnr)"
														@keydown.left.prevent="focusEditButton(item)"
														class="inline-flex items-center justify-center w-28 gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md disabled:opacity-50">
														<svg xmlns="http://www.w3.org/2000/svg"
															class="h-4 w-4 text-red-600" fill="none" viewBox="0 0 24 24"
															stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round"
																stroke-width="2"
																d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M10 3h4a1 1 0 011 1v2H9V4a1 1 0 011-1z" />
														</svg>
														{{ isDeleting ? 'Eliminando...' : 'Eliminar' }}
													</button>
												</div>
												<!-- Botones Guardar y Cancelar (si está editando o no está guardado) -->
												<div v-else-if="item.testnr && item.usterTestnr"
													class="flex gap-1 justify-center">
													<button @click="saveToOracle(item)" :disabled="isSaving"
														:ref="el => setSaveButtonRef(el, item.testnr)"
														@keydown.left.prevent="focusUsterInput(item)"
														@keydown.right.prevent="focusDeleteButton(item)"
														class="inline-flex items-center justify-center w-28 gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md disabled:opacity-50">
														<svg xmlns="http://www.w3.org/2000/svg"
															class="h-4 w-4 text-indigo-600" fill="none"
															viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round"
																stroke-width="2" d="M5 13l4 4L19 7" />
														</svg>
														<span>{{ isSaving ? 'Guardando...' : 'Guardar' }}</span>
													</button>
													<button v-if="item.isEditing" @click="cancelEditing(item)"
														:disabled="isSaving"
														class="inline-flex items-center justify-center w-28 gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md disabled:opacity-50">
														<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4"
															fill="none" viewBox="0 0 24 24" stroke="currentColor">
															<path stroke-linecap="round" stroke-linejoin="round"
																stroke-width="2" d="M6 18L18 6M6 6l12 12" />
														</svg>
														Cancelar
													</button>
													<button v-if="!item.isEditing" @click.stop="deleteTensorapid(item)"
														:disabled="isDeleting"
														:ref="el => setDeleteButtonRef(el, item.testnr)"
														@keydown.left.prevent="focusSaveButton(item)"
														class="inline-flex items-center justify-center w-28 px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium disabled:opacity-50 transition-colors duration-200 shadow-sm hover:shadow-md">
														{{ isDeleting ? 'Eliminando...' : 'Eliminar' }}
													</button>
												</div>
											</transition>
										</td>
									</tr>
								</tbody>
							</table>
						</div>
						<div class="flex-shrink-0 flex items-center gap-2 mt-3">
							<div class="text-sm font-medium text-slate-600">{{ tensoScanStatus }}</div>
							<div v-if="isScanning" class="text-sm text-slate-500 flex items-center gap-2">
								<svg class="w-4 h-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor"
										stroke-width="4">
									</circle>
									<path class="opacity-75" fill="currentColor"
										d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z">
									</path>
								</svg>
								<span>Escaneando...</span>
							</div>
						</div>
					</div>
					<!-- Fin columna izquierda -->

					<!-- Columna derecha: Tabla TBL (sin contenedor exterior) -->
					<div v-show="parsedTblData.length" class="flex flex-col min-w-0 xl:w-[40%] flex-shrink">
						<div class="overflow-x-auto overflow-y-auto _minimal-scroll max-h-96 min-w-0">
							<table class="min-w-full text-sm border-collapse tbl-centered">
								<colgroup>
									<!-- Reduced by 40% from 40px -> 24px -->
									<col style="width:24px" />
									<!-- Reduced Test column by 40% (was 68px -> now ~41px) -->
									<col class="tbl-col-test" />
									<col style="width:48px" />
									<col style="width:48px" />
									<col class="tbl-col-tiempo" />
									<col style="width:44px" />
									<col style="width:32px" />
									<col style="width:40px" />
									<col style="width:40px" />
								</colgroup>
								<thead class="sticky top-0 bg-gradient-to-r from-slate-50 to-slate-100">
									<tr>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">#
										</th>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">
											Test
										</th>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">No.
										</th>
										<th
											class="p-2 border border-slate-200 text-xs font-semibold text-slate-700 bg-blue-50">
											Huso</th>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">
											Tiempo Rotura</th>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">
											Fuerza B
										</th>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">
											Elong.
										</th>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">
											Tenac.
										</th>
										<th class="p-2 border border-slate-200 text-xs font-semibold text-slate-700">
											Trabajo
										</th>
									</tr>
								</thead>
								<tbody>
									<tr v-for="(row, ri) in preparedTblPreview" :key="ri"
										class="hover:bg-blue-50/30 transition-colors duration-150">
										<td class="p-1.5 border border-slate-200 text-xs text-center text-slate-700">{{
											ri +
											1 }}</td>
										<td class="p-1.5 border border-slate-200 text-xs font-mono text-slate-700">{{
											row.TESTNR || '' }}</td>
										<td class="p-1.5 border border-slate-200 text-xs font-mono text-slate-700">{{
											row.HUSO_ENSAYOS || '' }}</td>
										<td
											class="p-1.5 border border-slate-200 text-xs font-mono bg-blue-50 text-center font-semibold text-slate-700">
											{{ row.HUSO_NUMBER }}</td>
										<td
											class="p-1.5 border border-slate-200 text-xs font-mono text-right text-slate-700 tbl-td-tiempo">
											{{ row.TIEMPO_ROTURA || '' }}</td>
										<td
											class="p-1.5 border border-slate-200 text-xs font-mono text-right text-slate-700">
											{{ row.FUERZA_B || '' }}</td>
										<td
											class="p-1.5 border border-slate-200 text-xs font-mono text-right text-slate-700">
											{{ row.ELONGACION || '' }}</td>
										<td
											class="p-1.5 border border-slate-200 text-xs font-mono text-right text-slate-700">
											{{ row.TENACIDAD || '' }}</td>
										<td
											class="p-1.5 border border-slate-200 text-xs font-mono text-right text-slate-700">
											{{ row.TRABAJO || '' }}</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
					<!-- Fin columna derecha -->

				</div>
				<!-- Cierre del contenedor que agrupa filtros y tablas -->
			</div>
			<!-- Fin grid dos columnas -->

		</main>
		<!-- Fin main -->

	</div>
	<!-- Fin contenedor principal tenso-component -->
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue'
import Swal from 'sweetalert2'

// UI state
const tensoFolderInputLocal = ref(null)
const tensoFolderPathFull = ref('')
const tensoHasPersistedHandle = ref(false)
const tensoScanList = ref([])
const selectedTensoTestnr = ref('')
const tensoScanStatus = ref('')
const isScanning = ref(false)
const isSaving = ref(false)
const isDeleting = ref(false)
const maxRows = 10

// filtro UI: 'all' | 'saved' | 'not'
// Por defecto enfocamos en los ensayos no guardados para que el usuario cargue/guarde rápidamente
const filterMode = ref('not')

// Refs para inputs y botones (para auto-focus)
const inputRefs = ref({})
const saveButtonRefs = ref({})
const editButtonRefs = ref({})
const deleteButtonRefs = ref({})

// compute display list padded to maxRows and filtered by checkboxes
const tensoDisplayList = computed(() => {
	const src = Array.isArray(tensoScanList.value) ? tensoScanList.value.slice() : []

	// aplicar filtros
	let filtered = []
	if (src.length === 0) {
		filtered = []
	} else if (filterMode.value === 'all') {
		filtered = src
	} else {
		const showSaved = filterMode.value === 'saved'
		const showNot = filterMode.value === 'not'
		// si no hay ninguna opción seleccionada, mostrar todo
		if (!showSaved && !showNot) {
			filtered = src
		} else {
			filtered = src.filter(item => {
				const saved = !!item.saved
				return (saved && showSaved) || (!saved && showNot)
			})
		}
	}

	const out = []
	if (filtered.length === 0) {
		for (let i = 0; i < maxRows; i++) out.push({ testnr: '', hasPar: false, hasTbl: false, nomcount: '', maschnr: '' })
		return out
	}

	if (filtered.length >= maxRows) return filtered
	out.push(...filtered)
	while (out.length < maxRows) out.push({ testnr: '', hasPar: false, hasTbl: false, nomcount: '', maschnr: '' })
	return out
})

// Handlers para mantener comportamiento de filtros
// filtros manejados por filterMode (radio)

// (extractHusoNumber removed — logic inlined where needed)

// Formatea el texto de estado según total, savedCount y modo de filtro
function formatScanStatus(total, savedCount, mode) {
	if (!total || total === 0) return 'No se encontraron archivos .PAR/.TBL válidos en la carpeta seleccionada'
	if (mode === 'all') return `Encontrados ${total} ensayos (mostrando todos)`
	// si no tenemos savedCount, mostrar 'mostrando' genérico
	if (savedCount == null) {
		if (mode === 'saved') return `Encontrados ${total} ensayos (mostrando guardados)`
		if (mode === 'not') return `Encontrados ${total} ensayos (mostrando no guardados)`
	}
	const notSaved = total - (savedCount || 0)
	if (mode === 'saved') return `Encontrados ${total} ensayos (${savedCount} guardados)`
	if (mode === 'not') return `Encontrados ${total} ensayos (${notSaved} no guardados)`
	return `Encontrados ${total} ensayos`
}

// Recalcula y actualiza el texto de estado según la lista actual y el modo de filtro
function recalcStatus() {
	const total = Array.isArray(tensoScanList.value) ? tensoScanList.value.length : 0
	// detectar si tenemos información de saved en la lista
	const hasSavedInfo = Array.isArray(tensoScanList.value) && tensoScanList.value.some(it => typeof it.saved !== 'undefined')
	const savedCount = hasSavedInfo ? tensoScanList.value.reduce((acc, it) => acc + (it.saved ? 1 : 0), 0) : null
	tensoScanStatus.value = formatScanStatus(total, savedCount, filterMode.value)
}

// Cuando cambia el modo de filtro o la lista de ensayos, actualizar el label inmediatamente
watch(filterMode, () => recalcStatus())
watch(tensoScanList, () => recalcStatus(), { deep: true })

// **VALIDACIÓN 1: Verificar que el ensayo Uster existe en la base de datos**
async function validateUsterExists(usterTestnr) {
	try {
		const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
			? 'http://localhost:3001'
			: ''
		const endpoint = '/api/uster/status'
		
		const resp = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ testnrs: [usterTestnr] }),
			credentials: 'include'
		})
		
		if (!resp.ok) {
			return false
		}
		
		const data = await resp.json()
		// Si existing incluye el testnr, significa que existe
		return data && Array.isArray(data.existing) && data.existing.includes(usterTestnr)
	} catch (err) {
		return false
	}
}

// **VALIDACIÓN 2: Verificar que los números de Huso coincidan entre Uster y TensoRapid**
async function validateHusoMatch(usterTestnr, tensoTblData) {
	try {
		// Obtener los números de Huso del ensayo Uster desde la BD
		const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
			? 'http://localhost:3001'
			: ''
		const endpoint = '/api/uster/husos'
		
		const resp = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ testnr: usterTestnr }),
			credentials: 'include'
		})
		
		if (!resp.ok) {
			const errorData = await resp.json().catch(() => null)
			const errorMsg = errorData && errorData.error ? errorData.error : `HTTP ${resp.status}`
			return { valid: false, error: `No se pudo verificar la coincidencia de Husos: ${errorMsg}` }
		}
		
		const data = await resp.json()
		
		if (!data || !Array.isArray(data.husos)) {
			return { valid: false, error: 'No se encontraron datos de Husos para el ensayo Uster' }
		}
		
		if (data.husos.length === 0) {
			return { valid: false, error: `El ensayo Uster ${usterTestnr} no tiene husos registrados en USTER_TBL` }
		}
		
		// Extraer números de Huso del TBL de TensoRapid
		const tensoHusos = tensoTblData
			.map(row => {
				const husoEnsayos = row[1] && row[1].trim() !== '' ? row[1].trim() : null
				if (husoEnsayos) {
					const match = husoEnsayos.match(/^(\d+)\//)
					if (match && match[1]) {
						return parseInt(match[1], 10)
					}
				}
				return null
			})
			.filter(h => h !== null)
		
		if (tensoHusos.length === 0) {
			return { valid: false, error: 'No se pudieron extraer números de Huso del archivo TensoRapid' }
		}
		
		// Verificar coincidencia entre ambos conjuntos
		const usterHusos = data.husos.map(h => parseInt(h, 10))
		const husosInTensoNotInUster = tensoHusos.filter(h => !usterHusos.includes(h))
		const husosInUsterNotInTenso = usterHusos.filter(h => !tensoHusos.includes(h))
		
		// Si hay discrepancias, retornar información detallada para que el usuario decida
		if (husosInTensoNotInUster.length > 0 || husosInUsterNotInTenso.length > 0) {
			return {
				valid: false,
				hasDiscrepancies: true,
				usterHusos,
				tensoHusos,
				husosInTensoNotInUster,
				husosInUsterNotInTenso,
				canAutoFix: true
			}
		}
		
		return { valid: true }
	} catch (err) {
		return { valid: false, error: 'Error al validar coincidencia de Husos: ' + (err.message || String(err)) }
	}
}

// Función para cargar archivos al hacer clic en una fila
async function loadTensoTestFiles(testnr) {
	if (!testnr) {
		return
	}
	selectedTensoTestnr.value = testnr
	try {
		await loadSelectedTensoFiles(testnr)
	} catch (err) {
	}
}

async function saveToOracle(item) {
	if (!item || !item.testnr || !item.usterTestnr) return
	if (isSaving.value) return

	isSaving.value = true
	try {
		// Cargar archivos PAR y TBL para este ensayo
		await loadSelectedTensoFiles(item.testnr)

		// Verificar que tengamos datos PAR y TBL
		if (!parsedParData.value || Object.keys(parsedParData.value).length === 0) {
			throw new Error('No se pudieron cargar los datos del archivo .PAR')
		}
		if (!parsedTblData.value || parsedTblData.value.length === 0) {
			throw new Error('No se pudieron cargar los datos del archivo .TBL')
		}

		// **VALIDACIÓN 1: Verificar que el USTER_TESTNR existe en la BD**
		const usterExists = await validateUsterExists(item.usterTestnr)
		if (!usterExists) {
			throw new Error(`El ensayo Uster ${item.usterTestnr} no existe en la base de datos. Debe cargarse primero en la página Uster.`)
		}

		// **VALIDACIÓN 2: Verificar que los números de Huso coincidan**
		const husoValidation = await validateHusoMatch(item.usterTestnr, parsedTblData.value)
		if (!husoValidation.valid) {
			// Si hay discrepancias pero podemos auto-corregir, mostrar modal con opciones
			if (husoValidation.hasDiscrepancies && husoValidation.canAutoFix) {
				// Cerrar toast de guardando
				Swal.close()
				
				// Construir mensaje informativo
				let message = '<div style="text-align: left; font-size: 14px;">'
				message += '<p><strong>Se detectaron diferencias en los números de Huso:</strong></p>'
				
				if (husoValidation.husosInTensoNotInUster.length > 0) {
					message += `<p>• Husos en TensoRapid que <strong>NO están</strong> en Uster: <code>${husoValidation.husosInTensoNotInUster.join(', ')}</code></p>`
				}
				if (husoValidation.husosInUsterNotInTenso.length > 0) {
					message += `<p>• Husos en Uster que <strong>NO están</strong> en TensoRapid: <code>${husoValidation.husosInUsterNotInTenso.join(', ')}</code></p>`
				}
				
				message += '<br><p><strong>¿Qué deseas hacer?</strong></p></div>'
				
				const result = await Swal.fire({
					icon: 'warning',
					title: 'Discrepancia en Husos',
					html: message,
					showDenyButton: true,
					showCancelButton: true,
					confirmButtonText: '✓ Usar Husos de Uster',
					confirmButtonColor: '#10b981',
					denyButtonText: 'Guardar de todas formas',
					denyButtonColor: '#f59e0b',
					cancelButtonText: 'Cancelar',
					cancelButtonColor: '#6b7280',
					width: '600px'
				})
				
				if (result.isDismissed) {
					// Usuario canceló, no guardar
					isSaving.value = false
				
					// Seleccionar el contenido del input de USTER para facilitar corrección
					await nextTick()
					const input = inputRefs.value[item.testnr]
					if (input && typeof input.select === 'function') {
						input.focus()
						input.select()
					}
				
					return
				}
			
				if (result.isConfirmed) {
					// Usuario eligió usar Husos de Uster - reemplazar en parsedTblData
					// Reemplazar los Husos de TensoRapid con los de Uster
					for (let i = 0; i < parsedTblData.value.length && i < husoValidation.usterHusos.length; i++) {
						const usterHuso = husoValidation.usterHusos[i]
						// Actualizar columna 1 (formato "321/5" por ejemplo)
						if (parsedTblData.value[i][1]) {
							const match = parsedTblData.value[i][1].match(/^(\d+)\/(.+)$/)
							if (match) {
								parsedTblData.value[i][1] = `${usterHuso}/${match[2]}`
							}
						}
					}
				} else if (result.isDenied) {
					// Usuario eligió guardar con los Husos actuales de TensoRapid
				}
			} else {
				// Error que no se puede auto-corregir
				throw new Error(husoValidation.error)
			}
		}

		// Agregar el TESTNR de USTER a los datos PAR
		const parDataToSave = {
			...parsedParData.value,
			USTER_TESTNR: item.usterTestnr
		}

		// Preparar datos TBL - extraer número de huso de la columna Ne (ej: "62/5" -> 62)
		const tblDataToSave = parsedTblData.value
			.map((row, index) => {
				// Extraer número de huso de la columna 1 (formato "62/5", "320/5", etc)
				const husoEnsayos = row[1] && row[1].trim() !== '' ? row[1].trim() : null
				let husoNumber = null
				if (husoEnsayos) {
					const match = husoEnsayos.match(/^(\d+)\//)
					if (match && match[1]) {
						husoNumber = parseInt(match[1], 10)
					}
				}
				// Si no se puede extraer, usar índice+1 como fallback
				if (!husoNumber || isNaN(husoNumber)) {
					husoNumber = index + 1
				}

				return {
					TESTNR: row[0] || parDataToSave.TESTNR,
					HUSO_ENSAYOS: husoEnsayos,
					HUSO_NUMBER: husoNumber,
					TIEMPO_ROTURA: row[2] && row[2].trim() !== '' ? row[2] : null,
					FUERZA_B: row[3] && row[3].trim() !== '' ? row[3] : null,
					ELONGACION: row[4] && row[4].trim() !== '' ? row[4] : null,
					TENACIDAD: row[5] && row[5].trim() !== '' ? row[5] : null,
					TRABAJO: row[6] && row[6].trim() !== '' ? row[6] : null
				}
			})

		// Toast de progreso
		Swal.fire({
			toast: true,
			position: 'top-end',
			icon: 'info',
			title: 'Guardando...',
			showConfirmButton: false,
			timer: 30000,
			timerProgressBar: true
		})

		// Determinar URL del backend
		const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
			? 'http://localhost:3001'
			: ''
		const endpoint = '/api/tensorapid/upload'

		// Enviar datos al backend
		const response = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				par: parDataToSave,
				tbl: tblDataToSave
			}),
			credentials: 'include'
		})

		let data = null
		try { data = await response.json() } catch { data = null }

		if (!response.ok) {
			throw new Error(data && data.error ? data.error : (data && data.message) || `HTTP ${response.status}`)
		}

		// Marcar como guardado en la lista y salir del modo edición
		item.saved = true
		item.isEditing = false

		// Enfocar siguiente input vacío en la columna USTER
		try { await focusNextEmptyUster(item.testnr) } catch (e) { /* ignore */ }

		// Toast de éxito
		Swal.fire({
			toast: true,
			position: 'top-end',
			icon: 'success',
			title: `Ensayo ${item.testnr} guardado`,
			text: `Vinculado con USTER ${item.usterTestnr}`,
			showConfirmButton: false,
			timer: 3000,
			timerProgressBar: true
		})
	} catch (err) {
		// Cerrar toast de "Guardando..." si existe
		Swal.close()
		// Modal de error (no toast, para que el usuario pueda leerlo bien)
		await Swal.fire({
			icon: 'error',
			title: 'Error al guardar',
			html: `<div style="text-align: left;">${String(err && err.message ? err.message : err)}</div>`,
			confirmButtonText: 'Entendido',
			confirmButtonColor: '#3b82f6',
			width: '500px'
		})
		
		// Después del error, regresar el foco al input USTER y seleccionar el contenido
		await nextTick()
		const input = inputRefs.value[item.testnr]
		if (input && typeof input.focus === 'function') {
			input.focus()
			try {
				if (typeof input.select === 'function') {
					input.select()
				}
			} catch (e) {
				/* ignore */
			}
		}
	} finally {
		isSaving.value = false
	}
}

// Eliminar ensayo de TENSORAPID_PAR y TENSORAPID_TBL
async function deleteTensorapid(item) {
	if (!item || !item.testnr) return
	if (!item.saved) return
	// Confirmación
	const res = await Swal.fire({
		title: `Eliminar ensayo ${item.testnr}?`,
		text: 'Esto eliminará los registros en TENSORAPID_PAR y TENSORAPID_TBL. Esta acción no afecta USTER.',
		icon: 'warning',
		showCancelButton: true,
		confirmButtonText: 'Eliminar',
		cancelButtonText: 'Cancelar'
	})
	if (!res.isConfirmed) return
	if (isDeleting.value) return
	isDeleting.value = true
	try {
		const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost') ? 'http://localhost:3001' : ''
		const endpoint = '/api/tensorapid/delete'
		const resp = await fetch(endpoint, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ testnr: item.testnr }),
			credentials: 'include'
		})
		const data = await resp.json().catch(() => null)
		if (!resp.ok) throw new Error(data && data.error ? data.error : `HTTP ${resp.status}`)

		// Remove from scan list and clear parsed data if currently selected
		tensoScanList.value = (tensoScanList.value || []).filter(i => i.testnr !== item.testnr)
		if (selectedTensoTestnr.value === item.testnr) {
			parsedTblData.value = []
			parsedParData.value = {}
			selectedTensoTestnr.value = ''
		}

		Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: `Ensayo ${item.testnr} eliminado`, showConfirmButton: false, timer: 3000 })
	} catch (err) {
		console.error('deleteTensorapid error', err)
		await Swal.fire({ icon: 'error', title: 'Error al eliminar', text: String(err && err.message ? err.message : err), confirmButtonText: 'Cerrar' })
	} finally {
		isDeleting.value = false
	}
}

// Iniciar edición de un ensayo guardado
function startEditing(item) {
	if (!item) return
	// Guardar el valor original por si se cancela
	item.originalUsterTestnr = item.usterTestnr
	item.isEditing = true
}

// Cancelar edición y restaurar valor original
function cancelEditing(item) {
	if (!item) return
	// Restaurar el valor original
	if (item.originalUsterTestnr !== undefined) {
		item.usterTestnr = item.originalUsterTestnr
	}
	item.isEditing = false
	item.originalUsterTestnr = undefined
}

// Guardar referencia al input para poder enfocarlo
function setInputRef(el, testnr) {
	if (el) {
		inputRefs.value[testnr] = el
	}
}

// Guardar referencia al botón Guardar para poder enfocarlo
function setSaveButtonRef(el, testnr) {
	if (el) {
		saveButtonRefs.value[testnr] = el
	}
}

// Guardar referencia al botón Editar
function setEditButtonRef(el, testnr) {
	if (el) {
		editButtonRefs.value[testnr] = el
	}
}

// Guardar referencia al botón Eliminar para poder enfocarlo
function setDeleteButtonRef(el, testnr) {
	if (el) {
		deleteButtonRefs.value[testnr] = el
	}
}

// Enfocar el input USTER
function focusUsterInput(item) {
	if (!item || !item.testnr) return
	const input = inputRefs.value[item.testnr]
	if (input && typeof input.focus === 'function') {
		input.focus()
	}
}

// Enfocar el botón Eliminar
function focusDeleteButton(item) {
	if (!item || !item.testnr) return
	// Solo intentar enfocar si no está editando (porque si edita, el botón eliminar no está o es Cancelar)
	if (item.isEditing) return 
	
	const button = deleteButtonRefs.value[item.testnr]
	if (button && typeof button.focus === 'function') {
		button.focus()
	}
}

// Manejar focus en el input USTER: cargar archivos .TBL automáticamente
async function handleUsterInputFocus(item) {
	if (!item || !item.testnr) return
	
	// Si ya está seleccionado, no hacer nada
	if (selectedTensoTestnr.value === item.testnr) return
	
	// Cargar archivos .TBL para mostrar la tabla "Datos .TBL — TESTNR"
	try {
		await loadSelectedTensoFiles(item.testnr)
		selectedTensoTestnr.value = item.testnr
	} catch (err) {
		console.warn('Error loading TBL data on input focus', err)
	}
}

// Formatear USTER_TESTNR con padding de ceros (5 dígitos) y solo números
async function formatUsterTestnr(item, event) {
	if (!item) return

	// Extraer solo números
	let value = (event.target.value || '').replace(/\D/g, '')

	// Limitar a 5 caracteres
	if (value.length > 5) {
		value = value.slice(0, 5)
	}

	// Actualizar el valor (sin padding mientras escribe)
	item.usterTestnr = value

	// Si llegó a 5 dígitos, aplicar padding y enfocar botón Guardar
	if (value.length === 5) {
		// Padding con ceros a la izquierda
		item.usterTestnr = value.padStart(5, '0')
		// Enfocar botón Guardar después de un pequeño delay para que se actualice el DOM
		setTimeout(() => focusSaveButton(item), 100)
	}
}

// Enfocar el botón Guardar para un ensayo específico
function focusSaveButton(item) {
	if (!item || !item.testnr) return
	const button = saveButtonRefs.value[item.testnr]
	if (button && typeof button.focus === 'function') {
		button.focus()
	}
}

// Enfocar el botón Editar
function focusEditButton(item) {
	if (!item || !item.testnr) return
	const button = editButtonRefs.value[item.testnr]
	if (button && typeof button.focus === 'function') {
		button.focus()
	}
}

// Decidir qué botón enfocar (Guardar o Editar) según el estado
function focusActionButtons(item) {
	if (!item) return
	if (item.saved && !item.isEditing) {
		focusEditButton(item)
	} else {
		focusSaveButton(item)
	}
}

// Focus the next input in the USTER column that is empty (after saving current)
async function focusNextEmptyUster(currentTestnr) {
	try {
		// wait a tick so any reactive changes (saved flag, filters) are applied
		await nextTick()
		const full = Array.isArray(tensoScanList.value) ? tensoScanList.value : []
		if (full.length === 0) return false

		// Build candidate list (testnr) in the same order as full list, respecting current filter
		const candidates = full
			.filter(it => it && it.testnr)
			.filter(it => {
				if (filterMode.value === 'not') return !it.saved
				if (filterMode.value === 'saved') return !!it.saved
				return true
			})
			.filter(it => !it.usterTestnr || String(it.usterTestnr).trim() === '')
			.map(it => String(it.testnr))

		if (candidates.length === 0) {
			// No hay más ensayos sin USTER - limpiar la tabla "Datos .TBL"
			parsedTblData.value = []
			selectedTensoTestnr.value = ''
			await nextTick()
			return false
		}

		// Find position of currentTestnr in full list
		const currentPos = full.findIndex(it => String(it.testnr) === String(currentTestnr))
		// If currentTestnr itself is a candidate, just pick the next candidate in candidates order
		const curIdxInCandidates = candidates.indexOf(String(currentTestnr))
		let targetTestnr = null
		if (curIdxInCandidates >= 0) {
			// next candidate (wrap)
			targetTestnr = candidates[(curIdxInCandidates + 1) % candidates.length]
		} else {
			// find first candidate whose index in full list is greater than currentPos
			let found = null
			for (const cand of candidates) {
				const pos = full.findIndex(it => String(it.testnr) === String(cand))
				if (pos > currentPos) { found = cand; break }
			}
			if (!found) found = candidates[0]
			targetTestnr = found
		}

		if (!targetTestnr) return false
		// allow DOM to settle if the row was removed/changed due to filtering
		await nextTick()

		// Cargar los datos del .TBL del siguiente ensayo para actualizar la tabla
		try {
			await loadSelectedTensoFiles(targetTestnr)
			selectedTensoTestnr.value = targetTestnr
		} catch (e) {
			console.warn('Failed to load files for next test', targetTestnr, e)
		}

		const input = inputRefs.value[targetTestnr]
		if (input && typeof input.focus === 'function') {
			input.focus()
			try { input.scrollIntoView({ block: 'center', behavior: 'smooth' }) } catch { /* ignore */ }
			// add temporary highlight class
			try {
				input.classList.add('focus-highlight')
				setTimeout(() => {
					try { input.classList.remove('focus-highlight') } catch { /* ignore */ }
				}, 600)
			} catch { /* ignore */ }
			return true
		}
	} catch (err) {
		console.warn('focusNextEmptyUster error', err)
	}
	return false
}

// Helper: formatear USTER_TESTNR a 5 dígitos con padding
function padUsterTestnr(value) {
	if (!value) return ''
	const numStr = String(value).replace(/\D/g, '').slice(0, 5)
	return numStr ? numStr.padStart(5, '0') : ''
}

// load .PAR and .TBL for a given testnr using the persisted handle (or fallback input files)
async function loadSelectedTensoFiles(testnr) {
	try {
		fileText.value = ''
		tblText.value = ''
		parsedParData.value = {}
		// Do not clear parsedTblData here to avoid UI flicker when switching between rows.
		// parsedTblData will be replaced only after new data is parsed.
		selectedTblName.value = ''
		tblTestnr.value = testnr

		// Try to read from the in-memory scan list first (these entries may include file handles)
		const item = Array.isArray(tensoScanList.value) ? tensoScanList.value.find(x => x.testnr === testnr) : null
		if (item) {
			// If scan stored handles, use them (faster and less chance of missing files)
			try {
				if (item.parHandle && typeof item.parHandle.getFile === 'function') {
					const pf = await item.parHandle.getFile()
					fileText.value = await pf.text()
					// Parse PAR data
					parsedParData.value = parseParText(fileText.value)
				}
			} catch (err) {
				console.warn('reading .PAR from scan-list handles failed', err)
			}
			try {
				if (item.tblHandle && typeof item.tblHandle.getFile === 'function') {
					const tf = await item.tblHandle.getFile()
					tblText.value = await tf.text()
					selectedTblName.value = tf.name || ''
					parseTblText(tblText.value)
				}
			} catch (err) {
				console.warn('reading .TBL from scan-list handles failed', err)
			}
			// if we got anything, return early
			if (fileText.value || tblText.value) return
		}

		// Fallback: read from the persisted directory handle (if any)
		const dh = await getDirHandleFromIDB('dir-tenso')
		if (!dh) {
			tensoScanStatus.value = 'No hay acceso directo a la carpeta (fallback). Usa Seleccionar para elegir carpeta.'
			return
		}
		const ok = await verifyPermission(dh, 'read')
		if (!ok) {
			tensoScanStatus.value = 'Permiso denegado para leer la carpeta. Vuelve a seleccionar la carpeta.'
			return
		}

		for await (const [name, handle] of dh.entries()) {
			try {
				if (!handle || handle.kind !== 'file') continue
				const ln = String(name || '').toLowerCase()
				if (!String(name).includes(testnr)) continue
				if (ln.endsWith('.par')) {
					try {
						const f = await handle.getFile()
						fileText.value = await f.text()
						// Parse PAR data
						parsedParData.value = parseParText(fileText.value)
					} catch (err) {
						console.warn('reading .PAR selected', err)
					}
				}
				if (ln.endsWith('.tbl')) {
					try {
						const f = await handle.getFile()
						tblText.value = await f.text()
						selectedTblName.value = f.name || ''
						parseTblText(tblText.value)
					} catch (err) {
						console.warn('reading .TBL selected', err)
					}
				}
			} catch (err) {
				// Protect the loop from unexpected handle errors
				console.warn('error iterating directory entries', err)
			}
		}
	} catch (err) { console.warn('loadSelectedTensoFiles error', err); tensoScanStatus.value = 'Error al cargar archivos seleccionados: ' + (err && err.message ? err.message : String(err)) }
}

function parseTblText(text) {
	tblText.value = text || ''
	if (!text) return
	const lines = text.split(/\r?\n/)
	// startIndex 5 => line 6 (1-based rows: 6..)
	const startIndex = 5

	// derive TESTNR from selectedTblName (chars 7..12 -> slice(6,12)), fallback to provided tblTestnr
	let testnrFromName = ''
	if (selectedTblName.value && selectedTblName.value.length >= 12) {
		testnrFromName = selectedTblName.value.slice(6, 12)
	} else if (selectedTblName.value) {
		const m = (selectedTblName.value || '').match(/(\d{4,6})/)
		testnrFromName = m ? m[1] : ''
	}
	if (!testnrFromName && tblTestnr.value) testnrFromName = tblTestnr.value

	// build rows locally to avoid mutating the reactive array until ready
	const rows = []
	for (let i = startIndex; i < lines.length; i++) {
		const row = lines[i]
		const cleanRow = row && row.charCodeAt(0) === 0xFEFF ? row.slice(1) : row
		if (!cleanRow || cleanRow.trim() === '') break
		const cols = cleanRow.split('\t').map(c => (c || '').trim())
		// Build row as [TESTNR, NO., TIEMPO_ROTURA, FUERZA_B, ELONGACION, TENACIDAD, TRABAJO]
		const rowData = [testnrFromName]
		// columns 1..6 map to cols[0]..cols[5]
		for (let ci = 0; ci < 6; ci++) {
			rowData.push(cols[ci] || '')
		}
		rows.push(rowData)
	}
	// Replace reactive array in one assignment to minimize reactivity churn
	parsedTblData.value = rows
}

const fileText = ref('')
const tblText = ref('')
const selectedTblName = ref('')
const tblTestnr = ref('')
const parsedTblData = ref([])
const parsedParData = ref({})

// Computed property para formatear la fecha del campo TIME a dd/mm/yyyy
const formattedTimeDate = computed(() => {
	if (!parsedParData.value || !parsedParData.value.TIME) return ''
	const timeStr = parsedParData.value.TIME.trim()
	if (!timeStr) return ''
	
	// El formato TIME de TensoRapid .PAR es "dd.mm.yyyy" (columna 8 de la línea TIME)
	try {
		const parts = timeStr.split('.')
		
		if (parts.length === 3) {
			const day = parts[0].padStart(2, '0')
			const month = parts[1].padStart(2, '0')
			const year = parts[2]
			return `${day}/${month}/${year}`
		}
	} catch (err) {
		console.warn('Error formateando fecha TIME:', err)
	}
	return ''
})

// Prepared TBL data as it will be sent to the backend (matching saveToOracle mapping)
const preparedTblPreview = computed(() => {
	try {
		return (parsedTblData.value || []).map((row, index) => {
			const husoEnsayos = row[1] && row[1].trim() !== '' ? row[1].trim() : ''
			let husoNumber = null
			if (husoEnsayos) {
				const match = husoEnsayos.match(/^(\d+)\//)
				if (match && match[1]) husoNumber = parseInt(match[1], 10)
			}
			if (!husoNumber || isNaN(husoNumber)) husoNumber = index + 1

			return {
				TESTNR: row[0] || tblTestnr.value,
				HUSO_ENSAYOS: husoEnsayos,
				HUSO_NUMBER: husoNumber,
				TIEMPO_ROTURA: row[2] && row[2].trim() !== '' ? row[2] : '',
				FUERZA_B: row[3] && row[3].trim() !== '' ? row[3] : '',
				ELONGACION: row[4] && row[4].trim() !== '' ? row[4] : '',
				TENACIDAD: row[5] && row[5].trim() !== '' ? row[5] : '',
				TRABAJO: row[6] && row[6].trim() !== '' ? row[6] : ''
			}
		})
	} catch (err) {
		console.warn('preparedTblPreview compute error', err)
		return []
	}
})

// TensoRapid .PAR file field mapping (row, column as specified)
const tensoParFields = [
	{ field: 'CATALOG', row: 3, col: 1 },
	{ field: 'TESTNR', row: 8, col: 5 },
	{ field: 'TIME', row: 9, col: 8 },
	{ field: 'SORTIMENT', row: 10, col: 5 },
	{ field: 'ARTICLE', row: 11, col: 5 },
	{ field: 'MASCHNR', row: 12, col: 5 },
	{ field: 'MATCLASS', row: 13, col: 8 },
	{ field: 'NOMCOUNT', row: 14, col: 5 },
	{ field: 'NOMTWIST', row: 15, col: 5 },
	{ field: 'USCODE', row: 17, col: 8 },
	{ field: 'LABORANT', row: 18, col: 5 },
	{ field: 'COMMENT', row: 19, col: 5 },
	{ field: 'LOTE', row: 20, col: 5 },
	{ field: 'TUNAME', row: 24, col: 5 },
	{ field: 'GROUPS', row: 25, col: 5 },
	{ field: 'WITHIN', row: 26, col: 5 },
	{ field: 'TOTAL', row: 27, col: 5 },
	{ field: 'UNSPOOLGROUPS', row: 29, col: 5 },
	{ field: 'LENGTH', row: 30, col: 5 },
	{ field: 'EXTSPEED', row: 31, col: 5 },
	{ field: 'PRETENSION', row: 32, col: 5 },
	{ field: 'CLAMPPRESSURE', row: 33, col: 5 },
	{ field: 'CYCLEFORCELL', row: 34, col: 5 },
	{ field: 'CYCLEFORCEUL', row: 35, col: 5 },
	{ field: 'NMBOFFORCECYCLES', row: 36, col: 5 },
	{ field: 'CYCLELONGLL', row: 37, col: 5 },
	{ field: 'CYCLELONGUL', row: 38, col: 5 },
	{ field: 'NMBOFELONGCYCLES', row: 39, col: 5 },
	{ field: 'FORCEF1REL', row: 40, col: 5 },
	{ field: 'ELONGATIONE1REL', row: 41, col: 5 },
	{ field: 'EVALTIMEREL', row: 42, col: 5 },
	{ field: 'PRELOADCYCLESREL', row: 43, col: 5 },
	{ field: 'FORCEF1RET', row: 44, col: 5 },
	{ field: 'ELONGATIONE1RET', row: 45, col: 5 },
	{ field: 'EVALTIMERET', row: 46, col: 5 },
	{ field: 'PRELOADCYCLESRET', row: 47, col: 5 }
]

// Parse .PAR file and extract all fields according to tensoParFields mapping
function parseParText(text) {
	const data = {}
	if (!text) return data

	for (const fieldDef of tensoParFields) {
		const value = extractTsvCell(text, fieldDef.row, fieldDef.col)
		data[fieldDef.field] = value != null ? String(value).trim() : ''
	}

	return data
}

// IndexedDB helpers (store handles)
function openDb() {
	return new Promise((resolve, reject) => {
		// Open without explicit version so we don't attempt to open with a lower version than
		// the one already present in the browser (which throws VersionError).
		const r = window.indexedDB.open('carga-uster')
		r.onupgradeneeded = () => {
			const db = r.result
			if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles')
		}
		r.onsuccess = () => resolve(r.result)
		r.onerror = () => reject(r.error)
	})
}
async function saveDirHandleToIDB(dirHandle, key = 'dir-tenso') {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('handles', 'readwrite')
		const store = tx.objectStore('handles')
		const req = store.put(dirHandle, key)
		req.onsuccess = () => resolve(true)
		req.onerror = () => reject(req.error)
	})
}
async function getDirHandleFromIDB(key = 'dir-tenso') {
	const db = await openDb()
	return new Promise((resolve, reject) => {
		const tx = db.transaction('handles', 'readonly')
		const store = tx.objectStore('handles')
		const req = store.get(key)
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}
async function verifyPermission(handle, mode = 'read') {
	if (!handle) return false
	try {
		const opts = { mode }
		if (await handle.queryPermission(opts) === 'granted') return true
		if (await handle.requestPermission(opts) === 'granted') return true
	} catch (err) { console.warn('verifyPermission error', err) }
	return false
}

// extract cell from TSV-like .PAR (1-based rows/cols)
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

// scan directory handle for .PAR/.TBL files
async function scanTensoDirectory(dirHandle) {
	const map = {}
	try {
		isScanning.value = true
		for await (const [name, handle] of dirHandle.entries()) {
			if (!handle || handle.kind !== 'file') continue
			const ln = String(name || '').toLowerCase()
			if (!(ln.endsWith('.par') || ln.endsWith('.tbl'))) continue
			// extract ensayo from characters 7..12 (1-based inclusive => slice(6,12))
			const rawName = String(name || '')
			let t = ''
			if (rawName.length >= 12) t = rawName.slice(6, 12)
			// fallback: 5-digit regex
			if (!t || !/\d{4,6}/.test(t)) {
				const m = rawName.match(/(\d{5})/) || []
				t = m[1] || ''
			}
			if (!t) continue
			if (!map[t]) map[t] = { testnr: t, hasPar: false, hasTbl: false, parHandle: null, tblHandle: null, nomcount: '', maschnr: '' }
			if (ln.endsWith('.par')) {
				map[t].hasPar = true
				map[t].parHandle = handle
				try {
					const f = await handle.getFile()
					const txt = await f.text()
					// Ne (NOMCOUNT) está en la fila 14, columna 5 según especificación
					map[t].nomcount = extractTsvCell(txt, 14, 5) || ''
					// MASCHNR está en la fila 12, columna 5
					map[t].maschnr = extractTsvCell(txt, 12, 5) || ''
				} catch (err) { console.warn('reading .PAR during scan', name, err) }
			}
			if (ln.endsWith('.tbl')) { map[t].hasTbl = true; map[t].tblHandle = handle }
		}
	} catch (err) { console.warn('scanTensoDirectory error', err) }
	finally { isScanning.value = false }

	const totalFound = Object.values(map).length
	// Consultar BD inmediatamente para obtener estado guardado antes de renderizar la lista
	try {
		const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
			? 'http://localhost:3001'
			: ''
		const endpoint = '/api/tensorapid/status'
		const testnrs = Object.values(map).map(it => it.testnr)
		if (testnrs.length > 0) {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ testnrs }),
				credentials: 'include'
			})
			if (response.ok) {
				const data = await response.json()
				const existingSet = new Set(data.existing || [])
				const details = data.details || {}
				// Marcar en el map
				Object.values(map).forEach(item => {
					item.saved = existingSet.has(item.testnr)
					item.isEditing = false // Asegurar que no esté en modo edición
					item.usterTestnr = padUsterTestnr(details[item.testnr]?.usterTestnr || '')
				})
			}
		}
	} catch (err) {
		console.warn('Error checking tensorapid status (pre-assign):', err)
	}

	// ahora asignar la lista ya con flags de "saved"
	tensoScanList.value = Object.values(map).sort((a, b) => a.testnr.localeCompare(b.testnr))
	// estado inicial con números si están disponibles
	const savedCnt = Object.values(map).reduce((acc, it) => acc + (it.saved ? 1 : 0), 0)
	tensoScanStatus.value = formatScanStatus(totalFound, savedCnt, filterMode.value)

	// Verificar cuáles ensayos ya están guardados en la BD
	if (tensoScanList.value.length > 0) {
		try {
			const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
				? 'http://localhost:3001'
				: ''
			const endpoint = '/api/tensorapid/status'
			const testnrs = tensoScanList.value.map(item => item.testnr)

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ testnrs }),
				credentials: 'include'
			})

			if (response.ok) {
				const data = await response.json()
				const existingSet = new Set(data.existing || [])
				const details = data.details || {}

				// Marcar ensayos guardados y cargar USTER_TESTNR desde BD
				tensoScanList.value.forEach(item => {
					item.saved = existingSet.has(item.testnr)
					item.isEditing = false // Asegurar que no esté en modo edición
					item.usterTestnr = padUsterTestnr(details[item.testnr]?.usterTestnr || '')
				})

				// Actualizar texto de estado con números exactos después de consultar BD
				const total = tensoScanList.value.length
				const savedCount = tensoScanList.value.reduce((acc, it) => acc + (it.saved ? 1 : 0), 0)
				tensoScanStatus.value = formatScanStatus(total, savedCount, filterMode.value)
			}
		} catch (err) {
			console.warn('Error checking tensorapid status:', err)
		}
	}

	try { localStorage.setItem('tenso.scanSnapshot', JSON.stringify(tensoScanList.value)) } catch (err) { console.warn('persist snapshot failed', err) }
}

// Select folder (File System Access API) or fallback to hidden input
async function selectTensoFolder() {
	try {
		if (typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function') {
			const dh = await window.showDirectoryPicker()
			if (!dh) return
			await saveDirHandleToIDB(dh, 'dir-tenso')
			tensoHasPersistedHandle.value = true
			tensoFolderPathFull.value = dh.name || ''
			await scanTensoDirectory(dh)
			return
		}
		// fallback to input (scan only, do not persist files)
		if (tensoFolderInputLocal && tensoFolderInputLocal.value) tensoFolderInputLocal.value.click()
	} catch (err) { console.warn('selectTensoFolder error', err) }
}

async function refreshTensoFolder() {
	try {
		const dh = await getDirHandleFromIDB('dir-tenso')
		if (!dh) return selectTensoFolder()
		const ok = await verifyPermission(dh, 'read')
		if (!ok) return selectTensoFolder()
		tensoHasPersistedHandle.value = true
		tensoFolderPathFull.value = dh.name || ''
		await scanTensoDirectory(dh)
	} catch (err) { console.warn('refreshTensoFolder error', err) }
}

async function onTensoFolderInputChangeLocal(e) {
	try {
		const files = e && e.target && e.target.files ? Array.from(e.target.files) : []
		const map = {}
		for (const f of files) {
			const name = f.name || ''
			const ln = name.toLowerCase()
			if (!(ln.endsWith('.par') || ln.endsWith('.tbl'))) continue
			let t = ''
			if (name.length >= 12) t = name.slice(6, 12)
			if (!t || !/\d{4,6}/.test(t)) {
				const m = name.match(/(\d{5})/) || []
				t = m[1] || ''
			}
			if (!t) continue
			if (!map[t]) map[t] = { testnr: t, hasPar: false, hasTbl: false, nomcount: '', maschnr: '' }
			if (ln.endsWith('.par')) {
				map[t].hasPar = true
				try { const txt = await f.text(); map[t].nomcount = extractTsvCell(txt, 14, 5) || ''; map[t].maschnr = extractTsvCell(txt, 12, 5) || '' } catch (err) { console.warn('reading .PAR fallback', err) }
			}
			if (ln.endsWith('.tbl')) map[t].hasTbl = true
		}
		// Consultar BD inmediatamente para obtener estado guardado antes de asignar
		try {
			const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
				? 'http://localhost:3001'
				: ''
			const endpoint = '/api/tensorapid/status'
			const testnrs = Object.values(map).map(it => it.testnr)
			if (testnrs.length > 0) {
				const response = await fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ testnrs }),
					credentials: 'include'
				})
				if (response.ok) {
					const data = await response.json()
					const existingSet = new Set(data.existing || [])
					const details = data.details || {}
					Object.values(map).forEach(item => {
						item.saved = existingSet.has(item.testnr)
						item.isEditing = false // Asegurar que no esté en modo edición
						item.usterTestnr = padUsterTestnr(details[item.testnr]?.usterTestnr || '')
					})
				}
			}
		} catch (err) { console.warn('Error checking tensorapid status (input pre-assign):', err) }

		tensoScanList.value = Object.values(map).sort((a, b) => a.testnr.localeCompare(b.testnr))
		const totalIn = tensoScanList.value.length
		const savedCntIn = tensoScanList.value.reduce((acc, it) => acc + (it.saved ? 1 : 0), 0)
		tensoScanStatus.value = formatScanStatus(totalIn, savedCntIn, filterMode.value)

		// Verificar cuáles ensayos ya están guardados en la BD
		if (tensoScanList.value.length > 0) {
			try {
				const backendUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
					? 'http://localhost:3001'
					: ''
				const endpoint = '/api/tensorapid/status'
				const testnrs = tensoScanList.value.map(item => item.testnr)

				const response = await fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ testnrs }),
					credentials: 'include'
				})

				if (response.ok) {
					const data = await response.json()
					const existingSet = new Set(data.existing || [])

					// Marcar ensayos guardados y agregar campo usterTestnr vacío
					tensoScanList.value.forEach(item => {
						item.saved = existingSet.has(item.testnr)
						item.isEditing = false // Asegurar que no esté en modo edición
						item.usterTestnr = ''
					})
				}
			} catch (err) {
				console.warn('Error checking tensorapid status:', err)
			}
		}

		try { localStorage.setItem('tenso.scanSnapshot', JSON.stringify(tensoScanList.value)) } catch (err) { console.warn('persist snapshot failed', err) }
	} catch (err) { console.warn('onTensoFolderInputChangeLocal error', err) }
}

onMounted(() => {
	if (typeof window !== 'undefined' && typeof window.document !== 'undefined') window.document.title = 'TensoRapid'
	// try to load existing snapshot from localStorage
	try {
		const raw = localStorage.getItem('tenso.scanSnapshot')
		if (raw) {
			const parsed = JSON.parse(raw)
			if (Array.isArray(parsed)) {
				tensoScanList.value = parsed
				tensoScanStatus.value = formatScanStatus(parsed.length, null, filterMode.value)
			}
		}
	} catch { /* ignore */ }

	// Ensure preview pane is empty on first render (no preloaded file/tbl data)
	try {
		fileText.value = ''
		tblText.value = ''
		parsedTblData.value = []
		selectedTblName.value = ''
		tblTestnr.value = ''
	} catch { /* noop */ }

	// try to auto-load persisted dir handle 'dir-tenso' and scan it
	; (async () => {
		try {
			const dh = await getDirHandleFromIDB('dir-tenso')
			if (!dh) return
			const ok = await verifyPermission(dh, 'read')
			if (!ok) {
				console.warn('No permission to access persisted dir-tenso')
				return
			}
			tensoHasPersistedHandle.value = true
			tensoFolderPathFull.value = dh.name || ''
			await scanTensoDirectory(dh)
		} catch (err) {
			console.warn('auto-load dir-tenso failed', err)
		}
	})()
})
</script>

<style scoped>
.focus-highlight {
	box-shadow: 0 0 0 3px rgba(250, 204, 21, 0.4);
	/* soft yellow halo */
	background-color: #fff8db;
	/* light yellow background */
	transition: box-shadow 200ms ease, background-color 200ms ease;
}
</style>

<style scoped>
.scan-container {
	max-height: 16rem;
	overflow-y: auto;
	overflow-x: hidden;
	/* Allow fluid width so the table can expand to its container instead of being fixed */
	width: auto;
}

/* Force fixed table layout so col widths from global CSS (col-ensayo, col-par, etc.) are respected */
.scan-table {
	table-layout: fixed;
	width: 100%;
}

/* Column classes for TBL preview */
.tbl-col-test {
	/* Reduced by 40% per request: 68px -> 41px */
	width: 41px;
}

.tbl-col-tiempo {
	/* Reduced by 50% (halved) per request */
	width: 35px;
}

.tbl-td-tiempo {
	/* Allow breaking when the cell can't fit in one line */
	white-space: normal;
	word-break: break-word;
}

/* Grid: left column fixed on xl and above, right column flexible. Moved from inline style to CSS. */
.tenso-grid {
	/* default single-column (mobile) kept by Tailwind grid-cols-1 */
	grid-template-columns: 1fr;
}

@media (min-width: 1280px) {
	.tenso-grid {
		grid-template-columns: 672px 1fr;
	}
}

/* Acción column width handled via class on <col> */
.col-accion {
	width: 244px;
}

/* Center table content horizontally and vertically for Datos .TBL */
.tbl-centered th,
.tbl-centered td {
	text-align: center;
	vertical-align: middle;
}

/* Fade transition for action buttons */
.fade-enter-active,
.fade-leave-active {
	transition: opacity 180ms ease, transform 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
	opacity: 0;
	transform: translateY(-6px);
}

.fade-enter-to,
.fade-leave-from {
	opacity: 1;
	transform: translateY(0);
}
</style>
