<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <h1 class="text-2xl font-bold mb-6 text-gray-800">Gestión de Inventario (Materia Prima)</h1>

    <!-- Controles Superiores: Filtros y Configuración Unificada -->
    <div class="bg-white p-4 rounded-lg shadow mb-6">
      
      <!-- Única Fila de Controles -->
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        <!-- Bloque Izquierda: Versión y Búsqueda -->
        <div class="flex flex-col md:flex-row md:items-center gap-4 flex-1">
          <!-- Versión Activa Badge -->
          <div v-if="activeVersionName" class="shrink-0">
            <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 shadow-sm">
              <svg class="w-3.5 h-3.5 mr-1.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Versión Activa: {{ activeVersionName }}
            </span>
          </div>

          <!-- Buscador -->
          <div class="flex items-center space-x-3 flex-1 max-w-2xl">
            <label class="hidden lg:block text-sm font-semibold text-gray-700 whitespace-nowrap">
              Buscar:
            </label>
            <div class="relative flex-1">
              <input 
                v-model="filters.searchText" 
                type="text" 
                placeholder="Productor, Lote, Destino..." 
                class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 pr-10 border"
              />
              <button 
                v-if="filters.searchText"
                @click="filters.searchText = ''"
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Selector de Fardos -->
          <div class="flex items-center space-x-2 shrink-0">
            <label class="text-sm font-semibold text-gray-700 whitespace-nowrap">Fardos:</label>
            <input 
              v-model.number="filters.fardos" 
              type="number" 
              min="1"
              max="99"
              class="w-12 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 border text-center"
              placeholder="0"
            />
          </div>
        </div>

        <!-- Bloque Derecha: Botones de Configuración -->
        <div class="flex items-center space-x-6 shrink-0 border-t pt-4 xl:border-t-0 xl:pt-0">
          <!-- Botón de Supervisión -->
          <button 
            @click="showRuleSelector = !showRuleSelector"
            class="flex items-center space-x-2 text-indigo-600 text-sm font-semibold hover:text-indigo-800 transition-colors focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>Reglas de Mezclas</span>
          </button>

          <!-- Botón de Columnas -->
          <button 
            @click="showColumnSelector = !showColumnSelector"
            class="flex items-center space-x-2 text-blue-600 text-sm font-semibold hover:text-blue-800 transition-colors focus:outline-none"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>Ver Columnas</span>
          </button>

          <!-- Botón Mezclas -->
          <button 
            @click="handleMezclas"
            class="flex items-center space-x-2 text-green-600 text-sm font-bold hover:text-green-800 transition-colors focus:outline-none bg-green-50 px-3 py-1.5 rounded-md border border-green-200 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span>Mezclas</span>
          </button>
        </div>
      </div>

      <!-- Expandible: Supervisión -->
      <div v-if="showRuleSelector" class="mt-4 bg-gray-50 p-3 rounded border">
        <p class="text-xs text-gray-500 mb-2 italic">Selecciona los parámetros que deseas visualizar en la tabla.</p>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div 
            v-for="param in monitoredParams" 
            :key="param.key" 
            class="bg-white p-2 rounded shadow-sm border border-gray-200"
          >
            <!-- (Contenido de supervisión sigue igual...) -->
            <div class="font-bold text-gray-700 text-sm mb-1 border-b pb-1 flex justify-between items-center">
              <div class="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  :checked="isAllSelected(param.key)" 
                  @change="toggleAll(param.key, $event.target.checked)"
                  class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>{{ param.label }}</span>
              </div>
              <span v-if="getRuleFor(param.key)" class="text-[10px] bg-green-100 text-green-800 px-1 rounded flex items-center" title="Regla encontrada">
                 ✓
              </span>
              <span v-else class="text-[10px] bg-gray-100 text-gray-400 px-1 rounded" title="Sin regla definida">
                 -
              </span>
            </div>
            <div class="space-y-1">
              <label class="flex items-center justify-between space-x-2 text-xs cursor-pointer group">
                <div class="flex items-center">
                  <input type="checkbox" v-model="supervisionSettings[param.key].target" class="text-green-600 rounded focus:ring-green-500">
                  <span class="text-gray-600 ml-2">Promedio Objetivo 
                    <span class="w-2 h-2 rounded-full bg-green-200 inline-block ml-1 border border-green-300"></span>
                  </span>
                </div>
                <span v-if="getRuleFor(param.key)" class="text-gray-400 font-mono text-[10px]">
                  {{ getRuleDisplay(getRuleFor(param.key), 'target') }}
                </span>
              </label>
              
              <label class="flex items-center justify-between space-x-2 text-xs cursor-pointer group">
                <div class="flex items-center">
                  <input type="checkbox" v-model="supervisionSettings[param.key].hardCap" class="text-red-600 rounded focus:ring-red-500">
                  <span class="text-gray-600 ml-2">Límites Absolutos
                    <span class="w-2 h-2 rounded-full bg-red-200 inline-block ml-1 border border-red-300"></span>
                  </span>
                </div>
                <span v-if="getRuleFor(param.key)" class="text-gray-400 font-mono text-[10px]">
                  {{ getRuleDisplay(getRuleFor(param.key), 'hardCap') }}
                </span>
              </label>
              
              <label class="flex items-center justify-between space-x-2 text-xs cursor-pointer group">
                <div class="flex items-center">
                  <input type="checkbox" v-model="supervisionSettings[param.key].tolerance" class="text-yellow-500 rounded focus:ring-yellow-400">
                  <span class="text-gray-600 ml-2">Rango Tolerancia
                    <span class="w-2 h-2 rounded-full bg-yellow-100 inline-block ml-1 border border-yellow-300"></span>
                  </span>
                </div>
                <span v-if="getRuleFor(param.key)" class="text-gray-400 font-mono text-[10px]">
                  {{ getRuleDisplay(getRuleFor(param.key), 'tolerance') }}
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- Expandible: Columnas -->
      <div v-if="showColumnSelector" class="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2 bg-gray-50 p-3 rounded border">
        <label 
          v-for="col in allColumns" 
          :key="col.key" 
          class="flex items-center space-x-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-100 p-1 rounded"
          :class="{'opacity-75 cursor-not-allowed': col.locked}"
        >
          <input 
            type="checkbox" 
            :value="col.key"
            :checked="isColumnVisible(col.key)"
            :disabled="col.locked"
            @change="toggleColumn(col.key)"
            class="rounded text-blue-600 focus:ring-blue-500"
          />
          <span :class="{'font-bold': col.locked}">{{ col.label }}</span>
        </label>
      </div>
    </div>

    <!-- Tabla de Datos o Plan de Mezclas -->
    <div class="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
      
      <!-- Vista: Plan de Mezclas -->
      <div v-if="isBlendMode" class="p-4">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-bold text-gray-800">Plan de Mezclas Generado</h2>
          <button 
            @click="isBlendMode = false"
            class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold text-sm transition-colors"
          >
            Volver al Inventario
          </button>
        </div>

        <div v-if="isCalculatingBlend" class="text-center py-8 text-blue-600 font-bold">
          Calculando optimización...
        </div>

        <div v-else-if="blendPlan">
          <!-- Tabla del Plan -->
          <div class="overflow-x-auto mb-8 border rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Productor</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lote</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">MIC</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">STR</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LEN</th>
                  <th v-for="col in blendPlan.columnasMezcla" :key="col" class="px-4 py-3 text-center text-xs font-bold text-indigo-600 uppercase tracking-wider border-l border-gray-300 bg-indigo-50">
                    {{ col }}
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(row, index) in blendPlan.plan" :key="index" class="hover:bg-gray-50">
                  <td class="px-4 py-2 text-sm text-gray-900 font-medium">{{ row.PRODUTOR }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ row.LOTE }}</td>
                  <td class="px-4 py-2 text-sm">
                    <span :class="row.Estado === 'USO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'" class="px-2 py-1 rounded text-xs font-bold">
                      {{ row.Estado }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ formatValue(row.MIC, 'MIC') }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ formatValue(row.STR, 'STR') }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ formatValue(row.LEN, 'UHML') }}</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="col" class="px-4 py-2 text-sm text-center font-bold border-l border-gray-200" :class="row.mezclas[col] ? 'text-indigo-600 bg-indigo-50/30' : 'text-gray-300'">
                    {{ row.mezclas[col] || '-' }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-gray-50 border-t-2 border-gray-300">
                <!-- Fila: Total Fardos -->
                <tr>
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">TOTAL FARDOS</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'fardos-'+col" class="px-4 py-2 text-sm text-center font-bold text-gray-900 border-l border-gray-300">
                    {{ blendPlan.estadisticas[col].totalFardos }}
                  </td>
                </tr>
                <!-- Fila: Peso Total Bloque -->
                <tr>
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">Peso Total Bloque</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'peso-'+col" class="px-4 py-2 text-sm text-center font-bold text-gray-900 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].pesoTotal, 'PESO') }}
                  </td>
                </tr>
                <!-- Fila: PESO PROM (KG) -->
                <tr>
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">PESO PROM (KG)</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'pesoprom-'+col" class="px-4 py-2 text-sm text-center font-bold text-gray-900 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].pesoPromedio, 'PESO') }}
                  </td>
                </tr>

                <!-- MIC -->
                <tr>
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">PROM MIC</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-'+col" class="px-4 py-2 text-sm text-center font-bold text-blue-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.MIC?.promedioGeneral, 'MIC') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.MIC?.pctIdeal !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">MIC 90% Promedio</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-ideal-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.MIC?.promedioIdeal, 'MIC') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.MIC?.pctTolerancia !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">MIC Promedio 10%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-tol-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.MIC?.promedioTolerancia, 'MIC') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.MIC?.pctIdeal !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">MIC Porcentual 90%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-pct-ideal-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ blendPlan.estadisticas[col].variables.MIC?.pctIdeal.toFixed(1) }}%
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.MIC?.pctTolerancia !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">MIC Porcentual 10%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-pct-tol-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ blendPlan.estadisticas[col].variables.MIC?.pctTolerancia.toFixed(1) }}%
                  </td>
                </tr>

                <!-- STR -->
                <tr>
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">PROM STR</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-'+col" class="px-4 py-2 text-sm text-center font-bold text-blue-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.STR?.promedioGeneral, 'STR') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.STR?.pctIdeal !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">STR 80% Promedio</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-ideal-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.STR?.promedioIdeal, 'STR') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.STR?.pctTolerancia !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">STR Promedio 20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-tol-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.STR?.promedioTolerancia, 'STR') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.STR?.pctIdeal !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">STR Porcentual 80%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-pct-ideal-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ blendPlan.estadisticas[col].variables.STR?.pctIdeal.toFixed(1) }}%
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.STR?.pctTolerancia !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">STR Porcentual 20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-pct-tol-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ blendPlan.estadisticas[col].variables.STR?.pctTolerancia.toFixed(1) }}%
                  </td>
                </tr>

                <!-- LEN -->
                <tr>
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">PROM LEN</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-'+col" class="px-4 py-2 text-sm text-center font-bold text-blue-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.LEN?.promedioGeneral, 'UHML') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.LEN?.pctIdeal !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">LEN 80% Promedio</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-ideal-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.LEN?.promedioIdeal, 'UHML') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.LEN?.pctTolerancia !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">LEN Promedio 20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-tol-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ formatValue(blendPlan.estadisticas[col].variables.LEN?.promedioTolerancia, 'UHML') }}
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.LEN?.pctIdeal !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">LEN Porcentual 80%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-pct-ideal-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ blendPlan.estadisticas[col].variables.LEN?.pctIdeal.toFixed(1) }}%
                  </td>
                </tr>
                <tr v-if="blendPlan.estadisticas[blendPlan.columnasMezcla[0]]?.variables.LEN?.pctTolerancia !== undefined">
                  <td colspan="6" class="px-4 py-2 text-sm font-bold text-right text-gray-700">LEN Porcentual 20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-pct-tol-'+col" class="px-4 py-2 text-sm text-center text-gray-600 border-l border-gray-300">
                    {{ blendPlan.estadisticas[col].variables.LEN?.pctTolerancia.toFixed(1) }}%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Tabla de Remanentes / No Usados -->
          <h3 class="text-lg font-bold text-gray-800 mb-3 mt-8 border-t pt-6">Lotes No Usados / Remanentes</h3>
          <div class="overflow-x-auto border rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-red-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Productor</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Lote</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Fardos</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">MIC</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">STR</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">LEN</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Motivo Logístico</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="blendPlan.remanentes.length === 0">
                  <td colspan="7" class="px-4 py-4 text-center text-gray-500 italic">No hay lotes remanentes. Se usó todo el stock.</td>
                </tr>
                <tr v-else v-for="(row, index) in blendPlan.remanentes" :key="index" class="hover:bg-red-50/50">
                  <td class="px-4 py-2 text-sm text-gray-900 font-medium">{{ row.PRODUTOR }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ row.LOTE }}</td>
                  <td class="px-4 py-2 text-sm font-bold text-gray-800">{{ row.Fardos }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ formatValue(row.MIC, 'MIC') }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ formatValue(row.STR, 'STR') }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ formatValue(row.LEN, 'UHML') }}</td>
                  <td class="px-4 py-2 text-sm text-red-600 font-medium">{{ row.Motivo }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Vista: Inventario Normal -->
      <table v-else class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-100">
          <tr>
            <th 
              v-for="col in visibleColumns" 
              :key="col.key"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="loading">
             <td :colspan="visibleColumns.length" class="px-6 py-4 text-center text-blue-500 font-medium">
                Cargando inventario...
             </td>
          </tr>
          <tr v-else-if="filteredData.length === 0">
            <td :colspan="visibleColumns.length" class="px-6 py-4 text-center text-gray-500 italic">
              No se encontraron resultados ({{ items.length > 0 ? 'ajusta los filtros' : 'Base de datos vacía o sin conexión' }}).
            </td>
          </tr>
          <tr v-else v-for="(item, index) in filteredData" :key="index" class="hover:bg-gray-50 transition-colors">
            <td 
              v-for="col in visibleColumns" 
              :key="col.key"
              class="px-4 py-2 text-sm text-gray-700 whitespace-nowrap"
              :class="getCellClass(item, col.key)"
            >
              {{ formatValue(item[col.key], col.key) }}
            </td>
          </tr>
        </tbody>
        <tfoot v-if="summaryRow" class="bg-gray-100 font-bold border-t-2 border-gray-300">
          <tr>
            <td 
              v-for="col in visibleColumns" 
              :key="'sum-' + col.key"
              class="px-4 py-3 text-sm text-gray-800 whitespace-nowrap"
            >
              <!-- Lógica de visualización para cada columna en el footer -->
              <span v-if="col.key === 'PRODUTOR'">Totales / Promedios</span>
              <span v-else-if="col.key === 'PESO' || col.key === 'QTDE_ESTOQUE'">
                {{ formatValue(summaryRow[col.key], col.key) }}
              </span>
              <span v-else-if="summaryRow[col.key] !== undefined">
                {{ formatValue(summaryRow[col.key], col.key) }}
              </span>
              <span v-else>-</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    
    <div class="mt-4 text-sm text-gray-500 text-right">
      Mostrando {{ filteredData.length }} registros
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue';
import { CottonBale } from '../../models/CottonBale';

// --- Configuración de Columnas ---
const allColumns = [
  { key: 'PRODUTOR', label: 'Productor', locked: true, default: true },
  { key: 'LOTE', label: 'Lote', locked: true, default: true },
  { key: 'DESTINO', label: 'Destino', default: true },
  { key: 'TP', label: 'Tipo', default: false },
  { key: 'CLASSIF', label: 'Clasif.', default: true },
  { key: 'COR', label: 'Color', default: true },
  { key: 'QTDE_ESTOQUE', label: 'Stock', default: true },
  { key: 'SCI', label: 'SCI', default: false },
  { key: 'MST', label: 'MST', default: false },
  { key: 'MIC', label: 'MIC', default: true },   // Decimal
  { key: 'MAT', label: 'MAT', default: false },
  { key: 'UHML', label: 'UHML (Len)', default: true }, // Decimal
  { key: 'UI', label: 'UI', default: false },
  { key: 'SF', label: 'SF', default: false },
  { key: 'STR', label: 'STR', default: true },   // Decimal
  { key: 'ELG', label: 'ELG', default: false },
  { key: 'RD', label: 'RD', default: false },
  { key: 'PLUS_B', label: '+b', default: false },
  { key: 'TIPO', label: 'Tipo Material', default: false },
  { key: 'TrCNT', label: 'TrCNT', default: false },
  { key: 'TrAR', label: 'TrAR', default: false },
  { key: 'TRID', label: 'TRID', default: false },
  { key: 'PESO', label: 'Peso', default: true },
  { key: 'PESO_MEDIO', label: 'Peso Medio', default: false },
  { key: 'CORTEZA', label: 'Corteza', default: false },
];

// Estado de visibilidad de columnas (Set para búsqueda rápida)
// Inicializamos con las columnas por defecto y las bloqueadas
const selectedColumnKeys = ref(new Set(
  allColumns.filter(c => c.default || c.locked).map(c => c.key)
));

const showColumnSelector = ref(false);
const showRuleSelector = ref(false);

const activeVersionName = ref('');
const activeRules = ref([]);

const isBlendMode = ref(false);
const blendPlan = ref(null);
const isCalculatingBlend = ref(false);

// Params to supervise
const monitoredParams = [
  { key: 'MIC', label: 'MIC' },
  { key: 'UHML', label: 'LEN (UHML)' },
  { key: 'STR', label: 'STR' },
  { key: 'ELG', label: 'ELG' },
  { key: 'RD', label: 'RD' },
  { key: 'PLUS_B', label: '+b' },
  { key: 'SCI', label: 'SCI' }
];

const items = ref([]);

const filters = reactive({
  searchText: '',
  fardos: null
});

// Reactive Supervision State: For every param, user toggles what to see
// Example: { MIC: { target: false, hardCap: false, tolerance: false }, ... }
const supervisionSettings = reactive(
  monitoredParams.reduce((acc, p) => {
    acc[p.key] = { target: false, hardCap: false, tolerance: false };
    return acc;
  }, {})
);

// --- Métodos de Lógica ---
const loading = ref(false);

const fetchStandards = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/config/standards');
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        activeVersionName.value = data.version_actual;
        activeRules.value = data.tolerancias || [];
      }
    }
  } catch (e) {
    console.error('Error loading standards', e);
  }
};

