<template>
  <div class="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800 flex flex-col">
    <div class="mb-6 bg-white p-4 rounded shadow border border-slate-200">
      <h2 class="text-xl font-bold text-slate-800 mb-4">Dashboard Trazabilidad Causa Raíz</h2>
      
      <!-- TABS -->
      <div class="flex border-b border-slate-200 mb-4">
        <button 
          @click="activeTab = 'lote'"
          :class="['px-4 py-2 font-medium text-sm transition-colors border-b-2', activeTab === 'lote' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700']"
        >
          Vista por Lote
        </button>
        <button 
          @click="activeTab = 'rolada'"
          :class="['px-4 py-2 font-medium text-sm transition-colors border-b-2', activeTab === 'rolada' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700']"
        >
          Vista por Rolada
        </button>
      </div>

      <div class="flex flex-wrap items-start gap-4">
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Inicio (Producción)</label>
          <CustomDatepicker v-model="filters.fecha_inicio" :showButtons="true" />
        </div>
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Fin (Producción)</label>
          <CustomDatepicker v-model="filters.fecha_fin" :showButtons="true" />
        </div>

        <div class="flex flex-col min-w-[150px]">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Sector Defecto</label>
          <select v-model="filters.sector" @change="onSectorChange" class="border border-slate-300 rounded px-3 py-1.5 text-sm w-full">
            <option v-for="s in sectores" :key="s" :value="s">{{ s }}</option>
          </select>
        </div>

        <!-- Custom Dropdown Multi-select for Defectos -->
        <div class="flex flex-col min-w-[250px] relative">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Defectos</label>
          <div class="relative">
            <button type="button" @click="dropdownOpen = !dropdownOpen" class="w-full text-left border border-slate-300 rounded px-3 py-1.5 text-sm bg-white shadow-sm flex justify-between items-center">
              <span class="truncate">{{ selectedDefectosText }}</span>
              <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
            </button>
            <div v-if="dropdownOpen" class="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-60 overflow-auto">
              <div class="p-2 border-b border-slate-100 flex gap-2 justify-between">
                <button @click="selectAllDefectos" class="text-xs text-blue-600 hover:underline">Seleccionar Todos</button>
                <button @click="clearDefectos" class="text-xs text-slate-500 hover:underline">Limpiar</button>
              </div>
              <label v-for="d in filteredDefectos" :key="d.cod" class="flex items-center px-3 py-2 hover:bg-slate-50 cursor-pointer">
                <input type="checkbox" :value="d.cod" v-model="filters.codigos_defecto" class="mr-2 rounded text-blue-600 focus:ring-blue-500" />
                <span class="text-sm truncate">{{ d.cod }} - {{ d.desc }}</span>
              </label>
            </div>
          </div>
        </div>

        <!-- Opcional: Lotes/Roladas filter -->
        <div class="flex flex-col" v-if="activeTab === 'lote'">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Filtrar Lotes (CSV)</label>
          <input v-model="filters.lotes" type="text" placeholder="Ej: 129, 130" class="border border-slate-300 rounded px-3 py-1.5 text-sm w-48" />
        </div>
        <div class="flex flex-col" v-if="activeTab === 'rolada'">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Filtrar Roladas (CSV)</label>
          <input v-model="filters.roladas" type="text" placeholder="Ej: 5436, 5440" class="border border-slate-300 rounded px-3 py-1.5 text-sm w-48" />
        </div>

        <div class="flex flex-col min-w-[150px]" v-if="activeTab === 'rolada'">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Filtro Base</label>
          <select v-model="filters.base" class="border border-slate-300 rounded px-3 py-1.5 text-sm w-full">
            <option value="TODAS">TODAS</option>
            <option v-for="b in basesUnicas" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>

        <div class="flex items-end h-full pt-6 gap-2">
          <button @click="fetchData" class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors h-8">
            Consultar
          </button>
          <button @click="exportarExcel" :disabled="!hasData" class="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 h-8">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Exportar
          </button>
        </div>
      </div>
    </div>

    <!-- Overlay close dropdown -->
    <div v-if="dropdownOpen" @click="dropdownOpen = false" class="fixed inset-0 z-0"></div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex flex-col gap-6 relative z-0">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4" v-if="activeTab === 'lote'">
        <div v-for="i in 4" :key="i" class="bg-white p-4 rounded shadow border border-slate-200 h-24 animate-pulse"></div>
      </div>
      <div class="bg-white p-4 rounded shadow border border-slate-200 flex-1 animate-pulse min-h-[400px]"></div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded border border-red-200 relative z-0">
      {{ error }}
    </div>

    <!-- VISTA POR LOTE -->
    <div v-else-if="activeTab === 'lote' && dataLote" class="flex-1 flex flex-col gap-6 relative z-0">
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Promedio Cortes OE</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpisLote.avg_cortes_oe, 4) }}</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Promedio TRCNT (Basura)</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpisLote.avg_trcnt) }}</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Promedio Micronaire</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpisLote.avg_mic) }}</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Total Puntos Defecto</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpisLote.total_puntos_defecto, 0) }}</span>
        </div>
      </div>

      <!-- Tabla Lote -->
      <div class="bg-white rounded shadow border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-slate-600 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap sticky top-0">
              <tr>
                <th class="px-4 py-3 font-semibold">Lote</th>
                <th class="px-4 py-3 font-semibold text-right">Partidas</th>
                <th class="px-4 py-3 font-semibold text-right">Roladas</th>
                <th class="px-4 py-3 font-semibold text-right" title="Uniformidad">UI</th>
                <th class="px-4 py-3 font-semibold text-right" title="Fibra Corta">SF</th>
                <th class="px-4 py-3 font-semibold text-right" title="Micronaire">MIC</th>
                <th class="px-4 py-3 font-semibold text-right" title="Basura">TRCNT</th>
                <th class="px-4 py-3 font-semibold text-right" title="Neps +140%">Neps 140</th>
                <th class="px-4 py-3 font-semibold text-right" title="Irregularidad">CVm %</th>
                <th class="px-4 py-3 font-semibold text-right" title="Tenacidad cN/tex">Tenacidad</th>
                <th class="px-4 py-3 font-semibold text-right" title="Elongación %">Elongación</th>
                <th class="px-4 py-3 font-semibold text-right">Cortes OE</th>
                <th class="px-4 py-3 font-semibold text-right">Pts Defecto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in dataLote" :key="item.lote" class="hover:bg-slate-50/50">
                <td class="px-4 py-2 font-medium">Lote {{ item.lote }}</td>
                <td class="px-4 py-2 text-right">{{ item.total_partidas }}</td>
                <td class="px-4 py-2 text-right">{{ item.total_roladas }}</td>
                <td class="px-4 py-2 text-right"><span :class="colorUi(item.avg_ui)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_ui) }}</span></td>
                <td class="px-4 py-2 text-right"><span :class="colorSf(item.avg_sf)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_sf) }}</span></td>
                <td class="px-4 py-2 text-right"><span :class="colorMic(item.avg_mic)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_mic) }}</span></td>
                <td class="px-4 py-2 text-right"><span :class="colorTrcnt(item.avg_trcnt)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_trcnt) }}</span></td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_neps_140) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_cvm) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_tenacidad) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_elongacion) }}</td>
                <td class="px-4 py-2 text-right">
                  <div v-for="oe in item.maquinas_oe" :key="oe.maquina" class="text-xs mb-1 flex items-center justify-end">
                    <span class="text-slate-500 mr-1">{{ oe.maquina }}:</span>
                    <span class="mr-1 text-gray-700">{{ formatNumber(oe.cortes_absolutos, 0) }}</span>
                    <span :class="colorCortes(oe.tasa_cortes)" class="px-1 py-0.5 rounded font-semibold text-[10px]">
                      ({{ formatNumber(oe.tasa_cortes, 4) }})
                    </span>
                  </div>
                  <div v-if="!item.maquinas_oe || item.maquinas_oe.length === 0">-</div>
                </td>
                <td class="px-4 py-2 text-right font-bold">{{ formatNumber(item.puntos_defecto, 0) }}</td>
              </tr>
              <tr v-if="dataLote.length === 0">
                <td colspan="13" class="px-4 py-8 text-center text-slate-500">No hay datos.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- VISTA POR ROLADA -->
    <div v-else-if="activeTab === 'rolada' && dataRolada" class="flex-1 flex flex-col gap-6 relative z-0">
      <div class="bg-white rounded shadow border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-slate-600 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap sticky top-0">
              <tr>
                <th class="px-4 py-3 font-semibold">Rolada</th>
                <th class="px-4 py-3 font-semibold">OE (Máq)</th>
                <th class="px-4 py-3 font-semibold">Lote(s) OE</th>
                <th class="px-4 py-3 font-semibold">Base</th>
                <th class="px-4 py-3 font-semibold">Fecha Indigo</th>
                <th class="px-4 py-3 font-semibold text-center" title="UI / MIC / SF">HVI Promedio<br><span class="text-[10px] font-normal text-slate-400">UI / MIC / SF</span></th>
                <th v-for="maq in maquinasOE" :key="maq" class="px-4 py-3 font-semibold text-right">Cortes/Kg<br><span class="text-blue-600">Máq {{ maq }}</span></th>
                <th class="px-4 py-3 font-semibold text-right" title="Eventos en Telares">Cortes<br>Energía</th>
                <th class="px-4 py-3 font-semibold text-right">Puntos<br>Totales Rev.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in filteredDataRolada" :key="item.rolada" class="hover:bg-slate-50/50">
                <td class="px-4 py-2 font-bold text-slate-700">{{ item.rolada }}</td>
                <td class="px-4 py-2">{{ item.maq_oe || '-' }}</td>
                <td class="px-4 py-2">{{ item.lotes_oe || '-' }}</td>
                <td class="px-4 py-2">{{ item.base || '-' }}</td>
                <td class="px-4 py-2 whitespace-nowrap">{{ item.fecha_indigo ? formatDateStr(item.fecha_indigo) : '-' }}</td>
                
                <!-- HVI Cell -->
                <td class="px-4 py-2 text-center whitespace-nowrap">
                  <div v-if="item.hvi_ui && item.hvi_mic && item.hvi_sf" class="flex gap-1 justify-center items-center font-medium">
                    <span :class="colorUi(parseFloat(item.hvi_ui))">{{ item.hvi_ui }}%</span>
                    <span class="text-slate-300">/</span>
                    <span :class="colorMic(parseFloat(item.hvi_mic))">{{ item.hvi_mic }}</span>
                    <span class="text-slate-300">/</span>
                    <span :class="colorSf(parseFloat(item.hvi_sf))">{{ item.hvi_sf }}%</span>
                  </div>
                  <span v-else class="text-slate-400">-</span>
                </td>

                <!-- Maquinas Dinamicas -->
                <td v-for="maq in maquinasOE" :key="maq" class="px-4 py-2 text-right relative"
                    @mouseenter="showTooltip($event, item, maq)"
                    @mouseleave="hideTooltip">
                  <span v-if="item['cortes_maq_'+maq] !== null" :class="colorCortes(item['cortes_maq_'+maq])" class="px-1.5 py-0.5 rounded font-medium cursor-help">
                    {{ formatNumber(item['cortes_maq_'+maq], 4) }}
                  </span>
                  <span v-else class="text-slate-300">-</span>
                </td>

                <!-- Energia -->
                <td class="px-4 py-2 text-right">
                  <span v-if="item.cortes_energia > 0" class="px-2 py-1 rounded bg-red-100 text-red-700 font-bold inline-block text-xs" title="Cortes de energía registrados durante la producción OE">
                    {{ item.cortes_energia }}
                  </span>
                  <span v-else class="text-slate-400">-</span>
                </td>

                <!-- Puntos Revision -->
                <td class="px-4 py-2 text-right font-bold text-slate-700">
                  {{ formatNumber(item.puntos_revision, 0) }}
                </td>
              </tr>
              <tr v-if="filteredDataRolada.length === 0">
                <td :colspan="9 + maquinasOE.length" class="px-4 py-8 text-center text-slate-500">No hay datos.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="hoveredTooltip && hoveredTooltip.item['detalle_maq_'+hoveredTooltip.maq]"
         :style="tooltipStyle"
         class="fixed z-[9999] w-max bg-white text-slate-800 text-xs text-left rounded shadow-xl border border-slate-200 pointer-events-auto"
         @mouseenter="cancelHideTooltip"
         @mouseleave="hideTooltip">
      
      <div class="font-bold border-b border-slate-200 p-2 bg-slate-50 rounded-t text-slate-700">Desglose por Lote y Turno</div>
      
      <div class="max-h-60 overflow-y-auto">
        <table class="w-full text-[11px]">
          <thead class="text-slate-500 bg-slate-50 border-b border-slate-100 sticky top-0 shadow-sm z-10">
            <tr>
              <th class="px-2 py-1 font-medium text-left">Lote</th>
              <th class="px-2 py-1 font-medium text-left">Fecha (T)</th>
              <th class="px-2 py-1 font-medium text-center">Ene.</th>
              <th class="px-2 py-1 font-medium text-center">Cortes</th>
              <th class="px-2 py-1 font-medium text-right">Kg Prod</th>
              <th class="px-2 py-1 font-medium text-right">Cortes/Kg</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(det, i) in hoveredTooltip.item['detalle_maq_'+hoveredTooltip.maq]" :key="i" class="hover:bg-slate-50">
              <td class="px-2 py-1 text-slate-600 text-left">{{ det.lote }}</td>
              <td class="px-2 py-1 text-slate-600 text-left whitespace-nowrap">{{ formatDateStr(det.fecha) }} ({{ det.turno }})</td>
              <td class="px-2 py-1 text-center font-medium">
                <span v-if="det.energia > 0" class="text-red-500 font-bold bg-red-50 px-1 rounded">{{ det.energia }}</span>
                <span v-else class="text-slate-300">-</span>
              </td>
              <td class="px-2 py-1 font-semibold text-slate-700 text-center">{{ formatNumber(det.cortes, 0) }}</td>
              <td class="px-2 py-1 text-slate-600 text-right">{{ formatNumber(det.prod, 0) }}</td>
              <td class="px-2 py-1 font-medium text-right">
                <span :class="colorCortes(det.tasa)" class="px-1 py-0.5 rounded">{{ formatNumber(det.tasa, 2) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Triangulito (flecha) abajo -->
      <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-white"></div>
      <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-200 -z-10 translate-y-[1px]"></div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import ExcelJS from 'exceljs';
import CustomDatepicker from '../CustomDatepicker.vue';

const hoveredTooltip = ref(null);
const tooltipStyle = ref({});
let tooltipTimeout = null;

const showTooltip = (event, item, maq) => {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
  const rect = event.currentTarget.getBoundingClientRect();
  hoveredTooltip.value = { item, maq };
  
  // Posicionar arriba de la celda. Como es position: fixed, rect.top / rect.left son perfectos.
  tooltipStyle.value = {
    top: `${rect.top - 8}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translate(-50%, -100%)'
  };
};

const hideTooltip = () => {
  tooltipTimeout = setTimeout(() => {
    hoveredTooltip.value = null;
  }, 150); // 150ms delay for smooth moving
};

const cancelHideTooltip = () => {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
};

const activeTab = ref('lote'); // 'lote' | 'rolada'

const sectores = ref(['TODOS']);
const allDefectos = ref([]);
const dropdownOpen = ref(false);

const filters = ref({
  fecha_inicio: '',
  fecha_fin: '',
  sector: 'TODOS',
  codigos_defecto: [],
  lotes: '',
  roladas: '',
  base: 'TODAS'
});

const loading = ref(false);
const error = ref(null);

// Datos Tab Lote
const dataLote = ref(null);
const kpisLote = ref({});

// Datos Tab Rolada
const dataRolada = ref(null);
const maquinasOE = ref([]);

const filteredDefectos = computed(() => {
  if (filters.value.sector === 'TODOS') return allDefectos.value;
  return allDefectos.value.filter(d => d.sector === filters.value.sector);
});

const selectedDefectosText = computed(() => {
  if (filters.value.codigos_defecto.length === 0) return 'Ninguno seleccionado';
  if (filters.value.codigos_defecto.length === 1) {
    const d = allDefectos.value.find(x => x.cod === filters.value.codigos_defecto[0]);
    return d ? `${d.cod} - ${d.desc}` : filters.value.codigos_defecto[0];
  }
  return `${filters.value.codigos_defecto.length} seleccionados`;
});

const basesUnicas = computed(() => {
  if (!dataRolada.value) return [];
  const bases = new Set();
  dataRolada.value.forEach(item => {
    if (item.base) {
      bases.add(item.base.substring(0, 10).toUpperCase());
    }
  });
  return Array.from(bases).sort();
});

const filteredDataRolada = computed(() => {
  if (!dataRolada.value) return [];
  if (filters.value.base === 'TODAS') return dataRolada.value;
  return dataRolada.value.filter(item => {
    return item.base && item.base.substring(0, 10).toUpperCase() === filters.value.base;
  });
});

const hasData = computed(() => {
  if (activeTab.value === 'lote') return dataLote.value && dataLote.value.length > 0;
  return filteredDataRolada.value && filteredDataRolada.value.length > 0;
});

onMounted(async () => {
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(today.getMonth() - 1);
  
  filters.value.fecha_fin = today.toISOString().split('T')[0];
  filters.value.fecha_inicio = lastMonth.toISOString().split('T')[0];
  
  await fetchCatologo();
  // Set default defecto si hay
  if (allDefectos.value.length > 0) {
    filters.value.codigos_defecto = ['205'];
  }
  await fetchData();
});

// Al cambiar el sector, limpiamos los defectos si no coinciden
const onSectorChange = () => {
  const validForSector = filteredDefectos.value.map(d => d.cod);
  filters.value.codigos_defecto = filters.value.codigos_defecto.filter(cod => validForSector.includes(cod));
};

const selectAllDefectos = () => {
  filters.value.codigos_defecto = filteredDefectos.value.map(d => d.cod);
};

const clearDefectos = () => {
  filters.value.codigos_defecto = [];
};

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
};

const formatDateStr = (dateStr) => {
  if (!dateStr) return '';
  let d;
  if (typeof dateStr === 'string' && dateStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const parts = dateStr.split(' ')[0].split('/');
    d = new Date(parts[2], parseInt(parts[1], 10) - 1, parts[0]);
  } else {
    d = new Date(dateStr);
  }
  
  if (isNaN(d.getTime())) return dateStr;
  
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const month = monthNames[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  
  return `${day}-${month}-${year}`;
};

const colorUi = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val < 78.0) return 'text-red-700 bg-red-100';
  if (val >= 79.0 && val <= 80.0) return 'text-yellow-700 bg-yellow-100';
  return '';
};
const colorSf = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val >= 12.0) return 'text-red-700 bg-red-100';
  if (val >= 10.5 && val <= 11.9) return 'text-yellow-700 bg-yellow-100';
  return '';
};
const colorMic = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val < 3.5) return 'text-red-700 bg-red-100';
  if (val >= 3.5 && val <= 3.7) return 'text-yellow-700 bg-yellow-100';
  return '';
};
const colorTrcnt = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val > 70) return 'text-red-700 bg-red-100 font-medium';
  if (val >= 51 && val <= 70) return 'text-yellow-700 bg-yellow-100 font-medium';
  return '';
};
const colorCortes = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val >= 0.60) return 'text-red-700 bg-red-100';
  if (val >= 0.40 && val <= 0.59) return 'text-yellow-700 bg-yellow-100';
  return '';
};

const fetchCatologo = async () => {
  try {
    const res = await fetch('/api/produccion/trazabilidad-causa-raiz/sectores-defectos');
    const result = await res.json();
    if (result.success) {
      sectores.value = result.sectores || ['TODOS'];
      allDefectos.value = result.defectos || [];
    }
  } catch (err) {
    console.error('Error fetching catalog:', err);
  }
};

const fetchData = async () => {
  if (filters.value.codigos_defecto.length === 0) {
    error.value = "Seleccione al menos un defecto para consultar.";
    return;
  }
  
  loading.value = true;
  error.value = null;
  
  try {
    const commonParams = new URLSearchParams({
      fecha_inicio: filters.value.fecha_inicio,
      fecha_fin: filters.value.fecha_fin,
      cod_defecto: filters.value.codigos_defecto.join(',')
    });

    if (activeTab.value === 'lote') {
      if (filters.value.lotes) commonParams.append('lotes', filters.value.lotes);
      const response = await fetch(`/api/produccion/trazabilidad-causa-raiz?${commonParams.toString()}`);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const result = await response.json();
      if (result.success) {
        dataLote.value = result.data;
        kpisLote.value = result.kpis;
      } else {
        error.value = result.error || 'Error al obtener datos';
      }
    } else {
      if (filters.value.roladas) commonParams.append('roladas', filters.value.roladas);
      const response = await fetch(`/api/produccion/trazabilidad-causa-raiz/por-rolada?${commonParams.toString()}`);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const result = await response.json();
      if (result.success) {
        dataRolada.value = result.data;
        maquinasOE.value = result.maquinasOE || [];
      } else {
        error.value = result.error || 'Error al obtener datos';
      }
    }
  } catch (err) {
    console.error(err);
    error.value = 'Ocurrió un error al cargar la trazabilidad. Por favor, intente de nuevo.';
  } finally {
    loading.value = false;
  }
};

const exportarExcel = async () => {
  const isLote = activeTab.value === 'lote';
  const data = isLote ? dataLote.value : filteredDataRolada.value;
  if (!data || data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Trazabilidad Causa Raíz');

  if (isLote) {
    worksheet.columns = [
      { header: 'Lote', key: 'lote', width: 15 },
      { header: 'Partidas', key: 'total_partidas', width: 12 },
      { header: 'Roladas', key: 'total_roladas', width: 12 },
      { header: 'UI', key: 'avg_ui', width: 10 },
      { header: 'SF', key: 'avg_sf', width: 10 },
      { header: 'MIC', key: 'avg_mic', width: 10 },
      { header: 'TRCNT', key: 'avg_trcnt', width: 10 },
      { header: 'Neps 140', key: 'avg_neps_140', width: 12 },
      { header: 'CVm %', key: 'avg_cvm', width: 10 },
      { header: 'Tenacidad', key: 'avg_tenacidad', width: 12 },
      { header: 'Elongación', key: 'avg_elongacion', width: 12 },
      { header: 'Cortes OE', key: 'cortes_oe', width: 25 },
      { header: 'Pts Defecto', key: 'puntos_defecto', width: 12 }
    ];

    data.forEach((row) => {
      const cortesOeStr = row.maquinas_oe 
        ? row.maquinas_oe.map(m => `${m.maquina}: ${m.cortes_absolutos} (${formatNumber(m.tasa_cortes, 4)})`).join('\n')
        : '';

      const excelRow = worksheet.addRow({
        lote: `Lote ${row.lote}`,
        total_partidas: row.total_partidas || 0,
        total_roladas: row.total_roladas || 0,
        avg_ui: row.avg_ui,
        avg_sf: row.avg_sf,
        avg_mic: row.avg_mic,
        avg_trcnt: row.avg_trcnt,
        avg_neps_140: row.avg_neps_140,
        avg_cvm: row.avg_cvm,
        avg_tenacidad: row.avg_tenacidad,
        avg_elongacion: row.avg_elongacion,
        cortes_oe: cortesOeStr,
        puntos_defecto: row.puntos_defecto || 0
      });
      excelRow.getCell('L').alignment = { wrapText: true };
    });
  } else {
    // Columnas Rolada
    const cols = [
      { header: 'Rolada', key: 'rolada', width: 12 },
      { header: 'OE (Máq)', key: 'maq_oe', width: 12 },
      { header: 'Lote(s) OE', key: 'lotes_oe', width: 15 },
      { header: 'Base', key: 'base', width: 20 },
      { header: 'Fecha Indigo', key: 'fecha_indigo', width: 15 },
      { header: 'HVI Promedio (UI/MIC/SF)', key: 'hvi_str', width: 25 }
    ];
    
    maquinasOE.value.forEach(maq => {
      cols.push({ header: `Cortes/Kg (Máq ${maq})`, key: `cortes_maq_${maq}`, width: 18 });
    });
    
    cols.push({ header: 'Cortes Energía', key: 'cortes_energia', width: 15 });
    cols.push({ header: 'Pts Totales Rev.', key: 'puntos_revision', width: 18 });
    worksheet.columns = cols;

    data.forEach(row => {
      const rowData = {
        rolada: row.rolada,
        maq_oe: row.maq_oe,
        lotes_oe: row.lotes_oe,
        base: row.base,
        fecha_indigo: formatDateStr(row.fecha_indigo),
        hvi_str: (row.hvi_ui && row.hvi_mic && row.hvi_sf) ? `${row.hvi_ui}% / ${row.hvi_mic} / ${row.hvi_sf}%` : '-',
        cortes_energia: row.cortes_energia,
        puntos_revision: row.puntos_revision
      };
      
      maquinasOE.value.forEach(maq => {
        rowData[`cortes_maq_${maq}`] = row[`cortes_maq_${maq}`] !== null ? row[`cortes_maq_${maq}`] : '-';
      });

      worksheet.addRow(rowData);
    });
  }

  // Estilos de Header
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const viewType = isLote ? 'Lotes' : 'Roladas';
  a.download = `Trazabilidad_Causa_Raiz_${viewType}_${filters.value.fecha_inicio}_a_${filters.value.fecha_fin}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};

// Cargar data si cambia la tab (opcional)
watch(activeTab, (newTab) => {
  if (newTab === 'lote' && !dataLote.value) {
    fetchData();
  } else if (newTab === 'rolada' && !dataRolada.value) {
    fetchData();
  }
});
</script>
