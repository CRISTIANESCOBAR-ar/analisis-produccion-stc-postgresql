<template>
  <div class="w-full flex-1 flex flex-col min-h-0 overflow-y-auto bg-white px-6 py-4 gap-4 font-sans">

    <!-- Header con navegación de fecha y KPIs (Flat Layout) -->
    <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3 flex-shrink-0">
      <!-- Navegación de Fecha & Título -->
      <div class="flex items-center gap-3">
        <h2 class="text-sm font-semibold text-slate-900 flex items-center gap-2 tracking-tight">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          Seguimiento Diario
        </h2>
        <div class="flex items-center gap-1">
          <button @click="irFechaAnterior" :disabled="!fechaAnterior"
            class="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors cursor-pointer"
            v-tippy="{ content: 'Día anterior', placement: 'bottom', theme: 'light' }">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <span class="px-2.5 py-0.5 bg-slate-100 rounded text-xs font-semibold text-slate-800 font-mono min-w-[100px] text-center">
            {{ fechaActual || '...' }}
          </span>
          <button @click="irFechaSiguiente" :disabled="!fechaSiguiente"
            class="p-1 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-30 transition-colors cursor-pointer"
            v-tippy="{ content: 'Día siguiente', placement: 'bottom', theme: 'light' }">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
        <button @click="cargarDatos" :disabled="loading"
          class="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50"
          v-tippy="{ content: 'Refrescar datos', placement: 'bottom', theme: 'light' }">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" :class="{'animate-spin': loading}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M21 12a9 9 0 1 1-3-6.7" stroke-linecap="round" stroke-linejoin="round"></path>
            <polyline points="21 3 21 9 15 9" stroke-linecap="round" stroke-linejoin="round"></polyline>
          </svg>
          <span>Refrescar</span>
        </button>
      </div>

      <!-- KPIs Semánticos Suaves -->
      <div v-if="totales" class="flex items-center gap-2 flex-wrap">
        <button 
          @click="setFiltroHeader('all')"
          v-tippy="{ content: filtroEncUrdHeader === 'all' ? 'Mostrando todos' : 'Mostrar todos los artículos', placement: 'bottom', theme: 'light' }"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
          :class="filtroEncUrdHeader === 'all' ? 'bg-blue-50 text-blue-700 border-blue-500 font-semibold' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
            <rect x="14" y="3" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
            <rect x="14" y="14" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
            <rect x="3" y="14" width="7" height="7" stroke-linecap="round" stroke-linejoin="round"></rect>
          </svg>
          <span>{{ totales.total_articulos }} artículos · {{ totales.total_ensayos }} ensayos</span>
        </button>

        <button 
          v-if="totales.enc_urd_promedio !== null"
          @click="setFiltroHeader('all')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
          :class="totales.enc_urd_promedio > -1.0 ? 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100/70' : totales.enc_urd_promedio > -1.2 ? 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70' : 'bg-green-50 text-green-700 border-green-200/60 hover:bg-green-100/60'"
          v-tippy="{ content: 'Ver todos los ensayos', placement: 'bottom', theme: 'light' }">
          Enc.Urd Prom: {{ totales.enc_urd_promedio }}%
        </button>

        <button 
          v-if="totales.enc_urd_critico > 0"
          @click="setFiltroHeader('critico')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
          :class="filtroEncUrdHeader === 'critico' 
            ? 'bg-rose-100 text-rose-900 border-rose-400 font-medium' 
            : 'bg-rose-50 text-rose-800 border-rose-200/80 hover:bg-rose-100/70'"
          v-tippy="{ content: filtroEncUrdHeader === 'critico' ? 'Clic para quitar filtro' : 'Filtrar solo artículos y ensayos CRÍTICOS (fuera de rango)', placement: 'bottom', theme: 'light' }">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"></circle>
            <line x1="12" y1="8" x2="12" y2="12" stroke-linecap="round" stroke-linejoin="round"></line>
            <line x1="12" y1="16" x2="12.01" y2="16" stroke-linecap="round" stroke-linejoin="round"></line>
          </svg>
          <span>{{ totales.enc_urd_critico }} CRÍTICO{{ totales.enc_urd_critico > 1 ? 'S' : '' }}</span>
        </button>

        <button 
          v-if="totales.enc_urd_alerta > 0"
          @click="setFiltroHeader('alerta')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
          :class="filtroEncUrdHeader === 'alerta' 
            ? 'bg-amber-100 text-amber-900 border-amber-400 font-medium' 
            : 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100/70'"
          v-tippy="{ content: filtroEncUrdHeader === 'alerta' ? 'Clic para quitar filtro' : 'Filtrar solo artículos y ensayos en ALERTA / DERIVA', placement: 'bottom', theme: 'light' }">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-linecap="round" stroke-linejoin="round"></path>
            <line x1="12" y1="9" x2="12" y2="13" stroke-linecap="round" stroke-linejoin="round"></line>
            <line x1="12" y1="17" x2="12.01" y2="17" stroke-linecap="round" stroke-linejoin="round"></line>
          </svg>
          <span>{{ totales.enc_urd_alerta }} alerta{{ totales.enc_urd_alerta > 1 ? 's' : '' }}</span>
        </button>

        <button 
          v-if="totales.enc_urd_ok > 0"
          @click="setFiltroHeader('meta')"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 border rounded-lg text-xs transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
          :class="filtroEncUrdHeader === 'meta' 
            ? 'bg-green-100 text-green-800 border-green-400 font-medium' 
            : 'bg-green-50 text-green-700 border-green-200/60 hover:bg-green-100/60'"
          v-tippy="{ content: filtroEncUrdHeader === 'meta' ? 'Clic para quitar filtro' : 'Filtrar solo artículos y ensayos EN META [-1.5, -1.0]', placement: 'bottom', theme: 'light' }">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"></path>
            <polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"></polyline>
          </svg>
          <span>{{ totales.enc_urd_ok }} en meta</span>
        </button>

        <button 
          v-if="filtroEncUrdHeader !== 'all'"
          @click="setFiltroHeader('all')"
          v-tippy="{ content: 'Quitar filtro activo', placement: 'bottom', theme: 'light' }"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-slate-200 bg-white text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" stroke-linejoin="round"></line>
            <line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" stroke-linejoin="round"></line>
          </svg>
          <span>Quitar filtro</span>
        </button>
      </div>
    </div>

    <!-- TABLA DE ARTÍCULOS DEL DÍA (Flat Layout sin Bordes ni Sombras) -->
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden bg-white">
      <!-- Subheader de Leyenda y Estado -->
      <div class="pb-2 flex items-center justify-between text-xs flex-shrink-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-slate-900">
            Artículos del día 
            <span class="text-slate-500 font-normal">({{ articulosAgrupados.length }})</span>
          </span>
          <span v-if="filtroEncUrdHeader !== 'all'" 
            class="px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border"
            :class="filtroEncUrdHeader === 'critico' ? 'bg-rose-50 text-rose-800 border-rose-200/80' : filtroEncUrdHeader === 'alerta' ? 'bg-amber-50 text-amber-800 border-amber-200/80' : 'bg-green-50 text-green-700 border-green-200/60'">
            Filtrando por: {{ filtroEncUrdHeader === 'critico' ? 'Fuera de rango / Crítico' : filtroEncUrdHeader === 'alerta' ? 'Alerta / Deriva' : 'En meta [-1.5, -1.0]' }}
            <button @click="setFiltroHeader('all')" class="ml-1 hover:text-black font-semibold">✕</button>
          </span>
        </div>

        <div class="flex items-center gap-4 text-slate-500 text-[11px]">
          <span class="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors select-none"
            :class="filtroEncUrdHeader === 'meta' ? 'font-medium text-green-700 underline' : ''"
            @click="setFiltroHeader('meta')">
            <span class="w-2 h-2 rounded-full bg-green-500 inline-block"></span> En meta [-1.5, -1.0]
          </span>
          <span class="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors select-none"
            :class="filtroEncUrdHeader === 'alerta' ? 'font-medium text-amber-800 underline' : ''"
            @click="setFiltroHeader('alerta')">
            <span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Alerta/Deriva
          </span>
          <span class="flex items-center gap-1.5 cursor-pointer hover:text-slate-900 transition-colors select-none"
            :class="filtroEncUrdHeader === 'critico' ? 'font-medium text-rose-800 underline' : ''"
            @click="setFiltroHeader('critico')">
            <span class="w-2 h-2 rounded-full bg-rose-600 inline-block"></span> Fuera de rango / Crítico
          </span>
        </div>
      </div>

      <!-- Contenedor Tabla con Divisores Tenues -->
      <div class="overflow-auto flex-1 min-h-0">
        <table class="w-full text-xs text-left border-collapse">
          <thead class="bg-white border-b border-slate-200 sticky top-0 z-10">
            <tr>
              <th class="px-3 py-2.5 font-medium text-slate-500 min-w-[180px]">Artículo</th>
              <th class="px-2 py-2.5 text-center font-medium text-slate-500">Ensayos</th>
              <!-- Enc.Urd % -->
              <th class="px-2 py-2.5 text-center font-semibold text-blue-800 bg-blue-50/40 min-w-[100px]">Enc.Urd %</th>
              <th class="px-2 py-2.5 text-center font-medium text-slate-500">Enc.Tra %</th>
              <th class="px-2 py-2.5 text-center font-medium text-slate-500">Ancho TEST</th>
              <th class="px-2 py-2.5 text-center font-medium text-blue-700 bg-blue-50/20">Ancho MESA</th>
              <th class="px-2 py-2.5 text-center font-medium text-slate-400">Ancho Espec</th>
              <th class="px-2 py-2.5 text-center font-medium text-slate-500">Peso TEST</th>
              <th class="px-2 py-2.5 text-center font-medium text-blue-700 bg-blue-50/20">Peso MESA</th>
              <th class="px-2 py-2.5 text-center font-medium text-slate-400">Peso Espec</th>
              <th class="px-2 py-2.5 text-center font-medium text-slate-500">Acción</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-if="loading">
              <td colspan="11" class="py-12 text-center text-slate-400">
                <div class="inline-block animate-spin rounded-full h-7 w-7 border-3 border-slate-200 border-t-blue-600"></div>
                <p class="mt-2 text-xs">Cargando artículos del día...</p>
              </td>
            </tr>
            <tr v-else-if="articulosAgrupados.length === 0">
              <td colspan="11" class="py-12 text-center text-slate-400 font-normal">No hay ensayos registrados para esta fecha</td>
            </tr>
            <template v-else v-for="art in articulosAgrupados" :key="art.articulo">
              <tr 
                class="hover:bg-slate-50/80 transition-colors"
                :class="articuloExpandido === art.articulo ? 'bg-blue-50/30' : ''">
                <!-- Artículo -->
                <td class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <button @click="toggleDetalle(art.articulo)" class="text-[10px] text-slate-400 hover:text-blue-600 font-medium transition-colors">
                      {{ articuloExpandido === art.articulo ? '▼' : '▶' }}
                    </button>
                    <div>
                      <div class="font-mono font-semibold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors" @click="abrirGrafico(art, 'enc_urd')">
                        {{ art.articuloCorto }}
                      </div>
                      <div class="text-[10px] text-slate-400 font-normal truncate max-w-[160px]">{{ art.nombre }} · {{ art.trama || '' }}</div>
                    </div>
                  </div>
                </td>
                <!-- Ensayos -->
                <td class="px-2 py-2 text-center font-mono font-medium text-slate-600 cursor-pointer" @click="toggleDetalle(art.articulo)">
                  {{ art.count }}
                </td>
                <!-- Enc.Urd % - Clic para ver gráfico (Datos Críticos Destacados) -->
                <td class="px-2 py-2 text-center font-mono bg-blue-50/30 cursor-pointer hover:bg-blue-100/60 transition-colors"
                  :class="encUrdColorClass(art.encUrdAvg)"
                  @click="abrirGrafico(art, 'enc_urd')"
                  v-tippy="{ content: 'Ver gráfico de tendencia de Enc.Urd %', placement: 'bottom', theme: 'light' }">
                  <div class="flex flex-col items-center justify-center gap-0.5">
                    <div class="flex items-center justify-center gap-1 font-semibold text-xs">
                      <span>{{ art.encUrdAvg !== null ? art.encUrdAvg.toFixed(2) + '%' : '-' }}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                        <polyline points="17 6 23 6 23 12"></polyline>
                      </svg>
                    </div>
                    <span v-if="getEncUrdStatusInfo(art.encUrdAvg)"
                      class="px-1.5 py-0.5 rounded whitespace-nowrap"
                      :class="getEncUrdStatusInfo(art.encUrdAvg).bgClass">
                      {{ getEncUrdStatusInfo(art.encUrdAvg).label }}
                    </span>
                  </div>
                </td>
                <!-- Enc.Trama % (Secundario) -->
                <td class="px-2 py-2 text-center font-mono text-[11px] font-normal text-slate-500">{{ art.encTramaAvg !== null ? art.encTramaAvg.toFixed(2) : '-' }}</td>
                <!-- Ancho TEST (Secundario) -->
                <td class="px-2 py-2 text-center font-mono text-[11px] cursor-pointer hover:bg-slate-100/80 transition-colors"
                  :class="rangoColorClass(art.anchoTestAvg, art.anchoMin, art.anchoMax)"
                  @click="abrirGrafico(art, 'ancho')">
                  {{ art.anchoTestAvg !== null ? art.anchoTestAvg.toFixed(1) : '-' }}
                </td>
                <!-- Ancho MESA (Secundario) -->
                <td class="px-2 py-2 text-center font-mono text-[11px] bg-blue-50/10" :class="art.anchoMesaAvg !== null ? rangoColorClass(art.anchoMesaAvg, art.anchoMin, art.anchoMax) : 'text-slate-400 font-normal'">
                  {{ art.anchoMesaAvg !== null ? art.anchoMesaAvg.toFixed(1) : '—' }}
                </td>
                <!-- Ancho Espec (Secundario) -->
                <td class="px-2 py-2 text-center text-[10px] text-slate-400 font-normal">
                  {{ art.anchoMin ? `${art.anchoMin}-` : '' }}<span>{{ art.anchoStd || '-' }}</span>{{ art.anchoMax ? `-${art.anchoMax}` : '' }}
                </td>
                <!-- Peso TEST (Secundario) -->
                <td class="px-2 py-2 text-center font-mono text-[11px] cursor-pointer hover:bg-slate-100/80 transition-colors"
                  :class="rangoColorClass(art.pesoTestAvg, art.pesoMin, art.pesoMax)"
                  @click="abrirGrafico(art, 'peso')">
                  {{ art.pesoTestAvg !== null ? art.pesoTestAvg.toFixed(1) : '-' }}
                </td>
                <!-- Peso MESA (Secundario) -->
                <td class="px-2 py-2 text-center font-mono text-[11px] bg-blue-50/10" :class="art.pesoMesaAvg !== null ? rangoColorClass(art.pesoMesaAvg, art.pesoMin, art.pesoMax) : 'text-slate-400 font-normal'">
                  {{ art.pesoMesaAvg !== null ? art.pesoMesaAvg.toFixed(1) : '—' }}
                </td>
                <!-- Peso Espec (Secundario) -->
                <td class="px-2 py-2 text-center text-[10px] text-slate-400 font-normal">
                  {{ art.pesoMin ? `${art.pesoMin}-` : '' }}<span>{{ art.pesoStd || '-' }}</span>{{ art.pesoMax ? `-${art.pesoMax}` : '' }}
                </td>
                <!-- Acciones -->
                <td class="px-2 py-2 text-center">
                  <div class="flex items-center justify-center gap-1.5">
                    <button @click="abrirGrafico(art, 'enc_urd')"
                      class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
                      v-tippy="{ content: 'Ver tendencia histórica de Enc.Urd %', placement: 'bottom', theme: 'light' }">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                        <polyline points="17 6 23 6 23 12"></polyline>
                      </svg>
                      <span>Tendencia</span>
                    </button>
                    <button @click="toggleDetalle(art.articulo)"
                      class="inline-flex items-center gap-1 px-2 py-1 border border-slate-200 rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
                      :class="articuloExpandido === art.articulo ? 'bg-blue-50 text-blue-700 border-blue-500' : 'bg-white text-slate-700 hover:bg-slate-50'"
                      v-tippy="{ content: articuloExpandido === art.articulo ? 'Ocultar detalle de partidas' : 'Ver partidas detalladas', placement: 'bottom', theme: 'light' }">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                      </svg>
                      <span>{{ articuloExpandido === art.articulo ? 'Ocultar' : 'Partidas' }}</span>
                    </button>
                  </div>
                </td>
              </tr>

              <!-- Fila expandida de partidas (Flat Subtable) -->
              <tr v-if="articuloExpandido === art.articulo" class="bg-slate-50/50">
                <td colspan="11" class="p-3 border-b border-slate-100">
                  <div class="bg-white p-3 rounded-lg border border-slate-200/80">
                    <div class="flex items-center justify-between mb-2 px-1">
                      <div class="text-xs font-semibold text-slate-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <line x1="8" y1="6" x2="21" y2="6"></line>
                          <line x1="8" y1="12" x2="21" y2="12"></line>
                          <line x1="8" y1="18" x2="21" y2="18"></line>
                        </svg>
                        <span>Detalle de ensayos del día: <strong class="font-mono text-slate-900">{{ art.articulo }}</strong> ({{ partidasExpandidas.length }} registros)</span>
                      </div>
                      <button @click="articuloExpandido = null" class="text-xs text-slate-400 hover:text-slate-700 font-semibold px-2 py-0.5 transition-colors">✕ Cerrar</button>
                    </div>

                    <div v-if="partidasExpandidas.length === 0" class="text-xs text-slate-400 italic py-3 text-center">
                      No se encontraron partidas para los filtros seleccionados.
                    </div>

                    <div v-else class="overflow-x-auto">
                      <table class="w-full text-[11px] table-auto border-collapse">
                        <thead class="bg-slate-50 border-b border-slate-200 text-slate-600">
                          <tr>
                            <th class="px-2 py-1.5 text-left font-semibold">Partida</th>
                            <th class="px-2 py-1.5 text-center font-semibold">Fecha</th>
                            <th class="px-2 py-1.5 text-center font-semibold">Maq</th>
                            <th class="px-2 py-1.5 text-center font-semibold">Turno</th>
                            <th class="px-2 py-1.5 text-center font-semibold">Hora</th>
                            <th class="px-2 py-1.5 text-center font-semibold">Ap</th>
                            <th class="px-2 py-1.5 text-center font-semibold text-blue-900 bg-blue-50/50">Estado Enc.Urd</th>
                            <th class="px-2 py-1.5 text-center font-bold text-blue-900 bg-blue-50/50">Enc.Urd%</th>
                            <th class="px-2 py-1.5 text-center font-semibold">Enc.Tra%</th>
                            <th class="px-2 py-1.5 text-center font-semibold text-blue-900">Ancho T</th>
                            <th class="px-2 py-1.5 text-center font-semibold text-blue-900">Peso T</th>
                            <th class="px-2 py-1.5 text-center font-semibold text-blue-900">Ancho M</th>
                            <th class="px-2 py-1.5 text-center font-semibold text-blue-900">Peso M</th>
                            <th class="px-2 py-1.5 text-center font-semibold text-blue-900">Metros</th>
                            <th class="px-2 py-1.5 text-left font-semibold text-blue-900">Obs</th>
                          </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                          <tr v-for="(p, i) in partidasExpandidas" :key="i" class="hover:bg-slate-50 transition-colors">
                            <td class="px-2 py-1 font-mono text-slate-800 font-bold">{{ p.Partida }}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-700 whitespace-nowrap">{{ formatFecha(p.Fecha || p.dt_prod) }}</td>
                            <td class="px-2 py-1 text-center text-slate-600">{{ p.Maquina || '-' }}</td>
                            <td class="px-2 py-1 text-center text-slate-600">{{ p.Turno || '-' }}</td>
                            <td class="px-2 py-1 text-center text-slate-600">{{ p.Hora || '-' }}</td>
                            <td class="px-2 py-1 text-center">
                              <span class="px-1 py-0.5 rounded text-[9px] font-bold" :class="p.Ap === 'A' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'">{{ p.Ap || '-' }}</span>
                            </td>
                            <td class="px-2 py-1 text-center">
                              <span v-if="getEncUrdStatusInfo(p.EncUrd)"
                                class="px-1.5 py-0.5 rounded text-[9px] border whitespace-nowrap inline-block"
                                :class="getEncUrdStatusInfo(p.EncUrd).bgClass">
                                {{ getEncUrdStatusInfo(p.EncUrd).label }}
                              </span>
                              <span v-else class="text-slate-400">-</span>
                            </td>
                            <td class="px-2 py-1 text-center font-mono font-bold bg-blue-50/30" :class="encUrdColorClass(parseFloat(p.EncUrd))">{{ p.EncUrd ?? '-' }}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-700">{{ p.EncTrama ?? '-' }}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-700">{{ p.AnchoTest ?? '-' }}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-700">{{ p.PesoTest ?? '-' }}</td>
                            <td class="px-2 py-1 text-center font-mono" :class="p.AnchoMesa ? 'text-blue-700 font-semibold' : 'text-slate-400'">{{ p.AnchoMesa ?? '—' }}</td>
                            <td class="px-2 py-1 text-center font-mono" :class="p.PesoMesa ? 'text-blue-700 font-semibold' : 'text-slate-400'">{{ p.PesoMesa ?? '—' }}</td>
                            <td class="px-2 py-1 text-center font-mono text-slate-600">{{ p.MetrosTest ?? '-' }}</td>
                            <td class="px-2 py-1 text-slate-500 truncate max-w-[100px]" :title="p.Obs || ''">{{ p.Obs || '' }}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL DE GRÁFICO DE TENDENCIA DINÁMICA -->
    <div v-if="modalGraficoAbierto" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm" :class="modalMaximizado ? 'p-0' : 'p-4'">
      <div class="bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-200 animate-fade-in" :class="modalMaximizado ? 'w-full h-full max-w-full max-h-full rounded-none' : 'w-full max-w-4xl max-h-[90vh] rounded-2xl'">
        
        <!-- Modal Header -->
        <div class="px-5 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between flex-shrink-0">
          <div>
            <div class="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                <polyline points="17 6 23 6 23 12"></polyline>
              </svg>
              <h3 class="text-base font-bold text-slate-800">
                Tendencia de Variable: <span class="font-mono text-blue-700">{{ articuloSeleccionadoGrafico?.articulo }}</span>
              </h3>
              <span v-if="articuloSeleccionadoGrafico?.nombre" class="text-xs text-slate-500 font-semibold">
                ({{ articuloSeleccionadoGrafico.nombre }})
              </span>
            </div>
            <p class="text-xs text-slate-500 mt-0.5">
              Fecha analizada: <strong class="text-slate-800 font-mono">{{ fechaActual }}</strong> 
              · Ventana: <span class="font-mono font-semibold">{{ rangoGrafico.inicio }}</span> a <span class="font-mono font-semibold">{{ rangoGrafico.fin }}</span>
              <span v-if="esUltimoDiaGrafico" class="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-[10px]">
                📅 (30 días atrás hasta hoy)
              </span>
              <span v-else class="ml-2 px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                📅 (Centrado ±15 días de fecha analizada)
              </span>
            </p>
          </div>
          <div class="flex items-center gap-1">
            <button @click="toggleMaximizarGrafico" 
              v-tippy="{ content: modalMaximizado ? 'Restaurar tamaño normal' : 'Maximizar a pantalla completa', placement: 'bottom', theme: 'light' }"
              class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer">
              <!-- Icono Maximizar -->
              <svg v-if="!modalMaximizado" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <!-- Icono Restaurar -->
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <button @click="cerrarGrafico" 
              v-tippy="{ content: 'Cerrar ventana', placement: 'bottom', theme: 'light' }"
              class="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" stroke-linejoin="round"></line>
                <line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" stroke-linejoin="round"></line>
              </svg>
            </button>
          </div>
        </div>

        <!-- Selector de Variable (Tabs inside Modal) -->
        <div class="px-5 py-2.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between flex-shrink-0 flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <button @click="variableGrafico = 'enc_urd'; renderizarGrafico()"
              v-tippy="{ content: 'Ver tendencia de encogimiento urdido', placement: 'bottom', theme: 'light' }"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
              :class="variableGrafico === 'enc_urd' ? 'bg-blue-50 text-blue-700 border-blue-500 font-semibold' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke-linecap="round" stroke-linejoin="round"></circle>
                <circle cx="12" cy="12" r="6" stroke-linecap="round" stroke-linejoin="round"></circle>
                <circle cx="12" cy="12" r="2" stroke-linecap="round" stroke-linejoin="round"></circle>
              </svg>
              <span>Encogimiento Urdido %</span>
            </button>
            <button @click="variableGrafico = 'ancho'; renderizarGrafico()"
              v-tippy="{ content: 'Ver tendencia de ancho (TEST vs MESA)', placement: 'bottom', theme: 'light' }"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
              :class="variableGrafico === 'ancho' ? 'bg-blue-50 text-blue-700 border-blue-500 font-semibold' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M2 12h20" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M6 12v-3" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M10 12v-2" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M14 12v-3" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M18 12v-2" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <span>Ancho (TEST vs MESA)</span>
            </button>
            <button @click="variableGrafico = 'peso'; renderizarGrafico()"
              v-tippy="{ content: 'Ver tendencia de peso g/m²', placement: 'bottom', theme: 'light' }"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer"
              :class="variableGrafico === 'peso' ? 'bg-blue-50 text-blue-700 border-blue-500 font-semibold' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M12 3v18" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M3 7l9-4 9 4" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M6 12l-3 5a2 2 0 0 0 2 3h4a2 2 0 0 0 2-3l-3-5" stroke-linecap="round" stroke-linejoin="round"></path>
                <path d="M18 12l-3 5a2 2 0 0 0 2 3h4a2 2 0 0 0 2-3l-3-5" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
              <span>Peso (g/m²)</span>
            </button>
          </div>

          <!-- Selector de Modo de Visualización (Promedio diario vs Todos los ensayos) -->
          <div class="flex items-center gap-1 p-0.5 bg-slate-100 border border-slate-200/80 rounded-lg text-xs">
            <button @click="modoVisualizacionGrafico = 'promedio'; renderizarGrafico()"
              v-tippy="{ content: 'Ver 1 punto por día representando la media diaria', placement: 'bottom', theme: 'light' }"
              class="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer select-none"
              :class="modoVisualizacionGrafico === 'promedio' ? 'bg-white text-blue-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'">
              Promedio diario
            </button>
            <button @click="modoVisualizacionGrafico = 'todos'; renderizarGrafico()"
              v-tippy="{ content: 'Ver todos los ensayos y partidas individuales', placement: 'bottom', theme: 'light' }"
              class="px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer select-none"
              :class="modoVisualizacionGrafico === 'todos' ? 'bg-white text-blue-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-800'">
              Todos los ensayos ({{ datosGraficoDetalle.length }})
            </button>
          </div>
        </div>

        <!-- Body con Canvas de Chart.js -->
        <div class="p-4 flex-1 flex flex-col justify-center relative bg-white" :class="modalMaximizado ? 'min-h-0' : 'min-h-[340px]'">
          <div v-if="cargandoGrafico" class="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-300 border-t-blue-600"></div>
              <p class="mt-2 text-xs font-semibold text-slate-600">Cargando serie histórica de tendencias...</p>
            </div>
          </div>
          <div class="w-full h-full relative" :class="modalMaximizado ? 'min-h-0' : 'min-h-[320px]'">
            <canvas ref="chartCanvas"></canvas>
          </div>
        </div>

        <!-- Footer del Modal -->
        <div class="px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600 flex-shrink-0">
          <div class="flex items-center gap-4">
            <span v-if="variableGrafico === 'enc_urd' && especificacionGrafico?.UrdMin">
              Ficha Urdido: <strong class="font-mono text-slate-800">{{ especificacionGrafico.UrdMin }}%</strong> a <strong class="font-mono text-slate-800">{{ especificacionGrafico.UrdMax }}%</strong>
            </span>
            <span v-else-if="variableGrafico === 'ancho' && especificacionGrafico?.AnchoStd">
              Ficha Ancho: <strong class="font-mono text-slate-800">{{ especificacionGrafico.AnchoStd }} cm</strong> (Min: {{ especificacionGrafico.AnchoMin }} / Max: {{ especificacionGrafico.AnchoMax }})
            </span>
            <span v-else-if="variableGrafico === 'peso' && especificacionGrafico?.PesoStd">
              Ficha Peso: <strong class="font-mono text-slate-800">{{ especificacionGrafico.PesoStd }} g/m²</strong>
              <span class="text-slate-500 font-normal ml-1">
                (Min -5%: <strong class="font-mono text-slate-800">{{ (parseFloat(especificacionGrafico.PesoStd) * 0.95).toFixed(1) }}</strong> / Max +5%: <strong class="font-mono text-slate-800">{{ (parseFloat(especificacionGrafico.PesoStd) * 1.05).toFixed(1) }}</strong>)
              </span>
            </span>
          </div>
          <button @click="cerrarGrafico" 
            v-tippy="{ content: 'Cerrar ventana', placement: 'top', theme: 'light' }"
            class="inline-flex items-center gap-1 px-3 py-1.5 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-medium transition-colors duration-150 shadow-sm hover:shadow-md cursor-pointer">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18" stroke-linecap="round" stroke-linejoin="round"></line>
              <line x1="6" y1="6" x2="18" y2="18" stroke-linecap="round" stroke-linejoin="round"></line>
            </svg>
            <span>Cerrar</span>
          </button>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted, computed, nextTick } from 'vue'
