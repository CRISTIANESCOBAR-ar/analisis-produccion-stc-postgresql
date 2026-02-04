<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <div class="flex flex-col gap-2 mb-3 flex-shrink-0">
        <!-- Single top row: title, search, filters (center), refresh -->
        <div class="@container flex items-center gap-1.5">
          <!-- Data source indicator -->
          <div v-tippy="{ content: dataSourceTooltip, placement: 'bottom', theme: 'custom' }"
            class="flex items-center justify-center w-8 h-8 rounded-full ml-12 lg:ml-0 transition-all duration-300"
            :class="dataSource === 'firebase' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'">
            <svg v-if="dataSource === 'firebase'" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24"
              fill="currentColor">
              <path
                d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          import { ref } from 'vue';
          import { useStore } from 'vuex';
          import { useRoute } from 'vue-router';
              <line x1="8" y1="21" x2="16" y2="21"></line>
              <line x1="12" y1="17" x2="12" y2="21"></line>
            </svg>
          </div>
          <h3 class="text-lg font-semibold text-slate-800 whitespace-nowrap">Resumen de Ensayos</h3>

          <!-- search moved next to title -->
          <div class="ml-2 flex items-center gap-2">
            <label for="searchInput" class="sr-only">Buscar ensayos</label>
            <input id="searchInput" v-model="q" @input="onInput" type="search"
              placeholder="Buscar..." aria-label="Buscar ensayos"
              class="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all w-24 @[1150px]:w-auto" />
            <button v-if="q || neQuery || oeQuery" @click="clearSearch"
              v-tippy="{ content: 'Limpiar filtros', placement: 'bottom', theme: 'custom' }"
              class="inline-flex items-center gap-1 px-1.5 @[1150px]:px-1.5 py-1.5 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
              <span class="hidden @[1150px]:inline">Limpiar</span>
            </button>
          </div>

          <!-- center area: filters -->
          <div class="flex-1 flex items-center justify-end gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- Quick filters for Ne and OE (client-side) - Orden invertido: Ne primero, OE después -->
              <div class="flex items-center gap-2">
                <label for="neFilter" class="text-sm text-slate-600">Ne:</label>
                <select id="neFilter" v-model="neQuery" aria-label="Filtrar por Ne"
                  class="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900"
                  style="width:9.5ch;min-width:9.5ch;max-width:9.5ch;">
                  <option value="">Todos</option>
                  <option v-for="ne in availableNes" :key="ne" :value="ne">
                    {{ ne }}
                  </option>
                </select>

                <label for="oeFilter" class="text-sm text-slate-600">OE:</label>
                <select id="oeFilter" v-model="oeQuery" aria-label="Filtrar por OE"
                  class="px-2 py-1 border border-slate-200 rounded-lg text-sm text-slate-900"
                  style="width:9.5ch;min-width:9.5ch;max-width:9.5ch;">
                  <option value="">Todos</option>
                  <option v-for="oe in availableOes" :key="oe" :value="oe">
                    {{ oe }}
                  </option>
                </select>
              </div>

              <!-- Filtros de desviación -->
              <div class="flex items-center gap-2 ml-1">
                <!-- Todos -->
                <button
                  @click="filterAll"
                  v-tippy="{ content: statusFilter === 'all' ? 'Mostrando todos' : 'Mostrar todos los ensayos', placement: 'bottom', theme: 'custom' }"
                  class="inline-flex items-center gap-1 px-2 @[1150px]:px-1.5 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
                  :class="statusFilter === 'all' ? 'bg-blue-50 text-blue-700 border-blue-500' : 'bg-white text-slate-700 hover:bg-slate-50'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <rect x="3" y="3" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
                    <rect x="14" y="3" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
                    <rect x="14" y="14" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
                    <rect x="3" y="14" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
                  </svg>
                  <span class="hidden @[1150px]:inline">Todos</span>
                </button>

                <!-- Dentro de rango -->
                <button
                  @click="filterOk"
                  v-tippy="{ content: statusFilter === 'ok' ? 'Clic para quitar filtro' : 'Solo ensayos dentro de ±1.5%', placement: 'bottom', theme: 'custom' }"
                  class="inline-flex items-center gap-1 px-2 @[1150px]:px-1.5 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
                  :class="statusFilter === 'ok' ? 'bg-green-50 text-green-700 border-green-500' : 'bg-white text-slate-700 hover:bg-slate-50'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"></path>
                    <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"></polyline>
                  </svg>
                  <span class="hidden @[1150px]:inline">Dentro</span>
                </button>

                <!-- Fuera de rango -->
                <button
                  @click="filterOutOfRange"
                  v-tippy="{ content: statusFilter === 'out-of-range' ? 'Clic para quitar filtro' : 'Solo ensayos fuera de ±1.5%', placement: 'bottom', theme: 'custom' }"
                  class="inline-flex items-center gap-1 px-2 @[1150px]:px-1.5 py-1 border border-slate-200 rounded-lg text-sm font-medium transition-colors duration-150 shadow-sm hover:shadow-md"
                  :class="statusFilter === 'out-of-range' ? 'bg-red-50 text-red-700 border-red-500' : 'bg-white text-slate-700 hover:bg-slate-50'"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"></circle>
                    <line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round" stroke-linejoin="round"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round" stroke-linejoin="round"></line>
                  </svg>
                  <span class="hidden @[1150px]:inline">Fuera</span>
                </button>
              </div>
            </div>
          </div>

          <!-- actions: coincidencias + refresh -->
          <div class="flex items-center gap-1">


            <!-- Minimal modern refresh button with icon -->
            <button @click="loadRows" v-tippy="{ content: 'Refrescar datos', placement: 'bottom', theme: 'custom' }"
              class="inline-flex items-center gap-1 px-2 @[1150px]:px-1.5 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 12a9 9 0 1 1-3-6.7" stroke-linecap="round" stroke-linejoin="round"></path>
                <polyline points="21 3 21 9 15 9" stroke-linecap="round" stroke-linejoin="round"></polyline>
              </svg>
              <span class="hidden @[1150px]:inline">Refrescar</span>
            </button>

            <!-- Export to Excel (CSV) button -->
            <button @click="exportToExcel"
              v-tippy="{ content: 'Exportar a Excel (XLSX)', placement: 'bottom', theme: 'custom' }"
              class="inline-flex items-center gap-1 px-2 @[1150px]:px-1.5 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke-linecap="round" stroke-linejoin="round">
                </path>
                <polyline points="7 10 12 15 17 10" stroke-linecap="round" stroke-linejoin="round"></polyline>
                <line x1="12" y1="15" x2="12" y2="3" stroke-linecap="round" stroke-linejoin="round"></line>
              </svg>
              <span class="hidden @[1150px]:inline">Exportar</span>
            </button>
          </div>
        </div>
      </div>

      <div v-if="loading" class="text-sm text-slate-600 py-8 text-center flex-1">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
        <p class="mt-2">Cargando...</p>
      </div>

      <div v-else class="flex-1 min-h-0 flex flex-col">
        <div v-if="rows.length === 0" class="text-sm text-slate-600 py-8 text-center">No hay ensayos.</div>

        <div v-else class="flex-1 min-h-0 flex flex-col">
          <div v-if="filteredRows.length === 0"
            class="text-sm text-slate-600 mb-4 py-4 text-center bg-slate-50 rounded-lg flex-shrink-0">
            No hay coincidencias para la búsqueda.
          </div>

          <div class="overflow-auto _minimal-scroll w-full flex-1 min-h-0 rounded-xl border border-slate-200 pb-0">
            <table class="min-w-full w-full table-auto divide-y divide-slate-200 text-xs">
              <colgroup>
                <col style="width:6%" /> <!-- Ensayo -->
                <col style="width:6%" /> <!-- Fecha -->
                <col style="width:4%" /> <!-- Lote -->
                <col style="width:11%" /> <!-- OE (doble) -->
                <col style="width:5%" /> <!-- Ne -->
                <col style="width:6%" /> <!-- Desvío % -->
                <col style="width:11%" /> <!-- Titulo -->
                <col style="width:5%" /> <!-- Estiraje -->
                <col style="width:5%" /> <!-- CVm % -->
                <!-- The following columns reduced by 40% (approx): base assumed 5% -> now 3% -->
                <col style="width:3%" /> <!-- Delg -30% -->
                <col style="width:3%" /> <!-- Delg -40% -->
                <col style="width:3%" /> <!-- Delg -50% -->
                <col style="width:3%" /> <!-- Grue +35% -->
                <col style="width:3%" /> <!-- Grue +50% -->
                <col style="width:3%" /> <!-- Neps +140% -->
                <col style="width:3%" /> <!-- Neps +280% -->
                <col style="width:6%" /> <!-- Fuerza B -->
                <col style="width:6%" /> <!-- Elong. % -->
                <col style="width:6%" /> <!-- Tenac. -->
                <col style="width:6%" /> <!-- Trabajo B -->
                <col style="width:6%" /> <!-- Acciones -->
              </colgroup>
              <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-20">
                <tr>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Ensayo
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Fecha
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Lote
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">OE
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Ne
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Desvío %
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Titulo
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Estiraje
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">Pasador
                  </th>
                  <th class="px-2 py-[0.3rem] text-center font-semibold text-slate-700 border-b border-slate-200">CVm %
                  </th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -30%
                  </th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -40%
                  </th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -50%
                  </th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +35%
                  </th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +50%
                  </th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +140%
                  </th>
                  <th class="px-3 py-3 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +280%
                  </th>
                  <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Fuerza B</th>
                  <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Elong. %</th>
                  <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Tenac.</th>
                  <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Trabajo B
                  </th>
                  <th class="px-2 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Acciones</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in pagedRows" :key="idx"
                  :class="['border-t border-slate-100 hover:bg-blue-50/30 transition-colors duration-150', row._isFlame ? 'font-bold' : '']">
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Ensayo }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700 whitespace-nowrap">{{
                    displayFecha(getPreferredFecha(row)) }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Lote }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.OE }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Ne }}</td>
                  <td class="px-2 py-[0.3rem] text-center font-semibold" :class="{
                    'text-red-600': row['Desvío %'] && parseFloat(row['Desvío %']) > 1.5,
                    'text-blue-600': row['Desvío %'] && parseFloat(row['Desvío %']) < -1.5,
                    'text-green-600': row['Desvío %'] && parseFloat(row['Desvío %']) >= -1.5 && parseFloat(row['Desvío %']) <= 1.5,
                    'text-slate-700': !row['Desvío %'] || row['Desvío %'] === '—'
                  }">
                    <template v-if="row['Desvío %'] && row['Desvío %'] !== '—'">
                      {{ row['Desvío %'] }}%
                    </template>
                    <template v-else>{{ row['Desvío %'] }}</template>
                  </td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Titulo }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Estiraje || '-' }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row.Pasador || '-' }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['CVm %'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Delg -30%'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Delg -40%'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Delg -50%'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Grue +35%'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Grue +50%'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Neps +140%'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Neps +280%'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Fuerza B'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Elong. %'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Tenac.'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center text-slate-700">{{ row['Trabajo B'] }}</td>
                  <td class="px-2 py-[0.3rem] text-center">
                    <div class="flex items-center justify-center gap-1.5">
                      <button @click="openDetail(row.Ensayo)"
                        v-tippy="{ content: 'Ver el detalle de los ensayos USTER y TENSORAPID', placement: 'bottom', theme: 'custom' }"
                        class="inline-flex items-center gap-1 px-1 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-600" viewBox="0 0 24 24"
                          fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" stroke-linecap="round" stroke-linejoin="round"></path>
                          <path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" stroke-linecap="round" stroke-linejoin="round"></path>
                        </svg>
                        <span class="whitespace-nowrap">Ver</span>
                      </button>

                      <button @click.stop="openHusoGraph(row.Ensayo)"
                        v-tippy="{ content: 'Ver gráfico por huso (Titulo Ne)', placement: 'bottom', theme: 'custom' }"
                        class="inline-flex items-center justify-center px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm">
                        📈
                      </button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- pagination controls -->
          <div class="flex items-center justify-between mt-3 px-1 flex-shrink-0">
            <div class="text-sm text-slate-600">Mostrando {{ startDisplay }}–{{ endDisplay }} de {{ filteredRows.length
            }}</div>
            <div class="flex items-center gap-2">
              <label class="text-sm text-slate-700">Registros por página:</label>
              <select v-model.number="pageSize"
                class="text-sm px-2 py-1 border border-slate-200 rounded-lg text-slate-700 focus:border-blue-400">
                <option v-for="s in [10, 25, 50, 100, 0]" :key="s" :value="s">{{ s === 0 ? 'Todos' : s }}</option>
              </select>

              <!-- first / prev -->
              <button @click="page = 1" :disabled="page <= 1"
                class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 shadow-sm hover:shadow-md"
                title="Primera">« Primera</button>
              <button @click="page = Math.max(1, page - 1)" :disabled="page <= 1"
                class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 shadow-sm hover:shadow-md"
                title="Anterior">‹ Anterior</button>

              <!-- go to page input -->
              <div class="flex items-center gap-1">
                <label class="sr-only" for="gotoPage">Ir a página</label>
                <input id="gotoPage" type="number" min="1" :max="totalPages" v-model.number.lazy="gotoPage"
                  @keydown.enter.prevent="goToPage()"
                  class="w-20 text-sm px-2 py-1 border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:border-blue-400"
                  placeholder="Página" />
                <button @click="goToPage()"
                  class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md">Ir</button>
              </div>

              <!-- page indicator and next/last -->
              <span class="text-sm text-slate-600">Página {{ page }} / {{ totalPages }}</span>
              <button @click="page = Math.min(totalPages, page + 1)" :disabled="page >= totalPages"
                class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 shadow-sm hover:shadow-md"
                title="Siguiente">Siguiente ›</button>
              <button @click="page = totalPages" :disabled="page >= totalPages"
                class="inline-flex items-center gap-2 px-3 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 disabled:opacity-50 shadow-sm hover:shadow-md"
                title="Última">Última »</button>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Modal detalle con datos raw + estadísticas -->
    <div v-if="modalVisible" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog"
      aria-modal="true" aria-labelledby="modalTitle">
      <!-- overlay -->
      <div class="fixed inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm z-40"
        @click="closeModal" aria-hidden="true"></div>

      <!-- modal content -->
      <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col p-3 z-50 relative"
        role="document">
        <!-- Prev/Next floating buttons glued to modal sides, vertically centered -->
        <button @click="modalPrev" :disabled="modalPrevDisabled" type="button"
          v-tippy="{ content: 'Anterior — Atajo: ← (ArrowLeft). Esc: Cerrar modal', placement: 'left', theme: 'custom' }"
          class="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed z-50"
          aria-label="Anterior ensayo">‹</button>

        <button @click="modalNext" :disabled="modalNextDisabled" type="button"
          v-tippy="{ content: 'Siguiente — Atajo: → (ArrowRight). Esc: Cerrar modal', placement: 'right', theme: 'custom' }"
          class="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed z-50"
          aria-label="Siguiente ensayo">›</button>

        <header class="flex items-start sm:items-center justify-between mb-2 pb-1 gap-3">
          <div id="modalTitle" class="flex flex-col sm:flex-row sm:items-center gap-2 mx-8">
            <div class="text-slate-600 text-sm">Fecha: <span class="text-slate-900 text-lg font-semibold ml-1">{{
              modalMeta.fechaStr }}</span></div>
            <div class="text-slate-600 text-sm">Ne: <span class="text-slate-900 text-lg font-semibold ml-1">{{
              modalMeta.ne }}</span></div>
            <div class="text-slate-600 text-sm">OE Nro.: <span class="text-slate-900 text-lg font-semibold ml-1">{{
              modalMeta.oe }}</span></div>
            <div class="text-slate-600 text-sm">Ensayo Uster <span class="text-slate-900 text-lg font-semibold ml-1">{{
              modalMeta.u }}</span> y TensoRapid <span class="text-slate-900 text-lg font-semibold ml-1">{{
                  modalMeta.t }}</span></div>
          </div>

          <div class="flex items-center gap-2">
            <!-- Export modal data to Excel (small button to the left of Copy) -->
            <button @click="exportModalToExcel" type="button"
              v-tippy="{ content: 'Exportar este detalle a Excel (XLSX)', placement: 'bottom', theme: 'custom' }"
              class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center text-slate-600 hover:text-slate-700 transition-all duration-200 shadow-sm hover:shadow-md"
              aria-label="Exportar detalle a Excel">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
            <!-- Copy as image button -->
            <button @click="copyModalAsImage" type="button"
              v-tippy="{ content: 'Copiar como imagen para WhatsApp', placement: 'bottom', theme: 'custom' }"
              class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all duration-200 group shadow-sm hover:shadow-md"
              aria-label="Copiar como imagen">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>

            <!-- Close button -->
            <button @click="closeModal" type="button"
              v-tippy="{ content: 'Cerrar (Esc)', placement: 'bottom', theme: 'custom' }"
              class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 flex items-center justify-center text-slate-600 hover:text-red-600 transition-all duration-200 shadow-sm hover:shadow-md"
              aria-label="Cerrar detalle">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </header>

        <!-- Observaciones (OBS), Lab. Uster (LABORANT) y Op. TensoRapid — en línea debajo del header -->
        <div v-if="modalMeta.obs || modalMeta.laborant || modalMeta.tensorLaborant"
          class="mx-8 flex items-center gap-4 text-slate-600 text-sm mb-2">
          <div v-if="modalMeta.obs">
            <span>Obs.:</span>
            <span class="text-slate-900 text-sm font-normal ml-1">{{ modalMeta.obs }}</span>
          </div>
          <div v-if="modalMeta.laborant">
            <span>Op. Uster:</span>
            <span class="text-slate-900 text-sm font-normal ml-1">{{ modalMeta.laborant }}</span>
          </div>
          <div v-if="modalMeta.tensorLaborant">
            <span>Op. TensoRapid:</span>
            <span class="text-slate-900 text-sm font-normal ml-1">{{ modalMeta.tensorLaborant }}</span>
          </div>
        </div>
        <section class="flex-1 relative">
          <!-- Always render content to preserve modal height; show spinner as overlay when loading -->
          <div>
            <div v-if="mergedRows.length === 0" class="text-sm text-slate-600 py-8 text-center">No hay datos para este
              ensayo.</div>
            <div v-else class="rounded-xl border border-slate-200 overflow-auto modal-scroll max-h-[calc(95vh-6rem)]">
              <table class="min-w-full text-xs">
                <!-- Make the table wrapper the scroll container and use top-0 on thead so
                     the header sticks correctly inside the scrolling area. -->
                <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-30">
                  <tr>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Huso</th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Titulo</th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvío %</th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">CVm %</th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -30%
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -40%
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -50%
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +35%
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +50%
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +140%
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +280%
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Fuerza B
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Elongación
                      %</th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Tenacidad
                    </th>
                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Trabajo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, idx) in mergedRows" :key="idx"
                    :class="['transition-colors duration-150', modalLoading ? 'bg-slate-50/50' : 'hover:bg-slate-50']">
                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-10 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ row.NO }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-32 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.TITULO) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 font-semibold" :class="{
                      'text-red-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) > 1.5,
                      'text-blue-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) < -1.5,
                      'text-green-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) >= -1.5 && parseFloat(row.DESVIO_PERCENT) <= 1.5,
                      'text-slate-700': !row.DESVIO_PERCENT
                    }">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>
                        {{ row.DESVIO_PERCENT ? row.DESVIO_PERCENT + '%' : '' }}
                      </template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-14 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.CVM_PERCENT) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.DELG_MINUS30_KM) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.DELG_MINUS40_KM) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.DELG_MINUS50_KM) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.GRUE_35_KM) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.GRUE_50_KM) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.NEPS_140_KM) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.NEPS_280_KM) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-16 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.FUERZA_B) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-14 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.ELONGACION) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-14 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.TENACIDAD) }}</template>
                    </td>

                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">
                      <template v-if="modalLoading">
                        <div class="mx-auto w-14 h-4 bg-slate-200/70 rounded animate-pulse"></div>
                      </template>
                      <template v-else>{{ fmtCell(row.TRABAJO) }}</template>
                    </td>
                  </tr>

                  <!-- statistics rows -->
                  <tr class="bg-gradient-to-r from-blue-50 to-indigo-50 font-semibold border-t-2 border-blue-200">
                    <td class="px-3 py-1 text-slate-700">
                      <div class="flex items-center justify-center gap-1">
                        <span>Promedio</span>
                        <button
                          v-tippy="{ content: 'La suma de todos los valores dividida por la cantidad de datos. Representa el valor típico o central de un conjunto de datos.', placement: 'top', theme: 'custom' }"
                          aria-label="Info Promedio"
                          class="inline-flex items-center text-slate-400 hover:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO.avg) }}</td>
                    <td class="px-3 py-1 text-center font-semibold" :class="{
                      'text-red-600': combinedStats.DESVIO_PERCENT?.avg > 1.5,
                      'text-blue-600': combinedStats.DESVIO_PERCENT?.avg < -1.5,
                      'text-green-600': combinedStats.DESVIO_PERCENT?.avg >= -1.5 && combinedStats.DESVIO_PERCENT?.avg <= 1.5,
                      'text-slate-700': combinedStats.DESVIO_PERCENT?.avg == null
                    }">
                      {{ combinedStats.DESVIO_PERCENT?.avg != null ? (combinedStats.DESVIO_PERCENT.avg > 0 ? '+' : '') + fmtStat(combinedStats.DESVIO_PERCENT.avg) + '%' : '' }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM.avg) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM.avg) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM.avg) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD.avg) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO.avg) }}</td>
                  </tr>

                  <tr class="bg-blue-50/50 font-medium">
                    <td class="px-3 py-1 text-slate-700">
                      <div class="flex items-center justify-center gap-1">
                        <span>CV</span>
                        <button
                          v-tippy="{ content: 'Una medida de dispersión relativa. Un CV del 5% indica baja variabilidad; uno del 50% indica alta dispersión.', placement: 'top', theme: 'custom' }"
                          aria-label="Info CV" class="inline-flex items-center text-slate-400 hover:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700"></td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM.cv) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM.cv) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM.cv) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD.cv) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO.cv) }}</td>
                  </tr>

                  <tr class="bg-indigo-50/50 font-medium">
                    <td class="px-3 py-1 text-slate-700">
                      <div class="flex items-center justify-center gap-1">
                        <span>s</span>
                        <button
                          v-tippy="{ content: 'Desviación estándar. Mide cuánto se alejan los datos del promedio.', placement: 'top', theme: 'custom' }"
                          aria-label="Info desviación estándar"
                          class="inline-flex items-center text-slate-400 hover:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700"></td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM.sd) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM.sd) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM.sd) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD.sd) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO.sd) }}</td>
                  </tr>

                  <tr class="bg-blue-50/50 font-medium">
                    <td class="px-3 py-1 text-slate-700">
                      <div class="flex items-center justify-center gap-1">
                        <span>Q95</span>
                        <button
                          v-tippy="{ content: 'Cuantil 95. El valor por debajo del cual se encuentra el 95% de los datos.', placement: 'top', theme: 'custom' }"
                          aria-label="Info Q95" class="inline-flex items-center text-slate-400 hover:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700"></td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM.q95) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM.q95) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM.q95) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD.q95) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO.q95) }}</td>
                  </tr>

                  <tr class="bg-indigo-50/50 font-medium">
                    <td class="px-3 py-1 text-slate-700">
                      <div class="flex items-center justify-center gap-1">
                        <span>Máx</span>
                        <button
                          v-tippy="{ content: 'Máximo. El valor más alto del conjunto de datos.', placement: 'top', theme: 'custom' }"
                          aria-label="Info Max" class="inline-flex items-center text-slate-400 hover:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700"></td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM.max) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM.max) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM.max) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD.max) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO.max) }}</td>
                  </tr>

                  <tr class="bg-blue-50/50 font-medium">
                    <td class="px-3 py-1 text-slate-700">
                      <div class="flex items-center justify-center gap-1">
                        <span>Mín</span>
                        <button
                          v-tippy="{ content: 'Mínimo. El valor más bajo del conjunto de datos.', placement: 'top', theme: 'custom' }"
                          aria-label="Info Min" class="inline-flex items-center text-slate-400 hover:text-slate-600">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="1.5">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" stroke-linecap="round" stroke-linejoin="round" />
                            <path d="M12 8h.01" stroke-linecap="round" stroke-linejoin="round" />
                          </svg>
                        </button>
                      </div>
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700"></td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM.min) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM.min) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM.min) }}
                    </td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD.min) }}</td>
                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO.min) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="modalLoading"
            class="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center pointer-events-auto">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-blue-600">
            </div>
            <p class="mt-3 text-base text-slate-700 font-medium">Cargando ensayo...</p>
          </div>
        </section>
      </div>
    </div>

    <!-- Modal de gráfico por Huso (Titulo Ne) -->
    <HusoDetailModal
      :visible="husoModalVisible"
      :values="husoModalValues"
      :huso-numbers="husoModalHusos"
      :testnr="String(selectedTestnr || '')"
      :timestamp="modalMeta.fechaStr"
      :oe="modalMeta.oe"
      variable-label="Titulo Ne"
      :standard-ne="husoStandardNe"
      :can-navigate-previous="!modalPrevDisabled"
      :can-navigate-next="!modalNextDisabled"
      @close="husoModalVisible = false"
      @navigate-previous="modalPrev"
      @navigate-next="modalNext"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import Swal from 'sweetalert2'
