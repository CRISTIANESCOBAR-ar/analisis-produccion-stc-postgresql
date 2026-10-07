<template>
  <div class="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800 flex flex-col">
    <div class="mb-6 bg-white p-4 rounded shadow border border-slate-200">
      <h2 class="text-xl font-bold text-slate-800 mb-4">Ranking de Revisores</h2>
      
      <div class="flex flex-wrap items-end gap-4 relative">
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha</label>
          <CustomDatepicker v-model="fecha" :showButtons="true" />
        </div>

        <div class="flex flex-col relative" v-click-outside="() => showRevisores = false">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Revisores Seleccionados ({{ selectedRevisores.length }})</label>
          <button @click="showRevisores = !showRevisores" class="border border-slate-300 bg-white rounded px-3 py-1.5 text-sm w-64 text-left flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-blue-500">
            <span class="truncate">{{ selectedRevisores.length === 0 ? 'Seleccionar...' : selectedRevisores.join(', ') }}</span>
            <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
          </button>
          
          <!-- Dropdown -->
          <div v-if="showRevisores" class="absolute top-full left-0 mt-1 w-64 bg-white border border-slate-200 shadow-lg rounded z-10 max-h-60 overflow-y-auto">
            <div class="p-2 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white">
              <span class="text-xs font-bold text-slate-500">TODOS</span>
              <button @click="toggleAllRevisores" class="text-xs text-blue-600 hover:text-blue-800">Invertir</button>
            </div>
            <label v-for="r in allRevisores" :key="r" class="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer text-sm">
              <input type="checkbox" :value="r" v-model="selectedRevisores" @change="saveRevisoresToLocal" class="mr-2 rounded text-blue-600 focus:ring-blue-500">
              {{ r }}
            </label>
          </div>
        </div>

        <button @click="fetchData" :disabled="loading" class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors flex items-center gap-2">
          Consultar
        </button>

        <button @click="ejecutarAuditoriaIA" :disabled="!rankingData.mes || iaLoading" class="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ml-auto">
          <svg v-if="iaLoading" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span v-else>✨</span> 
          Auditoría IA
        </button>
      </div>
    </div>

    <!-- IA Result Section -->
    <div v-if="iaLoading || iaResult" class="mb-6 bg-white p-6 rounded shadow border border-slate-200">
      <h3 class="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span>🤖</span> Comentario Gerencial IA
      </h3>
      <div v-if="iaLoading" class="animate-pulse flex flex-col gap-3">
        <div class="h-4 bg-slate-200 rounded w-3/4"></div>
        <div class="h-4 bg-slate-200 rounded w-full"></div>
      </div>
      <div v-else class="prose prose-sm max-w-none text-slate-700" v-html="iaRendered"></div>
    </div>

    <!-- Error State -->
    <div v-if="error" class="bg-red-50 text-red-600 p-4 rounded border border-red-200 mb-6">
      {{ error }}
    </div>

    <!-- Side by Side Tables -->
    <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 flex-1">
      
      <!-- Tabla Mes -->
      <div class="bg-white rounded shadow border border-slate-200 flex flex-col overflow-hidden">
        <div class="bg-slate-100 px-4 py-2 border-b border-slate-200">
          <h3 class="font-bold text-slate-700">Mes</h3>
        </div>
        <div class="overflow-x-auto flex-1">
          <table class="w-full text-xs text-left">
            <thead class="text-slate-600 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap">
              <tr>
                <th class="px-3 py-2 font-semibold">Ord</th>
                <th class="px-3 py-2 font-semibold">Revisor</th>
                <th class="px-3 py-2 font-semibold text-right">Metros</th>
                <th class="px-3 py-2 font-semibold text-right">Pts/100m²</th>
                <th class="px-3 py-2 font-semibold text-right">% S/Def</th>
                <th class="px-3 py-2 font-semibold text-right">Repro</th>
                <th class="px-3 py-2 font-semibold text-right">&lt;&gt; N</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="loading" class="animate-pulse bg-slate-50"><td colspan="7" class="h-32"></td></tr>
              <template v-else>
                <tr v-for="item in (rankingData.mes || [])" :key="'mes-'+item.revisor" class="hover:bg-slate-50/50">
                  <td class="px-3 py-2 text-slate-500">{{ item.ord }}</td>
                  <td class="px-3 py-2 font-medium">{{ item.revisor }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(item.metros_totales, 0) }}</td>
                  <td class="px-3 py-2 text-right font-bold">{{ formatNumber(item.pts_100m, 1) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(item.pct_sin_defecto, 1) }}%</td>
                  <td class="px-3 py-2 text-right text-orange-600">{{ formatNumber(item.metros_repro, 0) }}</td>
                  <td class="px-3 py-2 text-right">{{ item.partidas_no_n }}</td>
                </tr>
                <!-- Totales Mes -->
                <tr v-if="totalesMes" class="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td colspan="2" class="px-3 py-2 text-right">TOTAL MES</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(totalesMes.metros, 0) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(totalesMes.pts_100m, 1) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(totalesMes.pct_sin_defecto, 1) }}%</td>
                  <td class="px-3 py-2 text-right text-orange-700">{{ formatNumber(totalesMes.metros_repro, 0) }}</td>
                  <td class="px-3 py-2 text-right">{{ totalesMes.partidas_no_n }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Tabla Dia -->
      <div class="bg-white rounded shadow border border-slate-200 flex flex-col overflow-hidden">
        <div class="bg-slate-100 px-4 py-2 border-b border-slate-200">
          <h3 class="font-bold text-slate-700">Día</h3>
        </div>
        <div class="overflow-x-auto flex-1">
          <table class="w-full text-xs text-left">
            <thead class="text-slate-600 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap">
              <tr>
                <th class="px-3 py-2 font-semibold">Ord</th>
                <th class="px-3 py-2 font-semibold">Revisor</th>
                <th class="px-3 py-2 font-semibold text-right">Metros</th>
                <th class="px-3 py-2 font-semibold text-right">Pts/100m²</th>
                <th class="px-3 py-2 font-semibold text-right">% S/Def</th>
                <th class="px-3 py-2 font-semibold text-right">Repro</th>
                <th class="px-3 py-2 font-semibold text-right">&lt;&gt; N</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-if="loading" class="animate-pulse bg-slate-50"><td colspan="7" class="h-32"></td></tr>
              <template v-else>
                <tr v-for="item in (rankingData.dia || [])" :key="'dia-'+item.revisor" class="hover:bg-slate-50/50">
                  <td class="px-3 py-2 text-slate-500">{{ item.ord }}</td>
                  <td class="px-3 py-2 font-medium">{{ item.revisor }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(item.metros_totales, 0) }}</td>
                  <td class="px-3 py-2 text-right font-bold">{{ formatNumber(item.pts_100m, 1) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(item.pct_sin_defecto, 1) }}%</td>
                  <td class="px-3 py-2 text-right text-orange-600">{{ formatNumber(item.metros_repro, 0) }}</td>
                  <td class="px-3 py-2 text-right">{{ item.partidas_no_n }}</td>
                </tr>
                <!-- Totales Dia -->
                <tr v-if="totalesDia" class="bg-slate-100 font-bold border-t-2 border-slate-300">
                  <td colspan="2" class="px-3 py-2 text-right">TOTAL DIA</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(totalesDia.metros, 0) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(totalesDia.pts_100m, 1) }}</td>
                  <td class="px-3 py-2 text-right">{{ formatNumber(totalesDia.pct_sin_defecto, 1) }}%</td>
                  <td class="px-3 py-2 text-right text-orange-700">{{ formatNumber(totalesDia.metros_repro, 0) }}</td>
                  <td class="px-3 py-2 text-right">{{ totalesDia.partidas_no_n }}</td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import CustomDatepicker from '../CustomDatepicker.vue';
