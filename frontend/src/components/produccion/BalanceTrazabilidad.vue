<template>
  <div class="p-4 md:p-6 bg-slate-50 min-h-screen text-slate-800 flex flex-col">
    <div class="mb-6 bg-white p-4 rounded shadow border border-slate-200">
      <h2 class="text-xl font-bold text-slate-800 mb-4">Balance de Trazabilidad</h2>
      
      <div class="flex flex-wrap items-end gap-4">
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Inicio</label>
          <CustomDatepicker v-model="filters.fecha_inicio" :showButtons="true" />
        </div>
        <div class="flex flex-col">
          <label class="block text-xs font-semibold text-slate-500 mb-1">Fecha Fin</label>
          <CustomDatepicker v-model="filters.fecha_fin" :showButtons="true" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 mb-1">Sector Matriz</label>
          <select v-model="filters.sector_matriz" class="border border-slate-300 rounded px-3 py-1.5 text-sm">
            <option value="INTEGRADA">INTEGRADA</option>
            <option value="REVISAO">REVISAO</option>
            <option value="TECELAGEM">TECELAGEM</option>
          </select>
        </div>
        <button @click="fetchData" class="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors">
          Consultar
        </button>
        <button @click="exportarExcel" :disabled="!data || !data.data || data.data.length === 0" class="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-1.5 rounded text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Exportar Excel
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex items-center justify-center">
      <div class="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600"></div>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="bg-red-50 text-red-600 p-4 rounded border border-red-200">
      {{ error }}
    </div>

    <div v-else-if="data" class="flex-1 flex flex-col gap-6">
      
      <!-- KPIs -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Total Partidas</span>
          <span class="text-2xl font-bold text-slate-800">{{ data.kpis.total_partidas }}</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Total Telar (Encogimiento)</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(data.kpis.total_metros_tecelagem_encolh) }} m</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Total Acabado Integrada</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(data.kpis.total_metros_acabamento_integrada) }} m</span>
        </div>
        <div class="bg-white p-4 rounded shadow border border-slate-200 flex flex-col">
          <span class="text-xs font-semibold text-slate-500 uppercase">Total Calidad</span>
          <span class="text-2xl font-bold text-slate-800">{{ formatNumber(data.kpis.total_metros_calidad_revisados) }} m</span>
        </div>
      </div>

      <!-- Tabla -->
      <div class="bg-white rounded shadow border border-slate-200 flex-1 overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
          <table class="w-full text-sm text-left">
            <thead class="text-xs text-slate-600 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap sticky top-0">
              <tr>
                <th class="px-4 py-3 font-semibold">Partida</th>
                <th class="px-4 py-3 font-semibold">Artículo</th>
                <th class="px-4 py-3 font-semibold">Fecha Matriz</th>
                <th class="px-4 py-3 font-semibold text-right">Telar (Encog)</th>
                <th class="px-4 py-3 font-semibold text-right">Acabado (Integrada)</th>
                <th class="px-4 py-3 font-semibold text-right">Calidad (Rev)</th>
                <th class="px-4 py-3 font-semibold text-right">Rend. Telar→Acab</th>
                <th class="px-4 py-3 font-semibold text-right">Rend. Acab→Cal</th>
                <th class="px-4 py-3 font-semibold text-right">Rend. Global</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in data.data" :key="item.partida" class="hover:bg-slate-50/50">
                <td class="px-4 py-2 font-medium">{{ item.partida }}</td>
                <td class="px-4 py-2">{{ item.artigo }}</td>
                <td class="px-4 py-2">{{ item.fecha_str }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.metros_tecelagem_encolh) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.metros_acabamento_integrada) }}</td>
                <td class="px-4 py-2 text-right">{{ formatNumber(item.metros_calidad_revisados) }}</td>
                
                <td class="px-4 py-2 text-right">
                  <span :class="getColorForRend(item.rend_telar_integrada_pct)" class="px-2 py-0.5 rounded font-medium text-xs">
                    {{ item.rend_telar_integrada_pct !== null ? item.rend_telar_integrada_pct + '%' : '-' }}
                  </span>
                </td>
                <td class="px-4 py-2 text-right">
                  <span :class="getColorForRend(item.rend_integrada_calidad_pct)" class="px-2 py-0.5 rounded font-medium text-xs">
                    {{ item.rend_integrada_calidad_pct !== null ? item.rend_integrada_calidad_pct + '%' : '-' }}
                  </span>
                </td>
                <td class="px-4 py-2 text-right font-semibold">
                  <span :class="getColorForRend(item.rend_global_pct)" class="px-2 py-0.5 rounded font-medium text-xs">
                    {{ item.rend_global_pct !== null ? item.rend_global_pct + '%' : '-' }}
                  </span>
                </td>
              </tr>
              <tr v-if="!data.data || data.data.length === 0">
                <td colspan="9" class="px-4 py-8 text-center text-slate-500">
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
import { ref, onMounted } from 'vue';
import ExcelJS from 'exceljs';
import CustomDatepicker from '../CustomDatepicker.vue';