import { toPng } from 'html-to-image'
import ExcelJS from 'exceljs'
import { fetchAllStatsData, getDataSource } from '../../services/dataService'
// import HusoDetailModal from './uster-stats/HusoDetailModal.vue'

const loading = ref(false)
const rows = ref([])
const allData = ref(null)

// Data source indicator
const dataSource = computed(() => getDataSource())
const dataSourceTooltip = computed(() => {
  return dataSource.value === 'firebase'
    ? 'Datos desde Firebase (Producción)'
    : 'Datos desde Oracle (Localhost)'
})

// Search state
const q = ref('')
const debouncedQ = ref('')
const keystrokeTimes = ref([])
const searchTimeout = ref(null)
const debounceDefault = 500
const debounceMsDisplay = ref(debounceDefault)

// Formatea fecha a formato europeo dd/mm/yy
function formatFechaEuropea(fecha) {
  if (!fecha) return ''
  let s = String(fecha).trim().replace(/[-.]/g, '/').replace(/\s.*/, '')
  // ISO yyyy-mm-dd o yyyy/mm/dd
  const iso = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (iso) {
    const dd = String(iso[3]).padStart(2, '0')
    const mm = String(iso[2]).padStart(2, '0')
    const yy = String(iso[1]).slice(-2)
    return `${dd}/${mm}/${yy}`
  }
  // dd/mm/yyyy o dd/mm/yy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (m) {
    const day = String(parseInt(m[1], 10)).padStart(2, '0')
    const month = String(parseInt(m[2], 10)).padStart(2, '0')
    const yy = m[3].length === 4 ? m[3].slice(-2) : m[3].padStart(2, '0')
    return `${day}/${month}/${yy}`
  }
  // Fallback: Date
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yy = String(d.getFullYear()).slice(-2)
    return `${dd}/${mm}/${yy}`
  }
  return s
}