import { marked } from 'marked';

const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = function (event) {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.body.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el) {
    document.body.removeEventListener('click', el.clickOutsideEvent);
  },
};

const fecha = ref('');
const allRevisores = ref([]);
const selectedRevisores = ref([]);
const showRevisores = ref(false);

const loading = ref(false);
const error = ref(null);
const rankingData = ref({ mes: null, dia: null });

const iaLoading = ref(false);
const iaResult = ref(null);

const iaRendered = computed(() => {
  if (!iaResult.value) return '';
  return marked.parse(iaResult.value);
});

const calcularTotales = (dataArray) => {
  if (!dataArray || dataArray.length === 0) return null;
  
  let metros = 0, repro = 0, no_n = 0;
  let totalPts100m = 0, totalPctSinDef = 0;
  
  let sumPtsWeight = 0;
  let sumSinDefWeight = 0;

  dataArray.forEach(r => {
    metros += r.metros_totales;
    repro += r.metros_repro;
    no_n += r.partidas_no_n;
    sumPtsWeight += r.pts_100m * r.metros_totales;
    sumSinDefWeight += r.pct_sin_defecto * r.metros_totales;
  });

  return {
    metros,
    metros_repro: repro,
    partidas_no_n: no_n,
    pts_100m: metros > 0 ? (sumPtsWeight / metros) : 0,
    pct_sin_defecto: metros > 0 ? (sumSinDefWeight / metros) : 0
  };
};