import { Chart, registerables } from 'chart.js'

Chart.register(...registerables)

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const apiUrl = (path) => `${API_BASE}${path}`

const loading = ref(false)
const fechaActual = ref(null)
const fechasDisponibles = ref([])
const totales = ref(null)
const ensayos = ref([])
const articuloExpandido = ref(null)

// Estado del Modal de Gráfico
const modalGraficoAbierto = ref(false)
const modalMaximizado = ref(false)
const cargandoGrafico = ref(false)
const articuloSeleccionadoGrafico = ref(null)
const variableGrafico = ref('enc_urd') // 'enc_urd' | 'ancho' | 'peso'
const modoVisualizacionGrafico = ref('promedio') // 'promedio' | 'todos'
const datosGrafico = ref([])
const datosGraficoDetalle = ref([])
const rangoGrafico = ref({ inicio: '', fin: '' })
const esUltimoDiaGrafico = ref(false)
const especificacionGrafico = ref(null)
const chartCanvas = ref(null)
let chartInstance = null

const formatFecha = (fecha) => {
  if (!fecha) return '-'
  const str = String(fecha).trim()
  if (!str) return '-'
  const parts = str.split('T')[0].split('-')
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  return str
}

const filtroEncUrdHeader = ref('all') // 'all' | 'critico' | 'alerta' | 'meta'