// Checkbox global para cada variable
const isAllSelected = (key) => {
  const s = supervisionSettings[key];
  return s.target && s.hardCap && s.tolerance;
};

const toggleAll = (key, checked) => {
  supervisionSettings[key].target = checked;
  supervisionSettings[key].hardCap = checked;
  supervisionSettings[key].tolerance = checked;
};

const getRuleFor = (colKey) => {
  let ruleKey = colKey;
  if (colKey === 'UHML') ruleKey = 'LEN';
  if (colKey === 'PLUS_B') ruleKey = '+b';
  return activeRules.value.find(r => r.parametro === ruleKey);
};

const getRuleDisplay = (rule, type) => {
  if (!rule) return '';

  const format = (v) => (v !== null && v !== undefined && v !== '') ? Number(v) : null;

  if (type === 'hardCap') {
    const min = format(rule.limite_min_absoluto);
    const max = format(rule.limite_max_absoluto);
    if (min !== null && max !== null) return `${min}-${max}`;
    if (min !== null) return `>= ${min}`;
    if (max !== null) return `<= ${max}`;
  }

  if (type === 'target') {
    // "valor_ideal_min" usually for STR/LEN (High is better)
    // "promedio_objetivo_max" for +b (Low is better)
    // For ranges like MIC, ideally we'd have both.
    const min = format(rule.valor_ideal_min);
    const max = format(rule.promedio_objetivo_max);
    
    // Simple heuristic: if both exist, show range
    if (min !== null && max !== null) return `${min}-${max}`;
    // If only min (e.g. STR > 28)
    if (min !== null) return `>= ${min}`;
    // If only max (e.g. +b < 10)
    if (max !== null) return `<= ${max}`;
  }

  if (type === 'tolerance') {
    const min = format(rule.rango_tol_min);
    const max = format(rule.rango_tol_max);
    if (min !== null && max !== null) return `${min}-${max}`;
  }

  return '';
};

