<template>
  <div class="h-full bg-slate-50 p-2 md:p-3 flex flex-col gap-3 font-sans overflow-hidden">
    <!-- TOP BAR: Encabezado y Filtros Principales -->
    <div class="bg-white rounded-2xl border border-slate-100 shadow-sm p-2 md:p-2.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-extrabold text-slate-800 leading-tight">Análisis de Patrones de Defectos (IA)</h2>
          <p class="text-xs text-slate-400 mt-0.5">Diagnóstico analítico y directivas operativas para el sector de Tejeduría Plana</p>
        </div>
      </div>

      <!-- Filtros por Fecha -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
          <CustomDatepicker v-model="fechaInicio" :show-buttons="false" placeholder="Fecha de Inicio" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha Fin</label>
          <CustomDatepicker v-model="fechaFin" :show-buttons="false" placeholder="Fecha Fin" />
        </div>

        <div class="flex items-center h-full">
          <button
            @click="ejecutarAnalisis"
            :disabled="(loadingData || loadingIA) || !fechaInicio || !fechaFin"
            class="h-9 px-5 flex items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg select-none"
          >
            <svg v-if="loadingData || loadingIA" class="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <span>{{ loadingData ? 'Cargando datos...' : (loadingIA ? 'Analizando...' : 'Analizar con IA') }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Mensaje de error -->
    <div v-if="error" class="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4 text-sm flex items-start gap-3 shadow-sm transition-all duration-300">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div>
        <div class="font-bold">Error en la consulta de calidad</div>
        <div class="mt-0.5 text-red-700/90">{{ error }}</div>
      </div>
    </div>

    <!-- MAIN BODY: Diseño en Rejilla de Dos Columnas -->
    <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3">
      
      <!-- COLUMNA IZQUIERDA: Resumen de Defectos + Informe IA (lg:col-span-4) -->
      <div class="lg:col-span-4 flex flex-col gap-3 min-h-0 overflow-y-auto pr-1">
        
        <!-- CARD Superior Izquierda: Resumen de Defectos del Periodo -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[420px] shrink-0">
          
          <!-- Encabezado y Selector de Sector -->
          <div class="flex items-center justify-between bg-blue-50 text-slate-800 px-3 py-1.5 text-xs font-semibold border-b border-blue-200 gap-2 shrink-0">
            <h2 class="text-xs text-slate-800 whitespace-nowrap leading-none flex items-center gap-1 font-sans">
              <span class="font-bold">Pts/100m²</span>
              <span class="font-normal text-slate-500"> · DÍA — {{ friendlyPeriodLabel }}</span>
              <span class="font-normal text-slate-400"> · {{ formatInteger(totalMetros) }} m</span>
            </h2>

            <!-- Selector de Sector Dropdown -->
            <div class="relative inline-block text-left shrink-0">
              <select
                v-model="selectedSector"
                class="block w-44 px-2 py-0.5 text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer hover:bg-slate-50 transition-all duration-150"
              >
                <option value="Todos">▼ Todos ({{ sectorCounts.Todos }})</option>
                <option value="TEJE">▼ TEJE ({{ sectorCounts.TEJE }})</option>
                <option value="HILA">▼ HILA ({{ sectorCounts.HILA }})</option>
                <option value="ACAB">▼ ACAB ({{ sectorCounts.ACAB }})</option>
                <option value="INDI">▼ INDI ({{ sectorCounts.INDI }})</option>
                <option value="OTRO">▼ Otros ({{ sectorCounts.OTRO }})</option>
              </select>
            </div>
          </div>

          <!-- Tabla de Resumen de Defectos -->
          <div class="flex-1 overflow-auto p-3">
            <table class="text-xs border-collapse w-full border border-slate-200 table-fixed">
              <thead class="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th class="w-[39px] px-2 py-1.5 border border-slate-200 font-semibold text-slate-500 text-center">COD</th>
                  <th class="w-[45px] px-2 py-1.5 border border-slate-200 font-semibold text-slate-500 text-center">SEC</th>
                  <th class="px-2 py-1.5 border border-slate-200 font-semibold text-slate-700 text-left">DEFECTO</th>
                  <th class="w-[82px] px-2 py-1.5 border border-slate-200 font-semibold text-slate-700 text-right">PTS/100M²</th>
                  <th class="w-[68px] px-2 py-1.5 border border-slate-200 font-semibold text-slate-700 text-right">TOTAL</th>
                  <th class="w-[61px] px-2 py-1.5 border border-slate-200 font-semibold text-slate-700 text-right">%</th>
                </tr>
              </thead>
              <tbody class="bg-white">
                <tr
                  v-for="(r, i) in processedDefects.rows"
                  :key="r.cod_def"
                  :class="[
                    r.cod_def === '—' 
                      ? 'bg-amber-50 hover:bg-amber-100 transition-colors italic' 
                      : (i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'),
                    'hover:bg-blue-50/50 transition-colors'
                  ]"
                >
                  <td 
                    class="px-2 py-1 border border-slate-200 text-center font-mono text-[10px]"
                    :class="r.cod_def === '—' ? 'text-amber-400' : 'text-slate-400'"
                  >
                    {{ r.cod_def }}
                  </td>
                  <td 
                    class="px-2 py-1 border border-slate-200 text-center text-[10px] font-semibold whitespace-nowrap"
                    :class="[
                      r.cod_def === '—' ? 'text-amber-400' : '',
                      r.sec === 'INDI' ? 'text-blue-600' : '',
                      r.sec === 'HILA' ? 'text-purple-600' : '',
                      r.sec === 'TEJE' ? 'text-green-700' : '',
                      r.sec === 'ACAB' ? 'text-orange-600' : '',
                      r.sec === 'OTRO' ? 'text-slate-400' : ''
                    ]"
                  >
                    {{ r.sec }}
                  </td>
                  <td 
                    class="px-2 py-1 border border-slate-200 truncate font-sans text-[11px]"
                    :class="r.cod_def === '—' ? 'text-amber-700 font-normal' : 'text-slate-800 font-normal'"
                    :title="r.desc_defeito"
                  >
                    {{ r.desc_defeito }}
                  </td>
                  <td 
                    class="px-2 py-1 border border-slate-200 text-right tabular-nums font-mono text-[11px]"
                    :class="r.cod_def === '—' ? 'text-amber-700 font-normal' : 'text-slate-800 font-normal'"
                  >
                    {{ formatDecimal(r.pts_100m2, 2) }}
                  </td>
                  <td 
                    class="px-2 py-1 border border-slate-200 text-right tabular-nums font-mono text-[11px]"
                    :class="r.cod_def === '—' ? 'text-amber-700 font-normal' : 'text-slate-800 font-normal'"
                  >
                    {{ formatInteger(r.total_puntos) }}
                  </td>
                  <td 
                    class="px-2 py-1 border border-slate-200 text-right tabular-nums font-mono text-[11px]"
                    :class="r.cod_def === '—' ? 'text-amber-600 font-normal' : 'text-slate-600 font-normal'"
                  >
                    {{ formatDecimal(r.porcentaje, 2) }}%
                  </td>
                </tr>
                <tr v-if="!defects.length">
                  <td colspan="6" class="px-3 py-16 text-center text-slate-400 font-sans">
                    {{ firstRun ? 'Selecciona fechas y presiona Analizar con IA.' : 'No se encontraron defectos en este período.' }}
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="defects.length">
                <tr class="bg-slate-100 font-bold">
                  <td class="px-2 py-1 border border-slate-300"></td>
                  <td class="px-2 py-1 border border-slate-300"></td>
                  <td class="px-2 py-1 border border-slate-300 text-slate-800 text-[11px]">Total</td>
                  <td class="px-2 py-1 border border-slate-300 text-right tabular-nums text-slate-800 font-mono text-[11px]">{{ formatDecimal(processedDefects.totalPts100, 2) }}</td>
                  <td class="px-2 py-1 border border-slate-300 text-right tabular-nums text-slate-800 font-mono text-[11px]">{{ formatInteger(processedDefects.totalPuntos) }}</td>
                  <td class="px-2 py-1 border border-slate-300 text-right tabular-nums text-slate-800 font-mono text-[11px]">100.00%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- CARD Inferior Izquierda: Informe de Diagnóstico Gemini (Glassmorphism) -->
        <div class="flex-1 bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-md p-5 flex flex-col min-h-[320px] relative overflow-hidden">
          <!-- Decoración AI glow -->
          <div class="absolute -right-16 -top-16 w-32 h-32 rounded-full bg-indigo-500/10 blur-xl pointer-events-none"></div>
          <div class="absolute -left-16 -bottom-16 w-32 h-32 rounded-full bg-purple-500/10 blur-xl pointer-events-none"></div>

          <!-- Cabecera de la sección IA -->
          <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 gap-4 mb-4 shrink-0">
            <div class="flex items-center gap-2">
              <span class="text-lg">🤖</span>
              <h3 class="text-sm font-extrabold text-indigo-800 uppercase tracking-wide">Motor de Diagnóstico Gemini</h3>
            </div>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold text-indigo-700 bg-indigo-100/50 border border-indigo-200/30 uppercase tracking-wide">
              Análisis On-Demand
            </span>
          </div>

          <!-- Contenido AI -->
          <div class="flex-1 overflow-auto min-h-0 flex flex-col">
            <!-- Cargando -->
            <div v-if="loadingIA" class="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
              <div class="relative w-16 h-16 mb-4">
                <div class="absolute inset-0 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <div class="absolute inset-2 rounded-full bg-indigo-50/50 flex items-center justify-center text-xl animate-pulse">💡</div>
              </div>
              <h4 class="text-sm font-bold text-slate-700 animate-pulse">Generando diagnóstico de tejeduría...</h4>
              <p class="text-xs text-slate-400 mt-2 max-w-64 leading-relaxed">
                Gemini está analizando los códigos de defectos, las eficiencias de los telares y construyendo las directivas operativas...
              </p>
            </div>

            <!-- Datos analizados -->
            <div v-else-if="analisis" class="flex flex-col gap-3 pb-2">
              <div v-if="tokenInfo" class="flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg text-[10px]">
                <div class="flex items-center gap-1.5">
                  <span class="font-bold text-slate-400 uppercase tracking-wider">Fuente:</span>
                  <span class="px-2 py-0.5 rounded-full font-bold" :class="fuente === 'cache' ? 'bg-emerald-100 text-emerald-700' : 'bg-purple-100 text-purple-700'">
                    {{ fuente === 'cache' ? 'Caché (Instantáneo)' : 'Gemini AI' }}
                  </span>
                </div>
                <div class="h-3 w-px bg-slate-200"></div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-400 uppercase tracking-wider">Tokens:</span>
                  <span class="font-bold text-slate-700">{{ tokenInfo.tokensTotal.toLocaleString('es-AR') }}</span>
                </div>
                <div class="h-3 w-px bg-slate-200"></div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-400 uppercase tracking-wider">Costo:</span>
                  <span class="font-bold" :class="tokenInfo.costoUSD < 0.001 ? 'text-emerald-600' : 'text-amber-600'">
                    U$S {{ tokenInfo.costoUSD < 0.0001 ? '< 0.0001' : tokenInfo.costoUSD.toFixed(4) }}
                  </span>
                </div>
              </div>
              <div class="markdown-container text-xs text-slate-700 leading-relaxed font-sans" v-html="mdToHtml(analisis)"></div>
            </div>

            <!-- Estado inicial vacío -->
            <div v-else class="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 select-none">
              <span class="text-4xl mb-3 opacity-60">📊</span>
              <h4 class="text-sm font-semibold text-slate-600">Sin análisis generado</h4>
              <p class="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Selecciona el rango de fechas en la barra superior y presiona el botón **'Analizar con IA'** para generar diagnósticos y directivas de tejeduría.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- COLUMNA DERECHA: Detalle de las Partidas (lg:col-span-8) -->
      <div class="lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm p-2.5 flex flex-col min-h-0">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 gap-4 mb-3 flex-wrap shrink-0">
          <div class="flex items-center gap-2">
            <h3 class="text-sm font-extrabold text-slate-700 uppercase tracking-wide text-xs">Detalle de Partidas Críticas</h3>
            <span v-if="dataset.length" class="text-[10px] text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded-full font-bold">
              {{ filteredDataset.length }} partidas
            </span>
          </div>

          <div class="flex items-center gap-4 flex-wrap justify-end">
            <!-- Paginación -->
            <div v-if="filteredDataset.length" class="flex items-center gap-3 font-sans">
              <div class="text-[11px] text-slate-500 hidden sm:block">
                {{ Math.min(filteredDataset.length, (page - 1) * pageSize + 1) }}-{{ Math.min(filteredDataset.length, page * pageSize) }} de {{ filteredDataset.length }}
              </div>
              <div class="flex items-center gap-2">
                <button
                  @click="page = Math.max(1, page - 1)"
                  :disabled="page <= 1"
                  class="px-2.5 py-1 border border-slate-200 rounded-lg text-[10px] hover:bg-slate-50 disabled:opacity-40 bg-white"
                >
                  Ant
                </button>
                <span class="text-[11px] text-slate-650 font-bold font-mono">{{ page }} / {{ totalPages }}</span>
                <button
                  @click="page = Math.min(totalPages, page + 1)"
                  :disabled="page >= totalPages"
                  class="px-2.5 py-1 border border-slate-200 rounded-lg text-[10px] hover:bg-slate-50 disabled:opacity-40 bg-white"
                >
                  Sig
                </button>
              </div>
            </div>

            <!-- Divisor -->
            <div class="h-6 w-px bg-slate-200 hidden md:block" v-if="filteredDataset.length"></div>

            <!-- Búsqueda local de telar y estilo -->
            <div class="flex items-center gap-2">
              <input
                v-model="filtroMaquina"
                type="text"
                placeholder="Telar..."
                class="w-20 px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <input
                v-model="filtroArtigo"
                type="text"
                placeholder="Artículo..."
                class="w-28 px-2 py-1 text-[11px] border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>
        </div>

        <!-- Tabla de Partidas -->
        <div class="flex-1 min-h-0 overflow-auto rounded-xl border border-slate-100">
          <table class="min-w-full divide-y divide-slate-100 text-xs table-fixed">
            <thead class="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th class="w-16 px-2 py-2 text-center font-bold text-slate-500">Partida</th>
                <th class="w-20 px-2 py-2 text-left font-bold text-slate-500">Artículo</th>
                <th class="w-14 px-2 py-2 text-center font-bold text-slate-500">Grupo</th>
                <th class="w-20 px-2 py-2 text-center font-bold text-slate-500">Trama</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500">Telar</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500">RPM</th>
                <th class="w-14 px-2 py-2 text-center font-bold text-slate-500">Ancho</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500">Cav.</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500">Turno</th>
                <th class="w-12 px-2 py-2 text-right font-bold text-slate-500" title="Roturas Índigo cada 1000m (RU 10³)">RU10³</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500">Efic.%</th>
                <th class="w-12 px-2 py-2 text-right font-bold text-slate-500">RT105</th>
                <th class="w-12 px-2 py-2 text-right font-bold text-slate-500">RU105</th>
                <th class="w-12 px-2 py-2 text-right font-bold text-slate-500">Par.T</th>
                <th class="w-12 px-2 py-2 text-right font-bold text-slate-500">Par.U</th>
                <th class="w-10 px-2 py-2 text-right font-bold text-slate-500" title="Total Defectos Trama (Revisadora)">Def.T</th>
                <th class="w-10 px-2 py-2 text-right font-bold text-slate-500" title="Total Defectos Urdimbre (Revisadora)">Def.U</th>
                <th class="w-14 px-2 py-2 text-right font-bold text-slate-500">Metros</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500" title="Pts Parada Tear">Pts 333</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500" title="Pts Trama Mole">Pts 340</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500" title="Pts Trama Curta">Pts 382</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500" title="Pts Trama Dobrada">Pts 387</th>
                <th class="w-12 px-2 py-2 text-center font-bold text-slate-500" title="Pts Trama Dupla">Pts 386</th>
                <th class="w-14 px-2 py-2 text-right font-bold text-slate-500">Pts/100m²</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white font-mono">
              <tr v-for="r in pagedDataset" :key="r.partida" class="hover:bg-slate-50 transition-colors">
                <td class="px-2 py-2.5 font-bold text-slate-800 text-center">{{ formatPartida(r.partida) }}</td>
                <td class="px-2 py-2.5 text-slate-700 text-left font-medium font-sans" :title="r.articulo">
                  <div class="font-bold font-mono text-[11px] leading-tight">{{ formatArtigo(r.articulo) }}</div>
                </td>
                <td class="px-2 py-2.5 text-slate-700 text-center font-mono text-[11px] font-bold">{{ r.grupo_tear || '—' }}</td>
                <td class="px-2 py-2.5 text-slate-700 text-center font-mono text-[10px] whitespace-nowrap">{{ r.caracteristicas_trama?.tipo_trama_filtro || r.caracteristicas_trama?.titulo || '—' }}</td>
                <td class="px-2 py-2.5 text-slate-700 font-bold text-center">{{ formatMaquina(r.indicadores_tejeduria?.telar_asignado) }}</td>
                <td class="px-2 py-2.5 text-center">{{ formatDecimal(r.indicadores_tejeduria?.rpm_real, 1) || '—' }}</td>
                <td class="px-2 py-2.5 text-center">{{ formatDecimal(r.indicadores_tejeduria?.ancho_tela_padron, 1) || '—' }}</td>
                <td class="px-2 py-2.5 text-center">{{ formatInteger(r.indicadores_tejeduria?.total_cavalos) }}</td>
                <td class="px-2 py-2.5 text-center">{{ r.indicadores_indigo?.turno_indigo || '—' }}</td>
                <td class="px-2 py-2.5 text-right font-mono text-purple-600 font-bold" :title="'Roturas Índigo: ' + (r.indicadores_indigo?.r103_roturas_absolutas || 0) + ' / Metros: ' + (r.indicadores_indigo?.metros_indigo || 0)">{{ formatDecimal(r.indicadores_indigo?.ru103, 1) }}</td>
                <td class="px-2 py-2.5 text-center" :class="eficClass(r.indicadores_tejeduria?.eficiencia_porcentaje)">{{ formatDecimal(r.indicadores_tejeduria?.eficiencia_porcentaje, 1) }}%</td>
                <td class="px-2 py-2.5 text-right font-mono" :class="r.indicadores_tejeduria?.rt105_paradas_trama > 5 ? 'text-amber-600 font-bold' : 'text-slate-500'">{{ formatDecimal(r.indicadores_tejeduria?.rt105_paradas_trama, 1) }}</td>
                <td class="px-2 py-2.5 text-right font-mono" :class="r.indicadores_tejeduria?.ru105_paradas_urdimbre > 5 ? 'text-amber-600 font-bold' : 'text-slate-500'">{{ formatDecimal(r.indicadores_tejeduria?.ru105_paradas_urdimbre, 1) }}</td>
                <td class="px-2 py-2.5 text-right font-mono text-slate-600">{{ r.indicadores_tejeduria?.suma_paradas_trama || 0 }}</td>
                <td class="px-2 py-2.5 text-right font-mono text-slate-600">{{ r.indicadores_tejeduria?.suma_paradas_urdimbre || 0 }}</td>
                <td class="px-2 py-2.5 text-right font-mono text-blue-600 font-bold" :title="r.conteo_defectos_revisadora?.total_defectos_trama_4ptos + ' fallas graves (4 pts)'">{{ r.conteo_defectos_revisadora?.total_defectos_trama || 0 }}</td>
                <td class="px-2 py-2.5 text-right font-mono text-blue-600 font-bold" :title="r.conteo_defectos_revisadora?.total_defectos_urdimbre_4ptos + ' fallas graves (4 pts)'">{{ r.conteo_defectos_revisadora?.total_defectos_urdimbre || 0 }}</td>
                <td class="px-2 py-2.5 text-right text-slate-600">{{ formatInteger(r.indicadores_tejeduria?.metros_primeira) }}m</td>
                <td class="px-2 py-2.5 text-center font-mono" :class="r.conteo_defectos_revisadora?.pts_100m2_333 > 0 ? 'text-red-600 font-bold' : 'text-slate-300'" :title="r.conteo_defectos_revisadora?.detalle_frecuencia_codigo?.['333_parada_tear'] + ' eventos'">{{ formatDecimal(r.conteo_defectos_revisadora?.pts_100m2_333, 1) || '-' }}</td>
                <td class="px-2 py-2.5 text-center font-mono" :class="r.conteo_defectos_revisadora?.pts_100m2_340 > 0 ? 'text-amber-600 font-bold' : 'text-slate-300'" :title="r.conteo_defectos_revisadora?.detalle_frecuencia_codigo?.['340_trama_mole'] + ' eventos'">{{ formatDecimal(r.conteo_defectos_revisadora?.pts_100m2_340, 1) || '-' }}</td>
                <td class="px-2 py-2.5 text-center font-mono" :class="r.conteo_defectos_revisadora?.pts_100m2_382 > 0 ? 'text-orange-600 font-bold' : 'text-slate-300'" :title="r.conteo_defectos_revisadora?.detalle_frecuencia_codigo?.['382_trama_curta'] + ' eventos'">{{ formatDecimal(r.conteo_defectos_revisadora?.pts_100m2_382, 1) || '-' }}</td>
                <td class="px-2 py-2.5 text-center font-mono" :class="r.conteo_defectos_revisadora?.pts_100m2_387 > 0 ? 'text-amber-600 font-bold' : 'text-slate-300'" :title="r.conteo_defectos_revisadora?.detalle_frecuencia_codigo?.['387_trama_dobrada'] + ' eventos'">{{ formatDecimal(r.conteo_defectos_revisadora?.pts_100m2_387, 1) || '-' }}</td>
                <td class="px-2 py-2.5 text-center font-mono" :class="r.conteo_defectos_revisadora?.pts_100m2_386 > 0 ? 'text-orange-600 font-bold' : 'text-slate-300'" :title="r.conteo_defectos_revisadora?.detalle_frecuencia_codigo?.['386_trama_dupla'] + ' eventos'">{{ formatDecimal(r.conteo_defectos_revisadora?.pts_100m2_386, 1) || '-' }}</td>
                <td class="px-2 py-2.5 text-right font-black" :class="ptsClass(r.conteo_defectos_revisadora?.pts_por_100m2)">
                  {{ formatDecimal(r.conteo_defectos_revisadora?.pts_por_100m2, 2) }}
                </td>
              </tr>
              <tr v-if="!filteredDataset.length">
                <td colspan="24" class="px-3 py-16 text-center text-slate-400 font-sans">
                  {{ firstRun ? 'Selecciona fechas y presiona Analizar con IA.' : 'No se encontraron partidas con los filtros especificados.' }}
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
import { ref, computed, watch } from 'vue'
import Swal from 'sweetalert2'
import CustomDatepicker from '../CustomDatepicker.vue'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