const setFiltroHeader = (tipo) => {
  if (filtroEncUrdHeader.value === tipo) {
    filtroEncUrdHeader.value = 'all'
  } else {
    filtroEncUrdHeader.value = tipo
  }
}

const getEncUrdStatusInfo = (val) => {
  if (val === null || val === undefined || val === '') return null
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return null

  if (num > -1.0 || num < -1.8) {
    return {
      type: 'critico',
      label: 'Fuera de rango / Crítico',
      bgClass: 'bg-rose-50 text-rose-800 border border-rose-200/80 font-medium text-[10px]'
    }
  }
  if ((num > -1.2 && num <= -1.0) || (num < -1.5 && num >= -1.8)) {
    return {
      type: 'alerta',
      label: 'Alerta/Deriva',
      bgClass: 'bg-amber-50 text-amber-800 border border-amber-200/80 font-medium text-[10px]'
    }
  }
  return {
    type: 'meta',
    label: 'En meta [-1.5, -1.0]',
    bgClass: 'bg-green-50 text-green-700 border border-green-200/60 font-medium text-[10px]'
  }
}

// ===== Helpers de color y estado =====

const encUrdColorClass = (val) => {
  if (val === null || isNaN(val)) return 'text-slate-400 font-normal'
  if (val > -1.0) return 'text-rose-700 font-semibold'
  if (val > -1.2) return 'text-amber-700 font-semibold'
  if (val >= -1.6) return 'text-green-700 font-semibold'
  return 'text-slate-700 font-normal'
}