const totalesMes = computed(() => calcularTotales(rankingData.value.mes));
const totalesDia = computed(() => calcularTotales(rankingData.value.dia));

onMounted(async () => {
  const today = new Date();
  fecha.value = today.toISOString().split('T')[0];
  
  await fetchRevisores();
  
  const guardados = localStorage.getItem('ranking_revisores_seleccion');
  if (guardados) {
    try {
      const arr = JSON.parse(guardados);
      selectedRevisores.value = arr.filter(r => allRevisores.value.includes(r));
    } catch(e){}
  }
  
  if (selectedRevisores.value.length === 0) {
    selectedRevisores.value = allRevisores.value.slice(0, 8);
    saveRevisoresToLocal();
  }
  
  fetchData();
});

const saveRevisoresToLocal = () => {
  localStorage.setItem('ranking_revisores_seleccion', JSON.stringify(selectedRevisores.value));
};

const toggleAllRevisores = () => {
  if (selectedRevisores.value.length === allRevisores.value.length) {
    selectedRevisores.value = [];
  } else {
    selectedRevisores.value = [...allRevisores.value];
  }
  saveRevisoresToLocal();
};

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
};

const fetchRevisores = async () => {
  try {
    const res = await fetch('/api/produccion/calibracion-revisores/revisores');
    const result = await res.json();
    if (result.success) {
      allRevisores.value = result.data;
    }
  } catch (err) {
    console.error('Error fetching revisores:', err);
  }
};

const fetchData = async () => {
  if (!fecha.value || selectedRevisores.value.length === 0) return;

  loading.value = true;
  error.value = null;
  rankingData.value = { mes: null, dia: null };
  iaResult.value = null;
  
  try {
    const response = await fetch('/api/produccion/calibracion-revisores/ranking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fecha: fecha.value,
        revisores: selectedRevisores.value
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      rankingData.value = result.data;
    } else {
      error.value = result.error || 'Error al obtener ranking';
    }
  } catch (err) {
    console.error(err);
    error.value = 'Ocurrió un error al cargar el ranking. Por favor, intente de nuevo.';
  } finally {
    loading.value = false;
  }
};

const ejecutarAuditoriaIA = async () => {
  if (!rankingData.value.mes) return;
  
  iaLoading.value = true;
  iaResult.value = null;
  error.value = null;
  
  try {
    const response = await fetch('/api/produccion/calibracion-revisores/revision-cq-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rankingData: rankingData.value
      })
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      iaResult.value = result.insight;
    } else {
      error.value = result.error || 'Error en auditoría IA';
    }
  } catch (err) {
    console.error(err);
    error.value = 'Ocurrió un error al contactar la IA. Verifica tu conexión.';
  } finally {
    iaLoading.value = false;
  }
};
</script>