// Forma segura para mostrar una fecha en la UI: acepta Date, timestamp numérico o string
function displayFecha(fecha) {
  if (!fecha && fecha !== 0) return ''
  // Si ya es Date
  if (fecha instanceof Date) {
    const dd = String(fecha.getDate()).padStart(2, '0')
    const mm = String(fecha.getMonth() + 1).padStart(2, '0')
    const yy = String(fecha.getFullYear()).slice(-2)
    return `${dd}/${mm}/${yy}`
  }

  // Si es número (epoch seconds or ms)
  if (typeof fecha === 'number') {
    const n = Number(fecha)
    if (!Number.isFinite(n)) return ''
    // heurística: > 1e12 -> ms, >1e9 -> sec
    const d = n > 1000000000000 ? new Date(n) : (n > 1000000000 ? new Date(n * 1000) : new Date(n))
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0')
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const yy = String(d.getFullYear()).slice(-2)
      return `${dd}/${mm}/${yy}`
    }
    return ''
  }

  // Para strings delegar a formatFechaEuropea (maneja ISO y dd/mm)
  try {
    const s = String(fecha).trim()
    // Si la cadena es sólo el nombre del día (Mon/Tue/Wed...) o día completo, no confiar en eso
    if (/^(?:mon|tue|wed|thu|fri|sat|sun)$/i.test(s) || /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(s)) {
      return ''
    }
    return formatFechaEuropea(s)
  } catch {
    return String(fecha)
  }
}

// Selecciona la mejor fecha disponible dentro de un objeto `row`.
// Prioriza `TIME_STAMP` (Date o numeric), luego `TIME`, luego `Fecha`/`fecha`.
function getPreferredFecha(row) {
  if (!row || typeof row !== 'object') return ''

  const candidates = ['TIME_STAMP', 'TIME', 'TIMESTAMP', 'Fecha', 'FECHA', 'fecha', 'date']
  for (const key of candidates) {
    const v = row[key]
    if (v == null || v === '') continue

    // Si ya es Date
    if (v instanceof Date) return v
    // Si es número plausible
    if (typeof v === 'number' && Number.isFinite(v)) return v
    // Si es un objeto con toDate (Firestore Timestamp), intentar convertir
    if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate()
    // Si es string, solo retornar si NO es un weekday-only (esos los filtrará displayFecha)
    if (typeof v === 'string') {
      const s = v.trim()
      // Si es solo día de semana, skip y continuar buscando
      if (/^(?:mon|tue|wed|thu|fri|sat|sun)$/i.test(s) || /^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(s)) {
        continue
      }
      return v
    }
  }
  return ''
}

// Formatea Ne: usa NOMCOUNT y agrega 'Flame' si MATCLASS es 'Hilo de fantasia'
// Elimina decimales innecesarios: 9.50 → 9.5, 10.00 → 10, 12.50 → 12.5
function formatNe(nomcount, matclass) {
  if (nomcount == null || nomcount === '') return ''
  let ne = String(nomcount).trim()
  
  // Si es un número, formatear para eliminar ceros innecesarios
  const neNum = parseFloat(ne)
  if (!isNaN(neNum)) {
    // parseFloat automáticamente elimina ceros: 9.50 → 9.5, 10.00 → 10
    ne = String(parseFloat(ne))
  }
  
  if (matclass && String(matclass).toLowerCase() === 'hilo de fantasia') {
    return ne + 'Flame'
  }
  return ne
}

// Formatea Estiraje: elimina ceros a la derecha (ej: 5.30 → 5.3, 6.00 → 6)
function formatEstiraje(estiraje) {
  if (estiraje == null || estiraje === '') return null
  const val = String(estiraje).trim()
  const num = parseFloat(val)
  if (!isNaN(num)) {
    // parseFloat elimina automáticamente ceros: 5.30 → 5.3, 6.00 → 6
    return String(parseFloat(val))
  }
  return val
}

// Formatea Lote: extrae el número del medio (ej: HD-107-26 → 107, HV 56-25 → 56)
function formatLote(lote) {
  if (!lote || lote === '') return ''
  const str = String(lote).trim()
  // Buscar patrón: separador (- o espacio) + dígitos + separador (- o espacio)
  const match = str.match(/[\s-](\d+)[\s-]/)
  if (match && match[1]) {
    return match[1]
  }
  // Si no hay match, devolver el valor original
  return str
}

// Formatea una celda de datos (números con decimales o valores vacíos)
function fmtCell(val) {
  if (val == null || val === '') return '—'
  const s = String(val).trim()
  if (s === '') return '—'
  const n = Number(s)
  if (!isNaN(n)) {
    // Formatear con hasta 2 decimales, quitando ceros innecesarios
    return Number(n.toFixed(2)).toString()
  }
  return s
}

// Formatea estadísticas (promedios)
function fmtStat(val) {
  if (val == null) return '—'
  const n = Number(val)
  if (isNaN(n)) return '—'
  // Formatear con hasta 2 decimales, quitando ceros innecesarios
  return Number(n.toFixed(2)).toString()
}

// Quick client-side filters for OE and Ne
const oeQuery = ref('')
const neQuery = ref('')
const statusFilter = ref('all') // 'all', 'ok', 'out-of-range'

// Get unique Ne values from rows (filtered by OE if selected)
const availableNes = computed(() => {
  const nes = new Set()
  for (const row of rows.value || []) {
    // Si hay OE seleccionado, solo mostrar Ne de esa OE
    if (oeQuery.value && String(row.OE) !== oeQuery.value) {
      continue
    }
    const ne = row.Ne
    if (ne != null && ne !== '') {
      nes.add(String(ne))
    }
  }
  return Array.from(nes).sort((a, b) => {
    const numA = parseFloat(a)
    const numB = parseFloat(b)
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB
    return a.localeCompare(b)
  })
})

// Get unique OEs (filtered by Ne if selected, or all if no Ne selected)
const availableOes = computed(() => {
  const oes = new Set()
  for (const row of rows.value || []) {
    // Si hay Ne seleccionado, solo mostrar OE que produjeron ese Ne
    if (neQuery.value && String(row.Ne) !== neQuery.value) {
      continue
    }
    const oe = row.OE
    if (oe != null && oe !== '') {
      oes.add(String(oe))
    }
  }
  return Array.from(oes).sort((a, b) => {
    // Extraer parte numérica para ordenar correctamente
    const numA = parseInt(a) || 0
    const numB = parseInt(b) || 0
    if (numA !== numB) return numA - numB
    return a.localeCompare(b)
  })
})

// Watch para mantener sincronizados los filtros Ne y OE
// Cuando cambia Ne, limpiar OE si ya no está en la lista de disponibles
watch(neQuery, () => {
  if (oeQuery.value && neQuery.value) {
    // Verificar si el OE actual sigue siendo válido para el Ne seleccionado
    const validOes = availableOes.value
    if (!validOes.includes(oeQuery.value)) {
      oeQuery.value = ''
    }
  }
})

// Cuando cambia OE, limpiar Ne si ya no está en la lista de disponibles
watch(oeQuery, () => {
  if (neQuery.value && oeQuery.value) {
    // Verificar si el Ne actual sigue siendo válido para el OE seleccionado
    const validNes = availableNes.value
    if (!validNes.includes(neQuery.value)) {
      neQuery.value = ''
    }
  }
})

