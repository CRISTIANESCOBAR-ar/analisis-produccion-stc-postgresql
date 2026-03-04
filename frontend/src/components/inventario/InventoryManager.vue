<template>
  <div class="p-6 bg-gray-50 min-h-screen">
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold text-gray-800">Gestión de Inventario (Materia Prima)</h1>
      <div v-if="activeVersionName" class="shrink-0">
        <span class="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200 shadow-sm">
          <svg class="w-3.5 h-3.5 mr-1.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Versión Activa: {{ activeVersionName }}
        </span>
      </div>
    </div>

    <!-- Controles Superiores: Filtros y Configuración Unificada -->
    <div class="bg-white p-4 rounded-lg shadow mb-6">
      
      <!-- Única Fila de Controles -->
      <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        
        <!-- Bloque Izquierda: Versión y Búsqueda -->
        <div class="flex flex-col md:flex-row md:items-center gap-4 flex-1">
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

          <!-- Selector de Algoritmo -->
          <div class="relative flex shrink-0 ml-2">
            <div class="flex flex-col items-center gap-1.5">
              <span class="text-sm font-semibold text-gray-600 text-center">Algoritmo de armado de Mezclas</span>
              <div class="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 shadow-inner">
              <button
                @click="blendAlgorithm = 'standard'; showAlgorithmOptionTooltip('standard')"
                @mouseenter="showAlgorithmOptionTooltip('standard')"
                @mouseleave="hideAlgorithmOptionTooltip"
                @focus="showAlgorithmOptionTooltip('standard')"
                @blur="hideAlgorithmOptionTooltip"
                :class="[
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap',
                  blendAlgorithm === 'standard'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >Estándar</button>
              <button
                @click="blendAlgorithm = 'stability'; showAlgorithmOptionTooltip('stability')"
                @mouseenter="showAlgorithmOptionTooltip('stability')"
                @mouseleave="hideAlgorithmOptionTooltip"
                @focus="showAlgorithmOptionTooltip('stability')"
                @blur="hideAlgorithmOptionTooltip"
                :class="[
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap',
                  blendAlgorithm === 'stability'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >Golden Batch</button>
              <button
                @click="blendAlgorithm = 'stability-strict'; showAlgorithmOptionTooltip('stability-strict')"
                @mouseenter="showAlgorithmOptionTooltip('stability-strict')"
                @mouseleave="hideAlgorithmOptionTooltip"
                @focus="showAlgorithmOptionTooltip('stability-strict')"
                @blur="hideAlgorithmOptionTooltip"
                :class="[
                  'px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap',
                  blendAlgorithm === 'stability-strict'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                ]"
              >GB + Norma</button>
              </div>

              <div
                v-if="algorithmOptionTooltipVisible && currentAlgorithmOptionTooltip"
                class="absolute top-full left-1/2 z-40 mt-2 w-96 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
              >
                <div class="mb-2 flex items-center justify-between border-b border-slate-200 pb-2">
                  <h5 class="text-sm font-bold text-slate-800">{{ currentAlgorithmOptionTooltip.title }}</h5>
                  <span :class="currentAlgorithmOptionTooltip.badgeClass" class="rounded-full px-2 py-0.5 text-[10px] font-semibold">
                    {{ currentAlgorithmOptionTooltip.badge }}
                  </span>
                </div>
                <p class="text-xs text-slate-700 leading-relaxed">{{ currentAlgorithmOptionTooltip.description }}</p>
                <div class="mt-2 rounded-md bg-slate-50 p-2.5 border border-slate-200">
                  <p class="text-[11px] font-semibold text-slate-700">Ejemplo práctico</p>
                  <p class="mt-1 text-[11px] text-slate-600 leading-relaxed">{{ currentAlgorithmOptionTooltip.example }}</p>
                </div>
              </div>
            </div>

            <div
              class="relative"
              @mouseenter="algorithmTooltipVisible = true"
              @mouseleave="algorithmTooltipVisible = false"
            >
              <button
                type="button"
                class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors"
                aria-label="Información de algoritmos"
                @click.stop="algorithmTooltipVisible = !algorithmTooltipVisible"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <div
                v-if="algorithmTooltipVisible"
                class="absolute top-full right-0 mt-2 z-40 w-90 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl"
              >
                <div class="mb-3 border-b border-teal-400/60 pb-2">
                  <h4 class="text-sm font-bold text-teal-700">Algoritmos de Mezcla</h4>
                  <p class="mt-1 text-xs text-slate-600">Define cómo se arma cada receta de fardos.</p>
                </div>

                <div class="space-y-2.5 text-xs">
                  <div class="rounded-md border-l-4 border-slate-400 bg-slate-50 p-2.5">
                    <p class="font-semibold text-slate-800">Estándar (Round Robin)</p>
                    <p class="mt-1 text-slate-600">Consumo secuencial y balanceado por turnos. Prioriza completar la mezcla respetando límites activos.</p>
                  </div>

                  <div class="rounded-md border-l-4 border-blue-500 bg-blue-50 p-2.5">
                    <p class="font-semibold text-blue-900">Golden Batch</p>
                    <p class="mt-1 text-blue-800">Maximiza bloques idénticos (N alto) con distribución proporcional del stock. La tolerancia se muestra como referencia.</p>
                  </div>

                  <div class="rounded-md border-l-4 border-indigo-500 bg-indigo-50 p-2.5">
                    <p class="font-semibold text-indigo-900">GB + Norma</p>
                    <p class="mt-1 text-indigo-800">Aplica Golden Batch y además hace cumplir el cupo de tolerancia. Puede reducir N para cumplir norma.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Selector de Modo de Stock -->
          <div class="flex items-center space-x-2 shrink-0 border-l pl-4 border-gray-300 ml-2">
            <div class="flex flex-col items-center gap-1.5">
              <span class="text-sm font-semibold text-gray-600 text-center">Stock Base</span>
              <div class="inline-flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 shadow-inner">
                <button
                  @click="filters.stockMode = 'available'"
                  :class="[
                    'px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap',
                    filters.stockMode === 'available'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  ]"
                >Disponible</button>
                <button
                  @click="filters.stockMode = 'total'"
                  :class="[
                    'px-3 py-1 rounded-md text-xs font-semibold transition-all duration-150 whitespace-nowrap',
                    filters.stockMode === 'total'
                      ? 'bg-slate-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  ]"
                >Total</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Bloque Derecha: Botones de Configuración -->
        <div class="flex items-center space-x-6 shrink-0 border-t pt-4 xl:border-t-0 xl:pt-0">
          
          <div class="flex flex-col items-start gap-2">
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

            <div class="flex items-center gap-3">
              <!-- Botón de Columnas -->
              <button 
                @click="showColumnSelector = !showColumnSelector"
                class="flex items-center space-x-1.5 text-blue-600 text-xs font-semibold hover:text-blue-800 transition-colors focus:outline-none"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Ver Columnas</span>
              </button>

              <!-- Checkbox Agrupar Lotes Pequeños -->
              <div class="flex items-center gap-2 border-l border-gray-200 pl-3">
                 <label class="flex items-center space-x-1 cursor-pointer select-none" title="Agrupar lotes pequeños por condiciones de uso">
                    <input type="checkbox" v-model="filters.groupSmallLots" class="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5" />
                    <span class="text-xs text-slate-700 font-medium whitespace-nowrap">Agrupar</span>
                 </label>
                 
                 <div v-if="filters.groupSmallLots" class="flex items-center gap-1 transition-all duration-300">
                    <span class="text-xs text-gray-400 font-bold">≤</span>
                    <input type="number" 
                        v-model.number="filters.smallLotThreshold"
                        min="1" max="999"
                        class="w-10 text-xs text-center border-gray-300 rounded-sm py-0.5 px-0 placeholder-gray-300 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
                        placeholder="20" />
                 </div>
              </div>
            </div>
          </div>

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
          <div class="flex flex-col gap-1">
            <h2 class="text-xl font-bold text-gray-800">Plan de Mezclas Generado</h2>
            <label class="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
              <input type="checkbox" v-model="showOnlyLargestBlendBlock" class="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5" />
              <span>Mostrar solo bloque mayor</span>
              <span v-if="showOnlyLargestBlendBlock && primaryBlendBlockId" class="font-semibold text-indigo-700">({{ primaryBlendBlockId }})</span>
            </label>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="exportToExcel"
              class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold text-sm transition-colors flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2m0 0v-8m0 8H3m15-8h3" />
              </svg>
              Exportar a Excel
            </button>
            <button 
              @click="isBlendMode = false"
              class="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold text-sm transition-colors"
            >
              Volver al Inventario
            </button>
          </div>
        </div>

        <div
          v-if="blendUserMessage"
          class="mb-4 rounded-lg px-4 py-3 text-sm"
          :class="blendUserMessage.kind === 'error'
            ? 'border border-red-300 bg-red-50 text-red-900'
            : 'border border-slate-300 bg-slate-50 text-slate-800'"
        >
          <p class="font-semibold">{{ blendUserMessage.title }}</p>
          <p class="mt-1">{{ blendUserMessage.message }}</p>
          <ul v-if="blendUserMessage.details?.length" class="mt-2 list-disc pl-5 space-y-0.5">
            <li v-for="(detail, index) in blendUserMessage.details" :key="`blend-msg-${index}`">{{ detail }}</li>
          </ul>
        </div>

        <div v-if="appliedRulesSummary.length || appliedAlgorithmLabel || appliedCalculationTimestamp" class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div class="mb-2 flex flex-col md:flex-row md:items-start md:justify-between gap-1.5 md:gap-3">
            <h3 class="text-sm font-bold text-blue-800">Reglas aplicadas en este cálculo</h3>
            <div class="text-xs text-blue-900 md:text-right">
              <div v-if="appliedAlgorithmLabel || appliedCalculationTimestamp">
                <span v-if="appliedAlgorithmLabel">
                  <span class="font-semibold">Algoritmo usado:</span>
                  <span class="ml-1">{{ appliedAlgorithmLabel }}</span>
                </span>
                <span v-if="appliedAlgorithmLabel && appliedCalculationTimestamp" class="mx-2">|</span>
                <span v-if="appliedCalculationTimestamp">
                  <span class="font-semibold">Ejecutado:</span>
                  <span class="ml-1">{{ appliedCalculationTimestamp }}</span>
                </span>
              </div>
            </div>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="(rule, idx) in appliedRulesSummary"
              :key="`${rule.parametro}-${idx}`"
              class="bg-white border border-blue-100 rounded px-2 py-1.5 text-xs"
            >
              <div class="text-gray-700">
                <span class="font-semibold text-blue-900">{{ rule.parametro }}:</span>
                <span class="ml-1">{{ rule.detalle }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isCalculatingBlend" class="text-center py-8 text-blue-600 font-bold">
          Calculando optimización...
        </div>

        <div v-else-if="blendPlan">
          <!-- Tabla del Plan -->
          <div class="overflow-x-auto mb-8 border rounded-lg">
            <div class="flex flex-wrap items-center gap-3 px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs">
              <span class="font-semibold text-slate-700">Leyenda:</span>
              <span class="inline-flex items-center gap-1.5 text-slate-700">
                <span class="w-3 h-3 rounded bg-green-100 border border-green-300"></span>
                Objetivo
              </span>
              <span class="inline-flex items-center gap-1.5 text-slate-700">
                <span class="w-3 h-3 rounded bg-yellow-50 border border-yellow-300"></span>
                Tolerancia
              </span>
              <span class="inline-flex items-center gap-1.5 text-slate-700">
                <span class="w-3 h-3 rounded bg-red-100 border border-red-300"></span>
                Fuera de regla
              </span>
              <span class="inline-flex items-center gap-1.5 text-slate-700">
                <span class="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
                Motivo: Sobrante 0 = se usó todo en el plan
              </span>
            </div>
            <table class="min-w-full divide-y divide-gray-200 compact-plan-table">
              <thead class="bg-gray-100">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('PRODUTOR')">
                      <span>Productor</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('PRODUTOR') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('PRODUTOR') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('PRODUTOR') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('LOTE')">
                      <span>Lote</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('LOTE') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('LOTE') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('LOTE') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('TAM')">
                      <span>Tam</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('TAM') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('TAM') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('TAM') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('CLASSIF')">
                      <span>Clasif.</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('CLASSIF') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('CLASSIF') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('CLASSIF') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('Stock')">
                      <span>Stock</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('Stock') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('Stock') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('Stock') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('Usados')">
                      <span>Usados</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('Usados') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('Usados') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('Usados') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('Sobrante')">
                      <span>Sobrante</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('Sobrante') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('Sobrante') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('Sobrante') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('MotivoLogistico')">
                      <span>Motivo Sobrante</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('MotivoLogistico') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('MotivoLogistico') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('MotivoLogistico') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('MIC')">
                      <span>MIC</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('MIC') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('MIC') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('MIC') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('STR')">
                      <span>STR</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('STR') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('STR') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('STR') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('LEN')">
                      <span>LEN</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('LEN') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('LEN') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('LEN') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort('ELG')">
                      <span>ELG</span>
                      <svg class="w-3 h-3" :class="getBlendSortDirection('ELG') ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path v-if="getBlendSortDirection('ELG') === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                        <path v-else-if="getBlendSortDirection('ELG') === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                      </svg>
                    </button>
                  </th>
                  <template v-for="(col, colIndex) in activeBlendColumns" :key="`mix-head-${col}`">
                    <th class="px-4 py-3 text-center text-xs font-bold text-indigo-600 uppercase tracking-wider border-l border-gray-300 bg-indigo-50">
                      <button type="button" class="inline-flex items-center gap-1" @click="toggleBlendSort(`MEZCLA::${col}`)">
                        <span>{{ col }}</span>
                        <svg class="w-3 h-3" :class="getBlendSortDirection(`MEZCLA::${col}`) ? 'text-blue-600' : 'text-indigo-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path v-if="getBlendSortDirection(`MEZCLA::${col}`) === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                          <path v-else-if="getBlendSortDirection(`MEZCLA::${col}`) === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                        </svg>
                      </button>
                    </th>
                    <th
                      class="px-4 py-3 text-center text-xs font-bold text-teal-700 uppercase tracking-wider border-l border-gray-300 bg-teal-50"
                    >
                      Saldo
                    </th>
                  </template>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="(row, index) in sortedBlendPlanRows" :key="index" class="hover:bg-gray-50">
                  <td class="px-4 py-2 text-sm text-gray-900 font-medium">{{ row.PRODUTOR }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ row.LOTE }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ row.TAM || '-' }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ getCombinedClassif(row) || '-' }}</td>
                  <td class="px-4 py-2 text-sm">
                    <span :class="row.Estado === 'USO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'" class="px-2 py-1 rounded text-xs font-bold">
                      {{ row.Estado }}
                    </span>
                  </td>
                  <td class="px-4 py-2 text-sm text-center font-semibold text-slate-700">{{ row.Stock ?? '-' }}</td>
                  <td class="px-4 py-2 text-sm text-center font-semibold text-blue-700">{{ formatThousandInteger(getRowUsedForVisibleBlocks(row)) }}</td>
                  <td class="px-4 py-2 text-sm text-center font-semibold text-amber-700">{{ formatThousandInteger(getRowSobranteForVisibleBlocks(row)) }}</td>
                  <td class="px-4 py-2 text-sm text-gray-700">
                    <span v-if="getRowSobranteForVisibleBlocks(row) === 0" class="font-semibold text-emerald-700">{{ getPlanMotivoLogistico(row, getRowSobranteForVisibleBlocks(row)) }}</span>
                    <span v-else-if="row.Estado === 'TOLER.'" class="font-medium text-amber-700">{{ getPlanMotivoLogistico(row, getRowSobranteForVisibleBlocks(row)) }}</span>
                    <span v-else class="font-medium text-slate-700">{{ getPlanMotivoLogistico(row, getRowSobranteForVisibleBlocks(row)) }}</span>
                  </td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'MIC')">{{ formatValue(row.MIC, 'MIC') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'STR')">{{ formatValue(row.STR, 'STR') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'UHML')">{{ formatValue(row.LEN, 'UHML') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'ELG')">{{ formatValue(row.ELG, 'ELG') }}</td>
                  <template v-for="(col, colIndex) in activeBlendColumns" :key="`mix-row-${index}-${col}`">
                    <td class="px-4 py-2 text-sm text-center font-bold border-l border-gray-200" :class="row.mezclas[col] ? 'text-indigo-600 bg-indigo-50/30' : 'text-gray-300'">
                      {{ row.mezclas[col] || '-' }}
                    </td>
                    <td class="px-4 py-2 text-sm text-center font-semibold text-teal-700 border-l border-gray-200 bg-teal-50/30">
                      {{ getStockActualForBlock(row, colIndex, activeBlendColumns) }}
                    </td>
                  </template>
                </tr>
              </tbody>
              <tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">
                <!-- Resumen Mezcla (Cantidad / Peso) -->
                <tr class="summary-matrix-row summary-matrix-group-start">
                  <td colspan="9" class="px-4 py-2 text-sm font-bold text-right text-gray-700 border-b border-gray-300">TOTALES LOTES</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-slate-800 border-b border-gray-300">{{ formatThousandInteger(planLotTotals.stock) }}</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-blue-700 border-b border-gray-300">{{ formatThousandInteger(planLotTotals.usados) }}</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-amber-700 border-b border-gray-300">{{ formatThousandInteger(planLotTotals.sobrante) }}</td>
                  <td class="px-4 py-2 text-sm text-center text-gray-400 border-b border-gray-300">—</td>
                  <td rowspan="5" class="summary-matrix-cell px-4 py-2 text-sm font-bold text-center text-gray-800">Mezcla</td>
                  <td rowspan="3" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Cantidad</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Fardos</td>
                  <template v-for="col in activeBlendColumns" :key="'mix-fardos-'+col">
                    <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900" :colspan="2">
                      {{ blendPlan.estadisticas[col].totalFardos }}
                    </td>
                  </template>
                </tr>
                <tr class="summary-matrix-row">
                  <td colspan="9" class="px-4 py-2 text-sm font-bold text-right text-gray-700 border-b border-gray-300">TOTALES KG</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-slate-800 border-b border-gray-300">{{ formatThousandInteger(planWeightTotals.stockKg) }}</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-blue-700 border-b border-gray-300">{{ formatThousandInteger(planWeightTotals.usadosKg) }}</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-amber-700 border-b border-gray-300">{{ formatThousandInteger(planWeightTotals.sobranteKg) }}</td>
                  <td class="px-4 py-2 text-sm text-center text-gray-400 border-b border-gray-300">—</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Kg</td>
                  <template v-for="col in activeBlendColumns" :key="'mix-kg-'+col">
                    <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900" :colspan="2">
                      {{ formatThousandInteger(getPesoTotalBloqueForColumn(col)) }}
                    </td>
                  </template>
                </tr>
                <tr class="summary-matrix-row">
                  <td colspan="13" :rowspan="summaryMatrixRowspan" class="px-4 py-2 align-top border-r border-gray-300">
                    <div v-if="activeBlendVariablesForSummary.length" class="h-full border border-slate-300 rounded-md overflow-hidden bg-white">
                      <div class="px-3 py-2 bg-slate-50 border-b border-slate-300">
                        <h3 class="text-sm font-bold text-slate-800">Resumen de lotes (promedios de variables activas)</h3>
                      </div>
                      <table class="w-full compact-remanentes-table">
                        <thead class="bg-gray-50">
                          <tr class="border-b border-gray-300">
                            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Variable</th>
                            <th v-for="column in summaryComparisonColumns" :key="`res-inline-${column.key}`" class="px-3 py-2 text-center text-xs font-semibold text-indigo-700 uppercase tracking-wide border-l border-gray-200">
                              {{ column.label }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-100">
                          <tr>
                            <td class="px-3 py-2 text-sm font-semibold text-gray-700">Fecha inicial</td>
                            <td
                              v-for="column in summaryComparisonColumns"
                              :key="`res-inline-fecha-${column.key}`"
                              class="px-3 py-2 text-sm text-center border-l border-gray-200 text-slate-600"
                            >
                              {{ getSummaryComparisonStartDate(column) }}
                            </td>
                          </tr>
                          <tr>
                            <td class="px-3 py-2 text-sm font-semibold text-gray-700">Kg usados</td>
                            <td
                              v-for="column in summaryComparisonColumns"
                              :key="`res-inline-kg-${column.key}`"
                              class="px-3 py-2 text-sm text-center border-l border-gray-200 text-slate-700 font-semibold"
                            >
                              {{ formatSummaryComparisonKg(getSummaryComparisonUsedKg(column)) }}
                            </td>
                          </tr>
                          <tr v-for="variable in activeBlendVariablesForSummary" :key="`res-inline-row-${variable.uiKey}`">
                            <td class="px-3 py-2 text-sm font-semibold text-gray-700">{{ variable.label }}</td>
                            <td
                              v-for="column in summaryComparisonColumns"
                              :key="`res-inline-${variable.uiKey}-${column.key}`"
                              class="px-3 py-2 text-sm text-center border-l border-gray-200"
                              :class="getSummaryCellClass(getSummaryComparisonValue(column, variable), variable.uiKey)"
                            >
                              {{ formatValue(getSummaryComparisonValue(column, variable), variable.formatKey) }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div class="mx-3 my-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-700 leading-relaxed">
                        <div class="mb-1 flex items-start justify-between gap-2">
                          <div class="flex items-center gap-2 flex-wrap">
                            <p class="font-semibold text-slate-800">{{ predictiveFiberAnalysis.title }}</p>
                            <span v-if="predictiveFiberAnalysis.available" class="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold" :class="predictiveFiberAnalysis.badgeClass">
                              {{ predictiveFiberAnalysis.badgeLabel }}
                            </span>
                          </div>
                          <button
                            type="button"
                            @click="copyPredictiveWhatsappMessage"
                            class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors whitespace-nowrap"
                            :class="predictiveCopyState === 'success'
                              ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                              : (predictiveCopyState === 'error'
                                ? 'border-rose-300 bg-rose-50 text-rose-700'
                                : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100')"
                          >
                            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
                              <path d="M20.52 3.48A11.91 11.91 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.88c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.87 11.87 0 0 0 5.7 1.45h.01c6.54 0 11.88-5.33 11.88-11.88 0-3.18-1.24-6.17-3.4-8.43Zm-8.48 18.3h-.01a9.87 9.87 0 0 1-5.02-1.37l-.36-.22-3.76.99 1-3.67-.24-.38a9.85 9.85 0 0 1-1.5-5.25C2.15 6.45 6.58 2 12.04 2a9.84 9.84 0 0 1 7 2.9 9.84 9.84 0 0 1 2.88 6.99c0 5.45-4.44 9.89-9.88 9.89Zm5.42-7.42c-.3-.15-1.77-.87-2.04-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.23-.63.08-.3-.15-1.24-.46-2.37-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.5.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.66-1.6-.9-2.18-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.53.08-.8.38-.27.3-1.04 1.01-1.04 2.46s1.06 2.86 1.2 3.05c.15.2 2.08 3.17 5.03 4.45.7.3 1.25.49 1.68.63.7.22 1.34.19 1.84.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.56-.35Z"/>
                            </svg>
                            <span>Copiar mensaje</span>
                          </button>
                        </div>
                        <p class="text-[11px] text-slate-600 mb-1">{{ predictiveFiberAnalysis.subtitle }}</p>
                        <template v-if="predictiveFiberAnalysis.available">
                          <p class="font-semibold" :class="predictiveFiberAnalysis.verdictTextClass">{{ predictiveFiberAnalysis.conclusionHeading }}</p>
                          <p class="text-slate-700">{{ predictiveFiberAnalysis.conclusionBody }}</p>
                          <p class="mt-1 font-semibold text-slate-800">📊 COMPARATIVA TÉCNICA (Promedios):</p>
                          <div v-for="(section, sectionIndex) in predictiveFiberAnalysis.sections" :key="`pf-main-sec-${sectionIndex}`" class="mt-1 rounded border border-white/60 bg-white/70 px-2 py-1">
                            <p class="font-semibold text-slate-800">{{ section.title }}</p>
                            <p v-for="(bullet, bulletIndex) in section.bullets" :key="`pf-main-bul-${sectionIndex}-${bulletIndex}`" class="text-slate-700">• {{ bullet }}</p>
                          </div>
                          <p class="mt-1 font-semibold text-slate-800">{{ predictiveFiberAnalysis.efficiencyHeading }}</p>
                          <p class="font-semibold" :class="predictiveFiberAnalysis.verdictTextClass">{{ predictiveFiberAnalysis.efficiencyBody }}</p>
                        </template>
                        <p v-else class="text-slate-500">No hay datos suficientes para emitir predicción técnica.</p>
                      </div>
                    </div>
                  </td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Bloques</td>
                  <template v-for="col in activeBlendColumns" :key="'mix-bloques-'+col">
                    <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900" :colspan="2">
                      {{ getBlockMixCount(col) }}
                    </td>
                  </template>
                </tr>
                <tr class="summary-matrix-row summary-matrix-section-break">
                  <td rowspan="2" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Peso</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Por Mezcla</td>
                  <template v-for="col in activeBlendColumns" :key="'mix-pmezcla-'+col">
                    <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900" :colspan="2">
                      {{ formatValue(getPesoPorMezclaForColumn(col), 'PESO') }}
                    </td>
                  </template>
                </tr>
                <tr class="summary-matrix-row summary-matrix-group-end">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Por Bloque</td>
                  <template v-for="col in activeBlendColumns" :key="'mix-pbloque-'+col">
                    <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900" :colspan="2">
                      {{ formatValue(getPesoTotalBloqueForColumn(col), 'PESO') }}
                    </td>
                  </template>
                </tr>
                <template v-for="variable in activeBlendVariablesForSummary" :key="`matrix-${variable.uiKey}`">
                  <tr class="summary-matrix-row summary-matrix-group-start">
                    <td rowspan="5" class="summary-matrix-cell px-4 py-2 text-sm font-bold text-center text-gray-800">{{ getMatrixVariableLabel(variable) }}</td>
                    <td rowspan="3" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Promedio</td>
                    <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Bloque</td>
                    <template v-for="col in activeBlendColumns" :key="`matrix-bloque-${variable.uiKey}-${col}`">
                      <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :colspan="2" :class="getSummaryCellClass(getMatrixStats(col, variable).promedioGeneral, variable.uiKey)">
                        {{ formatValue(getMatrixStats(col, variable).promedioGeneral, variable.formatKey) }}
                      </td>
                    </template>
                  </tr>
                  <tr class="summary-matrix-row">
                    <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">{{ getMatrixIdealPctLabel(variable) }}</td>
                    <template v-for="col in activeBlendColumns" :key="`matrix-ideal-${variable.uiKey}-${col}`">
                      <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :colspan="2" :class="getSummaryCellClass(getMatrixStats(col, variable).promedioIdeal, variable.uiKey)">
                        {{ formatValue(getMatrixStats(col, variable).promedioIdeal, variable.formatKey) }}
                      </td>
                    </template>
                  </tr>
                  <tr class="summary-matrix-row">
                    <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">{{ getMatrixTolerancePctLabel(variable) }}</td>
                    <template v-for="col in activeBlendColumns" :key="`matrix-tol-${variable.uiKey}-${col}`">
                      <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :colspan="2" :class="getSummaryCellClass(getMatrixStats(col, variable).promedioTolerancia, variable.uiKey)">
                        {{ formatValue(getMatrixStats(col, variable).promedioTolerancia, variable.formatKey) }}
                      </td>
                    </template>
                  </tr>
                  <tr class="summary-matrix-row summary-matrix-section-break">
                    <td rowspan="2" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Porcentual</td>
                    <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">{{ getMatrixIdealPctLabel(variable) }}</td>
                    <template v-for="col in activeBlendColumns" :key="`matrix-pct-ideal-${variable.uiKey}-${col}`">
                      <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :colspan="2" :class="getSummaryCellClass(getMatrixStats(col, variable).pctIdeal, variable.uiKey, 'pctIdeal')">
                        {{ getMatrixStats(col, variable).pctIdeal !== undefined ? `${getMatrixStats(col, variable).pctIdeal.toFixed(1)}%` : '-' }}
                      </td>
                    </template>
                  </tr>
                  <tr class="summary-matrix-row summary-matrix-group-end">
                    <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">{{ getMatrixTolerancePctLabel(variable) }}</td>
                    <template v-for="col in activeBlendColumns" :key="`matrix-pct-tol-${variable.uiKey}-${col}`">
                      <td class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :colspan="2" :class="getSummaryCellClass(getMatrixStats(col, variable).pctTolerancia, variable.uiKey, 'pctTolerancia')">
                        {{ getMatrixStats(col, variable).pctTolerancia !== undefined ? `${getMatrixStats(col, variable).pctTolerancia.toFixed(1)}%` : '-' }}
                      </td>
                    </template>
                  </tr>
                </template>
              </tfoot>
            </table>
          </div>

          <h3 class="text-lg font-bold text-gray-800 mb-3 mt-8 border-t pt-6">Proyección de Compra por Calidad</h3>
          <div class="border rounded-lg bg-emerald-50/40 border-emerald-200 p-4">
            <div class="grid grid-cols-1 lg:grid-cols-6 gap-3 mb-4">
              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Mezclas objetivo</label>
                <input
                  v-model.number="purchaseProjection.targetMixes"
                  type="number"
                  min="1"
                  class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 border"
                />
                <p v-if="purchaseProjection.targetMixes < purchaseProjection.minMixesForBlock" class="mt-1 text-[11px] text-amber-700 font-medium">
                  Recomendado para bloque: mínimo {{ purchaseProjection.minMixesForBlock }} mezclas.
                </p>
              </div>

              <div>
                <label class="block text-xs font-semibold text-gray-700 mb-1">Fuente disponible</label>
                <select
                  v-model="purchaseProjection.source"
                  class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm p-2 border"
                >
                  <option value="stock">Stock actual</option>
                  <option value="remanente">Sobrante no usado</option>
                </select>
              </div>

              <div class="bg-white rounded-md border border-emerald-100 px-3 py-2">
                <p class="text-[11px] text-gray-500 uppercase tracking-wide">Fardos por mezcla</p>
                <p class="text-lg font-bold text-emerald-700">{{ formatThousandInteger(filters.fardos || 0) }}</p>
              </div>

              <div v-if="purchaseProjection.source !== 'stock'" class="bg-white rounded-md border border-emerald-100 px-3 py-2">
                <p class="text-[11px] text-gray-500 uppercase tracking-wide">Mezclas base generadas</p>
                <p class="text-lg font-bold text-emerald-700">{{ formatThousandInteger(generatedMixesCount) }}</p>
              </div>

              <div class="bg-white rounded-md border border-emerald-100 px-3 py-2">
                <p class="text-[11px] text-gray-500 uppercase tracking-wide">Stock total fuente</p>
                <p class="text-lg font-bold text-emerald-700">{{ formatThousandInteger(projectionSourceTotals.stockFardos) }}</p>
              </div>

              <div class="bg-white rounded-md border border-emerald-100 px-3 py-2">
                <p class="text-[11px] text-gray-500 uppercase tracking-wide">Peso total fuente (kg)</p>
                <p class="text-lg font-bold text-emerald-700">{{ formatThousandInteger(projectionSourceTotals.stockPeso) }}</p>
              </div>
            </div>

            <div v-if="purchaseProjectionError" class="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {{ purchaseProjectionError }}
            </div>

            <div v-if="projectionVariablePurchaseRows.length" class="mt-4 overflow-x-auto border rounded-lg bg-white">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-emerald-100/60">
                  <tr>
                    <th class="px-3 py-2 text-left text-xs font-semibold text-emerald-900 uppercase tracking-wide">Variable</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Disponible</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Faltante</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Total Fardos</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Peso Medio Fardo</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Peso Total</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Fardos x Mezcla</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Tamaño Bloque</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Promedio actual</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Objetivo</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">A Comprar</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Promedio Final</th>
                    <th class="px-3 py-2 text-right text-xs font-semibold text-emerald-900 uppercase tracking-wide">Kg compra global</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200">
                  <tr v-for="item in projectionVariablePurchaseRows" :key="`var-buy-${item.uiKey}`" class="hover:bg-emerald-50/30">
                    <td class="px-3 py-2 text-sm font-semibold text-gray-800">{{ item.label }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatProjectionValue(item.disponibleFardos, 0) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatProjectionValue(item.faltanteFardos, 0) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatProjectionValue(item.totalFardos, 0) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatProjectionValue(item.pesoMedioFardo, 0) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatThousandInteger(item.pesoTotalKg) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatProjectionValue(item.fardosPorMezcla, 0) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatProjectionValue(item.tamanoBloque, 0) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">{{ formatProjectionValue(item.promedioActual, 2) }}</td>
                    <td class="px-3 py-2 text-sm text-right text-gray-700">
                      <span v-if="item.objetivoComparador && item.objetivoValor !== null">
                        {{ item.objetivoComparador }} {{ formatProjectionValue(item.objetivoValor, 2) }}
                      </span>
                      <span v-else>-</span>
                    </td>
                    <td class="px-3 py-2 text-sm text-right font-semibold text-indigo-800">
                      <span v-if="item.comprarComparador && item.comprarValor !== null">
                        {{ item.comprarComparador }} {{ formatProjectionValue(item.comprarValor, 2) }}
                      </span>
                      <span v-else>-</span>
                    </td>
                    <td class="px-3 py-2 text-sm text-right font-semibold text-emerald-800">
                      {{ item.promedioFinal !== null ? formatProjectionValue(item.promedioFinal, 2) : '-' }}
                    </td>
                    <td class="px-3 py-2 text-sm text-right font-bold text-emerald-800">{{ formatThousandInteger(item.totalKgToBuy) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else-if="!purchaseProjectionError" class="mt-4 rounded border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 italic">
              No hay datos suficientes para mostrar el resumen global por variable.
            </div>

            <!-- ── Análisis por Reglas de Mezcla (solo Sobrante no usado) ──────────────── -->
            <div v-if="purchaseProjection.source === 'remanente' && remanenteMixingRuleAnalysis" class="mt-5 space-y-4">

              <!-- Cabecera general -->
              <div class="flex items-baseline gap-3 px-1">
                <span class="text-sm font-semibold text-slate-700">Análisis por Reglas de Mezcla</span>
                <span class="text-xs text-slate-500">
                  Bloque: {{ formatProjectionValue(remanenteMixingRuleAnalysis.totalBloqueF, 0) }} fardos
                  ({{ filters.fardos }} × {{ purchaseProjection.targetMixes }} mezclas) ·
                  Stock disponible: {{ formatProjectionValue(remanenteMixingRuleAnalysis.totalStockF, 0) }} fardos
                </span>
              </div>

              <!-- Una card por variable -->
              <div v-for="v in remanenteMixingRuleAnalysis.varAnalysis" :key="v.uiKey"
                   class="overflow-x-auto border rounded-lg bg-white">

                <!-- Encabezado de la variable -->
                <div class="flex items-center gap-3 px-4 py-2 border-b"
                     :class="v.aComprarF > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'">
                  <span class="text-sm font-bold" :class="v.aComprarF > 0 ? 'text-red-800' : 'text-emerald-800'">
                    {{ v.label }}
                  </span>
                  <span class="text-xs px-2 py-0.5 rounded font-mono bg-white border"
                        :class="v.aComprarF > 0 ? 'border-red-300 text-red-700' : 'border-emerald-300 text-emerald-700'">
                    Regla {{ v.tolLimitPct === 10 ? '90/10' : v.tolLimitPct === 20 ? '80/20' : (100-v.tolLimitPct)+'/'+v.tolLimitPct }}
                  </span>
                  <span class="text-xs text-slate-600">
                    Obj promedio ≥ {{ formatProjectionValue(v.idealMin, 2) }} ·
                    Tolerancia {{ v.tolMin }}–{{ v.tolMax }} max {{ v.tolLimitPct }}%
                  </span>
                  <span v-if="v.aComprarF === 0" class="text-xs font-semibold text-emerald-700">✓ Sin necesidad de compra</span>
                  <span v-else class="text-xs font-semibold text-red-700">
                    A comprar: {{ formatProjectionValue(v.aComprarF, 0) }} fardos
                    ({{ formatThousandInteger(v.aComprarKg) }} kg)
                  </span>
                  <button @click="openMixDetailModal(v.uiKey)"
                          class="ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded border font-medium transition-colors"
                          :class="v.aComprarF > 0
                            ? 'bg-white border-red-300 text-red-700 hover:bg-red-50'
                            : 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                    Ver detalle fardo a fardo
                  </button>
                </div>

                <table class="min-w-full text-xs">
                  <thead class="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th class="px-3 py-1.5 text-left font-semibold text-slate-600">Zona</th>
                      <th class="px-3 py-1.5 text-left font-semibold text-slate-600">Rango</th>
                      <th class="px-3 py-1.5 text-right font-semibold text-slate-600">Fardos</th>
                      <th class="px-3 py-1.5 text-right font-semibold text-slate-600">Kg</th>
                      <th class="px-3 py-1.5 text-right font-semibold text-slate-600">% Stock</th>
                      <th class="px-3 py-1.5 text-right font-semibold text-slate-600">Prom. HVI</th>
                      <th class="px-3 py-1.5 text-right font-semibold text-slate-600">Límite %</th>
                      <th class="px-3 py-1.5 text-right font-semibold text-slate-600">Usable F</th>
                      <th class="px-3 py-1.5 text-right font-semibold text-red-700">Sobrante F</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    <!-- Zona DESCARTADO -->
                    <tr v-if="v.descF > 0" class="bg-gray-100">
                      <td class="px-3 py-1.5 font-semibold text-gray-400">Descartado</td>
                      <td class="px-3 py-1.5 text-gray-400">&lt; {{ v.tolMin }}</td>
                      <td class="px-3 py-1.5 text-right text-gray-400">{{ formatProjectionValue(v.descF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-gray-400">{{ formatThousandInteger(v.descKg) }}</td>
                      <td class="px-3 py-1.5 text-right text-gray-400">{{ formatProjectionValue((v.descF/remanenteMixingRuleAnalysis.totalStockF)*100, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-gray-400">—</td>
                      <td class="px-3 py-1.5 text-right text-gray-400">0</td>
                      <td class="px-3 py-1.5 text-right text-gray-400">0</td>
                      <td class="px-3 py-1.5 text-right text-gray-400">{{ formatProjectionValue(v.descF, 0) }}</td>
                    </tr>
                    <!-- Zona TOLERANCIA (restringida) -->
                    <tr class="bg-amber-50/60">
                      <td class="px-3 py-1.5 font-semibold text-amber-700">Tolerancia</td>
                      <td class="px-3 py-1.5 text-amber-700">{{ v.tolMin }} – {{ v.tolMax }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-700">{{ formatProjectionValue(v.tolF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-700">{{ formatThousandInteger(v.tolKg) }}</td>
                      <td class="px-3 py-1.5 text-right font-semibold"
                          :class="v.pctTolStock > v.tolLimitPct ? 'text-red-700' : 'text-slate-600'">
                        {{ formatProjectionValue(v.pctTolStock, 0) }}
                      </td>
                      <td class="px-3 py-1.5 text-right text-slate-600">{{ v.tolF > 0 ? formatProjectionValue(v.tolAvg, 2) : '—' }}</td>
                      <td class="px-3 py-1.5 text-right font-semibold text-amber-700">{{ v.tolLimitPct }}</td>
                      <td class="px-3 py-1.5 text-right text-emerald-700">{{ formatProjectionValue(v.usableTolF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right font-semibold"
                          :class="v.sobranteTolF > 0 ? 'text-red-700' : 'text-gray-300'">
                        {{ v.sobranteTolF > 0 ? formatProjectionValue(v.sobranteTolF, 0) : '—' }}
                      </td>
                    </tr>
                    <!-- Zona SUB-IDEAL (libre) -->
                    <tr class="bg-sky-50/40">
                      <td class="px-3 py-1.5 font-semibold text-sky-700">Sub-ideal</td>
                      <td class="px-3 py-1.5 text-sky-700">{{ v.tolMax }} – {{ v.idealMin }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-700">{{ formatProjectionValue(v.subF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-700">{{ formatThousandInteger(v.subKg) }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-600">{{ formatProjectionValue((v.subF/remanenteMixingRuleAnalysis.totalStockF)*100, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-600">{{ v.subF > 0 ? formatProjectionValue(v.subAvg, 2) : '—' }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-400">—</td>
                      <td class="px-3 py-1.5 text-right text-emerald-700">{{ formatProjectionValue(v.subF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-gray-300">—</td>
                    </tr>
                    <!-- Zona IDEAL (libre) -->
                    <tr class="bg-emerald-50/40">
                      <td class="px-3 py-1.5 font-semibold text-emerald-700">Ideal</td>
                      <td class="px-3 py-1.5 text-emerald-700">≥ {{ v.idealMin }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-700">{{ formatProjectionValue(v.ideF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-700">{{ formatThousandInteger(v.ideKg) }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-600">{{ formatProjectionValue((v.ideF/remanenteMixingRuleAnalysis.totalStockF)*100, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-emerald-700 font-semibold">{{ v.ideF > 0 ? formatProjectionValue(v.ideAvg, 2) : '—' }}</td>
                      <td class="px-3 py-1.5 text-right text-slate-400">—</td>
                      <td class="px-3 py-1.5 text-right text-emerald-700">{{ formatProjectionValue(v.ideF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right text-gray-300">—</td>
                    </tr>
                  </tbody>

                  <!-- Líneas resumen -->
                  <tfoot class="border-t-2 border-slate-300 text-xs">
                    <!-- Total usable -->
                    <tr class="bg-slate-50">
                      <td colspan="2" class="px-3 py-1.5 font-semibold text-slate-700">Total usable del stock</td>
                      <td class="px-3 py-1.5 text-right font-bold text-slate-800">{{ formatProjectionValue(v.totalUsableF, 0) }}</td>
                      <td class="px-3 py-1.5 text-right font-bold text-slate-800">{{ formatThousandInteger(v.totalUsableKg) }}</td>
                      <td colspan="5" class="px-3 py-1.5"></td>
                    </tr>
                    <!-- Faltante cantidad -->
                    <tr :class="v.faltanteF > 0 ? 'bg-red-50' : 'bg-slate-50'">
                      <td colspan="2" class="px-3 py-1.5 font-semibold"
                          :class="v.faltanteF > 0 ? 'text-red-700' : 'text-slate-500'">
                        {{ v.faltanteF > 0 ? '⚠ Faltante de cantidad' : '✓ Cantidad suficiente' }}
                      </td>
                      <td class="px-3 py-1.5 text-right font-bold"
                          :class="v.faltanteF > 0 ? 'text-red-700' : 'text-emerald-600'">
                        {{ v.faltanteF > 0 ? formatProjectionValue(v.faltanteF, 0) : '0' }}
                      </td>
                      <td class="px-3 py-1.5 text-right font-bold"
                          :class="v.faltanteF > 0 ? 'text-red-700' : 'text-emerald-600'">
                        {{ v.faltanteF > 0 ? formatThousandInteger(v.faltanteKg) : '—' }}
                      </td>
                      <td colspan="5" class="px-3 py-1.5"></td>
                    </tr>
                    <!-- Promedio estimado del bloque -->
                    <tr :class="v.avgPromedioOK ? 'bg-emerald-50/60' : 'bg-amber-50'">
                      <td colspan="2" class="px-3 py-1.5 font-semibold"
                          :class="v.avgPromedioOK ? 'text-emerald-700' : 'text-amber-700'">
                        {{ v.avgPromedioOK ? '✓ Promedio bloque OK' : '⚠ Promedio bloque insuficiente' }}
                      </td>
                      <td colspan="2" class="px-3 py-1.5 font-bold text-right"
                          :class="v.avgPromedioOK ? 'text-emerald-700' : 'text-amber-700'">
                        {{ formatProjectionValue(v.avgBloque, 2) }}
                        <span class="font-normal text-slate-500 ml-1">(obj {{ formatProjectionValue(v.idealMin, 2) }})</span>
                      </td>
                      <td colspan="5" class="px-3 py-1.5"></td>
                    </tr>
                    <!-- A comprar -->
                    <tr v-if="v.aComprarF > 0" class="bg-red-50 border-t border-red-200">
                      <td colspan="2" class="px-3 py-1.5 font-bold text-red-800">A comprar</td>
                      <td class="px-3 py-1.5 text-right font-bold text-red-800">{{ formatProjectionValue(v.aComprarF, 0) }} fardos</td>
                      <td class="px-3 py-1.5 text-right font-bold text-red-800">{{ formatThousandInteger(v.aComprarKg) }} kg</td>
                      <td colspan="2" class="px-3 py-1.5 text-slate-600">
                        <span v-if="v.valorMinCompra !== null">
                          valor HVI ≥ {{ formatProjectionValue(v.valorMinCompra, 2) }}
                        </span>
                      </td>
                      <td colspan="3" class="px-3 py-1.5"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <!-- Resumen final: restricción vinculante -->
              <div class="border rounded-lg overflow-hidden">
                <div class="bg-slate-700 px-4 py-2">
                  <span class="text-sm font-semibold text-white">Resumen — Restricción vinculante</span>
                </div>
                <div class="px-4 py-3 bg-slate-50 flex flex-wrap gap-6 text-sm">
                  <div>
                    <span class="text-slate-500 text-xs uppercase tracking-wide">A comprar (fardos)</span>
                    <p class="text-xl font-bold text-red-700">{{ formatProjectionValue(remanenteMixingRuleAnalysis.maxAComprarF, 0) }}</p>
                  </div>
                  <div>
                    <span class="text-slate-500 text-xs uppercase tracking-wide">A comprar (kg)</span>
                    <p class="text-xl font-bold text-red-700">{{ formatThousandInteger(remanenteMixingRuleAnalysis.maxAComprarKg) }}</p>
                  </div>
                  <div>
                    <span class="text-slate-500 text-xs uppercase tracking-wide">Entradas (25.000 kg)</span>
                    <p class="text-xl font-bold text-indigo-700">{{ formatProjectionValue(remanenteMixingRuleAnalysis.entradasN, 1) }}</p>
                  </div>
                  <div>
                    <span class="text-slate-500 text-xs uppercase tracking-wide">Bloque objetivo</span>
                    <p class="text-base font-semibold text-slate-700">
                      {{ formatProjectionValue(remanenteMixingRuleAnalysis.totalBloqueF, 0) }} fardos ·
                      {{ formatThousandInteger(remanenteMixingRuleAnalysis.totalBloqueKg) }} kg
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-3 text-xs text-emerald-900 bg-emerald-100/60 border border-emerald-200 rounded px-3 py-2">
              <span class="font-semibold">Guía de calidad:</span>
              La recomendación HVI se calcula en función de las variables activadas en “Reglas de Mezclas” y de la fuente seleccionada (stock o remanente).
              <template v-if="projectionGlobalGuidance.length">
                <div class="mt-1.5 space-y-0.5">
                  <p v-for="item in projectionGlobalGuidance" :key="`global-hvi-${item.uiKey}`">
                    <span class="font-semibold">{{ item.label }}:</span>
                    base {{ formatProjectionValue(item.sourceAverage, 2) }} ·
                    {{ buildGlobalGuidanceSummary(item) }} ·
                    Kg compra global: {{ formatThousandInteger(item.totalKgToBuy) }}
                  </p>
                </div>
              </template>
              <template v-else>
                Selecciona al menos una variable (Target/Tolerancia/Límites) para generar orientación de calidad.
              </template>
            </div>
          </div>

          <!-- CTA: Simular Plan de Mezclas -->
          <div class="mt-6 flex justify-end">
            <button
              @click="mixPlanModal.visible = true"
              :disabled="!saldoDisponibleRows.length || !activeRules.length"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold shadow hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
              Simular Plan de Mezclas con Compra
            </button>
          </div>

          <!-- Tabla de Remanentes / No Usados -->
          <h3 class="text-lg font-bold text-gray-800 mb-3 mt-8 border-t pt-6">{{ projectionSourceTableTitle }}</h3>
          <div class="overflow-x-auto border rounded-lg">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-red-50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Productor</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Lote</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Tam</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Fardos</th>
                  <th v-if="projectionSourceShowWeightColumns" class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Kilogramos</th>
                  <th v-if="projectionSourceShowWeightColumns" class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">Peso Medio</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">MIC</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">STR</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">LEN</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-red-800 uppercase tracking-wider">{{ projectionSourceTableReasonLabel }}</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-if="projectionSourceTableRows.length === 0">
                  <td :colspan="projectionSourceTableColspan" class="px-4 py-4 text-center text-gray-500 italic">{{ projectionSourceTableEmptyMessage }}</td>
                </tr>
                <tr v-else v-for="(row, index) in projectionSourceTableRows" :key="`projection-source-${index}`" class="hover:bg-red-50/50">
                  <td class="px-4 py-2 text-sm text-gray-900 font-medium">{{ row.PRODUTOR }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ row.LOTE }}</td>
                  <td class="px-4 py-2 text-sm text-gray-600">{{ row.TAM || '-' }}</td>
                  <td class="px-4 py-2 text-sm font-bold text-gray-800">{{ row.Fardos }}</td>
                  <td v-if="projectionSourceShowWeightColumns" class="px-4 py-2 text-sm font-semibold text-gray-800">{{ formatThousandInteger(row.Kilogramos) }}</td>
                  <td v-if="projectionSourceShowWeightColumns" class="px-4 py-2 text-sm text-gray-700">{{ formatProjectionValue(row.PesoMedio, 2) }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'MIC')">{{ formatValue(row.MIC, 'MIC') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'STR')">{{ formatValue(row.STR, 'STR') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'UHML')">{{ formatValue(row.LEN, 'UHML') }}</td>
                  <td class="px-4 py-2 text-sm text-red-600 font-medium">{{ row.Motivo }}</td>
                </tr>
              </tbody>
              <tfoot v-if="projectionSourceTableRows.length > 0" class="bg-gray-50 border-t-2 border-gray-300">
                <tr>
                  <td colspan="3" class="px-4 py-2 text-sm font-bold text-gray-800">Totales</td>
                  <td class="px-4 py-2 text-sm font-bold text-gray-800">{{ formatThousandInteger(projectionSourceTableTotals.fardos) }}</td>
                  <td v-if="projectionSourceShowWeightColumns" class="px-4 py-2 text-sm font-bold text-gray-800">{{ formatThousandInteger(projectionSourceTableTotals.kilogramos) }}</td>
                  <td v-if="projectionSourceShowWeightColumns" class="px-4 py-2 text-sm font-bold text-gray-800">{{ formatProjectionValue(projectionSourceTableTotals.pesoMedio, 2) }}</td>
                  <td class="px-4 py-2 text-sm font-bold text-gray-800">{{ formatProjectionValue(projectionSourceTableTotals.mic, 2) }}</td>
                  <td class="px-4 py-2 text-sm font-bold text-gray-800">{{ formatProjectionValue(projectionSourceTableTotals.str, 2) }}</td>
                  <td class="px-4 py-2 text-sm font-bold text-gray-800">{{ formatProjectionValue(projectionSourceTableTotals.len, 2) }}</td>
                  <td class="px-4 py-2 text-sm text-gray-400">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      <!-- Vista: Inventario Normal -->
      <div v-else>
      <table class="min-w-full divide-y divide-gray-200 stock-table">
        <thead class="bg-gray-100">
          <tr>
            <th 
              v-for="col in visibleColumns" 
              :key="col.key"
              class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
            >
              <button
                v-if="isStockSortableColumn(col.key)"
                type="button"
                class="inline-flex items-center gap-1"
                @click="toggleStockSort(col.key)"
              >
                <span>{{ col.label }}</span>
                <svg class="w-3 h-3" :class="getStockSortDirection(col.key) ? 'text-blue-600' : 'text-gray-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path v-if="getStockSortDirection(col.key) === 'asc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                  <path v-else-if="getStockSortDirection(col.key) === 'desc'" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l4-4 4 4M16 15l-4 4-4-4" />
                </svg>
              </button>
              <span v-else>{{ col.label }}</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-if="loading">
             <td :colspan="visibleColumns.length" class="px-6 py-4 text-center text-blue-500 font-medium">
                Cargando inventario...
             </td>
          </tr>
          <tr v-else-if="sortedFilteredData.length === 0">
            <td :colspan="visibleColumns.length" class="px-6 py-4 text-center text-gray-500 italic">
              No se encontraron resultados ({{ items.length > 0 ? 'ajusta los filtros' : 'Base de datos vacía o sin conexión' }}).
            </td>
          </tr>
          <tr v-else v-for="(item, index) in sortedFilteredData" :key="index" class="hover:bg-gray-50 transition-colors">
            <td 
              v-for="col in visibleColumns" 
              :key="col.key"
              class="px-4 py-2 text-sm text-gray-700 whitespace-nowrap"
              :class="getCellClass(item, col.key)"
            >
              <template v-if="col.key === 'CLASSIF'">
                {{ getCombinedClassif(item) || '-' }}
              </template>
              <template v-else>
                {{ formatValue(item[col.key], col.key) }}
              </template>
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
    </div>
    
    <div class="mt-4 text-sm text-gray-500 text-right">
      Mostrando {{ sortedFilteredData.length }} registros
    </div>
  </div>

  <!-- ── Modal: Detalle fardo a fardo por variable ────────────────────────── -->
  <Teleport to="body">
    <div v-if="mixDetailModal.visible"
         class="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-8 px-4 pb-4"
         @click.self="closeMixDetailModal">
      <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">

        <!-- Header del modal -->
        <div class="flex items-center gap-3 px-5 py-3 border-b bg-slate-50 flex-shrink-0">
          <span class="text-base font-bold text-slate-800">
            Detalle stock — {{ mixDetailVarItem?.label }}
          </span>
          <span v-if="mixDetailVarItem" class="text-xs px-2 py-0.5 rounded font-mono bg-slate-200 text-slate-700">
            Regla {{ mixDetailVarItem.tolLimitPct === 10 ? '90/10' : mixDetailVarItem.tolLimitPct === 20 ? '80/20' : (100-mixDetailVarItem.tolLimitPct)+'/'+mixDetailVarItem.tolLimitPct }}
          </span>
          <span v-if="mixDetailVarItem" class="text-xs text-slate-500">
            Tol. {{ mixDetailVarItem.tolMin }}–{{ mixDetailVarItem.tolMax }} ·
            Ideal ≥ {{ mixDetailVarItem.idealMin }}
          </span>
          <button @click="closeMixDetailModal"
                  class="ml-auto p-1 rounded hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Leyenda de zonas -->
        <div class="flex flex-wrap gap-3 px-5 py-2 border-b bg-white text-xs flex-shrink-0">
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-400"></span> Ideal
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-sky-200 border border-sky-400"></span> Sub-ideal (libre)
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-amber-200 border border-amber-400"></span> Tolerancia usada
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-orange-200 border border-orange-400"></span> Tolerancia sobrante
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 rounded-sm bg-gray-200 border border-gray-400"></span> Descartado / Sin dato
          </span>
        </div>

        <!-- Tabla -->
        <div class="overflow-auto flex-1">
          <table class="min-w-full text-xs">
            <thead class="sticky top-0 bg-slate-100 border-b border-slate-300 z-10">
              <tr>
                <th class="px-3 py-2 text-left font-semibold text-slate-700">#</th>
                <th class="px-3 py-2 text-left font-semibold text-slate-700">Proveedor</th>
                <th class="px-3 py-2 text-left font-semibold text-slate-700">Lote</th>
                <th class="px-3 py-2 text-right font-semibold text-slate-700">Saldo Disp.</th>
                <th class="px-3 py-2 text-right font-semibold text-emerald-800">Fardos Usados</th>
                <th class="px-3 py-2 text-right font-semibold text-red-800">Fardos No Usados</th>
                <th class="px-3 py-2 text-left font-semibold text-slate-700">Condición</th>
                <th class="px-3 py-2 text-left font-semibold text-slate-700">Motivo (no usado)</th>
                <th class="px-3 py-2 text-right font-semibold text-slate-700">{{ mixDetailVarItem?.label }}</th>
                <th class="px-3 py-2 text-right font-semibold text-slate-700">Peso Medio</th>
                <th class="px-3 py-2 text-right font-semibold text-emerald-800">Kg Usables</th>
                <th class="px-3 py-2 text-right font-semibold text-red-800">Kg No Usados</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <tr v-for="(row, idx) in mixDetailRows" :key="`mdr-${row.LOTE}-${idx}`"
                  :class="{
                    'bg-emerald-50/60': row.zona === 'Ideal',
                    'bg-sky-50/50':     row.zona === 'Sub-ideal',
                    'bg-amber-50/60':   row.zona === 'Tolerancia' && !row.noUsado,
                    'bg-orange-50/60':  row.zona === 'Tolerancia' && row.noUsado,
                    'bg-gray-100/70':   row.zona === 'Descartado' || row.zona === 'Sin dato',
                  }">
                <td class="px-3 py-1.5 text-slate-400">{{ idx + 1 }}</td>
                <td class="px-3 py-1.5 font-medium text-slate-800">{{ row.PRODUTOR }}</td>
                <td class="px-3 py-1.5 font-mono text-slate-700">{{ row.LOTE }}</td>
                <td class="px-3 py-1.5 text-right text-slate-700">{{ formatProjectionValue(row.SALDO_DISPONIVEL, 0) }}</td>
                <!-- Fardos usados -->
                <td class="px-3 py-1.5 text-right font-semibold"
                    :class="row.usadosF > 0 ? 'text-emerald-700' : 'text-gray-300'">
                  {{ row.usadosF > 0.005 ? formatProjectionValue(row.usadosF, 1) : '—' }}
                </td>
                <!-- Fardos no usados -->
                <td class="px-3 py-1.5 text-right font-semibold"
                    :class="row.sobranteF > 0.005 ? 'text-red-700' : 'text-gray-300'">
                  {{ row.sobranteF > 0.005 ? formatProjectionValue(row.sobranteF, 1) : '—' }}
                </td>
                <!-- Condición -->
                <td class="px-3 py-1.5">
                  <span class="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        :class="{
                          'bg-emerald-100 text-emerald-800': row.zona === 'Ideal',
                          'bg-sky-100 text-sky-800':         row.zona === 'Sub-ideal',
                          'bg-amber-100 text-amber-800':     row.zona === 'Tolerancia' && !row.noUsado,
                          'bg-orange-100 text-orange-800':   row.zona === 'Tolerancia' && row.noUsado,
                          'bg-gray-100 text-gray-500':       row.zona === 'Descartado' || row.zona === 'Sin dato',
                        }">
                    {{ row.condicion }}
                  </span>
                </td>
                <!-- Motivo -->
                <td class="px-3 py-1.5 text-slate-500 italic">{{ row.motivo || '—' }}</td>
                <!-- Valor HVI -->
                <td class="px-3 py-1.5 text-right font-mono font-semibold"
                    :class="{
                      'text-emerald-700': row.hvi !== null && row.hvi >= (mixDetailVarItem?.idealMin || 0),
                      'text-sky-700':     row.hvi !== null && row.hvi >= (mixDetailVarItem?.tolMax || 0) && row.hvi < (mixDetailVarItem?.idealMin || 0),
                      'text-amber-700':   row.hvi !== null && row.hvi >= (mixDetailVarItem?.tolMin || 0) && row.hvi < (mixDetailVarItem?.tolMax || 0),
                      'text-gray-400':    row.hvi === null || row.hvi < (mixDetailVarItem?.tolMin || 0),
                    }">
                  {{ row.hvi !== null ? formatProjectionValue(row.hvi, 2) : '—' }}
                </td>
                <!-- Peso Medio -->
                <td class="px-3 py-1.5 text-right text-slate-600">{{ formatProjectionValue(row.pesoMedio, 0) }}</td>
                <!-- Kg Usables -->
                <td class="px-3 py-1.5 text-right font-semibold"
                    :class="row.usadosKg > 0 ? 'text-emerald-700' : 'text-gray-300'">
                  {{ row.usadosKg > 0 ? formatThousandInteger(row.usadosKg) : '—' }}
                </td>
                <!-- Kg no usados -->
                <td class="px-3 py-1.5 text-right font-semibold"
                    :class="row.sobranteKg > 0 ? 'text-red-700' : 'text-gray-300'">
                  {{ row.sobranteKg > 0 ? formatThousandInteger(row.sobranteKg) : '—' }}
                </td>
              </tr>
            </tbody>

            <!-- Pie: totales y promedios ponderados -->
            <tfoot v-if="mixDetailSummary" class="border-t-2 border-slate-400 bg-slate-100 sticky bottom-0">
              <tr>
                <td colspan="3" class="px-3 py-2 font-semibold text-slate-700 text-xs">TOTAL / PROM. PONDERADO</td>
                <td class="px-3 py-2 text-right font-bold text-slate-800">{{ formatProjectionValue(remanenteMixingRuleAnalysis?.totalStockF, 0) }}</td>
                <td class="px-3 py-2 text-right font-bold text-emerald-800">{{ formatProjectionValue(mixDetailSummary.totalUsadosF, 1) }}</td>
                <td class="px-3 py-2 text-right font-bold text-red-800">{{ formatProjectionValue(mixDetailSummary.totalSobranteF, 1) }}</td>
                <td colspan="2" class="px-3 py-2"></td>
                <!-- Prom HVI usados -->
                <td class="px-3 py-2 text-right font-bold">
                  <div class="text-emerald-800">
                    {{ mixDetailSummary.avgHviUsados !== null ? formatProjectionValue(mixDetailSummary.avgHviUsados, 2) : '—' }}
                    <span class="text-[10px] font-normal text-slate-500"> usados</span>
                  </div>
                  <div class="text-orange-700" v-if="mixDetailSummary.avgHviSobrante !== null">
                    {{ formatProjectionValue(mixDetailSummary.avgHviSobrante, 2) }}
                    <span class="text-[10px] font-normal text-slate-500"> sobrantes</span>
                  </div>
                </td>
                <td class="px-3 py-2"></td>
                <td class="px-3 py-2 text-right font-bold text-emerald-800">{{ formatThousandInteger(mixDetailSummary.totalUsadosKg) }}</td>
                <td class="px-3 py-2 text-right font-bold text-red-800">{{ formatThousandInteger(mixDetailSummary.totalSobranteKg) }}</td>
              </tr>
              <!-- Señal de promedio vs objetivo -->
              <tr v-if="mixDetailVarItem" class="border-t border-slate-300">
                <td colspan="12" class="px-3 py-1.5 text-xs">
                  <span :class="mixDetailSummary.avgHviUsados !== null && mixDetailSummary.avgHviUsados >= mixDetailVarItem.idealMin ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'">
                    {{ mixDetailSummary.avgHviUsados !== null && mixDetailSummary.avgHviUsados >= mixDetailVarItem.idealMin
                      ? `✓ Promedio ${mixDetailVarItem.label} de los fardos usados (${formatProjectionValue(mixDetailSummary.avgHviUsados, 2)}) cumple el objetivo ≥ ${mixDetailVarItem.idealMin}`
                      : `⚠ Promedio ${mixDetailVarItem.label} de los fardos usados (${mixDetailSummary.avgHviUsados !== null ? formatProjectionValue(mixDetailSummary.avgHviUsados, 2) : '—'}) NO alcanza el objetivo ≥ ${mixDetailVarItem.idealMin}` }}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    </div>
  </Teleport>

  <!-- ── Modal: Simulación Plan de Mezclas ────────────────────────────────── -->
  <Teleport to="body">
    <div v-if="mixPlanModal.visible"
         class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
         @click.self="mixPlanModal.visible = false">
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden">

        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 bg-indigo-700 rounded-t-2xl shrink-0">
          <div>
            <h2 class="text-lg font-bold text-white">Plan de Mezclas Simulado — Stock + Compra</h2>
            <p class="text-xs text-indigo-200 mt-0.5">Sobrante disponible + camiones entrantes (asumidos zona ideal)</p>
          </div>
          <button @click="mixPlanModal.visible = false" class="text-indigo-200 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div class="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          <!-- Inputs -->
          <div class="flex flex-wrap items-end gap-4 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
            <div>
              <label class="block text-xs font-semibold text-indigo-700 mb-1">Camiones entrantes</label>
              <input v-model.number="mixPlanModal.trucks" type="number" min="0" max="99"
                     class="w-20 border border-indigo-300 rounded-md p-2 text-sm text-center font-bold focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-indigo-700 mb-1">Fardos por camión</label>
              <input v-model.number="mixPlanModal.balesPerTruck" type="number" min="1" max="999"
                     class="w-24 border border-indigo-300 rounded-md p-2 text-sm text-center font-bold focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div class="bg-white border border-indigo-200 rounded-md px-4 py-2">
              <p class="text-[10px] text-indigo-500 uppercase tracking-wide">Fardos entrantes</p>
              <p class="text-xl font-bold text-indigo-700">{{ formatThousandInteger((mixPlanModal.trucks||0)*(mixPlanModal.balesPerTruck||0)) }}</p>
            </div>
            <div class="bg-white border border-indigo-200 rounded-md px-4 py-2">
              <p class="text-[10px] text-indigo-500 uppercase tracking-wide">Fardos por mezcla</p>
              <p class="text-xl font-bold text-indigo-700">{{ filters.fardos || '—' }}</p>
            </div>
            <template v-if="mixPlanSimulation">
            <div class="bg-amber-50 border border-amber-300 rounded-md px-4 py-2" title="Límite máximo teórico según HVI (Sin compras). Es un número ideal matemático que no considera lotes fraccionados">
              <p class="text-[10px] text-amber-600 uppercase tracking-wide font-semibold">Max Teórico (Solo Stock)</p>
              <p class="text-xl font-bold text-amber-700">
                {{ mixPlanSimulation.finalMixesCurrent }}
                <span class="text-[11px] font-normal text-amber-500 ml-1 block" v-if="mixPlanSimulation.bindingVarCurrent">Límite por: {{ mixPlanSimulation.bindingVarCurrent }}</span>
              </p>
            </div>
            <div class="bg-emerald-50 border border-emerald-400 rounded-md px-4 py-2" title="Límite máximo teórico según HVI sumando las compras ideales. Sigue siendo un límite matemático sin considerar fracciones en la receta.">
              <p class="text-[10px] text-emerald-600 uppercase tracking-wide font-semibold">Max Teórico (+ Compras)</p>
              <p class="text-xl font-bold text-emerald-700">
                {{ mixPlanSimulation.finalMixesWithBuy }}
                <span class="text-[11px] font-normal text-emerald-500 ml-1 block" v-if="mixPlanSimulation.bindingVarWithBuy">Límite por: {{ mixPlanSimulation.bindingVarWithBuy }}</span>
              </p>
            </div>
            <div class="bg-indigo-600 border border-indigo-700 rounded-md px-4 py-2 shadow-md" title="Límite físico real calculando recetas perfectas sin fracciones, utilizando la metodología Golden Batch sobre Lotes físicos y macro-lotes agrupados.">
              <p class="text-[10px] text-indigo-200 uppercase tracking-wide font-bold">Bloque Logrado (Golden Batch)</p>
              <p class="text-2xl font-black text-white flex items-baseline gap-2">
                {{ mixPlanSimulation.N_identical }}
                <span class="text-xs font-medium text-indigo-300">recetas idénticas y exactas</span>
              </p>
            </div>
            </template>
          </div>

          <div v-if="!mixPlanSimulation" class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Configura fardos por mezcla y activa al menos una Regla de Mezclas para ver la simulación.
          </div>

                    <template v-else>
            <div class="overflow-x-auto mb-6 border border-slate-300 rounded-lg shadow-sm">
              <div class="bg-indigo-700 border-b border-indigo-800 px-4 py-3 flex justify-between items-center text-white rounded-t-lg">
                <h3 class="text-sm font-bold flex items-center gap-2">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  Proyección de Consumo - {{ mixPlanSimulation.N_identical }} mezclas idénticas (Bloque Stock + Compra)
                </h3>
              </div>
              <table class="min-w-full divide-y divide-gray-200 text-[11px] compact-plan-table">
                <thead class="bg-gray-100">
                  <tr>
                    <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Productor</th>
                    <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Lote</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Estado</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Stock</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Usados</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">Sobrante</th>
                    <th class="px-3 py-2 text-left font-bold text-gray-500 uppercase tracking-wider">Motivo Sobrante</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider border-l border-gray-300">MIC</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">STR</th>
                    <th class="px-3 py-2 text-center font-bold text-gray-500 uppercase tracking-wider">LEN</th>
                    <th class="px-3 py-2 text-center font-bold text-indigo-700 uppercase tracking-wider border-l border-gray-300 bg-indigo-50">
                      M1-M{{ mixPlanSimulation.N_identical }}
                    </th>
                    <th class="px-3 py-2 text-center font-bold text-teal-700 uppercase tracking-wider border-l border-gray-300 bg-teal-50">
                      Saldo
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <!-- Entrantes (Compras) -->
                  <tr v-for="(row, idx) in mixPlanSimulation.truckRows" :key="'tr-'+idx" class="hover:bg-gray-50 bg-emerald-50/20">
                    <td class="px-3 py-1.5 font-medium text-emerald-800">COMPRA</td>
                    <td class="px-3 py-1.5 text-slate-700">{{ row.LOTE }}</td>
                    <td class="px-3 py-1.5 text-center">
                      <span class="bg-green-100 text-green-800 px-1.5 py-0.5 rounded text-[10px] font-bold">USO</span>
                    </td>
                    <td class="px-3 py-1.5 text-center font-semibold text-slate-700">{{ row.stock }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700">{{ row.usados }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-amber-700">{{ row.sobrante }}</td>
                    <td class="px-3 py-1.5 text-slate-700">
                      <span class="font-medium text-slate-700">{{ row.motivo }}</span>
                    </td>
                    <td class="px-3 py-1.5 text-center font-semibold text-emerald-800 border-l border-gray-200">{{ row.MIC !== null ? formatProjectionValue(row.MIC, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center font-semibold text-emerald-800">{{ row.STR !== null ? formatProjectionValue(row.STR, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center font-semibold text-emerald-800">{{ row.UHML !== null ? formatProjectionValue(row.UHML, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-indigo-700 bg-indigo-50/50 border-l border-gray-200">
                      {{ row.recipe }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-teal-700 bg-teal-50/30 border-l border-gray-200">
                      {{ row.sobrante }}
                    </td>
                  </tr>
                  
                  <!-- Stock Existente -->
                  <tr v-for="(row, idx) in mixPlanSimulation.lotRows" :key="'lot-'+idx" class="hover:bg-gray-50">
                    <td class="px-3 py-1.5 font-medium text-gray-900">{{ row.PRODUTOR }}</td>
                    <td class="px-3 py-1.5 text-gray-600">{{ row.isFicticio ? row.comboName : row.LOTE }}</td>
                    <td class="px-3 py-1.5 text-center">
                      <span :class="row.estado === 'USO' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'" class="px-1.5 py-0.5 rounded text-[10px] font-bold">
                        {{ row.estado }}
                      </span>
                    </td>
                    <td class="px-3 py-1.5 text-center font-semibold text-slate-700">{{ row.stock }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700">{{ row.usados || '-' }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-amber-700">{{ row.sobrante }}</td>
                    <td class="px-3 py-1.5">
                      <span v-if="row.isBottleneck" class="font-bold text-red-600 ml-1">* Solo se usa {{ row.recipe }} por mezcla (BOTTLENECK)</span>
                      <span v-else-if="row.sobrante === 0" class="font-semibold text-emerald-700">{{ row.motivo }}</span>
                      <span v-else class="font-medium text-slate-700">{{ row.motivo }}</span>
                    </td>
                    <td class="px-3 py-1.5 text-center border-l border-gray-200">{{ row.MIC !== null ? formatProjectionValue(row.MIC, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center">{{ row.STR !== null ? formatProjectionValue(row.STR, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center">{{ row.UHML !== null ? formatProjectionValue(row.UHML, 2) : '—' }}</td>
                    <td class="px-3 py-1.5 text-center font-bold border-l border-gray-200" :class="row.recipe ? 'text-indigo-700 bg-indigo-50/50' : 'text-gray-300'">
                      {{ row.recipe || '-' }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-teal-700 bg-teal-50/30 border-l border-gray-200">
                      {{ row.sobrante }}
                    </td>
                  </tr>
                </tbody>

                <tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">
                  <tr class="summary-matrix-row">
                    <td colspan="3" class="px-3 py-1.5 font-bold text-right text-gray-700 border-b border-gray-300">TOTALES LOTES</td>
                    <td class="px-3 py-1.5 text-center font-bold text-slate-800 border-b border-gray-300">
                      {{ formatThousandInteger(mixPlanSimulation.lotRows.reduce((a,b)=>a+b.stock,0) + mixPlanSimulation.truckRows.reduce((a,b)=>a+b.stock,0)) }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700 border-b border-gray-300">
                      {{ formatThousandInteger(mixPlanSimulation.lotRows.reduce((a,b)=>a+b.usados,0) + mixPlanSimulation.truckRows.reduce((a,b)=>a+b.usados,0)) }}
                    </td>
                    <td class="px-3 py-1.5 text-center font-bold text-amber-700 border-b border-gray-300">
                      {{ formatThousandInteger(mixPlanSimulation.lotRows.reduce((a,b)=>a+b.sobrante,0) + mixPlanSimulation.truckRows.reduce((a,b)=>a+b.sobrante,0)) }}
                    </td>
                    <td class="px-3 py-1.5 text-center text-gray-400 border-b border-gray-300">—</td>
                    <td colspan="3" rowspan="4" class="px-3 py-1.5 text-center font-bold text-gray-800 border-b border-gray-300 align-top pt-4">Mezcla</td>
                    <td rowspan="2" class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 bg-white">Cantidad</td>
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 bg-white">Fardos</td>
                  </tr>
                  
                  <tr class="summary-matrix-row border-b border-gray-300 bg-white">
                    <td colspan="7" rowspan="30" class="px-3 py-1.5 align-top border-r border-gray-300 bg-gray-50 p-4">
                       <div class="border border-slate-300 rounded-md overflow-hidden bg-white mb-2 shadow-sm w-[400px]">
                        <div class="px-3 py-2 bg-slate-50 border-b border-slate-300 flex items-center justify-between">
                          <h3 class="text-[12px] font-bold text-slate-800">Resumen de lotes (promedios de variables activas)</h3>
                          <span class="text-[10px] text-slate-500 font-mono ml-4">Calculado con recom. min compras</span>
                        </div>
                        <table class="w-full">
                          <thead class="bg-gray-100">
                            <tr class="border-b border-gray-300">
                              <th class="px-3 py-1.5 text-left text-[11px] font-semibold text-gray-600 uppercase">Variable</th>
                              <th class="px-3 py-1.5 text-center text-[11px] font-semibold text-indigo-700 uppercase border-l border-gray-200">
                                M1-M{{ mixPlanSimulation.N_identical }}
                              </th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-gray-200 text-[11px]">
                            <template v-for="v in mixPlanSimulation.varResults" :key="'res-'+v.label">
                              <!-- Variable header & Promedio -->
                              <tr class="bg-slate-100/50">
                                <td class="px-3 py-1.5 font-bold text-slate-800">
                                  {{ v.label }}
                                  <span class="text-gray-500 font-normal ml-1 whitespace-nowrap">[{{ v.idealMin }} - {{ v.tolMin }}]</span>
                                </td>
                                <td class="px-3 py-1.5 border-l border-gray-200"></td>
                              </tr>
                              <tr>
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Promedio Bloque</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200 text-[12px]" 
                                  :class="v.promedioGeneral >= v.idealMin ? 'text-emerald-700 font-bold' : (v.promedioGeneral >= v.tolMin ? 'text-amber-600 font-bold' : 'text-red-600 font-bold')">
                                  {{ formatProjectionValue(v.promedioGeneral, 2) }}
                                </td>
                              </tr>
                              <tr>
                                <td class="px-3 py-1.5 pl-6 text-gray-600">Ideal ({{ v.pctIdeal.toFixed(1) }}%)</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200">
                                  {{ formatProjectionValue(v.promedioIdeal, 2) }}
                                </td>
                              </tr>
                              <tr>
                                <td class="px-3 py-1.5 pl-6 text-gray-600">Tolerancia ({{ v.pctTolerancia.toFixed(1) }}%)</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200">
                                  {{ formatProjectionValue(v.promedioTolerancia, 2) }}
                                </td>
                              </tr>
                              <tr class="bg-gray-50 border-t border-gray-100">
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Composición Real Ideal</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200" :class="v.pctIdeal >= parseFloat(v.pctIdeal) ? 'text-emerald-600 font-bold' : 'text-red-500'">
                                  {{ v.pctIdeal.toFixed(1) }}%
                                </td>
                              </tr>
                              <tr class="bg-gray-50 border-b-2 border-gray-200">
                                <td class="px-3 py-1.5 pl-6 font-semibold text-gray-700">Composición Real Tol.</td>
                                <td class="px-3 py-1.5 text-center font-mono border-l border-gray-200" :class="v.pctTolerancia <= v.tolLimitPct ? 'text-emerald-600 font-bold' : 'text-red-500'">
                                  {{ v.pctTolerancia.toFixed(1) }}%
                                </td>
                              </tr>
                            </template>
                          </tbody>
                        </table>
                        <div class="mx-2 mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-[10px] text-slate-700 leading-relaxed">
                          <div class="mb-1 flex items-start justify-between gap-2">
                            <div class="flex items-center gap-2 flex-wrap">
                              <p class="font-semibold text-slate-800">{{ predictiveFiberAnalysis.title }}</p>
                              <span v-if="predictiveFiberAnalysis.available" class="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold" :class="predictiveFiberAnalysis.badgeClass">
                                {{ predictiveFiberAnalysis.badgeLabel }}
                              </span>
                            </div>
                            <button
                              type="button"
                              @click="copyPredictiveWhatsappMessage"
                              class="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors whitespace-nowrap"
                              :class="predictiveCopyState === 'success'
                                ? 'border-emerald-400 bg-emerald-100 text-emerald-700'
                                : (predictiveCopyState === 'error'
                                  ? 'border-rose-300 bg-rose-50 text-rose-700'
                                  : 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100')"
                            >
                              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
                                <path d="M20.52 3.48A11.91 11.91 0 0 0 12.04 0C5.5 0 .16 5.33.16 11.88c0 2.1.55 4.15 1.6 5.95L0 24l6.33-1.66a11.87 11.87 0 0 0 5.7 1.45h.01c6.54 0 11.88-5.33 11.88-11.88 0-3.18-1.24-6.17-3.4-8.43Zm-8.48 18.3h-.01a9.87 9.87 0 0 1-5.02-1.37l-.36-.22-3.76.99 1-3.67-.24-.38a9.85 9.85 0 0 1-1.5-5.25C2.15 6.45 6.58 2 12.04 2a9.84 9.84 0 0 1 7 2.9 9.84 9.84 0 0 1 2.88 6.99c0 5.45-4.44 9.89-9.88 9.89Zm5.42-7.42c-.3-.15-1.77-.87-2.04-.96-.27-.1-.47-.15-.66.15-.2.3-.76.96-.93 1.16-.17.2-.34.23-.63.08-.3-.15-1.24-.46-2.37-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.5.15-.17.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.66-1.6-.9-2.18-.24-.57-.48-.5-.66-.5h-.56c-.2 0-.53.08-.8.38-.27.3-1.04 1.01-1.04 2.46s1.06 2.86 1.2 3.05c.15.2 2.08 3.17 5.03 4.45.7.3 1.25.49 1.68.63.7.22 1.34.19 1.84.12.56-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.27-.2-.56-.35Z"/>
                              </svg>
                              <span>Copiar mensaje</span>
                            </button>
                          </div>
                          <p class="text-[10px] text-slate-600 mb-1">{{ predictiveFiberAnalysis.subtitle }}</p>
                          <template v-if="predictiveFiberAnalysis.available">
                            <p class="font-semibold" :class="predictiveFiberAnalysis.verdictTextClass">{{ predictiveFiberAnalysis.conclusionHeading }}</p>
                            <p class="text-slate-700">{{ predictiveFiberAnalysis.conclusionBody }}</p>
                            <p class="mt-1 font-semibold text-slate-800">📊 COMPARATIVA TÉCNICA (Promedios):</p>
                            <div v-for="(section, sectionIndex) in predictiveFiberAnalysis.sections" :key="`pf-sim-sec-${sectionIndex}`" class="mt-1 rounded border border-white/60 bg-white/70 px-2 py-1">
                              <p class="font-semibold text-slate-800">{{ section.title }}</p>
                              <p v-for="(bullet, bulletIndex) in section.bullets" :key="`pf-sim-bul-${sectionIndex}-${bulletIndex}`" class="text-slate-700">• {{ bullet }}</p>
                            </div>
                            <p class="mt-1 font-semibold text-slate-800">{{ predictiveFiberAnalysis.efficiencyHeading }}</p>
                            <p class="font-semibold" :class="predictiveFiberAnalysis.verdictTextClass">{{ predictiveFiberAnalysis.efficiencyBody }}</p>
                          </template>
                          <p v-else class="text-slate-500">No hay datos suficientes para emitir predicción técnica.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  <tr class="summary-matrix-row bg-white">
                    <td class="px-3 py-1.5 text-center font-bold text-gray-800 border-r border-gray-200">M1-M{{ mixPlanSimulation.N_identical }}</td>
                    <td class="px-3 py-1.5 text-center font-bold text-gray-900">{{ mixPlanSimulation.fardosPorMezcla * mixPlanSimulation.N_identical }}</td>
                  </tr>
                  
                  <tr class="summary-matrix-row border-b border-gray-300 bg-white">
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-white">Bloques</td>
                    <td class="px-3 py-1.5 text-center font-bold text-slate-800 border-l border-gray-200">{{ mixPlanSimulation.N_identical }}</td>
                  </tr>

                  <tr class="summary-matrix-row">
                    <td rowspan="2" class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 border-r border-gray-200 bg-white">Peso</td>
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-b border-gray-300 bg-white">Por Mezcla</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-700 border-l border-gray-200">{{ formatThousandInteger(mixPlanSimulation.totalPesoMezcla) }} kg</td>
                  </tr>
                  
                  <tr class="summary-matrix-row border-b border-gray-300">
                    <td class="px-3 py-1.5 text-center font-semibold text-gray-700 border-r border-gray-200 bg-white">Por Bloque</td>
                    <td class="px-3 py-1.5 text-center font-bold text-blue-800 border-l border-gray-200">{{ formatThousandInteger(mixPlanSimulation.totalPesoMezcla * mixPlanSimulation.N_identical) }} kg</td>
                  </tr>
                  
                  <tr class="summary-matrix-row">
                    <td colspan="5" class="px-3 py-1.5 text-[11px] text-slate-500 italic bg-gray-50 border-r border-gray-200">
                       * Redondeo Inteligente orientado al Cuello de Botella ("Bottleneck-Aware Largest Remainder"). Se asigna recomendación mínima de compras HVI a camiones entrantes p/simulación.
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </template>
        </div>

        <!-- Footer -->
        <div class="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end rounded-b-2xl shrink-0">
          <button @click="mixPlanModal.visible = false"
                  class="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-300 transition-colors">
            Cerrar
          </button>
        </div>

      </div>
    </div>
  </Teleport>

</template>

<script setup>
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
import { CottonBale } from '../../models/CottonBale';
import ExcelJS from 'exceljs';

// --- Configuración de Columnas ---
const allColumns = [
  { key: 'PRODUTOR', label: 'Productor', locked: true, default: true },
  { key: 'LOTE', label: 'Lote', locked: true, default: true },
  { key: 'TAM', label: 'Tam', default: true },
  { key: 'DESTINO', label: 'Destino', default: true },
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
const showOnlyLargestBlendBlock = ref(false);
const loteFiacReferenceSummary = ref([]);
const isCalculatingBlend = ref(false);
const blendUserMessage = ref(null);
const appliedRulesSummary = ref([]);
const appliedAlgorithmLabel = ref('');
const appliedCalculationTimestamp = ref('');
const purchaseProjection = reactive({
  targetMixes: 20,
  source: 'stock',
  minMixesForBlock: 20
});

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

const USER_PREFS_KEY = 'inventoryManagerUserPrefs_v1';

const filters = reactive({
  stockMode: 'available',
  groupSmallLots: false,
  smallLotThreshold: 20,
  searchText: '',
  fardos: null
});

const stockSortState = reactive({ key: 'PRODUTOR', direction: 'asc' });
const blendSortState = reactive({ key: 'PRODUTOR', direction: 'asc' });

const STOCK_SORTABLE_KEYS = new Set([
  'PRODUTOR', 'LOTE', 'TAM', 'CLASSIF', 'COR', 'QTDE_ESTOQUE', 'MIC', 'UHML', 'STR', 'PESO'
]);

const BLEND_SORTABLE_KEYS = new Set([
  'PRODUTOR', 'LOTE', 'TAM', 'CLASSIF', 'Stock', 'Usados', 'Sobrante', 'MotivoLogistico', 'MIC', 'STR', 'LEN', 'ELG', 'PESO'
]);

// 'standard' | 'stability' | 'stability-strict'
const blendAlgorithm = ref('stability');
const algorithmTooltipVisible = ref(false);
const algorithmOptionTooltipVisible = ref(false);
const algorithmOptionTooltipKey = ref(null);

const algorithmTooltipByOption = {
  standard: {
    title: 'Estándar (Round Robin)',
    badge: 'Secuencial',
    badgeClass: 'bg-slate-100 text-slate-700',
    description: 'Arma la mezcla en rondas entre lotes disponibles para completar rápido la receta y mantener consumo equilibrado.',
    example: 'Si pides 20 fardos y tienes 4 lotes compatibles, reparte en turnos (1-1-1-1...) hasta completar 20.'
  },
  stability: {
    title: 'Golden Batch',
    badge: 'Máx. N',
    badgeClass: 'bg-blue-100 text-blue-700',
    description: 'Prioriza repetir la misma receta por más corridas (N alto) para estabilizar proceso y reducir variación entre mezclas consecutivas.',
    example: 'Si la mejor receta permite 12 corridas iguales, genera ese bloque primero y luego recalcula con el stock remanente.'
  },
  'stability-strict': {
    title: 'GB + Norma',
    badge: 'Norma activa',
    badgeClass: 'bg-indigo-100 text-indigo-700',
    description: 'Mantiene la lógica Golden Batch pero obliga el cumplimiento de cupo de tolerancia de calidad en cada receta.',
    example: 'Si la receta ideal supera el % permitido de lotes en tolerancia, recorta ese cupo y reduce N para cumplir norma.'
  }
};

const currentAlgorithmOptionTooltip = computed(() => {
  if (!algorithmOptionTooltipKey.value) return null;
  return algorithmTooltipByOption[algorithmOptionTooltipKey.value] || null;
});

const showAlgorithmOptionTooltip = (key) => {
  algorithmOptionTooltipKey.value = key;
  algorithmOptionTooltipVisible.value = true;
};

const hideAlgorithmOptionTooltip = () => {
  algorithmOptionTooltipVisible.value = false;
};

const saveUserPreferences = () => {
  try {
    const prefs = {
      fardos: filters.fardos,
      groupSmallLots: !!filters.groupSmallLots,
      smallLotThreshold: filters.smallLotThreshold,
      showOnlyLargestBlendBlock: !!showOnlyLargestBlendBlock.value,
      blendAlgorithm: blendAlgorithm.value,
      purchaseProjectionTargetMixes: purchaseProjection.targetMixes,
      purchaseProjectionSource: purchaseProjection.source,
      selectedColumns: Array.from(selectedColumnKeys.value),
      supervisionSettings: monitoredParams.reduce((acc, p) => {
        const current = supervisionSettings[p.key] || {};
        acc[p.key] = {
          target: !!current.target,
          hardCap: !!current.hardCap,
          tolerance: !!current.tolerance
        };
        return acc;
      }, {})
    };

    localStorage.setItem(USER_PREFS_KEY, JSON.stringify(prefs));
  } catch (error) {
    console.warn('No se pudo guardar preferencias de InventoryManager:', error);
  }
};

const loadUserPreferences = () => {
  try {
    const raw = localStorage.getItem(USER_PREFS_KEY);
    if (!raw) return;

    const prefs = JSON.parse(raw);
    if (!prefs || typeof prefs !== 'object') return;

    if (prefs.fardos === null || prefs.fardos === '' || prefs.fardos === undefined) {
      filters.fardos = null;
    } else {
      const parsedFardos = Number(prefs.fardos);
      if (!Number.isNaN(parsedFardos) && parsedFardos > 0) {
        filters.fardos = parsedFardos;
      }
    }

    if (typeof prefs.groupSmallLots === 'boolean') {
      filters.groupSmallLots = prefs.groupSmallLots;
    }

    if (prefs.smallLotThreshold !== null && prefs.smallLotThreshold !== undefined && prefs.smallLotThreshold !== '') {
      const parsedSmallLotThreshold = Number(prefs.smallLotThreshold);
      if (!Number.isNaN(parsedSmallLotThreshold) && parsedSmallLotThreshold > 0) {
        filters.smallLotThreshold = Math.floor(parsedSmallLotThreshold);
      }
    }

    if (typeof prefs.showOnlyLargestBlendBlock === 'boolean') {
      showOnlyLargestBlendBlock.value = prefs.showOnlyLargestBlendBlock;
    }

    const allowedAlgorithms = ['standard', 'stability', 'stability-strict'];
    if (allowedAlgorithms.includes(prefs.blendAlgorithm)) {
      blendAlgorithm.value = prefs.blendAlgorithm;
    }

    const parsedTargetMixes = Number(prefs.purchaseProjectionTargetMixes);
    if (!Number.isNaN(parsedTargetMixes) && parsedTargetMixes > 0) {
      purchaseProjection.targetMixes = Math.floor(parsedTargetMixes);
    }

    if (prefs.purchaseProjectionSource === 'stock' || prefs.purchaseProjectionSource === 'remanente') {
      purchaseProjection.source = prefs.purchaseProjectionSource;
    }

    if (Array.isArray(prefs.selectedColumns)) {
      const validColumns = new Set(allColumns.map(c => c.key));
      const lockedColumns = allColumns.filter(c => c.locked).map(c => c.key);

      const restored = prefs.selectedColumns.filter(key => validColumns.has(key));
      lockedColumns.forEach(key => {
        if (!restored.includes(key)) restored.push(key);
      });
      if (validColumns.has('TAM') && !restored.includes('TAM')) {
        restored.push('TAM');
      }

      selectedColumnKeys.value = new Set(restored);
    }

    if (prefs.supervisionSettings && typeof prefs.supervisionSettings === 'object') {
      monitoredParams.forEach(({ key }) => {
        const restored = prefs.supervisionSettings[key];
        if (!restored || typeof restored !== 'object') return;

        supervisionSettings[key].target = !!restored.target;
        supervisionSettings[key].hardCap = !!restored.hardCap;
        supervisionSettings[key].tolerance = !!restored.tolerance;
      });
    }
  } catch (error) {
    console.warn('No se pudo cargar preferencias de InventoryManager:', error);
  }
};

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

const getSummaryCellClass = (value, ruleUiKey, valueType = 'value') => {
  const settings = supervisionSettings[ruleUiKey];
  if (!settings) return 'text-gray-600';

  const rule = getRuleFor(ruleUiKey);
  if (!rule) return 'text-gray-600';

  const num = Number(value);
  if (Number.isNaN(num)) return 'text-gray-600';

  if (valueType === 'pctIdeal') {
    if (settings.target) {
      const minIdealPct = Number(rule.porcentaje_min_ideal);
      if (!Number.isNaN(minIdealPct) && num >= minIdealPct) return 'text-green-700 font-semibold';
      return 'text-red-700 font-semibold';
    }
    return 'text-gray-600';
  }

  if (valueType === 'pctTolerancia') {
    if (settings.tolerance) {
      const minIdealPct = Number(rule.porcentaje_min_ideal);
      if (!Number.isNaN(minIdealPct)) {
        const maxTolPct = 100 - minIdealPct;
        if (num <= maxTolPct) return 'text-yellow-700 font-semibold';
        return 'text-red-700 font-semibold';
      }
      return 'text-yellow-700 font-semibold';
    }
    return 'text-gray-600';
  }

  if (settings.hardCap) {
    const absMin = Number(rule.limite_min_absoluto);
    const absMax = Number(rule.limite_max_absoluto);
    if ((!Number.isNaN(absMin) && num < absMin) || (!Number.isNaN(absMax) && num > absMax)) {
      return 'text-red-700 font-semibold';
    }
  }

  if (settings.target) {
    const idealMin = Number(rule.valor_ideal_min);
    const targetMax = Number(rule.promedio_objetivo_max);

    if (ruleUiKey === 'PLUS_B') {
      if (!Number.isNaN(targetMax) && num <= targetMax) return 'text-green-700 font-semibold';
    } else if (ruleUiKey === 'MIC') {
      if (!Number.isNaN(idealMin) && num >= idealMin) return 'text-green-700 font-semibold';
    } else {
      if (!Number.isNaN(idealMin) && num >= idealMin) return 'text-green-700 font-semibold';
    }
  }

  if (settings.tolerance) {
    const tolMin = Number(rule.rango_tol_min);
    const tolMax = Number(rule.rango_tol_max);
    if (!Number.isNaN(tolMin) && !Number.isNaN(tolMax) && num >= tolMin && num <= tolMax) {
      return 'text-yellow-700 font-semibold';
    }
  }

  return 'text-gray-600';
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

  const rawVal = item[colKey] ?? (colKey === 'UHML' ? item.LEN : undefined);
  const val = Number(rawVal);
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
      items.value = data.map(row => {
        const item = new CottonBale(row);
        // Guardar stock original para alternar modos
        item._QTDE_TOTAL = item.QTDE_ESTOQUE;
        return item;
      });
  } catch (error) {
    console.error(error);
    alert('No se pudieron cargar los datos del inventario. Verifica que el servidor esté corriendo.');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadUserPreferences();

  fetchStandards().then(() => {
    fetchData(); 
  });
});

let autoBlendRecalcTimeout = null;

const scheduleBlendRecalculation = () => {
  if (!isBlendMode.value) return;

  if (autoBlendRecalcTimeout) {
    clearTimeout(autoBlendRecalcTimeout);
  }

  autoBlendRecalcTimeout = setTimeout(() => {
    if (!isBlendMode.value || isCalculatingBlend.value) return;
    handleMezclas({ silent: true });
  }, 300);
};

watch(() => filters.fardos, () => {
  saveUserPreferences();
  scheduleBlendRecalculation();
});

watch(blendAlgorithm, () => {
  saveUserPreferences();
  scheduleBlendRecalculation();
});

watch(selectedColumnKeys, () => {
  saveUserPreferences();
  scheduleBlendRecalculation();
}, { deep: true });

watch(supervisionSettings, () => {
  saveUserPreferences();
  scheduleBlendRecalculation();
}, { deep: true });

watch(() => filters.groupSmallLots, () => {
  saveUserPreferences();
  scheduleBlendRecalculation();
});

watch(() => filters.smallLotThreshold, () => {
  saveUserPreferences();
  if (!filters.groupSmallLots) return;
  scheduleBlendRecalculation();
});

watch(showOnlyLargestBlendBlock, () => {
  saveUserPreferences();
});

watch(() => purchaseProjection.targetMixes, (value) => {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue) || numericValue <= 0) return;

  const rounded = Math.floor(numericValue);
  if (rounded !== purchaseProjection.targetMixes) {
    purchaseProjection.targetMixes = rounded;
    return;
  }

  saveUserPreferences();
});

watch(() => purchaseProjection.source, () => {
  saveUserPreferences();
});

onBeforeUnmount(() => {
  if (autoBlendRecalcTimeout) {
    clearTimeout(autoBlendRecalcTimeout);
    autoBlendRecalcTimeout = null;
  }

  if (predictiveCopyTimer) {
    clearTimeout(predictiveCopyTimer);
    predictiveCopyTimer = null;
  }
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

const mapUiKeyToRuleParam = (uiKey) => {
  if (uiKey === 'UHML') return 'LEN';
  if (uiKey === 'PLUS_B') return '+b';
  return uiKey;
};

const mapUiKeyToFormatKey = (uiKey) => {
  if (uiKey === 'UHML') return 'UHML';
  if (uiKey === 'PLUS_B') return 'PLUS_B';
  return uiKey;
};

const getPlanMotivoLogistico = (row, sobranteOverride = null) => {
  if (!row) return '';
  const hasOverride = sobranteOverride !== null && sobranteOverride !== undefined;
  const sobrante = hasOverride ? Number(sobranteOverride) : Number(row.Sobrante);

  if (!hasOverride && row.MotivoLogistico) return row.MotivoLogistico;
  if (sobrante === 0) return 'Usado en plan (se usó todo)';
  if (row.Estado === 'TOLER.') return 'Usado en plan (tolerancia permitida)';
  if (row.Estado === 'NO USO') return 'No usado en ninguna mezcla';
  if (row.Estado === 'RECH.') return 'Rechazado por límites absolutos';
  return 'Usado en plan (consumo parcial)';
};

const normalizeSortText = (value) => (value ?? '').toString().trim();

const getCombinedClassif = (row) => {
  const tipo = normalizeSortText(row?.TP);
  const classif = normalizeSortText(row?.CLASSIF);

  if (!classif || classif === '0') return tipo;
  if (!tipo) return classif;
  return `${tipo} ${classif}`;
};

const getSortableValue = (row, key) => {
  if (!row || !key) return '';

  if (typeof key === 'string' && key.startsWith('MEZCLA::')) {
    const mixColumn = key.replace('MEZCLA::', '');
    return Number(row?.mezclas?.[mixColumn]) || 0;
  }

  if (key === 'Usados') return getRowUsedForVisibleBlocks(row);
  if (key === 'Sobrante') return getRowSobranteForVisibleBlocks(row);

  if (key === 'MotivoLogistico') return getPlanMotivoLogistico(row);
  if (key === 'CLASSIF') return getCombinedClassif(row);

  if (key === 'UHML') return row.UHML ?? row.LEN ?? '';
  if (key === 'LEN') return row.LEN ?? row.UHML ?? '';

  return row[key] ?? '';
};

const NUMERIC_SORT_KEYS = new Set([
  'QTDE_ESTOQUE',
  'Stock',
  'Usados',
  'Sobrante',
  'MIC',
  'UHML',
  'LEN',
  'ELG',
  'STR',
  'PESO'
]);

const compareByKeyAsc = (a, b, key) => {
  const valueA = getSortableValue(a, key);
  const valueB = getSortableValue(b, key);

  if (NUMERIC_SORT_KEYS.has(key)) {
    const numA = Number(valueA);
    const numB = Number(valueB);

    const validA = !Number.isNaN(numA);
    const validB = !Number.isNaN(numB);

    if (validA && validB && numA !== numB) return numA - numB;
    if (validA !== validB) return validA ? -1 : 1;
  }

  return normalizeSortText(valueA).localeCompare(normalizeSortText(valueB), 'es', {
    sensitivity: 'base',
    numeric: true
  });
};

const compareByProducerThenLot = (a, b) => {
  const producerA = normalizeSortText(a?.PRODUTOR);
  const producerB = normalizeSortText(b?.PRODUTOR);

  const producerCompare = producerA.localeCompare(producerB, 'es', {
    sensitivity: 'base',
    numeric: true
  });

  if (producerCompare !== 0) return producerCompare;

  const lotA = normalizeSortText(a?.LOTE);
  const lotB = normalizeSortText(b?.LOTE);

  return lotA.localeCompare(lotB, 'es', {
    sensitivity: 'base',
    numeric: true
  });
};

const cycleSortState = (state, key) => {
  if (state.key !== key) {
    state.key = key;
    state.direction = 'asc';
    return;
  }

  if (state.direction === 'asc') {
    state.direction = 'desc';
    return;
  }

  if (state.direction === 'desc') {
    state.key = null;
    state.direction = null;
    return;
  }

  state.key = key;
  state.direction = 'asc';
};

const isStockSortableColumn = (key) => STOCK_SORTABLE_KEYS.has(key);
const isBlendSortableColumn = (key) => BLEND_SORTABLE_KEYS.has(key) || (typeof key === 'string' && key.startsWith('MEZCLA::'));

const toggleStockSort = (key) => {
  if (!isStockSortableColumn(key)) return;
  cycleSortState(stockSortState, key);
};

const toggleBlendSort = (key) => {
  if (!isBlendSortableColumn(key)) return;
  cycleSortState(blendSortState, key);
};

const getStockSortDirection = (key) => (stockSortState.key === key ? stockSortState.direction : null);
const getBlendSortDirection = (key) => (blendSortState.key === key ? blendSortState.direction : null);

const sortRowsByState = (rows, sortState) => {
  if (!sortState.key || !sortState.direction) return [...rows];

  const directionFactor = sortState.direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const bySelected = compareByKeyAsc(a, b, sortState.key);
    if (bySelected !== 0) return bySelected * directionFactor;

    const byDefault = compareByProducerThenLot(a, b);
    if (byDefault !== 0) return byDefault * directionFactor;

    return 0;
  });
};

const getMixesFromBlockId = (blockId) => {
  if (!blockId || typeof blockId !== 'string') return 1;

  const singleMatch = blockId.match(/^M(\d+)$/);
  if (singleMatch) return 1;

  const rangeMatch = blockId.match(/^M(\d+)-M(\d+)$/);
  if (!rangeMatch) return 1;

  const start = Number(rangeMatch[1]);
  const end = Number(rangeMatch[2]);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;

  return end - start + 1;
};

const buildProducerLotKey = (row) => {
  const producer = normalizeSortText(row?.PRODUTOR);
  const lot = normalizeSortText(row?.LOTE);
  return `${producer}||${lot}`;
};

const normalizeTamValue = (value) => String(value ?? '').trim();
const normalizeClassifValue = (value) => String(value ?? '').trim();

const enrichBlendResultWithTam = (result) => {
  if (!result || typeof result !== 'object') return result;

  const detailsByKey = new Map();
  const candidates = [
    ...(Array.isArray(sortedFilteredData.value) ? sortedFilteredData.value : []),
    ...(Array.isArray(filteredData.value) ? filteredData.value : []),
    ...(Array.isArray(items.value) ? items.value : [])
  ];

  candidates.forEach((row) => {
    const key = buildProducerLotKey(row);
    if (!key) return;

    const tam = normalizeTamValue(row?.TAM);
    const classif = normalizeClassifValue(row?.CLASSIF);
    const tp = normalizeSortText(row?.TP);

    const current = detailsByKey.get(key) || {};
    if (tam && !current.TAM) current.TAM = tam;
    if (classif && !current.CLASSIF) current.CLASSIF = classif;
    if (tp && !current.TP) current.TP = tp;

    detailsByKey.set(key, current);
  });

  const hydrateRows = (rows) => {
    if (!Array.isArray(rows)) return rows;
    return rows.map((row) => {
      const currentTam = normalizeTamValue(row?.TAM);
      const currentClassif = normalizeClassifValue(row?.CLASSIF);
      const currentTp = normalizeSortText(row?.TP);

      const recovered = detailsByKey.get(buildProducerLotKey(row));
      if (!recovered) return row;
      if (currentTam && currentClassif && currentTp) return row;

      return {
        ...row,
        TAM: currentTam || recovered.TAM || row?.TAM,
        CLASSIF: currentClassif || recovered.CLASSIF || row?.CLASSIF,
        TP: currentTp || recovered.TP || row?.TP
      };
    });
  };

  return {
    ...result,
    plan: hydrateRows(result.plan),
    remanentes: hydrateRows(result.remanentes)
  };
};

const getBlockMixCount = (colId) => {
  const fromStats = Number(blendPlan.value?.estadisticas?.[colId]?.mezclasBloque);
  if (!Number.isNaN(fromStats) && fromStats > 0) return fromStats;
  return getMixesFromBlockId(colId);
};

const primaryBlendBlockId = computed(() => {
  const blocks = blendPlan.value?.columnasMezcla || [];
  if (!Array.isArray(blocks) || blocks.length === 0) return null;

  let bestBlock = blocks[0];
  let bestCount = getBlockMixCount(bestBlock);

  for (let index = 1; index < blocks.length; index += 1) {
    const blockId = blocks[index];
    const blockCount = getBlockMixCount(blockId);
    if (blockCount > bestCount) {
      bestBlock = blockId;
      bestCount = blockCount;
    }
  }

  return bestBlock;
});

const activeBlendColumns = computed(() => {
  const blocks = blendPlan.value?.columnasMezcla || [];
  if (!Array.isArray(blocks) || blocks.length === 0) return [];
  if (!showOnlyLargestBlendBlock.value) return blocks;

  const primaryBlock = primaryBlendBlockId.value;
  return primaryBlock ? [primaryBlock] : blocks;
});

const summaryComparisonColumns = computed(() => {
  const refs = (loteFiacReferenceSummary.value || []).map((item) => ({
    key: `ref-${item.loteFiac}`,
    kind: 'reference',
    label: `LOTE_FIAC ${item.loteFiac}`,
    data: item
  }));

  const blocks = (activeBlendColumns.value || []).map((blockId) => ({
    key: `block-${blockId}`,
    kind: 'block',
    label: blockId,
    blockId
  }));

  return [...refs, ...blocks];
});

const mapRuleParamToHistoricalKey = (ruleParam) => {
  if (ruleParam === 'LEN') return 'UHML';
  if (ruleParam === '+b') return 'PLUS_B';
  return ruleParam;
};

const getSummaryComparisonValue = (column, variable) => {
  if (!column || !variable) return null;

  if (column.kind === 'reference') {
    const historicalKey = mapRuleParamToHistoricalKey(variable.ruleParam);
    return column?.data?.averages?.[historicalKey] ?? null;
  }

  if (column.kind === 'block') {
    return blendPlan.value?.estadisticas?.[column.blockId]?.variables?.[variable.ruleParam]?.promedioGeneral ?? null;
  }

  return null;
};

const formatSummaryComparisonDate = (value) => {
  if (!value) return '—';

  const str = String(value).trim();
  if (!str) return '—';

  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [year, month, day] = str.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }

  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;
  return parsed.toLocaleDateString('es-ES');
};

const getSummaryComparisonStartDate = (column) => {
  if (!column) return '—';
  if (column.kind === 'reference') {
    return formatSummaryComparisonDate(column?.data?.primerIngreso);
  }
  return '—';
};

const getSummaryComparisonUsedKg = (column) => {
  if (!column) return null;

  if (column.kind === 'reference') {
    const kg = Number(column?.data?.kgUsados);
    return Number.isNaN(kg) ? null : kg;
  }

  if (column.kind === 'block') {
    return getPesoTotalBloqueForColumn(column.blockId);
  }

  return null;
};

const getSummaryValueByParam = (column, ruleParam) => {
  if (!column || !ruleParam) return null;

  if (column.kind === 'reference') {
    const historicalKey = mapRuleParamToHistoricalKey(ruleParam);
    const value = Number(column?.data?.averages?.[historicalKey]);
    return Number.isNaN(value) ? null : value;
  }

  if (column.kind === 'block') {
    const value = Number(blendPlan.value?.estadisticas?.[column.blockId]?.variables?.[ruleParam]?.promedioGeneral);
    return Number.isNaN(value) ? null : value;
  }

  return null;
};

const formatSignedNumber = (value, decimals = 2) => {
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  const fixed = num.toFixed(decimals);
  return num > 0 ? `+${fixed}` : fixed;
};

const formatRange = (min, max, decimals = 1) => {
  if (min === null || min === undefined || max === null || max === undefined) return '—';
  const nMin = Number(min);
  const nMax = Number(max);
  if (Number.isNaN(nMin) || Number.isNaN(nMax)) return '—';
  return `${nMin.toFixed(decimals)}–${nMax.toFixed(decimals)}`;
};

const predictiveFiberAnalysis = computed(() => {
  const refItems = [...(loteFiacReferenceSummary.value || [])]
    .filter(item => item && item.loteFiac !== null && item.loteFiac !== undefined)
    .sort((a, b) => Number(a.loteFiac) - Number(b.loteFiac));

  const preferredTargetBlock = (activeBlendColumns.value || []).find((blockId) => /^M1-M\d+$/i.test(String(blockId || '')));
  const fallbackTargetBlock = primaryBlendBlockId.value || activeBlendColumns.value?.[0] || null;
  const targetBlockId = preferredTargetBlock || fallbackTargetBlock;

  if (!targetBlockId || refItems.length === 0) {
    return {
      available: false,
      title: '📋 INFORME DE PROYECCIÓN',
      subtitle: 'Sin datos suficientes para proyectar impacto operativo.',
      severity: 'unknown',
      badgeLabel: 'Sin datos',
      badgeClass: 'bg-slate-100 text-slate-600',
      conclusionHeading: '⚠️ CONCLUSIÓN GENERAL:',
      conclusionBody: 'Faltan datos para proyectar desempeño de forma confiable.',
      conclusionLine: '⚠️ CONCLUSIÓN GENERAL: faltan datos para proyectar desempeño de forma confiable.',
      sections: [],
      efficiencyHeading: '🏁 VEREDICTO DE EFICIENCIA:',
      efficiencyBody: 'Sin datos suficientes para emitir recomendación operativa.',
      verdictLine: 'Sin datos suficientes para emitir recomendación operativa.',
      verdictTextClass: 'text-slate-600',
      lines: []
    };
  }

  const targetColumn = { kind: 'block', blockId: targetBlockId, label: targetBlockId };
  const lote109Ref = refItems.find((item) => Number(item.loteFiac) === 109) || null;
  const fallbackRef = refItems[refItems.length - 1] || null;
  const comparisonRef = lote109Ref || fallbackRef;

  if (!comparisonRef) {
    return {
      available: false,
      title: `📋 INFORME DE PROYECCIÓN: ${targetBlockId}`,
      subtitle: 'No hay referencia histórica para comparar.',
      severity: 'unknown',
      badgeLabel: 'Sin datos',
      badgeClass: 'bg-slate-100 text-slate-600',
      conclusionHeading: '⚠️ CONCLUSIÓN GENERAL:',
      conclusionBody: 'No hay lote de referencia para medir impacto real en máquina.',
      conclusionLine: '⚠️ CONCLUSIÓN GENERAL: no hay lote de referencia para medir impacto real en máquina.',
      sections: [],
      efficiencyHeading: '🏁 VEREDICTO DE EFICIENCIA:',
      efficiencyBody: 'No evaluable hasta contar con referencia histórica consistente.',
      verdictLine: 'No evaluable hasta contar con referencia histórica consistente.',
      verdictTextClass: 'text-slate-600',
      lines: []
    };
  }

  const comparisonColumn = { kind: 'reference', data: comparisonRef };

  const targetSTR = getSummaryValueByParam(targetColumn, 'STR');
  const targetELG = getSummaryValueByParam(targetColumn, 'ELG');
  const targetLEN = getSummaryValueByParam(targetColumn, 'LEN');
  const targetMIC = getSummaryValueByParam(targetColumn, 'MIC');

  const referenceSTR = getSummaryValueByParam(comparisonColumn, 'STR');
  const referenceELG = getSummaryValueByParam(comparisonColumn, 'ELG');
  const referenceLEN = getSummaryValueByParam(comparisonColumn, 'LEN');
  const referenceMIC = getSummaryValueByParam(comparisonColumn, 'MIC');

  const calcPct = (next, base) => {
    if (next === null || base === null || base === 0) return null;
    return ((next - base) / base) * 100;
  };

  const lenDelta = (targetLEN !== null && referenceLEN !== null) ? targetLEN - referenceLEN : null;
  const lenPct = calcPct(targetLEN, referenceLEN);
  const elgDelta = (targetELG !== null && referenceELG !== null) ? targetELG - referenceELG : null;
  const strDelta = (targetSTR !== null && referenceSTR !== null) ? targetSTR - referenceSTR : null;
  const micDelta = (targetMIC !== null && referenceMIC !== null) ? targetMIC - referenceMIC : null;

  const getDeltaIndicator = (delta, { positiveIsGood = true, epsilon = 0.01 } = {}) => {
    if (delta === null || delta === undefined || Number.isNaN(Number(delta))) {
      return { emoji: '⚪', label: 'Sin dato' };
    }

    const numeric = Number(delta);
    if (Math.abs(numeric) <= epsilon) {
      return { emoji: '⚠️', label: 'Neutro' };
    }

    const isGood = positiveIsGood ? numeric > 0 : numeric < 0;
    if (isGood) return { emoji: '✅', label: 'Óptimo' };
    return { emoji: '🔴', label: 'Crítico' };
  };

  const lenStatus = getDeltaIndicator(lenDelta, { positiveIsGood: true, epsilon: 0.02 });
  const elgStatus = getDeltaIndicator(elgDelta, { positiveIsGood: true, epsilon: 0.02 });
  const strStatus = getDeltaIndicator(strDelta, { positiveIsGood: true, epsilon: 0.02 });

  const urdidoLine = (lenDelta === null || elgDelta === null)
    ? 'Urdido: datos insuficientes para proyectar tensión y roturas.'
    : (lenDelta >= 0 && elgDelta >= 0)
      ? `Urdido: LEN ${formatSignedNumber(lenDelta)} (${formatSignedNumber(lenPct)}%) y ELG ${formatSignedNumber(elgDelta)} vs Lote ${comparisonRef.loteFiac}; se espera hilo con mejor nervio y mayor capacidad de estiramiento, con menor tasa de roturas por tensión.`
      : `Urdido: LEN ${formatSignedNumber(lenDelta)} (${formatSignedNumber(lenPct)}%) y ELG ${formatSignedNumber(elgDelta)} vs Lote ${comparisonRef.loteFiac}; se recomienda sostener tensión conservadora porque podría aumentar la sensibilidad a roturas.`;

  const indigoLine = (micDelta === null)
    ? 'Índigo: datos insuficientes para proyectar comportamiento tintóreo por Micronaire.'
    : (micDelta < 0)
      ? `Índigo: MIC ${formatSignedNumber(micDelta)} vs Lote ${comparisonRef.loteFiac}; fibra más fina con mejor penetración de colorante y tendencia a cara de tela más suave (mano más blanda).`
      : (micDelta > 0)
        ? `Índigo: MIC ${formatSignedNumber(micDelta)} vs Lote ${comparisonRef.loteFiac}; fibra más gruesa, conviene vigilar profundidad de tono y uniformidad de penetración.`
        : `Índigo: MIC sin variación relevante vs Lote ${comparisonRef.loteFiac}; se espera comportamiento tintóreo estable.`;

  const tenacityShiftLow = strDelta === null ? null : Math.abs(strDelta) * 0.9;
  const tenacityShiftHigh = strDelta === null ? null : Math.abs(strDelta) * 1.4;

  const telarLine = (strDelta === null)
    ? 'Telar (Aire): datos insuficientes para proyectar tenacidad de hilo.'
    : (strDelta > 0)
      ? `Telar (Aire): STR ${formatSignedNumber(strDelta)} vs Lote ${comparisonRef.loteFiac}; se proyecta incremento de ${formatRange(tenacityShiftLow, tenacityShiftHigh)} cN/tex en tenacidad de hilo, habilitando evaluar mayor velocidad de inserción de trama.`
      : (strDelta < 0)
        ? `Telar (Aire): STR ${formatSignedNumber(strDelta)} vs Lote ${comparisonRef.loteFiac}; se proyecta caída de ${formatRange(tenacityShiftLow, tenacityShiftHigh)} cN/tex en tenacidad de hilo, con recomendación de no forzar velocidad.`
        : `Telar (Aire): STR estable vs Lote ${comparisonRef.loteFiac}; comportamiento mecánico esperado sin cambios relevantes.`;

  let score = 0;
  if (lenDelta !== null) score += lenDelta >= 0 ? 1 : -1;
  if (elgDelta !== null) score += elgDelta >= 0 ? 1 : -1;
  if (strDelta !== null) score += strDelta >= 0 ? 1 : -1;
  if (targetMIC !== null && referenceMIC !== null) {
    const targetDistanceToSweetSpot = Math.abs(targetMIC - 4.5);
    const referenceDistanceToSweetSpot = Math.abs(referenceMIC - 4.5);
    score += targetDistanceToSweetSpot <= referenceDistanceToSweetSpot ? 1 : -1;
  }

  const micDistanceDelta = (targetMIC !== null && referenceMIC !== null)
    ? Math.abs(targetMIC - 4.5) - Math.abs(referenceMIC - 4.5)
    : null;
  const micStatus = getDeltaIndicator(micDistanceDelta, { positiveIsGood: false, epsilon: 0.01 });

  let severity = 'medium';
  let badgeLabel = 'Atención Operativa';
  let badgeClass = 'bg-amber-100 text-amber-700 border border-amber-200';
  let verdictTextClass = 'text-amber-700';
  let conclusionHeading = '⚠️ CONCLUSIÓN GENERAL:';
  let conclusionBody = 'La mezcla mejora parcialmente y requiere control operacional fino en línea.';
  let efficiencyHeading = '🏁 VEREDICTO DE EFICIENCIA:';
  let efficiencyBody = 'Mejora parcial: facilita producción con control fino de seteo en máquinas.';

  if (score >= 3) {
    severity = 'low';
    badgeLabel = '✅ Escenario Favorable';
    badgeClass = 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    verdictTextClass = 'text-emerald-700';
    conclusionHeading = '✅ CONCLUSIÓN GENERAL:';
    conclusionBody = 'La mezcla entrante eleva el estándar de proceso y facilita producción sostenida.';
    efficiencyBody = 'La mezcla entrante facilitará la producción y permite evaluar mayor ritmo con baja fricción operativa.';
  } else if (score <= 0) {
    severity = 'high';
    badgeLabel = '🔴 Riesgo Operativo';
    badgeClass = 'bg-rose-100 text-rose-700 border border-rose-200';
    verdictTextClass = 'text-rose-700';
    conclusionHeading = '🔴 CONCLUSIÓN GENERAL:';
    conclusionBody = 'La mezcla entrante presiona estabilidad y exige operación conservadora.';
    efficiencyBody = 'La mezcla entrante puede dificultar producción; conviene priorizar estabilidad antes de exigir velocidad.';
  } else {
    badgeLabel = '⚠️ Atención Operativa';
  }

  const comparisonSubtitle = lote109Ref
    ? `Comparativo principal: ${targetBlockId} vs Lote 109 real.`
    : `Comparativo principal: ${targetBlockId} vs Lote ${comparisonRef.loteFiac} (no se encontró Lote 109 en referencias).`;

  const sectionUrdido = {
    title: '1️⃣ URDIDO — NERVIO Y TENSIÓN',
    bullets: [
      `LEN: ${formatValue(targetLEN, 'UHML')} vs ${formatValue(referenceLEN, 'UHML')} (${formatSignedNumber(lenPct)}%) ${lenStatus.emoji} ${lenStatus.label}`,
      `ELG: ${formatValue(targetELG, 'ELG')} vs ${formatValue(referenceELG, 'ELG')} (${formatSignedNumber(elgDelta)} pts) ${elgStatus.emoji} ${elgStatus.label}`,
      'Proyección: mejor longitud media de fibra y mayor capacidad de estiramiento reducen probabilidad de roturas por tensión.'
    ]
  };

  const sectionIndigo = {
    title: '2️⃣ ÍNDIGO — PENETRACIÓN Y MANO DE TELA',
    bullets: [
      `MIC: ${formatValue(targetMIC, 'MIC')} vs ${formatValue(referenceMIC, 'MIC')} (${formatSignedNumber(micDelta)} pts) ${micStatus.emoji} ${micStatus.label}`,
      'Proyección: la afinidad tintórea por Micronaire tiende a mejorar penetración y uniformidad cuando el valor converge a 4.5.',
      'Impacto esperado: cara de tela más limpia y tacto más estable lote a lote.'
    ]
  };

  const sectionTelar = {
    title: '3️⃣ TELAR (AIRE) — TENACIDAD Y RITMO',
    bullets: [
      `STR: ${formatValue(targetSTR, 'STR')} vs ${formatValue(referenceSTR, 'STR')} (${formatSignedNumber(strDelta)} g/tex) ${strStatus.emoji} ${strStatus.label}`,
      `Tenacidad hilo proyectada: ${strDelta !== null && strDelta >= 0 ? '↑' : '↓'} ${formatRange(tenacityShiftLow, tenacityShiftHigh)} cN/tex`,
      strDelta !== null && strDelta > 0
        ? 'Proyección: recuperación de resistencia estructural; viable evaluar subida gradual de velocidad de inserción.'
        : 'Proyección: priorizar estabilidad de mezcla antes de exigir más velocidad para evitar penalizar eficiencia.'
    ]
  };

  return {
    available: true,
    title: `📋 INFORME DE PROYECCIÓN: ${targetBlockId}`,
    subtitle: `Análisis Predictivo Fibra ↔️ Hilo · ${comparisonSubtitle}`,
    severity,
    badgeLabel,
    badgeClass,
    conclusionHeading,
    conclusionBody,
    conclusionLine: `${conclusionHeading} ${conclusionBody}`,
    sections: [sectionUrdido, sectionIndigo, sectionTelar],
    efficiencyHeading,
    efficiencyBody,
    verdictTextClass,
    lines: [
      'Resumen de Impacto por Sección:',
      urdidoLine,
      indigoLine,
      telarLine
    ],
    verdictLine: `${efficiencyBody} Mensaje al equipo: la calidad puede subir un escalón si se sostiene disciplina de parámetros en línea.`
  };
});

const predictiveWhatsappMessage = computed(() => {
  const analysis = predictiveFiberAnalysis.value;

  if (!analysis?.available) {
    return '📋 INFORME DE PROYECCIÓN\nAnálisis Predictivo Fibra ↔️ Hilo\n\n⚠️ CONCLUSIÓN GENERAL:\nNo hay datos suficientes para proyectar impacto operativo.';
  }

  const detailLines = Array.isArray(analysis.lines)
    ? analysis.lines.filter((line) => typeof line === 'string' && line.trim() !== '' && line !== 'Resumen de Impacto por Sección:')
    : [];

  const sectionBlocks = Array.isArray(analysis.sections)
    ? analysis.sections.map((section) => {
      const bullets = Array.isArray(section?.bullets)
        ? section.bullets.map((bullet) => `  • ${bullet}`).join('\n')
        : '';
      return [section?.title || '', bullets].filter(Boolean).join('\n');
    }).join('\n\n')
    : '';

  const fallbackSections = detailLines.map((line) => `• ${line}`).join('\n');

  return [
    analysis.title,
    'Análisis Predictivo Fibra ↔️ Hilo',
    '',
    `*${analysis.conclusionHeading || '⚠️ CONCLUSIÓN GENERAL:'}*`,
    analysis.conclusionBody || 'Sin datos suficientes para proyectar impacto operativo.',
    '',
    '*📊 COMPARATIVA TÉCNICA (Promedios):*',
    '',
    sectionBlocks || fallbackSections,
    '',
    `*${analysis.efficiencyHeading || '🏁 VEREDICTO DE EFICIENCIA:'}*`,
    analysis.efficiencyBody || analysis.verdictLine || 'Sin recomendación operativa.'
  ].join('\n');
});

const predictiveCopyState = ref('idle');
let predictiveCopyTimer = null;

const resetPredictiveCopyState = () => {
  if (predictiveCopyTimer) {
    clearTimeout(predictiveCopyTimer);
    predictiveCopyTimer = null;
  }

  predictiveCopyTimer = setTimeout(() => {
    predictiveCopyState.value = 'idle';
    predictiveCopyTimer = null;
  }, 2000);
};

const copyPredictiveWhatsappMessage = async () => {
  try {
    const text = predictiveWhatsappMessage.value || '';
    if (!text.trim()) {
      predictiveCopyState.value = 'error';
      resetPredictiveCopyState();
      return;
    }

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'absolute';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (!copied) throw new Error('No se pudo copiar el mensaje');
    }

    predictiveCopyState.value = 'success';
    resetPredictiveCopyState();
  } catch (error) {
    console.warn('No se pudo copiar el mensaje de proyección:', error);
    predictiveCopyState.value = 'error';
    resetPredictiveCopyState();
  }
};

const formatSummaryComparisonKg = (value) => {
  if (value === null || value === undefined) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return formatThousandInteger(num);
};

const getPesoPorMezclaForColumn = (colId) => {
  const stat = blendPlan.value?.estadisticas?.[colId] || {};
  return stat.pesoPorMezcla ?? stat.pesoTotal ?? 0;
};

const getPesoTotalBloqueForColumn = (colId) => {
  const stat = blendPlan.value?.estadisticas?.[colId] || {};
  if (stat.pesoTotalBloque !== undefined && stat.pesoTotalBloque !== null) {
    return stat.pesoTotalBloque;
  }
  return getPesoPorMezclaForColumn(colId) * getBlockMixCount(colId);
};

const getStockActualForBlock = (row, blockIndex, blocksOverride = null) => {
  const blocks = Array.isArray(blocksOverride) && blocksOverride.length
    ? blocksOverride
    : (blendPlan.value?.columnasMezcla || []);
  if (!Array.isArray(blocks) || blocks.length === 0) return '-';

  const stock = Number(row?.Stock);
  if (Number.isNaN(stock)) return '-';

  let stockActual = stock;

  for (let i = 0; i <= blockIndex && i < blocks.length; i += 1) {
    const blockId = blocks[i];
    const fardosLoteEnBloque = Number(row?.mezclas?.[blockId]) || 0;
    const repeticionesBloque = getBlockMixCount(blockId);
    stockActual -= (fardosLoteEnBloque * repeticionesBloque);
  }

  return formatThousandInteger(stockActual);
};

const getRowUsedForVisibleBlocks = (row, blocksOverride = null) => {
  if (!row) return 0;

  const blocks = Array.isArray(blocksOverride) && blocksOverride.length
    ? blocksOverride
    : activeBlendColumns.value;

  if (!Array.isArray(blocks) || blocks.length === 0) {
    return Number(row?.Usados) || 0;
  }

  return blocks.reduce((used, blockId) => {
    const perMixCount = Number(row?.mezclas?.[blockId]) || 0;
    const mixesCount = getBlockMixCount(blockId);
    return used + (perMixCount * mixesCount);
  }, 0);
};

const getRowSobranteForVisibleBlocks = (row, blocksOverride = null) => {
  const stock = Number(row?.Stock) || 0;
  const used = getRowUsedForVisibleBlocks(row, blocksOverride);
  const sobrante = stock - used;
  return sobrante > 0 ? sobrante : 0;
};

const activeBlendVariablesForSummary = computed(() => {
  return monitoredParams
    .filter(({ key }) => {
      const setting = supervisionSettings[key];
      return setting && (setting.target || setting.hardCap || setting.tolerance);
    })
    .map(({ key, label }) => ({
      uiKey: key,
      ruleParam: mapUiKeyToRuleParam(key),
      label,
      formatKey: mapUiKeyToFormatKey(key)
    }));
});

const summaryMatrixRowspan = computed(() => {
  const variableRows = activeBlendVariablesForSummary.value.length * 5;
  return 3 + variableRows;
});

const getMatrixVariableLabel = (variable) => {
  if (!variable) return '';
  if (variable.ruleParam === 'LEN') return 'LEN';
  return variable.ruleParam;
};

const getMatrixStats = (col, variable) => {
  return blendPlan.value?.estadisticas?.[col]?.variables?.[variable.ruleParam] || {};
};

const getMatrixIdealPctValue = (variable) => {
  if (!variable) return null;

  const rule = getRuleFor(variable.uiKey);
  const fromRule = Number(rule?.porcentaje_min_ideal);
  if (!Number.isNaN(fromRule) && fromRule >= 0 && fromRule <= 100) {
    return fromRule;
  }

  if (variable.uiKey === 'MIC') return 90;
  if (variable.uiKey === 'STR' || variable.uiKey === 'UHML') return 80;
  return 80;
};

const getMatrixIdealPctLabel = (variable) => {
  const ideal = getMatrixIdealPctValue(variable);
  return ideal === null ? '-' : `${ideal}%`;
};

const getMatrixTolerancePctLabel = (variable) => {
  const ideal = getMatrixIdealPctValue(variable);
  if (ideal === null) return '-';
  const tolerance = Math.max(0, 100 - ideal);
  return `${tolerance}%`;
};

const loadLoteFiacReferenceSummary = async () => {
  try {
    const response = await fetch('http://localhost:3001/api/inventory/lote-fiac-reference-summary?limit=3');
    if (!response.ok) throw new Error('No se pudo cargar referencias LOTE_FIAC');

    const data = await response.json();
    const refs = Array.isArray(data?.referencias) ? data.referencias : [];

    loteFiacReferenceSummary.value = refs.sort((a, b) => Number(a.loteFiac) - Number(b.loteFiac));
  } catch (error) {
    console.warn('No se pudieron cargar referencias LOTE_FIAC para resumen comparativo:', error);
    loteFiacReferenceSummary.value = [];
  }
};

const planLotTotals = computed(() => {
  const rows = blendPlan.value?.plan || [];

  return rows.reduce((totals, row) => {
    totals.stock += Number(row.Stock) || 0;
    totals.usados += getRowUsedForVisibleBlocks(row);
    totals.sobrante += getRowSobranteForVisibleBlocks(row);
    return totals;
  }, { stock: 0, usados: 0, sobrante: 0 });
});

const planWeightTotals = computed(() => {
  const rows = blendPlan.value?.plan || [];

  const pesoMedioByKey = new Map();
  const candidates = [
    ...(Array.isArray(sortedFilteredData.value) ? sortedFilteredData.value : []),
    ...(Array.isArray(filteredData.value) ? filteredData.value : []),
    ...(Array.isArray(items.value) ? items.value : [])
  ];

  candidates.forEach((row) => {
    const key = buildProducerLotKey(row);
    const pesoMedio = Number(row?.PESO_MEDIO ?? row?.PesoMedio);
    if (!key || Number.isNaN(pesoMedio) || pesoMedio <= 0) return;
    if (!pesoMedioByKey.has(key)) pesoMedioByKey.set(key, pesoMedio);
  });

  return rows.reduce((totals, row) => {
    const key = buildProducerLotKey(row);
    const fallbackPesoMedio = Number(row?.PESO_MEDIO ?? row?.PesoMedio);
    const pesoMedio = pesoMedioByKey.get(key) ?? (Number.isNaN(fallbackPesoMedio) ? 0 : fallbackPesoMedio);

    const stock = Number(row?.Stock) || 0;
    const usados = getRowUsedForVisibleBlocks(row);
    const sobrante = getRowSobranteForVisibleBlocks(row);

    totals.stockKg += stock * pesoMedio;
    totals.usadosKg += usados * pesoMedio;
    totals.sobranteKg += sobrante * pesoMedio;
    return totals;
  }, { stockKg: 0, usadosKg: 0, sobranteKg: 0 });
});

const sortedBlendPlanRows = computed(() => {
  const rows = blendPlan.value?.plan || [];
  return sortRowsByState(rows, blendSortState);
});

const sortedRemanentes = computed(() => {
  const rows = blendPlan.value?.remanentes || [];
  return sortRowsByState(rows, blendSortState);
});

// Fila normalizada basada en SALDO DISPONIVEL del inventario (tb_est_mp).
// kg = SALDO_DISPONIVEL × PESO_MEDIO. Incluye todos los campos HVI para el análisis de calidad.
const saldoDisponibleRows = computed(() => {
  return (items.value || [])
    .filter(item => item.SALDO_DISPONIVEL > 0)
    .map(item => {
      const saldo = item.SALDO_DISPONIVEL;
      const pesoTotal = saldo * item.PESO_MEDIO;
      return {
        PRODUTOR:  item.PRODUTOR,
        LOTE:      item.LOTE,
        TAM:       item.TAM,
        CLASSIF:   item.CLASSIF,
        TIPO:      item.TIPO,
        COR:       item.COR,
        // Fardos y peso
        Fardos:    saldo,
        SALDO_DISPONIVEL: saldo,
        Kilogramos: pesoTotal,
        PESO:      pesoTotal,  // para que resolveRowWeight lo tome
        PesoMedio: item.PESO_MEDIO,
        // HVI
        MIC:  item.MIC,
        STR:  item.STR,
        UHML: item.UHML,
        LEN:  item.UHML,
        SCI:  item.SCI,
        MST:  item.MST,
        MAT:  item.MAT,
        UI:   item.UI,
        SF:   item.SF,
        ELG:  item.ELG,
        RD:   item.RD,
        PLUS_B: item.PLUS_B,
        TrCNT: item.TrCNT,
        TrAR:  item.TrAR,
        TRID:  item.TRID,
        Motivo: 'Saldo disponible'
      };
    });
});

// Para remanente ahora siempre mostramos columnas de peso (tenemos PESO_MEDIO)
const projectionSourceShowWeightColumns = computed(() => true);
const projectionSourceTableColspan = computed(() => (projectionSourceShowWeightColumns.value ? 10 : 8));

const projectionSourceTableRows = computed(() => {
  const fallbackAverageWeight = getFallbackAverageWeightPerBale();

  if (purchaseProjection.source === 'stock') {
    return sortedBlendPlanRows.value.map((row) => {
      const fardos = Number(row.Stock) || 0;
      const rowWeight = resolveRowWeight(row);
      const kilogramos = (rowWeight !== null && rowWeight > 0)
        ? rowWeight
        : (fardos * fallbackAverageWeight);
      const pesoMedio = fardos > 0 ? (kilogramos / fardos) : 0;

      return {
        PRODUTOR: row.PRODUTOR,
        LOTE: row.LOTE,
        TAM: row.TAM,
        Fardos: fardos,
        Kilogramos: kilogramos,
        PesoMedio: pesoMedio,
        MIC: row.MIC,
        STR: row.STR,
        LEN: row.LEN,
        Motivo: getPlanMotivoLogistico(row)
      };
    });
  }

  // Remanente: usar SALDO DISPONIVEL × PESO_MEDIO del inventario real
  return saldoDisponibleRows.value;
});

const projectionSourceTableTotals = computed(() => {
  const totals = projectionSourceTableRows.value.reduce((acc, row) => {
    const fardos = Number(row?.Fardos) || 0;
    const kilograms = parseMaybeLocalizedNumber(row?.Kilogramos) || 0;
    const micValue = parseMaybeLocalizedNumber(row?.MIC);
    const strValue = parseMaybeLocalizedNumber(row?.STR);
    const lenValue = parseMaybeLocalizedNumber(row?.LEN);

    acc.fardos += fardos;
    acc.kilogramos += kilograms;

    if (fardos > 0 && micValue !== null) {
      acc.micWeighted += (micValue * fardos);
      acc.micWeight += fardos;
    }

    if (fardos > 0 && strValue !== null) {
      acc.strWeighted += (strValue * fardos);
      acc.strWeight += fardos;
    }

    if (fardos > 0 && lenValue !== null) {
      acc.lenWeighted += (lenValue * fardos);
      acc.lenWeight += fardos;
    }

    return acc;
  }, {
    fardos: 0,
    kilogramos: 0,
    micWeighted: 0,
    micWeight: 0,
    strWeighted: 0,
    strWeight: 0,
    lenWeighted: 0,
    lenWeight: 0
  });

  return {
    fardos: totals.fardos,
    kilogramos: totals.kilogramos,
    pesoMedio: totals.fardos > 0 ? (totals.kilogramos / totals.fardos) : 0,
    mic: totals.micWeight > 0 ? (totals.micWeighted / totals.micWeight) : 0,
    str: totals.strWeight > 0 ? (totals.strWeighted / totals.strWeight) : 0,
    len: totals.lenWeight > 0 ? (totals.lenWeighted / totals.lenWeight) : 0
  };
});

const projectionSourceTableTitle = computed(() => {
  return purchaseProjection.source === 'stock'
    ? 'Lotes de Stock Actual (Referencia Proyección)'
    : 'Fardos con Saldo Disponible (SALDO DISPONIVEL del inventario)';
});

const projectionSourceTableReasonLabel = computed(() => {
  return purchaseProjection.source === 'stock'
    ? 'Motivo / Estado'
    : 'Estado';
});

const projectionSourceTableEmptyMessage = computed(() => {
  return purchaseProjection.source === 'stock'
    ? 'No hay lotes de stock disponibles para mostrar.'
    : 'No hay lotes con SALDO DISPONIVEL > 0 en el inventario. Actualizá el CSV de stock.';
});

const getQualityKey = (row) => {
  const sourceValue = row?.CLASSIF ?? row?.TIPO ?? row?.COR ?? 'SIN CALIDAD';
  const normalized = normalizeSortText(sourceValue);
  return normalized || 'SIN CALIDAD';
};

const generatedMixesCount = computed(() => {
  const columns = blendPlan.value?.columnasMezcla;
  if (!Array.isArray(columns) || columns.length === 0) return 0;

  return columns.reduce((sum, colId) => sum + getBlockMixCount(colId), 0);
});

const recipeByQualityPerMix = computed(() => {
  // ── Fuente: Sobrante no usado ────────────────────────────────────────────
  // La receta se calcula desde las proporciones del SALDO DISPONIVEL real del
  // inventario: peso_calidad / peso_total × fardos_por_mezcla.
  // No depende del plan del optimizer.
  if (purchaseProjection.source === 'remanente') {
    const saldoRows = saldoDisponibleRows.value;
    if (!saldoRows.length) return [];
    const fardosPorMezcla = Number(filters.fardos) || 0;
    if (fardosPorMezcla <= 0) return [];

    const totalSaldo = saldoRows.reduce((sum, r) => sum + (Number(r.Fardos) || 0), 0);
    if (totalSaldo <= 0) return [];

    const grouped = new Map();
    saldoRows.forEach((row) => {
      const qualityKey = getQualityKey(row);
      const fardos = Number(row.Fardos) || 0;
      grouped.set(qualityKey, (grouped.get(qualityKey) || 0) + fardos);
    });

    return Array.from(grouped.entries())
      .map(([calidad, saldo]) => ({
        calidad,
        usados: saldo,
        recetaPorMezcla: (saldo / totalSaldo) * fardosPorMezcla
      }))
      .filter((e) => e.recetaPorMezcla > 0)
      .sort((a, b) => b.recetaPorMezcla - a.recetaPorMezcla);
  }

  // ── Fuente: Stock actual ─────────────────────────────────────────────────
  // La receta viene del plan generado por el optimizer (fardos Usados / mezclas).
  const rows = blendPlan.value?.plan;
  if (!Array.isArray(rows) || rows.length === 0) return [];

  const totalGeneratedMixes = generatedMixesCount.value;
  if (!totalGeneratedMixes || totalGeneratedMixes <= 0) return [];

  const grouped = new Map();

  rows.forEach((row) => {
    const qualityKey = getQualityKey(row);
    const usedBales = Number(row?.Usados) || 0;

    if (!grouped.has(qualityKey)) {
      grouped.set(qualityKey, { calidad: qualityKey, usados: 0 });
    }

    const bucket = grouped.get(qualityKey);
    bucket.usados += usedBales;
  });

  return Array.from(grouped.values())
    .map((entry) => ({
      ...entry,
      recetaPorMezcla: entry.usados / totalGeneratedMixes
    }))
    .filter((entry) => entry.recetaPorMezcla > 0)
    .sort((a, b) => b.recetaPorMezcla - a.recetaPorMezcla);
});

const availableByQuality = computed(() => {
  const sourceRows = purchaseProjection.source === 'remanente'
    ? saldoDisponibleRows.value
    : (blendPlan.value?.plan || []);

  const grouped = new Map();

  sourceRows.forEach((row) => {
    const qualityKey = getQualityKey(row);
    const availableBales = purchaseProjection.source === 'remanente'
      ? (Number(row?.Fardos) || 0)
      : (Number(row?.Stock) || 0);

    grouped.set(qualityKey, (grouped.get(qualityKey) || 0) + availableBales);
  });

  return grouped;
});

const getProjectionSourceRows = () => (
  purchaseProjection.source === 'remanente'
    ? saldoDisponibleRows.value
    : (blendPlan.value?.plan || [])
);

const getProjectionAvailableBales = (row) => (
  purchaseProjection.source === 'remanente'
    ? (Number(row?.Fardos) || 0)
    : (Number(row?.Stock) || 0)
);

const parseMaybeLocalizedNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isNaN(value) ? null : value;

  const asString = String(value).trim();
  if (!asString) return null;

  const normalized = asString.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  if (!Number.isNaN(parsed)) return parsed;

  const direct = Number(asString);
  return Number.isNaN(direct) ? null : direct;
};

const buildInventoryLookupKey = (produtor, lote) => {
  const p = normalizeSortText(produtor).toUpperCase();
  const l = normalizeSortText(lote).toUpperCase();
  return `${p}::${l}`;
};

const inventoryWeightLookup = computed(() => {
  const lookup = new Map();

  (items.value || []).forEach((item) => {
    const key = buildInventoryLookupKey(item?.PRODUTOR, item?.LOTE);
    const weight = parseMaybeLocalizedNumber(item?.PESO);
    if (!key || weight === null || weight <= 0) return;
    lookup.set(key, weight);
  });

  return lookup;
});

const getFallbackAverageWeightPerBale = () => {
  const totalStock = Number(summaryRow.value?.QTDE_ESTOQUE) || 0;
  const totalWeight = Number(summaryRow.value?.PESO) || 0;
  if (totalStock > 0 && totalWeight > 0) return totalWeight / totalStock;
  return 0;
};

const resolveRowWeight = (row) => {
  const directWeight = parseMaybeLocalizedNumber(row?.PESO);
  if (directWeight !== null && directWeight > 0) return directWeight;

  const lookupKey = buildInventoryLookupKey(row?.PRODUTOR, row?.LOTE);
  const fromLookup = inventoryWeightLookup.value.get(lookupKey);
  if (fromLookup !== undefined && fromLookup > 0) return fromLookup;

  return null;
};

const getVariableValueForRow = (row, uiKey) => {
  if (!row || !uiKey) return null;

  if (uiKey === 'UHML') {
    const value = Number(row?.LEN ?? row?.UHML);
    return Number.isNaN(value) ? null : value;
  }

  if (uiKey === 'PLUS_B') {
    const value = Number(row?.PLUS_B);
    return Number.isNaN(value) ? null : value;
  }

  const value = Number(row?.[uiKey]);
  return Number.isNaN(value) ? null : value;
};

const parseRuleThresholds = (rule) => {
  const parseOrNull = (value) => {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? null : numericValue;
  };

  return {
    targetMin: parseOrNull(rule?.valor_ideal_min),
    targetMax: parseOrNull(rule?.promedio_objetivo_max),
    toleranceMin: parseOrNull(rule?.rango_tol_min),
    toleranceMax: parseOrNull(rule?.rango_tol_max),
    hardMin: parseOrNull(rule?.limite_min_absoluto),
    hardMax: parseOrNull(rule?.limite_max_absoluto)
  };
};

const computeRequiredPurchaseValue = ({ targetValue, existingQty, existingAverage, purchaseQty }) => {
  const target = Number(targetValue);
  const availableQty = Number(existingQty);
  const currentAverage = Number(existingAverage);
  const buyQty = Number(purchaseQty);

  if ([target, availableQty, currentAverage, buyQty].some((value) => Number.isNaN(value))) return null;
  if (buyQty <= 0) return null;

  return ((target * (availableQty + buyQty)) - (currentAverage * availableQty)) / buyQty;
};

const activeProjectionVariables = computed(() => {
  return monitoredParams.filter(({ key }) => {
    const setting = supervisionSettings[key];
    return setting && (setting.target || setting.hardCap || setting.tolerance);
  });
});

const averageByQualityForVariable = computed(() => {
  const sourceRows = getProjectionSourceRows();
  const result = {};

  monitoredParams.forEach(({ key: uiKey }) => {
    const grouped = new Map();
    let globalQty = 0;
    let globalWeighted = 0;

    sourceRows.forEach((row) => {
      const qualityKey = getQualityKey(row);
      const qty = getProjectionAvailableBales(row);
      const variableValue = getVariableValueForRow(row, uiKey);

      if (qty <= 0 || variableValue === null) return;

      const current = grouped.get(qualityKey) || { qty: 0, weighted: 0 };
      current.qty += qty;
      current.weighted += (variableValue * qty);
      grouped.set(qualityKey, current);

      globalQty += qty;
      globalWeighted += (variableValue * qty);
    });

    const byQuality = new Map();
    grouped.forEach((value, qualityKey) => {
      byQuality.set(qualityKey, value.qty > 0 ? (value.weighted / value.qty) : 0);
    });

    result[uiKey] = {
      byQuality,
      global: globalQty > 0 ? (globalWeighted / globalQty) : 0
    };
  });

  return result;
});

const averageWeightByQuality = computed(() => {
  const sourceRows = getProjectionSourceRows();
  const grouped = new Map();
  let globalWeight = 0;
  let globalBales = 0;
  const fallbackWeightPerBale = getFallbackAverageWeightPerBale();

  sourceRows.forEach((row) => {
    const qualityKey = getQualityKey(row);
    const sourceBales = getProjectionAvailableBales(row);
    const resolvedWeight = resolveRowWeight(row);
    const lotWeight = (resolvedWeight !== null && resolvedWeight > 0)
      ? resolvedWeight
      : (sourceBales * fallbackWeightPerBale);

    if (sourceBales <= 0 || lotWeight <= 0) return;

    const current = grouped.get(qualityKey) || { weight: 0, bales: 0 };
    current.weight += lotWeight;
    current.bales += sourceBales;
    grouped.set(qualityKey, current);

    globalWeight += lotWeight;
    globalBales += sourceBales;
  });

  const qualityAverages = new Map();
  grouped.forEach((value, key) => {
    qualityAverages.set(key, value.bales > 0 ? (value.weight / value.bales) : 0);
  });

  const globalAverage = globalBales > 0 ? (globalWeight / globalBales) : 0;

  return {
    byQuality: qualityAverages,
    global: globalAverage
  };
});

// ── Análisis de Sobrante por Reglas de Mezcla (Fuente: Sobrante no usado) ─────────────────
// Para cada variable HVI activa con regla de mezclado, calcula qué fracción de los lotes
// con calidad baja (< valor_ideal_min) supera el límite de uso por mezcla.
// El sobrante resultante reduce el stock efectivamente disponible para la proyección de compra.
const remanenteMixingRuleAnalysis = computed(() => {
  if (purchaseProjection.source !== 'remanente') return null;

  const fardosPorMezcla = Number(filters.fardos) || 0;
  const targetMixes    = Number(purchaseProjection.targetMixes) || 0;
  if (fardosPorMezcla <= 0 || targetMixes <= 0) return null;

  const saldoRows = saldoDisponibleRows.value;
  if (!saldoRows.length) return null;

  // ── Totales del stock disponible ────────────────────────────────────────
  const totalStockF  = saldoRows.reduce((s, r) => s + (Number(r.Fardos)      || 0), 0);
  const totalStockKg = saldoRows.reduce((s, r) => s + (Number(r.Kilogramos)  || 0), 0);
  if (totalStockF <= 0 || totalStockKg <= 0) return null;

  const avgWeightPerBale = totalStockKg / totalStockF;

  // ── Dimensiones del bloque objetivo ─────────────────────────────────────
  const totalBloqueF  = fardosPorMezcla * targetMixes;         // total fardos a usar
  const kgMezcla      = fardosPorMezcla * avgWeightPerBale;
  const totalBloqueKg = totalBloqueF * avgWeightPerBale;        // ≡ kgMezcla × targetMixes

  // ── Configuración de variables HVI a analizar ───────────────────────────
  const varCfg = [
    { uiKey: 'MIC',  ruleKey: 'MIC', label: 'MIC',        getHvi: r => { const v = Number(r.MIC);  return (!isNaN(v) && v > 0) ? v : null; } },
    { uiKey: 'STR',  ruleKey: 'STR', label: 'STR',        getHvi: r => { const v = Number(r.STR);  return (!isNaN(v) && v > 0) ? v : null; } },
    { uiKey: 'UHML', ruleKey: 'LEN', label: 'LEN (UHML)', getHvi: r => { const v = Number(r.UHML); return (!isNaN(v) && v > 0) ? v : null; } },
  ];

  // ── Análisis por variable ────────────────────────────────────────────────
  const varAnalysis = [];

  varCfg.forEach(({ uiKey, ruleKey, label, getHvi }) => {
    const rule = activeRules.value.find(r => r.parametro === ruleKey);
    if (!rule) return;

    const idealMin = parseFloat(rule.valor_ideal_min);         // obj promedio  (e.g. 26.50)
    const tolMin   = parseFloat(rule.rango_tol_min);           // tol inferior  (e.g. 25.00)
    const tolMax   = parseFloat(rule.rango_tol_max);           // tol superior  (e.g. 26.00)
    const pctIdeal = parseFloat(rule.porcentaje_min_ideal);    // % mínimo ideal (e.g. 80)
    if ([idealMin, tolMin, tolMax, pctIdeal].some(isNaN)) return;

    // tolPct = fracción MÁXIMA del bloque que puede ser zona de tolerancia
    const tolLimitPct = 100 - pctIdeal;                        // e.g. 20
    const tolLimitF   = totalBloqueF * (tolLimitPct / 100);   // fardos máx tolerancia en bloque

    // ── Clasificar cada lote en 4 zonas ─────────────────────────────────
    // Zona 1 - DESCARTADO:  val < tolMin
    // Zona 2 - TOLERANCIA:  tolMin ≤ val < tolMax   (uso limitado al tolLimitPct %)
    // Zona 3 - SUB-IDEAL:   tolMax ≤ val < idealMin (uso libre, pero arrastra promedio abajo)
    // Zona 4 - IDEAL:       val ≥ idealMin           (uso libre, promedio objetivo OK)
    let descF=0, descKg=0;
    let tolF=0,  tolKg=0,  tolWsum=0;
    let subF=0,  subKg=0,  subWsum=0;
    let ideF=0,  ideKg=0,  ideWsum=0;

    saldoRows.forEach(row => {
      const val = getHvi(row);
      const f   = Number(row.Fardos) || 0;
      const kg  = Number(row.Kilogramos) || 0;
      if (val === null || f <= 0) return;

      if      (val < tolMin)   { descF += f; descKg += kg; }
      else if (val < tolMax)   { tolF  += f; tolKg  += kg; tolWsum += val * f; }
      else if (val < idealMin) { subF  += f; subKg  += kg; subWsum += val * f; }
      else                     { ideF  += f; ideKg  += kg; ideWsum += val * f; }
    });

    // ── Usable de la zona tolerancia: asignación greedy de enteros (mejor HVI primero) ──
    // Se llena el cupo entero (floor) tomando primero los lotes con mejor HVI
    const tolCapInt = Math.floor(tolLimitF);   // cupo máximo en fardos enteros

    // Construir lista de lotes de tolerancia ordenada por HVI desc
    const tolLotsSorted = saldoRows
      .map(row => {
        const val = getHvi(row);
        const f   = Number(row.Fardos) || 0;
        const pm  = Number(row.PesoMedio) || 0;
        return { val, f, kg: f * pm };
      })
      .filter(r => r.val !== null && r.val >= tolMin && r.val < tolMax && r.f > 0)
      .sort((a, b) => b.val - a.val);

    let usableTolF = 0, usableTolKg = 0, usableTolW = 0;
    let remainingTolCap = tolCapInt;
    tolLotsSorted.forEach(lot => {
      if (remainingTolCap <= 0) return;
      const use = Math.min(lot.f, remainingTolCap);
      usableTolF  += use;
      usableTolKg += use * (lot.f > 0 ? lot.kg / lot.f : 0);
      usableTolW  += lot.val * use;
      remainingTolCap -= use;
    });

    const sobranteTolF  = tolF - usableTolF;
    const sobranteTolKg = tolKg - usableTolKg;

    // ── Total usable del stock por esta variable ─────────────────────────
    // Sub-ideal + Ideal (sin límite) + Tolerancia (hasta límite)
    const freeF   = subF + ideF;
    const freeKg  = subKg + ideKg;
    const freeW   = subWsum + ideWsum;

    const totalUsableF  = freeF + usableTolF;
    const totalUsableKg = freeKg + usableTolKg;

    // ── PROBLEMA 1: Cantidad ─────────────────────────────────────────────
    // ¿Hay suficientes fardos usables para armar el bloque completo?
    const faltanteF  = Math.max(0, totalBloqueF - totalUsableF);
    const faltanteKg = faltanteF * avgWeightPerBale;

    // ── PROBLEMA 2: Promedio ─────────────────────────────────────────────
    // Construyo la mezcla óptima: uso ideal+sub primero, luego tolerancia
    // Para no necesitar ordenar por lote, trabajo con promedios de zona.
    let bloqueF, bloqueW;
    if (freeF >= totalBloqueF) {
      // El bloque se llena íntegramente con fardos sub-ideal + ideal
      // Aproximación: promedio proporcional de freeF (sin poder excluir los peores)
      bloqueF = totalBloqueF;
      bloqueW = freeF > 0 ? (freeW / freeF) * totalBloqueF : 0;
    } else {
      // Necesito llenar con tolerancia lo que no alcanza con freeF
      const tolToUse   = Math.min(totalBloqueF - freeF, usableTolF);
      const tolRatioUse = usableTolF > 0 ? tolToUse / usableTolF : 0;
      bloqueF = freeF + tolToUse;
      bloqueW = freeW + usableTolW * tolRatioUse;
    }

    const avgBloque = bloqueF > 0 ? bloqueW / bloqueF : 0;

    // ── Cantidad a comprar por promedio (cuando hay cantidad suficiente) ──
    // Fórmula regla de mezclas inversa:
    // objetivo × totalBloqueF = avgBloque × bloqueF + valorCompra × compraF
    // → compraF = totalBloqueF × (objetivo - avgBloque) / (valorCompra - avgBloque)
    // Usamos valorCompra = idealMin como valor mínimo de compra razonable
    let compraFPromedio = 0;
    let valorMinCompra  = null;
    if (faltanteF === 0 && avgBloque < idealMin) {
      // Hay fardos suficientes pero el promedio no llega
      // Necesitamos "swapear" los N peores por fardos nuevos ≥ idealMin
      // compraF = totalBloqueF × (objetivo - avg) / (idealMin - avg)
      const denom = idealMin - avgBloque;
      if (denom > 0) {
        compraFPromedio = Math.ceil(totalBloqueF * (idealMin - avgBloque) / denom);
        valorMinCompra  = idealMin;
      }
    }

    // ── Cuando hay faltante, ¿qué valor HVI deben tener los fardos a comprar? ─
    // Fórmula regla de mezclas inversa:
    // objetivo × totalBloqueF = avgBloque × (totalBloqueF - faltanteF) + Y × faltanteF
    // → Y = (objetivo × totalBloqueF - avgBloque × (totalBloqueF - faltanteF)) / faltanteF
    //
    // PERO ese Y puede caer por debajo de la zona tolerancia.
    // El cupo de tolerancia ya fue asignado al stock existente.
    // Si remainingTolCapacity < faltanteF → los nuevos fardos NO pueden ir a la zona
    // tolerancia (el cupo está lleno) → mínimo aceptable = tolMax (sub-ideal).
    // Si hay cupo disponible para todos los faltantes → mínimo = tolMin.
    let valorCompraFaltante = null;
    if (faltanteF > 0) {
      const usadosStockF      = totalBloqueF - faltanteF;
      const rawValorCompra    = (idealMin * totalBloqueF - avgBloque * usadosStockF) / faltanteF;

      // Cupo restante de tolerancia disponible para fardos a comprar
      const remainingTolCap   = Math.max(0, tolLimitF - usableTolF);
      // Si el cupo restante no alcanza para todos los faltantes,
      // el umbral mínimo sube a tolMax (los comprados no entran en tolerancia)
      const umbralMinimo      = remainingTolCap >= faltanteF ? tolMin : tolMax;

      valorCompraFaltante = Math.max(rawValorCompra, umbralMinimo);
      valorMinCompra      = valorCompraFaltante;
    }

    // ── Fardos a comprar = máximo entre restricción de cantidad y de promedio ─
    const aComprarF  = Math.max(faltanteF, compraFPromedio);
    const aComprarKg = aComprarF * avgWeightPerBale;

    varAnalysis.push({
      label, uiKey, ruleKey,
      // Regla
      idealMin, tolMin, tolMax, tolLimitPct,
      // Stock por zona
      descF, descKg,
      tolF, tolKg, tolAvg: tolF > 0 ? tolWsum / tolF : 0,
      subF, subKg, subAvg: subF > 0 ? subWsum / subF : 0,
      ideF, ideKg, ideAvg: ideF > 0 ? ideWsum / ideF : 0,
      // Usable
      usableTolF, usableTolKg,
      sobranteTolF, sobranteTolKg,
      totalUsableF, totalUsableKg,
      // % sobre el stock total
      pctTolStock:  totalStockF > 0 ? (tolF / totalStockF) * 100 : 0,
      pctFreeStock: totalStockF > 0 ? (freeF / totalStockF) * 100 : 0,
      // Problema 1: cantidad
      faltanteF, faltanteKg,
      // Problema 2: promedio
      avgBloque,
      avgPromedioOK: avgBloque >= idealMin,
      compraFPromedio,
      // Resultado
      aComprarF, aComprarKg,
      valorMinCompra,          // valor HVI mínimo que deben tener los fardos a comprar
      valorCompraFaltante,     // si hay faltante, valor HVI necesario para cumplir objetivo
    });
  });

  if (!varAnalysis.length) return null;

  // ── Resumen consolidado ─────────────────────────────────────────────────
  // La restricción vinculante es la variable que pide más fardos a comprar
  const maxAComprarF  = Math.max(...varAnalysis.map(v => v.aComprarF));
  const maxAComprarKg = maxAComprarF * avgWeightPerBale;
  const entradasN     = maxAComprarKg / 25000;

  return {
    varAnalysis,
    totalStockF, totalStockKg,
    totalBloqueF, totalBloqueKg, kgMezcla,
    avgWeightPerBale,
    maxAComprarF, maxAComprarKg, entradasN,
  };
});

// ── Modal: detalle fardo a fardo por variable ───────────────────────────────
const mixDetailModal = reactive({ visible: false, uiKey: null });

// ── Modal: Simulación Plan de Mezclas ─────────────────────────────────────────
const mixPlanModal = reactive({ visible: false, trucks: 3, balesPerTruck: 125 });

const mixPlanSimulation = computed(() => {
  const fardosPorMezcla = Number(filters.fardos) || 0;
  if (fardosPorMezcla <= 0) return null;

  const saldoRows = saldoDisponibleRows.value;
  if (!saldoRows.length) return null;

  const incomingF = (Number(mixPlanModal.trucks) || 0) * (Number(mixPlanModal.balesPerTruck) || 0);
  const totalStockF  = saldoRows.reduce((s, r) => s + (Number(r.Fardos)     || 0), 0);
  const totalStockKg = saldoRows.reduce((s, r) => s + (Number(r.Kilogramos) || 0), 0);
  const avgKgPerBale = totalStockF > 0 ? totalStockKg / totalStockF : 0;

  const varCfg = [
    { uiKey: 'MIC',  ruleKey: 'MIC', label: 'MIC',
      getHvi: r => { const v = Number(r.MIC);  return (!isNaN(v) && v > 0) ? v : null; } },
    { uiKey: 'STR',  ruleKey: 'STR', label: 'STR',
      getHvi: r => { const v = Number(r.STR);  return (!isNaN(v) && v > 0) ? v : null; } },
    { uiKey: 'UHML', ruleKey: 'LEN', label: 'LEN (UHML)',
      getHvi: r => { const v = Number(r.UHML); return (!isNaN(v) && v > 0) ? v : null; } },
  ];

  // ── Calcular N posibles por variable ────────────────────────────────────────
  const varResults = [];
  let bindingMixesCurrent = Infinity;
  let bindingMixesWithBuy = Infinity;
  let bindingVarCurrent   = null;
  let bindingVarWithBuy   = null;

  varCfg.forEach(({ uiKey, ruleKey, label, getHvi }) => {
    const rule = activeRules.value.find(r => r.parametro === ruleKey);
    if (!rule) return;

    const idealMin    = parseFloat(rule.valor_ideal_min);
    const tolMin      = parseFloat(rule.rango_tol_min);
    const tolMax      = parseFloat(rule.rango_tol_max);
    const pctIdeal    = parseFloat(rule.porcentaje_min_ideal);
    if ([idealMin, tolMin, tolMax, pctIdeal].some(isNaN)) return;

    const tolLimitPct  = 100 - pctIdeal;
    const tolFreeRatio = 1 - tolLimitPct / 100;

    let descF = 0, tolF = 0, subF = 0, ideF = 0;
    saldoRows.forEach(row => {
      const val = getHvi(row);
      const f   = Number(row.Fardos) || 0;
      if (val === null || f <= 0) return;
      if      (val < tolMin)   descF += f;
      else if (val < tolMax)   tolF  += f;
      else if (val < idealMin) subF  += f;
      else                     ideF  += f;
    });
    const existingFreeF = subF + ideF;

    // Sin compra
    const N_A  = Math.floor((existingFreeF + tolF) / fardosPorMezcla);
    const N_B  = tolFreeRatio > 0 ? Math.floor(existingFreeF / (fardosPorMezcla * tolFreeRatio)) : Infinity;
    const mixesCurrent     = Math.min(N_A, N_B);
    const usableTolCurrent = Math.min(tolF, Math.floor(mixesCurrent * fardosPorMezcla * tolLimitPct / 100));

    // Con compra (incoming = ideal)
    const newFreeF     = existingFreeF + incomingF;
    const N_A_buy      = Math.floor((newFreeF + tolF) / fardosPorMezcla);
    const N_B_buy      = tolFreeRatio > 0 ? Math.floor(newFreeF / (fardosPorMezcla * tolFreeRatio)) : Infinity;
    const mixesWithBuy     = Math.min(N_A_buy, N_B_buy);
    const usableTolWithBuy = Math.min(tolF, Math.floor(mixesWithBuy * fardosPorMezcla * tolLimitPct / 100));

    // Compra por variable (regla inversa del promedio) ────────────────────────
    // Usamos el mismo cálculo que en remanenteMixingRuleAnalysis
    const totalBloqueF = fardosPorMezcla * (Number(purchaseProjection.targetMixes) || mixesWithBuy);
    const usableTolForBuy = Math.min(tolF, Math.floor(totalBloqueF * tolLimitPct / 100));
    const freeForBuy  = existingFreeF;
    const totalUsableForBuy = freeForBuy + usableTolForBuy;
    const faltanteF   = Math.max(0, totalBloqueF - totalUsableForBuy);
    const faltanteKg  = faltanteF * avgKgPerBale;

    // Promedio actual (sin compra)
    let wFree = 0;
    saldoRows.forEach(row => {
      const val = getHvi(row);
      const f   = Number(row.Fardos) || 0;
      if (val === null || f <= 0 || val < tolMax) return;
      wFree += val * f;
    });
    const avgFree = existingFreeF > 0 ? wFree / existingFreeF : 0;

    let compraFPromedio = 0;
    let valorMinCompra  = null;
    if (faltanteF === 0 && avgFree < idealMin) {
      const denom = idealMin - avgFree;
      if (denom > 0) {
        compraFPromedio = Math.ceil(totalBloqueF * (idealMin - avgFree) / denom);
        valorMinCompra  = idealMin;
      }
    }
    if (faltanteF > 0) {
      const usadosStockF   = totalBloqueF - faltanteF;
      const rawValor       = (idealMin * totalBloqueF - avgFree * usadosStockF) / faltanteF;
      const remTolCap      = Math.max(0, totalBloqueF * tolLimitPct / 100 - usableTolForBuy);
      const umbral         = remTolCap >= faltanteF ? tolMin : tolMax;
      valorMinCompra       = Math.max(rawValor, umbral);
    }
    const aComprarF  = Math.max(faltanteF, compraFPromedio);
    const aComprarKg = aComprarF * avgKgPerBale;

    if (mixesCurrent < bindingMixesCurrent) { bindingMixesCurrent = mixesCurrent; bindingVarCurrent = label; }
    if (mixesWithBuy  < bindingMixesWithBuy)  { bindingMixesWithBuy  = mixesWithBuy;  bindingVarWithBuy  = label; }

    varResults.push({
      label, uiKey, ruleKey, getHvi,
      idealMin, tolMin, tolMax, tolLimitPct, pctIdeal,
      descF, tolF, subF, ideF, existingFreeF,
      usableTolCurrent, totalUsableCurrent : existingFreeF + usableTolCurrent, mixesCurrent,
      usableTolWithBuy,  totalUsableWithBuy: newFreeF + usableTolWithBuy,    mixesWithBuy,
      // compra
      aComprarF, aComprarKg, valorMinCompra, faltanteF, faltanteKg,
    });
  });

  if (!varResults.length) return null;

  const finalMixesCurrent = bindingMixesCurrent === Infinity ? 0 : bindingMixesCurrent;
  const finalMixesWithBuy  = bindingMixesWithBuy  === Infinity ? 0 : bindingMixesWithBuy;
  const N = finalMixesWithBuy;   // referencia Norma (para tarjetas de compra)

  // ══ GOLDEN BATCH + NORMA ════════════════════════════════════════════════════
  // Paso 1: Clasificar cada lote (zona más restrictiva entre todas las variables)
  const trucks = Number(mixPlanModal.trucks)      || 0;
  const bpt    = Number(mixPlanModal.balesPerTruck) || 0;

  const classifiedLots = saldoRows
    .filter(row => (Number(row.Fardos) || 0) > 0)
    .map(row => {
      const f = Number(row.Fardos) || 0;
      let estadoPriority = 0;
      varResults.forEach(vr => {
        const val = vr.getHvi(row);
        if (val === null) return;
        if      (val < vr.tolMin && estadoPriority < 2) estadoPriority = 2;
        else if (val < vr.tolMax && estadoPriority < 1) estadoPriority = 1;
      });
      return {
        type: 'lot',
        PRODUTOR: row.PRODUTOR, LOTE: row.LOTE,
        estado: estadoPriority === 2 ? 'DESCAR.' : estadoPriority === 1 ? 'TOLER.' : 'USO',
        stock: f,
        MIC:  Number(row.MIC)  || null,
        STR:  Number(row.STR)  || null,
        UHML: Number(row.UHML) || null,
        pesoMedio: Number(row.PesoMedio) || 0,
      };
    });

  // Paso 2: Cupo máx. tolerancia por mezcla (Norma más restrictiva de las vars activas)
  const maxTolBalesPerMix = varResults.length > 0
    ? Math.floor(Math.min(...varResults.map(vr => vr.tolLimitPct / 100)) * fardosPorMezcla)
    : fardosPorMezcla;

  // Paso 3: Agrupamiento de Lotes "Pequeños" (Ficticios) y candidatos activos
  // Lotes que no tienen saldo suficiente para cubrir un bloque se agrupan
  const minRequiredStock = finalMixesWithBuy > 0 ? finalMixesWithBuy : 1;
  const activeLots = classifiedLots.filter(r => r.estado !== 'DESCAR.' && r.stock > 0);
  
  let largeLots = activeLots.filter(r => r.stock >= minRequiredStock);
  let shortLots = activeLots.filter(r => r.stock < minRequiredStock);

  shortLots.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
    if ((b.STR || 0) !== (a.STR || 0)) return (b.STR || 0) - (a.STR || 0);
    if ((b.UHML || 0) !== (a.UHML || 0)) return (b.UHML || 0) - (a.UHML || 0);
    return (b.MIC || 0) - (a.MIC || 0);
  });

  const fictionalLots = [];
  let currentGroup = null;
  let fIndexUso = 1;
  let fIndexTol = 1;

  shortLots.forEach(lot => {
      if (!currentGroup || currentGroup.estado !== lot.estado || currentGroup.stock >= minRequiredStock) {
          const isUso = lot.estado === 'USO';
          currentGroup = {
              type: 'lot',
              estado: lot.estado,
              stock: 0,
              sumSTR: 0, sumUHML: 0, sumMIC: 0,
              pesoMedio: lot.pesoMedio,
              isFicticio: true,
              componentProds: [],
              componentLotes: [],
              fPrefix: isUso ? 'FU' : 'FT',
              lPrefix: isUso ? 'F.USO' : 'F.TOLER',
              idx: isUso ? fIndexUso++ : fIndexTol++
          };
          fictionalLots.push(currentGroup);
      }
      
      currentGroup.stock += lot.stock;
      currentGroup.sumSTR += (lot.STR || 0) * lot.stock;
      currentGroup.sumUHML += (lot.UHML || 0) * lot.stock;
      currentGroup.sumMIC += (lot.MIC || 0) * lot.stock;
      if (!currentGroup.componentProds.includes(lot.PRODUTOR)) currentGroup.componentProds.push(lot.PRODUTOR);
      if (!currentGroup.componentLotes.includes(lot.LOTE)) currentGroup.componentLotes.push(lot.LOTE);
  });

  // Consolidar el último grupo si no alcanza el mínimo (fundiéndolo con el anterior del mismo estado)
  ['USO', 'TOLER.'].forEach(estado => {
      const groups = fictionalLots.filter(g => g.estado === estado);
      if (groups.length > 1) {
          const last = groups[groups.length - 1];
          if (last.stock < minRequiredStock) {
              const prev = groups[groups.length - 2];
              prev.stock += last.stock;
              prev.sumSTR += last.sumSTR;
              prev.sumUHML += last.sumUHML;
              prev.sumMIC += last.sumMIC;
              last.componentProds.forEach(p => { if (!prev.componentProds.includes(p)) prev.componentProds.push(p); });
              last.componentLotes.forEach(l => { if (!prev.componentLotes.includes(l)) prev.componentLotes.push(l); });
              fictionalLots.splice(fictionalLots.indexOf(last), 1);
          }
      }
  });

  fictionalLots.forEach(g => {
      g.STR = parseFloat((g.sumSTR / g.stock).toFixed(1));
      g.UHML = parseFloat((g.sumUHML / g.stock).toFixed(2));
      g.MIC = parseFloat((g.sumMIC / g.stock).toFixed(2));
      
      let prodsStr = g.componentProds.join(', ');
      let lotesStr = g.componentLotes.join(', ');
      if (prodsStr.length > 25) prodsStr = prodsStr.substring(0, 22) + '...';
      if (lotesStr.length > 25) lotesStr = lotesStr.substring(0, 22) + '...';
      
      g.PRODUTOR = `${g.fPrefix} ${g.idx} (${prodsStr})`;
      g.LOTE = `${g.lPrefix} (${lotesStr})`;
  });

  const varResultsMap = {};
  varResults.forEach(v => varResultsMap[v.uiKey] = v);

  const candidates = [
    ...largeLots,
    ...fictionalLots,
    ...(trucks > 0 && bpt > 0
      ? Array.from({ length: trucks }, (_, i) => {
          const micVal = varResultsMap['MIC']?.valorMinCompra ?? varResultsMap['MIC']?.idealMin ?? null;
          const strVal = varResultsMap['STR']?.valorMinCompra ?? varResultsMap['STR']?.idealMin ?? null;
          const uhmlVal = varResultsMap['UHML']?.valorMinCompra ?? varResultsMap['UHML']?.idealMin ?? null;
          
          let estadoPriority = 0;
          varResults.forEach(vr => {
            const val = vr.uiKey === 'MIC' ? micVal : (vr.uiKey === 'STR' ? strVal : (vr.uiKey === 'UHML' ? uhmlVal : null));
            if (val === null) return;
            if (val < vr.tolMin && estadoPriority < 2) estadoPriority = 2;
            else if (val < vr.tolMax && estadoPriority < 1) estadoPriority = 1;
          });
          const estado = estadoPriority === 2 ? 'DESCAR.' : (estadoPriority === 1 ? 'TOLER.' : 'USO');

          return {
            type: 'truck', truckIdx: i,
            PRODUTOR: 'COMPRA', LOTE: `Camión ${i + 1}`,
            estado: estado, stock: bpt,
            MIC: micVal, 
            STR: strVal, 
            UHML: uhmlVal, 
            pesoMedio: avgKgPerBale,
            isIncoming: true,
          };
        })
      : []),
  ];
  const totalActive = candidates.reduce((s, c) => s + c.stock, 0);

  // Paso 4: Receta proporcional al stock (float)
  candidates.forEach(c => { c.rawRecipe = totalActive > 0 ? (c.stock / totalActive) * fardosPorMezcla : 0; });

  // Paso 5: Aplicar cupo TOLER. (Norma) — rebalancear resto hacia lotes USO
  const rawTolSum = candidates.filter(c => c.estado === 'TOLER.').reduce((s, c) => s + c.rawRecipe, 0);
  if (rawTolSum > maxTolBalesPerMix && rawTolSum > 0) {
    const scale      = maxTolBalesPerMix / rawTolSum;
    const surplus    = rawTolSum - maxTolBalesPerMix;
    const usoRawSum  = candidates.filter(c => c.estado !== 'TOLER.').reduce((s, c) => s + c.rawRecipe, 0);
    candidates.forEach(c => {
      if (c.estado === 'TOLER.') {
        c.adjRecipe = c.rawRecipe * scale;
      } else {
        c.adjRecipe = c.rawRecipe + (usoRawSum > 0 ? surplus * c.rawRecipe / usoRawSum : 0);
      }
    });
  } else {
    candidates.forEach(c => { c.adjRecipe = c.rawRecipe; });
  }

// Paso 6: Redondeo INTELIGENTE (Bottleneck-Aware Largest Remainder)
    // El método tradicional castigaba el límite total de bloques al dar ciegamente el decimal mayor.
    // Esta heurística distribuye los restos iterativamente evaluando el impacto del '+1'
    // en la capacidad total futura (N_identical). Así logramos exprimir de 1 a 2 bloques extra
    // del mismo stock sin violar substancialmente la regla de mezclas.
    candidates.forEach(c => {
      c.recipe          = Math.max(0, Math.floor(c.adjRecipe));
      c.recipeRemainder = c.adjRecipe - Math.floor(c.adjRecipe);
    });
    {
      const sumFloor = candidates.reduce((s, c) => s + c.recipe, 0);
      const deficit  = fardosPorMezcla - sumFloor;
      
      for (let i = 0; i < deficit; i++) {
        let maxPossibleGlobalBottleneck = -1;
        let bestTies = [];

        candidates.forEach(c => {
          c.recipe++; // simulamos el fardo extra
          const globalLimit = candidates.reduce((min, x) => 
            Math.min(min, x.recipe > 0 ? Math.floor(x.stock / x.recipe) : Infinity), Infinity);
          
          if (globalLimit > maxPossibleGlobalBottleneck) {
            maxPossibleGlobalBottleneck = globalLimit;
            bestTies = [c];
          } else if (globalLimit === maxPossibleGlobalBottleneck) {
            bestTies.push(c);
          }
          c.recipe--; // revertimos simulación
        });

        // De los que mejor protegen el cuello de botella general, 
        // desempatamos respetando la regla "Largest Remainder" natural
        if (bestTies.length > 0) {
          bestTies.sort((a, b) => b.recipeRemainder - a.recipeRemainder);
          bestTies[0].recipe++;
        } else {
          // Fallback (nunca debería ocurrir)
          candidates[0].recipe++;
        }
    }
  }

  // Paso 7: N_identicas = min( floor(stock / recipe) ) para recipe > 0
  candidates.forEach(c => { c.nPossible = c.recipe > 0 ? Math.floor(c.stock / c.recipe) : Infinity; });
  const N_identicalRaw = candidates.length > 0
    ? candidates.reduce((mn, c) => Math.min(mn, c.nPossible), Infinity)
    : 0;
  const N_identical = N_identicalRaw === Infinity ? 0 : N_identicalRaw;

  // Paso 8: Aplicar uso estricto del Golden Batch (Stock Disponible + Compras)
  // La cantidad máxima de mezclas idénticas logradas es N_identical.
  // No inventamos ni forzamos fardos que no existen. Lo que manda es el algoritmo general.
  
  candidates.forEach(c => {
    c.balesPerMix = c.recipe;
    
    // Calculo estricto: ¿Cuántos fardos consume el bloque logrado por Golden Batch?
    c.usados = c.recipe * N_identical;
    c.sobrante = c.stock - c.usados;

    // Identificar quién causó el cuello de botella
    c.isBottleneck = c.recipe > 0 && c.nPossible === N_identical;

    c.motivo = c.usados > 0
      ? (c.isIncoming
          ? (c.sobrante > 0 ? 'Entrante — sobrante de receta' : 'Entrante (Ideal)')
          : (c.estado === 'TOLER.'
              ? 'Tolerancia — cupo Norma aplicado'
              : (c.isFicticio ? 'Lote agrupado por calidad (Ficticio)' : 'Golden Batch — receta proporcional')))
      : 'Stock insuficiente para participar en la receta';
  });

  // Separar en lotRows (con DESCAR. añadidos) y truckRows
  const lotRows = [
    ...candidates.filter(c => c.type === 'lot'),

    ...classifiedLots
      .filter(r => r.estado === 'DESCAR.' && r.stock > 0)
      .map(r => ({
        type: 'lot', PRODUTOR: r.PRODUTOR, LOTE: r.LOTE,
        estado: 'DESCAR.', stock: r.stock,
        balesPerMix: 0, usados: 0, sobrante: r.stock,
        recipe: 0, nPossible: Infinity, isBottleneck: false,
        motivo: 'Descartado por calidad HVI',
        MIC: r.MIC, STR: r.STR, UHML: r.UHML, pesoMedio: r.pesoMedio,
      })),
  ].sort((a, b) => {
    const zo = { 'USO': 0, 'TOLER.': 1, 'DESCAR.': 2 };
    if (zo[a.estado] !== zo[b.estado]) return zo[a.estado] - zo[b.estado];
    return (a.PRODUTOR + a.LOTE).localeCompare(b.PRODUTOR + b.LOTE);
  });
  const truckRows = candidates.filter(c => c.type === 'truck');

    // Calcular estadísticas detalladas (Peso, MIC, STR, LEN) sobre varResults
    let totalPesoMezcla = 0;
    candidates.forEach(c => {
      if(c.recipe > 0) totalPesoMezcla += (c.recipe * c.pesoMedio);
    });

    varResults.forEach(v => {
      let sumIdeal = 0, weightIdeal = 0;
      let sumTol = 0, weightTol = 0;
      
      candidates.forEach(c => {
        if(c.recipe > 0 && c[v.uiKey] !== null) {
          const val = c[v.uiKey];
          const qty = c.recipe;
          const isLowerBetter = v.uiKey === 'PLUS_B';
          let isIdeal = false;
          
          if(isLowerBetter) {
            isIdeal = val <= v.tolMax;
          } else {
            isIdeal = val >= v.tolMax;
          }

          if(isIdeal) {
            sumIdeal += (val * qty);
            weightIdeal += qty;
          } else {
            sumTol += (val * qty);
            weightTol += qty;
          }
        }
      });
      
      const totalWeight = weightIdeal + weightTol;
      v.promedioGeneral = totalWeight > 0 ? (sumIdeal + sumTol) / totalWeight : null;
      v.promedioIdeal = weightIdeal > 0 ? sumIdeal / weightIdeal : 0;
      v.promedioTolerancia = weightTol > 0 ? sumTol / weightTol : 0;
      v.pctIdeal = totalWeight > 0 ? (weightIdeal / totalWeight) * 100 : 0;
      v.pctTolerancia = totalWeight > 0 ? (weightTol / totalWeight) * 100 : 0;
    });

  return {
    totalPesoMezcla,
    totalStockF, totalStockKg, incomingF,
    incomingKg: incomingF * avgKgPerBale,
    fardosPorMezcla, avgKgPerBale,
    varResults,
    finalMixesCurrent, bindingVarCurrent,
    finalMixesWithBuy, bindingVarWithBuy,
    N, N_identical,
    maxTolBalesPerMix,
    lotRows, truckRows,
    recetaSum: candidates.reduce((s, c) => s + c.recipe, 0),
    lotBalesPerMix: lotRows.reduce((s, r) => s + (r.balesPerMix || 0), 0),
  };
});

function openMixDetailModal(uiKey) {
  mixDetailModal.uiKey  = uiKey;
  mixDetailModal.visible = true;
}
function closeMixDetailModal() {
  mixDetailModal.visible = false;
  mixDetailModal.uiKey  = null;
}

const mixDetailVarItem = computed(() =>
  mixDetailModal.uiKey && remanenteMixingRuleAnalysis.value
    ? (remanenteMixingRuleAnalysis.value.varAnalysis.find(v => v.uiKey === mixDetailModal.uiKey) || null)
    : null
);

const mixDetailRows = computed(() => {
  const varItem = mixDetailVarItem.value;
  if (!varItem) return [];

  const { idealMin, tolMin, tolMax, tolLimitPct } = varItem;
  const bloqueF  = remanenteMixingRuleAnalysis.value?.totalBloqueF || 0;

  const hviGetters = {
    MIC:  r => { const v = Number(r.MIC);  return (!isNaN(v) && v > 0) ? v : null; },
    STR:  r => { const v = Number(r.STR);  return (!isNaN(v) && v > 0) ? v : null; },
    UHML: r => { const v = Number(r.UHML); return (!isNaN(v) && v > 0) ? v : null; },
  };
  const getHvi = hviGetters[mixDetailModal.uiKey];
  if (!getHvi) return [];

  const ZONE_ORDER = { 'Ideal': 0, 'Sub-ideal': 1, 'Tolerancia': 2, 'Sobrante tol.': 3, 'Descartado': 4, 'Sin dato': 5 };

  // ── Asignación greedy de enteros para la zona de tolerancia ──────────────
  // Igual que en remanenteMixingRuleAnalysis: mejor HVI primero, fardos enteros
  const tolCapInt = Math.floor(varItem.tolLimitPct / 100 * (remanenteMixingRuleAnalysis.value?.totalBloqueF || 0));
  const tolSorted = saldoDisponibleRows.value
    .map(row => ({ key: `${row.PRODUTOR}||${row.LOTE}`, val: getHvi(row), f: Number(row.Fardos) || 0 }))
    .filter(r => r.val !== null && r.val >= varItem.tolMin && r.val < varItem.tolMax && r.f > 0)
    .sort((a, b) => b.val - a.val);

  // Map: clave lote -> fardos asignados (enteros)
  const tolAssigned = new Map();
  let remCap = tolCapInt;
  tolSorted.forEach(lot => {
    if (remCap <= 0) { tolAssigned.set(lot.key, 0); return; }
    const use = Math.min(lot.f, remCap);
    tolAssigned.set(lot.key, use);
    remCap -= use;
  });

  const rows = saldoDisponibleRows.value.map(row => {
    const val       = getHvi(row);
    const fardos    = Number(row.Fardos)    || 0;
    const pesoMedio = Number(row.PesoMedio) || 0;
    const kgTotal   = fardos * pesoMedio;

    let zona, condicion, noUsado, motivo, usadosF, usadosKg;

    if (val === null) {
      zona = 'Sin dato'; condicion = 'Sin valor HVI'; noUsado = true;
      motivo  = 'Sin dato HVI — no clasificable';
      usadosF = 0; usadosKg = 0;
    } else if (val < tolMin) {
      zona = 'Descartado'; condicion = 'Descartado'; noUsado = true;
      motivo  = `${mixDetailModal.uiKey} ${val.toFixed(2)} < ${tolMin} (mínimo absoluto)`;
      usadosF = 0; usadosKg = 0;
    } else if (val < tolMax) {
      // Tolerancia: asignación greedy entera (lookup desde Map precalculado)
      const lotKey = `${row.PRODUTOR}||${row.LOTE}`;
      usadosF  = tolAssigned.get(lotKey) ?? 0;
      usadosKg = usadosF * pesoMedio;
      const sobF = fardos - usadosF;
      if (sobF > 0) {
        zona      = 'Tolerancia';   condicion = 'Tolerancia (parcial)';
        noUsado   = true;
        motivo    = `Cupo tol. ${tolLimitPct}% → máx ${tolCapInt} fardos en bloque`;
      } else {
        zona      = 'Tolerancia';   condicion = 'Tolerancia';
        noUsado   = false;          motivo    = '';
      }
    } else if (val < idealMin) {
      zona = 'Sub-ideal'; condicion = 'Sub-ideal (libre)'; noUsado = false; motivo = '';
      usadosF = fardos; usadosKg = kgTotal;
    } else {
      zona = 'Ideal'; condicion = 'Ideal'; noUsado = false; motivo = '';
      usadosF = fardos; usadosKg = kgTotal;
    }

    const sobranteF  = fardos - usadosF;
    const sobranteKg = sobranteF * pesoMedio;

    return {
      PRODUTOR: row.PRODUTOR, LOTE: row.LOTE,
      SALDO_DISPONIVEL: fardos, pesoMedio, kgTotal,
      hvi: val,
      zona, condicion, noUsado, motivo,
      usadosF, usadosKg, sobranteF, sobranteKg,
      zoneOrder: ZONE_ORDER[zona] ?? 5,
    };
  });

  // Ordena: por zona asc, dentro de zona por HVI desc
  return rows.sort((a, b) => {
    if (a.zoneOrder !== b.zoneOrder) return a.zoneOrder - b.zoneOrder;
    if (a.hvi !== null && b.hvi !== null) return b.hvi - a.hvi;
    return 0;
  });
});

const mixDetailSummary = computed(() => {
  const rows = mixDetailRows.value;
  if (!rows.length) return null;

  const totalUsadosF   = rows.reduce((s, r) => s + r.usadosF,   0);
  const totalSobranteF = rows.reduce((s, r) => s + r.sobranteF, 0);
  const totalUsadosKg  = rows.reduce((s, r) => s + r.usadosKg,  0);

  let wSumU = 0, wFU = 0, wSumS = 0, wFS = 0;
  rows.forEach(r => {
    if (r.hvi !== null) {
      if (r.usadosF > 0)   { wSumU += r.hvi * r.usadosF;   wFU += r.usadosF; }
      if (r.sobranteF > 0) { wSumS += r.hvi * r.sobranteF; wFS += r.sobranteF; }
    }
  });

  const totalSobranteKg = rows.reduce((s, r) => s + r.sobranteKg, 0);

  return {
    totalUsadosF, totalSobranteF, totalUsadosKg, totalSobranteKg,
    avgHviUsados:   wFU > 0 ? wSumU / wFU : null,
    avgHviSobrante: wFS > 0 ? wSumS / wFS : null,
  };
});

const purchaseProjectionError = computed(() => {
  const targetMixes = Number(purchaseProjection.targetMixes);
  if (Number.isNaN(targetMixes) || targetMixes <= 0) {
    return 'Ingresa una cantidad de mezclas objetivo válida (mayor que 0).';
  }

  if (!filters.fardos || Number(filters.fardos) <= 0) {
    return 'Define los fardos por mezcla antes de proyectar la compra.';
  }

  // ── Sobrante no usado: no requiere plan del optimizer ───────────────────
  if (purchaseProjection.source === 'remanente') {
    if (saldoDisponibleRows.value.length === 0) {
      return 'No hay lotes con SALDO DISPONIVEL > 0 en el inventario actual. Actualizá el CSV de stock.';
    }
    return '';
  }

  // ── Stock actual: requiere plan del optimizer ────────────────────────────
  if (!blendPlan.value || !Array.isArray(blendPlan.value.plan) || blendPlan.value.plan.length === 0) {
    return 'Genera primero un plan de mezclas para poder calcular la receta base por calidad.';
  }

  if (generatedMixesCount.value <= 0) {
    return 'No hay bloques válidos en el plan para obtener receta base por calidad.';
  }

  return '';
});

const purchaseProjectionRows = computed(() => {
  if (purchaseProjectionError.value) return [];

  const targetMixes = Number(purchaseProjection.targetMixes);
  const availableMap = availableByQuality.value;
  const weightAverages = averageWeightByQuality.value;
  const selectedVariables = activeProjectionVariables.value;
  const variableAverages = averageByQualityForVariable.value;

  // Para remanente: el análisis de restricción real está en remanenteMixingRuleAnalysis.
  // purchaseProjectionRows muestra la vista por calidad (sin escalar), la restricción
  // vinculante per-variable se ve en la tabla de análisis por reglas de mezcla.
  const effectiveFraction = 1;

  return recipeByQualityPerMix.value.map((recipeRow) => {
    const required = recipeRow.recetaPorMezcla * targetMixes;
    const rawAvailable = availableMap.get(recipeRow.calidad) || 0;
    const available = rawAvailable * effectiveFraction;
    const shortage = Math.max(0, required - available);
    const suggestedPurchaseBales = Math.ceil(shortage);

    const qualityAvgWeight = weightAverages.byQuality.get(recipeRow.calidad);
    const avgWeightPerBale = (qualityAvgWeight && qualityAvgWeight > 0)
      ? qualityAvgWeight
      : weightAverages.global;

    const suggestedPurchaseWeight = suggestedPurchaseBales * (avgWeightPerBale || 0);

    const hviGuidance = selectedVariables.map(({ key: uiKey, label }) => {
      const settings = supervisionSettings[uiKey] || {};
      const rule = getRuleFor(uiKey);
      const thresholds = parseRuleThresholds(rule);
      const averages = variableAverages[uiKey] || { byQuality: new Map(), global: 0 };
      const avgByQuality = averages.byQuality.get(recipeRow.calidad);
      const avgAvailable = (avgByQuality && avgByQuality > 0) ? avgByQuality : averages.global;

      const targetMinBuy = settings.target && thresholds.targetMin !== null
        ? computeRequiredPurchaseValue({
          targetValue: thresholds.targetMin,
          existingQty: available,
          existingAverage: avgAvailable,
          purchaseQty: suggestedPurchaseBales
        })
        : null;

      const targetMaxBuy = settings.target && thresholds.targetMax !== null
        ? computeRequiredPurchaseValue({
          targetValue: thresholds.targetMax,
          existingQty: available,
          existingAverage: avgAvailable,
          purchaseQty: suggestedPurchaseBales
        })
        : null;

      const toleranceMinBuy = settings.tolerance && thresholds.toleranceMin !== null
        ? computeRequiredPurchaseValue({
          targetValue: thresholds.toleranceMin,
          existingQty: available,
          existingAverage: avgAvailable,
          purchaseQty: suggestedPurchaseBales
        })
        : null;

      const toleranceMaxBuy = settings.tolerance && thresholds.toleranceMax !== null
        ? computeRequiredPurchaseValue({
          targetValue: thresholds.toleranceMax,
          existingQty: available,
          existingAverage: avgAvailable,
          purchaseQty: suggestedPurchaseBales
        })
        : null;

      const hardMinBuy = settings.hardCap && thresholds.hardMin !== null
        ? computeRequiredPurchaseValue({
          targetValue: thresholds.hardMin,
          existingQty: available,
          existingAverage: avgAvailable,
          purchaseQty: suggestedPurchaseBales
        })
        : null;

      const hardMaxBuy = settings.hardCap && thresholds.hardMax !== null
        ? computeRequiredPurchaseValue({
          targetValue: thresholds.hardMax,
          existingQty: available,
          existingAverage: avgAvailable,
          purchaseQty: suggestedPurchaseBales
        })
        : null;

      return {
        uiKey,
        label,
        avgAvailable,
        targetMinBuy,
        targetMaxBuy,
        toleranceMinBuy,
        toleranceMaxBuy,
        hardMinBuy,
        hardMaxBuy,
        hasRecommendation: suggestedPurchaseBales > 0
      };
    });

    return {
      calidad: recipeRow.calidad,
      recetaPorMezcla: recipeRow.recetaPorMezcla,
      requerido: required,
      disponible: available,
      faltante: shortage,
      compraSugeridaFardos: suggestedPurchaseBales,
      compraSugeridaPeso: suggestedPurchaseWeight,
      hviGuidance
    };
  });
});

const purchaseProjectionTotals = computed(() => {
  return purchaseProjectionRows.value.reduce((totals, row) => {
    totals.requerido += row.requerido;
    totals.disponible += row.disponible;
    totals.faltante += row.faltante;
    totals.compraSugeridaFardos += row.compraSugeridaFardos;
    totals.compraSugeridaPeso += row.compraSugeridaPeso;
    return totals;
  }, {
    requerido: 0,
    disponible: 0,
    faltante: 0,
    compraSugeridaFardos: 0,
    compraSugeridaPeso: 0
  });
});

const projectionSourceTotals = computed(() => {
  const sourceRows = getProjectionSourceRows();
  const avgWeightFallback = Number(averageWeightByQuality.value?.global) || getFallbackAverageWeightPerBale();

  return sourceRows.reduce((totals, row) => {
    const bales = getProjectionAvailableBales(row);
    const rowWeight = resolveRowWeight(row);

    totals.stockFardos += bales;
    totals.stockPeso += (rowWeight !== null && rowWeight > 0)
      ? rowWeight
      : (bales * avgWeightFallback);

    return totals;
  }, {
    stockFardos: 0,
    stockPeso: 0
  });
});

const projectionGlobalGuidance = computed(() => {
  const totalAvailable = Number(purchaseProjectionTotals.value?.disponible) || 0;
  const totalToBuy = Number(purchaseProjectionTotals.value?.compraSugeridaFardos) || 0;
  const totalKgToBuy = Number(purchaseProjectionTotals.value?.compraSugeridaPeso) || 0;
  const variableAverages = averageByQualityForVariable.value;

  return activeProjectionVariables.value.map(({ key: uiKey, label }) => {
    const settings = supervisionSettings[uiKey] || {};
    const rule = getRuleFor(uiKey);
    const thresholds = parseRuleThresholds(rule);
    const sourceAverage = Number(variableAverages?.[uiKey]?.global) || 0;

    const targetMinBuy = settings.target && thresholds.targetMin !== null
      ? computeRequiredPurchaseValue({
        targetValue: thresholds.targetMin,
        existingQty: totalAvailable,
        existingAverage: sourceAverage,
        purchaseQty: totalToBuy
      })
      : null;

    const targetMaxBuy = settings.target && thresholds.targetMax !== null
      ? computeRequiredPurchaseValue({
        targetValue: thresholds.targetMax,
        existingQty: totalAvailable,
        existingAverage: sourceAverage,
        purchaseQty: totalToBuy
      })
      : null;

    const toleranceMinBuy = settings.tolerance && thresholds.toleranceMin !== null
      ? computeRequiredPurchaseValue({
        targetValue: thresholds.toleranceMin,
        existingQty: totalAvailable,
        existingAverage: sourceAverage,
        purchaseQty: totalToBuy
      })
      : null;

    const toleranceMaxBuy = settings.tolerance && thresholds.toleranceMax !== null
      ? computeRequiredPurchaseValue({
        targetValue: thresholds.toleranceMax,
        existingQty: totalAvailable,
        existingAverage: sourceAverage,
        purchaseQty: totalToBuy
      })
      : null;

    const hardMinBuy = settings.hardCap && thresholds.hardMin !== null
      ? computeRequiredPurchaseValue({
        targetValue: thresholds.hardMin,
        existingQty: totalAvailable,
        existingAverage: sourceAverage,
        purchaseQty: totalToBuy
      })
      : null;

    const hardMaxBuy = settings.hardCap && thresholds.hardMax !== null
      ? computeRequiredPurchaseValue({
        targetValue: thresholds.hardMax,
        existingQty: totalAvailable,
        existingAverage: sourceAverage,
        purchaseQty: totalToBuy
      })
      : null;

    return {
      uiKey,
      label,
      sourceAverage,
      totalToBuy,
      totalAvailable,
      totalKgToBuy,
      thresholds,
      targetMinBuy,
      targetMaxBuy,
      toleranceMinBuy,
      toleranceMaxBuy,
      hardMinBuy,
      hardMaxBuy
    };
  });
});

const normalizeRecommendedValue = (value, comparator) => {
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return null;

  if (comparator === '>=') return Math.max(0, numericValue);
  if (comparator === '<=') return Math.max(0, numericValue);
  return numericValue;
};

const calculateFinalAverageAfterPurchase = ({ currentAverage, availableQty, buyQty, buyValue }) => {
  const current = Number(currentAverage);
  const available = Number(availableQty);
  const toBuy = Number(buyQty);
  const purchaseValue = Number(buyValue);

  if ([current, available, toBuy, purchaseValue].some((value) => Number.isNaN(value))) return null;
  if ((available + toBuy) <= 0) return null;

  return ((current * available) + (purchaseValue * toBuy)) / (available + toBuy);
};

const resolveObjectiveForVariable = (item) => {
  const thresholds = item?.thresholds || {};
  const isLowerBetter = item?.uiKey === 'PLUS_B';

  if (isLowerBetter) {
    if (thresholds.targetMax !== null && thresholds.targetMax !== undefined) {
      return {
        comparator: '<=',
        objectiveValue: thresholds.targetMax,
        recommendedValue: item.targetMaxBuy
      };
    }
    if (thresholds.toleranceMax !== null && thresholds.toleranceMax !== undefined) {
      return {
        comparator: '<=',
        objectiveValue: thresholds.toleranceMax,
        recommendedValue: item.toleranceMaxBuy
      };
    }
  } else {
    if (thresholds.targetMin !== null && thresholds.targetMin !== undefined) {
      return {
        comparator: '>=',
        objectiveValue: thresholds.targetMin,
        recommendedValue: item.targetMinBuy
      };
    }
    if (thresholds.toleranceMin !== null && thresholds.toleranceMin !== undefined) {
      return {
        comparator: '>=',
        objectiveValue: thresholds.toleranceMin,
        recommendedValue: item.toleranceMinBuy
      };
    }
  }

  return {
    comparator: null,
    objectiveValue: null,
    recommendedValue: null
  };
};

const projectionVariablePurchaseRows = computed(() => {
  const available = Number(purchaseProjectionTotals.value?.disponible) || 0;
  const missing = Number(purchaseProjectionTotals.value?.compraSugeridaFardos) || 0;
  const totalBales = available + missing;
  const avgWeightPerBale = Number(averageWeightByQuality.value?.global) || 0;
  const totalWeight = totalBales * avgWeightPerBale;
  const fardosPorMezcla = Number(filters.fardos) || 0;
  const tamanoBloque = Number(purchaseProjection.targetMixes) || 0;

  return projectionGlobalGuidance.value.map((item) => {
    const objective = resolveObjectiveForVariable(item);
    const recommended = normalizeRecommendedValue(objective.recommendedValue, objective.comparator);
    const finalAverage = (recommended !== null)
      ? calculateFinalAverageAfterPurchase({
        currentAverage: item.sourceAverage,
        availableQty: available,
        buyQty: missing,
        buyValue: recommended
      })
      : null;

    return {
      ...item,
      disponibleFardos: available,
      faltanteFardos: missing,
      totalFardos: totalBales,
      pesoMedioFardo: avgWeightPerBale,
      pesoTotalKg: totalWeight,
      fardosPorMezcla,
      tamanoBloque,
      promedioActual: item.sourceAverage,
      objetivoComparador: objective.comparator,
      objetivoValor: objective.objectiveValue,
      comprarComparador: objective.comparator,
      comprarValor: recommended,
      promedioFinal: finalAverage,
      recomendacion: buildGlobalGuidanceSummary(item)
    };
  });
});

// Computed: Items con Stock Mapeado (Total vs Disponible)
const itemsWithStock = computed(() => {
  return items.value.map(item => {
    // Si _QTDE_TOTAL no existe, asumimos que es el valor actual (primera carga)
    const originalStock = item._QTDE_TOTAL !== undefined ? item._QTDE_TOTAL : item.QTDE_ESTOQUE;
    const mode = filters.stockMode || 'available';
    // Por defecto 'available' usa SALDO_DISPONIVEL. 'total' usa QTDE_ESTOQUE (original)
    const targetQty = mode === 'available' 
      ? (item.SALDO_DISPONIVEL || 0) 
      : originalStock;
    
    // Crear copia shallow para no mutar el original en items.value
    // Preservamos el prototipo de CottonBale y propiedades
    const copy = Object.assign(Object.create(Object.getPrototypeOf(item)), item);
    copy.QTDE_ESTOQUE = targetQty;
    return copy;
  });
});

// Computed: Agrupación de lotes pequeños (Tipo Simulador)
const groupedItems = computed(() => {
  const source = itemsWithStock.value;
  if (!filters.groupSmallLots) return source;

  const threshold = Number(filters.smallLotThreshold) || 20;
  const rules = activeRules.value || [];

  // Helper: Clasificar Estado
  const getEstado = (item) => {
    if (!rules.length) return 'USO';
    let priority = 0; // 0=USO, 1=TOLER, 2=DESCAR

    for (const r of rules) {
      let val = null;
      if (r.parametro === 'MIC') val = Number(item.MIC);
      else if (r.parametro === 'STR') val = Number(item.STR);
      else if (r.parametro === 'LEN') val = Number(item.UHML);

      if (val === null || isNaN(val)) continue;
      const idealMin = parseFloat(r.valor_ideal_min);
      const tolMin = parseFloat(r.rango_tol_min);
      const tolMax = parseFloat(r.rango_tol_max);
      
      if (val < tolMin) {
          if (priority < 2) priority = 2; 
      } else if (val < tolMax) {
          if (val < idealMin && priority < 1) priority = 1; 
      }
    }
    return priority === 2 ? 'DESCAR.' : (priority === 1 ? 'TOLER.' : 'USO');
  };

  const large = [];
  const short = [];
  
  source.forEach(item => {
    const s = Number(item.QTDE_ESTOQUE) || 0;
    if (s > threshold) large.push(item);
    else short.push({
      item,
      stock: s,
      estado: getEstado(item),
      tam: normalizeSortText(item.TAM)
    });
  });

  if (!short.length) return large;

  short.sort((a, b) => {
    if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
    if (a.tam !== b.tam) return a.tam.localeCompare(b.tam, 'es', { sensitivity: 'base', numeric: true });
    const val = (x, k) => Number(x.item[k]) || 0;
    let d = val(b, 'STR') - val(a, 'STR'); if (d !== 0) return d;
    d = val(b, 'UHML') - val(a, 'UHML'); if (d !== 0) return d;
    return val(b, 'MIC') - val(a, 'MIC');
  });

  const groups = [];
  let currentGroup = null;
  let idxUso = 1, idxTol = 1, idxDesc = 1;
  const numFields = ['MIC', 'STR', 'UHML', 'SCI', 'MST', 'MAT', 'UI', 'SF', 'ELG', 'RD', 'PLUS_B', 'PESO_MEDIO'];

  short.forEach(entry => {
    if (
      !currentGroup ||
      currentGroup.estado !== entry.estado ||
      currentGroup.tam !== entry.tam ||
      currentGroup.stock >= threshold
    ) {
      const estado = entry.estado;
      const isUso = estado === 'USO';
      const isDesc = estado === 'DESCAR.';
      const fPrefix = isDesc ? 'FD' : (isUso ? 'FU' : 'FT');
      const idx = isDesc ? idxDesc++ : (isUso ? idxUso++ : idxTol++);
      
      currentGroup = {
          stock: 0,
          estado,
          tam: entry.tam,
          items: [],
          acc: {},
          prods: new Set(),
          tamValues: new Set(),
          lotes: [],
          fPrefix, idx
      };
      numFields.forEach(k => currentGroup.acc[k] = 0);
      groups.push(currentGroup);
    }
    
    const s = entry.stock;
    currentGroup.stock += s;
    currentGroup.items.push(entry.item);
    currentGroup.prods.add(entry.item.PRODUTOR);
    const tamValue = (entry.item.TAM ?? '').toString().trim();
    if (tamValue) currentGroup.tamValues.add(tamValue);
    currentGroup.lotes.push(`${entry.item.LOTE} [${s}]`);
    
    numFields.forEach(k => {
        currentGroup.acc[k] += (Number(entry.item[k]) || 0) * s; 
    });
  });

  // Merge huérfanos muy pequeños
  const mergeOrphans = (targetGroups) => {
    // Implementacion simplificada: si el ultimo grupo de un estado/tam es menor al umbral y hay uno previo, unirlos
    ['USO', 'TOLER.', 'DESCAR.'].forEach(st => {
      // Filtrar indices para manipular el array original por referencia si es necesario, pero aqui groups es local
      // Mejor iterar y buscar candidatos
      const tamKeys = [...new Set(targetGroups.filter(g => g.estado === st).map(g => g.tam))];

      tamKeys.forEach((tamKey) => {
        const candidates = targetGroups.filter(g => g.estado === st && g.tam === tamKey);
      if (candidates.length > 1) {
        const last = candidates[candidates.length - 1];
         // Si el ultimo no llega al umbral
        if (last.stock < threshold) {
           const prev = candidates[candidates.length - 2];
           // Mover datos de last a prev
           prev.items.push(...last.items);
           prev.stock += last.stock;
           last.prods.forEach(p => prev.prods.add(p));
           prev.lotes.push(...last.lotes);

           numFields.forEach(k => prev.acc[k] += last.acc[k]);
           
           // Eliminar last de targetGroups
           const idxToRemove = targetGroups.indexOf(last);
           if(idxToRemove !== -1) targetGroups.splice(idxToRemove, 1);
        }
      }
      });
    });
  };
  
  mergeOrphans(groups);

  const resultGroups = groups.map(g => {
      // Usar el primer item como base para el prototipo
      const base = g.items[0];
      const obj = Object.assign(Object.create(Object.getPrototypeOf(base)), base);
      
      obj.QTDE_ESTOQUE = g.stock;
      // Ajustar saldo disponible tambien si estamos agrupando
      if (obj.SALDO_DISPONIVEL !== undefined) obj.SALDO_DISPONIVEL = g.stock;
      
      numFields.forEach(k => {
        obj[k] = g.stock > 0 ? parseFloat((g.acc[k] / g.stock).toFixed(2)) : 0;
      });

      const pList = Array.from(g.prods).join(', ');
      const lList = g.lotes.join(', ');
      const tamList = Array.from(g.tamValues);
      const singleLotOriginal = normalizeSortText(g.items?.[0]?.LOTE);
      const singleProducerOriginal = normalizeSortText(g.items?.[0]?.PRODUTOR);
      
      obj.PRODUTOR = g.items.length <= 1
        ? (singleProducerOriginal || `${g.fPrefix} ${g.idx} (${pList.length > 20 ? pList.substring(0, 17) + '...' : pList})`)
        : `${g.fPrefix} ${g.idx} (${pList.length > 20 ? pList.substring(0, 17) + '...' : pList})`;
      obj.LOTE     = g.items.length <= 1
        ? (singleLotOriginal || `Agrupado (${lList.length > 50 ? lList.substring(0, 47) + '...' : lList})`)
        : `Agrupado (${lList.length > 50 ? lList.substring(0, 47) + '...' : lList})`;
      obj.TAM      = tamList.length > 1 ? 'VARIOS' : (tamList[0] || g.tam || '');
      obj._isGroup = true; // Flag para UI si se necesita destacar
      
      return obj;
  });

  return [...large, ...resultGroups];
});

// Computed: Datos Filtrados
const filteredData = computed(() => {
  // Usamos groupedItems en lugar de itemsWithStock
  return groupedItems.value.filter(item => {
    // Filtro Texto (Produtor, Lote, Destino)
    const searchLower = filters.searchText.toLowerCase();
    return !filters.searchText || 
      item.PRODUTOR.toLowerCase().includes(searchLower) ||
      item.LOTE.toLowerCase().includes(searchLower) ||
      item.DESTINO.toLowerCase().includes(searchLower);
  });
});

const sortedFilteredData = computed(() => {
  return sortRowsByState(filteredData.value, stockSortState);
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
    const decimalFields = ['MIC', 'STR', 'UHML', 'SCI', 'MST', 'ELG'];
    if (decimalFields.includes(key)) return num.toFixed(2);

    // Valores numéricos por defecto: devolver tal cual (sin cambios adicionales)
    return num;
  }

  // Si no es un número, devolver el valor original
  return value;
};

const formatThousandInteger = (value) => {
  if (value === null || value === undefined || value === '') return '-';

  let normalizedValue = value;

  if (typeof normalizedValue === 'string') {
    normalizedValue = normalizedValue.replace(/\./g, '').replace(',', '.').trim();
  }

  const parsedNumber = Number(normalizedValue);
  if (Number.isNaN(parsedNumber)) return value;

  // Formateador manual: separador de miles con '.' desde 1.000
  // (Intl.NumberFormat('es-ES') en Node 18+ / CLDR 42+ usa minimumGroupingDigits=2
  //  y omite el separador para valores entre 1.000 y 9.999)
  return Math.round(parsedNumber).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

const formatProjectionValue = (value, decimals = 2) => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue)) return '-';

  // Formateador manual: parte entera con '.' como miles, ',' como decimal
  const fixed   = Math.abs(numberValue).toFixed(decimals);
  const [intPart, decPart = ''] = fixed.split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = numberValue < 0 ? '-' : '';
  return decimals > 0 ? `${sign}${intFormatted},${decPart}` : `${sign}${intFormatted}`;
};

const formatGuidanceBound = (value) => {
  if (value === null || value === undefined) return null;
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) return null;
  return formatProjectionValue(numericValue, 2);
};

const buildGuidanceSummary = (guidance, purchaseQty) => {
  if (!guidance) return 'Sin guía.';
  if (!purchaseQty || purchaseQty <= 0 || !guidance.hasRecommendation) return 'Sin compra requerida para esta calidad.';

  const parts = [];

  const targetMin = formatGuidanceBound(guidance.targetMinBuy);
  const targetMax = formatGuidanceBound(guidance.targetMaxBuy);
  if (targetMin !== null || targetMax !== null) {
    if (targetMin !== null && targetMax !== null) parts.push(`Target compra: ${targetMin} - ${targetMax}`);
    else if (targetMin !== null) parts.push(`Target compra: >= ${targetMin}`);
    else parts.push(`Target compra: <= ${targetMax}`);
  }

  const toleranceMin = formatGuidanceBound(guidance.toleranceMinBuy);
  const toleranceMax = formatGuidanceBound(guidance.toleranceMaxBuy);
  if (toleranceMin !== null || toleranceMax !== null) {
    if (toleranceMin !== null && toleranceMax !== null) parts.push(`Tolerancia compra: ${toleranceMin} - ${toleranceMax}`);
    else if (toleranceMin !== null) parts.push(`Tolerancia compra: >= ${toleranceMin}`);
    else parts.push(`Tolerancia compra: <= ${toleranceMax}`);
  }

  const hardMin = formatGuidanceBound(guidance.hardMinBuy);
  const hardMax = formatGuidanceBound(guidance.hardMaxBuy);
  if (hardMin !== null || hardMax !== null) {
    if (hardMin !== null && hardMax !== null) parts.push(`Límite abs compra: ${hardMin} - ${hardMax}`);
    else if (hardMin !== null) parts.push(`Límite abs compra: >= ${hardMin}`);
    else parts.push(`Límite abs compra: <= ${hardMax}`);
  }

  return parts.join(' | ') || 'Sin umbrales de regla para esta variable.';
};

const buildGlobalGuidanceSummary = (item) => {
  if (!item) return 'Sin guía';
  if (!item.totalToBuy || item.totalToBuy <= 0) return 'Sin compra total requerida.';

  const parts = [];

  const targetMin = formatGuidanceBound(item.targetMinBuy);
  const targetMax = formatGuidanceBound(item.targetMaxBuy);
  if (targetMin !== null || targetMax !== null) {
    if (targetMin !== null && targetMax !== null) parts.push(`Target compra ${targetMin} - ${targetMax}`);
    else if (targetMin !== null) parts.push(`Target compra >= ${targetMin}`);
    else parts.push(`Target compra <= ${targetMax}`);
  }

  const toleranceMin = formatGuidanceBound(item.toleranceMinBuy);
  const toleranceMax = formatGuidanceBound(item.toleranceMaxBuy);
  if (toleranceMin !== null || toleranceMax !== null) {
    if (toleranceMin !== null && toleranceMax !== null) parts.push(`Tolerancia compra ${toleranceMin} - ${toleranceMax}`);
    else if (toleranceMin !== null) parts.push(`Tolerancia compra >= ${toleranceMin}`);
    else parts.push(`Tolerancia compra <= ${toleranceMax}`);
  }

  const hardMin = formatGuidanceBound(item.hardMinBuy);
  const hardMax = formatGuidanceBound(item.hardMaxBuy);
  if (hardMin !== null || hardMax !== null) {
    if (hardMin !== null && hardMax !== null) parts.push(`Límite abs compra ${hardMin} - ${hardMax}`);
    else if (hardMin !== null) parts.push(`Límite abs compra >= ${hardMin}`);
    else parts.push(`Límite abs compra <= ${hardMax}`);
  }

  return parts.join(' | ') || 'Sin umbrales de regla para esta variable.';
};

const buildAppliedRulesSummary = () => {
  const summary = [];

  monitoredParams.forEach(({ key, label }) => {
    const settings = supervisionSettings[key];
    if (!settings) return;

    const isSelected = settings.target || settings.hardCap || settings.tolerance;
    if (!isSelected) return;

    const rule = getRuleFor(key);
    const details = [];

    if (settings.target) {
      const v = getRuleDisplay(rule, 'target');
      details.push(`Target${v ? `: ${v}` : ''}`);
    }

    if (settings.hardCap) {
      const v = getRuleDisplay(rule, 'hardCap');
      details.push(`Hard Cap${v ? `: ${v}` : ''}`);
    }

    if (settings.tolerance) {
      const v = getRuleDisplay(rule, 'tolerance');
      details.push(`Tolerancia${v ? `: ${v}` : ''}`);
    }

    summary.push({
      parametro: label,
      detalle: details.join(' | ') || 'Sin detalle de regla'
    });
  });

  return summary;
};

const getSelectedSupervisionVariables = () => {
  return Object.keys(supervisionSettings).filter(key => {
    const setting = supervisionSettings[key];
    return setting.target || setting.hardCap || setting.tolerance;
  });
};

const getMixCountFromBlockId = (blockId) => {
  if (!blockId || typeof blockId !== 'string') return 1;

  const singleMatch = blockId.match(/^M(\d+)$/);
  if (singleMatch) return 1;

  const rangeMatch = blockId.match(/^M(\d+)-M(\d+)$/);
  if (!rangeMatch) return 1;

  const start = Number(rangeMatch[1]);
  const end = Number(rangeMatch[2]);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 1;

  return end - start + 1;
};

const validateBlendPlanFeasibility = (planData) => {
  const rows = Array.isArray(planData?.plan) ? planData.plan : [];
  const blocks = Array.isArray(planData?.columnasMezcla) ? planData.columnasMezcla : [];
  if (!rows.length || !blocks.length) return;

  const issues = [];

  rows.forEach((row) => {
    const stock = Number(row?.Stock);
    if (Number.isNaN(stock)) return;

    let remaining = stock;

    for (const blockId of blocks) {
      const perMixCount = Number(row?.mezclas?.[blockId]) || 0;
      const mixesFromStats = Number(planData?.estadisticas?.[blockId]?.mezclasBloque);
      const mixesCount = (!Number.isNaN(mixesFromStats) && mixesFromStats > 0)
        ? mixesFromStats
        : getMixCountFromBlockId(blockId);

      remaining -= perMixCount * mixesCount;

      if (remaining < 0) {
        issues.push(`${row.PRODUTOR}/${row.LOTE} en ${blockId} (S.Act=${remaining})`);
        break;
      }
    }
  });

  if (issues.length > 0) {
    throw new Error(`Plan no realizable detectado en validación UI: ${issues.slice(0, 3).join(' | ')}`);
  }
};

// Acción para el botón Mezclas
const handleMezclas = async ({ silent = false } = {}) => {
  if (isCalculatingBlend.value) return;

  blendUserMessage.value = null;

  if (!filters.fardos || filters.fardos <= 0) {
    if (!silent) {
      alert('Por favor, especifica la cantidad de fardos para la mezcla.');
    }
    return;
  }

  // Obtener las variables seleccionadas en la configuración de supervisión
  const selectedVariables = getSelectedSupervisionVariables();

  if (selectedVariables.length === 0) {
    if (!silent) {
      alert('Por favor, selecciona al menos una variable en "Reglas de Mezclas" para optimizar.');
    }
    return;
  }

  isCalculatingBlend.value = true;
  appliedRulesSummary.value = buildAppliedRulesSummary();
  appliedAlgorithmLabel.value = blendAlgorithm.value === 'stability'
    ? 'Golden Batch (máx N, tolerancia informativa)'
    : blendAlgorithm.value === 'stability-strict'
      ? 'Golden Batch Estricto (norma respetada)'
      : 'Estándar (Round Robin)';
  appliedCalculationTimestamp.value = new Date().toLocaleString('es-ES');
  try {
    const response = await fetch('http://localhost:3001/api/inventory/blendomat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stock: sortedFilteredData.value, // Enviar stock filtrado y ordenado según selección
        rules: activeRules.value,
        supervisionSettings: supervisionSettings,
        blendSize: filters.fardos,
        algorithm: blendAlgorithm.value
      })
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.error || 'Error al calcular mezclas');
    }

    const data = await response.json();
    const enrichedData = enrichBlendResultWithTam(data);

    if (enrichedData.success) {
      if (!Array.isArray(enrichedData.plan) || enrichedData.plan.length === 0) {
        const diagnostics = enrichedData.diagnostics || {};
        const friendlyMessage = diagnostics.message || 'No se pudo armar ningún bloque de mezcla con la configuración actual.';
        const details = Array.isArray(diagnostics.details) ? diagnostics.details : [];

        blendUserMessage.value = {
          kind: 'info',
          title: 'No fue posible generar bloques',
          message: friendlyMessage,
          details
        };

        blendPlan.value = enrichedData;
        loteFiacReferenceSummary.value = [];
        isBlendMode.value = true;
        return;
      }

      validateBlendPlanFeasibility(enrichedData);
      blendUserMessage.value = null;
      blendPlan.value = enrichedData;
      await loadLoteFiacReferenceSummary();
      isBlendMode.value = true;
    } else {
      throw new Error('El cálculo no fue exitoso.');
    }
  } catch (error) {
    console.error(error);
    blendUserMessage.value = {
      kind: 'error',
      title: 'Error al calcular mezclas',
      message: error.message || 'No se pudo calcular el plan de mezclas.',
      details: []
    };
    if (!silent) {
      alert(`Error: ${error.message}`);
    }
  } finally {
    isCalculatingBlend.value = false;
  }
};

// Función para exportar Plan de Mezclas a Excel con formato avanzado
const exportToExcel = async () => {
  if (!blendPlan.value || !blendPlan.value.plan) {
    alert('No hay plan de mezclas para exportar.');
    return;
  }

  const plan = blendPlan.value.plan || [];
  const estadisticas = blendPlan.value.estadisticas || {};
  const columnasMezcla = (activeBlendColumns.value && activeBlendColumns.value.length)
    ? [...activeBlendColumns.value]
    : (blendPlan.value.columnasMezcla || []);
  
  // Crear workbook
  const workbook = new ExcelJS.Workbook();
  
  // Colores y estilos
  const headerBg = 'FF1F4E78'; // Azul oscuro
  const headerFont = { color: 'FFFFFFFF', bold: true, size: 11 };
  const titleFont = { bold: true, size: 14, color: 'FF000000' };
  const subTitleFont = { bold: true, size: 11, color: 'FF1F4E78' };
  const centerAlign = { horizontal: 'center', vertical: 'center', wrapText: true };
  const numberFormat = '#,##0.00';

  const applyCellStyleFromUiClass = (cell, uiClass) => {
    if (!uiClass || typeof uiClass !== 'string') return;

    if (uiClass.includes('bg-red-100')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      cell.font = { ...(cell.font || {}), color: { argb: 'FF991B1B' }, bold: true };
      return;
    }

    if (uiClass.includes('bg-green-100')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      cell.font = { ...(cell.font || {}), color: { argb: 'FF166534' } };
      return;
    }

    if (uiClass.includes('bg-yellow-50')) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEFCE8' } };
      cell.font = { ...(cell.font || {}), color: { argb: 'FFA16207' } };
    }
  };

  const applyVerticalCenter = (sheet) => {
    sheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { ...(cell.alignment || {}), vertical: 'middle' };
      });
    });
  };

  const formatCombinedClassifForExport = (row) => {
    const combined = getCombinedClassif(row);
    return combined || '-';
  };
  
  // ===== Hoja 1: Plan de Mezclas =====
  const planSheet = workbook.addWorksheet('Plan de Mezclas');
  const planHeaderBg = 'FF9DC3E6'; // Azul claro para mejor contraste

  const algorithmUsed = appliedAlgorithmLabel.value || 'N/A';
  const exportScopeLabel = showOnlyLargestBlendBlock.value
    ? 'BLOQUE MAYOR'
    : 'TODOS LOS BLOQUES';
  const executedAt = appliedCalculationTimestamp.value || new Date().toLocaleString('es-ES');

  const getRuleValuesForExport = (uiKey) => {
    const rule = getRuleFor(uiKey);
    if (!rule) return { target: 'N/A', tolerance: 'N/A' };

    const target = getRuleDisplay(rule, 'target') || 'N/A';
    const tolerance = getRuleDisplay(rule, 'tolerance') || 'N/A';

    return { target, tolerance };
  };
  
  // Título
  const totalCols = 8 + 3 + columnasMezcla.length * 2;
  planSheet.mergeCells(`A1:${String.fromCharCode(64 + totalCols)}1`);
  const titleCell = planSheet.getCell('A1');
  titleCell.value = {
    richText: [
      { font: { bold: true, size: 14, color: { argb: 'FF000000' } }, text: 'PLAN DE MEZCLAS GENERADO' },
      { font: { bold: false, size: 12, color: { argb: 'FF000000' } }, text: ` | Alcance:${exportScopeLabel} | Algoritmo usado:${algorithmUsed} | Ejecutado:${executedAt}` }
    ]
  };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true, indent: 1 };
  planSheet.getRow(1).height = 25;
  
  // Reglas aplicadas
  planSheet.mergeCells(`A2:${String.fromCharCode(64 + totalCols)}2`);
  const dateCell = planSheet.getCell('A2');
  const micRuleValues = getRuleValuesForExport('MIC');
  const lenRuleValues = getRuleValuesForExport('UHML');
  const strRuleValues = getRuleValuesForExport('STR');
  const infoFont = { size: 10, color: { argb: 'FF1F4E78' } };

  dateCell.value = {
    richText: [
      { font: { ...infoFont, bold: true }, text: 'Reglas aplicadas en este cálculo' },
      { font: infoFont, text: '\n' },
      { font: { ...infoFont, bold: true }, text: 'MIC' },
      { font: infoFont, text: `: Target: ${micRuleValues.target} | Hard Cap | Tolerancia: ${micRuleValues.tolerance}  |  ` },
      { font: { ...infoFont, bold: true }, text: 'LEN (UHML)' },
      { font: infoFont, text: `: Target: ${lenRuleValues.target} | Hard Cap | Tolerancia: ${lenRuleValues.tolerance}  |  ` },
      { font: { ...infoFont, bold: true }, text: 'STR' },
      { font: infoFont, text: `: Target: ${strRuleValues.target} | Hard Cap | Tolerancia: ${strRuleValues.tolerance}` }
    ]
  };
  dateCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
  planSheet.getRow(2).height = 36;
  
  // Encabezados (mismo orden que la UI)
  const headers = [
    'Productor', 'Lote', 'Clasif.', 'Estado', 'Stock', 'Usados', 'Sobrante', 
    'Motivo Sobrante', 'MIC', 'STR', 'LEN'
  ];
  
  // Agregar columnas de mezclas dinámicamente
  columnasMezcla.forEach((mixCol) => {
    headers.push(mixCol);
    headers.push('Saldo');
  });
  
  const headerRow = planSheet.addRow(headers);
  headerRow.font = headerFont;
  headerRow.alignment = centerAlign;
  for (let col = 1; col <= headers.length; col += 1) {
    const cell = headerRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: planHeaderBg } };
  }
  planSheet.getRow(3).height = 20;
  
  // Ancho de columnas customizado (adaptativo a la cantidad de bloques)
  const fixedWidths = [16, 7, 12, 9, 9, 9, 9, 33, 7, 7, 7];
  const columnWidths = headers.map((_, index) => {
    if (index < fixedWidths.length) return fixedWidths[index];
    return 9;
  });
  planSheet.columns = columnWidths.map(width => ({ width }));
  
  // Datos
  plan.forEach(row => {
    const rowData = [
      row.PRODUTOR || '',
      row.LOTE || '',
      formatCombinedClassifForExport(row),
      row.Estado || '',
      row.Stock !== undefined ? row.Stock : '',
      row.Usados !== undefined ? row.Usados : '',
      row.Sobrante !== undefined ? row.Sobrante : '',
      getPlanMotivoLogistico(row),
      row.MIC || '',
      row.STR || '',
      row.LEN || ''
    ];
    
    // Mezclas y Saldo
    columnasMezcla.forEach((mixCol, idx) => {
      rowData.push(row.mezclas && row.mezclas[mixCol] ? row.mezclas[mixCol] : '');
      const saldoValue = Number(getStockActualForBlock(row, idx));
      rowData.push(Number.isNaN(saldoValue) ? '' : saldoValue);
    });
    
    const newRow = planSheet.addRow(rowData);
    newRow.alignment = { horizontal: 'center', vertical: 'center' };
    
    // Colorear Estado
    const estadoCell = newRow.getCell(4);
    if (row.Estado === 'NO USO' || row.Estado === 'RECH.') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
    } else if (row.Estado === 'USO') {
      estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } };
    }

    const micCell = newRow.getCell(9);
    const strCell = newRow.getCell(10);
    const lenCell = newRow.getCell(11);
    applyCellStyleFromUiClass(micCell, getCellClass(row, 'MIC'));
    applyCellStyleFromUiClass(strCell, getCellClass(row, 'STR'));
    applyCellStyleFromUiClass(lenCell, getCellClass(row, 'UHML'));
  });

  // SUBTOTALES
  // Calcular sumas para las columnas numéricas
  const subtotales = {
    stock: 0,
    usados: 0,
    sobrante: 0,
    mezclas: {}, // Para cada columna de mezcla
    saldos: {}   // Para cada columna de saldo
  };
  
  plan.forEach(row => {
    subtotales.stock += Number(row.Stock) || 0;
    subtotales.usados += Number(row.Usados) || 0;
    subtotales.sobrante += Number(row.Sobrante) || 0;
    
    // Sumar mezclas y saldos
    columnasMezcla.forEach((mixCol, idx) => {
      if (!subtotales.mezclas[mixCol]) subtotales.mezclas[mixCol] = 0;
      if (!subtotales.saldos[mixCol]) subtotales.saldos[mixCol] = 0;
      
      const mezclaValue = row.mezclas && row.mezclas[mixCol] ? Number(row.mezclas[mixCol]) : 0;
      subtotales.mezclas[mixCol] += mezclaValue || 0;
      
      const saldoValue = Number(getStockActualForBlock(row, idx));
      subtotales.saldos[mixCol] += (Number.isNaN(saldoValue) ? 0 : saldoValue);
    });
  });
  
  // Agregar fila de subtotales
  const subtotalesRowData = [
    '', // Productor
    '', // Lote
    '', // Clasif.
    'SUBTOTALES', // Estado
    subtotales.stock,
    subtotales.usados,
    subtotales.sobrante,
    '', // Motivo Sobrante
    '', // MIC
    '', // STR
    ''  // LEN
  ];
  
  // Agregar subtotales de mezclas y saldos
  columnasMezcla.forEach((mixCol) => {
    subtotalesRowData.push(subtotales.mezclas[mixCol] || 0);
    subtotalesRowData.push(subtotales.saldos[mixCol] || 0);
  });
  
  const subtotalesRow = planSheet.addRow(subtotalesRowData);
  subtotalesRow.font = { bold: true, size: 11 };
  subtotalesRow.alignment = { horizontal: 'center', vertical: 'center' };
  for (let col = 1; col <= headers.length; col += 1) {
    const cell = subtotalesRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4F8' } };
  }
  
  // Aplicar borde superior a la fila de subtotales
  subtotalesRow.eachCell({ includeEmpty: false }, (cell) => {
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF1F4E78' } }
    };
    // Formato numérico para celdas numéricas (sin decimales, con separador de millar)
    if (typeof cell.value === 'number') {
      cell.numFmt = '#,##0';
    }
  });

  // Bordes gris claro para toda la tabla (encabezados + datos + subtotales)
  for (let rowNumber = 3; rowNumber <= subtotalesRow.number; rowNumber += 1) {
    const rowRef = planSheet.getRow(rowNumber);
    for (let colNumber = 1; colNumber <= headers.length; colNumber += 1) {
      const cell = rowRef.getCell(colNumber);
      const hasTopMediumBorder = rowNumber === subtotalesRow.number;
      cell.border = {
        top: hasTopMediumBorder
          ? { style: 'medium', color: { argb: 'FF1F4E78' } }
          : { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    }
  }

  // ===== Estadísticas debajo de subtotales (desde columna H) =====
  const statsStartCol = 9; // Columna I
  const statsLabelCol = statsStartCol;
  const statsTypeCol = statsStartCol + 1;
  const statsMetricCol = statsStartCol + 2;
  const firstBlockValueCol = 12; // Primera columna de bloque (M1-...)
  const statsEndCol = headers.length;

  const toNumeric = (value, fallback = 0) => {
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? fallback : numericValue;
  };

  const getBlockValueCol = (blockIndex) => firstBlockValueCol + (blockIndex * 2);

  const statsRowsConfig = [
    {
      label: 'Mezcla',
      rows: [
        {
          type: 'Cantidad',
          metric: 'Fardos',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.totalFardos, 0),
          numFmt: '#,##0'
        },
        {
          type: '',
          metric: 'Bloques',
          valueGetter: (blockId) => toNumeric(getBlockMixCount(blockId), 0),
          numFmt: '#,##0'
        },
        {
          type: 'Peso',
          metric: 'Por Mezcla',
          valueGetter: (blockId) => toNumeric(getPesoPorMezclaForColumn(blockId), 0),
          numFmt: '#,##0'
        },
        {
          type: '',
          metric: 'Por Bloque',
          valueGetter: (blockId) => toNumeric(getPesoTotalBloqueForColumn(blockId), 0),
          numFmt: '#,##0'
        }
      ]
    },
    {
      label: 'MIC',
      rows: [
        {
          type: 'Promedio',
          metric: 'Bloque',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.MIC?.promedioGeneral, 0),
          numFmt: '0.00'
        },
        {
          type: '',
          metric: '90%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.MIC?.promedioIdeal, 0),
          numFmt: '0.00'
        },
        {
          type: '',
          metric: '10%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.MIC?.promedioTolerancia, 0),
          numFmt: '0.00'
        },
        {
          type: 'Porcentual',
          metric: '90%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.MIC?.pctIdeal, 0) / 100,
          numFmt: '0.0%'
        },
        {
          type: '',
          metric: '10%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.MIC?.pctTolerancia, 0) / 100,
          numFmt: '0.0%'
        }
      ]
    },
    {
      label: 'STR',
      rows: [
        {
          type: 'Promedio',
          metric: 'Bloque',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.STR?.promedioGeneral, 0),
          numFmt: '0.00'
        },
        {
          type: '',
          metric: '80%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.STR?.promedioIdeal, 0),
          numFmt: '0.00'
        },
        {
          type: '',
          metric: '20%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.STR?.promedioTolerancia, 0),
          numFmt: '0.00'
        },
        {
          type: 'Porcentual',
          metric: '80%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.STR?.pctIdeal, 0) / 100,
          numFmt: '0.0%'
        },
        {
          type: '',
          metric: '20%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.STR?.pctTolerancia, 0) / 100,
          numFmt: '0.0%'
        }
      ]
    },
    {
      label: 'LEN',
      rows: [
        {
          type: 'Promedio',
          metric: 'Bloque',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.LEN?.promedioGeneral, 0),
          numFmt: '0.00'
        },
        {
          type: '',
          metric: '80%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.LEN?.promedioIdeal, 0),
          numFmt: '0.00'
        },
        {
          type: '',
          metric: '20%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.LEN?.promedioTolerancia, 0),
          numFmt: '0.00'
        },
        {
          type: 'Porcentual',
          metric: '80%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.LEN?.pctIdeal, 0) / 100,
          numFmt: '0.0%'
        },
        {
          type: '',
          metric: '20%',
          valueGetter: (blockId) => toNumeric(estadisticas?.[blockId]?.variables?.LEN?.pctTolerancia, 0) / 100,
          numFmt: '0.0%'
        }
      ]
    }
  ];

  let currentStatsRow = subtotalesRow.number + 1;
  const statsSectionStartRows = [];

  statsRowsConfig.forEach((section) => {
    const sectionStartRow = currentStatsRow;
    statsSectionStartRows.push(sectionStartRow);

    section.rows.forEach((rowDef, rowIndex) => {
      const rowRef = planSheet.getRow(currentStatsRow);

      if (rowIndex === 0) {
        rowRef.getCell(statsLabelCol).value = section.label;
      }

      rowRef.getCell(statsTypeCol).value = rowDef.type || '';
      rowRef.getCell(statsMetricCol).value = rowDef.metric || '';

      columnasMezcla.forEach((blockId, blockIndex) => {
        const valueCol = getBlockValueCol(blockIndex);
        const valueCell = rowRef.getCell(valueCol);
        valueCell.value = rowDef.valueGetter(blockId);
        valueCell.numFmt = rowDef.numFmt;
      });

      for (let colNumber = statsStartCol; colNumber <= statsEndCol; colNumber += 1) {
        const cell = rowRef.getCell(colNumber);
        const isSectionStart = rowIndex === 0;
        const isSectionEnd = rowIndex === section.rows.length - 1;

        cell.border = {
          top: isSectionStart
            ? { style: 'medium', color: { argb: 'FF4B5563' } }
            : { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: isSectionEnd
            ? { style: 'medium', color: { argb: 'FF4B5563' } }
            : { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };

        if (colNumber >= statsStartCol && colNumber <= statsMetricCol) {
          cell.font = { ...(cell.font || {}), bold: true, color: { argb: 'FF111827' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          if (cell.value !== null && cell.value !== undefined && cell.value !== '') {
            cell.font = { ...(cell.font || {}), bold: true, color: { argb: 'FF0F172A' } };
          }
        }
      }

      currentStatsRow += 1;
    });

    // Merge vertical labels por sección (columna H)
    if (section.rows.length > 1) {
      planSheet.mergeCells(sectionStartRow, statsLabelCol, currentStatsRow - 1, statsLabelCol);
    }

    // Merge "Promedio" y "Porcentual" para MIC/STR/LEN en columna I
    if (['MIC', 'STR', 'LEN'].includes(section.label)) {
      planSheet.mergeCells(sectionStartRow, statsTypeCol, sectionStartRow + 2, statsTypeCol);
      planSheet.mergeCells(sectionStartRow + 3, statsTypeCol, sectionStartRow + 4, statsTypeCol);
    }
  });

  applyVerticalCenter(planSheet);
  
  // ===== Hoja 2: Estadísticas =====
  const statsSheet = workbook.addWorksheet('Estadísticas');
  
  // Título
  statsSheet.mergeCells('A1:B1');
  const statsTitle = statsSheet.getCell('A1');
  statsTitle.value = 'ESTADÍSTICAS Y CONFIGURACIÓN';
  statsTitle.font = titleFont;
  statsTitle.alignment = centerAlign;
  statsSheet.getRow(1).height = 22;
  
  let statsRow = 3;
  
  // Información general
  statsSheet.getCell(`A${statsRow}`).value = 'Algoritmo';
  statsSheet.getCell(`A${statsRow}`).font = subTitleFont;
  statsSheet.getCell(`B${statsRow}`).value = appliedAlgorithmLabel.value || 'N/A';
  statsRow++;
  
  statsSheet.getCell(`A${statsRow}`).value = 'Fecha de Cálculo';
  statsSheet.getCell(`A${statsRow}`).font = subTitleFont;
  statsSheet.getCell(`B${statsRow}`).value = appliedCalculationTimestamp.value || 'N/A';
  statsRow++;
  
  statsSheet.getCell(`A${statsRow}`).value = 'Fardos por mezcla';
  statsSheet.getCell(`A${statsRow}`).font = subTitleFont;
  statsSheet.getCell(`B${statsRow}`).value = filters.fardos || 'N/A';
  statsRow++;
  
  // Reglas aplicadas
  if (appliedRulesSummary.value && appliedRulesSummary.value.length > 0) {
    statsRow++;
    statsSheet.getCell(`A${statsRow}`).value = 'REGLAS APLICADAS';
    statsSheet.getCell(`A${statsRow}`).font = subTitleFont;
    statsRow++;
    
    appliedRulesSummary.value.forEach(rule => {
      statsSheet.getCell(`A${statsRow}`).value = rule.variable;
      statsSheet.getCell(`B${statsRow}`).value = rule.target !== undefined ? rule.target : 'N/A';
      statsRow++;
    });
  }
  
  // Estadísticas por bloque
  if (estadisticas.mezclasBloque) {
    statsRow++;
    statsSheet.getCell(`A${statsRow}`).value = 'ESTADÍSTICAS POR BLOQUE';
    statsSheet.getCell(`A${statsRow}`).font = subTitleFont;
    statsRow++;
    
    Object.entries(estadisticas.mezclasBloque).forEach(([blockKey, stats]) => {
      statsSheet.getCell(`A${statsRow}`).value = blockKey;
      statsSheet.getCell(`A${statsRow}`).font = { bold: true };
      statsRow++;
      
      if (stats.media !== undefined) {
        statsSheet.getCell(`B${statsRow}`).value = 'Media';
        statsSheet.getCell(`C${statsRow}`).value = stats.media;
        statsRow++;
      }
      if (stats.min !== undefined) {
        statsSheet.getCell(`B${statsRow}`).value = 'Mínimo';
        statsSheet.getCell(`C${statsRow}`).value = stats.min;
        statsRow++;
      }
      if (stats.max !== undefined) {
        statsSheet.getCell(`B${statsRow}`).value = 'Máximo';
        statsSheet.getCell(`C${statsRow}`).value = stats.max;
        statsRow++;
      }
      if (stats.n !== undefined) {
        statsSheet.getCell(`B${statsRow}`).value = 'Cantidad';
        statsSheet.getCell(`C${statsRow}`).value = stats.n;
        statsRow++;
      }
    });
  }
  
  statsSheet.columns = [{ width: 25 }, { width: 20 }, { width: 20 }];

  applyVerticalCenter(statsSheet);
  
  // ===== Hoja 3: Resumen de Stock =====
  if (plan.length > 0) {
    const summarySheet = workbook.addWorksheet('Resumen Stock');
    
    summarySheet.mergeCells('A1:H1');
    const summaryTitle = summarySheet.getCell('A1');
    summaryTitle.value = 'RESUMEN DE STOCK';
    summaryTitle.font = titleFont;
    summaryTitle.alignment = centerAlign;
    summarySheet.getRow(1).height = 22;
    
    const summaryHeaders = ['Productor', 'Lote', 'Clasif.', 'Destino', 'Stock', 'Usados', 'Sobrante', 'Estado'];
    const summaryHeaderRow = summarySheet.addRow(summaryHeaders);
    summaryHeaderRow.font = headerFont;
    summaryHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerBg } };
    summaryHeaderRow.alignment = centerAlign;
    
    plan.forEach(row => {
      const summaryRow = summarySheet.addRow([
        row.PRODUTOR || '',
        row.LOTE || '',
        formatCombinedClassifForExport(row),
        row.DESTINO || '',
        row.Stock !== undefined ? row.Stock : '',
        row.Usados !== undefined ? row.Usados : '',
        row.Sobrante !== undefined ? row.Sobrante : '',
        row.Estado || ''
      ]);
      summaryRow.alignment = { horizontal: 'center' };
    });
    
    summarySheet.columns = [
      { width: 15 }, { width: 12 }, { width: 12 }, { width: 15 }, { width: 10 },
      { width: 10 }, { width: 10 }, { width: 15 }
    ];

    applyVerticalCenter(summarySheet);
  }

  // ===== Hoja 4: Compra Sugerida =====
  const projectionSheet = workbook.addWorksheet('Compra Sugerida');

  projectionSheet.mergeCells('A1:H1');
  const projectionTitle = projectionSheet.getCell('A1');
  projectionTitle.value = 'PROYECCIÓN DE COMPRA POR CALIDAD';
  projectionTitle.font = titleFont;
  projectionTitle.alignment = centerAlign;
  projectionSheet.getRow(1).height = 22;

  const projectionSourceLabel = purchaseProjection.source === 'remanente'
    ? 'Sobrante no usado'
    : 'Stock actual';

  const projectionMetaRows = [
    ['Fuente disponible', projectionSourceLabel],
    ['Mezclas objetivo', Number(purchaseProjection.targetMixes) || 0],
    ['Mínimo recomendado de bloque', Number(purchaseProjection.minMixesForBlock) || 20],
    ['Fardos por mezcla', Number(filters.fardos) || 0],
    ['Mezclas base generadas', Number(generatedMixesCount.value) || 0],
    ['Stock total fuente (fardos)', Number(projectionSourceTotals.value?.stockFardos) || 0],
    ['Peso total fuente (kg)', Number(projectionSourceTotals.value?.stockPeso) || 0]
  ];

  let projectionRowIndex = 3;
  projectionMetaRows.forEach(([label, value]) => {
    projectionSheet.getCell(`A${projectionRowIndex}`).value = label;
    projectionSheet.getCell(`A${projectionRowIndex}`).font = subTitleFont;
    projectionSheet.getCell(`B${projectionRowIndex}`).value = value;
    projectionSheet.getCell(`B${projectionRowIndex}`).alignment = { horizontal: 'left', vertical: 'middle' };
    projectionRowIndex += 1;
  });

  projectionRowIndex += 1;

  const projectionHeaders = [
    'Calidad',
    'Receta x mezcla',
    'Requerido',
    'Disponible',
    'Faltante',
    'Compra sugerida (fardos)',
    'Peso estimado compra',
    'Orientación HVI compra (según selección)'
  ];

  const projectionHeaderRow = projectionSheet.getRow(projectionRowIndex);
  projectionHeaders.forEach((header, index) => {
    const cell = projectionHeaderRow.getCell(index + 1);
    cell.value = header;
    cell.font = headerFont;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
    cell.alignment = centerAlign;
  });
  projectionHeaderRow.height = 20;

  const projectionDataStartRow = projectionRowIndex + 1;
  const projectionRows = purchaseProjectionRows.value || [];

  if (projectionRows.length === 0) {
    projectionSheet.mergeCells(`A${projectionDataStartRow}:H${projectionDataStartRow}`);
    const emptyCell = projectionSheet.getCell(`A${projectionDataStartRow}`);
    emptyCell.value = purchaseProjectionError.value || 'No hay datos suficientes para proyectar compra por calidad.';
    emptyCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    emptyCell.font = { color: { argb: 'FF6B7280' }, italic: true };
  } else {
    projectionRows.forEach((row, idx) => {
      const dataRow = projectionSheet.getRow(projectionDataStartRow + idx);
      dataRow.getCell(1).value = row.calidad;
      dataRow.getCell(2).value = Number(row.recetaPorMezcla) || 0;
      dataRow.getCell(3).value = Number(row.requerido) || 0;
      dataRow.getCell(4).value = Number(row.disponible) || 0;
      dataRow.getCell(5).value = Number(row.faltante) || 0;
      dataRow.getCell(6).value = Number(row.compraSugeridaFardos) || 0;
      dataRow.getCell(7).value = Number(row.compraSugeridaPeso) || 0;
      const guidanceText = Array.isArray(row.hviGuidance)
        ? row.hviGuidance
          .map((guidance) => `${guidance.label} (Disp ${formatProjectionValue(guidance.avgAvailable, 2)}): ${buildGuidanceSummary(guidance, row.compraSugeridaFardos)}`)
          .join('\n')
        : '';
      dataRow.getCell(8).value = guidanceText;

      dataRow.getCell(2).numFmt = '0.00';
      dataRow.getCell(3).numFmt = '0.00';
      dataRow.getCell(4).numFmt = '0.00';
      dataRow.getCell(5).numFmt = '0.00';
      dataRow.getCell(6).numFmt = '#,##0';
      dataRow.getCell(7).numFmt = '#,##0';

      for (let col = 1; col <= 8; col += 1) {
        const cell = dataRow.getCell(col);
        cell.alignment = {
          horizontal: col === 1 || col === 8 ? 'left' : 'right',
          vertical: 'middle'
        };
      }
      dataRow.getCell(8).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

      if ((Number(row.faltante) || 0) > 0) {
        const shortageCell = dataRow.getCell(5);
        shortageCell.font = { ...(shortageCell.font || {}), bold: true, color: { argb: 'FFB91C1C' } };
      }
    });

    const totalsRowIndex = projectionDataStartRow + projectionRows.length;
    const totalsRow = projectionSheet.getRow(totalsRowIndex);
    totalsRow.getCell(1).value = 'TOTALES';
    totalsRow.getCell(1).font = { bold: true, color: { argb: 'FF14532D' } };
    totalsRow.getCell(3).value = Number(purchaseProjectionTotals.value.requerido) || 0;
    totalsRow.getCell(4).value = Number(purchaseProjectionTotals.value.disponible) || 0;
    totalsRow.getCell(5).value = Number(purchaseProjectionTotals.value.faltante) || 0;
    totalsRow.getCell(6).value = Number(purchaseProjectionTotals.value.compraSugeridaFardos) || 0;
    totalsRow.getCell(7).value = Number(purchaseProjectionTotals.value.compraSugeridaPeso) || 0;

    totalsRow.getCell(3).numFmt = '0.00';
    totalsRow.getCell(4).numFmt = '0.00';
    totalsRow.getCell(5).numFmt = '0.00';
    totalsRow.getCell(6).numFmt = '#,##0';
    totalsRow.getCell(7).numFmt = '#,##0';

    for (let col = 1; col <= 8; col += 1) {
      const cell = totalsRow.getCell(col);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
      cell.font = { ...(cell.font || {}), bold: true, color: { argb: 'FF14532D' } };
      cell.alignment = {
        horizontal: col === 1 || col === 8 ? 'left' : 'right',
        vertical: 'middle'
      };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF065F46' } },
        left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
      };
    }
  }

  if (projectionVariablePurchaseRows.value.length > 0) {
    const variableSectionStart = (projectionSheet.lastRow?.number || projectionDataStartRow) + 2;

    projectionSheet.mergeCells(`A${variableSectionStart}:H${variableSectionStart}`);
    const variableTitleCell = projectionSheet.getCell(`A${variableSectionStart}`);
    variableTitleCell.value = 'COMPRA GLOBAL POR VARIABLE HVI (SEGÚN REGLAS ACTIVAS)';
    variableTitleCell.font = { ...subTitleFont, bold: true };
    variableTitleCell.alignment = { horizontal: 'left', vertical: 'middle' };

    const variableHeaderRowIndex = variableSectionStart + 1;
    const variableHeaders = ['Variable', 'Promedio actual', 'Objetivo de compra según regla', 'Kg compra global'];
    variableHeaders.forEach((header, idx) => {
      const cell = projectionSheet.getRow(variableHeaderRowIndex).getCell(idx + 1);
      cell.value = header;
      cell.font = headerFont;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2E7D32' } };
      cell.alignment = centerAlign;
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF065F46' } },
        left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
        right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
      };
    });

    projectionVariablePurchaseRows.value.forEach((item, index) => {
      const rowIndex = variableHeaderRowIndex + 1 + index;
      const rowRef = projectionSheet.getRow(rowIndex);

      rowRef.getCell(1).value = item.label;
      rowRef.getCell(2).value = Number(item.sourceAverage) || 0;
      rowRef.getCell(3).value = item.recomendacion;
      rowRef.getCell(4).value = Number(item.totalKgToBuy) || 0;

      rowRef.getCell(2).numFmt = '0.00';
      rowRef.getCell(4).numFmt = '#,##0';

      rowRef.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      rowRef.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      rowRef.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      rowRef.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };

      for (let col = 1; col <= 4; col += 1) {
        const cell = rowRef.getCell(col);
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
          right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };
      }
    });
  }

  projectionSheet.columns = [
    { width: 20 },
    { width: 16 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 22 },
    { width: 20 },
    { width: 60 }
  ];

  const projectionLastRow = projectionSheet.lastRow?.number || projectionDataStartRow;
  for (let rowNumber = projectionRowIndex; rowNumber <= projectionLastRow; rowNumber += 1) {
    const rowRef = projectionSheet.getRow(rowNumber);
    for (let colNumber = 1; colNumber <= 8; colNumber += 1) {
      const cell = rowRef.getCell(colNumber);
      if (rowNumber === projectionRowIndex) {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF065F46' } },
          left: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          bottom: { style: 'thin', color: { argb: 'FFA7F3D0' } },
          right: { style: 'thin', color: { argb: 'FFA7F3D0' } }
        };
        continue;
      }

      if (cell.border?.top?.style === 'medium') continue;

      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    }
  }

  applyVerticalCenter(projectionSheet);
  
  // Descargar (en navegador, usar blob)
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = [String(now.getHours()).padStart(2, '0'), String(now.getMinutes()).padStart(2, '0'), String(now.getSeconds()).padStart(2, '0')].join('_');
  const timestamp = `${date}_${time}`;
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  // Crear enlace de descarga
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Plan_Mezclas_${timestamp}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

.compact-summary-footer td {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.compact-plan-table th,
.compact-plan-table td,
.stock-table th,
.stock-table td {
  padding-left: 0.25rem;
  padding-right: 0.25rem;
}

.compact-plan-table tbody td {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.stock-table tbody td {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.compact-remanentes-table tbody td {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.compact-summary-footer .summary-matrix-cell {
  border-left: 1px solid rgb(156 163 175);
  border-top: 1px solid rgb(156 163 175);
}

.compact-summary-footer .summary-matrix-row.summary-matrix-group-start .summary-matrix-cell {
  border-top-width: 2px;
  border-top-color: rgb(55 65 81);
}

.compact-summary-footer .summary-matrix-row.summary-matrix-section-break .summary-matrix-cell {
  border-top-width: 1.5px;
  border-top-color: rgb(107 114 128);
}

.compact-summary-footer .summary-matrix-row .summary-matrix-value:last-child {
  border-right: 1px solid rgb(156 163 175);
}

.compact-summary-footer .summary-matrix-row.summary-matrix-group-end .summary-matrix-cell {
  border-bottom: 1px solid rgb(156 163 175);
}
</style>