const getCellClass = (item, colKey) => {
  // Map column key (e.g., 'UHML' in DB/Model) to rule parameter (e.g., 'LEN' in Config Standard)
  let ruleKey = colKey;
  if (colKey === 'UHML') ruleKey = 'LEN';
  if (colKey === 'PLUS_B') ruleKey = '+b';

  // Find settings for this column (using either UI key or mapped rule key)
  // We used 'ruleKey' for monitoredParams in UI? No, UI uses model keys (UHML).
  // monitoredParams array uses keys: MIC, UHML, STR...
  // So supervisionSettings is keyed by UHML, MIC, etc.
  const settings = supervisionSettings[colKey];
  
  // If not a monitored column or no settings, return empty
  if (!settings) return '';
  const isActive = settings.hardCap || settings.target || settings.tolerance;
  if (!isActive) return '';

  // Find the rule from the active standard
  // The activeRules array comes from backend, using parameter names: MIC, LEN, STR, ELG, etc.
  const rule = activeRules.value.find(r => r.parametro === ruleKey);
  if (!rule) return ''; 

  const val = Number(item[colKey]);
  if (typeof val !== 'number' || isNaN(val)) return '';

  // --- 1. PRIORITY: HARD CAPS (RED) ---
  // If user wants to see hard caps violations
  if (settings.hardCap) {
    const absMax = parseFloat(rule.limite_max_absoluto);
    const absMin = parseFloat(rule.limite_min_absoluto);
    
    // Check Upper Bound
    if (!isNaN(absMax) && val > absMax) {
      return 'bg-red-100 text-red-800 font-bold ring-1 ring-inset ring-red-300';
    }
    // Check Lower Bound
    if (!isNaN(absMin) && val < absMin) {
      return 'bg-red-100 text-red-800 font-bold ring-1 ring-inset ring-red-300';
    }
  }

  // --- 2. PRIORITY: TARGET AVERAGE (GREEN) ---
  // "Supera la media deseada" (Meets or Exceeds Target)
  if (settings.target) {
     const idealMin = parseFloat(rule.valor_ideal_min);        // e.g. 28.5 (STR)
     const targetMax = parseFloat(rule.promedio_objetivo_max); // e.g. 10.5 (+b)

     // Logic for Lower-Is-Better metrics (+b, Neps, Trash) vs Higher-Is-Better (STR, LEN, UI)
     // Usually +b is the main "Lower is better" one here.
     // Also MIC is "Middle is better", often defined as Ideal Min - Max range? 
     // Standard DB has 'valor_ideal_min' (Target Min).
     
     let isTargetMet = false;

     if (ruleKey === '+b') {
        // Lower is better
        if (!isNaN(targetMax) && val <= targetMax) isTargetMet = true;
        // Fallback if only ideal min defined? Unlikely for +b.
     } else if (ruleKey === 'MIC') {
        // MIC usually has a range. If value is within ideal range?
        // Standard DB has 'valor_ideal_min' (e.g. 3.8) and maybe implied max?
        // Let's stick to user request "Supera media deseada". For MIC, maybe just >= Min?
        // Or if it's "Center". Let's assume >= Ideal Min for now as "Target".
        if (!isNaN(idealMin) && val >= idealMin) isTargetMet = true;
        // Note: For MIC, "supera" might mean "is better than", which is within range.
        // But let's keep it simple: val >= idealMin triggers green.
     } else {
        // Higher is better (STR, LEN, UI, SCI)
        if (!isNaN(idealMin) && val >= idealMin) isTargetMet = true;
     }

     if (isTargetMet) {
       return 'bg-green-100 text-green-800 font-medium ring-1 ring-inset ring-green-300';
     }
  }

  // --- 3. PRIORITY: TOLERANCE RANGE (YELLOW) ---
  // "Entra en cupo de dispersión"
  if (settings.tolerance) {
     const tolMin = parseFloat(rule.rango_tol_min);
     const tolMax = parseFloat(rule.rango_tol_max);

     if (!isNaN(tolMin) && !isNaN(tolMax)) {
       // Check inclusive range
       if (val >= tolMin && val <= tolMax) {
         return 'bg-yellow-50 text-yellow-700 font-medium ring-1 ring-inset ring-yellow-300';
       }
     }
  }

  return '';
};