// Search fields to check for the general search (always search across these columns)
const allSearchFields = ['Ensayo', 'Fecha', 'OE', 'Ne', 'CVm %', 'Delg -30%', 'Delg -40%', 'Delg -50%', 'Grue +35%', 'Grue +50%', 'Neps +140%', 'Neps +280%', 'Fuerza B', 'Elong. %', 'Tenac.', 'Trabajo B', 'Titulo']
const fieldsToCheck = computed(() => allSearchFields)



function onInput() {
  // record keystroke timestamp
  try {
    keystrokeTimes.value.push(Date.now())
    if (keystrokeTimes.value.length > 6) keystrokeTimes.value.shift()
  } catch { /* ignore */ }

  // debounce updating `debouncedQ` using dynamic debounce calculated from typing speed
  if (searchTimeout.value) {
    clearTimeout(searchTimeout.value)
  }
  const ms = Number(debounceMsDisplay.value || debounceDefault)
  searchTimeout.value = setTimeout(() => {
    debouncedQ.value = q.value
  }, ms)
}

function clearSearch() {
  q.value = ''
  oeQuery.value = ''
  neQuery.value = ''
  debouncedQ.value = ''
}

// Filter functions para desviación - toggle behavior
function filterAll() {
  statusFilter.value = 'all'
}

function filterOk() {
  // Toggle: if already filtering by 'ok', clear the filter
  statusFilter.value = statusFilter.value === 'ok' ? 'all' : 'ok'
}

function filterOutOfRange() {
  // Toggle: if already filtering by 'out-of-range', clear the filter
  statusFilter.value = statusFilter.value === 'out-of-range' ? 'all' : 'out-of-range'
}

const filteredRows = computed(() => {
  const term = (debouncedQ.value || '').toString().trim().toLowerCase()
  const oe = (oeQuery.value || '').toString().trim().toLowerCase()
  const ne = (neQuery.value || '').toString().trim().toLowerCase()
  const list = rows.value || []
  const parts = term ? term.split(/\s+/).filter(Boolean) : []
  
  return list.filter(r => {
    // General text search
    const textMatch = !term || parts.every((p) => {
      return fieldsToCheck.value.some(field => {
        const val = r[field]
        if (val == null) return false
        return String(val).toLowerCase().includes(p)
      })
    })
    // OE filter
    const oeMatch = !oe || (() => {
      const v = r.OE == null ? '' : String(r.OE).toLowerCase()
      return v.includes(oe)
    })()
    // Ne filter
    const neMatch = !ne || (() => {
      const v = r.Ne == null ? '' : String(r.Ne).toLowerCase()
      return v.includes(ne)
    })()
    
    // Status filter (desviación)
    let statusMatch = true
    if (statusFilter.value !== 'all') {
      const desvio = r['Desvío %']
      const desvioNum = desvio != null ? parseFloat(String(desvio).replace('%', '').replace(',', '.').replace('+', '')) : null
      
      if (desvioNum != null && !isNaN(desvioNum)) {
        if (statusFilter.value === 'ok') {
          // Dentro de rango: -1.5% <= desviación <= +1.5%
          statusMatch = desvioNum >= -1.5 && desvioNum <= 1.5
        } else if (statusFilter.value === 'out-of-range') {
          // Fuera de rango: desviación < -1.5% o desviación > +1.5%
          statusMatch = desvioNum < -1.5 || desvioNum > 1.5
        }
      } else {
        // Si no hay desviación válida, no matchea los filtros ok/out-of-range
        statusMatch = false
      }
    }
    
    return textMatch && oeMatch && neMatch && statusMatch
  })
})

// Pagination state for large result sets (client-side)
const page = ref(1)
const pageSize = ref(25) // default rows per page

const totalPages = computed(() => {
  if (!filteredRows.value) return 1
  if (pageSize.value === 0) return 1
  return Math.max(1, Math.ceil(filteredRows.value.length / pageSize.value))
})

const pagedRows = computed(() => {
  const list = filteredRows.value || []
  if (pageSize.value === 0) return list
  const start = (page.value - 1) * pageSize.value
  return list.slice(start, start + pageSize.value)
})

const startDisplay = computed(() => {
  const total = filteredRows.value.length || 0
  if (total === 0) return 0
  if (pageSize.value === 0) return 1
  return (page.value - 1) * pageSize.value + 1
})

const endDisplay = computed(() => {
  const total = filteredRows.value.length || 0
  if (total === 0) return 0
  if (pageSize.value === 0) return total
  return Math.min(total, page.value * pageSize.value)
})

watch([filteredRows, pageSize], () => {
  // reset to first page when filter changes or page size changes
  page.value = 1
})

// helper state for go-to-page input
const gotoPage = ref(1)

function goToPage() {
  const p = Number(gotoPage.value) || 1
  if (p < 1) page.value = 1
  else if (p > totalPages.value) page.value = totalPages.value
  else page.value = Math.floor(p)
  // keep the goto input in sync
  gotoPage.value = page.value
}

// keep gotoPage synced when page changes
watch(page, (v) => { gotoPage.value = v })


// Modal state
const modalVisible = ref(false)
const modalLoading = ref(false)
const selectedTestnr = ref(null)
const usterTblRows = ref([])
const mergedRows = ref([])
const combinedStats = ref({})
const tensorTestnrs = ref([])

// Modal de gráficos por huso (reutiliza HusoDetailModal)
const husoModalVisible = ref(false)

const husoModalHusos = computed(() => {
  const arr = (usterTblRows.value || []).map(r => String(r.NO ?? r['NO_'] ?? r.HUSO ?? r.huso ?? ''))
  return arr
    .map(v => ({ v, n: parseInt(v) || 0 }))
    .sort((a, b) => a.n - b.n)
    .map(x => x.v)
})

const husoModalValues = computed(() => {
  // Ordenar de la misma forma que husoModalHusos
  const list = (usterTblRows.value || []).map(r => ({
    no: String(r.NO ?? r['NO_'] ?? r.HUSO ?? r.huso ?? ''),
    titulo: r.TITULO ?? r.titulo ?? ''
  }))
  return list
    .map(x => ({ ...x, n: parseInt(x.no) || 0 }))
    .sort((a, b) => a.n - b.n)
    .map(x => Number(x.titulo))
    .filter(n => Number.isFinite(n))
})

const husoStandardNe = computed(() => {
  const neStr = modalMeta.value?.ne ? String(modalMeta.value.ne) : ''
  const n = parseFloat(neStr.replace('Flame', '').replace(',', '.'))
  return Number.isFinite(n) ? n : ''
})

function openHusoGraph(testnr) {
  // Reutilizamos la carga del watcher de selectedTestnr
  selectedTestnr.value = testnr
  husoModalVisible.value = true
}

// Watch selectedTestnr to load modal data
watch(selectedTestnr, async (testnr) => {
  if (!testnr) {
    mergedRows.value = []
    usterTblRows.value = []
    tensorTestnrs.value = []
    combinedStats.value = {}
    return
  }

  modalLoading.value = true
  try {
    // Buscar datos en las tablas TBL existentes
    const { usterTbl, tensorapidTbl, tensorapidPar } = allData.value || {}

    // Filtrar filas USTER_TBL que coincidan con el TESTNR seleccionado
    let usterRows = (usterTbl || []).filter(r =>
      String(r.TESTNR || r.testnr || '') === String(testnr)
    )

    // Deduplicar por combinacion TESTNR+NO (algunos datasets en Firebase traen duplicados)
    const dedupe = (arr, getKey) => {
      const seen = new Set()
      const out = []
      for (const item of arr) {
        let k
        try { k = getKey(item) } catch { k = undefined }
        if (!k) { out.push(item); continue }
        if (seen.has(k)) continue
        seen.add(k)
        out.push(item)
      }
      return out
    }
    usterRows = dedupe(usterRows, (r) => {
      const tn = String(r.TESTNR || r.testnr || '')
      const no = String(r.NO ?? r['NO_'] ?? r.HUSO ?? r.huso ?? '')
      return tn && no ? `${tn}#${no}` : undefined
    })

    usterTblRows.value = usterRows

    // Paso 1: Buscar TENSORAPID_PAR que tengan USTER_TESTNR = testnr seleccionado
    const tensorParMatches = (tensorapidPar || []).filter(r => {
      const usterTestnr = String(r.USTER_TESTNR || r.uster_testnr || r.usterTestnr || r.USTERTESTNR || '')
      return usterTestnr === String(testnr)
    })

    // Paso 2: Obtener los TESTNR de esos TENSORAPID_PAR (deduplicados)
    const tensorTestnrsList = [...new Set(
      tensorParMatches.map(r => String(r.TESTNR || r.testnr || '')).filter(Boolean)
    )]
    tensorTestnrs.value = tensorTestnrsList

    // Paso 3: Buscar filas en TENSORAPID_TBL que coincidan con esos TESTNR
    let tensorRows = (tensorapidTbl || []).filter(r => {
      const tblTestnr = String(r.TESTNR || r.testnr || '')
      return tensorTestnrsList.includes(tblTestnr)
    })

    // Deduplicar por TESTNR+HUSO_NUMBER en TENSORAPID_TBL
    tensorRows = dedupe(tensorRows, (r) => {
      const tn = String(r.TESTNR || r.testnr || '')
      const no = String(r.HUSO_NUMBER ?? r.NO ?? r.no ?? '')
      return tn && no ? `${tn}#${no}` : undefined
    })

    // Merge: combinar filas por HUSO (NO en Uster, HUSO_NUMBER en Tensor)
    // Crear mapas indexados por número de huso
    const usterByHuso = new Map()
    usterRows.forEach(row => {
      const husoNum = String(row.NO ?? row['NO_'] ?? row.HUSO ?? row.huso ?? '')
      if (husoNum) {
        usterByHuso.set(husoNum, row)
      }
    })

    const tensorByHuso = new Map()
    tensorRows.forEach(row => {
      const husoNum = String(row.HUSO_NUMBER ?? row.NO ?? row.no ?? row.huso ?? '')
      if (husoNum) {
        tensorByHuso.set(husoNum, row)
      }
    })

    // IMPORTANTE: Solo mostrar husos que existen en Uster (no unión de ambos)
    // Los datos de TensoRapid se agregan solo si hay match de huso
    const usterHusos = Array.from(usterByHuso.keys())
    
    // Ordenar numéricamente los husos
    const sortedHusos = usterHusos.sort((a, b) => {
      const numA = parseInt(a) || 0
      const numB = parseInt(b) || 0
      return numA - numB
    })

    const merged = []

    // Obtener Ne estándar del ensayo padre para calcular desvíos
    const parentRow = (rows.value || []).find(r => String(r.Ensayo) === String(testnr))
    // Ne puede venir como "10" o "10Flame", parseFloat extrae el número
    const neStandard = parentRow ? parseFloat(String(parentRow.Ne || '').replace(',', '.')) : 0

    sortedHusos.forEach(husoNum => {
      const uRow = usterByHuso.get(husoNum) || {}
      const tRow = tensorByHuso.get(husoNum) || {}

      // Calcular Desvío % para este huso: ((Ne - Titulo) / Ne) * 100
      const tituloVal = uRow.TITULO ?? uRow.titulo ?? ''
      let desvioPercent = ''
      if (neStandard > 0 && tituloVal !== '' && !isNaN(parseFloat(tituloVal))) {
        const t = parseFloat(tituloVal)
        const d = ((neStandard - t) / neStandard) * 100
        const formatted = parseFloat(d.toFixed(2))
        desvioPercent = (d > 0 ? '+' : '') + formatted
      }

      merged.push({
        NO: husoNum,
        TITULO: tituloVal,
        DESVIO_PERCENT: desvioPercent,
        CVM_PERCENT: uRow['CVM_%'] ?? uRow.CVM_PERCENT ?? '',
        DELG_MINUS30_KM: uRow['DELG_-30%'] ?? uRow.DELG_MINUS30_KM ?? '',
        DELG_MINUS40_KM: uRow['DELG_-40%'] ?? uRow.DELG_MINUS40_KM ?? '',
        DELG_MINUS50_KM: uRow['DELG_-50%'] ?? uRow.DELG_MINUS50_KM ?? '',
        GRUE_35_KM: uRow['GRUE_+35%'] ?? uRow.GRUE_35_KM ?? '',
        GRUE_50_KM: uRow['GRUE_+50%'] ?? uRow.GRUE_50_KM ?? '',
        NEPS_140_KM: uRow['NEPS_+140%'] ?? uRow.NEPS_140_KM ?? '',
        NEPS_280_KM: uRow['NEPS_+280%'] ?? uRow.NEPS_280_KM ?? '',
        FUERZA_B: tRow.FUERZA_B ?? tRow.fuerza_b ?? '',
        ELONGACION: tRow.ELONGACION ?? tRow.elongacion ?? '',
        TENACIDAD: tRow.TENACIDAD ?? tRow.tenacidad ?? '',
        TRABAJO: tRow.TRABAJO ?? tRow.trabajo ?? ''
      })
    })

    mergedRows.value = merged

    // Calcular estadísticas combinadas: avg, cv, sd, q95, max, min
    const stats = {}
    const fields = ['TITULO', 'CVM_PERCENT', 'DELG_MINUS30_KM', 'DELG_MINUS40_KM', 'DELG_MINUS50_KM',
      'GRUE_35_KM', 'GRUE_50_KM', 'NEPS_140_KM', 'NEPS_280_KM',
      'FUERZA_B', 'ELONGACION', 'TENACIDAD', 'TRABAJO']

    fields.forEach(field => {
      const values = merged
        .map(row => row[field])
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(v => Number(v))
        .filter(n => !isNaN(n))

      if (values.length > 0) {
        // Promedio
        const sum = values.reduce((a, b) => a + b, 0)
        const avg = sum / values.length

        // Desviación estándar (s)
        const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length
        const sd = Math.sqrt(variance)

        // Coeficiente de variación (CV%)
        const cv = avg !== 0 ? (sd / avg) * 100 : null

        // Máximo y Mínimo
        const max = Math.max(...values)
        const min = Math.min(...values)

        // Q95 (percentil 95)
        const sorted = [...values].sort((a, b) => a - b)
        const index95 = Math.ceil(sorted.length * 0.95) - 1
        const q95 = sorted[Math.max(0, index95)]

        stats[field] = { avg, sd, cv, q95, max, min, count: values.length }
      } else {
        stats[field] = { avg: null, sd: null, cv: null, q95: null, max: null, min: null, count: 0 }
      }
    })

    // Calcular Desvío % promedio (basado en el promedio del Título)
    if (stats.TITULO && stats.TITULO.avg != null && neStandard > 0) {
      const avgT = stats.TITULO.avg
      const d = ((neStandard - avgT) / neStandard) * 100
      stats.DESVIO_PERCENT = { avg: d }
    } else {
      stats.DESVIO_PERCENT = { avg: null }
    }

    combinedStats.value = stats
  } catch (error) {
    console.error('Error loading modal data:', error)
    mergedRows.value = []
  } finally {
    modalLoading.value = false
  }
})

