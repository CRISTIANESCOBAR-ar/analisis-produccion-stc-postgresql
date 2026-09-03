<template>
  <div class="p-6 flex flex-col h-full">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-2xl font-bold text-gray-800">Velocidad Máquina y Tiempos Muertos</h2>
      <div class="flex gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Filial</label>
          <input v-model="filial" type="text" class="mt-1 block w-20 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Máquina</label>
          <input v-model="maquina" type="text" class="mt-1 block w-24 border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Mes (YYYY-MM)</label>
          <input v-model="mes" type="month" class="mt-1 block border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Piso Y</label>
          <select v-model="yAxisMin" class="mt-1 block border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
            <option :value="0">0</option>
            <option :value="5">5</option>
            <option :value="10">10</option>
            <option :value="15">15</option>
            <option :value="20">20</option>
            <option :value="25">25</option>
            <option :value="30">30</option>
            <option :value="35">35</option>
            <option :value="40">40</option>
          </select>
        </div>
        <div class="flex items-end mb-2">
          <label class="flex items-center space-x-2 text-sm font-medium text-gray-700 cursor-pointer">
            <input type="checkbox" v-model="filterReproceso" class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4" />
            <span>Solo Reproceso (R=R)</span>
          </label>
        </div>
        <div class="flex items-end mb-2">
          <button @click="exportToExcel" class="px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 flex items-center gap-2" :disabled="!rawChartData.length">
            <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Exportar Excel
          </button>
        </div>
        <div class="flex items-end mb-2">
          <button @click="fetchData" class="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
            Consultar
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex justify-center items-center h-96">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>

    <div v-else-if="error" class="bg-red-50 p-4 rounded-md">
      <p class="text-red-700">{{ error }}</p>
    </div>

    <div v-else class="bg-white p-4 rounded-lg shadow flex-1 min-h-[600px] w-full" ref="chartContainer"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import ExcelJS from 'exceljs';

const chartContainer = ref(null);
let chartInstance = null;

const filial = ref('05');
const maquina = ref('165001');
const mes = ref('2025-07');
const filterReproceso = ref(false);
const yAxisMin = ref(0);
const rawChartData = ref([]);
const loading = ref(false);
const error = ref(null);