const fetchData = async () => {
  loading.value = true;
  try {
    const response = await fetch('http://localhost:3001/api/inventory/cotton-bales');
    if (!response.ok) throw new Error('Error al cargar datos');
    const data = await response.json();
    
    // Mapear respuesta raw a modelo CottonBale
    // El modelo ya maneja las variantes de nombres de columnas y parseo de números locales
    items.value = data.map(row => new CottonBale(row));

  } catch (error) {
    console.error(error);
    alert('No se pudieron cargar los datos del inventario. Verifica que el servidor esté corriendo.');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  fetchStandards().then(() => {
    fetchData(); 
  });
});


// Gestión de columnas
const isColumnVisible = (key) => selectedColumnKeys.value.has(key);

const toggleColumn = (key) => {
  const col = allColumns.find(c => c.key === key);
  if (col && col.locked) return; // No permitir cambios en columnas bloqueadas

  if (selectedColumnKeys.value.has(key)) {
    selectedColumnKeys.value.delete(key);
  } else {
    selectedColumnKeys.value.add(key);
  }
  // Forzar reactividad del Set crea una nueva referencia si es necesario, 
  // pero Vue 3 reactive Sets funcionan bien. Sin embargo, para computed, a veces ayuda reasignar.
  selectedColumnKeys.value = new Set(selectedColumnKeys.value);
};