const filters = ref({
  fecha_inicio: '',
  fecha_fin: '',
  sector_matriz: 'INTEGRADA'
});

const loading = ref(false);
const error = ref(null);
const data = ref(null);

onMounted(() => {
  // Inicializar fechas (últimos 7 días)
  const today = new Date();
  const lastWeek = new Date();
  lastWeek.setDate(today.getDate() - 7);
  
  filters.value.fecha_fin = today.toISOString().split('T')[0];
  filters.value.fecha_inicio = lastWeek.toISOString().split('T')[0];
  
  fetchData();
});

const formatNumber = (num) => {
  if (num === null || num === undefined) return '-';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
};

const getColorForRend = (pct) => {
  if (pct === null || pct === undefined) return 'text-slate-400 bg-slate-100';
  if (pct >= 98) return 'text-green-700 bg-green-100';
  if (pct >= 95) return 'text-yellow-700 bg-yellow-100';
  return 'text-red-700 bg-red-100';
};

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  data.value = null;
  
  try {
    const params = new URLSearchParams(filters.value);
    const response = await fetch(`/api/produccion/balance-trazabilidad?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const result = await response.json();
    if (result.success) {
      data.value = result;
    } else {
      error.value = result.error || 'Error al obtener datos';
    }
  } catch (err) {
    console.error(err);
    error.value = 'Ocurrió un error al cargar el balance. Por favor, intente de nuevo.';
  } finally {
    loading.value = false;
  }
};

const exportarExcel = async () => {
  if (!data.value || !data.value.data || data.value.data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Balance Trazabilidad');

  // Configurar columnas
  worksheet.columns = [
    { header: 'Partida', key: 'partida', width: 15 },
    { header: 'Artículo', key: 'artigo', width: 25 },
    { header: 'Fecha Matriz', key: 'fecha_str', width: 15 },
    { header: 'Telar (Encog)', key: 'metros_tecelagem_encolh', width: 18 },
    { header: 'Acabado (Integrada)', key: 'metros_acabamento_integrada', width: 20 },
    { header: 'Calidad (Rev)', key: 'metros_calidad_revisados', width: 18 },
    { header: 'Rend. Telar→Acab (%)', key: 'rend_telar_integrada_pct', width: 22 },
    { header: 'Rend. Acab→Cal (%)', key: 'rend_integrada_calidad_pct', width: 22 },
    { header: 'Rend. Global (%)', key: 'rend_global_pct', width: 20 }
  ];

  // Estilos de cabecera
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' } // dark slate 800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Agregar filas
  data.value.data.forEach((row, index) => {
    const excelRow = worksheet.addRow({
      partida: row.partida,
      artigo: row.artigo,
      fecha_str: row.fecha_str,
      metros_tecelagem_encolh: row.metros_tecelagem_encolh || 0,
      metros_acabamento_integrada: row.metros_acabamento_integrada || 0,
      metros_calidad_revisados: row.metros_calidad_revisados || 0,
      rend_telar_integrada_pct: row.rend_telar_integrada_pct !== null ? row.rend_telar_integrada_pct : '',
      rend_integrada_calidad_pct: row.rend_integrada_calidad_pct !== null ? row.rend_integrada_calidad_pct : '',
      rend_global_pct: row.rend_global_pct !== null ? row.rend_global_pct : ''
    });

    // Formato de número
    ['D', 'E', 'F'].forEach(col => {
      excelRow.getCell(col).numFmt = '#,##0.00';
    });
    ['G', 'H', 'I'].forEach(col => {
      excelRow.getCell(col).numFmt = '0.00"%"';
    });

    // Sombreado alterno (cebra)
    if (index % 2 === 1) {
      excelRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF9FAFB' } // slate 50
      };
    }
  });

  // Bordes para toda la tabla
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

  // Generar y descargar archivo
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Balance_Trazabilidad_${filters.value.sector_matriz}_${filters.value.fecha_inicio}_a_${filters.value.fecha_fin}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};
</script>

<style scoped>
/* Agrega estilos extra si es necesario */
</style>