const rangoColorClass = (val, min, max) => {
  if (val === null || isNaN(val)) return 'text-slate-400 font-normal'
  if (min !== null && val < min) return 'text-rose-700 font-medium'
  if (max !== null && val > max) return 'text-rose-700 font-medium'
  return 'text-slate-600 font-normal'
}

// Navegación de fechas
const fechaAnterior = computed(() => {
  if (!fechaActual.value || !fechasDisponibles.value.length) return null
  const idx = fechasDisponibles.value.indexOf(fechaActual.value)
  return idx >= 0 && idx < fechasDisponibles.value.length - 1 ? fechasDisponibles.value[idx + 1] : null
})
const fechaSiguiente = computed(() => {
  if (!fechaActual.value || !fechasDisponibles.value.length) return null
  const idx = fechasDisponibles.value.indexOf(fechaActual.value)
  return idx > 0 ? fechasDisponibles.value[idx - 1] : null
})
const irFechaAnterior = () => { if (fechaAnterior.value) { fechaActual.value = fechaAnterior.value; cargarDatos() } }
const irFechaSiguiente = () => { if (fechaSiguiente.value) { fechaActual.value = fechaSiguiente.value; cargarDatos() } }

// Agrupar ensayos por artículo para mostrar resumen
const articulosAgrupados = computed(() => {
  if (!ensayos.value.length) return []
  const map = {}
  for (const e of ensayos.value) {
    const key = e.Articulo
    if (!map[key]) {
      map[key] = {
        articulo: key,
        articuloCorto: key?.substring(0, 10) || key,
        nombre: e.Nombre || '',
        color: e.Color || '',
        trama: e.Trama || '',
        count: 0,
        encUrdSum: 0, encUrdCount: 0,
        encTramaSum: 0, encTramaCount: 0,
        anchoTestSum: 0, anchoTestCount: 0,
        pesoTestSum: 0, pesoTestCount: 0,
        anchoMesaSum: 0, anchoMesaCount: 0,
        pesoMesaSum: 0, pesoMesaCount: 0,
        anchoMin: parseFloat(e.AnchoMin) || null,
        anchoStd: parseFloat(e.AnchoStd) || null,
        anchoMax: parseFloat(e.AnchoMax) || null,
        pesoMin: parseFloat(e.PesoMin) || null,
        pesoStd: parseFloat(e.PesoStd) || null,
        pesoMax: parseFloat(e.PesoMax) || null,
        urdMin: parseFloat(e.UrdMin) || null,
        urdMax: parseFloat(e.UrdMax) || null,
      }
    }
    const a = map[key]
    a.count++
    const eu = parseFloat(e.EncUrd); if (!isNaN(eu)) { a.encUrdSum += eu; a.encUrdCount++ }
    const et = parseFloat(e.EncTrama); if (!isNaN(et)) { a.encTramaSum += et; a.encTramaCount++ }
    const at = parseFloat(e.AnchoTest); if (!isNaN(at)) { a.anchoTestSum += at; a.anchoTestCount++ }
    const pt = parseFloat(e.PesoTest); if (!isNaN(pt)) { a.pesoTestSum += pt; a.pesoTestCount++ }
    const am = parseFloat(e.AnchoMesa); if (!isNaN(am)) { a.anchoMesaSum += am; a.anchoMesaCount++ }
    const pm = parseFloat(e.PesoMesa); if (!isNaN(pm)) { a.pesoMesaSum += pm; a.pesoMesaCount++ }
  }

  let list = Object.values(map).map(a => ({
    ...a,
    encUrdAvg: a.encUrdCount > 0 ? a.encUrdSum / a.encUrdCount : null,
    encTramaAvg: a.encTramaCount > 0 ? a.encTramaSum / a.encTramaCount : null,
    anchoTestAvg: a.anchoTestCount > 0 ? a.anchoTestSum / a.anchoTestCount : null,
    pesoTestAvg: a.pesoTestCount > 0 ? a.pesoTestSum / a.pesoTestCount : null,
    anchoMesaAvg: a.anchoMesaCount > 0 ? a.anchoMesaSum / a.anchoMesaCount : null,
    pesoMesaAvg: a.pesoMesaCount > 0 ? a.pesoMesaSum / a.pesoMesaCount : null,
  }))

  if (filtroEncUrdHeader.value !== 'all') {
    list = list.filter(a => {
      const info = getEncUrdStatusInfo(a.encUrdAvg)
      return info && info.type === filtroEncUrdHeader.value
    })
  }

  return list.sort((a, b) => {
    const sa = estadoPrioridad(a)
    const sb = estadoPrioridad(b)
    if (sa !== sb) return sa - sb
    return (a.articulo || '').localeCompare(b.articulo || '')
  })
})

