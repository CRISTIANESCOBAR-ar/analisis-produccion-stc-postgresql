<template>
  <section class="p-4 md:p-6 space-y-4">
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
            @click="cambiarTurno(t)"
          >
            {{ t }}
          </button>
        </div>

        <button
          type="button"
          class="px-4 py-2 text-sm rounded-md bg-slate-800 text-white hover:bg-slate-700"
          @click="cargarDatos"
        >
          Actualizar
        </button>

        <span class="text-sm text-slate-500">Registros: {{ filas.length }}</span>
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

      <div class="excel-wrap">
        <table class="excel-table">
          <thead>
            <tr>
              <th>T</th>
              <th>Articulo</th>
              <th>Color</th>
              <th>Nombre</th>
              <th>Trama</th>
              <th class="num">Pas</th>
              <th class="num">Ancho</th>
              <th>Partida</th>
              <th class="num">Metros</th>
              <th>S</th>
              <th class="num">Telar</th>
              <th>Caida</th>
              <th>Turno</th>
              <th class="num">Rpm</th>
              <th class="num">Gpo</th>
              <th>Base</th>
              <th>Color</th>
              <th class="num">Hilos</th>
              <th>Sarga</th>
              <th class="num">Rolada</th>
              <th class="num">Efi</th>
              <th class="num">Metros A Tejer</th>
              <th class="num">24</th>
              <th class="num">Tejido</th>
              <th class="num">Resto</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, idx) in filas" :key="`${row.telar}-${row.artigo}-${idx}`">
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
              <td class="mono">{{ row.caida || '--:--' }}</td>
              <td>{{ row.turno || turno }}</td>
              <td class="num">{{ formatearExcel(row.rpm, 0) }}</td>
              <td class="num">{{ formatearExcel(row.grupo, 0) }}</td>
              <td>{{ row.base_urdume || '-' }}</td>
              <td>{{ row.color_urdume || '-' }}</td>
              <td class="num">{{ formatearExcel(row.hilos, 0) }}</td>
              <td>{{ row.sarja || '-' }}</td>
              <td class="num">{{ formatearExcel(row.rolada, 0) }}</td>
              <td class="num">{{ formatearExcel(row.efi, 1) }}</td>
              <td class="num">{{ formatearExcel(row.metros_a_tejer, 0) }}</td>
              <td class="num">{{ formatearExcel(row.m24, 0) }}</td>
              <td class="num">{{ formatearExcel(row.tejido, 0) }}</td>
              <td class="num">{{ formatearExcel(row.resto, 0) }}</td>
            </tr>
            <tr v-if="filas.length === 0">
              <td colspan="25" class="empty">No hay datos para el turno seleccionado.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { fetchEficienciasDetalle } from '@/services/eficienciasService'

const turnos = ['A', 'B', 'C', 'DIA']
const turno = ref('DIA')
const filas = ref([])
const loading = ref(false)
const error = ref('')

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

async function cargarDatos() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchEficienciasDetalle(turno.value)
    filas.value = Array.isArray(res?.data) ? res.data : []
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

const subtotales = computed(() => {
  const data = Array.isArray(filas.value) ? filas.value : []
  const c4 = data.length
  const j4 = data.reduce((acc, row) => acc + (Number.parseFloat(row.metros) || 0), 0)
  const v4 = data.length
    ? data.reduce((acc, row) => acc + (Number.parseFloat(row.efi) || 0), 0) / data.length
    : 0
  const y4 = data.reduce((acc, row) => acc + (Number.parseFloat(row.tejido) || 0), 0)
  const z4 = data.reduce((acc, row) => acc + (Number.parseFloat(row.resto) || 0), 0)

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
  padding: 8px 10px;
  text-align: left;
  font-weight: 700;
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
</style>
