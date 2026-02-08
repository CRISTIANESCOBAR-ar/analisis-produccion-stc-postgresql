<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main ref="mainContentRef" class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-2 py-1.5 border border-slate-200 flex flex-col relative">
      <!-- Overlay de carga -->
      <div v-if="cargando" class="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-50 rounded-2xl transition-all duration-300">
        <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
          <div class="relative">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="h-8 w-8 bg-blue-600 rounded-full animate-pulse opacity-10"></div>
            </div>
          </div>
          <div class="flex flex-col items-center gap-1">
            <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Cargando ROLADAS</span>
            <span class="text-xl text-slate-800 font-bold">{{ periodoFormateado }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-4 flex-shrink-0 mb-4">
        <div class="flex items-center gap-6">
          <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-10 w-auto object-contain" />
          <h3 class="text-lg font-semibold text-slate-800">ROLADAS del Mes - Producción ÍNDIGO</h3>
          <div class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span class="text-sm font-medium text-slate-600">Total Roladas:</span>
            <span class="text-sm font-bold text-blue-700">{{ datos.length }}</span>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button
            @click="copiarComoImagen"
            :disabled="copiando || datos.length === 0"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-400 text-white font-medium rounded-md transition-colors shadow-sm"
            v-tippy="{ content: 'Copiar tabla como imagen', placement: 'bottom' }"
          >
            <svg v-if="!copiando" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,21H8V7H19M19,5H8A2,2 0 0,0 6,7V21A2,2 0 0,0 8,23H19A2,2 0 0,0 21,21V7A2,2 0 0,0 19,5M16,1H4A2,2 0 0,0 2,3V17H4V3H16V1Z"/>
            </svg>
            <svg v-else class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span class="text-sm">{{ copiando ? 'Copiando...' : 'Copiar' }}</span>
          </button>
          <button
            @click="imprimirTabla"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors shadow-sm"
            v-tippy="{ content: 'Imprimir informe', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18,3H6V7H18M19,12A1,1 0 0,1 18,11A1,1 0 0,1 19,10A1,1 0 0,1 20,11A1,1 0 0,1 19,12M16,19H8V14H16M19,8H5A3,3 0 0,0 2,11V17H6V21H18V17H22V11A3,3 0 0,0 19,8Z"/>
            </svg>
            <span class="text-sm">Imprimir</span>
          </button>
          <button            @click="exportarAExcel"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-md transition-colors shadow-sm"
            v-tippy="{ content: 'Exportar informe a Excel', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12.9,14.5L15.8,19H14L12,15.6L10,19H8.2L11.1,14.5L8.2,10H10L12,13.4L14,10H15.8L12.9,14.5Z"/>
            </svg>
            <span class="text-sm">Excel</span>
          </button>
          <CustomDatepicker 
            v-model="fechaSeleccionada" 
            label="Fecha:" 
            :show-buttons="true"
            @change="cargarDatos" 
          />
        </div>
      </div>

      <div class="flex-1 overflow-auto min-h-0 border border-slate-300 rounded-lg shadow-sm relative" ref="tablaRef">
        <table ref="tableElementRef" class="w-full text-sm text-left text-slate-600 font-[Verdana] border-separate border-spacing-0">
          <thead class="text-xs text-slate-700 bg-slate-50 sticky top-0 z-10">
            <tr>
              <th scope="col" rowspan="2" class="pl-1.5 pr-1.5 py-1 font-semibold border-b-2 border-b-slate-300 border-r-2 border-slate-300 text-center bg-slate-50 w-14">Rolada</th>
              <th scope="col" colspan="7" class="px-2 py-0.5 font-semibold border-b border-b-slate-200 border-r-2 border-slate-300 bg-slate-100 text-center">URDIDEIRA</th>
              <th scope="col" colspan="15" class="px-2 py-0.5 font-semibold border-b border-b-slate-200 border-r-2 border-slate-300 bg-slate-100 text-center">ÍNDIGO</th>
              <th scope="col" colspan="4" class="px-2 py-0.5 font-semibold border-b border-b-slate-200 border-r-2 border-slate-300 bg-slate-100 text-center">TEJEDURÍA</th>
              <th scope="col" colspan="3" class="px-2 py-0.5 font-semibold border-b border-b-slate-200 bg-slate-100 text-center">CALIDAD</th>
            </tr>
            <tr>
              <th scope="col" class="px-1 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-16">Fecha</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Maq. OE</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Lote</th>
              <th scope="col" class="px-1.5 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-16">Metros</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Rot. Tot.</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Rot 10⁶</th>
              <th scope="col" class="px-0.5 py-1 font-medium border-b-2 border-b-slate-300 border-r-2 border-slate-300 bg-slate-50 text-center w-12 text-[10px] leading-tight">Tiem<br>po</th>
              <th scope="col" class="px-1 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-16">Fecha</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Base</th>
              <th scope="col" class="px-0.5 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-12">Col</th>
              <th scope="col" class="px-1.5 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-16">Metros</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Rot. Tot.</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Rot 10³</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">CV</th>
              <th scope="col" class="px-0.5 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-12 text-[10px] leading-tight">Tiem<br>po</th>
              <th scope="col" class="px-1.5 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-12">Vel.</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">N</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">%</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">P</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">%</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Q</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r-2 border-slate-300 bg-slate-50 text-center">%</th>
              <th scope="col" class="px-1.5 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-16">Metros</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Efic. %</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Rot URD 10⁵</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r-2 border-slate-300 bg-slate-50 text-center">Rot TRA 10⁵</th>
              <th scope="col" class="px-1.5 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center w-16">Metros</th>
              <th scope="col" class="px-2 py-1 font-medium border-b-2 border-b-slate-300 border-r border-slate-200 bg-slate-50 text-center">Cal. %</th>
              <th scope="col" class="px-0.5 py-1 font-medium border-b-2 border-b-slate-300 bg-slate-50 text-center w-10 text-[10px] leading-tight">Pts<br>100<br>m²</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in datos" :key="`${item.ROLADA}-${item.COR}`" 
                class="border-b border-slate-200 hover:bg-slate-50/80 transition-colors">
              <td class="pl-1.5 pr-1.5 py-1.5 font-semibold text-slate-800 text-center border-r-2 border-slate-300 bg-slate-50/50 whitespace-nowrap">{{ item.ROLADA }}</td>
              <td class="px-1 py-1.5 border-r border-slate-200 text-center text-slate-500 text-xs whitespace-nowrap">{{ formatFechaCorta(item.FECHA_URDIDORA) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{{ formatListaConY(item.MAQ_OE) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono">{{ formatListaConY(item.LOTE) }}</td>
              <td class="px-1.5 py-1.5 border-r border-slate-200 text-center text-slate-700 font-medium font-mono tabular-nums">{{ formatNumber(item.URDIDORA_M, 0) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono tabular-nums">{{ item.URDIDORA_ROT_TOT }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-semibold text-emerald-700 tabular-nums">{{ formatNumber(item.URDIDORA_ROT_106, 2) }}</td>
              <td class="px-0.5 py-1.5 border-r-2 border-slate-300 text-center text-slate-600 font-mono tabular-nums text-xs">{{ formatTiempo(item.URDIDORA_TIEMPO_MIN) }}</td>
              <td class="px-1 py-1.5 border-r border-slate-200 text-center text-slate-500 text-xs whitespace-nowrap">{{ formatFechaCorta(item.FECHA_INDIGO) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center text-slate-700">{{ item.ARTIGO ? item.ARTIGO.substring(0, 10) : '' }}</td>
              <td class="px-0.5 py-1.5 border-r border-slate-200 text-center text-slate-600 text-xs break-words">{{ item.COR }}</td>
              <td class="px-1.5 py-1.5 border-r border-slate-200 text-center text-slate-700 font-medium font-mono tabular-nums">{{ formatNumber(item.METRAGEM, 0) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono tabular-nums">{{ formatNumber(item.RUPTURAS, 0) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-semibold text-blue-700 tabular-nums">{{ formatNumber(item.ROT_103, 2) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono tabular-nums">{{ formatNumber(item.CAVALOS, 0) }}</td>
              <td class="px-0.5 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono tabular-nums text-xs">{{ formatTiempo(item.TIEMPO_MINUTOS) }}</td>
              <td class="px-1.5 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono tabular-nums">{{ formatNumber(item.VELOC_PROMEDIO, 1).replace(',0', '') }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono tabular-nums" :class="getCalidadColor(item.N_PERCENT)">{{ item.N_COUNT }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-semibold tabular-nums" :class="getCalidadColor(item.N_PERCENT)">{{ formatNumber(item.N_PERCENT, 1) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono tabular-nums" :class="getCalidadColor(item.P_PERCENT)">{{ item.P_COUNT }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-semibold tabular-nums" :class="getCalidadColor(item.P_PERCENT)">{{ formatNumber(item.P_PERCENT, 1) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono tabular-nums" :class="getCalidadColor(item.Q_PERCENT)">{{ item.Q_COUNT }}</td>
              <td class="px-2 py-1.5 border-r-2 border-slate-300 text-center font-mono font-semibold tabular-nums" :class="getCalidadColor(item.Q_PERCENT)">{{ formatNumber(item.Q_PERCENT, 1) }}</td>
              <td class="px-1.5 py-1.5 border-r border-slate-200 text-center text-slate-700 font-medium font-mono tabular-nums">{{ formatNumber(item.TECELAGEM_METROS, 0) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-semibold text-purple-700 tabular-nums">{{ formatNumber(item.TECELAGEM_EFICIENCIA, 1) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center text-slate-600 font-mono tabular-nums">{{ formatNumber(item.RT105, 2) }}</td>
              <td class="px-2 py-1.5 border-r-2 border-slate-300 text-center text-slate-600 font-mono tabular-nums">{{ formatNumber(item.RU105, 2) }}</td>
              <td class="px-1.5 py-1.5 border-r border-slate-200 text-center text-slate-700 font-medium font-mono tabular-nums">{{ formatNumber(item.METROS_CAL, 0) }}</td>
              <td class="px-2 py-1.5 border-r border-slate-200 text-center font-mono font-semibold text-amber-700 tabular-nums">{{ formatNumber(item.CAL_PERCENT, 1) }}</td>
              <td class="px-0.5 py-1.5 text-center text-slate-600 font-mono tabular-nums text-xs">{{ formatNumber(item.PTS_100M2, 1) }}</td>
            </tr>
            <tr v-if="datos.length === 0 && !cargando" class="bg-slate-50">
              <td colspan="30" class="px-4 py-8 text-center text-slate-500">
                No hay datos disponibles para el período seleccionado
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import CustomDatepicker from './CustomDatepicker.vue';
import ExcelJS from 'exceljs';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');
const API_URL = API_BASE ? `${API_BASE}/api` : '/api';
const cargando = ref(false);
const copiando = ref(false);
const datos = ref([]);

// Inicializar con fecha de ayer en formato YYYY-MM-DD
const hoy = new Date();
const ayer = new Date(hoy);
ayer.setDate(ayer.getDate() - 1);
const fechaSeleccionada = ref(`${ayer.getFullYear()}-${String(ayer.getMonth() + 1).padStart(2, '0')}-${String(ayer.getDate()).padStart(2, '0')}`);

const mainContentRef = ref(null);
const tablaRef = ref(null);
const tableElementRef = ref(null);

const periodoFormateado = computed(() => {
  if (!fechaSeleccionada.value) return '';
  const [year, month] = fechaSeleccionada.value.split('-').map(Number);
  const fecha = new Date(year, month - 1, 1);
  const mes = fecha.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
  return mes.charAt(0).toUpperCase() + mes.slice(1);
});

const formatNumber = (valor, decimales = 0) => {
  if (valor === null || valor === undefined || valor === '') return '';
  const num = parseFloat(valor);
  if (isNaN(num)) return '';
  return num.toLocaleString('es-ES', { 
    minimumFractionDigits: decimales, 
    maximumFractionDigits: decimales,
    useGrouping: true
  });
};

const formatTiempo = (minutos) => {
  if (!minutos || minutos <= 0) return '';
  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);
  return `${horas}:${mins.toString().padStart(2, '0')}`;
};

const formatFechaCorta = (fechaStr) => {
  if (!fechaStr) return '';
  // Espera formato YYYY-MM-DD o DD/MM/YYYY
  const partes = fechaStr.includes('-') ? fechaStr.split('-') : fechaStr.split('/');
  if (partes.length !== 3) return fechaStr;
  
  let dia, mes, anio;
  if (partes[0].length === 4) {
    // Formato YYYY-MM-DD
    anio = partes[0].slice(2); // Últimos 2 dígitos
    mes = partes[1];
    dia = partes[2];
  } else {
    // Formato DD/MM/YYYY
    dia = partes[0];
    mes = partes[1];
    anio = partes[2].slice(2); // Últimos 2 dígitos
  }
  
  return `${dia}/${mes}/${anio}`;
};

const convertirFechaADate = (fechaStr) => {
  if (!fechaStr || fechaStr === '') return null;
  
  try {
    // Espera formato YYYY-MM-DD o DD/MM/YYYY
    const partes = fechaStr.includes('-') ? fechaStr.split('-') : fechaStr.split('/');
    if (partes.length !== 3) return null;
    
    let dia, mes, anio;
    if (partes[0].length === 4) {
      // Formato YYYY-MM-DD
      anio = parseInt(partes[0]);
      mes = parseInt(partes[1]) - 1; // Los meses en JS van de 0-11
      dia = parseInt(partes[2]);
    } else {
      // Formato DD/MM/YYYY
      dia = parseInt(partes[0]);
      mes = parseInt(partes[1]) - 1; // Los meses en JS van de 0-11
      anio = parseInt(partes[2]);
    }
    
    const fecha = new Date(anio, mes, dia);
    // Verificar que la fecha sea válida
    if (isNaN(fecha.getTime())) return null;
    return fecha;
  } catch (error) {
    console.error('Error convirtiendo fecha:', fechaStr, error);
    return null;
  }
};

const getCalidadColor = (percent) => {
  if (!percent || percent === 0) return 'text-slate-400';
  if (percent >= 80) return 'text-green-600';
  if (percent >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const formatListaConY = (lista) => {
  if (!lista || lista === '') return '';
  // Separar por coma (con o sin espacio)
  const items = lista.split(',').map(item => item.trim()).filter(item => item !== '');
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(' y ');
  const ultimos = items.slice(-2).join(' y ');
  const primeros = items.slice(0, -2).join(', ');
  return primeros + ', ' + ultimos;
};

const cargarDatos = async () => {
  cargando.value = true;
  try {
    if (!fechaSeleccionada.value) return;
    
    const [year, month] = fechaSeleccionada.value.split('-').map(Number);
    
    // Primer día del mes
    const fechaInicio = new Date(year, month - 1, 1);
    
    // Ayer (día actual - 1)
    const hoy = new Date();
    const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
    
    // Si el mes seleccionado es el actual, usar ayer como fecha fin
    // Si es un mes anterior, usar el último día del mes
    let fechaFin;
    if (year === hoy.getFullYear() && month === (hoy.getMonth() + 1)) {
      fechaFin = ayer;
    } else {
      fechaFin = new Date(year, month, 0); // Último día del mes
    }
    
    const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
    const fechaFinStr = fechaFin.toISOString().split('T')[0];
    
    const response = await fetch(`${API_URL}/informe-produccion-indigo?fechaInicio=${fechaInicioStr}&fechaFin=${fechaFinStr}`);
    
    if (!response.ok) throw new Error('Error al cargar datos');
    
    datos.value = await response.json();
  } catch (error) {
    console.error('Error cargando datos:', error);
    alert('Error al cargar los datos');
  } finally {
    cargando.value = false;
  }
};

const exportarAExcel = async () => {
  if (datos.value.length === 0) {
    alert('No hay datos para exportar');
    return;
  }
  
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('ROLADAS del Mes');
    
    // Configurar orientación y márgenes
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape', // Apaisado
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.1968, // 5mm en pulgadas
        right: 0.1968, // 5mm en pulgadas
        top: 0.3937, // 10mm en pulgadas
        bottom: 0.3937, // 10mm en pulgadas
        header: 0.1968,
        footer: 0.1968
      }
    };
    
    // Crear dos filas de encabezado
    worksheet.addRow(['Rolada', 'URDIDEIRA', '', '', '', '', '', '', 'ÍNDIGO', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'TEJEDURÍA', '', '', '', 'CALIDAD', '', '']);
    worksheet.addRow(['', 'Fecha', 'Maq. OE', 'Lote', 'Metros', 'Rot. Tot.', 'Rot 10⁶', 'Tiempo', 'Fecha', 'Base', 'Col', 'Metros', 'Rot. Tot.', 'Rot 10³', 'CV', 'Tiempo', 'Vel.', 'N', '%', 'P', '%', 'Q', '%', 'Metros', 'Efic. %', 'Rot URD 10⁵', 'Rot TRA 10⁵', 'Metros', 'Cal. %', 'Pts. 100m²']);
    
    // Combinar celdas de la primera fila
    worksheet.mergeCells('A1:A2');
    worksheet.mergeCells('B1:H1');
    worksheet.mergeCells('I1:W1');
    worksheet.mergeCells('X1:AA1');
    worksheet.mergeCells('AB1:AD1');
    
    // Estilo de encabezados - Primera fila (grupos)
    const headerRow1 = worksheet.getRow(1);
    headerRow1.height = 20;
    headerRow1.font = { bold: true, size: 10 };
    headerRow1.alignment = { vertical: 'middle', horizontal: 'center' };
    
    // Aplicar estilo solo a las celdas con contenido en la primera fila
    headerRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }; // Rolada
    headerRow1.getCell(1).value = 'Rolada';
    headerRow1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // URDIDEIRA - verde claro
    headerRow1.getCell(2).value = 'URDIDEIRA';
    headerRow1.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }; // ÍNDIGO - azul claro
    headerRow1.getCell(9).value = 'ÍNDIGO';
    headerRow1.getCell(24).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }; // TEJEDURÍA - púrpura claro
    headerRow1.getCell(24).value = 'TEJEDURÍA';
    headerRow1.getCell(28).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }; // CALIDAD - amarillo claro
    headerRow1.getCell(28).value = 'CALIDAD';
    
    // Bordes para la primera fila
    headerRow1.getCell(1).border = {
      right: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    headerRow1.getCell(2).border = {
      right: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    headerRow1.getCell(9).border = {
      right: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    headerRow1.getCell(24).border = {
      right: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    headerRow1.getCell(28).border = {
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
    
    // Estilo de encabezados - Segunda fila (columnas)
    const headerRow2 = worksheet.getRow(2);
    headerRow2.height = 30;
    headerRow2.font = { bold: false, size: 9 };
    headerRow2.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    
    // Aplicar estilo y bordes a cada celda de la segunda fila según su sección
    for (let col = 1; col <= 30; col++) {
      const cell = headerRow2.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // bg-slate-50
      
      // Determinar el tipo de borde derecho según la sección
      let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } };
      if (col === 1 || col === 8 || col === 23 || col === 27) {
        rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }; // Bordes gruesos entre secciones
      }
      // La última columna debe tener borde delgado
      if (col === 30) {
        rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } };
      }
      
      cell.border = {
        right: rightBorder,
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }
      };
    }
    
    // Ajustar anchos de columnas
    worksheet.columns = [
      { key: 'ROLADA', width: 7 },
      { key: 'FECHA_URDIDORA', width: 10 },
      { key: 'MAQ_OE', width: 10 },
      { key: 'LOTE', width: 10 },
      { key: 'URDIDORA_M', width: 9 },
      { key: 'URDIDORA_ROT_TOT', width: 8 },
      { key: 'URDIDORA_ROT_106', width: 8 },
      { key: 'URDIDORA_TIEMPO', width: 7 },
      { key: 'FECHA_INDIGO', width: 10 },
      { key: 'ARTIGO', width: 12 },
      { key: 'COR', width: 7 },
      { key: 'METRAGEM', width: 9 },
      { key: 'RUPTURAS', width: 8 },
      { key: 'ROT_103', width: 8 },
      { key: 'CAVALOS', width: 3 },
      { key: 'TIEMPO_MINUTOS', width: 7 },
      { key: 'VELOC_PROMEDIO', width: 7 },
      { key: 'N_COUNT', width: 5 },
      { key: 'N_PERCENT', width: 5 },
      { key: 'P_COUNT', width: 5 },
      { key: 'P_PERCENT', width: 5 },
      { key: 'Q_COUNT', width: 5 },
      { key: 'Q_PERCENT', width: 5 },
      { key: 'TECELAGEM_METROS', width: 9 },
      { key: 'TECELAGEM_EFICIENCIA', width: 8 },
      { key: 'RT105', width: 8 },
      { key: 'RU105', width: 8 },
      { key: 'METROS_CAL', width: 9 },
      { key: 'CAL_PERCENT', width: 7 },
      { key: 'PTS_100M2', width: 6 }
    ];
    
    // Agregar datos
    datos.value.forEach(item => {
      const row = worksheet.addRow({
        ROLADA: item.ROLADA,
        FECHA_URDIDORA: convertirFechaADate(item.FECHA_URDIDORA),
        MAQ_OE: formatListaConY(item.MAQ_OE),
        LOTE: formatListaConY(item.LOTE),
        URDIDORA_M: item.URDIDORA_M !== null && item.URDIDORA_M !== undefined && item.URDIDORA_M !== '' ? Number(item.URDIDORA_M) : null,
        URDIDORA_ROT_TOT: item.URDIDORA_ROT_TOT !== null && item.URDIDORA_ROT_TOT !== undefined && item.URDIDORA_ROT_TOT !== '' ? Number(item.URDIDORA_ROT_TOT) : null,
        URDIDORA_ROT_106: item.URDIDORA_ROT_106 !== null && item.URDIDORA_ROT_106 !== undefined && item.URDIDORA_ROT_106 !== '' ? Number(item.URDIDORA_ROT_106) : null,
        URDIDORA_TIEMPO: item.URDIDORA_TIEMPO_MIN ? item.URDIDORA_TIEMPO_MIN / 1440 : null, // Convertir minutos a fracción de día
        FECHA_INDIGO: convertirFechaADate(item.FECHA_INDIGO),
        ARTIGO: item.ARTIGO ? item.ARTIGO.substring(0, 10) : '',
        COR: item.COR,
        METRAGEM: item.METRAGEM !== null && item.METRAGEM !== undefined && item.METRAGEM !== '' ? Number(item.METRAGEM) : null,
        RUPTURAS: item.RUPTURAS !== null && item.RUPTURAS !== undefined && item.RUPTURAS !== '' ? Number(item.RUPTURAS) : null,
        ROT_103: item.ROT_103 !== null && item.ROT_103 !== undefined && item.ROT_103 !== '' ? Number(item.ROT_103) : null,
        CAVALOS: item.CAVALOS !== null && item.CAVALOS !== undefined && item.CAVALOS !== '' ? Number(item.CAVALOS) : null,
        TIEMPO_MINUTOS: item.TIEMPO_MINUTOS ? item.TIEMPO_MINUTOS / 1440 : null, // Convertir minutos a fracción de día
        VELOC_PROMEDIO: item.VELOC_PROMEDIO !== null && item.VELOC_PROMEDIO !== undefined && item.VELOC_PROMEDIO !== '' ? Number(item.VELOC_PROMEDIO) : null,
        N_COUNT: item.N_COUNT !== null && item.N_COUNT !== undefined && item.N_COUNT !== '' ? Number(item.N_COUNT) : null,
        N_PERCENT: item.N_PERCENT !== null && item.N_PERCENT !== undefined && item.N_PERCENT !== '' ? Number(item.N_PERCENT) : null,
        P_COUNT: item.P_COUNT !== null && item.P_COUNT !== undefined && item.P_COUNT !== '' ? Number(item.P_COUNT) : null,
        P_PERCENT: item.P_PERCENT !== null && item.P_PERCENT !== undefined && item.P_PERCENT !== '' ? Number(item.P_PERCENT) : null,
        Q_COUNT: item.Q_COUNT !== null && item.Q_COUNT !== undefined && item.Q_COUNT !== '' ? Number(item.Q_COUNT) : null,
        Q_PERCENT: item.Q_PERCENT !== null && item.Q_PERCENT !== undefined && item.Q_PERCENT !== '' ? Number(item.Q_PERCENT) : null,
        TECELAGEM_METROS: item.TECELAGEM_METROS !== null && item.TECELAGEM_METROS !== undefined && item.TECELAGEM_METROS !== '' ? Number(item.TECELAGEM_METROS) : null,
        TECELAGEM_EFICIENCIA: item.TECELAGEM_EFICIENCIA !== null && item.TECELAGEM_EFICIENCIA !== undefined && item.TECELAGEM_EFICIENCIA !== '' ? Number(item.TECELAGEM_EFICIENCIA) : null,
        RT105: item.RT105 !== null && item.RT105 !== undefined && item.RT105 !== '' ? Number(item.RT105) : null,
        RU105: item.RU105 !== null && item.RU105 !== undefined && item.RU105 !== '' ? Number(item.RU105) : null,
        METROS_CAL: item.METROS_CAL !== null && item.METROS_CAL !== undefined && item.METROS_CAL !== '' ? Number(item.METROS_CAL) : null,
        CAL_PERCENT: item.CAL_PERCENT !== null && item.CAL_PERCENT !== undefined && item.CAL_PERCENT !== '' ? Number(item.CAL_PERCENT) : null,
        PTS_100M2: item.PTS_100M2 !== null && item.PTS_100M2 !== undefined && item.PTS_100M2 !== '' ? Number(item.PTS_100M2) : null
      });
      
      row.height = 16;
      row.alignment = { vertical: 'middle', horizontal: 'center' };
      row.font = { size: 9 };
      
      // Bordes y colores de fondo para cada celda
      const rowIndex = row.number;
      const bgColor = rowIndex % 2 === 1 ? 'FFFFFFFF' : 'FFF8FAFC';
      
      // Aplicar estilos celda por celda solo a las 30 columnas con datos
      for (let col = 1; col <= 30; col++) {
        const cell = row.getCell(col);
        
        // Fondo alternado
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
        
        // Determinar el tipo de borde derecho según la sección
        let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        if (col === 1 || col === 8 || col === 23 || col === 27) {
          rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }; // Bordes gruesos entre secciones
        }
        // La última columna debe tener borde delgado
        if (col === 30) {
          rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } };
        }
        
        cell.border = {
          right: rightBorder,
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };
      }
      
      // Primera columna en negrita
      row.getCell(1).font = { bold: true, size: 9 };
      
      // Formato numérico y de fecha
      row.getCell('FECHA_URDIDORA').numFmt = 'dd/mm/yy';
      row.getCell('URDIDORA_M').numFmt = '#,##0';
      row.getCell('URDIDORA_ROT_TOT').numFmt = '#,##0';
      row.getCell('URDIDORA_ROT_106').numFmt = '#,##0.00';
      row.getCell('URDIDORA_TIEMPO').numFmt = '[hh]:mm';
      row.getCell('FECHA_INDIGO').numFmt = 'dd/mm/yy';
      row.getCell('METRAGEM').numFmt = '#,##0';
      row.getCell('RUPTURAS').numFmt = '#,##0';
      row.getCell('ROT_103').numFmt = '#,##0.00';
      row.getCell('CAVALOS').numFmt = '#,##0';
      row.getCell('TIEMPO_MINUTOS').numFmt = '[hh]:mm';
      row.getCell('VELOC_PROMEDIO').numFmt = '#,##0.0';
      row.getCell('N_COUNT').numFmt = '#,##0';
      row.getCell('N_PERCENT').numFmt = '#,##0.0';
      row.getCell('P_COUNT').numFmt = '#,##0';
      row.getCell('P_PERCENT').numFmt = '#,##0.0';
      row.getCell('Q_COUNT').numFmt = '#,##0';
      row.getCell('Q_PERCENT').numFmt = '#,##0.0';
      row.getCell('TECELAGEM_METROS').numFmt = '#,##0';
      row.getCell('TECELAGEM_EFICIENCIA').numFmt = '#,##0.00';
      row.getCell('RT105').numFmt = '#,##0.00';
      row.getCell('RU105').numFmt = '#,##0.00';
      row.getCell('METROS_CAL').numFmt = '#,##0';
      row.getCell('CAL_PERCENT').numFmt = '#,##0.0';
      row.getCell('PTS_100M2').numFmt = '#,##0.0';
      
      // Colores especiales para valores destacados
      row.getCell('URDIDORA_ROT_106').font = { size: 9, color: { argb: 'FF059669' }, bold: true }; // emerald-700
      row.getCell('ROT_103').font = { size: 9, color: { argb: 'FF2563EB' }, bold: true }; // blue-700
      row.getCell('TECELAGEM_EFICIENCIA').font = { size: 9, color: { argb: 'FF7C3AED' }, bold: true }; // purple-700
      row.getCell('CAL_PERCENT').font = { size: 9, color: { argb: 'FFB45309' }, bold: true }; // amber-700
    });
    
    // Aplicar autofiltro en la segunda fila (fila de encabezados de columnas)
    const ultimaFila = worksheet.rowCount;
    worksheet.autoFilter = {
      from: { row: 2, column: 1 },
      to: { row: ultimaFila, column: 29 }
    };
    
    // Generar archivo
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    // Agregar timestamp al nombre del archivo
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    const timestamp = `${dd}-${mm}-${yy}_${hh}${min}${ss}`;
    
    a.download = `ROLADAS_${periodoFormateado.value}_${timestamp}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error exportando a Excel:', error);
    alert('Error al exportar a Excel');
  }
};

const copiarComoImagen = async () => {
  if (datos.value.length === 0) {
    Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay datos para copiar', timer: 1500, showConfirmButton: false });
    return;
  }
  
  copiando.value = true;
  
  try {
    // Crear contenedor temporal con estilos inline
    const container = document.createElement('div');
    container.style.cssText = 'position: absolute; left: -9999px; background: #ffffff; padding: 16px; font-family: Verdana, sans-serif;';
    
    // Crear encabezado
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; gap: 16px; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1;';
    
    // Logo
    const logo = document.createElement('img');
    logo.src = '/LogoSantana.jpg';
    logo.style.cssText = 'height: 36px; width: auto;';
    header.appendChild(logo);
    
    // Título
    const headerText = document.createElement('div');
    headerText.innerHTML = `
      <div style="font-size: 16px; font-weight: 600; color: #1e293b;">ROLADAS del Mes - Producción ÍNDIGO</div>
      <div style="font-size: 12px; color: #64748b;">${periodoFormateado.value}</div>
    `;
    header.appendChild(headerText);
    
    // Info de registros
    const headerInfo = document.createElement('div');
    headerInfo.style.cssText = 'margin-left: auto; background: #dbeafe; padding: 4px 12px; border-radius: 6px;';
    headerInfo.innerHTML = `
      <span style="font-size: 11px; color: #64748b;">Total Roladas:</span>
      <span style="font-size: 13px; font-weight: 700; color: #1d4ed8; margin-left: 4px;">${datos.value.length}</span>
    `;
    header.appendChild(headerInfo);
    container.appendChild(header);
    
    // Colores
    const colors = {
      headerBg: '#f8fafc',
      headerBg2: '#f1f5f9',
      headerText: '#334155',
      border: '#cbd5e1',
      borderLight: '#e2e8f0',
      text: '#334155',
      textLight: '#64748b'
    };
    
    // Crear tabla
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse: collapse; font-size: 11px; width: 100%; font-family: Verdana, sans-serif; border: 1px solid ' + colors.border + ';';
    
    // Thead - Primera fila (grupos)
    const thead = document.createElement('thead');
    const headerRow1 = document.createElement('tr');
    headerRow1.innerHTML = `
      <th rowspan="2" style="background: ${colors.headerBg}; color: ${colors.headerText}; padding: 8px 6px; text-align: center; vertical-align: middle; border-right: 2px solid ${colors.border}; border-bottom: 1px solid ${colors.borderLight}; font-size: 10px; font-weight: 600;">Rolada</th>
      <th colspan="7" style="background: ${colors.headerBg2}; color: ${colors.headerText}; padding: 6px; text-align: center; border-right: 2px solid ${colors.border}; border-bottom: 1px solid ${colors.borderLight}; font-size: 10px; font-weight: 600;">URDIDEIRA</th>
      <th colspan="15" style="background: ${colors.headerBg2}; color: ${colors.headerText}; padding: 6px; text-align: center; border-right: 2px solid ${colors.border}; border-bottom: 1px solid ${colors.borderLight}; font-size: 10px; font-weight: 600;">ÍNDIGO</th>
      <th colspan="3" style="background: ${colors.headerBg2}; color: ${colors.headerText}; padding: 6px; text-align: center; border-right: 2px solid ${colors.border}; border-bottom: 1px solid ${colors.borderLight}; font-size: 10px; font-weight: 600;">TEJEDURÍA</th>
      <th colspan="3" style="background: ${colors.headerBg2}; color: ${colors.headerText}; padding: 6px; text-align: center; border-bottom: 1px solid ${colors.borderLight}; font-size: 10px; font-weight: 600;">CALIDAD</th>
    `;
    thead.appendChild(headerRow1);
    
    // Thead - Segunda fila (columnas)
    const headerRow2 = document.createElement('tr');
    const subHeaders = [
      { text: 'Fecha', width: '60px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Maq. OE', width: '55px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Lote', width: '55px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Metros', width: '55px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Rot. Tot.', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Rot 10⁶', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Tiempo', width: '50px', borderRight: '2px solid ' + colors.border },
      { text: 'Fecha', width: '60px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Base', width: '65px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Col', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Metros', width: '55px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Rot. Tot.', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Rot 10³', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'CV', width: '17px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Tiempo', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Vel.', width: '45px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'N', width: '35px', borderRight: '1px solid ' + colors.borderLight },
      { text: '%', width: '40px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'P', width: '35px', borderRight: '1px solid ' + colors.borderLight },
      { text: '%', width: '40px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Q', width: '35px', borderRight: '1px solid ' + colors.borderLight },
      { text: '%', width: '40px', borderRight: '2px solid ' + colors.border },
      { text: 'Efic. %', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Rot URD 10⁵', width: '60px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Rot TRA 10⁵', width: '60px', borderRight: '2px solid ' + colors.border },
      { text: 'Metros', width: '55px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Cal. %', width: '50px', borderRight: '1px solid ' + colors.borderLight },
      { text: 'Pts. 100m²', width: '55px', borderRight: 'none' }
    ];
    
    subHeaders.forEach(h => {
      const th = document.createElement('th');
      th.style.cssText = `background: ${colors.headerBg}; color: ${colors.headerText}; padding: 6px 4px; text-align: center; vertical-align: middle; border-right: ${h.borderRight}; border-bottom: 2px solid ${colors.border}; font-size: 9px; font-weight: 500; width: ${h.width};`;
      th.textContent = h.text;
      headerRow2.appendChild(th);
    });
    thead.appendChild(headerRow2);
    table.appendChild(thead);
    
    // Tbody - Filas de datos
    const tbody = document.createElement('tbody');
    datos.value.forEach((item, index) => {
      const row = document.createElement('tr');
      const bgColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      
      const cellData = [
        { value: item.ROLADA, bold: true, borderRight: '2px solid ' + colors.border },
        { value: formatFechaCorta(item.FECHA_URDIDORA), borderRight: '1px solid ' + colors.borderLight },
        { value: formatListaConY(item.MAQ_OE), borderRight: '1px solid ' + colors.borderLight },
        { value: formatListaConY(item.LOTE), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.URDIDORA_M, 0), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.URDIDORA_ROT_TOT, 0), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.URDIDORA_ROT_106, 2), color: '#059669', bold: true, borderRight: '1px solid ' + colors.borderLight },
        { value: formatTiempo(item.URDIDORA_TIEMPO_MIN), borderRight: '2px solid ' + colors.border },
        { value: formatFechaCorta(item.FECHA_INDIGO), borderRight: '1px solid ' + colors.borderLight },
        { value: item.ARTIGO ? item.ARTIGO.substring(0, 10) : '', borderRight: '1px solid ' + colors.borderLight },
        { value: item.COR, borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.METRAGEM, 0), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.RUPTURAS, 0), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.ROT_103, 2), color: '#2563eb', bold: true, borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.CAVALOS, 0), borderRight: '1px solid ' + colors.borderLight },
        { value: formatTiempo(item.TIEMPO_MINUTOS), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.VELOC_PROMEDIO, 1).replace(',0', ''), borderRight: '1px solid ' + colors.borderLight },
        { value: item.N_COUNT, borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.N_PERCENT, 1), borderRight: '1px solid ' + colors.borderLight },
        { value: item.P_COUNT, borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.P_PERCENT, 1), borderRight: '1px solid ' + colors.borderLight },
        { value: item.Q_COUNT, borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.Q_PERCENT, 1), borderRight: '2px solid ' + colors.border },
        { value: formatNumber(item.TECELAGEM_EFICIENCIA, 1), color: '#7c3aed', bold: true, borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.RT105, 2), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.RU105, 2), borderRight: '2px solid ' + colors.border },
        { value: formatNumber(item.METROS_CAL, 0), borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.CAL_PERCENT, 1), color: '#b45309', bold: true, borderRight: '1px solid ' + colors.borderLight },
        { value: formatNumber(item.PTS_100M2, 1), borderRight: 'none' }
      ];
      
      cellData.forEach(cell => {
        const td = document.createElement('td');
        td.style.cssText = `background: ${bgColor}; color: ${cell.color || colors.text}; padding: 6px 4px; text-align: center; vertical-align: middle; border-right: ${cell.borderRight}; border-bottom: 1px solid ${colors.borderLight}; font-size: 10px; ${cell.bold ? 'font-weight: 700;' : 'font-weight: 400;'}`;
        td.textContent = cell.value;
        row.appendChild(td);
      });
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    
    container.appendChild(table);
    document.body.appendChild(container);
    
    // Capturar como canvas
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false
    });
    
    // Limpiar
    document.body.removeChild(container);
    
    // Convertir a blob y copiar al portapapeles
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ]);
        
        Swal.fire({
          icon: 'success',
          title: 'Copiado',
          text: 'Imagen copiada al portapapeles',
          timer: 1000,
          showConfirmButton: false,
          timerProgressBar: true
        });
        
      } catch (clipboardError) {
        console.error('Error al copiar al portapapeles:', clipboardError);
        // Fallback: descargar la imagen
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `ROLADAS_${periodoFormateado.value}.png`;
        link.href = url;
        link.click();
        Swal.fire({ icon: 'info', title: 'Imagen descargada', text: 'No se pudo copiar al portapapeles. La imagen se ha descargado.', timer: 2500, showConfirmButton: false });
      }
    }, 'image/png');
    
  } catch (error) {
    console.error('Error al generar imagen:', error);
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al generar la imagen', timer: 2000, showConfirmButton: false });
  } finally {
    copiando.value = false;
  }
};

const imprimirTabla = () => {
  if (datos.value.length === 0) {
    alert('No hay datos para imprimir');
    return;
  }
  
  window.print();
};

onMounted(() => {
  cargarDatos();
});
</script>

<style scoped>
@media print {
  @page {
    size: landscape;
    margin: 10mm 5mm 10mm 5mm; /* superior, derecho, inferior, izquierdo */
  }
  
  body * {
    visibility: hidden;
  }
  
  .w-full.h-screen,
  .w-full.h-screen * {
    visibility: visible;
  }
  
  .w-full.h-screen {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
  
  /* Ocultar botones y elementos no necesarios */
  button,
  .flex.items-center.gap-2 {
    display: none !important;
  }
  
  /* Asegurar que la tabla ocupe todo el ancho */
  main {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
  }
  
  .overflow-auto {
    overflow: visible !important;
    border: none !important;
  }
  
  table {
    page-break-inside: auto;
  }
  
  tr {
    page-break-inside: avoid;
    page-break-after: auto;
  }
  
  thead {
    display: table-header-group;
  }
  
  /* Mantener estilos de la tabla */
  th, td {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}

table {
  font-size: 11px;
  border-collapse: separate;
  border-spacing: 0;
}

thead th {
  position: sticky;
  top: 0;
  background: rgb(248, 250, 252);
  z-index: 10;
}

tbody tr:hover {
  background-color: rgb(241, 245, 249) !important;
}
</style>