// Fechas por defecto: últimas 4 semanas
function getPastDateString(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const fechaInicio = ref(getPastDateString(30))
const fechaFin = ref(getPastDateString(1))

const loadingData = ref(false)
const loadingIA = ref(false)
const firstRun = ref(true)
const dataset = ref([])
const defects = ref([])
const totalMetros = ref(0)
const totalAreaM2 = ref(0)
const analisis = ref('')
const error = ref(null)
const tokenInfo = ref(null)
const fuente = ref('')
const modelo = ref('')

// Filtros locales
const filtroMaquina = ref('')
const filtroArtigo = ref('')
const selectedSector = ref('Todos')

// Paginación
const page = ref(1)
const pageSize = ref(20)

// Helper para clasificar sector según código
function getSectorForCode(code) {
  const first = String(code || '').trim()[0]
  if (first === '1') return 'INDI'
  if (first === '2') return 'HILA'
  if (first === '3') return 'TEJE'
  if (first === '4') return 'ACAB'
  return 'OTRO'
}

// Cuentas dinámicas de códigos por sector para el filtro dropdown
const sectorCounts = computed(() => {
  const list = defects.value || []
  const counts = { Todos: list.length, TEJE: 0, HILA: 0, ACAB: 0, INDI: 0, OTRO: 0 }
  list.forEach(r => {
    const sec = getSectorForCode(r.cod_def)
    if (counts[sec] !== undefined) counts[sec]++
  })
  return counts
})

// Agrupamiento y filtrado de defectos
const getDefectCount = (row, code) => {
  if (!row?.conteo_defectos_revisadora?.detalle_frecuencia_codigo) return 0;
  const codes = row.conteo_defectos_revisadora.detalle_frecuencia_codigo;
  return codes[code] || 0;
};

const processedDefects = computed(() => {
  let list = (defects.value || []).map(r => ({
    ...r,
    sec: getSectorForCode(r.cod_def)
  }))

  if (selectedSector.value !== 'Todos') {
    list = list.filter(r => r.sec === selectedSector.value)
  }

  // Recalcular el total de puntos para ajustar los porcentajes dinámicamente
  const filteredTotalPuntos = list.reduce((acc, r) => acc + Number(r.total_puntos || 0), 0)

  list = list.map(r => {
    const pct = filteredTotalPuntos > 0 ? (Number(r.total_puntos || 0) / filteredTotalPuntos) * 100 : 0
    return {
      ...r,
      porcentaje: Math.round(pct * 100) / 100
    }
  })

  const limit = 7
  if (list.length <= limit) {
    return {
      rows: list,
      totalPuntos: filteredTotalPuntos,
      totalPts100: totalAreaM2.value > 0 ? Math.round(((filteredTotalPuntos * 100) / totalAreaM2.value) * 100) / 100 : 0
    }
  }

  const topRows = list.slice(0, limit)
  const otherRows = list.slice(limit)

  const otherPuntos = otherRows.reduce((acc, r) => acc + Number(r.total_puntos || 0), 0)
  const otherPts100 = totalAreaM2.value > 0 ? (otherPuntos * 100) / totalAreaM2.value : 0
  const otherPct = filteredTotalPuntos > 0 ? (otherPuntos * 100) / filteredTotalPuntos : 0

  const aggregatedRows = [
    ...topRows,
    {
      cod_def: '—',
      sec: '—',
      desc_defeito: `Otros (${otherRows.length})`,
      pts_100m2: Math.round(otherPts100 * 100) / 100,
      total_puntos: otherPuntos,
      porcentaje: Math.round(otherPct * 100) / 100
    }
  ]

  return {
    rows: aggregatedRows,
    totalPuntos: filteredTotalPuntos,
    totalPts100: totalAreaM2.value > 0 ? Math.round(((filteredTotalPuntos * 100) / totalAreaM2.value) * 100) / 100 : 0
  }
})

// Rótulo del periodo seleccionado amigable
const friendlyPeriodLabel = computed(() => {
  if (!fechaInicio.value) return ''
  if (fechaInicio.value === fechaFin.value) {
    return formatFriendlyDate(fechaInicio.value)
  }
  return `${formatFriendlyDate(fechaInicio.value)} al ${formatFriendlyDate(fechaFin.value)}`
})

function formatFriendlyDate(dateStr) {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length !== 3) return dateStr
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2])
  const weekday = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'][dateObj.getDay()]
  const dd = String(dateObj.getDate()).padStart(2, '0')
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0')
  const yyyy = dateObj.getFullYear()
  return `${weekday} ${dd}/${mm}/${yyyy}`
}