const modalMeta = computed(() => {
  const u = selectedTestnr.value || '—'
  // Obtener el primer TESTNR de TensoRapid si existe
  const t = (Array.isArray(tensorTestnrs.value) && tensorTestnrs.value.length > 0) ? tensorTestnrs.value[0] : '—'
  // Recuperar meta del row que ya tiene TIME_STAMP preservado
  let meta = (rows.value || []).find(r => String(r?.Ensayo) === String(u)) || null
  if (!meta) meta = (usterTblRows.value && usterTblRows.value[0]) || (mergedRows.value && mergedRows.value[0]) || {}

  // Usar TIME_STAMP directamente (ya es Date object desde loadRows)
  const rawFecha = meta?.TIME_STAMP ?? meta?.TIME ?? meta?.TIMESTAMP ?? null

  let fechaStr = '—'
  // Si rawFecha es Date, formatear directamente
  if (rawFecha instanceof Date && !isNaN(rawFecha.getTime())) {
    const dd = String(rawFecha.getDate()).padStart(2, '0')
    const mm = String(rawFecha.getMonth() + 1).padStart(2, '0')
    const yy = String(rawFecha.getFullYear()).slice(-2)
    fechaStr = `${dd}/${mm}/${yy}`
  } else if (rawFecha) {
    // Fallback: usar displayFecha para convertir
    fechaStr = displayFecha(rawFecha) || '—'
  }
  const oe = meta?.OE ?? meta?.Oe ?? meta?.oe ?? '—'
  const ne = meta?.Ne ?? meta?.NE ?? meta?.ne ?? '—'
  // Observaciones: preferir campo USTER 'OBS' o variantes; normalizar a null si vacío
  let obsRaw = meta?.OBS ?? meta?.Obs ?? meta?.obs ?? meta?.observaciones ?? meta?.OBSERVACIONES ?? meta?.Observacion ?? meta?.observacion ?? null
  // Debug: verificar qué tiene meta
  if (u === '05496' || u === '05497') {
    console.log('DEBUG modalMeta para', u, ':', { meta, obsRaw, hasOBS: 'OBS' in (meta || {}) })
  }
  // Si obsRaw es un objeto, intentar extraer el valor correcto
  if (obsRaw && typeof obsRaw === 'object') {
    // Detectar objetos internos de Oracle/Node (LOB streams) y descartarlos
    if (obsRaw._readableState || obsRaw._writableState || obsRaw._parentObj || obsRaw.offset !== undefined) {
      obsRaw = null
    } else {
      // Intentar extraer valor de objetos normales
      obsRaw = obsRaw.value ?? obsRaw.text ?? obsRaw.obs ?? null
    }
  }
  const obs = (obsRaw == null || String(obsRaw).trim() === '') ? null : String(obsRaw).trim()
  // Laborant Uster: extraer de meta (viene en campo LABORANT)
  let laborantRaw = meta?.LABORANT ?? meta?.Laborant ?? meta?.laborant ?? null
  const laborant = (laborantRaw == null || String(laborantRaw).trim() === '') ? null : String(laborantRaw).trim()
  
  // Laborant TensoRapid: buscar en TENSORAPID_PAR por USTER_TESTNR
  let tensorLaborant = null
  if (u && allData.value?.tensorapidPar) {
    const tensorParMatch = allData.value.tensorapidPar.find(tp => {
      const usterTestnr = String(tp.USTER_TESTNR || tp.uster_testnr || tp.usterTestnr || tp.USTERTESTNR || '')
      return usterTestnr === String(u)
    })
    if (tensorParMatch) {
      const tensorLabRaw = tensorParMatch.LABORANT ?? tensorParMatch.Laborant ?? tensorParMatch.laborant ?? null
      tensorLaborant = (tensorLabRaw == null || String(tensorLabRaw).trim() === '') ? null : String(tensorLabRaw).trim()
    }
  }
  
  // Estiraje: extraer de meta (viene en campo ESTIRAJE)
  let estirajeRaw = meta?.ESTIRAJE ?? meta?.Estiraje ?? meta?.estiraje ?? null
  const estiraje = (estirajeRaw == null || String(estirajeRaw).trim() === '') ? null : String(estirajeRaw).trim()

  return { fechaStr, oe, ne, u, t, obs, laborant, tensorLaborant, estiraje }
})

// Index within the current filtered list for the selected ensayo
const modalIndex = computed(() => {
  const u = selectedTestnr.value
  if (u == null) return -1
  const list = filteredRows.value || []
  const idx = list.findIndex(r => String(r?.Ensayo) === String(u))
  console.log('modalIndex computed - selectedTestnr:', u, 'found at index:', idx, 'list length:', list.length)
  return idx
})

const modalPrevDisabled = computed(() => modalIndex.value <= 0)
const modalNextDisabled = computed(() => {
  const list = filteredRows.value || []
  return modalIndex.value === -1 || modalIndex.value >= list.length - 1
})

function modalPrev() {
  if (modalPrevDisabled.value) return
  const list = filteredRows.value || []
  const prev = list[modalIndex.value - 1]
  const testnr = prev?.Ensayo || prev?.TESTNR || prev?.testnr || prev?.Testnr
  console.log('modalPrev - Current index:', modalIndex.value, 'Prev testnr:', testnr, 'Prev item:', prev)
  if (testnr != null) {
    // Verificar que allData esté disponible antes de abrir el detalle
    if (!allData.value || !allData.value.usterTbl) {
      console.warn('Datos aún no cargados, esperando...')
      return
    }
    openDetail(testnr)
  } else {
    console.warn('No se pudo obtener testnr del item anterior:', prev)
  }
}

function modalNext() {
  if (modalNextDisabled.value) return
  const list = filteredRows.value || []
  const nxt = list[modalIndex.value + 1]
  const testnr = nxt?.Ensayo || nxt?.TESTNR || nxt?.testnr || nxt?.Testnr
  console.log('modalNext - Current index:', modalIndex.value, 'Next testnr:', testnr, 'Next item:', nxt)
  if (testnr != null) {
    // Verificar que allData esté disponible antes de abrir el detalle
    if (!allData.value || !allData.value.usterTbl) {
      console.warn('Datos aún no cargados, esperando...')
      return
    }
    openDetail(testnr)
  } else {
    console.warn('No se pudo obtener testnr del item siguiente:', nxt)
  }
}

function openDetail(testnr) {
  console.log('openDetail called with testnr:', testnr)
  console.log('modalIndex before:', modalIndex.value)
  selectedTestnr.value = testnr
  modalVisible.value = true
  console.log('modalIndex after:', modalIndex.value)
}

function closeModal() {
  modalVisible.value = false
  selectedTestnr.value = null
}