// Partidas del artículo expandido
const partidasExpandidas = computed(() => {
  if (!articuloExpandido.value) return []
  let items = ensayos.value.filter(e => e.Articulo === articuloExpandido.value)
  if (filtroEncUrdHeader.value !== 'all') {
    items = items.filter(e => {
      const info = getEncUrdStatusInfo(e.EncUrd)
      return info && info.type === filtroEncUrdHeader.value
    })
  }
  return items
})

const toggleDetalle = (articulo) => {
  articuloExpandido.value = articuloExpandido.value === articulo ? null : articulo
}

// Cargar datos principales del día
const cargarDatos = async () => {
  loading.value = true
  articuloExpandido.value = null
  filtroEncUrdHeader.value = 'all'
  try {
    const url = fechaActual.value
      ? apiUrl(`/api/produccion/calidad/resumen-dia-anterior?fecha=${fechaActual.value}`)
      : apiUrl(`/api/produccion/calidad/resumen-dia-anterior`)
    const res = await fetch(url)
    const data = await res.json()
    fechaActual.value = data.target_date
    fechasDisponibles.value = data.fechas_disponibles || []
    totales.value = data.totales
    ensayos.value = data.ensayos || []
  } catch (err) {
    console.error('Error cargando datos:', err)
  } finally {
    loading.value = false
  }
}