// Filtrado de partidas en el cliente
const filteredDataset = computed(() => {
  let list = dataset.value || []

  const termMaquina = String(filtroMaquina.value).trim().toLowerCase()
  if (termMaquina) {
    list = list.filter(r => String(r.indicadores_tejeduria?.telar_asignado || '').toLowerCase().includes(termMaquina))
  }

  const termArtigo = String(filtroArtigo.value).trim().toLowerCase()
  if (termArtigo) {
    list = list.filter(r => String(r.articulo || '').toLowerCase().includes(termArtigo))
  }

  return list
})

const totalPages = computed(() => {
  return Math.max(1, Math.ceil(filteredDataset.value.length / pageSize.value))
})

const pagedDataset = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return filteredDataset.value.slice(start, start + pageSize.value)
})

watch([filteredDataset, pageSize], () => {
  page.value = 1
})

// Ejecución del endpoint
async function ejecutarAnalisis() {
  if (!fechaInicio.value || !fechaFin.value) return

  loadingData.value = true
  error.value = null
  firstRun.value = false
  analisis.value = ''
  tokenInfo.value = null
  fuente.value = ''
  modelo.value = ''

  try {
    // 1. Obtener Datos
    const params = new URLSearchParams({
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value
    })
    
    const resDatos = await fetch(`${API_BASE}/api/calidad/datos-patrones-teje?${params}`)
    const dataDatos = await resDatos.json()

    if (!resDatos.ok) throw new Error(dataDatos.error || 'Error obteniendo datos de calidad')
    
    if (dataDatos.success) {
      dataset.value = Array.isArray(dataDatos.dataset) ? dataDatos.dataset : []
      defects.value = Array.isArray(dataDatos.defects) ? dataDatos.defects : []
      totalMetros.value = Number(dataDatos.total_metros || 0)
      totalAreaM2.value = Number(dataDatos.total_area_m2 || 0)
    } else {
      throw new Error('Formato de datos inválido')
    }
    
    loadingData.value = false;

    // Si no hay datos, cortamos acá
    if (dataset.value.length === 0) {
      analisis.value = 'No se encontraron registros de tejeduría en el rango de fechas seleccionado.';
      return;
    }

    // 2. Ejecutar IA (Apagado temporalmente)
    loadingIA.value = false;
    analisis.value = '**Análisis de IA en pausa** mientras se ajustan las visualizaciones de tabla.';
    /*
    const resIA = await fetch(`${API_BASE}/api/calidad/ia-patrones-teje`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset: dataset.value,
        defects: defects.value,
        totalMetros: totalMetros.value,
        totalAreaM2: totalAreaM2.value,
        fechaInicio: fechaInicio.value,
        fechaFin: fechaFin.value
      })
    });
    
    const dataIA = await resIA.json();
    
    if (!resIA.ok) throw new Error(dataIA.error || 'Error en análisis de IA');
    
    analisis.value = dataIA.narrativa || dataIA.analisis || '';
    tokenInfo.value = dataIA.tokenInfo || null;
    fuente.value = dataIA.fuente || '';
    modelo.value = dataIA.modelo || '';
    */

  } catch (err) {
    console.error('[analisis-patrones-teje] failed:', err)
    error.value = err.message
    Swal.fire({
      icon: 'error',
      title: 'Error de análisis',
      text: err.message || 'Ocurrió un error en el proceso.'
    })
  } finally {
    loadingData.value = false
    loadingIA.value = false
  }
}

