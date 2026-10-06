<template>
  <div class="p-3 md:p-4 bg-slate-50 min-h-screen text-slate-800 flex flex-col gap-3">

    <!-- HEADER: una sola línea, colapso progresivo sin flex-wrap -->
    <header class="bg-white border border-slate-200 rounded-lg shadow-sm shrink-0">
      <div class="flex items-center gap-1.5 md:gap-2 h-12 px-2 md:px-3 min-w-0">

        <!-- Título -->
        <div class="flex items-center gap-2 min-w-0 shrink" v-tippy="'Trazabilidad Causa Raíz'">
          <ClipboardDocumentListIcon class="w-5 h-5 text-slate-400 shrink-0" />
          <h1 class="hidden xl:block text-sm font-semibold text-slate-800 truncate whitespace-nowrap">Trazabilidad Causa Raíz</h1>
        </div>

        <div class="w-px h-5 bg-slate-200 shrink-0 hidden sm:block"></div>

        <!-- Tabs (segmented) -->
        <div class="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
          <button
            @click="activeTab = 'lote'"
            aria-label="Vista por Lote"
            v-tippy="'Vista por Lote'"
            :class="['flex items-center gap-1.5 px-2 h-7 rounded-md text-[13px] transition-colors whitespace-nowrap', activeTab === 'lote' ? 'bg-white shadow-sm text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800']"
          >
            <TableCellsIcon class="w-4 h-4" />
            <span class="hidden lg:inline">Lote</span>
          </button>
          <button
            @click="activeTab = 'rolada'"
            aria-label="Vista por Rolada"
            v-tippy="'Vista por Rolada'"
            :class="['flex items-center gap-1.5 px-2 h-7 rounded-md text-[13px] transition-colors whitespace-nowrap', activeTab === 'rolada' ? 'bg-white shadow-sm text-slate-900 font-semibold' : 'text-slate-500 hover:text-slate-800']"
          >
            <QueueListIcon class="w-4 h-4" />
            <span class="hidden lg:inline">Rolada</span>
          </button>
        </div>

        <!-- Rango de fechas (md+; en móvil viven en el popover de filtros) -->
        <div class="hidden md:flex items-center gap-1 shrink-0">
          <CustomDatepicker v-model="filters.fecha_inicio" compact :showButtons="false" />
          <ArrowRightIcon class="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <CustomDatepicker v-model="filters.fecha_fin" compact :showButtons="false" />
        </div>

        <!-- Defectos (dropdown compacto, siempre visible) -->
        <div class="relative shrink-0">
          <button
            type="button"
            @click="toggleDefectos($event)"
            aria-label="Filtrar defectos"
            :class="['h-8 rounded-md border bg-white text-slate-700 text-[13px] font-medium pl-2 pr-1.5 flex items-center gap-1.5 transition-colors whitespace-nowrap', dropdownOpen ? 'border-slate-400 bg-slate-50' : 'border-slate-300 hover:bg-slate-50']"
          >
            <ExclamationTriangleIcon class="w-4 h-4 text-slate-400 shrink-0" />
            <span class="max-w-[130px] truncate">{{ defectosShort }}</span>
            <ChevronDownIcon class="w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform" :class="dropdownOpen && 'rotate-180'" />
          </button>

          <div
            v-if="dropdownOpen"
            class="absolute mt-2 w-72 bg-white border border-slate-200 rounded-lg shadow-xl z-40 overflow-hidden"
            :class="defectosAlignRight ? 'right-0' : 'left-0'"
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Defectos</span>
              <div class="flex gap-3">
                <button @click="selectAllDefectos" class="text-xs text-blue-600 hover:underline">Todos</button>
                <button @click="clearDefectos" class="text-xs text-slate-500 hover:underline">Limpiar</button>
              </div>
            </div>
            <div class="max-h-64 overflow-y-auto py-1">
              <label v-for="d in filteredDefectos" :key="d.cod" class="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 cursor-pointer text-[13px]">
                <input type="checkbox" :value="d.cod" v-model="filters.codigos_defecto" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span class="font-semibold text-slate-600 w-8 shrink-0">{{ d.cod }}</span>
                <span class="text-slate-600 truncate">{{ d.desc }}</span>
              </label>
              <p v-if="filteredDefectos.length === 0" class="px-3 py-4 text-center text-xs text-slate-400">No hay defectos para el sector seleccionado.</p>
            </div>
          </div>
        </div>

        <!-- Sector (md+) -->
        <select
          v-model="filters.sector"
          @change="onSectorChange"
          aria-label="Sector Defecto"
          v-tippy="'Sector Defecto'"
          class="hidden md:block h-8 w-28 shrink-0 border border-slate-300 rounded-md px-2 text-[13px] bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option v-for="s in sectores" :key="s" :value="s">{{ s }}</option>
        </select>

        <!-- Lotes/Roladas CSV (lg+) -->
        <input
          v-if="activeTab === 'lote'"
          v-model="filters.lotes"
          type="text"
          placeholder="Lotes"
          aria-label="Lotes (separados por coma)"
          v-tippy="'Lotes (separados por coma)'"
          class="hidden lg:block h-8 w-24 shrink-0 border border-slate-300 rounded-md px-2 text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <input
          v-else
          v-model="filters.roladas"
          type="text"
          placeholder="Roladas"
          aria-label="Roladas (separadas por coma)"
          v-tippy="'Roladas (separadas por coma)'"
          class="hidden lg:block h-8 w-24 shrink-0 border border-slate-300 rounded-md px-2 text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        <!-- Base (lg+, solo rolada) -->
        <select
          v-if="activeTab === 'rolada'"
          v-model="filters.base"
          aria-label="Base"
          v-tippy="'Filtro Base'"
          class="hidden lg:block h-8 w-28 shrink-0 border border-slate-300 rounded-md px-2 text-[13px] bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="TODAS">TODAS</option>
          <option v-for="b in basesUnicas" :key="b" :value="b">{{ b }}</option>
        </select>

        <!-- Filtros avanzados (solo móvil: fechas, sector, CSV, base) -->
        <div class="relative shrink-0 md:hidden">
          <button
            type="button"
            @click="toggleAdv"
            aria-label="Más filtros"
            v-tippy="'Más filtros'"
            :class="['relative h-8 w-8 rounded-md border bg-white flex items-center justify-center transition-colors', advOpen ? 'border-slate-400 bg-slate-50' : 'border-slate-300 hover:bg-slate-50']"
          >
            <AdjustmentsHorizontalIcon class="w-4 h-4 text-slate-500" />
            <span v-if="advCount > 0" class="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">{{ advCount }}</span>
          </button>

          <div v-if="advOpen" class="absolute left-1/2 -translate-x-1/2 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-lg shadow-xl z-40">
            <div class="flex items-center justify-between px-3 py-2 border-b border-slate-100 bg-slate-50 rounded-t-lg">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Filtros</span>
              <button v-if="advCount > 0" @click="limpiarAvanzados" class="text-xs text-slate-500 hover:underline">Limpiar</button>
            </div>
            <div class="p-3 space-y-3">
              <div class="space-y-2.5">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-slate-500">Desde</span>
                  <CustomDatepicker v-model="filters.fecha_inicio" compact :showButtons="false" />
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-semibold text-slate-500">Hasta</span>
                  <CustomDatepicker v-model="filters.fecha_fin" compact :showButtons="false" />
                </div>
                <div class="w-full h-px bg-slate-100"></div>
              </div>

              <div>
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Sector Defecto</label>
                <select v-model="filters.sector" @change="onSectorChange" class="h-8 w-full border border-slate-300 rounded-md px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option v-for="s in sectores" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>

              <div v-if="activeTab === 'lote'">
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Lotes (separados por coma)</label>
                <input v-model="filters.lotes" type="text" placeholder="Ej: 129, 130" class="h-8 w-full border border-slate-300 rounded-md px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div v-if="activeTab === 'rolada'">
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Roladas (separadas por coma)</label>
                <input v-model="filters.roladas" type="text" placeholder="Ej: 5436, 5440" class="h-8 w-full border border-slate-300 rounded-md px-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>

              <div v-if="activeTab === 'rolada'">
                <label class="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">Filtro Base</label>
                <select v-model="filters.base" class="h-8 w-full border border-slate-300 rounded-md px-2 text-[13px] bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="TODAS">TODAS</option>
                  <option v-for="b in basesUnicas" :key="b" :value="b">{{ b }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div class="flex-1 min-w-2"></div>

        <!-- Consultar -->
        <button
          @click="fetchData"
          aria-label="Consultar"
          v-tippy="'Consultar'"
          class="h-8 w-8 rounded-md border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center shrink-0 transition-colors"
        >
          <MagnifyingGlassIcon class="w-4 h-4" />
        </button>

        <!-- Exportar -->
        <button
          @click="exportarExcel"
          :disabled="!hasData"
          aria-label="Exportar a Excel"
          v-tippy="'Exportar a Excel'"
          class="h-8 w-8 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0 transition-colors"
        >
          <ArrowDownTrayIcon class="w-4 h-4" />
        </button>
      </div>
    </header>

    <!-- Overlay para cerrar dropdowns -->
    <div v-if="dropdownOpen || advOpen" class="fixed inset-0 z-30" @click="closeAllDropdowns"></div>

    <!-- Loading State -->
    <div v-if="loading" class="flex-1 flex flex-col gap-3 relative z-0">
      <div v-if="activeTab === 'lote'" class="bg-white border border-slate-200 rounded-lg shadow-sm h-10 animate-pulse"></div>
      <div class="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 min-h-[300px] animate-pulse"></div>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="bg-white border border-red-200 text-red-600 rounded-lg px-4 py-3 text-sm flex items-center gap-2 relative z-0">
      <ExclamationTriangleIcon class="w-5 h-5 shrink-0" />
      {{ error }}
    </div>

    <!-- VISTA POR LOTE -->
    <div v-else-if="activeTab === 'lote' && dataLote" class="flex-1 flex flex-col gap-3 relative z-0">
      <!-- KPIs: franja compacta -->
      <div class="bg-white border border-slate-200 rounded-lg shadow-sm flex items-center h-10 px-3 gap-3 md:gap-5 overflow-x-auto shrink-0">
        <div class="flex items-baseline gap-1.5 shrink-0">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cortes OE</span>
          <span class="text-sm font-bold text-slate-800 tabular-nums">{{ formatNumber(kpisLote.avg_cortes_oe, 4) }}</span>
        </div>
        <div class="w-px h-4 bg-slate-200 shrink-0"></div>
        <div class="flex items-baseline gap-1.5 shrink-0">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">TRCNT</span>
          <span class="text-sm font-bold text-slate-800 tabular-nums">{{ formatNumber(kpisLote.avg_trcnt) }}</span>
        </div>
        <div class="w-px h-4 bg-slate-200 shrink-0"></div>
        <div class="flex items-baseline gap-1.5 shrink-0">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Micronaire</span>
          <span class="text-sm font-bold text-slate-800 tabular-nums">{{ formatNumber(kpisLote.avg_mic) }}</span>
        </div>
        <div class="w-px h-4 bg-slate-200 shrink-0"></div>
        <div class="flex items-baseline gap-1.5 shrink-0">
          <span class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Pts Defecto</span>
          <span class="text-sm font-bold text-slate-800 tabular-nums">{{ formatNumber(kpisLote.total_puntos_defecto, 0) }}</span>
        </div>
      </div>

      <!-- Tabla Lote -->
      <div class="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
          <table class="w-fit min-w-full text-[13px] text-left tabular-nums">
            <thead class="text-[11px] text-slate-500 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap sticky top-0">
              <tr>
                <th class="pl-3 pr-2.5 py-2 font-semibold text-left w-24">Lote</th>
                <th class="px-2.5 py-2 font-semibold text-right w-[76px]">Partidas</th>
                <th class="px-2.5 py-2 font-semibold text-right w-[72px]">Roladas</th>
                <th class="px-2.5 py-2 font-semibold text-right w-16" title="Uniformidad">UI</th>
                <th class="px-2.5 py-2 font-semibold text-right w-16" title="Fibra Corta">SF</th>
                <th class="px-2.5 py-2 font-semibold text-right w-16" title="Micronaire">MIC</th>
                <th class="px-2.5 py-2 font-semibold text-right w-16" title="Basura">TRCNT</th>
                <th class="px-2.5 py-2 font-semibold text-right w-[76px]" title="Neps +140%">Neps 140</th>
                <th class="px-2.5 py-2 font-semibold text-right w-[68px]" title="Irregularidad">CVm %</th>
                <th class="px-2.5 py-2 font-semibold text-right w-[88px]" title="Tenacidad cN/tex">Tenacidad</th>
                <th class="px-2.5 py-2 font-semibold text-right w-[88px]" title="Elongación %">Elongación</th>
                <th class="px-2.5 py-2 font-semibold text-right">Cortes OE</th>
                <th class="pl-2.5 pr-3 py-2 font-semibold text-right w-[88px]">Pts Defecto</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in dataLote" :key="item.lote" class="hover:bg-slate-50/70">
                <td class="pl-3 pr-2.5 py-1.5 font-semibold text-slate-700 whitespace-nowrap">Lote {{ item.lote }}</td>
                <td class="px-2.5 py-1.5 text-right text-slate-600">{{ item.total_partidas }}</td>
                <td class="px-2.5 py-1.5 text-right text-slate-600">{{ item.total_roladas }}</td>
                <td class="px-2.5 py-1.5 text-right"><span :class="colorUi(item.avg_ui)" class="px-1.5 py-0.5 rounded">{{ formatNumber(item.avg_ui) }}</span></td>
                <td class="px-2.5 py-1.5 text-right"><span :class="colorSf(item.avg_sf)" class="px-1.5 py-0.5 rounded">{{ formatNumber(item.avg_sf) }}</span></td>
                <td class="px-2.5 py-1.5 text-right"><span :class="colorMic(item.avg_mic)" class="px-1.5 py-0.5 rounded">{{ formatNumber(item.avg_mic) }}</span></td>
                <td class="px-2.5 py-1.5 text-right"><span :class="colorTrcnt(item.avg_trcnt)" class="px-1.5 py-0.5 rounded">{{ formatNumber(item.avg_trcnt) }}</span></td>
                <td class="px-2.5 py-1.5 text-right text-slate-600">{{ formatNumber(item.avg_neps_140) }}</td>
                <td class="px-2.5 py-1.5 text-right text-slate-600">{{ formatNumber(item.avg_cvm) }}</td>
                <td class="px-2.5 py-1.5 text-right text-slate-600">{{ formatNumber(item.avg_tenacidad) }}</td>
                <td class="px-2.5 py-1.5 text-right text-slate-600">{{ formatNumber(item.avg_elongacion) }}</td>
                <td class="px-2.5 py-1.5 text-right">
                  <div v-if="item.maquinas_oe && item.maquinas_oe.length">
                    <div v-for="oe in item.maquinas_oe" :key="oe.maquina" class="flex items-center justify-end gap-1.5 text-xs whitespace-nowrap leading-5">
                      <span class="text-slate-400">{{ oe.maquina }}</span>
                      <span class="text-slate-700 font-medium">{{ formatNumber(oe.cortes_absolutos, 0) }}</span>
                      <span :class="colorCortes(oe.tasa_cortes)" class="px-1 py-0.5 rounded font-semibold text-[10px]">{{ formatNumber(oe.tasa_cortes, 4) }}</span>
                    </div>
                  </div>
                  <span v-else class="text-slate-300">-</span>
                </td>
                <td class="pl-2.5 pr-3 py-1.5 text-right font-bold text-slate-800">{{ formatNumber(item.puntos_defecto, 0) }}</td>
              </tr>
              <tr v-if="dataLote.length === 0">
                <td colspan="13" class="py-10 text-center text-slate-400">
                  <InboxIcon class="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  No hay datos para los filtros seleccionados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- VISTA POR ROLADA -->
    <div v-else-if="activeTab === 'rolada' && dataRolada" class="flex-1 flex flex-col gap-3 relative z-0">
      <div class="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 overflow-hidden flex flex-col">
        <div class="overflow-x-auto">
          <table class="w-fit min-w-full text-[13px] text-left tabular-nums">
            <thead class="text-[11px] text-slate-500 bg-slate-50 border-b border-slate-200 uppercase whitespace-nowrap sticky top-0">
              <tr>
                <th class="pl-3 pr-2.5 py-2 font-semibold text-left w-[72px]">Rolada</th>
                <th class="px-2.5 py-2 font-semibold text-left w-[64px]" title="Máquina Open End">OE (Máq)</th>
                <th class="px-2.5 py-2 font-semibold text-left w-28" title="Lotes alimentados a la OE">Lote(s) OE</th>
                <th class="px-2.5 py-2 font-semibold text-left w-32">Base</th>
                <th class="px-2.5 py-2 font-semibold text-left w-[88px]">Fecha Indigo</th>
                <th class="px-2.5 py-2 font-semibold text-center w-[140px]" title="HVI Promedio: UI / MIC / SF">UI / MIC / SF</th>
                <th v-for="maq in maquinasOE" :key="maq" class="px-2.5 py-2 font-semibold text-right w-[84px]" title="Cortes por Kg">Máq {{ maq }}</th>
                <th class="px-2.5 py-2 font-semibold text-right w-[92px]" title="Eventos en Telares">Cortes Energía</th>
                <th class="pl-2.5 pr-3 py-2 font-semibold text-right w-[92px]" title="Puntos Totales Revisión">Pts Revisión</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="item in filteredDataRolada" :key="item.rolada" class="hover:bg-slate-50/70">
                <td class="pl-3 pr-2.5 py-1.5 font-bold text-slate-700">{{ item.rolada }}</td>
                <td class="px-2.5 py-1.5 text-slate-600">{{ item.maq_oe || '-' }}</td>
                <td class="px-2.5 py-1.5 text-slate-600 max-w-32 truncate" :title="item.lotes_oe">{{ item.lotes_oe || '-' }}</td>
                <td class="px-2.5 py-1.5 text-slate-600 max-w-36 truncate" :title="item.base">{{ item.base || '-' }}</td>
                <td class="px-2.5 py-1.5 text-slate-600 whitespace-nowrap">{{ item.fecha_indigo ? formatDateStr(item.fecha_indigo) : '-' }}</td>

                <!-- HVI -->
                <td class="px-2.5 py-1.5 text-center whitespace-nowrap">
                  <div v-if="item.hvi_ui && item.hvi_mic && item.hvi_sf" class="flex gap-1 justify-center items-center font-medium">
                    <span :class="colorUi(parseFloat(item.hvi_ui))">{{ item.hvi_ui }}%</span>
                    <span class="text-slate-300">/</span>
                    <span :class="colorMic(parseFloat(item.hvi_mic))">{{ item.hvi_mic }}</span>
                    <span class="text-slate-300">/</span>
                    <span :class="colorSf(parseFloat(item.hvi_sf))">{{ item.hvi_sf }}%</span>
                  </div>
                  <span v-else class="text-slate-300">-</span>
                </td>

                <!-- Máquinas dinámicas -->
                <td v-for="maq in maquinasOE" :key="maq" class="px-2.5 py-1.5 text-right relative"
                    @mouseenter="showTooltip($event, item, maq)"
                    @mouseleave="hideTooltip">
                  <span v-if="item['cortes_maq_'+maq] !== null" :class="colorCortes(item['cortes_maq_'+maq])" class="px-1.5 py-0.5 rounded font-medium cursor-help">
                    {{ formatNumber(item['cortes_maq_'+maq], 4) }}
                  </span>
                  <span v-else class="text-slate-300">-</span>
                </td>

                <!-- Energía -->
                <td class="px-2.5 py-1.5 text-right">
                  <span v-if="item.cortes_energia > 0" class="px-1.5 py-0.5 rounded bg-red-100 text-red-700 font-bold text-xs" title="Cortes de energía registrados durante la producción OE">
                    {{ item.cortes_energia }}
                  </span>
                  <span v-else class="text-slate-300">-</span>
                </td>

                <!-- Puntos Revisión -->
                <td class="pl-2.5 pr-3 py-1.5 text-right font-bold text-slate-700">
                  {{ formatNumber(item.puntos_revision, 0) }}
                </td>
              </tr>
              <tr v-if="filteredDataRolada.length === 0">
                <td :colspan="9 + maquinasOE.length" class="py-10 text-center text-slate-400">
                  <InboxIcon class="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  No hay datos para los filtros seleccionados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="hoveredTooltip && hoveredTooltip.item['detalle_maq_'+hoveredTooltip.maq]?.length"
         ref="tooltipRef"
         :style="tooltipStyle"
         class="fixed z-[9999] w-max max-w-[calc(100vw-1rem)] bg-white text-slate-800 text-xs text-left rounded shadow-xl border border-slate-200 pointer-events-auto"
         @mouseenter="cancelHideTooltip"
         @mouseleave="hideTooltip">

      <div class="font-bold border-b border-slate-200 p-2 bg-slate-50 rounded-t text-slate-700">Desglose por Lote y Turno</div>

      <div class="max-h-60 overflow-y-auto">
        <table class="w-full text-[11px]">
          <thead class="text-slate-500 bg-slate-50 border-b border-slate-100 sticky top-0 shadow-sm z-10">
            <tr>
              <th class="px-2 py-1 font-medium text-left">Lote</th>
              <th class="px-2 py-1 font-medium text-left">Fecha (T)</th>
              <th class="px-2 py-1 font-medium text-center">Ene.</th>
              <th class="px-2 py-1 font-medium text-center">Cortes</th>
              <th class="px-2 py-1 font-medium text-right">Kg Prod</th>
              <th class="px-2 py-1 font-medium text-right">Cortes/Kg</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="(det, i) in hoveredTooltip.item['detalle_maq_'+hoveredTooltip.maq]" :key="i" class="hover:bg-slate-50">
              <td class="px-2 py-1 text-slate-600 text-left">{{ det.lote }}</td>
              <td class="px-2 py-1 text-slate-600 text-left whitespace-nowrap">{{ formatDateStr(det.fecha) }} ({{ det.turno }})</td>
              <td class="px-2 py-1 text-center font-medium">
                <span v-if="det.energia > 0" class="text-red-500 font-bold bg-red-50 px-1 rounded">{{ det.energia }}</span>
                <span v-else class="text-slate-300">-</span>
              </td>
              <td class="px-2 py-1 font-semibold text-slate-700 text-center">{{ formatNumber(det.cortes, 0) }}</td>
              <td class="px-2 py-1 text-slate-600 text-right">{{ formatNumber(det.prod, 0) }}</td>
              <td class="px-2 py-1 font-medium text-right">
                <span :class="colorCortes(det.tasa)" class="px-1 py-0.5 rounded">{{ formatNumber(det.tasa, 2) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Flecha apuntando a la celda -->
      <div v-if="tooltipArrow"
           class="absolute border-4 border-transparent pointer-events-none"
           :class="tooltipArrow.above ? 'top-full border-t-white' : 'bottom-full border-b-white'"
           :style="{ left: `${tooltipArrow.left}px`, transform: 'translateX(-50%)' }"></div>
      <div v-if="tooltipArrow"
           class="absolute border-4 border-transparent -z-10 pointer-events-none"
           :class="tooltipArrow.above ? 'top-full border-t-slate-200' : 'bottom-full border-b-slate-200'"
           :style="{ left: `${tooltipArrow.left}px`, transform: `translate(-50%, ${tooltipArrow.above ? '1px' : '-1px'})` }"></div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, computed, watch, nextTick } from 'vue';
import ExcelJS from 'exceljs';
import CustomDatepicker from '../CustomDatepicker.vue';
import {
  ClipboardDocumentListIcon,
  TableCellsIcon,
  QueueListIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  AdjustmentsHorizontalIcon,
  MagnifyingGlassIcon,
  ArrowDownTrayIcon,
  InboxIcon
} from '@heroicons/vue/24/outline';

const hoveredTooltip = ref(null);
const tooltipStyle = ref({});
const tooltipRef = ref(null);
const tooltipArrow = ref(null);
let tooltipTimeout = null;

const showTooltip = (event, item, maq) => {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
  const detalles = item['detalle_maq_' + maq];
  if (!detalles || detalles.length === 0) {
    hoveredTooltip.value = null;
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  hoveredTooltip.value = { item, maq };

  tooltipStyle.value = {
    top: `${rect.top - 8}px`,
    left: `${rect.left + rect.width / 2}px`,
    transform: 'translate(-50%, -100%)'
  };
  tooltipArrow.value = null;

  nextTick(() => {
    const el = tooltipRef.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const half = r.width / 2;
    const cx = rect.left + rect.width / 2;
    const left = Math.min(Math.max(cx, pad + half), window.innerWidth - pad - half);
    let top = rect.top - 8;
    let above = true;
    if (r.top < pad) {
      if (rect.bottom + 8 + r.height <= window.innerHeight - pad) {
        above = false;
        top = rect.bottom + 8;
      } else {
        top = pad;
      }
    }
    tooltipStyle.value = {
      top: `${top}px`,
      left: `${left}px`,
      transform: above ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
    };
    tooltipArrow.value = {
      left: Math.min(Math.max(cx - (left - half), 12), r.width - 12),
      above
    };
  });
};

const hideTooltip = () => {
  tooltipTimeout = setTimeout(() => {
    hoveredTooltip.value = null;
  }, 150);
};

const cancelHideTooltip = () => {
  if (tooltipTimeout) clearTimeout(tooltipTimeout);
};

const activeTab = ref('rolada'); // 'lote' | 'rolada'

const sectores = ref(['TODOS']);
const allDefectos = ref([]);
const dropdownOpen = ref(false);
const advOpen = ref(false);
const defectosAlignRight = ref(false);

const filters = ref({
  fecha_inicio: '',
  fecha_fin: '',
  sector: 'TODOS',
  codigos_defecto: [],
  lotes: '',
  roladas: '',
  base: 'TODAS'
});

const loading = ref(false);
const error = ref(null);

// Datos Tab Lote
const dataLote = ref(null);
const kpisLote = ref({});

// Datos Tab Rolada
const dataRolada = ref(null);
const maquinasOE = ref([]);

const filteredDefectos = computed(() => {
  if (filters.value.sector === 'TODOS') return allDefectos.value;
  return allDefectos.value.filter(d => d.sector === filters.value.sector);
});

const defectosShort = computed(() => {
  const n = filters.value.codigos_defecto.length;
  if (n === 0) return 'Sin defectos';
  if (n === 1) return filters.value.codigos_defecto[0];
  return `${n} defectos`;
});

const advCount = computed(() => {
  let c = 0;
  if (filters.value.sector !== 'TODOS') c++;
  const csv = activeTab.value === 'lote' ? filters.value.lotes : filters.value.roladas;
  if (csv && csv.trim()) c++;
  if (activeTab.value === 'rolada' && filters.value.base !== 'TODAS') c++;
  return c;
});

const basesUnicas = computed(() => {
  if (!dataRolada.value) return [];
  const bases = new Set();
  dataRolada.value.forEach(item => {
    if (item.base) {
      bases.add(item.base.substring(0, 10).toUpperCase());
    }
  });
  return Array.from(bases).sort();
});

const filteredDataRolada = computed(() => {
  if (!dataRolada.value) return [];
  if (filters.value.base === 'TODAS') return dataRolada.value;
  return dataRolada.value.filter(item => {
    return item.base && item.base.substring(0, 10).toUpperCase() === filters.value.base;
  });
});

const hasData = computed(() => {
  if (activeTab.value === 'lote') return dataLote.value && dataLote.value.length > 0;
  return filteredDataRolada.value && filteredDataRolada.value.length > 0;
});

onMounted(async () => {
  const today = new Date();
  const lastMonth = new Date();
  lastMonth.setMonth(today.getMonth() - 1);

  filters.value.fecha_fin = today.toISOString().split('T')[0];
  filters.value.fecha_inicio = lastMonth.toISOString().split('T')[0];

  await fetchCatologo();
  if (allDefectos.value.length > 0) {
    filters.value.codigos_defecto = ['205'];
  }
  await fetchData();
});

const toggleDefectos = (e) => {
  advOpen.value = false;
  dropdownOpen.value = !dropdownOpen.value;
  if (dropdownOpen.value && e?.currentTarget) {
    const rect = e.currentTarget.getBoundingClientRect();
    defectosAlignRight.value = (window.innerWidth - rect.left) < 300;
  }
};

const toggleAdv = () => {
  dropdownOpen.value = false;
  advOpen.value = !advOpen.value;
};

const closeAllDropdowns = () => {
  dropdownOpen.value = false;
  advOpen.value = false;
};

const limpiarAvanzados = () => {
  filters.value.sector = 'TODOS';
  filters.value.lotes = '';
  filters.value.roladas = '';
  filters.value.base = 'TODAS';
};

const onSectorChange = () => {
  const validForSector = filteredDefectos.value.map(d => d.cod);
  filters.value.codigos_defecto = filters.value.codigos_defecto.filter(cod => validForSector.includes(cod));
};

const selectAllDefectos = () => {
  filters.value.codigos_defecto = filteredDefectos.value.map(d => d.cod);
};

const clearDefectos = () => {
  filters.value.codigos_defecto = [];
};

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '-';
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num);
};

const formatDateStr = (dateStr) => {
  if (!dateStr) return '';
  let d;
  if (typeof dateStr === 'string' && dateStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const parts = dateStr.split(' ')[0].split('/');
    d = new Date(parts[2], parseInt(parts[1], 10) - 1, parts[0]);
  } else {
    d = new Date(dateStr);
  }

  if (isNaN(d.getTime())) return dateStr;

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const month = monthNames[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);

  return `${day}-${month}-${year}`;
};

const colorUi = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val < 78.0) return 'text-red-700 bg-red-100';
  if (val >= 79.0 && val <= 80.0) return 'text-yellow-700 bg-yellow-100';
  return '';
};
const colorSf = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val >= 12.0) return 'text-red-700 bg-red-100';
  if (val >= 10.5 && val <= 11.9) return 'text-yellow-700 bg-yellow-100';
  return '';
};
const colorMic = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val < 3.5) return 'text-red-700 bg-red-100';
  if (val >= 3.5 && val <= 3.7) return 'text-yellow-700 bg-yellow-100';
  return '';
};
const colorTrcnt = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val > 70) return 'text-red-700 bg-red-100 font-medium';
  if (val >= 51 && val <= 70) return 'text-yellow-700 bg-yellow-100 font-medium';
  return '';
};
const colorCortes = (val) => {
  if (val === null || isNaN(val)) return '';
  if (val >= 0.60) return 'text-red-700 bg-red-100';
  if (val >= 0.40 && val <= 0.59) return 'text-yellow-700 bg-yellow-100';
  return '';
};