async function copyModalAsImage() {

  try {
    // Find the modal content element
    const modalEl = document.querySelector('[role="document"]')
    if (!modalEl) {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo encontrar el modal.' })
      return
    }

    // Find and hide prev/next buttons and modal action buttons temporarily
    const prevBtn = document.querySelector('[aria-label="Anterior ensayo"]')
    const nextBtn = document.querySelector('[aria-label="Siguiente ensayo"]')
    const exportBtn = document.querySelector('[aria-label="Exportar detalle a Excel"]')
    const copyBtn = document.querySelector('[aria-label="Copiar como imagen"]')
    const closeBtn = document.querySelector('[aria-label="Cerrar detalle"]')
    const prevBtnDisplay = prevBtn?.style.display
    const nextBtnDisplay = nextBtn?.style.display
    const exportBtnDisplay = exportBtn?.style.display
    const copyBtnDisplay = copyBtn?.style.display
    const closeBtnDisplay = closeBtn?.style.display
    if (prevBtn) prevBtn.style.display = 'none'
    if (nextBtn) nextBtn.style.display = 'none'
    if (exportBtn) exportBtn.style.display = 'none'
    if (copyBtn) copyBtn.style.display = 'none'
    if (closeBtn) closeBtn.style.display = 'none'

    // Show loading indicator (short)
    Swal.fire({
      title: 'Capturando...',
      allowOutsideClick: false,
      showConfirmButton: false,
      timer: 100,
      didOpen: () => {
        Swal.showLoading()
      }
    })

    // Temporarily suppress console errors for font loading issues
    const originalConsoleError = console.error
    console.error = (...args) => {
      const message = args[0]?.toString() || ''
      // Suppress CORS and CSS rules errors (they don't affect the final image)
      if (message.includes('CSS rules') ||
        message.includes('cssRules') ||
        message.includes('SecurityError')) {
        return
      }
      originalConsoleError.apply(console, args)
    }

    try {
      // Use html-to-image to capture the modal (supports modern CSS)
      // NOTE: skipFonts=true avoids inlining remote stylesheets (cssRules SecurityError)
      const dataUrl = await toPng(modalEl, {
        quality: 0.95, // Slightly lower quality for faster processing
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        skipFonts: true,
        cacheBust: true
      })

      // Restore console.error
      console.error = originalConsoleError

      // Restore prev/next and modal action buttons
      if (prevBtn) prevBtn.style.display = prevBtnDisplay || ''
      if (nextBtn) nextBtn.style.display = nextBtnDisplay || ''
      if (exportBtn) exportBtn.style.display = exportBtnDisplay || ''
      if (copyBtn) copyBtn.style.display = copyBtnDisplay || ''
      if (closeBtn) closeBtn.style.display = closeBtnDisplay || ''

      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      try {
        // Try to copy to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob })
        ])

        Swal.fire({
          icon: 'success',
          title: '¡Copiado!',
          text: 'Pega en WhatsApp: Ctrl+V',
          timer: 1500,
          showConfirmButton: false
        })
      } catch (clipboardErr) {
        console.warn('Clipboard not available, downloading instead:', clipboardErr)

        // Fallback: download the image
        const link = document.createElement('a')
        link.download = `ensayo-${selectedTestnr.value || 'detalle'}.png`
        link.href = dataUrl
        link.click()

        Swal.fire({
          icon: 'success',
          title: 'Descargado',
          text: 'Imagen lista para WhatsApp',
          timer: 1500,
          showConfirmButton: false
        })
      }
    } catch (captureError) {
      // Restore console.error and buttons even if capture fails
      console.error = originalConsoleError
      if (prevBtn) prevBtn.style.display = prevBtnDisplay || ''
      if (nextBtn) nextBtn.style.display = nextBtnDisplay || ''
      if (exportBtn) exportBtn.style.display = exportBtnDisplay || ''
      if (copyBtn) copyBtn.style.display = copyBtnDisplay || ''
      if (closeBtn) closeBtn.style.display = closeBtnDisplay || ''
      throw captureError
    }
  } catch (err) {
    console.error('Error capturing modal:', err)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: `No se pudo capturar la imagen: ${err.message}`
    })
  }

}

