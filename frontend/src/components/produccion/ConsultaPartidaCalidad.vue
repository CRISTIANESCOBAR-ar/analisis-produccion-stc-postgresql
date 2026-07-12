<template>
  <div class="w-full h-screen flex flex-col bg-slate-50 relative overflow-hidden">
    <!-- Overlay de carga -->
    <div v-if="loading" class="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-[50]">
      <div class="flex flex-col items-center gap-4">
        <div class="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        <p class="text-indigo-900 font-medium animate-pulse">Consultando Partida...</p>
      </div>
    </div>

    <!-- Header Principal -->
    <header class="bg-white border-b border-slate-200 px-6 py-4 shadow-sm z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <div class="bg-indigo-50 p-2 rounded-lg border border-indigo-100">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        </div>
        <div>
          <h1 class="text-xl font-bold text-slate-800">Consulta de Calidad por Partida</h1>
          <p class="text-sm text-slate-500">Detalle de piezas y defectos registrados</p>
        </div>
      </div>

      <!-- Buscador -->
      <div class="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
        <div class="relative group">
          <input 
            v-model="searchQuery" 
            @keyup.enter="handleSearch"
            type="text" 
            placeholder="Ingrese N° Partida..." 
            class="pl-9 pr-3 py-2 w-48 md:w-64 bg-white text-sm font-medium text-slate-700 placeholder-slate-400 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
          />
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <button 
          @click="handleSearch"
          :disabled="!searchQuery.trim() || loading"
          class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-semibold shadow-sm transition-all flex items-center gap-2"
        >
          <span>Buscar</span>
        </button>
      </div>
    </header>

    <!-- Contenido Principal -->
    <main class="flex-1 overflow-hidden p-4 md:p-6 flex flex-col gap-6 max-w-[1920px] mx-auto w-full">
      
      <!-- Mensaje Inicial -->
      <div v-if="!hasSearched" class="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/50">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="text-lg font-semibold text-slate-600">Esperando consulta</h3>
        <p class="text-sm">Ingrese un número de partida arriba para ver los detalles.</p>
      </div>

      <!-- Resultados -->
      <template v-else-if="headerData">
        <!-- Ficha de Encabezado -->
        <section class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden shrink-0">
          <div class="p-3 grid grid-cols-2 md:grid-cols-6 gap-4">
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Artigo</span>
              <span class="text-sm font-bold text-slate-900 break-words">{{ headerData.ARTIGO || '—' }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cor</span>
              <span class="text-sm font-bold text-slate-900 break-words">{{ headerData.COR || '—' }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NM Merc</span>
              <span class="text-sm font-bold text-slate-900 break-words">{{ headerData.NM_MERC || '—' }}</span>
            </div>
            <div class="flex flex-col gap-1">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Trama</span>
              <div class="text-sm font-bold text-slate-900 leading-tight">{{ headerData.TRAMA || '—' }}</div>
            </div>
            <div class="flex flex-col gap-1 md:border-l md:border-slate-100 md:pl-4">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">% Calidad (1ª)</span>
              <span class="text-sm font-bold" :class="getCalidadColor(headerData.Calidad_Perc)">
                {{ headerData.Calidad_Perc !== null && headerData.Calidad_Perc !== undefined ? headerData.Calidad_Perc + '%' : '—' }}
              </span>
            </div>
            <div class="flex flex-col gap-1 md:border-l md:border-slate-100 md:pl-4">
              <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pts/100m²</span>
              <span class="text-sm font-bold" :class="getPtsColor(headerData.Pts_100m2)">
                {{ headerData.Pts_100m2 !== null && headerData.Pts_100m2 !== undefined ? headerData.Pts_100m2 : '—' }}
              </span>
            </div>
          </div>
        </section>

        <!-- Tabla de Resultados -->
        <section class="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col min-h-0">
          <div class="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <h3 class="font-bold text-slate-700 text-sm">Detalle de Piezas</h3>
            <span class="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full text-xs font-bold border border-indigo-200">
              {{ rowsData.length }} piezas
            </span>
          </div>
          
          <div class="flex-1 overflow-auto">
            <table class="w-full text-left border-collapse">
              <thead class="bg-slate-100 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th v-for="col in columns" :key="col.key" class="px-4 py-2.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 whitespace-nowrap">
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="(row, idx) in rowsData" :key="idx" class="hover:bg-indigo-50/50 transition-colors group">
                  <td class="px-4 py-2 text-xs font-mono font-medium text-slate-700 group-hover:text-indigo-700">
                    <div class="relative inline-block w-full group/tooltip cursor-help">
                      <span>{{ row.PEÇA }}</span>
                      
                      <!-- Tooltip de Defectos (Diseño Light Premium alineado con el proyecto) -->
                      <div 
                        v-if="getDefectosPieza(row).length" 
                        class="absolute bottom-full left-0 mb-2 hidden group-hover/tooltip:block bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 z-50 pointer-events-none w-64 overflow-hidden transition-all duration-200"
                      >
                        <!-- Cabecera -->
                        <div class="px-3 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-slate-700">
                          <span class="font-bold text-[10px] tracking-wide uppercase text-slate-400">Defectos de la Pieza</span>
                          <span class="text-[10px] font-extrabold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                            {{ getDefectosPieza(row).length }}
                          </span>
                        </div>
                        
                        <!-- Lista -->
                        <div class="p-3 max-h-40 overflow-y-auto">
                          <ul class="space-y-2">
                            <li 
                              v-for="(def, idx) in getDefectosPieza(row)" 
                              :key="idx" 
                              class="flex justify-between items-start gap-2.5 text-[11px] border-b border-slate-100/50 pb-1.5 last:border-0 last:pb-0"
                            >
                              <span class="text-slate-600 font-medium text-left leading-normal">
                                <strong class="text-slate-800 font-semibold">{{ def.cod_def }}</strong> · {{ def.desc_defeito }}
                              </span>
                              <span class="font-bold text-amber-700 shrink-0 font-mono text-[10px] bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                                {{ def.pontos }} pts
                              </span>
                            </li>
                          </ul>
                        </div>
                        
                        <!-- Flecha indicadora apuntando hacia abajo -->
                        <div class="absolute bottom-[-5px] left-6 w-2.5 h-2.5 bg-white rotate-45 border-r border-b border-slate-200"></div>
                      </div>
                    </div>
                  </td>
                  <td class="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{{ formatDate(row.DAT_PROD) }}</td>
                  <td class="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                    <span :class="{'bg-green-100 text-green-700': row.GRP_DEF === 'S/ Def.', 'bg-red-100 text-red-700': row.GRP_DEF !== 'S/ Def.'}" class="px-1.5 py-0.5 rounded font-semibold text-[10px]">
                      {{ row.GRP_DEF }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-xs text-slate-500 text-center">{{ row.COD_DE }}</td>
                  <td class="px-4 py-2 text-xs font-medium text-slate-700">{{ row.DEFEITO }}</td>
                  <td class="px-4 py-2 text-xs text-slate-600 text-right font-mono">{{ row.METRAGEM }}</td>
                  <td class="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                     <span class="inline-flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full" :class="row.QUALIDADE?.includes('PRIMEIRA') ? 'bg-emerald-500' : 'bg-amber-500'"></span>
                        {{ row.QUALIDADE }}
                     </span>
                  </td>
                  <td class="px-4 py-2 text-xs text-slate-600">{{ row["REVISOR FINAL"] }}</td>
                  <td class="px-4 py-2 text-xs text-slate-500 whitespace-nowrap">{{ formatTime(row.HORA) }}</td>
                  <td class="px-4 py-2 text-xs font-bold text-slate-700">{{ row.PARTIDA }}</td>
                  <td class="px-4 py-2 text-xs text-center font-bold" :class="row.EMENDAS === 'S' ? 'text-red-600' : 'text-slate-400'">
                    {{ row.EMENDAS }}
                  </td>
                  <td class="px-4 py-2 text-xs font-mono text-slate-500">{{ row.ETIQUETA }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div v-if="rowsData.length === 0" class="p-8 text-center text-slate-400 bg-slate-50/50">
            No se encontraron piezas para esta partida.
          </div>
        </section>
      </template>

      <!-- Mensaje No Encontrado -->
      <div v-else-if="hasSearched" class="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-red-200 rounded-xl bg-red-50/10">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4 text-red-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="text-lg font-semibold text-red-600">Partida no encontrada</h3>
        <p class="text-sm">No se encontraron registros para la partida "{{ searchQuery }}"</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const searchQuery = ref('');
const loading = ref(false);
const hasSearched = ref(false);
const headerData = ref(null);
const rowsData = ref([]);
const defectosData = ref([]);

const columns = [
  { key: 'PEÇA', label: 'Peça' },
  { key: 'DAT_PROD', label: 'Dat_Prod' },
  { key: 'GRP_DEF', label: 'Grp_Def' },
  { key: 'COD_DE', label: 'Cod_De' },
  { key: 'DEFEITO', label: 'Defeito' },
  { key: 'METRAGEM', label: 'Metragem' },
  { key: 'QUALIDADE', label: 'Qualidade' },
  { key: 'REVISOR FINAL', label: 'Revisor Final' },
  { key: 'HORA', label: 'Hora' },
  { key: 'PARTIDA', label: 'Partida' },
  { key: 'EMENDAS', label: 'Emendas' },
  { key: 'ETIQUETA', label: 'Etiqueta' },
];

const handleSearch = async () => {
  if (!searchQuery.value.trim()) return;
  
  loading.value = true;
  hasSearched.value = true;
  headerData.value = null;
  rowsData.value = [];
  defectosData.value = [];

  try {
    // Quita ceros a la izquierda
    const cleanedQuery = searchQuery.value.trim().replace(/^0+/, '');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/calidad/partida/${encodeURIComponent(cleanedQuery)}`;
    
    console.log('Fetching:', url);
    const response = await fetch(url);
    
    if (!response.ok) {
       throw new Error('Error en la API');
    }
    
    const data = await response.json();
    
    if (data.header) {
      headerData.value = data.header;
      rowsData.value = data.rows || [];
      defectosData.value = data.defectos || [];
    } else {
      // No encontrado
      headerData.value = null;
      defectosData.value = [];
    }
  } catch (error) {
    console.error(error);
    alert('Error al consultar la partida. Ver consola.');
  } finally {
    loading.value = false;
  }
};

const formatDate = (val) => {
  if (!val) return '';
  // Intenta parsear fechas ISO o locales
  try {
     const d = new Date(val);
     if (isNaN(d.getTime())) return val; // No es fecha válida, devuelve original
     // Si viene como string '02/02/26', devolver tal cual
     if (typeof val === 'string' && val.includes('/')) return val;
     return d.toLocaleDateString();
  } catch {
    return val;
  }
};

const formatTime = (val) => {
   if (!val) return '';
   // Si es un número entero (ej 1116), formatear a 11:16
   if (!isNaN(val) && String(val).length === 4) {
      const s = String(val);
      return `${s.substring(0,2)}:${s.substring(2)}`;
   }
   return val;
};

const getCalidadColor = (val) => {
  if (val === null || val === undefined) return 'text-slate-900';
  const num = parseFloat(val);
  if (isNaN(num)) return 'text-slate-900';
  if (num >= 90) return 'text-emerald-600';
  if (num >= 80) return 'text-amber-600';
  return 'text-rose-600';
};

const getPtsColor = (val) => {
  if (val === null || val === undefined) return 'text-slate-900';
  const num = parseFloat(val);
  if (isNaN(num)) return 'text-slate-900';
  if (num < 20) return 'text-emerald-600';
  if (num < 40) return 'text-amber-600';
  return 'text-rose-600';
};

// Agrupación reactiva de defectos por pieza/etiqueta
const defectosPorPieza = computed(() => {
  const map = {};
  defectosData.value.forEach(d => {
    const piezaKey = d.peça ? String(d.peça).trim().replace(/^0+/, '') : '';
    const etiquetaKey = d.etiqueta ? String(d.etiqueta).trim() : '';

    if (piezaKey) {
      if (!map[piezaKey]) map[piezaKey] = [];
      map[piezaKey].push(d);
    }
    if (etiquetaKey) {
      if (!map[etiquetaKey]) map[etiquetaKey] = [];
      if (!piezaKey || !map[etiquetaKey].some(item => item.cod_def === d.cod_def && item.peça === d.peça)) {
        map[etiquetaKey].push(d);
      }
    }
  });
  return map;
});

const getDefectosPieza = (row) => {
  if (!row) return [];
  
  // 1. Intentar buscar por etiqueta (label) - Es el más unívoco
  const etiquetaKey = row.ETIQUETA ? String(row.ETIQUETA).trim() : '';
  if (etiquetaKey && defectosPorPieza.value[etiquetaKey]) {
    return defectosPorPieza.value[etiquetaKey];
  }
  
  // 2. Intentar buscar por el número corto de pieza (los últimos 3 dígitos de row.PEÇA)
  if (row.PEÇA) {
    const fullPecaStr = String(row.PEÇA).trim();
    const shortPeca = fullPecaStr.length >= 3 ? fullPecaStr.substring(fullPecaStr.length - 3) : fullPecaStr;
    const key = shortPeca.replace(/^0+/, '');
    if (key && defectosPorPieza.value[key]) {
      return defectosPorPieza.value[key];
    }
  }
  
  return [];
};
</script>