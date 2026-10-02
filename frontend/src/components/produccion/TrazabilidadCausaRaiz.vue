<template>
  <div class="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800 flex flex-col">
    <div class="mb-6 bg-white p-4 rounded shadow border border-slate-200">
      <h2 class="text-xl font-bold text-slate-800 mb-4">Dashboard Trazabilidad Causa Raíz</h2>
      
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Inicio (Producción)</label>
          <CustomDatepicker v-model="filters.fecha_inicio" :showButtons="true" />
        </div>
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Fin (Producción)</label>
          <CustomDatepicker v-model="filters.fecha_fin" :showButtons="true" />
        </div>
        <div class="flex flex-col min-w-[200px]">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Defecto en Tela</label>
          <select v-model="filters.cod_defecto" class="border border-slate-300 rounded px-3 py-1.5 text-sm w-full">
            <option v-for="d in defectos" :key="d.COD_DEF" :value="d.COD_DEF">
              {{ d.COD_DEF }} - {{ d.DESC_DEFEITO }}
            </option>
          </select>
        </div>
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Filtrar Lotes (CSV, opcional)</label>
          <input v-model="filters.lotes" type="text" placeholder="Ej: 129, 130" class="border border-slate-300 rounded px-3 py-1.5 text-sm" />
        </div>
        <button @click="fetchData" class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors">
          Consultar
        </button>
        <button @click="exportarExcel" :disabled="!data || data.length === 0" class="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exportar Excel
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex flex-col gap-6">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-white p-4 rounded shadow border border-slate-200 h-24 animate-pulse"></div>
      </div>
      <div class="bg-white p-4 rounded shadow border border-slate-200 h-64 animate-pulse"></div>
      <div class="bg-white p-4 rounded shadow border border-slate-200 flex-1 animate-pulse"></div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded border border-red-200">
      {{ error }}
    </div>

    <div v-else-if="data" class="flex-1 flex flex-col gap-6">
      
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Promedio Cortes OE</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpis.avg_cortes_oe, 4) }}</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Promedio TRCNT (Basura)</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpis.avg_trcnt) }}</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Promedio Micronaire</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpis.avg_mic) }}</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Total Puntos Defecto</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(kpis.total_puntos_defecto, 0) }}</span>
        </div>
      </div>

      <!-- Gráfico de correlación -->
      <div class="bg-white p-4 rounded shadow border border-slate-200" style="height: 400px;">
        <Line v-if="chartData" :data="chartData" :options="chartOptions" />
      </div>

      <!-- Tabla -->
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
              <tr v-for="item in data" :key="item.lote" class="hover:bg-slate-50/50">
                <td class="px-4 py-2 font-medium">Lote {{ item.lote }}</td>
                <td class="px-4 py-2 text-right">{{ item.total_partidas }}</td>
                <td class="px-4 py-2 text-right">{{ item.total_roladas }}</td>
                <td class="px-4 py-2 text-right">
                  <span :class="colorUi(item.avg_ui)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_ui) }}</span>
                </td>
                <td class="px-4 py-2 text-right">
                  <span :class="colorSf(item.avg_sf)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_sf) }}</span>
                </td>
                <td class="px-4 py-2 text-right">
                  <span :class="colorMic(item.avg_mic)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_mic) }}</span>
                </td>
                <td class="px-4 py-2 text-right">
                  <span :class="colorTrcnt(item.avg_trcnt)" class="px-2 py-0.5 rounded">{{ formatNumber(item.avg_trcnt) }}</span>
                </td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_neps_140) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_cvm) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_tenacidad) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.avg_elongacion) }}</td>
                <td class="px-4 py-2 text-right">
                  <div v-for="oe in item.maquinas_oe" :key="oe.maquina" class="text-xs mb-1 flex items-center justify-end">
                    <span class="text-slate-500 mr-1">{{ oe.maquina }}:</span>
                    <span class="mr-1 text-gray-700" title="Cortes Absolutos">{{ formatNumber(oe.cortes_absolutos, 0) }}</span>
                    <span :class="colorCortes(oe.tasa_cortes)" class="px-1 py-0.5 rounded font-semibold text-[10px]" title="Tasa (Cortes / Kilos)">
                      ({{ formatNumber(oe.tasa_cortes, 4) }})
                    </span>
                  </div>
                  <div v-if="!item.maquinas_oe || item.maquinas_oe.length === 0">-</div>
                </td>
                <td class="px-4 py-2 text-right font-bold">{{ formatNumber(item.puntos_defecto, 0) }}</td>
              </tr>
              <tr v-if="data.length === 0">
                <td colspan="13" class="px-4 py-8 text-center text-slate-500">
                  No se encontraron registros para el periodo seleccionado.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import ExcelJS from 'exceljs';
import CustomDatepicker from '../CustomDatepicker.vue';
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import { Line } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