const fetchCatologo = async () => {
  try {
    const res = await fetch('/api/produccion/trazabilidad-causa-raiz/sectores-defectos');
    const result = await res.json();
    if (result.success) {
      sectores.value = result.sectores || ['TODOS'];
      allDefectos.value = result.defectos || [];
    }
  } catch (err) {
    console.error('Error fetching catalog:', err);
  }
};

const fetchData = async () => {
  if (filters.value.codigos_defecto.length === 0) {
    error.value = "Seleccione al menos un defecto para consultar.";
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const commonParams = new URLSearchParams({
      fecha_inicio: filters.value.fecha_inicio,
      fecha_fin: filters.value.fecha_fin,
      cod_defecto: filters.value.codigos_defecto.join(',')
    });

    if (activeTab.value === 'lote') {
      if (filters.value.lotes) commonParams.append('lotes', filters.value.lotes);
      const response = await fetch(`/api/produccion/trazabilidad-causa-raiz?${commonParams.toString()}`);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const result = await response.json();
      if (result.success) {
        dataLote.value = result.data;
        kpisLote.value = result.kpis;
      } else {
        error.value = result.error || 'Error al obtener datos';
      }
    } else {
      if (filters.value.roladas) commonParams.append('roladas', filters.value.roladas);
      const response = await fetch(`/api/produccion/trazabilidad-causa-raiz/por-rolada?${commonParams.toString()}`);
      if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
      const result = await response.json();
      if (result.success) {
        dataRolada.value = result.data;
        maquinasOE.value = result.maquinasOE || [];
      } else {
        error.value = result.error || 'Error al obtener datos';
      }
    }
  } catch (err) {
    console.error(err);
    error.value = 'Ocurrió un error al cargar la trazabilidad. Por favor, intente de nuevo.';
  } finally {
    loading.value = false;
  }
};

