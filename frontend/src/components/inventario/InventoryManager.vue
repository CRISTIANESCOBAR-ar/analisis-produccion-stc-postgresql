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

        <div v-if="appliedRulesSummary.length || appliedAlgorithmLabel || appliedCalculationTimestamp" class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 class="text-sm font-bold text-blue-800 mb-2">Reglas aplicadas en este cálculo</h3>
          <div v-if="appliedAlgorithmLabel" class="text-xs text-blue-900">
            <span class="font-semibold">Algoritmo usado:</span>
            <span class="ml-1">{{ appliedAlgorithmLabel }}</span>
          </div>
          <div v-if="appliedCalculationTimestamp" class="mb-2 text-xs text-blue-900">
            <span class="font-semibold">Ejecutado:</span>
            <span class="ml-1">{{ appliedCalculationTimestamp }}</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            <div
              v-for="(rule, idx) in appliedRulesSummary"
              :key="`${rule.parametro}-${idx}`"
              class="bg-white border border-blue-100 rounded px-2 py-1.5 text-xs"
            >
              <div class="font-semibold text-blue-900">{{ rule.parametro }}</div>
              <div class="text-gray-700">{{ rule.detalle }}</div>
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
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Productor</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lote</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Usados</th>
                  <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Sobrante</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Motivo Logístico</th>
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
                  <td class="px-4 py-2 text-sm text-center font-semibold text-slate-700">{{ row.Stock ?? '-' }}</td>
                  <td class="px-4 py-2 text-sm text-center font-semibold text-blue-700">{{ row.Usados ?? '-' }}</td>
                  <td class="px-4 py-2 text-sm text-center font-semibold text-amber-700">{{ row.Sobrante ?? '-' }}</td>
                  <td class="px-4 py-2 text-sm text-gray-700">
                    <span v-if="Number(row.Sobrante) === 0" class="font-semibold text-emerald-700">Usado en plan (se usó todo)</span>
                    <span v-else-if="row.Estado === 'TOLER.'" class="font-medium text-amber-700">Usado en plan (tolerancia permitida)</span>
                    <span v-else class="font-medium text-slate-700">Usado en plan (consumo parcial)</span>
                  </td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'MIC')">{{ formatValue(row.MIC, 'MIC') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'STR')">{{ formatValue(row.STR, 'STR') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'UHML')">{{ formatValue(row.LEN, 'UHML') }}</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="col" class="px-4 py-2 text-sm text-center font-bold border-l border-gray-200" :class="row.mezclas[col] ? 'text-indigo-600 bg-indigo-50/30' : 'text-gray-300'">
                    {{ row.mezclas[col] || '-' }}
                  </td>
                </tr>
              </tbody>
              <tfoot class="bg-gray-50 border-t-2 border-gray-300 compact-summary-footer">
                <!-- Resumen Mezcla (Cantidad / Peso) -->
                <tr class="summary-matrix-row summary-matrix-group-start">
                  <td colspan="3" class="px-4 py-2 text-sm font-bold text-right text-gray-700 border-b border-gray-300">TOTALES LOTES</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-slate-800 border-b border-gray-300">{{ formatThousandInteger(planLotTotals.stock) }}</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-blue-700 border-b border-gray-300">{{ formatThousandInteger(planLotTotals.usados) }}</td>
                  <td class="px-4 py-2 text-sm text-center font-bold text-amber-700 border-b border-gray-300">{{ formatThousandInteger(planLotTotals.sobrante) }}</td>
                  <td class="px-4 py-2 text-sm text-center text-gray-400 border-b border-gray-300">—</td>
                  <td rowspan="4" class="summary-matrix-cell px-4 py-2 text-sm font-bold text-center text-gray-800">Mezcla</td>
                  <td rowspan="2" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Cantidad</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Fardos</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mix-fardos-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900">
                    {{ blendPlan.estadisticas[col].totalFardos }}
                  </td>
                </tr>
                <tr class="summary-matrix-row">
                  <td colspan="7" rowspan="18" class="px-4 py-2 align-top border-r border-gray-300">
                    <div v-if="activeBlendVariablesForSummary.length" class="h-full border border-slate-300 rounded-md overflow-hidden bg-white">
                      <div class="px-3 py-2 bg-slate-50 border-b border-slate-300">
                        <h3 class="text-sm font-bold text-slate-800">Resumen de lotes (promedios de variables activas)</h3>
                      </div>
                      <table class="w-full compact-remanentes-table">
                        <thead class="bg-gray-50">
                          <tr class="border-b border-gray-300">
                            <th class="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Variable</th>
                            <th v-for="col in blendPlan.columnasMezcla" :key="`res-inline-${col}`" class="px-3 py-2 text-center text-xs font-semibold text-indigo-700 uppercase tracking-wide border-l border-gray-200">
                              {{ col }}
                            </th>
                          </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-gray-100">
                          <tr v-for="variable in activeBlendVariablesForSummary" :key="`res-inline-row-${variable.uiKey}`">
                            <td class="px-3 py-2 text-sm font-semibold text-gray-700">{{ variable.label }}</td>
                            <td
                              v-for="col in blendPlan.columnasMezcla"
                              :key="`res-inline-${variable.uiKey}-${col}`"
                              class="px-3 py-2 text-sm text-center border-l border-gray-200"
                              :class="getSummaryCellClass(blendPlan.estadisticas[col].variables?.[variable.ruleParam]?.promedioGeneral, variable.uiKey)"
                            >
                              {{ formatValue(blendPlan.estadisticas[col].variables?.[variable.ruleParam]?.promedioGeneral, variable.formatKey) }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Bloques</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mix-bloques-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900">
                    {{ getBlockMixCount(col) }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-section-break">
                  <td rowspan="2" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Peso</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Por Mezcla</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mix-pmezcla-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900">
                    {{ formatValue(getPesoPorMezclaForColumn(col), 'PESO') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-group-end">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Por Bloque</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mix-pbloque-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center font-bold text-gray-900">
                    {{ formatValue(getPesoTotalBloqueForColumn(col), 'PESO') }}
                  </td>
                </tr>

                <!-- MIC -->
                <tr class="summary-matrix-row summary-matrix-group-start">
                  <td rowspan="5" class="summary-matrix-cell px-4 py-2 text-sm font-bold text-center text-gray-800">MIC</td>
                  <td rowspan="3" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Promedio</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Bloque</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-bloque-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.MIC?.promedioGeneral, 'MIC')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.MIC?.promedioGeneral, 'MIC') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">90%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-90-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.MIC?.promedioIdeal, 'MIC')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.MIC?.promedioIdeal, 'MIC') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">10%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-10-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.MIC?.promedioTolerancia, 'MIC')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.MIC?.promedioTolerancia, 'MIC') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-section-break">
                  <td rowspan="2" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Porcentual</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">90%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-pct-90-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.MIC?.pctIdeal, 'MIC', 'pctIdeal')">
                    {{ blendPlan.estadisticas[col].variables.MIC?.pctIdeal !== undefined ? `${blendPlan.estadisticas[col].variables.MIC.pctIdeal.toFixed(1)}%` : '-' }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-group-end">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">10%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'mic-pct-10-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.MIC?.pctTolerancia, 'MIC', 'pctTolerancia')">
                    {{ blendPlan.estadisticas[col].variables.MIC?.pctTolerancia !== undefined ? `${blendPlan.estadisticas[col].variables.MIC.pctTolerancia.toFixed(1)}%` : '-' }}
                  </td>
                </tr>

                <!-- STR -->
                <tr class="summary-matrix-row summary-matrix-group-start">
                  <td rowspan="5" class="summary-matrix-cell px-4 py-2 text-sm font-bold text-center text-gray-800">STR</td>
                  <td rowspan="3" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Promedio</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Bloque</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-bloque-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.STR?.promedioGeneral, 'STR')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.STR?.promedioGeneral, 'STR') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">80%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-80-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.STR?.promedioIdeal, 'STR')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.STR?.promedioIdeal, 'STR') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-20-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.STR?.promedioTolerancia, 'STR')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.STR?.promedioTolerancia, 'STR') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-section-break">
                  <td rowspan="2" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Porcentual</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">80%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-pct-80-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.STR?.pctIdeal, 'STR', 'pctIdeal')">
                    {{ blendPlan.estadisticas[col].variables.STR?.pctIdeal !== undefined ? `${blendPlan.estadisticas[col].variables.STR.pctIdeal.toFixed(1)}%` : '-' }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-group-end">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'str-pct-20-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.STR?.pctTolerancia, 'STR', 'pctTolerancia')">
                    {{ blendPlan.estadisticas[col].variables.STR?.pctTolerancia !== undefined ? `${blendPlan.estadisticas[col].variables.STR.pctTolerancia.toFixed(1)}%` : '-' }}
                  </td>
                </tr>

                <!-- LEN -->
                <tr class="summary-matrix-row summary-matrix-group-start">
                  <td rowspan="5" class="summary-matrix-cell px-4 py-2 text-sm font-bold text-center text-gray-800">LEN</td>
                  <td rowspan="3" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Promedio</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Bloque</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-bloque-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.LEN?.promedioGeneral, 'UHML')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.LEN?.promedioGeneral, 'UHML') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">80%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-80-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.LEN?.promedioIdeal, 'UHML')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.LEN?.promedioIdeal, 'UHML') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-20-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.LEN?.promedioTolerancia, 'UHML')">
                    {{ formatValue(blendPlan.estadisticas[col].variables.LEN?.promedioTolerancia, 'UHML') }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-section-break">
                  <td rowspan="2" class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">Porcentual</td>
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">80%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-pct-80-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.LEN?.pctIdeal, 'UHML', 'pctIdeal')">
                    {{ blendPlan.estadisticas[col].variables.LEN?.pctIdeal !== undefined ? `${blendPlan.estadisticas[col].variables.LEN.pctIdeal.toFixed(1)}%` : '-' }}
                  </td>
                </tr>
                <tr class="summary-matrix-row summary-matrix-group-end">
                  <td class="summary-matrix-cell px-4 py-2 text-sm font-semibold text-center text-gray-700">20%</td>
                  <td v-for="col in blendPlan.columnasMezcla" :key="'len-pct-20-'+col" class="summary-matrix-cell summary-matrix-value px-4 py-2 text-sm text-center" :class="getSummaryCellClass(blendPlan.estadisticas[col].variables.LEN?.pctTolerancia, 'UHML', 'pctTolerancia')">
                    {{ blendPlan.estadisticas[col].variables.LEN?.pctTolerancia !== undefined ? `${blendPlan.estadisticas[col].variables.LEN.pctTolerancia.toFixed(1)}%` : '-' }}
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
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'MIC')">{{ formatValue(row.MIC, 'MIC') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'STR')">{{ formatValue(row.STR, 'STR') }}</td>
                  <td class="px-4 py-2 text-sm" :class="getCellClass(row, 'UHML')">{{ formatValue(row.LEN, 'UHML') }}</td>
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
import { ref, computed, reactive, onMounted, onBeforeUnmount, watch } from 'vue';
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
const appliedRulesSummary = ref([]);
const appliedAlgorithmLabel = ref('');
const appliedCalculationTimestamp = ref('');

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
  searchText: '',
  fardos: null
});

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
      blendAlgorithm: blendAlgorithm.value,
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

    const allowedAlgorithms = ['standard', 'stability', 'stability-strict'];
    if (allowedAlgorithms.includes(prefs.blendAlgorithm)) {
      blendAlgorithm.value = prefs.blendAlgorithm;
    }

    if (Array.isArray(prefs.selectedColumns)) {
      const validColumns = new Set(allColumns.map(c => c.key));
      const lockedColumns = allColumns.filter(c => c.locked).map(c => c.key);

      const restored = prefs.selectedColumns.filter(key => validColumns.has(key));
      lockedColumns.forEach(key => {
        if (!restored.includes(key)) restored.push(key);
      });

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

onBeforeUnmount(() => {
  if (autoBlendRecalcTimeout) {
    clearTimeout(autoBlendRecalcTimeout);
    autoBlendRecalcTimeout = null;
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

const getBlockMixCount = (colId) => {
  const fromStats = Number(blendPlan.value?.estadisticas?.[colId]?.mezclasBloque);
  if (!Number.isNaN(fromStats) && fromStats > 0) return fromStats;
  return getMixesFromBlockId(colId);
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

const planLotTotals = computed(() => {
  const rows = blendPlan.value?.plan || [];

  return rows.reduce((totals, row) => {
    totals.stock += Number(row.Stock) || 0;
    totals.usados += Number(row.Usados) || 0;
    totals.sobrante += Number(row.Sobrante) || 0;
    return totals;
  }, { stock: 0, usados: 0, sobrante: 0 });
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

const formatThousandInteger = (value) => {
  if (value === null || value === undefined || value === '') return '-';

  let normalizedValue = value;

  if (typeof normalizedValue === 'string') {
    normalizedValue = normalizedValue.replace(/\./g, '').replace(',', '.').trim();
  }

  const parsedNumber = Number(normalizedValue);
  if (Number.isNaN(parsedNumber)) return value;

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(parsedNumber));
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

// Acción para el botón Mezclas
const handleMezclas = async ({ silent = false } = {}) => {
  if (isCalculatingBlend.value) return;

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
        stock: filteredData.value, // Enviar solo el stock filtrado (ej. por búsqueda)
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
    if (data.success) {
      blendPlan.value = data;
      isBlendMode.value = true;
    } else {
      throw new Error('El cálculo no fue exitoso.');
    }
  } catch (error) {
    console.error(error);
    if (!silent) {
      alert(`Error: ${error.message}`);
    }
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

.compact-summary-footer td {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}

.compact-plan-table tbody td {
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