// Computed: Columnas activas para iterar en el template
const visibleColumns = computed(() => {
  return allColumns.filter(col => selectedColumnKeys.value.has(col.key));
});

// Computed: Datos Filtrados
const filteredData = computed(() => {
  return items.value.filter(item => {
    // Filtro Texto (Produtor, Lote, Destino)
    const searchLower = filters.searchText.toLowerCase();
    return !filters.searchText || 
      item.PRODUTOR.toLowerCase().includes(searchLower) ||
      item.LOTE.toLowerCase().includes(searchLower) ||
      item.DESTINO.toLowerCase().includes(searchLower);
  });
});

// Computed: Fila de Resumen (Promedios Ponderados y Totales)
const summaryRow = computed(() => {
  const data = filteredData.value;
  if (!data || data.length === 0) return null;

  // Calculos de totales
  const totalWeight = data.reduce((sum, item) => sum + (Number(item.PESO) || 0), 0);
  const totalStock = data.reduce((sum, item) => sum + (Number(item.QTDE_ESTOQUE) || 0), 0);
  const count = data.length;

  const weightedFields = ['MIC', 'STR', 'UHML', 'SCI', 'MST', 'MAT', 'UI', 'SF', 'ELG', 'RD', 'PLUS_B', 'TrCNT', 'TrAR', 'TRID', 'PESO_MEDIO', 'CORTEZA'];
  
  const weightedSums = {};
  weightedFields.forEach(field => weightedSums[field] = 0);
  
  // Acumular valores ponderados
  data.forEach(item => {
    // Si PESO > 0 usarlo, sino 0
    const weight = (Number(item.PESO) > 0) ? Number(item.PESO) : 0; 
    
    weightedFields.forEach(field => {
       const val = Number(item[field]) || 0;
       weightedSums[field] += (val * weight);
    });
  });

  const averages = {};
  weightedFields.forEach(field => {
    // Dividir por peso total si es > 0
    if (totalWeight > 0) {
      averages[field] = weightedSums[field] / totalWeight;
    } else {
       // Fallback a promedio simple si no hay pesos
       const simpleSum = data.reduce((s, i) => s + (Number(i[field]) || 0), 0);
       averages[field] = count > 0 ? simpleSum / count : 0;
    }
  });

  return {
    PRODUTOR: 'TOTALES / PROMEDIOS', 
    QTDE_ESTOQUE: totalStock,
    PESO: totalWeight,
    ...averages // incluye PESO_MEDIO ponderado, que matematicamente es igual al total/count si todos los pesos son reales.
  };
});

