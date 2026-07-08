<template>
  <div class="flex flex-col h-full overflow-hidden bg-linear-to-br from-slate-50 to-blue-50 p-4">
    <div class="flex items-center justify-between gap-4 mb-4 bg-white/80 backdrop-blur-sm rounded-xl px-4 py-3 shadow-sm border border-slate-200 relative z-100">
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xl">📋</span>
        <h1 class="text-lg font-bold bg-linear-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">
          Meta por Revisor
        </h1>
      </div>

      <div class="h-6 w-px bg-slate-300 shrink-0"></div>

      <div class="flex items-center gap-3 shrink-0">
        <CustomDatepicker v-model="startDate" label="Desde" :show-buttons="false" />
        <CustomDatepicker v-model="endDate" label="Hasta" :show-buttons="false" />
      </div>

      <div class="flex items-center gap-2 ml-auto shrink-0">
        <button
          @click="loadData"
          :disabled="loading"
          class="w-9 h-9 flex items-center justify-center bg-linear-to-r from-indigo-600 to-indigo-500 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
        >
          <svg v-if="!loading" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 1 1-3-6.7" stroke-linecap="round" stroke-linejoin="round"></path>
            <polyline points="21 3 21 9 15 9" stroke-linecap="round" stroke-linejoin="round"></polyline>
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"></path>
          </svg>
        </button>

        <button
          @click="exportCsv"
          :disabled="loading || rows.length === 0"
          class="w-9 h-9 flex items-center justify-center bg-linear-to-r from-green-600 to-emerald-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md"
        >
          📥
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p class="text-slate-600">Cargando datos...</p>
      </div>
    </div>

    <div class="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-md">
      <table class="w-[850px] table-fixed divide-y divide-slate-200 text-xs">
        <thead class="bg-linear-to-r from-indigo-50 to-indigo-100 sticky top-0 z-20">
          <tr>
            <th class="w-28 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Dia</th>
            <th class="w-20 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Metas</th>
            <th class="w-24 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Revisado</th>
            <th class="w-24 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Saldo</th>
            <th class="w-24 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Meta Ajustada</th>
            <th class="w-20 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Revisores</th>
            <th class="w-32 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Revisado Promedio</th>
            <th class="w-20 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">1ra. %</th>
            <th class="w-24 px-3 py-2.5 text-left font-semibold text-slate-700 bg-indigo-50">Pts/100m²</th>
              </tr>
        </thead>
        <tbody>
          <tr v-for="r in monthRows" :key="r.Dia" class="border-b border-slate-100 hover:bg-indigo-50/20">
            <td class="px-3 py-2.5 text-sm text-slate-700">{{ formatDateLocal(r.Dia) }}</td>
            <td class="px-3 py-2.5 text-sm text-slate-700">{{ formatMeta(r.Revision) }}</td>
            <td class="px-3 py-2.5 text-sm text-slate-700">{{ r.Dia > endDate ? '' : formatRevisado(r.MetrosRevisados) }}</td>
            <td class="px-3 py-2.5 text-sm font-medium" :class="getSaldoClass(r)">
              {{ r.Dia > endDate ? '' : formatRevisado((r.MetrosRevisados || 0) - (r.Revision || 0)) }}
            </td>
            <td class="px-3 py-2.5 text-sm text-slate-700">{{ r.MetaAjustada !== null ? formatMeta(r.MetaAjustada) : '' }}</td>
            <td class="px-3 py-2.5 text-sm text-slate-700 cursor-help" :title="r.Revisores">
              {{ r.Dia > endDate ? '' : getRevisoresCount(r.Revisores) }}
            </td>
            <td class="px-3 py-2.5 text-sm text-slate-700">
              {{ r.Dia > endDate ? '' : formatPromedio(r.MetrosRevisados, r.Revisores) }}
            </td>
            <td class="px-3 py-2.5 text-sm text-slate-700">
              {{ r.Dia > endDate ? '' : formatPct(r.Pct1ra) }}
            </td>
            <td class="px-3 py-2.5 text-sm text-slate-700">
              {{ r.Dia > endDate ? '' : formatPts(r.Pts100m2) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import CustomDatepicker from '../CustomDatepicker.vue'

function pad(n){ return String(n).padStart(2,'0') }
function toYMD(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

const startDate = ref('')
const endDate = ref('')
const loading = ref(false)
const rows = ref([])

const days = computed(()=> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const last = new Date(year, month+1,0).getDate()
  const arr = []
  for(let i=1;i<=last;i++) arr.push(i)
  return arr
})

onMounted(()=>{
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  const yesterday = new Date(now); yesterday.setDate(now.getDate()-1)
  startDate.value = toYMD(first)
  endDate.value = toYMD(yesterday)
  loadData()
})

async function loadData(){
  loading.value = true
  rows.value = []
  try {
    // fecha seleccionada por el usuario (rango)
    const s = startDate.value || new Date().toISOString().slice(0,10)
    const e = endDate.value || new Date().toISOString().slice(0,10)

    // Determinar mes de referencia (usamos startDate para elegir el mes a mostrar)
    const ref = s ? new Date(s + 'T00:00:00') : new Date()
    const year = ref.getFullYear()
    const month = ref.getMonth()
    const monthStart = toYMD(new Date(year, month, 1))
    const monthEnd = toYMD(new Date(year, month + 1, 0))

    // Pedir metas para TODO el mes
    const metasPromise = fetch(`/api/metas/mes?start=${monthStart}&end=${monthEnd}`)
    // Pedir revisiones sólo para el rango seleccionado
    const revisionesPromise = fetch(`/api/metas/mes?start=${s}&end=${e}`)

    const [metasResp, revisionesResp] = await Promise.all([metasPromise, revisionesPromise])

    let metasRows = []
    if (metasResp.ok) {
      const data = await metasResp.json()
      metasRows = (data.rows || [])
    }

    // fallback a dataset estático si no hay metas para el mes
    if (!metasRows || metasRows.length === 0) metasRows = staticJune2026()

    // Revisiones (rango): extraer metros_revisados por día
    let revisionesRows = []
    if (revisionesResp.ok) {
      const data2 = await revisionesResp.json()
      revisionesRows = (data2.rows || [])
    }

    const revisMap = new Map((revisionesRows || []).map(r => [
      r.Dia,
      {
        MetrosRevisados: r.MetrosRevisados == null ? null : Number(r.MetrosRevisados),
        Revisores: r.Revisores || '',
        Pct1ra: r.Pct1ra == null ? null : Number(r.Pct1ra),
        Pts100m2: r.Pts100m2 == null ? null : Number(r.Pts100m2)
      }
    ]))

    // Construir mes combinado: metas del mes + metros revisados solo del rango
    const combined = (metasRows || []).map(m => {
      const revisData = revisMap.get(m.Dia) || { MetrosRevisados: null, Revisores: '', Pct1ra: null, Pts100m2: null }
      return {
        Dia: m.Dia,
        Revision: m.Revision == null ? null : Number(m.Revision),
        MetrosRevisados: revisData.MetrosRevisados,
        Revisores: revisData.Revisores,
        Pct1ra: revisData.Pct1ra,
        Pts100m2: revisData.Pts100m2
      }
    })

    monthRows.value = calculateMetaAjustada(combined)
    return
  } catch (err) {
    // fallback: usar dataset estático para junio 2026
    monthRows.value = calculateMetaAjustada(staticJune2026())
  } finally {
    loading.value = false
  }
}

const monthRows = ref([])

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatDateLocal(iso){
  try {
    if (!iso) return ''
    const d = new Date(iso + 'T00:00:00')
    if (isNaN(d.getTime())) return iso
    const ddd = WEEKDAYS[d.getDay()]
    const dd = String(d.getDate()).padStart(2, '0')
    const mmm = MONTHS[d.getMonth()]
    const yy = String(d.getFullYear()).slice(-2)
    return `${ddd} ${dd}-${mmm}-${yy}`
  } catch (e) { return iso }
}

function getRevisoresCount(str) {
  if (!str) return 0
  return str.split(',').map(s => s.trim()).filter(Boolean).length
}

function formatPromedio(metros, revisoresStr) {
  if (metros == null) return '0'
  const count = getRevisoresCount(revisoresStr)
  if (count <= 0) return '0'
  const prom = Math.round(Number(metros) / count)
  return prom.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatPct(v) {
  if (v == null) return '0,0%'
  return Number(v).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
}

function formatPts(v) {
  if (v == null) return '0,00'
  return Number(v).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatMeta(v) {
  if (v == null) return '0'
  return Number(v).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatRevisado(v) {
  if (v == null) return '0,0'
  return Number(v).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function getSaldoClass(r) {
  if (r.Dia > endDate.value) return ''
  const diff = (r.MetrosRevisados || 0) - (r.Revision || 0)
  return diff < 0 ? 'text-red-600' : 'text-emerald-600'
}

function calculateMetaAjustada(combined) {
  const totalMonthMeta = combined.reduce((sum, r) => sum + (r.Revision || 0), 0)
  const limitDate = endDate.value

  let cumReviewed = 0

  for (let i = 0; i < combined.length; i++) {
    const r = combined[i]
    const isPastOrEqual = r.Dia <= limitDate

    if (isPastOrEqual) {
      cumReviewed += (r.MetrosRevisados || 0)
    }

    if (isPastOrEqual && (r.Revision || 0) > 0) {
      const remainingActiveDays = combined.slice(i + 1).filter(row => (row.Revision || 0) > 0).length
      
      if (remainingActiveDays > 0) {
        r.MetaAjustada = (totalMonthMeta - cumReviewed) / remainingActiveDays
      } else {
        r.MetaAjustada = r.Revision
      }
    } else {
      r.MetaAjustada = null
    }
  }
  return combined
}

function staticJune2026(){
  // Construye array con los datos que solicitó el usuario
  const list = [
    ['2026-06-01', 0],['2026-06-02',0],['2026-06-03',44000],['2026-06-04',44000],['2026-06-05',44000],['2026-06-06',44000],
    ['2026-06-07',null],['2026-06-08',44000],['2026-06-09',44000],['2026-06-10',44000],['2026-06-11',44000],['2026-06-12',44000],
    ['2026-06-13',44000],['2026-06-14',null],['2026-06-15',44000],['2026-06-16',44000],['2026-06-17',44000],['2026-06-18',44000],
    ['2026-06-19',44000],['2026-06-20',44000],['2026-06-21',null],['2026-06-22',44000],['2026-06-23',44000],['2026-06-24',44000],
    ['2026-06-25',44000],['2026-06-26',44000],['2026-06-27',44000],['2026-06-28',44000],['2026-06-29',44000],['2026-06-30',44000]
  ]
  return list.map(x => ({ Dia: x[0], Revision: x[1], MetrosRevisados: null, Revisores: '', Pct1ra: null, Pts100m2: null }))
}

function exportCsv(){
  const header = ['Dia','Metas','Revisado','Saldo','Meta Ajustada','Revisores','Revisado Promedio','1ra. %','Pts/100m²']
  const lines = [header.join(',')]
  monthRows.value.forEach(r => {
    const isFuture = r.Dia > endDate.value
    const metaAjustadaVal = r.MetaAjustada === null ? '' : r.MetaAjustada
    const revisadoVal = (isFuture || r.MetrosRevisados === null) ? '' : r.MetrosRevisados
    const saldoVal = isFuture ? '' : ((r.MetrosRevisados || 0) - (r.Revision || 0))
    const revisoresVal = isFuture ? '' : (r.Revisores ? `"${r.Revisores.replace(/"/g, '""')}"` : '')
    
    let promedioVal = ''
    if (!isFuture && r.MetrosRevisados !== null) {
      const count = getRevisoresCount(r.Revisores)
      promedioVal = count > 0 ? Math.round(r.MetrosRevisados / count).toString() : '0'
    }

    const pct1raVal = (isFuture || r.Pct1ra === null) ? '' : r.Pct1ra
    const pts100m2Val = (isFuture || r.Pts100m2 === null) ? '' : r.Pts100m2

    const line = [r.Dia, r.Revision === null ? 0 : r.Revision, revisadoVal, saldoVal, metaAjustadaVal, revisoresVal, promedioVal, pct1raVal, pts100m2Val]
    lines.push(line.join(','))
  })
  const csv = lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `meta_por_revisor_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<style scoped>
</style>
