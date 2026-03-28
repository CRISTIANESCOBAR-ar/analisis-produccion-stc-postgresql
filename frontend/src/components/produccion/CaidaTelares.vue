<template>
  <section class="p-4 md:p-6 space-y-4" @click="closeDropdown">
    <header class="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
      <h1 class="text-2xl font-semibold text-slate-800">Caida de Telares</h1>
      <p class="text-sm text-slate-600 mt-1">Vista tipo Excel para seguimiento de caidas por turno en tejeduria.</p>

      <div class="mt-4 flex flex-wrap items-center gap-3">
        <label class="text-sm text-slate-700 font-medium">Turno:</label>
        <div class="inline-flex rounded-md border border-slate-300 overflow-hidden">
          <button
            v-for="t in turnos"
            :key="t"
            type="button"
            class="px-4 py-2 text-sm border-r border-slate-300 last:border-r-0"
            :class="turno === t ? 'bg-emerald-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'"
            @click.stop="cambiarTurno(t)"
          >
            {{ t }}
          </button>
        </div>

        <button
          type="button"
          class="px-4 py-2 text-sm rounded-md bg-slate-800 text-white hover:bg-slate-700"
          @click.stop="cargarDatos"
        >
          Actualizar
        </button>

        <span class="text-sm text-slate-500">
          Registros: {{ filasFiltradas.length }}
          <span v-if="hayFiltros" class="text-amber-600 font-medium"> (de {{ filas.length }} totales)</span>
        </span>
        <button
          v-if="hayFiltros"
          type="button"
          class="px-3 py-2 text-sm rounded-md border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100"
          @click.stop="limpiarFiltros"
        >
          ✕ Limpiar filtros
        </button>
      </div>
    </header>

    <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3">
      {{ error }}
    </div>

    <div v-if="loading" class="bg-white border border-slate-200 rounded-lg p-10 text-center text-slate-600">
      Cargando datos de caidas...
    </div>

    <article v-else class="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
      <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 text-sm text-slate-700 flex flex-wrap gap-5">
        <span><strong>C4 (SUBTOTAL 3 Articulo):</strong> {{ subtotales.c4 }}</span>
        <span><strong>J4 (SUBTOTAL 9 Metros):</strong> {{ formatearExcel(subtotales.j4, 0) }}</span>
        <span><strong>V4 (SUBTOTAL 1 Efi):</strong> {{ formatearExcel(subtotales.v4, 1) }}</span>
        <span><strong>Y4 (SUBTOTAL 9 Tejido):</strong> {{ formatearExcel(subtotales.y4, 0) }}</span>
        <span><strong>Z4 (SUBTOTAL 9 Resto):</strong> {{ formatearExcel(subtotales.z4, 0) }}</span>
      </div>

      <div class="excel-wrap" @click.stop>
        <table class="excel-table">
          <thead>
            <tr>
              <th
                v-for="col in COLS"
                :key="col.key"
                :class="[col.num ? 'num' : '', activeFilters[col.key] ? 'th-filtered' : '']"
                @click.stop="openDropdown(col.key, $event)"
              >
                <div class="th-inner">
                  <template v-if="col.editableHeader">
                    <input
                      type="number"
                      v-model.number="horasN"
                      min="1"
                      class="th-input"
                      @click.stop
                      @keydown.stop
                    />
                    <span class="th-unit">h</span>
                  </template>
                  <span v-else class="th-label">{{ col.label }}</span>
                  <span class="dd-arrow" :class="{ 'dd-active': activeFilters[col.key] }">&#9660;</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in filasFiltradas" :key="`${row.telar}-${row.artigo}-${idx}`">
              <td>{{ row.tipo || '-' }}</td>
              <td>{{ row.artigo || '-' }}</td>
              <td>{{ row.color || '-' }}</td>
              <td :title="row.nombre || ''">{{ recortar(row.nombre, 36) }}</td>
              <td>{{ row.trama || '-' }}</td>
              <td class="num">{{ formatearExcel(row.pas, 1) }}</td>
              <td class="num">{{ formatearExcel(row.ancho, 0) }}</td>
              <td>{{ row.partida || '-' }}</td>
              <td class="num">{{ formatearExcel(row.metros, 0) }}</td>
              <td>{{ row.s || row.status || '-' }}</td>
              <td class="num">{{ formatearExcel(row.telar, 0) }}</td>
              <td>{{ row.caida || '--/--/---- --:--' }}</td>
              <td>{{ row.turno_caida || '--' }}</td>
              <td class="num">{{ formatearExcel(row.rpm, 0) }}</td>
              <td class="num">{{ formatearExcel(row.grupo, 0) }}</td>
              <td>{{ row.base_urdume || '-' }}</td>
              <td>{{ row.color_urdume || '-' }}</td>
              <td class="num">{{ formatearExcel(row.hilos, 0) }}</td>
              <td>{{ row.sarja || '-' }}</td>
              <td class="num">{{ formatearExcel(row.rolada, 0) }}</td>
              <td class="num">{{ formatearExcel(row.efi, 1) }}</td>
              <td class="num">{{ formatearExcel(row.metros_a_tejer, 0) }}</td>
              <td class="num">{{ formatearExcel(calcM_N(row), 0) }}</td>
              <td class="num">{{ formatearExcel(calcTejido(row), 0) }}</td>
              <td class="num">{{ formatearExcel(calcResto(row), 0) }}</td>
            </tr>
            <tr v-if="filasFiltradas.length === 0">
              <td colspan="25" class="empty">
                {{ hayFiltros ? 'Ningún registro coincide con los filtros aplicados.' : 'No hay datos para el turno seleccionado.' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>

    <!-- Dropdown estilo Excel (teleportado al body para escapar overflow) -->
    <Teleport to="body">
      <div
        v-if="dropdownCol"
        class="xl-dd-panel"
        :style="ddPanelStyle"
        @click.stop
      >
        <div class="xl-dd-search-wrap">
          <input
            ref="searchInputRef"
            v-model="dropdownSearch"
            class="xl-dd-search"
            placeholder="🔍 Buscar..."
            @keydown.esc="closeDropdown"
          >
        </div>
        <div class="xl-dd-list">
          <label class="xl-dd-item xl-dd-all">
            <input
              type="checkbox"
              :checked="pendingAllChecked"
              :indeterminate.prop="pendingIndeterminate"
              @change="toggleAll"
            >
            <span>(Seleccionar todo)</span>
          </label>
          <label v-for="val in filteredDdValues" :key="val" class="xl-dd-item">
            <input
              type="checkbox"
              :checked="pendingSet.has(val)"
              @change="togglePendingValue(val)"
            >
            <span>{{ val }}</span>
          </label>
        </div>
        <div class="xl-dd-footer">
          <button class="xl-dd-btn-ok" @click="applyFilter">Aceptar</button>
          <button class="xl-dd-btn-cancel" @click="closeDropdown">Cancelar</button>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { fetchEficienciasDetalle } from '@/services/eficienciasService'

// Definición declarativa de columnas
const COLS = [
  { key: 'tipo',           label: 'T',              get: r => r.tipo },
  { key: 'artigo',         label: 'Articulo',        get: r => r.artigo },
  { key: 'color',          label: 'Color',           get: r => r.color },
  { key: 'nombre',         label: 'Nombre',          get: r => r.nombre },
  { key: 'trama',          label: 'Trama',           get: r => r.trama },
  { key: 'pas',            label: 'Pas',    num: true, get: r => r.pas },
  { key: 'ancho',          label: 'Ancho',  num: true, get: r => r.ancho },
  { key: 'partida',        label: 'Partida',         get: r => r.partida },
  { key: 'metros',         label: 'Metros', num: true, get: r => r.metros },
  { key: 'status',         label: 'S',               get: r => r.s ?? r.status },
  { key: 'telar',          label: 'Telar',  num: true, get: r => r.telar },
  { key: 'caida',          label: 'Caida',           get: r => r.caida },
  { key: 'turno_col',      label: 'Turno',           get: r => r.turno_caida },
  { key: 'rpm',            label: 'Rpm',    num: true, get: r => r.rpm },
  { key: 'grupo',          label: 'Gpo',    num: true, get: r => r.grupo },
  { key: 'base_urdume',    label: 'Base',            get: r => r.base_urdume },
  { key: 'color_urdume',   label: 'Color',           get: r => r.color_urdume },
  { key: 'hilos',          label: 'Hilos',  num: true, get: r => r.hilos },
  { key: 'sarja',          label: 'Sarja',           get: r => r.sarja },
  { key: 'rolada',         label: 'Rolada', num: true, get: r => r.rolada },
  { key: 'efi',            label: 'Efi',    num: true, get: r => r.efi },
  { key: 'metros_a_tejer', label: 'Metros A Tejer', num: true, get: r => r.metros_a_tejer },
  { key: 'm24',            label: '24h',    num: true, editableHeader: true, get: r => r.m24 },
  { key: 'tejido',         label: 'Tejido', num: true, get: r => calcTejido(r) },
  { key: 'resto',          label: 'Resto',  num: true, get: r => calcResto(r) },
]

const turnos = ['A', 'B', 'C', 'DIA']
const turno = ref('DIA')
const horasN = ref(24)

function toNumber(value) {
  const num = Number.parseFloat(value)
  return Number.isFinite(num) ? num : 0
}

// Metros terminados en N horas con eficiencia real del turno
// Fórmula: (MT_PROX24H / 24) × N × (EFIC_X / 90) × ((100 - ENC_URD) / 100)
function calcM_N(row) {
  const m24 = toNumber(row.m24)
  const efi = toNumber(row.efi)
  const encUrd = toNumber(row.enc_urd)
  const n = toNumber(horasN.value)
  if (m24 === 0 || n === 0) return 0
  return (m24 / 24) * n * (efi / 90) * ((100 - encUrd) / 100)
}

// Excel Y = SI((J-W+X)>J;J;(J-W+X))
function calcTejido(row) {
  const j = toNumber(row.metros)
  const w = toNumber(row.metros_a_tejer)
  const x = calcM_N(row)
  const y = j - w + x
  return y > j ? j : y
}

// Excel Z = J - Y
function calcResto(row) {
  const j = toNumber(row.metros)
  return j - calcTejido(row)
}

const filas = ref([])
const loading = ref(false)
const error = ref('')

// Filtros activos: colKey → Set<string> (undefined = sin filtro)
const activeFilters = reactive({})

// Estado del dropdown
const dropdownCol = ref(null)
const dropdownSearch = ref('')
const ddPanelStyle = ref({})
const pendingSet = ref(new Set())
const searchInputRef = ref(null)

// ---- Helpers ----

function formatearExcel(value, dec = 0) {
  const num = Number.parseFloat(value)
  if (!Number.isFinite(num)) return '-'
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec
  })
}