const exportarExcel = async () => {
  const isLote = activeTab.value === 'lote';
  const data = isLote ? dataLote.value : filteredDataRolada.value;
  if (!data || data.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Trazabilidad Causa Raíz');

  if (isLote) {
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

    data.forEach((row) => {
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
    });
  } else {
    const cols = [
      { header: 'Rolada', key: 'rolada', width: 12 },
      { header: 'OE (Máq)', key: 'maq_oe', width: 12 },
      { header: 'Lote(s) OE', key: 'lotes_oe', width: 15 },
      { header: 'Base', key: 'base', width: 20 },
      { header: 'Fecha Indigo', key: 'fecha_indigo', width: 15 },
      { header: 'HVI Promedio (UI/MIC/SF)', key: 'hvi_str', width: 25 }
    ];

    maquinasOE.value.forEach(maq => {
      cols.push({ header: `Cortes/Kg (Máq ${maq})`, key: `cortes_maq_${maq}`, width: 18 });
    });

    cols.push({ header: 'Cortes Energía', key: 'cortes_energia', width: 15 });
    cols.push({ header: 'Pts Totales Rev.', key: 'puntos_revision', width: 18 });
    worksheet.columns = cols;

    data.forEach(row => {
      const rowData = {
        rolada: row.rolada,
        maq_oe: row.maq_oe,
        lotes_oe: row.lotes_oe,
        base: row.base,
        fecha_indigo: formatDateStr(row.fecha_indigo),
        hvi_str: (row.hvi_ui && row.hvi_mic && row.hvi_sf) ? `${row.hvi_ui}% / ${row.hvi_mic} / ${row.hvi_sf}%` : '-',
        cortes_energia: row.cortes_energia,
        puntos_revision: row.puntos_revision
      };

      maquinasOE.value.forEach(maq => {
        rowData[`cortes_maq_${maq}`] = row[`cortes_maq_${maq}`] !== null ? row[`cortes_maq_${maq}`] : '-';
      });

      worksheet.addRow(rowData);
    });
  }

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1F2937' }
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const viewType = isLote ? 'Lotes' : 'Roladas';
  a.download = `Trazabilidad_Causa_Raiz_${viewType}_${filters.value.fecha_inicio}_a_${filters.value.fecha_fin}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
};

watch(activeTab, (newTab) => {
  if (newTab === 'lote' && !dataLote.value) {
    fetchData();
  } else if (newTab === 'rolada' && !dataRolada.value) {
    fetchData();
  }
});
</script>
