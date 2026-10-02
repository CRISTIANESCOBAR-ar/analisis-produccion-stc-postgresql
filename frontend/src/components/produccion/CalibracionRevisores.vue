<template>
  <div class="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800 flex flex-col">
    <div class="mb-6 bg-white p-4 rounded shadow border border-slate-200">
      <h2 class="text-xl font-bold text-slate-800 mb-4">Calibración y Desempeño de Revisores</h2>
      
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Inicio</label>
          <CustomDatepicker v-model="filters.fecha_inicio" :showButtons="true" />
        </div>
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Fin</label>
          <CustomDatepicker v-model="filters.fecha_fin" :showButtons="true" />
        </div>
        <div class="flex flex-col flex-1 min-w-[200px]">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Defecto</label>
          <select v-model="filters.cod_defecto" class="border border-slate-300 rounded px-3 py-1.5 text-sm w-full">
            <option v-for="d in defectos" :key="d.COD_DEF" :value="d.COD_DEF">
              {{ d.COD_DEF }} - {{ d.DESC_DEFEITO }}
            </option>
          </select>
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
      <div class="bg-white p-4 rounded shadow border border-slate-200 h-64 animate-pulse"></div>
      <div class="bg-white p-4 rounded shadow border border-slate-200 flex-1 animate-pulse"></div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded border border-red-200">
      {{ error }}
    </div>

    <div v-else-if="data" class="flex-1 flex flex-col gap-6">
      <!-- Gráfico de barras -->
      <div class="bg-white p-4 rounded shadow border border-slate-200" style="height: 400px;">
        <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
      </div>

      <!-- Tabla -->
      <div class="bg-white rounded shadow border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-slate-600 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap sticky top-0">
              <tr>
                <th class="px-4 py-3 font-semibold">Revisor</th>
                <th class="px-4 py-3 font-semibold text-right">Piezas Revisadas</th>
                <th class="px-4 py-3 font-semibold text-right">Piezas c/ Defecto</th>
                <th class="px-4 py-3 font-semibold text-right">Tasa Detección (%)</th>
                <th class="px-4 py-3 font-semibold text-right">Puntos Totales</th>
                <th class="px-4 py-3 font-semibold text-right">Severidad</th>
                <th class="px-4 py-3 font-semibold text-center">vs. Promedio</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in data" :key="item.revisor" class="hover:bg-slate-50/50">
                <td class="px-4 py-2 font-medium">{{ item.revisor }}</td>
                <td class="px-4 py-2 text-right">{{ item.total_piezas_revisadas }}</td>
                <td class="px-4 py-2 text-right">{{ item.piezas_con_defecto }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.tasa_deteccion_pct) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.puntos_totales) }}</td>
                <td class="px-4 py-2 text-right font-bold">{{ formatNumber(item.severidad, 4) }}</td>
                <td class="px-4 py-2 text-center">
                  <span v-if="item.color === 'verde'" class="px-2 py-0.5 rounded font-medium text-xs text-green-700 bg-green-100">OK</span>
                  <span v-else-if="item.color === 'rojo'" class="px-2 py-0.5 rounded font-medium text-xs text-red-700 bg-red-100">Laxo</span>
                  <span v-else-if="item.color === 'amarillo'" class="px-2 py-0.5 rounded font-medium text-xs text-yellow-700 bg-yellow-100">Estricto</span>
                </td>
              </tr>
              <tr v-if="data.length === 0">
                <td colspan="7" class="px-4 py-8 text-center text-slate-500">
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
  BarElement,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
} from 'chart.js';
import { Bar } from 'vue-chartjs';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
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
  cod_defecto: '205'
});

const loading = ref(false);
const error = ref(null);
const data = ref(null);
const promedioGlobal = ref(0);

const chartData = computed(() => {
  if (!data.value) return null;

  const bgColors = data.value.map(item => {
    if (item.color === 'rojo') return '#EF4444';
    if (item.color === 'verde') return '#22C55E';
    if (item.color === 'amarillo') return '#F59E0B';
    return '#9CA3AF';
  });

  return {
    labels: data.value.map(d => d.revisor),
    datasets: [
      {
        type: 'line',
        label: 'Promedio Global',
        data: Array(data.value.length).fill(promedioGlobal.value),
        borderColor: '#374151',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false,
        order: 1
      },
      {
        type: 'bar',
        label: 'Severidad (Puntos/Pieza)',
        data: data.value.map(d => d.severidad),
        backgroundColor: bgColors,
        order: 2
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
    },
    title: {
      display: true,
      text: 'Severidad por Revisor (Puntos/Pieza)'
    }
  },
  scales: {
    y: {
      beginAtZero: true
    }
  }
};

onMounted(async () => {
  const today = new Date();
  const lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 7);
  
  filters.value.fecha_fin = today.toISOString().split('T')[0];
  filters.value.fecha_inicio = lastWeek.toISOString().split('T')[0];
  
  await fetchDefectos();
  await fetchData();
});

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
};

const fetchDefectos = async () => {
  try {
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
    const response = await fetch(`/api/produccion/calibracion-revisores?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      data.value = result.data;
      promedioGlobal.value = result.promedioGlobal;
    } else {
      error.value = result.error || 'Error al obtener datos';
    }
  } catch (err) {
    console.error(err);
    error.value = 'Ocurrió un error al cargar la calibración. Por favor, intente de nuevo.';
  } finally {
    loading.value = false;
  }
};

const exportarExcel = async () => {
  if (!data.value || data.value.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Calibración Revisores');

  worksheet.columns = [
    { header: 'Revisor', key: 'revisor', width: 25 },
    { header: 'Piezas Revisadas', key: 'total_piezas_revisadas', width: 18 },
    { header: 'Piezas c/ Defecto', key: 'piezas_con_defecto', width: 20 },
    { header: 'Tasa Detección (%)', key: 'tasa_deteccion_pct', width: 20 },
    { header: 'Puntos Totales', key: 'puntos_totales', width: 18 },
    { header: 'Severidad', key: 'severidad', width: 15 },
    { header: 'Estado', key: 'color', width: 15 }
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
    let estadoText = 'OK';
    if (row.color === 'rojo') estadoText = 'Laxo';
    if (row.color === 'amarillo') estadoText = 'Estricto';

    const excelRow = worksheet.addRow({
      revisor: row.revisor,
      total_piezas_revisadas: row.total_piezas_revisadas || 0,
      piezas_con_defecto: row.piezas_con_defecto || 0,
      tasa_deteccion_pct: row.tasa_deteccion_pct || 0,
      puntos_totales: row.puntos_totales || 0,
      severidad: row.severidad || 0,
      color: estadoText
    });

    ['D', 'E'].forEach(col => {
      excelRow.getCell(col).numFmt = '#,##0.00';
    });
    excelRow.getCell('F').numFmt = '#,##0.0000';

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
  a.download = `Calibracion_Revisores_Def${filters.value.cod_defecto}_${filters.value.fecha_inicio}_a_${filters.value.fecha_fin}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
</script>