function recortar(texto, maxLen = 36) {
  if (!texto) return '-'
  return texto.length > maxLen ? `${texto.slice(0, maxLen)}...` : texto
}

function getRawVal(colKey, row) {
  const col = COLS.find(c => c.key === colKey)
  if (!col) return '-'
  const v = col.get(row)
  return (v != null && v !== '') ? String(v) : '-'
}

function uniqueValsForCol(colKey) {
  const seen = new Set()
  filas.value.forEach(row => seen.add(getRawVal(colKey, row)))
  const col = COLS.find(c => c.key === colKey)
  return [...seen].sort((a, b) => {
    if (col?.num) {
      const na = Number(a), nb = Number(b)
      if (!isNaN(na) && !isNaN(nb)) return na - nb
    }
    return a.localeCompare(b, 'es', { numeric: true })
  })
}

// ---- Filtros ----

const hayFiltros = computed(() =>
  COLS.some(col => activeFilters[col.key] !== undefined)
)

function limpiarFiltros() {
  COLS.forEach(col => { delete activeFilters[col.key] })
  closeDropdown()
}

const filasFiltradas = computed(() =>
  filas.value.filter(row =>
    COLS.every(col => {
      const filter = activeFilters[col.key]
      if (!filter) return true
      return filter.has(getRawVal(col.key, row))
    })
  )
)