// ===== LÓGICA Y MANEJO DEL GRÁFICO DE TENDENCIAS =====

const abrirGrafico = async (art, variable = 'enc_urd') => {
  articuloSeleccionadoGrafico.value = art
  variableGrafico.value = variable
  modalGraficoAbierto.value = true
  modalMaximizado.value = false
  cargandoGrafico.value = true

  try {
    const url = apiUrl(`/api/produccion/calidad/seguimiento-tendencias?articulo=${encodeURIComponent(art.articulo)}&fecha_referencia=${fechaActual.value}`)
    const res = await fetch(url)
    const data = await res.json()
    
    datosGrafico.value = data.diario || []
    datosGraficoDetalle.value = data.ensayos_detalle || []
    rangoGrafico.value = data.rango || { inicio: '', fin: '' }
    esUltimoDiaGrafico.value = data.es_ultimo_dia || false
    especificacionGrafico.value = data.especificacion || null

    await nextTick()
    renderizarGrafico()
  } catch (err) {
    console.error('Error cargando tendencia para el gráfico:', err)
  } finally {
    cargandoGrafico.value = false
  }
}

const cerrarGrafico = () => {
  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }
  modalGraficoAbierto.value = false
  modalMaximizado.value = false
}

const toggleMaximizarGrafico = async () => {
  modalMaximizado.value = !modalMaximizado.value
  await nextTick()
  if (chartInstance) {
    chartInstance.resize()
  }
}

const getOrCreateTooltip = (chart) => {
  let tooltipEl = chart.canvas.parentNode.querySelector('div.custom-chart-tooltip')
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'custom-chart-tooltip'
    tooltipEl.style.background = 'rgba(255, 255, 255, 0.97)'
    tooltipEl.style.borderRadius = '8px'
    tooltipEl.style.border = '1px solid #cbd5e1'
    tooltipEl.style.boxShadow = '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)'
    tooltipEl.style.color = '#334155'
    tooltipEl.style.fontFamily = "'Segoe UI', 'Ubuntu', system-ui, -apple-system, sans-serif"
    tooltipEl.style.opacity = '0'
    tooltipEl.style.pointerEvents = 'none'
    tooltipEl.style.position = 'absolute'
    tooltipEl.style.transition = 'all .1s ease'
    tooltipEl.style.padding = '10px 14px'
    tooltipEl.style.zIndex = '50'
    chart.canvas.parentNode.appendChild(tooltipEl)
  }
  return tooltipEl
}