const formatValue = (value, key) => {
  if (value === null || value === undefined) return '-';
  // Normalizar a número cuando sea posible
  const num = Number(value);
  if (!isNaN(num)) {
    // Formateo específico para PESO: separador de miles y sin decimales (#.##0)
    if (key === 'PESO') {
      // Forzar entero y formateo con punto como separador de miles
      const intVal = Math.round(num);
      return intVal.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    // Campos que requieren 2 decimales
    const decimalFields = ['MIC', 'STR', 'UHML', 'SCI', 'MST'];
    if (decimalFields.includes(key)) return num.toFixed(2);

    // Valores numéricos por defecto: devolver tal cual (sin cambios adicionales)
    return num;
  }

  // Si no es un número, devolver el valor original
  return value;
};

// Acción para el botón Mezclas
const handleMezclas = async () => {
  if (!filters.fardos || filters.fardos <= 0) {
    alert('Por favor, especifica la cantidad de fardos para la mezcla.');
    return;
  }

  // Obtener las variables seleccionadas en la configuración de supervisión
  const selectedVariables = Object.keys(supervisionSettings).filter(key => {
    const s = supervisionSettings[key];
    return s.target || s.hardCap || s.tolerance;
  });

  if (selectedVariables.length === 0) {
    alert('Por favor, selecciona al menos una variable en "Reglas de Mezclas" para optimizar.');
    return;
  }

  isCalculatingBlend.value = true;
  try {
    const response = await fetch('http://localhost:3001/api/inventory/blendomat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stock: filteredData.value, // Enviar solo el stock filtrado (ej. por búsqueda)
        rules: activeRules.value,
        supervisionSettings: supervisionSettings,
        blendSize: filters.fardos
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Error al calcular mezclas');
    }

    const data = await response.json();
    if (data.success) {
      blendPlan.value = data;
      isBlendMode.value = true;
    } else {
      throw new Error('El cálculo no fue exitoso.');
    }
  } catch (error) {
    console.error(error);
    alert(`Error: ${error.message}`);
  } finally {
    isCalculatingBlend.value = false;
  }
};
</script>

<style scoped>
/* Quitar flechas del input de tipo número (Fardos) */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

input[type=number] {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
