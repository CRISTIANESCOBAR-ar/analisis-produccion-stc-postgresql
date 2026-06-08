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

    <div class="flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-md p-4">
      <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
        <thead class="bg-linear-to-r from-indigo-50 to-indigo-100 sticky top-0 z-5">
          <tr>
            <th class="px-3 py-2 text-left font-semibold text-slate-700">Dia</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-700">Revision</th>
            <th class="px-3 py-2 text-left font-semibold text-slate-700">Metros revisados</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in monthRows" :key="r.Dia" class="border-b border-slate-100 hover:bg-indigo-50/20">
            <td class="px-3 py-2 text-sm text-slate-700">{{ formatDateLocal(r.Dia) }}</td>
            <td class="px-3 py-2 text-sm text-slate-700">{{ r.Revision === null ? 0 : r.Revision }}</td>
            <td class="px-3 py-2 text-sm text-slate-700">{{ r.MetrosRevisados === null ? 0 : r.MetrosRevisados }}</td>
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
    const s = startDate.value || new Date().toISOString().slice(0,10)
    const e = endDate.value || new Date().toISOString().slice(0,10)
    const resp = await fetch(`/api/metas/mes?start=${s}&end=${e}`)
    if (resp.ok) {
      const data = await resp.json()
      monthRows.value = (data.rows || [])
      // Si no hay filas devolver dataset estático para junio 2026
      if (!data.rows || data.rows.length === 0) {
        monthRows.value = staticJune2026()
      }
      loading.value = false
      return
    }
    throw new Error('no api')
  } catch (e) {
    // fallback: usar dataset estático para junio 2026
    monthRows.value = staticJune2026()
  } finally {
    loading.value = false
  }
}

const monthRows = ref([])

function formatDateLocal(iso){
  try {
    const d = new Date(iso + 'T00:00:00')
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`
  } catch (e) { return iso }
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
  return list.map(x => ({ Dia: x[0], Revision: x[1], MetrosRevisados: null }))
}

function exportCsv(){
  const header = ['Dia','Revision','MetrosRevisados']
  const lines = [header.join(',')]
  monthRows.value.forEach(r => {
    const line = [r.Dia, r.Revision === null ? 0 : r.Revision, r.MetrosRevisados === null ? 0 : r.MetrosRevisados]
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