// Clases condicionales de estilo
function sectorClass(sec) {
  if (sec === 'TEJE') return 'bg-rose-50 text-rose-700 border border-rose-100'
  if (sec === 'HILA') return 'bg-amber-50 text-amber-700 border border-amber-100'
  if (sec === 'ACAB') return 'bg-cyan-50 text-cyan-700 border border-cyan-100'
  if (sec === 'INDI') return 'bg-blue-50 text-blue-700 border border-blue-100'
  return 'bg-slate-50 text-slate-600 border border-slate-100'
}

function eficClass(eficiencia) {
  if (eficiencia == null || eficiencia === '') return 'text-slate-400'
  const val = Number(eficiencia)
  if (val < 75) return 'text-rose-600 font-bold'
  if (val < 85) return 'text-amber-600 font-semibold'
  return 'text-emerald-700'
}

function ptsClass(pts) {
  if (pts == null || pts === '') return 'text-slate-400'
  const val = Number(pts)
  if (val > 10.0) return 'text-rose-750 bg-rose-50 border border-rose-100 px-1 rounded'
  if (val > 7.0) return 'text-amber-750 bg-amber-50 border border-amber-100 px-1 rounded'
  return 'text-emerald-700'
}

function defectoClass(codDef) {
  if (!codDef) return ''
  if (codDef === '333') return 'bg-rose-50 text-rose-700 border border-rose-200/30'
  if (['340', '382', '387'].includes(codDef)) return 'bg-amber-50 text-amber-700 border border-amber-200/30'
  return 'bg-slate-50 text-slate-600 border border-slate-200/30'
}