// Export only the currently-open modal's mergedRows to an XLSX file using ExcelJS
async function exportModalToExcel() {
  try {
    const rows = (mergedRows.value || [])
    if (!rows.length) {
      Swal.fire({ icon: 'info', title: 'Nada para exportar', text: 'No hay filas en el detalle del ensayo.' })
      return
    }

    // Headers: include Observaciones after Trabajo, then Uster/TensoRapid
    const headers = ['Huso', 'Fecha', 'Ne', 'OE Nro.', 'Titulo', 'Estiraje', 'CVm %', 'Delg -30%', 'Delg -40%', 'Delg -50%', 'Grue +35%', 'Grue +50%', 'Neps +140%', 'Neps +280%', 'Fuerza B', 'Elongación %', 'Tenacidad', 'Trabajo', 'Observaciones', 'Uster', 'TensoRapid']

    // helper to coerce each cell value
    const coerce = (raw) => {
      if (raw == null || raw === '') return ''
      if (typeof raw === 'number') return raw
      const s = String(raw).trim()
      const n = Number(s.replace(/,/g, '.').replace(/[^0-9.+\-eE]/g, ''))
      return Number.isFinite(n) ? n : s
    }

    // Build body rows with order matching `headers`
    // Huso, Fecha, Ne, OE Nro., Titulo, CVm %, ... , Trabajo, Observaciones, Uster, TensoRapid
    const bodyRows = rows.map(r => {
      const rowVals = []
      // Huso (NO)
      rowVals.push(coerce(r.NO))
      // Fecha - use modalMeta which has the actual fecha
      rowVals.push(modalMeta.value.fechaStr || '')
      // Ne, OE
      rowVals.push(modalMeta.value.ne || '')
      rowVals.push(modalMeta.value.oe || '')
      // Titulo
      rowVals.push(coerce(r.TITULO))
      // Estiraje
      rowVals.push(modalMeta.value.estiraje || '')
      // CVm %
      rowVals.push(coerce(r.CVM_PERCENT))
      // Delg / Grue / Neps
      rowVals.push(coerce(r.DELG_MINUS30_KM))
      rowVals.push(coerce(r.DELG_MINUS40_KM))
      rowVals.push(coerce(r.DELG_MINUS50_KM))
      rowVals.push(coerce(r.GRUE_35_KM))
      rowVals.push(coerce(r.GRUE_50_KM))
      rowVals.push(coerce(r.NEPS_140_KM))
      rowVals.push(coerce(r.NEPS_280_KM))
      // TensoRapid metrics
      rowVals.push(coerce(r.FUERZA_B))
      rowVals.push(coerce(r.ELONGACION))
      rowVals.push(coerce(r.TENACIDAD))
      rowVals.push(coerce(r.TRABAJO))
      // Observaciones (from modalMeta.obs or per-row if exists)
      rowVals.push((r.OBS ?? modalMeta.value.obs) || '')
      // Uster and TensoRapid identifiers (repeat for each row)
      rowVals.push(modalMeta.value.u || '')
      rowVals.push(modalMeta.value.t || '')

      return rowVals
    })

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'carga-datos-vue'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('Detalle')

    // Freeze like C2 for modal export as well (optional but consistent)
    try { sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1, topLeftCell: 'C2', activeCell: 'C2' }] } catch { /* ignore */ }

    sheet.addRow(headers)
    bodyRows.forEach(r => sheet.addRow(r))
    // Custom widths for modal export
    const modalWidthMap = {
      'Huso': 10,
      'Fecha': 11,
      'Ne': 7.29,
      'OE Nro.': 8.29,
      'Titulo': 8.14,
      'CVm %': 7.5,
      'Delg -30%': 7.5,
      'Delg -40%': 7.5,
      'Delg -50%': 7.5,
      'Grue +35%': 7.5,
      'Grue +50%': 7.5,
      'Neps +140%': 7.5,
      'Neps +280%': 7.5,
      'Fuerza B': 7.5,
      'Elongación %': 7.5,
      'Tenacidad': 7.5,
      'Trabajo': 7.5,
      'Observaciones': 68.5,
      'Uster': 10,
      'TensoRapid': 11
    }
    sheet.columns = headers.map(h => ({ header: h, width: modalWidthMap[h] || Math.max(8, String(h).length + 4) }))

    // Header styling
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
    })

    const lastRowNumber = bodyRows.length + 1
    const lastColNumber = headers.length
    try { sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRowNumber, column: lastColNumber } } } catch { /* ignore */ }

    // Numeric columns for modal export: specific columns trim zeros, others 2 decimals; Neps as integers
    try {
      // Columns to show as integers (no decimals)
      const trimCols = ['Delg -30%', 'Delg -40%', 'Delg -50%', 'Grue +35%', 'Grue +50%', 'Fuerza B']
      trimCols.forEach(name => {
        const idx = headers.indexOf(name)
        if (idx !== -1) {
          const col = sheet.getColumn(idx + 1)
          col.numFmt = '0'
        }
      })
      // Columns to force 2 decimals
      const twoDecCols = ['Titulo', 'CVm %', 'Elongación %', 'Tenacidad', 'Trabajo']
      twoDecCols.forEach(name => {
        const idx = headers.indexOf(name)
        if (idx !== -1) {
          const col = sheet.getColumn(idx + 1)
          col.numFmt = '0.00'
        }
      })
        // Neps columns as integers
        ;['Neps +140%', 'Neps +280%'].forEach(name => {
          const idx = headers.indexOf(name)
          if (idx !== -1) {
            const col = sheet.getColumn(idx + 1)
            col.numFmt = '0'
          }
        })
    } catch { /* ignore */ }

    for (let rn = 2; rn <= lastRowNumber; rn++) {
      const row = sheet.getRow(rn)
      const isEven = (rn % 2) === 0
      row.height = 18
      row.eachCell(cell => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (isEven) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
      })
    }
    // Ensure Fecha column values are actual Date objects in Excel (col 1)
    const fechaIdx = headers.findIndex(h => String(h).toLowerCase().includes('fecha'))
    if (fechaIdx !== -1) {
      const col = sheet.getColumn(fechaIdx + 1)
      col.numFmt = 'dd/mm/yyyy'
      // parse cell strings like dd/mm/yyyy into Date
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const cell = row.getCell(fechaIdx + 1)
        const v = cell.value
        if (v == null || v === '') return
        if (v instanceof Date) return
        // try parse dd/mm/yyyy or ISO
        const s = String(v).trim()
        const m = s.match(/^([0-9]{1,2})[-/.]([0-9]{1,2})[-/.]([0-9]{2,4})$/)
        if (m) {
          let d = parseInt(m[1], 10)
          let mo = parseInt(m[2], 10)
          let y = parseInt(m[3], 10)
          if (y < 100) y += y >= 70 ? 1900 : 2000
          const dt = new Date(y, mo - 1, d)
          if (!isNaN(dt.getTime())) cell.value = dt
        } else {
          const dt = new Date(s)
          if (!isNaN(dt.getTime())) cell.value = dt
        }
      })
    }

    // Append statistics section below the data (if available). Each stats row repeats Fecha, Ne, OE Nro. in first 3 columns
    try {
      const stats = combinedStats.value || {}
      const metricCols = ['TITULO', 'CVM_PERCENT', 'DELG_MINUS30_KM', 'DELG_MINUS40_KM', 'DELG_MINUS50_KM', 'GRUE_35_KM', 'GRUE_50_KM', 'NEPS_140_KM', 'NEPS_280_KM', 'FUERZA_B', 'ELONGACION', 'TENACIDAD', 'TRABAJO']

      const statLabels = [
        { key: 'avg', label: 'Promedio' },
        { key: 'cv', label: 'CV' },
        { key: 'sd', label: 's' },
        { key: 'q95', label: 'Q95' },
        { key: 'max', label: 'Máx' },
        { key: 'min', label: 'Mín' }
      ]

      // for each stat label, add a row with Label in the first column (Huso), then Fecha, Ne, OE,
      // then values per metricCols, then Observaciones, and finally Uster/TensoRapid
      statLabels.forEach(sl => {
        const rowVals = []
        // Label goes into the first column (Huso column for stats)
        rowVals.push(sl.label)
        // use first data row's date if available, else modalMeta
        const firstDataFecha = bodyRows.length ? bodyRows[0][1] : null // note: bodyRows[0][1] is Fecha (second column)
        rowVals.push(firstDataFecha || modalMeta.value.fechaStr || '')
        rowVals.push(modalMeta.value.ne || '')
        rowVals.push(modalMeta.value.oe || '')

        metricCols.forEach(metric => {
          const s = stats[metric] || {}
          const v = s[sl.key]
          if (v == null) rowVals.push('')
          else if (typeof v === 'number') rowVals.push(Number(v.toFixed(2)))
          else rowVals.push(v)
        })

        // Append Observaciones, Uster and TensoRapid identifiers to the statistics rows as well
        rowVals.push(modalMeta.value.obs || '')
        rowVals.push(modalMeta.value.u || '')
        rowVals.push(modalMeta.value.t || '')

        const r = sheet.addRow(rowVals)
        r.height = 18
        r.eachCell(cell => { cell.alignment = { horizontal: 'center', vertical: 'middle' } })
      })
    } catch {
      // non-fatal
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    link.href = url
    link.setAttribute('download', `detalle-ensayo-${modalMeta.value.u || 'ensayo'}-${ts}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    Swal.fire({ icon: 'success', title: 'Exportado', text: 'Detalle exportado a XLSX.', timer: 1200, showConfirmButton: false })
  } catch (err) {
    console.error('Error exportando detalle a XLSX', err)
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar el detalle.' })
  }
}

// Formatea OE: quita ceros a la izquierda y toma solo las primeras 2 letras
// Example: "0012ABCD" -> "12 AB", "5XY" -> "5 XY", "003 LP" -> "3 LP"
function formatOE(val) {
  if (!val) return ''
  const str = String(val).trim()
  if (!str) return str

  // Separar números y letras (con o sin espacio intermedio)
  const match = str.match(/^(\d+)\s*([A-Za-z]+)?/)
  if (!match) return str

  const numPart = parseInt(match[1], 10) // Quita ceros a la izquierda
  const letterPart = match[2] ? match[2].substring(0, 2).toUpperCase() : ''

  return letterPart ? `${numPart} ${letterPart}` : String(numPart)
}

async function loadRows() {
  loading.value = true

  try {
    // Usar solo Firebase en web
    const allDataFetched = await fetchAllStatsData()
    allData.value = allDataFetched

    // --- NUEVA LÓGICA: Combinar USTER_PAR con TENSORAPID_PAR (por USTER_PAR.TESTNR = TENSORAPID_PAR.USTER_TESTNR) ---
    const parArr = Array.isArray(allDataFetched.usterPar) ? allDataFetched.usterPar : []
    const tblArr = Array.isArray(allDataFetched.usterTbl) ? allDataFetched.usterTbl : []
    const tensorTblArr = Array.isArray(allDataFetched.tensorapidTbl) ? allDataFetched.tensorapidTbl : []
    const tensorParArr = Array.isArray(allDataFetched.tensorapidPar) ? allDataFetched.tensorapidPar : []

    // Mapas por TESTNR - agrupar TODAS las filas (no solo la primera)
    const tblByTestnr = new Map()
    tblArr.forEach(row => {
      const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
      if (testnr) {
        if (!tblByTestnr.has(testnr)) tblByTestnr.set(testnr, [])
        tblByTestnr.get(testnr).push(row)
      }
    })

    // Mapas por TESTNR para TENSORAPID_TBL - agrupar TODAS las filas
    const tensorTblByTestnr = new Map()
    tensorTblArr.forEach(row => {
      const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
      if (testnr) {
        if (!tensorTblByTestnr.has(testnr)) tensorTblByTestnr.set(testnr, [])
        tensorTblByTestnr.get(testnr).push(row)
      }
    })

    // Agrupar TENSORAPID_PAR por USTER_TESTNR
    const tensorParByUster = new Map()
    tensorParArr.forEach(row => {
      const usterTestnr = String(row.USTER_TESTNR ?? row.uster_testnr ?? row.usterTestnr ?? '')
      if (!usterTestnr) return
      if (!tensorParByUster.has(usterTestnr)) tensorParByUster.set(usterTestnr, [])
      tensorParByUster.get(usterTestnr).push(row)
    })

    // Función helper para calcular promedio de un campo
    const calcAvg = (rows, field) => {
      const values = rows
        .map(r => r[field])
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(v => Number(v))
        .filter(n => !isNaN(n))

      if (values.length === 0) return ''
      const avg = values.reduce((a, b) => a + b, 0) / values.length
      // Formatear: redondear a 2 decimales y quitar ceros innecesarios
      return Number(avg.toFixed(2)).toString()
    }

    // Para cada USTER_PAR, buscar el TENSORAPID_PAR más reciente (por fecha) que matchee
    let data = parArr.map(row => {
      const testnr = String(row.TESTNR ?? row.testnr ?? row.Testnr ?? '')
      const tblRows = tblByTestnr.get(testnr) || []

      // Buscar matches en TENSORAPID_PAR
      let tensorapidMatch = []
      if (tensorParByUster.has(testnr)) {
        tensorapidMatch = tensorParByUster.get(testnr)
      }
      // Elegir el más reciente por TIME_STAMP (o el primero si no hay fecha)
      let tensorPar = null
      if (tensorapidMatch.length > 0) {
        tensorPar = tensorapidMatch.slice().sort((a, b) => {
          const da = new Date(a.TIME_STAMP || a.time_stamp || 0)
          const db = new Date(b.TIME_STAMP || b.time_stamp || 0)
          return db - da
        })[0]
      }
      // Buscar TENSORAPID_TBL rows por TESTNR de tensorPar
      let tensorTblRows = []
      if (tensorPar && tensorPar.TESTNR) {
        tensorTblRows = tensorTblByTestnr.get(String(tensorPar.TESTNR)) || []
      }

      // Convertir TIME_STAMP a Date object para ordenamiento correcto
      // Manejar formato europeo DD/MM/YYYY HH:mm:ss si viene como string
      const timeStampRaw = row.TIME_STAMP || row.TIME || row.TIMESTAMP || null
      let timeStamp = null
      
      if (timeStampRaw) {
        if (timeStampRaw instanceof Date) {
          timeStamp = timeStampRaw
        } else if (typeof timeStampRaw === 'string') {
          // Intentar parsear formato europeo DD/MM/YYYY HH:mm:ss
          const match = timeStampRaw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
          if (match) {
            const day = parseInt(match[1], 10)
            const month = parseInt(match[2], 10) - 1 // Mes en Date es 0-indexed
            let year = parseInt(match[3], 10)
            // Si el año es de 2 dígitos, asumir 20xx
            if (year < 100) year += 2000
            const hour = match[4] ? parseInt(match[4], 10) : 0
            const minute = match[5] ? parseInt(match[5], 10) : 0
            const second = match[6] ? parseInt(match[6], 10) : 0
            timeStamp = new Date(year, month, day, hour, minute, second)
          } else {
            // Fallback: intentar parseo automático
            timeStamp = new Date(timeStampRaw)
          }
        } else {
          timeStamp = new Date(timeStampRaw)
        }
      }

      // TensoRapid test number (if present)
      const tensorRapidTestnr = tensorPar && (tensorPar.TESTNR ?? tensorPar.testnr ?? tensorPar.Testnr)
        ? String(tensorPar.TESTNR ?? tensorPar.testnr ?? tensorPar.Testnr)
        : ''

      const obsValue = row.OBS ?? row.OBSERVACION ?? row.OBSERVACAO ?? row.obs ?? ''
      const laborantValue = row.LABORANT ?? row.Laborant ?? row.laborant ?? ''
      const laborantTensor = tensorPar ? (tensorPar.LABORANT ?? tensorPar.Laborant ?? tensorPar.laborant ?? '') : ''
      
      // Calcular Desvío %: ((Ne - Titulo) / Ne) × 100
      // Positivo = más grueso (Titulo < Ne), Negativo = más delgado (Titulo > Ne)
      const neValue = parseFloat(row.NOMCOUNT ?? row.Ne ?? row.NE ?? 0)
      const tituloValue = calcAvg(tblRows, 'TITULO')
      const tituloNum = tituloValue ? parseFloat(tituloValue) : null
      let desvioPercent = '—'
      
      if (neValue > 0 && tituloNum !== null && !isNaN(tituloNum)) {
        const desvio = ((neValue - tituloNum) / neValue) * 100
        // Usar parseFloat para eliminar ceros innecesarios: 1.00 → 1, 1.50 → 1.5
        const formatted = parseFloat(desvio.toFixed(2))
        desvioPercent = (desvio > 0 ? '+' : '') + formatted
      }

      return {
        Ensayo: testnr,
        TIME_STAMP: timeStamp,  // Guardar el timestamp original
        Fecha: row.Fecha || row.fecha || row.FECHA || '',  // Mantener Fecha si existe, pero priorizar TIME_STAMP
        Lote: formatLote(row.LOTE || row.Lote || row.lote || ''),
        OE: formatOE(row.MASCHNR ?? row.OE ?? row.OE_NRO ?? row.OE_NRO_1 ?? row.oe ?? row.OE_NRO_PAR ?? ''),
        Ne: formatNe(row.NOMCOUNT ?? row.Ne ?? row.NE ?? row.titulo ?? row.TITULO ?? '', row.MATCLASS),
        'Desvío %': desvioPercent,
        Titulo: calcAvg(tblRows, 'TITULO'),
        Estiraje: formatEstiraje(row.ESTIRAJE),
        Pasador: row.PASADOR || null,
        'CVm %': calcAvg(tblRows, 'CVM_PERCENT') || calcAvg(tblRows, 'CVM_%'),
        'Delg -30%': calcAvg(tblRows, 'DELG_MINUS30_KM') || calcAvg(tblRows, 'DELG_-30%'),
        'Delg -40%': calcAvg(tblRows, 'DELG_MINUS40_KM') || calcAvg(tblRows, 'DELG_-40%'),
        'Delg -50%': calcAvg(tblRows, 'DELG_MINUS50_KM') || calcAvg(tblRows, 'DELG_-50%'),
        'Grue +35%': calcAvg(tblRows, 'GRUE_35_KM') || calcAvg(tblRows, 'GRUE_+35%'),
        'Grue +50%': calcAvg(tblRows, 'GRUE_50_KM') || calcAvg(tblRows, 'GRUE_+50%'),
        'Neps +140%': calcAvg(tblRows, 'NEPS_140_KM') || calcAvg(tblRows, 'NEPS_+140%'),
        'Neps +280%': calcAvg(tblRows, 'NEPS_280_KM') || calcAvg(tblRows, 'NEPS_+280%'),
        'Fuerza B': calcAvg(tensorTblRows, 'FUERZA_B'),
        'Elong. %': calcAvg(tensorTblRows, 'ELONGACION'),
        'Tenac.': calcAvg(tensorTblRows, 'TENACIDAD'),
        'Trabajo B': calcAvg(tensorTblRows, 'TRABAJO'),
        OBS: obsValue,
        LABORANT: laborantValue,
        'Op. Uster': laborantValue,
        'Op. TensoRapid': laborantTensor,
        TensoRapid: tensorRapidTestnr,
      }
    })

    // (Opcional) Si quieres agregar los TENSORAPID_TBL que no tienen USTER_PAR, puedes hacerlo aquí igual que antes
    // tensorTblArr.forEach(tensorTbl => { ... })


    // Ne solo depende de NOMCOUNT y MATCLASS, sin lógica de OBS
    data = data.map(row => {
      let isFlame = String(row.MATCLASS).toLowerCase() === 'hilo de fantasia'
      return { ...row, _isFlame: isFlame }
    })

    // Ordenar por TIME_STAMP (descendente: más nuevos primero) y luego por Ensayo (descendente)
    data.sort((a, b) => {
      // Asegurar que tenemos Date objects válidos
      const dateA = a.TIME_STAMP && a.TIME_STAMP instanceof Date && !isNaN(a.TIME_STAMP) 
        ? a.TIME_STAMP 
        : new Date(0)
      const dateB = b.TIME_STAMP && b.TIME_STAMP instanceof Date && !isNaN(b.TIME_STAMP) 
        ? b.TIME_STAMP 
        : new Date(0)

      // Primero por fecha (descendente: más reciente primero)
      // dateB - dateA para ordenar descendente (más nuevo primero)
      const dateDiff = dateB.getTime() - dateA.getTime()
      if (dateDiff !== 0) return dateDiff

      // Si fechas iguales, ordenar por Ensayo (descendente: mayor primero)
      const ensayoA = String(a.Ensayo || '').trim()
      const ensayoB = String(b.Ensayo || '').trim()
      return ensayoB.localeCompare(ensayoA, undefined, { numeric: true })
    })

    // Deduplicar por Ensayo (mantener el primer registro - el más reciente por la ordenación)
    const seenEnsayos = new Set()
    data = data.filter(row => {
      const ensayo = String(row.Ensayo || '').trim()
      if (seenEnsayos.has(ensayo)) {
        console.warn('Ensayo duplicado encontrado y eliminado:', ensayo)
        return false
      }
      seenEnsayos.add(ensayo)
      return true
    })

    rows.value = data
  } catch (err) {
    console.error('Failed to load rows', err)
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el informe completo.' })
  } finally {
    loading.value = false
  }
}

async function exportToExcel() {
  try {
    if (!filteredRows.value || filteredRows.value.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'No hay registros para exportar.' })
      return
    }

    // Headers for export: move Uster (Ensayo) after OBS and add TensoRapid
    const headers = [
      'Fecha',
      'Lote',
      'OE',
      'Ne',
      'Desvío %',
      'Titulo',
      'Estiraje',
      'Pasador',
      'CVm %',
      'Delg -30%',
      'Delg -40%',
      'Delg -50%',
      'Grue +35%',
      'Grue +50%',
      'Neps +140%',
      'Neps +280%',
      'Fuerza B',
      'Elong. %',
      'Tenac.',
      'Trabajo B',
      'OBS',
      'Op. Uster',
      'Op. TensoRapid',
      'Uster',
      'TensoRapid'
    ]

    // Helper to coerce each cell value
    const coerce = (raw) => {
      if (raw == null || raw === '') return ''
      if (typeof raw === 'number') return raw
      const s = String(raw).trim()
      const n = Number(s.replace(/,/g, '.').replace(/[^0-9.+\-eE]/g, ''))
      return Number.isFinite(n) ? n : s
    }

    // Build body rows in the new order (with OBS, Uster, TensoRapid at the end)
    const bodyRows = filteredRows.value.map(r => [
      displayFecha(getPreferredFecha(r)),
      r['Lote'] || '',
      r['OE'] || '',
      r['Ne'] || '',
      // Convertir el decimal a coma para que Excel (locale ES) lo trate como número
      (r['Desvío %'] == null ? '' : String(r['Desvío %']).replace(/\./g, ',')),
      coerce(r['Titulo']),
      coerce(r['Estiraje']),
      r['Pasador'] || '-',
      coerce(r['CVm %']),
      coerce(r['Delg -30%']),
      coerce(r['Delg -40%']),
      coerce(r['Delg -50%']),
      coerce(r['Grue +35%']),
      coerce(r['Grue +50%']),
      coerce(r['Neps +140%']),
      coerce(r['Neps +280%']),
      coerce(r['Fuerza B']),
      coerce(r['Elong. %']),
      coerce(r['Tenac.']),
      coerce(r['Trabajo B']),
      r['OBS'] || '',
      r['Op. Uster'] || '',
      r['Op. TensoRapid'] || '',
      coerce(r['Ensayo']), // Uster test number (renamed)
      r['TensoRapid'] || '' // present only if exists
    ])

    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'carga-datos-vue'
    workbook.created = new Date()
    const sheet = workbook.addWorksheet('Resumen')

    // Freeze first 2 columns and first row
    try {
      sheet.views = [{ state: 'frozen', xSplit: 2, ySplit: 1, topLeftCell: 'C2', activeCell: 'C2' }]
    } catch { /* ignore */ }

    // Add headers
    sheet.addRow(headers)

    // Add data rows
    bodyRows.forEach(r => sheet.addRow(r))
    // Custom column widths mapping (Excel character units)
    const widthMap = {
      'Fecha': 10.5,
      'OE': 7.29,
      'Ne': 8.29,
      'Desvío %': 9,
      'Titulo': 8.14,
      'CVm %': 7.5,
      'Delg -30%': 7.5,
      'Delg -40%': 7.5,
      'Delg -50%': 7.5,
      'Grue +35%': 7.5,
      'Grue +50%': 7.5,
      'Neps +140%': 7.5,
      'Neps +280%': 7.5,
      'Fuerza B': 7.5,
      'Elong. %': 7.5,
      'Tenac.': 7.5,
      'Trabajo B': 7.5,
      'OBS': 68.5,
      'Uster': 10,
      'TensoRapid': 11
    }
    sheet.columns = headers.map(h => ({ header: h, width: widthMap[h] || Math.max(10, String(h).length + 2) }))

    // Header styling
    const headerRow = sheet.getRow(1)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.height = 30 // custom header row height
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }
      cell.border = { bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } } }
    })

    // AutoFilter
    const lastRowNumber = bodyRows.length + 1
    const lastColNumber = headers.length
    try {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: lastRowNumber, column: lastColNumber } }
    } catch { /* ignore */ }

    // Numeric columns formats: specific columns trim trailing zeros, others 2 decimals; Neps as integers
    try {
      // Columns to show as integers (no decimals to avoid trailing separator)
      const trimCols = ['Delg -30%', 'Delg -40%', 'Delg -50%', 'Grue +35%', 'Grue +50%', 'Fuerza B']
      trimCols.forEach(name => {
        const idx = headers.indexOf(name)
        if (idx !== -1) {
          const col = sheet.getColumn(idx + 1)
          col.numFmt = '0'
        }
      })
      // Columns to force 2 decimals (Desvío % excluido porque usa formato de texto con signo)
      const twoDecCols = ['Titulo', 'Estiraje', 'CVm %', 'Elong. %', 'Tenac.', 'Trabajo B']
      twoDecCols.forEach(name => {
        const idx = headers.indexOf(name)
        if (idx !== -1) {
          const col = sheet.getColumn(idx + 1)
          col.numFmt = '0.00'
        }
      })
        // Neps columns as integers
        ;['Neps +140%', 'Neps +280%'].forEach(name => {
          const idx = headers.indexOf(name)
          if (idx !== -1) {
            const col = sheet.getColumn(idx + 1)
            col.numFmt = '0'
          }
        })
    } catch { /* ignore */ }

    // Data row styling (alternating rows)
    for (let rn = 2; rn <= lastRowNumber; rn++) {
      const row = sheet.getRow(rn)
      const isEven = (rn % 2) === 0
      row.height = 18
      row.eachCell(cell => {
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (isEven) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFF' } }
        }
      })
    }
    
    // Aplicar formato condicional a la columna "Desvío %"
    const desvioIdx = headers.indexOf('Desvío %')
    if (desvioIdx !== -1) {
      for (let rn = 2; rn <= lastRowNumber; rn++) {
        const row = sheet.getRow(rn)
        const cell = row.getCell(desvioIdx + 1)
        let val = cell.value
        
        // Convertir string a número si es necesario (ej: "+5.10" → 5.10, "+5,10" → 5.10)
        if (typeof val === 'string') {
          const cleaned = val.replace(',', '.').replace(/\s+/g, '')
          val = parseFloat(cleaned)
        }
        // Si es numérico, escribirlo como número para que Excel lo trate como tal
        if (typeof val === 'number' && !isNaN(val)) {
          cell.value = val
        }
        
        if (typeof val === 'number' && !isNaN(val)) {
          // Rojo: más grueso (> +1.5%)
          if (val > 1.5) {
            cell.font = { bold: true, color: { argb: 'FFDC2626' } } // red-600
          }
          // Azul: más fino (< -1.5%)
          else if (val < -1.5) {
            cell.font = { bold: true, color: { argb: 'FF2563EB' } } // blue-600
          }
          // Verde: dentro del rango (-1.5% a +1.5%)
          else {
            cell.font = { bold: true, color: { argb: 'FF16A34A' } } // green-600
          }
        }
      }
    }

    // Format Fecha column as dates
    const fechaIdx = headers.findIndex(h => String(h).toLowerCase().includes('fecha'))
    if (fechaIdx !== -1) {
      const col = sheet.getColumn(fechaIdx + 1)
      col.numFmt = 'dd/mm/yyyy'
      // Parse cell strings like dd/mm/yy into Date objects
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return
        const cell = row.getCell(fechaIdx + 1)
        const v = cell.value
        if (v == null || v === '') return
        if (v instanceof Date) return
        // Try parse dd/mm/yy or dd/mm/yyyy
        const s = String(v).trim()
        const m = s.match(/^([0-9]{1,2})[-/.]([0-9]{1,2})[-/.]([0-9]{2,4})$/)
        if (m) {
          let d = parseInt(m[1], 10)
          let mo = parseInt(m[2], 10)
          let y = parseInt(m[3], 10)
          if (y < 100) y += y >= 70 ? 1900 : 2000
          const dt = new Date(y, mo - 1, d)
          if (!isNaN(dt.getTime())) cell.value = dt
        } else {
          const dt = new Date(s)
          if (!isNaN(dt.getTime())) cell.value = dt
        }
      })
    }

    // Generate file and download
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const now = new Date()
    const pad = n => String(n).padStart(2, '0')
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
    link.href = url
    link.setAttribute('download', `resumen-ensayos-${ts}.xlsx`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    Swal.fire({ icon: 'success', title: 'Exportado', text: `${bodyRows.length} registros exportados a XLSX.`, timer: 1500, showConfirmButton: false })
  } catch (err) {
    console.error('Error exporting XLSX (ExcelJS)', err)
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo exportar a XLSX.' })
  }
}

onMounted(() => {
  loadRows()
  
  // Add ESC key listener to close modal
  const handleEscKey = (event) => {
    if (event.key === 'Escape' && modalVisible.value) {
      closeModal()
    }
  }
  window.addEventListener('keydown', handleEscKey)
  
  // Store handler reference for cleanup
  window._resumenEnsayosEscHandler = handleEscKey
})

onBeforeUnmount(() => {
  try {
    if (window._resumenEnsayosEscHandler) {
      window.removeEventListener('keydown', window._resumenEnsayosEscHandler)
      delete window._resumenEnsayosEscHandler
    }
  } catch { /* ignore */ }
})
</script>

<style scoped>
/* Minimal modern scrollbar for the modal table wrapper only (Firefox + WebKit) */
.modal-scroll {
  /* Firefox */
  scrollbar-width: thin;
  /* thumb then track */
  scrollbar-color: rgba(99, 102, 241, 0.35) transparent;
}

.modal-scroll::-webkit-scrollbar {
  width: 8px;
}

.modal-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.modal-scroll::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.35);
  border-radius: 999px;
  border: 2px solid transparent;
  background-clip: padding-box;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.14);
  transition: background 160ms linear, box-shadow 160ms linear;
}

.modal-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.65);
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.24);
}

.modal-scroll::-webkit-scrollbar-thumb:active {
  box-shadow: 0 0 16px rgba(99, 102, 241, 0.28);
}

/* Hide native clear/cancel icons for search inputs to avoid duplicate X buttons */
input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
  -webkit-appearance: none;
}

/* IE/Edge clear */
input[type="search"]::-ms-clear,
input[type="search"]::-ms-reveal {
  display: none;
  width: 0;
  height: 0;
}

/* Custom clear button small hit target adjustments */
.custom-clear {
  width: 1.5rem;
  height: 1.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