const initChart = (data) => {
  if (chartInstance) {
    chartInstance.dispose();
  }
  chartInstance = echarts.init(chartContainer.value);

  const seriesEntrada = [];
  const seriesSalida = [];

  let chartData = data;
  if (filterReproceso.value) {
    chartData = chartData.filter(d => d.r === 'R');
  }

  chartData.forEach((item) => {
    seriesEntrada.push([item.startTime, parseFloat(item.velocidadEntrada).toFixed(2)]);
    seriesSalida.push([item.startTime, parseFloat(item.velocidadSalida).toFixed(2)]);
    
    seriesEntrada.push([item.endTime, 0]);
    seriesSalida.push([item.endTime, 0]);
  });

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross'
      }
    },
    legend: {
      data: ['Velocidad Entrada', 'Velocidad Salida'],
      top: 'bottom'
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true
    },
    dataZoom: [
      {
        type: 'slider',
        show: true,
        xAxisIndex: [0],
        start: 0,
        end: 100
      },
      {
        type: 'inside',
        xAxisIndex: [0],
        start: 0,
        end: 100
      }
    ],
    xAxis: {
      type: 'time',
      boundaryGap: false,
      axisLabel: {
        formatter: (value) => {
          const date = new Date(value);
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const mins = String(date.getMinutes()).padStart(2, '0');
          return `${day}/${month}\n${hours}:${mins}`;
        }
      }
    },
    yAxis: {
      type: 'value',
      name: 'Velocidad (m/min)',
      min: yAxisMin.value,
      max: 55,
      axisLabel: {
        formatter: '{value} m/m'
      }
    },
    series: [
      {
        name: 'Velocidad Entrada',
        type: 'line',
        step: 'end',
        data: seriesEntrada,
        itemStyle: { color: '#ef4444' },
        markArea: {
          silent: true,
          itemStyle: {
            opacity: 0.15
          },
          data: [
            [
              { yAxis: 0, itemStyle: { color: '#fca5a5' } },
              { yAxis: 40 }
            ],
            [
              { yAxis: 40, itemStyle: { color: '#86efac' } },
              { yAxis: 45 }
            ],
            [
              { yAxis: 45, itemStyle: { color: '#93c5fd' } },
              { yAxis: 50 }
            ]
          ]
        },
        markLine: {
          silent: true,
          lineStyle: {
            color: '#dc2626',
            type: 'solid',
            width: 2
          },
          data: [
            { yAxis: 50, name: 'Límite Máquina' }
          ]
        }
      },
      {
        name: 'Velocidad Salida',
        type: 'line',
        step: 'end',
        data: seriesSalida,
        itemStyle: { color: '#3b82f6' }
      }
    ]
  };

  chartInstance.setOption(option);
};

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/produccion/velocidad-maquina?filial=${filial.value}&maquina=${maquina.value}&mes=${mes.value}`);
    const result = await response.json();
    if (result.success) {
      rawChartData.value = result.data;
      setTimeout(() => initChart(rawChartData.value), 0);
    } else {
      error.value = result.message || 'Error al obtener datos';
    }
  } catch (err) {
    console.error(err);
    error.value = 'Error de conexión con el servidor';
  } finally {
    loading.value = false;
  }
};

const handleResize = () => {
  if (chartInstance) {
    chartInstance.resize();
  }
};

const exportToExcel = async () => {
  if (!rawChartData.value || rawChartData.value.length === 0) return;
  
  let chartData = rawChartData.value;
  if (filterReproceso.value) {
    chartData = chartData.filter(d => d.r === 'R');
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Velocidad Máquina');
  
  ws.columns = [
    { header: 'Partida', key: 'partida', width: 15 },
    { header: 'Artículo', key: 'artigo', width: 20 },
    { header: 'Trama', key: 'trama', width: 15 },
    { header: 'Reproceso (R)', key: 'r', width: 15 },
    { header: 'Inicio', key: 'startTime', width: 20 },
    { header: 'Final', key: 'endTime', width: 20 },
    { header: 'Minutos', key: 'totalMinutes', width: 12 },
    { header: 'Metros Totales', key: 'totalMetragem', width: 15 },
    { header: 'Encogimiento (%)', key: 'encogimiento', width: 18 },
    { header: 'Metros Entrada', key: 'metrosEntrada', width: 18 },
    { header: 'Velocidad Entrada (m/min)', key: 'velocidadEntrada', width: 25 },
    { header: 'Velocidad Salida (m/min)', key: 'velocidadSalida', width: 25 }
  ];
  
  ws.getRow(1).font = { bold: true };
  
  chartData.forEach(row => {
    ws.addRow({
      partida: row.partida,
      artigo: row.artigo,
      trama: row.trama || '-',
      r: row.r || '',
      startTime: new Date(row.startTime).toLocaleString(),
      endTime: new Date(row.endTime).toLocaleString(),
      totalMinutes: row.totalMinutes.toFixed(2),
      totalMetragem: row.totalMetragem.toFixed(2),
      encogimiento: row.encogimiento.toFixed(2),
      metrosEntrada: row.metrosEntrada.toFixed(2),
      velocidadEntrada: row.velocidadEntrada.toFixed(2),
      velocidadSalida: row.velocidadSalida.toFixed(2)
    });
  });
  
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Velocidad_Maquina_${maquina.value}_${mes.value}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
};

onMounted(() => {
  fetchData();
  window.addEventListener('resize', handleResize);
});

watch([filterReproceso, yAxisMin], () => {
  if (rawChartData.value.length > 0) {
    initChart(rawChartData.value);
  }
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  if (chartInstance) {
    chartInstance.dispose();
  }
});
</script>