// ---- Dropdown ----

function openDropdown(colKey, event) {
  if (dropdownCol.value === colKey) {
    closeDropdown()
    return
  }
  const rect = event.currentTarget.getBoundingClientRect()
  ddPanelStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 2}px`,
    left: `${Math.min(rect.left, window.innerWidth - 256)}px`,
    zIndex: 9999,
  }
  dropdownSearch.value = ''
  dropdownCol.value = colKey
  const active = activeFilters[colKey]
  pendingSet.value = active ? new Set(active) : new Set(uniqueValsForCol(colKey))
  nextTick(() => searchInputRef.value?.focus())
}

function closeDropdown() {
  dropdownCol.value = null
  dropdownSearch.value = ''
}

const filteredDdValues = computed(() => {
  if (!dropdownCol.value) return []
  const all = uniqueValsForCol(dropdownCol.value)
  const s = dropdownSearch.value.toLowerCase()
  return s ? all.filter(v => v.toLowerCase().includes(s)) : all
})

const pendingAllChecked = computed(() => {
  if (!dropdownCol.value) return false
  return uniqueValsForCol(dropdownCol.value).every(v => pendingSet.value.has(v))
})

const pendingIndeterminate = computed(() => {
  if (!dropdownCol.value) return false
  const all = uniqueValsForCol(dropdownCol.value)
  const n = all.filter(v => pendingSet.value.has(v)).length
  return n > 0 && n < all.length
})

function toggleAll() {
  const all = uniqueValsForCol(dropdownCol.value)
  pendingSet.value = pendingAllChecked.value ? new Set() : new Set(all)
}

function togglePendingValue(val) {
  const s = new Set(pendingSet.value)
  if (s.has(val)) s.delete(val)
  else s.add(val)
  pendingSet.value = s
}

function applyFilter() {
  const colKey = dropdownCol.value
  if (!colKey) return
  const all = uniqueValsForCol(colKey)
  if (all.every(v => pendingSet.value.has(v))) {
    delete activeFilters[colKey]
  } else {
    activeFilters[colKey] = new Set(pendingSet.value)
  }
  closeDropdown()
}

// ---- Carga de datos ----

async function cargarDatos() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchEficienciasDetalle(turno.value)
    filas.value = Array.isArray(res?.data) ? res.data : []
    COLS.forEach(col => { delete activeFilters[col.key] })
  } catch (e) {
    filas.value = []
    error.value = e?.message || 'No se pudieron cargar las caidas de telares.'
  } finally {
    loading.value = false
  }
}

function cambiarTurno(value) {
  if (turno.value === value) return
  turno.value = value
  cargarDatos()
}

// ---- Subtotales ----

const subtotales = computed(() => {
  const data = filasFiltradas.value
  const c4 = data.length
  const j4 = data.reduce((acc, row) => acc + toNumber(row.metros), 0)
  const v4 = data.length
    ? data.reduce((acc, row) => acc + toNumber(row.efi), 0) / data.length
    : 0
  const y4 = data.reduce((acc, row) => acc + calcTejido(row), 0)
  const z4 = data.reduce((acc, row) => acc + calcResto(row), 0)
  return { c4, j4, v4, y4, z4 }
})

onMounted(cargarDatos)
</script>

<style scoped>
.excel-wrap {
  overflow: auto;
  max-height: calc(100vh - 240px);
}

.excel-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 2300px;
  font-size: 13px;
}

.excel-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f8fafc;
  color: #1e293b;
  border: 1px solid #cbd5e1;
  padding: 0;
  font-weight: 700;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

.excel-table thead th:hover {
  background: #e2e8f0;
}

.excel-table thead th.th-filtered {
  background: #dbeafe;
  color: #1d4ed8;
}

.th-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 8px 6px 8px 10px;
}

.th-label {
  flex: 1;
}

.num .th-inner {
  justify-content: flex-end;
}

.num .th-label {
  flex: unset;
}

.dd-arrow {
  font-size: 9px;
  color: #94a3b8;
  flex-shrink: 0;
}

.dd-arrow.dd-active {
  color: #1d4ed8;
  font-weight: 900;
}

.excel-table td {
  border: 1px solid #e2e8f0;
  padding: 7px 10px;
  color: #334155;
  background: #ffffff;
}

.excel-table tbody tr:nth-child(even) td {
  background: #f8fafc;
}

.excel-table tbody tr:hover td {
  background: #ecfeff;
}

.num {
  text-align: right;
}

.mono {
  font-family: Consolas, 'Courier New', monospace;
}

.empty {
  text-align: center;
  padding: 18px;
  color: #64748b;
}

.th-input {
  width: 44px;
  border: 1px solid #94a3b8;
  border-radius: 3px;
  padding: 2px 4px;
  font-size: 12px;
  font-weight: 700;
  text-align: right;
  background: #ffffff;
  color: #1e293b;
  outline: none;
  appearance: textfield;
  -moz-appearance: textfield;
}
.th-input::-webkit-inner-spin-button,
.th-input::-webkit-outer-spin-button { -webkit-appearance: none; appearance: none; margin: 0; }
.th-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }

.th-unit {
  font-size: 11px;
  color: #64748b;
  font-weight: 600;
}
</style>

<!-- Estilos globales para el dropdown (Teleport escapa el scoped) -->
<style>
.xl-dd-panel {
  background: #ffffff;
  border: 1px solid #94a3b8;
  border-radius: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.22);
  width: 250px;
  display: flex;
  flex-direction: column;
  max-height: 380px;
  overflow: hidden;
  font-size: 13px;
  font-family: inherit;
}

.xl-dd-search-wrap {
  padding: 8px;
  border-bottom: 1px solid #e2e8f0;
}

.xl-dd-search {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #94a3b8;
  border-radius: 3px;
  padding: 5px 8px;
  font-size: 12px;
  outline: none;
  font-family: inherit;
}

.xl-dd-search:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.xl-dd-list {
  overflow-y: auto;
  flex: 1;
  padding: 4px 0;
}

.xl-dd-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  color: #334155;
}

.xl-dd-item:hover {
  background: #f1f5f9;
}

.xl-dd-item input[type="checkbox"] {
  cursor: pointer;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  accent-color: #1d4ed8;
}

.xl-dd-all {
  font-weight: 600;
  border-bottom: 1px solid #e2e8f0;
  margin-bottom: 2px;
}

.xl-dd-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 8px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
}

.xl-dd-btn-ok {
  background: #1d4ed8;
  color: #ffffff;
  border: none;
  border-radius: 3px;
  padding: 5px 16px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.xl-dd-btn-ok:hover {
  background: #1e40af;
}

.xl-dd-btn-cancel {
  background: #ffffff;
  color: #475569;
  border: 1px solid #cbd5e1;
  border-radius: 3px;
  padding: 5px 14px;
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
}

.xl-dd-btn-cancel:hover {
  background: #e2e8f0;
}
</style>