const externalTooltipHandler = (context) => {
  const { chart, tooltip } = context
  const tooltipEl = getOrCreateTooltip(chart)

  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = '0'
    return
  }

  const index = tooltip.dataPoints[0]?.dataIndex
  const esModoTodos = modoVisualizacionGrafico.value === 'todos'
  const listaDatos = esModoTodos ? (datosGraficoDetalle.value || []) : (datosGrafico.value || [])
  const dato = (index !== undefined && listaDatos[index]) ? listaDatos[index] : null

  let innerHtml = '<div style="min-width: 180px;">'

  if (esModoTodos && dato?.Partida) {
    innerHtml += `<div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Partida: ${dato.Partida}</div>`
  } else {
    const fechaVal = dato?.Fecha ? formatFecha(dato.Fecha) : '-'
    const ensayosVal = dato?.EnsayosCount ? `(${dato.EnsayosCount} ensayo${dato.EnsayosCount > 1 ? 's' : ''})` : ''
    innerHtml += `<div style="font-weight: 700; color: #0f172a; font-size: 13px; margin-bottom: 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;">Fecha: ${fechaVal} ${ensayosVal}</div>`
  }

  innerHtml += '<div style="font-size: 12px; display: flex; flex-direction: column; gap: 4px;">'

  if (esModoTodos) {
    innerHtml += `
      <div style="display: flex; justify-content: space-between; gap: 12px;">
        <span style="font-weight: 400; color: #475569;">Fecha Prod:</span>
        <span style="font-weight: 500; color: #334155; font-family: monospace;">${formatFecha(dato?.Fecha)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 12px;">
        <span style="font-weight: 400; color: #475569;">Hora Prod:</span>
        <span style="font-weight: 500; color: #334155; font-family: monospace;">${dato?.Hora || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px;">
        <span style="font-weight: 400; color: #475569;">Turno:</span>
        <span style="font-weight: 500; color: #334155; font-family: monospace;">${dato?.Turno || '-'}</span>
      </div>
    `
  }

  if (tooltip.body) {
    tooltip.dataPoints.forEach((point) => {
      const label = point.dataset.label || ''
      const value = point.parsed.y
      const color = point.dataset.borderColor || '#334155'
      const formattedVal = (value === null || value === undefined || isNaN(value))
        ? '-'
        : (Number.isInteger(value) ? value : Number(value).toFixed(2))

      const isBold = (label.includes('Promedio') || label.includes('TEST') || label.includes('Valor Real') || label.includes('Medición Individual'))
      const labelWeight = isBold ? '700' : '400'
      const labelColor = isBold ? '#0f172a' : '#475569'
      const valWeight = isBold ? '700' : '500'
      const valColor = isBold ? '#0f172a' : '#334155'

      innerHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${color}; flex-shrink: 0;"></span>
            <span style="font-weight: ${labelWeight}; color: ${labelColor};">${label}:</span>
          </div>
          <span style="font-weight: ${valWeight}; color: ${valColor}; font-family: monospace;">${formattedVal}</span>
        </div>
      `
    })
  }

  if (esModoTodos && dato?.Maquina) {
    innerHtml += `
      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #e2e8f0; display: flex; justify-content: space-between; gap: 12px;">
        <span style="font-weight: 400; color: #475569;">Máquina:</span>
        <span style="font-weight: 500; color: #334155; font-family: monospace;">${dato.Maquina}</span>
      </div>
    `
  }

  innerHtml += '</div></div>'
  tooltipEl.innerHTML = innerHtml

  const parentRect = chart.canvas.parentNode.getBoundingClientRect()
  const tooltipWidth = tooltipEl.offsetWidth || 185
  const tooltipHeight = tooltipEl.offsetHeight || 180

  let left = tooltip.caretX + 12
  let top = tooltip.caretY - tooltipHeight / 2

  if (left + tooltipWidth > parentRect.width - 10) {
    left = tooltip.caretX - tooltipWidth - 12
  }
  if (top < 10) top = 10
  if (top + tooltipHeight > parentRect.height - 10) {
    top = parentRect.height - tooltipHeight - 10
  }

  tooltipEl.style.opacity = '1'
  tooltipEl.style.left = left + 'px'
  tooltipEl.style.top = top + 'px'
}

const renderizarGrafico = async () => {
  const esModoTodos = modoVisualizacionGrafico.value === 'todos'
  const fuenteDatos = esModoTodos ? datosGraficoDetalle.value : datosGrafico.value

  if (!chartCanvas.value || !fuenteDatos) return

  if (chartInstance) {
    chartInstance.destroy()
    chartInstance = null
  }

  const labels = fuenteDatos.map(d => {
    const parts = String(d.Fecha).split('T')[0].split('-')
    const fechaStr = `${parts[2]}/${parts[1]}`
    return esModoTodos && d.Hora ? `${fechaStr} ${d.Hora}` : fechaStr
  })

  let datasets = []

  if (variableGrafico.value === 'enc_urd') {
    const avgData = fuenteDatos.map(d => {
      const val = esModoTodos ? d.EncUrd : d.EncUrdAvg
      return val !== null && val !== undefined ? parseFloat(val) : null
    })
    const validAvg = avgData.filter(v => v !== null)
    const promPeriodo = validAvg.length ? validAvg.reduce((a, b) => a + b, 0) / validAvg.length : null

    const urdMinVal = (especificacionGrafico.value?.UrdMin !== undefined && especificacionGrafico.value?.UrdMin !== null && !isNaN(parseFloat(especificacionGrafico.value.UrdMin)))
      ? parseFloat(especificacionGrafico.value.UrdMin)
      : -3.0
    const urdMaxVal = (especificacionGrafico.value?.UrdMax !== undefined && especificacionGrafico.value?.UrdMax !== null && !isNaN(parseFloat(especificacionGrafico.value.UrdMax)))
      ? parseFloat(especificacionGrafico.value.UrdMax)
      : 1.0
    const urdStdVal = (urdMinVal + urdMaxVal) / 2

    datasets = [
      {
        label: esModoTodos ? 'Medición Individual %' : 'Valor Real (Promedio)',
        data: avgData,
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: esModoTodos ? 1.5 : 2.5,
        tension: 0,
        fill: false,
        pointRadius: esModoTodos ? 4 : 0,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: 'rgb(37, 99, 235)',
        pointHoverBorderColor: 'white'
      },
      {
        label: 'Promedio Período',
        data: labels.map(() => promPeriodo),
        borderColor: 'rgb(249, 115, 22)',
        borderWidth: 2,
        borderDash: [3, 3],
        pointRadius: 0,
        fill: false
      },
      {
        label: `Límite Mínimo Ficha (${urdMinVal.toFixed(2)}%)`,
        data: labels.map(() => urdMinVal),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      },
      {
        label: `Estándar Ficha (${urdStdVal.toFixed(2)}%)`,
        data: labels.map(() => urdStdVal),
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      },
      {
        label: `Límite Máximo Ficha (${urdMaxVal.toFixed(2)}%)`,
        data: labels.map(() => urdMaxVal),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      }
    ]
  } else if (variableGrafico.value === 'ancho') {
    const testData = fuenteDatos.map(d => {
      const val = esModoTodos ? d.AnchoTest : d.AnchoTestAvg
      return val !== null && val !== undefined ? parseFloat(val) : null
    })
    const mesaData = fuenteDatos.map(d => d.AnchoMesaAvg !== null && d.AnchoMesaAvg !== undefined ? parseFloat(d.AnchoMesaAvg) : null)
    const stdVal = especificacionGrafico.value?.AnchoStd ? parseFloat(especificacionGrafico.value.AnchoStd) : null
    const minVal = especificacionGrafico.value?.AnchoMin ? parseFloat(especificacionGrafico.value.AnchoMin) : null
    const maxVal = especificacionGrafico.value?.AnchoMax ? parseFloat(especificacionGrafico.value.AnchoMax) : null

    datasets = [
      {
        label: esModoTodos ? 'Ancho TEST Individual (cm)' : 'Ancho TEST (cm)',
        data: testData,
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: esModoTodos ? 1.5 : 2.5,
        tension: 0,
        fill: false,
        pointRadius: esModoTodos ? 4 : 0,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: 'rgb(37, 99, 235)',
        pointHoverBorderColor: 'white'
      },
      {
        label: 'Ancho MESA (cm)',
        data: mesaData,
        borderColor: 'rgb(139, 92, 246)',
        borderWidth: 2,
        tension: 0,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 5
      }
    ]
    if (stdVal) {
      datasets.push({
        label: `Estándar (${stdVal} cm)`,
        data: labels.map(() => stdVal),
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      })
    }
    if (minVal) {
      datasets.push({
        label: `Límite Mínimo (${minVal} cm)`,
        data: labels.map(() => minVal),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      })
    }
    if (maxVal) {
      datasets.push({
        label: `Límite Máximo (${maxVal} cm)`,
        data: labels.map(() => maxVal),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      })
    }
  } else if (variableGrafico.value === 'peso') {
    const testData = fuenteDatos.map(d => {
      const val = esModoTodos ? d.PesoTest : d.PesoTestAvg
      return val !== null && val !== undefined ? parseFloat(val) : null
    })
    const mesaData = fuenteDatos.map(d => d.PesoMesaAvg !== null && d.PesoMesaAvg !== undefined ? parseFloat(d.PesoMesaAvg) : null)
    const stdVal = especificacionGrafico.value?.PesoStd ? parseFloat(especificacionGrafico.value.PesoStd) : null
    let minVal = especificacionGrafico.value?.PesoMin ? parseFloat(especificacionGrafico.value.PesoMin) : null
    let maxVal = especificacionGrafico.value?.PesoMax ? parseFloat(especificacionGrafico.value.PesoMax) : null

    // Regla de negocio: Tolerancia del ±5% para Peso si no están definidos min/max explícitos
    if (stdVal !== null && !isNaN(stdVal)) {
      if (minVal === null || isNaN(minVal)) {
        minVal = stdVal * 0.95
      }
      if (maxVal === null || isNaN(maxVal)) {
        maxVal = stdVal * 1.05
      }
    }

    datasets = [
      {
        label: esModoTodos ? 'Peso TEST Individual (g/m²)' : 'Peso TEST (g/m²)',
        data: testData,
        borderColor: 'rgb(37, 99, 235)',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: esModoTodos ? 1.5 : 2.5,
        tension: 0,
        fill: false,
        pointRadius: esModoTodos ? 4 : 0,
        pointHoverRadius: 6,
        pointHoverBorderWidth: 2,
        pointHoverBackgroundColor: 'rgb(37, 99, 235)',
        pointHoverBorderColor: 'white'
      },
      {
        label: 'Peso MESA (g/m²)',
        data: mesaData,
        borderColor: 'rgb(5, 150, 105)',
        borderWidth: 2,
        tension: 0,
        fill: false,
        pointRadius: 0,
        pointHoverRadius: 5
      }
    ]
    if (stdVal) {
      datasets.push({
        label: `Estándar (${stdVal} g/m²)`,
        data: labels.map(() => stdVal),
        borderColor: 'rgb(34, 197, 94)',
        borderWidth: 2,
        pointRadius: 0,
        fill: false
      })
    }
    if (minVal) {
      datasets.push({
        label: `Límite Mínimo (${minVal.toFixed(1)} g/m² [-5%])`,
        data: labels.map(() => minVal),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      })
    }
    if (maxVal) {
      datasets.push({
        label: `Límite Máximo (${maxVal.toFixed(1)} g/m² [+5%])`,
        data: labels.map(() => maxVal),
        borderColor: 'rgb(239, 68, 68)',
        borderWidth: 2,
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      })
    }
  }

  const calcularRotacion = (numLabels) => {
    const canvasWidth = chartCanvas.value?.clientWidth || 800
    // Fecha corta (dd/mm) requiere ~28px para mostrarse horizontal sin colisionar
    const espacioPorLabel = canvasWidth / Math.max(numLabels, 1)
    if (espacioPorLabel >= 28) {
      return { min: 0, max: 0 }
    } else {
      return { min: 90, max: 90 }
    }
  }

  const dayBandsPlugin = {
    id: 'dayBandsPlugin',
    beforeDraw: (chart) => {
      if (modoVisualizacionGrafico.value !== 'todos') return
      const { ctx, chartArea, scales } = chart
      if (!chartArea || !scales.x) return
      const fuente = datosGraficoDetalle.value || []
      if (fuente.length === 0) return

      const gruposFechas = []
      let fechaActualGroup = null
      let groupStart = 0

      fuente.forEach((item, index) => {
        const fechaItem = String(item.Fecha).split('T')[0]
        if (fechaActualGroup === null) {
          fechaActualGroup = fechaItem
          groupStart = index
        } else if (fechaItem !== fechaActualGroup) {
          gruposFechas.push({ fecha: fechaActualGroup, start: groupStart, end: index - 1 })
          fechaActualGroup = fechaItem
          groupStart = index
        }
      })
      if (fechaActualGroup !== null) {
        gruposFechas.push({ fecha: fechaActualGroup, start: groupStart, end: fuente.length - 1 })
      }

      ctx.save()
      const top = chartArea.top
      const bottom = scales.x ? scales.x.bottom : chartArea.bottom

      let step = 30
      if (fuente.length > 1) {
        const p0 = scales.x.getPixelForValue(0)
        const p1 = scales.x.getPixelForValue(1)
        step = Math.abs(p1 - p0) || 30
      }
      const halfStep = step / 2
      const gap = 2 // 2px a cada lado = 4px de margen transparente entre cajas de días distintos

      gruposFechas.forEach((grupo, idx) => {
        const startPixel = scales.x.getPixelForValue(grupo.start)
        const endPixel = scales.x.getPixelForValue(grupo.end)

        let leftPixel = startPixel - halfStep + gap
        let rightPixel = endPixel + halfStep - gap

        leftPixel = Math.max(leftPixel, chartArea.left)
        rightPixel = Math.min(rightPixel, chartArea.right)
        const width = rightPixel - leftPixel

        if (width > 0) {
          ctx.fillStyle = idx % 2 === 0 ? 'rgba(241, 245, 249, 0.95)' : 'rgba(236, 253, 245, 0.85)'
          ctx.fillRect(leftPixel, top, width, bottom - top)

          ctx.strokeStyle = idx % 2 === 0 ? 'rgba(203, 213, 225, 0.9)' : 'rgba(167, 243, 208, 0.9)'
          ctx.lineWidth = 1.2

          // Borde Izquierdo
          ctx.beginPath()
          ctx.moveTo(leftPixel, top)
          ctx.lineTo(leftPixel, bottom)
          ctx.stroke()

          // Borde Derecho
          ctx.beginPath()
          ctx.moveTo(rightPixel, top)
          ctx.lineTo(rightPixel, bottom)
          ctx.stroke()

          // Etiqueta de cantidad de ensayos en la parte superior de la caja
          const countEnsayos = grupo.end - grupo.start + 1
          const textHeader = `(${countEnsayos})`

          ctx.font = '600 10px sans-serif'
          ctx.fillStyle = idx % 2 === 0 ? '#475569' : '#047857'
          ctx.textAlign = 'center'
          ctx.fillText(textHeader, (leftPixel + rightPixel) / 2, top + 12)
        }
      })
      ctx.restore()
    }
  }

  const rotacion = calcularRotacion(labels.length)

  const ctx = chartCanvas.value.getContext('2d')
  chartInstance = new Chart(ctx, {
    type: 'line',
    plugins: [dayBandsPlugin],
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        datalabels: {
          display: false
        },
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'line',
            padding: 20,
            font: { size: 11, weight: '500' },
            color: '#64748b'
          }
        },
        tooltip: {
          enabled: false,
          external: externalTooltipHandler
        }
      },
      scales: {
        x: {
          ticks: {
            maxRotation: rotacion.max,
            minRotation: rotacion.min,
            autoSkip: true,
            autoSkipPadding: 15,
            maxTicksLimit: rotacion.max === 0 ? 20 : undefined,
            color: '#64748b',
            font: { size: 11 }
          },
          grid: {
            display: false
          }
        },
        y: {
          grid: {
            color: '#e2e8f0',
            borderDash: [3, 3]
          },
          ticks: {
            color: '#64748b',
            font: { size: 11 }
          }
        }
      }
    }
  })
}

const estadoPrioridad = (art) => {
  if (art.encUrdAvg !== null && art.encUrdAvg > -1.0) return 0
  const anchoFuera = art.anchoTestAvg !== null && art.anchoMin !== null && art.anchoMax !== null &&
    (art.anchoTestAvg < art.anchoMin || art.anchoTestAvg > art.anchoMax)
  const pesoFuera = art.pesoTestAvg !== null && art.pesoMin !== null && art.pesoMax !== null &&
    (art.pesoTestAvg < art.pesoMin || art.pesoTestAvg > art.pesoMax)
  if (anchoFuera || pesoFuera) return 1
  if (art.encUrdAvg !== null && art.encUrdAvg > -1.2) return 2
  return 3
}

onMounted(() => { cargarDatos() })
</script>

<style scoped>
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.97); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fade-in {
  animation: fadeIn 0.18s ease-out forwards;
}
</style>