// Formateadores
function formatPartida(partida) {
  if (partida == null || partida === '') return '—'
  const clean = String(partida).replace(/^0+/, '')
  if (!clean) return '—'
  const padded = clean.padStart(7, '0')
  const first = padded.slice(0, -6)
  const middle = padded.slice(-6, -2)
  const last = padded.slice(-2)
  return `${first}-${middle}.${last}`
}

function formatArtigo(artigo) {
  if (!artigo) return '—'
  const str = String(artigo).trim()
  if (str.length > 10) {
    return str.slice(0, 10) + ' ' + str.slice(10)
  }
  return str
}

function formatMaquina(maquina) {
  if (maquina == null || maquina === '') return '—'
  const lastThree = String(maquina).trim().slice(-3)
  return lastThree.replace(/^0+/, '') || '0'
}

function formatDecimal(val, dec = 2) {
  if (val == null || val === '') return '—'
  const n = Number(val)
  return Number.isFinite(n) ? n.toFixed(dec) : '—'
}

function formatInteger(val) {
  if (val == null || val === '') return '—'
  const n = Math.round(Number(val))
  return Number.isFinite(n) ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '—'
}

// Renderizador Markdown a HTML ultraliviano y seguro
function mdToHtml(md) {
  if (!md) return ''
  return md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/### (.*)/g, '<h4 class="text-sm font-bold text-slate-800 mt-4 mb-1.5">$1</h4>')
    .replace(/## (.*)/g, '<h3 class="text-base font-bold text-indigo-700 mt-5 mb-2">$1</h3>')
    .replace(/# (.*)/g, '<h2 class="text-lg font-bold text-indigo-800 mt-6 mb-3">$1</h2>')
    .replace(/^- (.*)/g, '<li class="ml-4 list-disc text-slate-600 mb-1">$1</li>')
    .replace(/^\* (.*)/g, '<li class="ml-4 list-disc text-slate-600 mb-1">$1</li>')
}
</script>

<style scoped>
.markdown-container >>> strong {
  color: #1e1b4b;
  font-weight: 700;
}
.markdown-container >>> li {
  margin-top: 0.25rem;
  margin-bottom: 0.25rem;
}
</style>