const defectos = ref([]);
const filters = ref({
  fecha_inicio: '',
  fecha_fin: '',
  cod_defecto: '205',
  lotes: ''
});

const loading = ref(false);
const error = ref(null);
const data = ref(null);
const kpis = ref({});

const chartData = computed(() => {
  if (!data.value) return null;

  const validData = data.value.filter(d => d.avg_trcnt !== null || d.avg_neps_140 !== null || d.cortes_oe_promedio !== null);

  return {
    labels: validData.map(d => `Lote ${d.lote}`),
    datasets: [
      {
        label: 'TRCNT (Basura)',
        data: validData.map(d => d.avg_trcnt),
        borderColor: '#3B82F6', // blue-500
        backgroundColor: '#3B82F6',
        yAxisID: 'y',
      },
      {
        label: 'Neps 140%',
        data: validData.map(d => d.avg_neps_140),
        borderColor: '#F97316', // orange-500
        backgroundColor: '#F97316',
        yAxisID: 'y',
      },
      {
        label: 'Cortes OE',
        data: validData.map(d => d.cortes_oe_promedio),
        borderColor: '#EF4444', // red-500
        backgroundColor: '#EF4444',
        yAxisID: 'y1',
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  stacked: false,
  plugins: {
    title: {
      display: true,
      text: 'Correlación Calidad vs Cortes OE por Lote'
    }
  },
  scales: {
    y: {
      type: 'linear',
      display: true,
      position: 'left',
      title: {
        display: true,
        text: 'Métricas Fibra/Hilo'
      }
    },
    y1: {
      type: 'linear',
      display: true,
      position: 'right',
      title: {
        display: true,
        text: 'Cortes OE'
      },
      grid: {
        drawOnChartArea: false, // only want the grid lines for one axis to show up
      },
    },
  }
};

onMounted(async () => {
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(today.getMonth() - 1);
  
  filters.value.fecha_fin = today.toISOString().split('T')[0];
  filters.value.fecha_inicio = lastMonth.toISOString().split('T')[0];
  
  await fetchDefectos();
  await fetchData();
});

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
};

// Semaforización
const colorUi = (val) => {
  if (val === null) return '';
  if (val < 78.0) return 'text-red-700 bg-red-100 font-medium';
  if (val >= 79.0 && val <= 80.0) return 'text-yellow-700 bg-yellow-100 font-medium';
  return '';
};
const colorSf = (val) => {
  if (val === null) return '';
  if (val >= 12.0) return 'text-red-700 bg-red-100 font-medium';
  if (val >= 10.5 && val <= 11.9) return 'text-yellow-700 bg-yellow-100 font-medium';
  return '';
};
const colorMic = (val) => {
  if (val === null) return '';
  if (val < 3.5) return 'text-red-700 bg-red-100 font-medium';
  if (val >= 3.5 && val <= 3.7) return 'text-yellow-700 bg-yellow-100 font-medium';
  return '';
};
const colorTrcnt = (val) => {
  if (val === null) return '';
  if (val > 70) return 'text-red-700 bg-red-100 font-medium';
  if (val >= 51 && val <= 70) return 'text-yellow-700 bg-yellow-100 font-medium';
  return '';
};
const colorCortes = (val) => {
  if (val === null) return '';
  if (val >= 0.60) return 'text-red-700 bg-red-100';
  if (val >= 0.40 && val <= 0.59) return 'text-yellow-700 bg-yellow-100';
  return '';
};

const fetchDefectos = async () => {
  try {
    // Reusamos el endpoint de calibración para obtener el catálogo
    const res = await fetch('/api/produccion/calibracion-revisores/defectos-catalogo');
    const result = await res.json();
    if (result.success) {
      defectos.value = result.data;
    }
  } catch (err) {
    console.error('Error fetching defectos:', err);
  }
};

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  data.value = null;
  
  try {
    const params = new URLSearchParams(filters.value);
    const response = await fetch(`/api/produccion/trazabilidad-causa-raiz?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      data.value = result.data;
      kpis.value = result.kpis;
    } else {
      error.value = result.error || 'Error al obtener datos';
    }
  } catch (err) {
    console.error(err);
    error.value = 'Ocurrió un error al cargar la trazabilidad. Por favor, intente de nuevo.';
  } finally {
    loading.value = false;
  }
};

const exportarExcel = async () => {
  if (!data.value || data.value.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Trazabilidad Causa Raíz');

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

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  data.value.forEach((row, index) => {
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

    // Formato de números con 2 decimales
    ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'].forEach(col => {
      excelRow.getCell(col).numFmt = '#,##0.00';
    });
    
    if (index % 2 === 1) {
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' }
      };
    }
  });

  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
      };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Trazabilidad_Causa_Raiz_Def${filters.value.cod_defecto}_${filters.value.fecha_inicio}_a_${filters.value.fecha_fin}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
</script>
