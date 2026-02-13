<template>
  <div class="w-full h-screen flex flex-col p-1 relative">
    <!-- Overlay de carga para toda la pantalla -->
    <div v-if="cargando" class="fixed inset-0 bg-white/40 backdrop-blur-xs flex items-center justify-center z-9999 transition-all duration-300">
      <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
        <div class="relative">
          <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="h-8 w-8 bg-blue-600 rounded-full animate-pulse opacity-10"></div>
          </div>
        </div>
        <div class="flex flex-col items-center gap-1">
          <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Cargando</span>
          <span class="text-xl text-slate-800 font-bold">Roladas + Fibra HVI</span>
        </div>
      </div>
    </div>
    
    <main ref="mainContentRef" class="w-full flex-1 min-h-0 bg-white rounded-xl shadow-sm px-4 py-3 border border-slate-200/60 flex flex-col relative">
      <!-- Header -->
      <div class="flex items-center justify-between gap-4 shrink-0 mb-3 pb-3 border-b border-slate-100">
        <div class="flex items-center gap-5">
          <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-9 w-auto object-contain opacity-90" />
          <div>
            <h3 class="text-base font-semibold text-slate-800 tracking-tight">Seguimiento de Roladas + Fibra HVI</h3>
            <p class="text-xs text-slate-400 mt-0.5">Producción ÍNDIGO con Análisis de Calidad de Fibra</p>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 rounded-md ml-2">
            <span class="text-xs text-slate-500">Registros:</span>
            <span class="text-sm font-semibold text-slate-700 tabular-nums">{{ datos.length }}</span>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <!-- Date Picker Inicio -->
          <div class="flex items-center gap-1.5">
            <label for="fecha-inicio" class="text-xs font-medium text-slate-500">Desde:</label>
            <input
              type="date"
              id="fecha-inicio"
              v-model="fechaInicio"
              class="px-2.5 py-1.5 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-slate-700"
            />
          </div>
          
          <!-- Date Picker Fin -->
          <div class="flex items-center gap-1.5">
            <label for="fecha-fin" class="text-xs font-medium text-slate-500">Hasta:</label>
            <input
              type="date"
              id="fecha-fin"
              v-model="fechaFin"
              class="px-2.5 py-1.5 border border-slate-200 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white text-slate-700"
            />
          </div>
          
          <!-- Botón Buscar -->
          <button
            @click="cargarDatos"
            :disabled="cargando"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            <svg v-if="!cargando" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <svg v-else class="h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ cargando ? 'Cargando...' : 'Buscar' }}</span>
          </button>
          
          <!-- Botón Excel -->
          <button
            @click="exportarAExcel"
            :disabled="datos.length === 0"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white text-sm font-medium rounded-md transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12.9,14.5L15.8,19H14L12,15.6L10,19H8.2L11.1,14.5L8.2,10H10L12,13.4L14,10H15.8L12.9,14.5Z"/>
            </svg>
            <span>Excel</span>
          </button>
        </div>
      </div>

      <!-- Tabla de datos -->
      <div class="overflow-auto relative bg-white rounded-lg shadow-sm border border-slate-300 flex-1" ref="tablaRef">
        <table ref="tableElementRef" class="w-full text-[11px] text-slate-700 border-separate border-spacing-0">
          <thead class="sticky top-0 z-20">
            <!-- Fila superior - Grupos -->
            <tr class="text-slate-500 text-[10px] uppercase tracking-wider">
              <th scope="col" rowspan="3" class="px-2 py-2 font-semibold text-center border-r-2 border-slate-300 border-b-2 border-b-slate-300 text-slate-700 bg-slate-50 sticky left-0 z-30 min-w-13.75">Rolada</th>
              <th scope="col" colspan="3" class="px-2 py-1.5 font-semibold text-center border-r-2 border-slate-300 border-b border-b-slate-300 text-slate-700 bg-slate-50">Urdidora</th>
              <th scope="col" colspan="8" class="px-2 py-1.5 font-semibold text-center border-r-2 border-slate-300 border-b border-b-slate-300 text-slate-700 bg-slate-50">Índigo</th>
              <th scope="col" colspan="4" class="px-2 py-1.5 font-semibold text-center border-r-2 border-slate-300 border-b border-b-slate-300 text-slate-700 bg-slate-50">Tejeduría</th>
              <th scope="col" colspan="3" class="px-2 py-1.5 font-semibold text-center border-r-2 border-slate-300 border-b border-b-slate-300 text-slate-700 bg-slate-50">Calidad</th>
              <th scope="col" colspan="63" class="px-2 py-1.5 font-semibold text-center border-b border-b-slate-300 text-slate-700 bg-amber-50">Fibra HVI</th>
            </tr>
            <!-- Fila media - Columnas y Variables -->
            <tr class="text-slate-600 text-[10px] bg-slate-50">
              <!-- Urdidora -->
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-10">Maq</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75">Lote</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r-2 border-slate-300 border-b-2 border-b-slate-300 min-w-10">R10⁶</th>
              <!-- Índigo -->
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-17.5">Fecha</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-18.75">Base</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75">Color</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-12.5">Metros</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75">R10³</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-7.5"><span class="block leading-tight">Cav<br>10⁵</span></th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75">VNom</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r-2 border-slate-300 border-b-2 border-b-slate-300 min-w-8.75">VPro</th>
              <!-- Tejeduría -->
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-12.5">Metros</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-10">Efi%</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-10">RU10⁵</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r-2 border-slate-300 border-b-2 border-b-slate-300 min-w-10">RT10⁵</th>
              <!-- Calidad -->
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-12.5">Metros</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-10">Cal%</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r-2 border-slate-300 border-b-2 border-b-slate-300 min-w-12.5">Pts100</th>
              <!-- Fibra HVI -->
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-10 bg-amber-50">Mezc</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-17.5 bg-amber-50">F.Ingr</th>
              
              <!-- Variables HVI (Stats expandidos) -->
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-blue-50" title="Índice de Color">SCI</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-blue-50" title="Humedad">MST</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-blue-50" title="Micronaire">MIC</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-blue-50" title="Madurez">MAT</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-green-50" title="Longitud media">UHML</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-green-50" title="Uniformidad">UI</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-green-50" title="Fibras cortas">SF</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-yellow-50" title="Resistencia">STR</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-yellow-50" title="Elongación">ELG</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-yellow-50" title="Reflectancia">RD</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-yellow-50" title="Amarillez">+b</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-purple-50">TrCNT</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r border-r-slate-200 border-b border-b-slate-300 bg-purple-50">TrAR</th>
              <th scope="col" colspan="4" class="px-1 py-1.5 font-medium text-center border-r-2 border-b border-slate-300 bg-purple-50">TRID</th>
              
              <!-- Colores (Sin stats) -->
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75 bg-orange-50">BCO</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75 bg-orange-50">GRI</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75 bg-orange-50">LG</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-r border-slate-200 border-b-2 border-b-slate-300 min-w-8.75 bg-orange-50">AMA</th>
              <th scope="col" rowspan="2" class="px-1 py-1.5 font-medium text-center border-b-2 border-b-slate-300 min-w-8.75 bg-orange-50">LA</th>
            </tr>
            <!-- Fila inferior - Subcolumnas Stats -->
            <tr class="text-slate-600 text-[9px] bg-slate-50">
              <!-- SCI -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">σ</th>
              <!-- MST -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">σ</th>
              <!-- MIC -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">σ</th>
              <!-- MAT -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-blue-50/50">σ</th>
              <!-- UHML -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">σ</th>
              <!-- UI -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">σ</th>
              <!-- SF -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-green-50/50">σ</th>
              <!-- STR -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">σ</th>
              <!-- ELG -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">σ</th>
              <!-- RD -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">σ</th>
              <!-- +b -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-yellow-50/50">σ</th>
              <!-- TrCNT -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">σ</th>
              <!-- TrAR -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">σ</th>
              <!-- TRID -->
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Avg</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Min</th>
              <th class="px-1 py-1 font-normal text-center border-r border-slate-200 border-b-2 border-b-slate-300 bg-purple-50/50">Max</th>
              <th class="px-1 py-1 font-normal text-center border-r-2 border-slate-300 border-b-2 border-b-slate-300 bg-purple-50/50">σ</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in datos" :key="item.ROLADA" 
                class="border-b border-slate-200 hover:bg-slate-50/80 transition-colors">
              <!-- Rolada (sticky) -->
              <td class="px-2 py-2 font-semibold text-slate-800 text-center tabular-nums border-r-2 border-slate-300 bg-slate-50/50 sticky left-0 z-10">{{ item.ROLADA }}</td>
              <!-- Urdidora -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ item.MAQ_OE || '-' }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ item.LOTE || '-' }}</td>
              <td class="px-1 py-2 text-center text-emerald-600 font-semibold tabular-nums border-r-2 border-slate-300">{{ calcularRot106(item.URDIDORA_ROTURAS, item.URDIDORA_METROS, item.NUM_FIOS) }}</td>
              <!-- Índigo -->
              <td class="px-1 py-2 text-center text-slate-500 text-xs border-r border-slate-200">{{ item.FECHA || '-' }}</td>
              <td class="px-1 py-2 text-center text-slate-700 border-r border-slate-200 text-xs">{{ item.BASE || '-' }}</td>
              <td class="px-1 py-2 text-center text-slate-600 border-r border-slate-200">{{ item.COLOR || '-' }}</td>
              <td class="px-1 py-2 text-center text-slate-700 font-medium tabular-nums border-r border-slate-200">{{ formatMetros(item.MTS_IND) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ formatNumber(item.R103, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ calcularCav105(item.CAV, item.MTS_IND) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ formatNumber(item.VEL_NOM, 0) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r-2 border-slate-300">{{ formatNumber(item.VEL_PROM, 0) }}</td>
              <!-- Tejeduría -->
              <td class="px-1 py-2 text-center text-slate-700 font-medium tabular-nums border-r border-slate-200">{{ formatMetros(item.MTS_CRUDOS) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ formatNumber(item.EFI_TEJ, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ formatNumber(item.RU105, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r-2 border-slate-300">{{ formatNumber(item.RT105, 1) }}</td>
              <!-- Calidad -->
              <td class="px-1 py-2 text-center text-slate-700 font-medium tabular-nums border-r border-slate-200">{{ formatMetros(item.MTS_CAL) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200">{{ formatNumber(item.CAL_PERCENT, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r-2 border-slate-300">{{ formatNumber(item.PTS_100M2, 1) }}</td>
              <!-- Fibra HVI -->
              <td 
                @click="abrirModalMistura(item.MISTURA, item.LOTE)" 
                class="px-1 py-2 text-center text-amber-700 font-semibold tabular-nums border-r border-slate-200 bg-amber-50/30 cursor-pointer hover:bg-amber-100/50 transition-colors"
                :title="'Click para ver detalles de MISTURA ' + item.MISTURA"
              >
                {{ item.MISTURA || '-' }}
              </td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-amber-50/30 text-xs">{{ formatFechaIngreso(item.FECHA_INGRESO) }}</td>
              <!-- SCI -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30">{{ formatNumber(item.SCI, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.SCI_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.SCI_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30 text-[9px] font-medium">{{ formatNumber(item.SCI_SIGMA, 2) }}</td>
              <!-- MST -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30">{{ formatNumber(item.MST, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.MST_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.MST_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30 text-[9px] font-medium">{{ formatNumber(item.MST_SIGMA, 2) }}</td>
              <!-- MIC -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30">{{ formatNumber(item.MIC, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.MIC_MIN, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.MIC_MAX, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30 text-[9px] font-medium">{{ formatNumber(item.MIC_SIGMA, 2) }}</td>
              <!-- MAT -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30">{{ formatNumber(item.MAT, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.MAT_MIN, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-blue-50/20 text-[9px]">{{ formatNumber(item.MAT_MAX, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-blue-50/30 text-[9px] font-medium">{{ formatNumber(item.MAT_SIGMA, 2) }}</td>
              <!-- UHML -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-green-50/30">{{ formatNumber(item.UHML, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-green-50/20 text-[9px]">{{ formatNumber(item.UHML_MIN, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-green-50/20 text-[9px]">{{ formatNumber(item.UHML_MAX, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-green-50/30 text-[9px] font-medium">{{ formatNumber(item.UHML_SIGMA, 2) }}</td>
              <!-- UI -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-green-50/30">{{ formatNumber(item.UI, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-green-50/20 text-[9px]">{{ formatNumber(item.UI_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-green-50/20 text-[9px]">{{ formatNumber(item.UI_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-green-50/30 text-[9px] font-medium">{{ formatNumber(item.UI_SIGMA, 2) }}</td>
              <!-- SF -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-green-50/30">{{ formatNumber(item.SF, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-green-50/20 text-[9px]">{{ formatNumber(item.SF_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-green-50/20 text-[9px]">{{ formatNumber(item.SF_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-green-50/30 text-[9px] font-medium">{{ formatNumber(item.SF_SIGMA, 2) }}</td>
              <!-- STR -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30">{{ formatNumber(item.STR, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.STR_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.STR_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30 text-[9px] font-medium">{{ formatNumber(item.STR_SIGMA, 2) }}</td>
              <!-- ELG -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30">{{ formatNumber(item.ELG, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.ELG_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.ELG_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30 text-[9px] font-medium">{{ formatNumber(item.ELG_SIGMA, 2) }}</td>
              <!-- RD -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30">{{ formatNumber(item.RD, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.RD_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.RD_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30 text-[9px] font-medium">{{ formatNumber(item.RD_SIGMA, 2) }}</td>
              <!-- PLUS_B -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30">{{ formatNumber(item.PLUS_B, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.PLUS_B_MIN, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-yellow-50/20 text-[9px]">{{ formatNumber(item.PLUS_B_MAX, 1) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-yellow-50/30 text-[9px] font-medium">{{ formatNumber(item.PLUS_B_SIGMA, 2) }}</td>
              <!-- TrCNT -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-purple-50/30">{{ formatNumber(item.TrCNT, 0) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-purple-50/20 text-[9px]">{{ formatNumber(item.TrCNT_MIN, 0) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-purple-50/20 text-[9px]">{{ formatNumber(item.TrCNT_MAX, 0) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-purple-50/30 text-[9px] font-medium">{{ formatNumber(item.TrCNT_SIGMA, 2) }}</td>
              <!-- TrAR -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-purple-50/30">{{ formatNumber(item.TrAR, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-purple-50/20 text-[9px]">{{ formatNumber(item.TrAR_MIN, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-purple-50/20 text-[9px]">{{ formatNumber(item.TrAR_MAX, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-purple-50/30 text-[9px] font-medium">{{ formatNumber(item.TrAR_SIGMA, 2) }}</td>
              <!-- TRID -->
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-purple-50/30">{{ formatNumber(item.TRID, 0) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-purple-50/20 text-[9px]">{{ formatNumber(item.TRID_MIN, 0) }}</td>
              <td class="px-1 py-2 text-center text-slate-500 tabular-nums border-r border-slate-200 bg-purple-50/20 text-[9px]">{{ formatNumber(item.TRID_MAX, 0) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r-2 border-slate-300 bg-purple-50/30 text-[9px] font-medium">{{ formatNumber(item.TRID_SIGMA, 2) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-orange-50/30">{{ formatPercent(item.COLOR_BCO_PCT) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-orange-50/30">{{ formatPercent(item.COLOR_GRI_PCT) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-orange-50/30">{{ formatPercent(item.COLOR_LG_PCT) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums border-r border-slate-200 bg-orange-50/30">{{ formatPercent(item.COLOR_AMA_PCT) }}</td>
              <td class="px-1 py-2 text-center text-slate-600 tabular-nums bg-orange-50/30">{{ formatPercent(item.COLOR_LA_PCT) }}</td>
            </tr>
          </tbody>
          <!-- Fila de totales -->
          <tfoot v-if="totalesMes && datos.length > 0" class="sticky bottom-0 z-20 bg-slate-100">
            <tr class="font-semibold text-slate-700">
              <td class="px-2 py-2.5 text-center border-r-2 border-slate-300 border-t-2 border-t-slate-300 sticky left-0 bg-slate-100 z-10">
                <span class="text-xs uppercase tracking-wide text-slate-500">Total:</span>
                <span class="ml-1 text-slate-700">{{ totalesMes.TOTAL_ROLADAS }}</span>
              </td>
              <!-- Urdidora -->
              <td class="px-1 py-2.5 text-center text-slate-400 border-r border-slate-200 border-t-2 border-t-slate-300" colspan="2">-</td>
              <td class="px-1 py-2.5 text-center text-emerald-600 font-semibold tabular-nums border-r-2 border-slate-300 border-t-2 border-t-slate-300">{{ calcularRot106(totalesMes.URDIDORA_ROTURAS, totalesMes.URDIDORA_METROS, totalesMes.NUM_FIOS) }}</td>
              <!-- Índigo -->
              <td class="px-1 py-2.5 text-center text-slate-400 border-r border-slate-200 border-t-2 border-t-slate-300" colspan="3">-</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.MTS_IND, 0) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.R103, 2) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ calcularCav105(totalesMes.CAV, totalesMes.MTS_IND) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums text-slate-400 border-r border-slate-200 border-t-2 border-t-slate-300">-</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r-2 border-slate-300 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.VEL_PROM, 0) }}</td>
              <!-- Tejeduría -->
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.MTS_CRUDOS, 0) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.EFI_TEJ, 1) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.RU105, 1) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r-2 border-slate-300 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.RT105, 1) }}</td>
              <!-- Calidad -->
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.MTS_CAL, 0) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r border-slate-200 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.CAL_PERCENT, 1) }}</td>
              <td class="px-1 py-2.5 text-center tabular-nums border-r-2 border-slate-300 border-t-2 border-t-slate-300">{{ formatNumber(totalesMes.PTS_100M2, 1) }}</td>
              <!-- Fibra HVI - Promedios no aplican para totales -->
              <td class="px-1 py-2.5 text-center text-slate-400 border-t-2 border-t-slate-300 bg-amber-50/20" colspan="63">-</td>
            </tr>
          </tfoot>
        </table>
        
        <div v-if="!cargando && datos.length === 0" class="flex items-center justify-center h-64 bg-white">
          <div class="text-center">
            <svg class="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="mt-3 text-sm font-medium text-slate-700">No hay datos disponibles</h3>
            <p class="mt-1 text-xs text-slate-400">Seleccione un rango de fechas y haga clic en Buscar</p>
          </div>
        </div>
      </div>
    </main>
    
    <!-- Modal de detalles de MISTURA -->
    <div v-if="showModalMistura" class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2">
      <div class="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col">
        <!-- Header del modal -->
        <div class="flex items-center justify-between px-6 py-2 border-b border-slate-200 shrink-0">
          <div class="flex items-center gap-4">
            <h3 class="text-lg font-semibold text-slate-800">Detalle de MISTURA</h3>
            <div class="px-3 py-1 bg-blue-100 rounded-lg">
              <span class="text-sm font-mono font-semibold text-blue-700">{{ misturaSeleccionada }}</span>
            </div>
            <div v-if="loteFiacSeleccionado" class="px-3 py-1 bg-slate-100 rounded-lg">
              <span class="text-xs text-slate-500 mr-1">Lote:</span>
              <span class="text-sm font-mono font-semibold text-slate-700">{{ loteFiacSeleccionado }}</span>
            </div>
            <div class="text-xs text-slate-400">
              {{ indiceMistura + 1 }} de {{ listaMisturas.length }}
            </div>
          </div>
          
          <div class="flex items-center gap-2">
            <!-- Navegación -->
            <button
              @click="navegarMisturaAnterior"
              :disabled="indiceMistura === 0"
              :class="[
                'px-3 py-1.5 rounded-lg transition-all text-sm font-medium',
                indiceMistura === 0
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              ]"
            >
              ◄ Anterior
            </button>
            <button
              @click="navegarMisturaSiguiente"
              :disabled="indiceMistura === listaMisturas.length - 1"
              :class="[
                'px-3 py-1.5 rounded-lg transition-all text-sm font-medium',
                indiceMistura === listaMisturas.length - 1
                  ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              ]"
            >
              Siguiente ►
            </button>
            
            <!-- Botón cerrar -->
            <button
              @click="cerrarModalMistura"
              class="ml-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all text-sm font-medium"
            >
              ✕ Cerrar
            </button>
          </div>
        </div>
        
        <!-- Contenido del modal -->
        <div class="flex-1 overflow-auto p-2">
          <div v-if="!datosMistura" class="flex items-center justify-center h-64">
            <div class="flex flex-col items-center gap-3">
              <div class="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 border-t-slate-600"></div>
              <span class="text-sm text-slate-500">Cargando datos...</span>
            </div>
          </div>
          
          <div v-else-if="datosMistura && datosMistura.seqs && datosMistura.seqs.length > 0">
            <!-- Tabla cruzada: Variables en filas, SEQ en columnas -->
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-sm">
                <thead>
                  <tr class="bg-slate-100">
                    <th class="px-3 py-1 text-left font-semibold text-slate-700 border border-slate-300 sticky left-0 bg-slate-100 z-10">Variable</th>
                    <th 
                      v-for="seq in seqsOrdenados" 
                      :key="seq.SEQ"
                      class="px-2 py-1 text-center font-semibold text-slate-700 border border-slate-300 min-w-10"
                    >
                      {{ quitarCeros(seq.SEQ) }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <!-- Fecha y hora de entrada -->
                  <tr class="hover:bg-slate-50">
                    <td class="px-3 py-1 font-medium text-slate-700 border border-slate-300 sticky left-0 bg-white">Fecha</td>
                    <td 
                      v-for="seq in seqsOrdenados" 
                      :key="seq.SEQ"
                      class="px-1 py-2 border border-slate-300"
                    >
                      <div class="flex justify-center items-center h-full">
                        <div class="text-xs text-slate-600" style="writing-mode: vertical-rl; transform: rotate(180deg); white-space: nowrap;">
                          {{ formatearFecha(seq.DT_ENTRADA_PROD) }}
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr class="hover:bg-slate-50">
                    <td class="px-3 py-1 font-medium text-slate-700 border border-slate-300 sticky left-0 bg-white">Hora</td>
                    <td 
                      v-for="seq in seqsOrdenados" 
                      :key="seq.SEQ"
                      class="px-2 py-1 text-center border border-slate-300 text-slate-600 text-xs"
                    >
                      {{ seq.HR_ENTRADA_PROD || '-' }}
                    </td>
                  </tr>
                  
                  <!-- Separador -->
                  <tr class="bg-slate-50">
                    <td colspan="100" class="px-3 py-1 text-xs font-semibold text-slate-500 border border-slate-300">Promedios Ponderados HVI</td>
                  </tr>
                  
                  <!-- Variables HVI con promedios ponderados -->
                  <tr v-for="variable in ['SCI', 'MST', 'MIC', 'MAT', 'UHML', 'UI', 'SF', 'STR', 'ELG', 'RD', '+b', 'TrCNT', 'TrAR', 'TRID']" :key="variable" class="hover:bg-slate-50">
                    <td 
                      class="px-3 py-1 font-medium text-slate-700 border border-slate-300 sticky left-0 bg-white cursor-help transition-colors hover:bg-blue-50"
                      @mouseenter="mostrarGraficoVariable(variable, $event)"
                      @mouseleave="ocultarGraficoVariable"
                    >
                      {{ variable }}
                    </td>
                    <td 
                      v-for="seq in seqsOrdenados" 
                      :key="seq.SEQ"
                      class="px-2 py-1 text-center border border-slate-300 tabular-nums text-slate-600 text-xs"
                    >
                      {{ seq[variable === '+b' ? 'PLUS_B' : variable] !== null && seq[variable === '+b' ? 'PLUS_B' : variable] !== undefined ? Number(seq[variable === '+b' ? 'PLUS_B' : variable]).toFixed(2) : '-' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div v-else class="flex items-center justify-center h-64">
            <div class="text-center">
              <p class="text-slate-500">No hay datos disponibles para esta MISTURA</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Popover con gráfico de variable -->
    <div 
      v-if="hoveredVariable && datosGraficoVariable.length > 0"
      class="fixed bg-white rounded-lg shadow-2xl border border-slate-300 p-4 z-60 pointer-events-none"
      :style="{
        left: hoverPosition.x + 'px',
        top: hoverPosition.y + 'px',
        width: '760px'
      }"
    >
      <!-- Título -->
      <div class="mb-3 pb-2 border-b border-slate-200">
        <h4 class="text-sm font-semibold text-slate-700">{{ hoveredVariable }} - MISTURA {{ misturaSeleccionada }}</h4>
      </div>
      
      <!-- Gráfico de línea y puntos (SVG) -->
      <div class="relative">
        <svg width="100%" height="160" class="overflow-visible">
          <!-- Eje Y (valores) -->
          <line x1="30" y1="10" x2="30" y2="130" stroke="#cbd5e1" stroke-width="1.5"/>
          <!-- Eje X (SEQ) -->
          <line x1="30" y1="130" x2="730" y2="130" stroke="#cbd5e1" stroke-width="1.5"/>
          
          <!-- Etiquetas eje Y -->
          <text x="25" y="15" text-anchor="end" class="text-[10px] fill-slate-600">{{ rangoGrafico.max.toFixed(1) }}</text>
          <text x="25" y="72" text-anchor="end" class="text-[10px] fill-slate-600">{{ ((rangoGrafico.max + rangoGrafico.min) / 2).toFixed(1) }}</text>
          <text x="25" y="133" text-anchor="end" class="text-[10px] fill-slate-600">{{ rangoGrafico.min.toFixed(1) }}</text>
          
          <!-- Líneas guía horizontales -->
          <line x1="30" y1="70" x2="730" y2="70" stroke="#e2e8f0" stroke-width="1" stroke-dasharray="3,3"/>
          
          <!-- Línea conectando puntos -->
          <polyline
            :points="datosGraficoVariable.map((dato, idx) => {
              const x = 40 + (idx * (690 / (datosGraficoVariable.length - 1 || 1)))
              const y = 130 - ((dato.valor - rangoGrafico.min) / (rangoGrafico.max - rangoGrafico.min) * 120)
              return x + ',' + y
            }).join(' ')"
            fill="none"
            stroke="#3b82f6"
            stroke-width="2.5"
            class="transition-all duration-300"
          />
          
          <!-- Puntos y etiquetas SEQ -->
          <g v-for="(dato, idx) in datosGraficoVariable" :key="dato.seq">
            <!-- Punto -->
            <circle
              :cx="40 + (idx * (690 / (datosGraficoVariable.length - 1 || 1)))"
              :cy="130 - ((dato.valor - rangoGrafico.min) / (rangoGrafico.max - rangoGrafico.min) * 120)"
              r="4"
              fill="#3b82f6"
              stroke="white"
              stroke-width="2"
              class="transition-all duration-300"
            />
            <!-- Etiqueta SEQ debajo del eje X -->
            <text
              :x="40 + (idx * (690 / (datosGraficoVariable.length - 1 || 1)))"
              y="145"
              text-anchor="middle"
              class="text-[10px] fill-slate-600 font-medium"
            >{{ dato.seq }}</text>
            <!-- Valor sobre el punto -->
            <text
              :x="40 + (idx * (690 / (datosGraficoVariable.length - 1 || 1)))"
              :y="130 - ((dato.valor - rangoGrafico.min) / (rangoGrafico.max - rangoGrafico.min) * 120) - 8"
              text-anchor="middle"
              class="text-[9px] fill-slate-700 font-mono font-semibold"
            >{{ Number(dato.valor).toFixed(2) }}</text>
          </g>
        </svg>
      </div>
      
      <!-- Estadísticas rápidas -->
      <div class="mt-2 pt-2 border-t border-slate-200 flex justify-between text-xs text-slate-600">
        <span>Mín: <strong>{{ Math.min(...datosGraficoVariable.map(d => d.valor)).toFixed(2) }}</strong></span>
        <span>Prom Ponderado: <strong>{{ promedioTotalVariable !== null ? Number(promedioTotalVariable).toFixed(2) : '-' }}</strong></span>
        <span>Máx: <strong>{{ Math.max(...datosGraficoVariable.map(d => d.valor)).toFixed(2) }}</strong></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import * as ExcelJS from 'exceljs'

// Estados
const cargando = ref(false)
const datos = ref([])
const totalesMes = ref(null)
const hviEstadisticas = ref({}) // Estadísticas HVI por mezcla desde datos crudos
const fechaInicio = ref('')
const fechaFin = ref('')

// Estados del modal de MISTURA
const showModalMistura = ref(false)
const misturaSeleccionada = ref(null)
const loteFiacSeleccionado = ref(null)
const indiceMistura = ref(0)
const datosMistura = ref(null) // Datos detallados de la mistura con promedios ponderados

// Estado para popover de gráfico
const hoveredVariable = ref(null)
const hoverPosition = ref({ x: 0, y: 0 })

// Lista de misturas únicas del período para navegación
const listaMisturas = computed(() => {
  const misturas = new Set()
  datos.value.forEach(d => {
    if (d.MISTURA) {
      // Manejar mezclas múltiples (ej: "144,147")
      const mezclasSplit = String(d.MISTURA).split(',').map(m => m.trim())
      mezclasSplit.forEach(m => misturas.add(m))
    }
  })
  return Array.from(misturas).sort((a, b) => a.localeCompare(b))
})

// Refs
const mainContentRef = ref(null)
const tablaRef = ref(null)
const tableElementRef = ref(null)

// Configuración del API
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

// Funciones de formato
const formatNumber = (value, decimals = 0) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = parseFloat(value)
  if (isNaN(num)) return '-'
  return num.toLocaleString('es-ES', { 
    minimumFractionDigits: decimals, 
    maximumFractionDigits: decimals 
  })
}

// Función específica para formatear metros con separador de miles europeo (punto) desde 1.000
const formatMetros = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = parseFloat(value)
  if (isNaN(num)) return '-'
  // Usar formato europeo: punto como separador de miles
  if (num >= 1000) {
    return num.toLocaleString('de-DE', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    })
  }
  return Math.round(num).toString()
}

const formatPercent = (value) => {
  if (value === null || value === undefined || value === '') return '-'
  const num = parseFloat(value)
  if (isNaN(num)) return '-'
  if (num === 0) return '-'
  return num.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const formatFechaIngreso = (fecha) => {
  if (!fecha) return '-'
  // La fecha viene en formato DD/MM/YYYY del CSV
  return fecha
}

const calcularRot106 = (roturas, metros, numFios) => {
  if (!roturas || !metros || !numFios) return '-'
  const rot = parseFloat(roturas)
  const mts = parseFloat(metros)
  const fios = parseFloat(numFios)
  if (isNaN(rot) || isNaN(mts) || isNaN(fios) || mts === 0 || fios === 0) return '-'
  const result = (rot * 1000000) / (mts * fios)
  return result.toFixed(2).replace('.', ',')
}

// Versión numérica para Excel (sin formato string)
const calcularRot106Num = (roturas, metros, numFios) => {
  if (!roturas || !metros || !numFios) return null
  const rot = parseFloat(roturas)
  const mts = parseFloat(metros)
  const fios = parseFloat(numFios)
  if (isNaN(rot) || isNaN(mts) || isNaN(fios) || mts === 0 || fios === 0) return null
  return (rot * 1000000) / (mts * fios)
}

const calcularCav105 = (cav, metros) => {
  if (!cav || !metros) return '-'
  const c = parseFloat(cav)
  const m = parseFloat(metros)
  if (isNaN(c) || isNaN(m) || m === 0) return '-'
  const result = (c * 100000) / m
  return result.toFixed(1).replace('.', ',')
}

// Versión numérica para Excel (sin formato string)
const calcularCav105Num = (cav, metros) => {
  if (!cav || !metros) return null
  const c = parseFloat(cav)
  const m = parseFloat(metros)
  if (isNaN(c) || isNaN(m) || m === 0) return null
  return (c * 100000) / m
}

// Cargar datos desde API
const cargarDatos = async () => {
  if (!fechaInicio.value || !fechaFin.value) {
    alert('Seleccione fecha de inicio y fin')
    return
  }
  
  cargando.value = true
  
  try {
    // Cargar datos de roladas
    const urlRoladas = `${API_URL}/seguimiento-roladas-fibra?fechaInicio=${fechaInicio.value}&fechaFin=${fechaFin.value}`
    const responseRoladas = await fetch(urlRoladas)
    
    if (!responseRoladas.ok) {
      throw new Error(`Error: ${responseRoladas.status}`)
    }
    
    const resultRoladas = await responseRoladas.json()
    datos.value = resultRoladas.datos || []
    totalesMes.value = resultRoladas.totales || null
    
    // Cargar estadísticas HVI por mezcla (datos crudos)
    const urlEstadisticas = `${API_URL}/hvi-estadisticas-mezcla?fechaInicio=${fechaInicio.value}&fechaFin=${fechaFin.value}`
    const responseEstadisticas = await fetch(urlEstadisticas)
    
    if (responseEstadisticas.ok) {
      const resultEstadisticas = await responseEstadisticas.json()
      hviEstadisticas.value = resultEstadisticas.stats || {}
      console.log('📊 Estadísticas HVI cargadas:', Object.keys(hviEstadisticas.value).length, 'mezclas')
    } else {
      console.warn('⚠️ No se pudieron cargar estadísticas HVI')
      hviEstadisticas.value = {}
    }
    
  } catch (error) {
    console.error('Error cargando datos:', error)
    alert('Error al cargar datos: ' + error.message)
  } finally {
    cargando.value = false
  }
}

// Computed para SEQs ordenados
const seqsOrdenados = computed(() => {
  if (!datosMistura.value?.seqs) return []
  return [...datosMistura.value.seqs].sort((a, b) => {
    const numA = parseInt(a.SEQ) || 0
    const numB = parseInt(b.SEQ) || 0
    return numA - numB
  })
})

// Helper para quitar ceros adelante
const quitarCeros = (valor) => {
  if (!valor) return ''
  return String(valor).replace(/^0+/, '') || '0'
}

// Helper para formatear fecha a dd/mm/yy
const formatearFecha = (fecha) => {
  if (!fecha) return '-'
  // Asume formato DD/MM/YYYY o similar
  const partes = fecha.split('/')
  if (partes.length === 3) {
    const dia = partes[0].padStart(2, '0')
    const mes = partes[1].padStart(2, '0')
    const anio = partes[2].slice(-2) // Últimos 2 dígitos del año
    return `${dia}/${mes}/${anio}`
  }
  return fecha
}

// Cargar datos detallados de una MISTURA con promedios ponderados por PESO
const cargarDatosMistura = async (mistura) => {
  if (!mistura) return
  
  try {
    const url = `${API_URL}/calidad-fibra-mistura?mistura=${mistura}`
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`)
    }
    
    const result = await response.json()
    datosMistura.value = result
    console.log('🔬 Datos de MISTURA cargados:', mistura, result)
    
  } catch (error) {
    console.error('Error cargando datos de mistura:', error)
    alert('Error al cargar datos de mistura: ' + error.message)
    datosMistura.value = null
  }
}

// Funciones de navegación del modal de MISTURA
const abrirModalMistura = async (mistura, loteFiac = null) => {
  if (!mistura) {
    console.warn('⚠️ No se puede abrir modal: mistura vacía')
    return
  }
  
  // Si hay múltiples misturas separadas por coma, tomar solo la primera
  const misturaAMostrar = String(mistura).split(',')[0].trim()
  
  console.log('🔍 Abriendo modal para MISTURA:', misturaAMostrar)
  console.log('📋 Lista de misturas disponibles:', listaMisturas.value)
  console.log('📦 LOTE_FIAC:', loteFiac)
  
  const indice = listaMisturas.value.indexOf(misturaAMostrar)
  if (indice === -1) {
    console.warn('⚠️ MISTURA no encontrada en lista:', misturaAMostrar)
    return
  }
  
  indiceMistura.value = indice
  misturaSeleccionada.value = misturaAMostrar
  loteFiacSeleccionado.value = loteFiac
  showModalMistura.value = true
  
  console.log('✅ Modal abierto, cargando datos...')
  await cargarDatosMistura(misturaAMostrar)
}

const navegarMisturaAnterior = async () => {
  if (indiceMistura.value > 0) {
    indiceMistura.value--
    misturaSeleccionada.value = listaMisturas.value[indiceMistura.value]
    await cargarDatosMistura(misturaSeleccionada.value)
  }
}

const navegarMisturaSiguiente = async () => {
  if (indiceMistura.value < listaMisturas.value.length - 1) {
    indiceMistura.value++
    misturaSeleccionada.value = listaMisturas.value[indiceMistura.value]
    await cargarDatosMistura(misturaSeleccionada.value)
  }
}

const cerrarModalMistura = () => {
  showModalMistura.value = false
  misturaSeleccionada.value = null
  loteFiacSeleccionado.value = null
  datosMistura.value = null
}

// Funciones para el popover de gráfico
const mostrarGraficoVariable = (variable, event) => {
  hoveredVariable.value = variable
  const rect = event.target.getBoundingClientRect()
  
  // Dimensiones del popover
  const popoverWidth = 760
  const popoverHeight = 240 // Aproximado
  
  // Dimensiones de la ventana
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight
  
  // Calcular posición X (horizontal)
  let x = rect.right + 10
  // Si se sale por la derecha, posicionar a la izquierda
  if (x + popoverWidth > windowWidth) {
    x = rect.left - popoverWidth - 10
    // Si también se sale por la izquierda, centrarlo en la pantalla
    if (x < 0) {
      x = (windowWidth - popoverWidth) / 2
    }
  }
  
  // Calcular posición Y (vertical)
  let y = rect.top
  // Si se sale por abajo, ajustar para que quede visible
  if (y + popoverHeight > windowHeight) {
    y = windowHeight - popoverHeight - 10
    // Si se sale por arriba, ajustar
    if (y < 10) {
      y = 10
    }
  }
  
  hoverPosition.value = { x, y }
}

const ocultarGraficoVariable = () => {
  hoveredVariable.value = null
}

const datosGraficoVariable = computed(() => {
  if (!hoveredVariable.value || !datosMistura.value?.seqs) return []
  
  const variable = hoveredVariable.value
  const columnName = variable === '+b' ? 'PLUS_B' : variable
  
  const datos = seqsOrdenados.value.map(seq => {
    const valorOriginal = parseFloat(seq[columnName])
    // Redondear a 2 decimales para que coincida con la visualización de la tabla
    const valorRedondeado = Math.round(valorOriginal * 100) / 100
    return {
      seq: quitarCeros(seq.SEQ),
      valor: valorRedondeado
    }
  }).filter(item => !isNaN(item.valor) && item.valor !== null && item.valor !== undefined)
  
  return datos
})

const rangoGrafico = computed(() => {
  if (datosGraficoVariable.value.length === 0) return { min: 0, max: 100 }
  const valores = datosGraficoVariable.value.map(d => d.valor)
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  let rango = max - min
  
  // Si todos los valores son iguales, usar un rango mínimo del 10% del valor
  if (rango === 0) {
    const valorBase = min !== 0 ? Math.abs(min) * 0.1 : 1
    return {
      min: min - valorBase,
      max: max + valorBase
    }
  }
  
  return {
    min: min - rango * 0.1,
    max: max + rango * 0.1
  }
})

const promedioTotalVariable = computed(() => {
  if (!hoveredVariable.value || !datosMistura.value?.totales) return null
  const variable = hoveredVariable.value
  const columnName = variable === '+b' ? 'PLUS_B' : variable
  return datosMistura.value.totales[columnName]
})

// Exportar a Excel con formato profesional
const exportarAExcel = async () => {
  if (datos.value.length === 0) return
  
  // Mostrar indicador de que se está procesando
  cargando.value = true
  
  try {
    // Usar setTimeout para dar tiempo al navegador de actualizar la UI
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Roladas + Fibra HVI')
    
    // Configurar orientación y márgenes
    worksheet.pageSetup = {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.1968,
        right: 0.1968,
        top: 0.3937,
        bottom: 0.3937,
        header: 0.1968,
        footer: 0.1968
      }
    }
    
    // Crear filas de encabezado
    // Fila 1: Grupos
    worksheet.addRow([
      'Rolada', 
      'URDIDORA', '', '', 
      'ÍNDIGO', '', '', '', '', '', '', '', 
      'TEJEDURÍA', '', '', '', 
      'CALIDAD', '', '',
      'FIBRA HVI', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
      '', '', '', ''
    ])
    
    // Los datos empezarán desde la fila 6 (después de MAX, PROM, MIN y encabezados)
    const numDatos = datos.value.length
    const filaInicio = 6
    const filaFin = filaInicio + numDatos - 1
    
    // Mapeo de columnas que tendrán fórmula SUBTOTAL (columnas de valor medio)
    const columnasPromedio = {
      4: 'D',   // Rot 10⁶
      8: 'H',   // TOTAL_MINUTOS_URDIDORA
      9: 'I',   // R10³
      10: 'J',  // Cav 10⁵
      11: 'K',  // Vel.Nom
      12: 'L',  // Vel.Prom
      13: 'M',  // TOTAL_MINUTOS_INDIGO
      14: 'N',  // Efic.%
      15: 'O',  // RU10⁵
      16: 'P',  // RT10⁵
      17: 'Q',  // TOTAL_MINUTOS_TEJEDURIA
      18: 'R',  // Cal.%
      19: 'S',  // Pts/100m²
      22: 'V',  // SCI
      26: 'Z',  // MST
      30: 'AD', // MIC
      34: 'AH', // MAT
      38: 'AL', // UHML
      42: 'AP', // UI
      46: 'AT', // SF
      50: 'AX', // STR
      54: 'BB', // ELG
      58: 'BF', // RD
      62: 'BJ', // +b
      66: 'BN', // TrCNT
      70: 'BR', // TrAR
      74: 'BV'  // TRID
    }
    
    // Columnas MIN (SUBTOTAL 105 = MIN de valores visibles)
    const columnasMIN = {
      23: 'W',  // SCI_MIN
      27: 'AA', // MST_MIN
      31: 'AE', // MIC_MIN
      35: 'AI', // MAT_MIN
      39: 'AM', // UHML_MIN
      43: 'AQ', // UI_MIN
      47: 'AU', // SF_MIN
      51: 'AY', // STR_MIN
      55: 'BC', // ELG_MIN
      59: 'BG', // RD_MIN
      63: 'BK', // +b_MIN
      67: 'BO', // TrCNT_MIN
      71: 'BS', // TrAR_MIN
      75: 'BW'  // TRID_MIN
    }
    
    // Columnas MAX (SUBTOTAL 104 = MAX de valores visibles)
    const columnasMAX = {
      24: 'X',  // SCI_MAX
      28: 'AB', // MST_MAX
      32: 'AF', // MIC_MAX
      36: 'AJ', // MAT_MAX
      40: 'AN', // UHML_MAX
      44: 'AR', // UI_MAX
      48: 'AV', // SF_MAX
      52: 'AZ', // STR_MAX
      56: 'BD', // ELG_MAX
      60: 'BH', // RD_MAX
      64: 'BL', // +b_MAX
      68: 'BP', // TrCNT_MAX
      72: 'BT', // TrAR_MAX
      76: 'BX'  // TRID_MAX
    }
    
    // Columnas σ (SUBTOTAL 107 = STDEV de valores visibles)
    const columnasDESV = {
      25: 'Y',  // SCI_DESV
      29: 'AC', // MST_DESV
      33: 'AG', // MIC_DESV
      37: 'AK', // MAT_DESV
      41: 'AO', // UHML_DESV
      45: 'AS', // UI_DESV
      49: 'AW', // SF_DESV
      53: 'BA', // STR_DESV
      57: 'BE', // ELG_DESV
      61: 'BI', // RD_DESV
      65: 'BM', // +b_DESV
      69: 'BQ', // TrCNT_DESV
      73: 'BU', // TrAR_DESV
      77: 'BY'  // TRID_DESV
    }
    
    // Columnas de colores (con IFERROR para evitar #DIV/0!)
    const columnasColores = {
      78: 'BZ', // BCO%
      79: 'CA', // GRI%
      80: 'CB', // LG%
      81: 'CC', // AMA%
      82: 'CD'  // LA%
    }
    
    // Columnas con 1 decimal: Cav 10⁵ (10), Vel.Nom (11), Vel.Prom (12)
    const columnasUnDecimal = [10, 11, 12]
    
    // Fila 2: MAX
    const maxRow = worksheet.addRow([])
    maxRow.height = 18
    maxRow.font = { bold: true, size: 9, color: { argb: 'FFDC2626' } }
    maxRow.alignment = { vertical: 'middle', horizontal: 'center' }
    maxRow.getCell(1).value = 'MAX'
    maxRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FFDC2626' } }
    
    for (const [colNum, colLetra] of Object.entries(columnasPromedio)) {
      const cell = maxRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(104,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      // TOTAL_MINUTOS con formato europeo (separador de miles)
      if ([8, 13, 17].includes(parseInt(colNum))) {
        cell.numFmt = '#,##0'
      } else {
        cell.numFmt = columnasUnDecimal.includes(parseInt(colNum)) ? '0.0' : '0.00'
      }
    }
    for (const [colNum, colLetra] of Object.entries(columnasMIN)) {
      const cell = maxRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(104,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0'
    }
    for (const [colNum, colLetra] of Object.entries(columnasMAX)) {
      const cell = maxRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(104,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0'
    }
    for (const [colNum, colLetra] of Object.entries(columnasDESV)) {
      const cell = maxRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(104,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0.00'
    }
    for (const [colNum, colLetra] of Object.entries(columnasColores)) {
      const cell = maxRow.getCell(parseInt(colNum))
      cell.value = { formula: `IFERROR(SUBTOTAL(104,${colLetra}${filaInicio}:${colLetra}${filaFin}),"")` }
      cell.numFmt = '0.0'
    }
    
    // Fila 3: PROMEDIO
    const promediosRow = worksheet.addRow([])
    promediosRow.height = 18
    promediosRow.font = { bold: true, size: 9, color: { argb: 'FF1E40AF' } }
    promediosRow.alignment = { vertical: 'middle', horizontal: 'center' }
    promediosRow.getCell(1).value = 'PROM'
    promediosRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF1E40AF' } }
    
    for (const [colNum, colLetra] of Object.entries(columnasPromedio)) {
      const cell = promediosRow.getCell(parseInt(colNum))
      // TOTAL_MINUTOS usa SUMA (109), otras columnas usan AVERAGE (101)
      const subtotalFunc = [8, 13, 17].includes(parseInt(colNum)) ? 109 : 101
      cell.value = { formula: `SUBTOTAL(${subtotalFunc},${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      // TOTAL_MINUTOS con formato europeo (separador de miles)
      if ([8, 13, 17].includes(parseInt(colNum))) {
        cell.numFmt = '#,##0'
      } else {
        cell.numFmt = columnasUnDecimal.includes(parseInt(colNum)) ? '0.0' : '0.00'
      }
    }
    for (const [colNum, colLetra] of Object.entries(columnasMIN)) {
      const cell = promediosRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(101,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0.00'
    }
    for (const [colNum, colLetra] of Object.entries(columnasMAX)) {
      const cell = promediosRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(101,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = parseInt(colNum) === 24 ? '0.0' : '0.00'
    }
    for (const [colNum, colLetra] of Object.entries(columnasDESV)) {
      const cell = promediosRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(101,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0.00'
    }
    for (const [colNum, colLetra] of Object.entries(columnasColores)) {
      const cell = promediosRow.getCell(parseInt(colNum))
      cell.value = { formula: `IFERROR(SUBTOTAL(101,${colLetra}${filaInicio}:${colLetra}${filaFin}),"")` }
      cell.numFmt = '0.0'
    }
    
    // Fila 4: MIN
    const minRow = worksheet.addRow([])
    minRow.height = 18
    minRow.font = { bold: true, size: 9, color: { argb: 'FF059669' } }
    minRow.alignment = { vertical: 'middle', horizontal: 'center' }
    minRow.getCell(1).value = 'MIN'
    minRow.getCell(1).font = { bold: true, size: 9, color: { argb: 'FF059669' } }
    
    for (const [colNum, colLetra] of Object.entries(columnasPromedio)) {
      const cell = minRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(105,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      // TOTAL_MINUTOS con formato europeo (separador de miles)
      if ([8, 13, 17].includes(parseInt(colNum))) {
        cell.numFmt = '#,##0'
      } else {
        cell.numFmt = columnasUnDecimal.includes(parseInt(colNum)) ? '0.0' : '0.00'
      }
    }
    for (const [colNum, colLetra] of Object.entries(columnasMIN)) {
      const cell = minRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(105,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0'
    }
    for (const [colNum, colLetra] of Object.entries(columnasMAX)) {
      const cell = minRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(105,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0'
    }
    for (const [colNum, colLetra] of Object.entries(columnasDESV)) {
      const cell = minRow.getCell(parseInt(colNum))
      cell.value = { formula: `SUBTOTAL(105,${colLetra}${filaInicio}:${colLetra}${filaFin})` }
      cell.numFmt = '0.00'
    }
    for (const [colNum, colLetra] of Object.entries(columnasColores)) {
      const cell = minRow.getCell(parseInt(colNum))
      cell.value = { formula: `IFERROR(SUBTOTAL(105,${colLetra}${filaInicio}:${colLetra}${filaFin}),"")` }
      cell.numFmt = '0.0'
    }
    
    // Fila 5: Columnas individuales (encabezados)
    // Cada variable HVI tendrá 4 columnas: Valor, MIN, MAX, σ
    worksheet.addRow([
      '', 
      'Maq. OE', 'Lote', 'Rot 10⁶', 
      'Fecha', 'Base', 'Color', 'Metros', 'R10³', 'Cav 10⁵', 'Vel.Nom', 'Vel.Prom', 
      'Metros', 'Efic.%', 'RU10⁵', 'RT10⁵', 
      'Metros', 'Cal.%', 'Pts/100m²',
      'Mezcla', 'F.Ingreso', 
      // HVI con estadísticas
      'SCI', 'MIN', 'MAX', 'σ',
      'MST', 'MIN', 'MAX', 'σ',
      'MIC', 'MIN', 'MAX', 'σ',
      'MAT', 'MIN', 'MAX', 'σ',
      'UHML', 'MIN', 'MAX', 'σ',
      'UI', 'MIN', 'MAX', 'σ',
      'SF', 'MIN', 'MAX', 'σ',
      'STR', 'MIN', 'MAX', 'σ',
      'ELG', 'MIN', 'MAX', 'σ',
      'RD', 'MIN', 'MAX', 'σ',
      '+b', 'MIN', 'MAX', 'σ',
      'TrCNT', 'MIN', 'MAX', 'σ',
      'TrAR', 'MIN', 'MAX', 'σ',
      'TRID', 'MIN', 'MAX', 'σ',
      'BCO%', 'GRI%', 'LG%', 'AMA%', 'LA%'
    ])
    
    // Combinar celdas de la primera fila (Grupos) - ahora combina fila 1 con fila 2
    // NO combinar con fila 3 que son los encabezados
    // Solo combinar horizontalmente los grupos
    worksheet.mergeCells('B1:D1')   // Urdidora
    worksheet.mergeCells('E1:L1')   // Índigo
    worksheet.mergeCells('M1:P1')   // Tejeduría
    worksheet.mergeCells('Q1:S1')   // Calidad
    worksheet.mergeCells('T1:CD1')  // Fibra HVI (incluye todas las columnas hasta LA%)
    
    // Columnas que marcan fin de sección principal
    const sectionEnds = [1, 4, 12, 16, 19, 82]  // CD es la última columna
    
    // Columnas que marcan fin de cada grupo HVI (valor + MIN + MAX + σ)
    // Col 21=F_INGRESO, luego cada 4 columnas: 25(SCI), 29(MST), 33(MIC), 37(MAT), 41(UHML), 
    // 45(UI), 49(SF), 53(STR), 57(ELG), 61(RD), 65(+b), 69(TrCNT), 73(TrAR), 77(TRID)
    // Col 78-79-80-81-82 = BCO, GRI, LG, AMA, LA (sin estadísticas)
    const hviGroupEnds = [21, 25, 29, 33, 37, 41, 45, 49, 53, 57, 61, 65, 69, 73, 77]
    
    // Estilo de encabezados - Primera fila (grupos)
    const headerRow1 = worksheet.getRow(1)
    headerRow1.height = 20
    headerRow1.font = { bold: true, size: 10 }
    headerRow1.alignment = { vertical: 'middle', horizontal: 'center' }
    
    // Aplicar colores a la primera fila
    headerRow1.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
    headerRow1.getCell(1).value = 'Rolada'
    headerRow1.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }
    headerRow1.getCell(2).value = 'URDIDORA'
    headerRow1.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
    headerRow1.getCell(5).value = 'ÍNDIGO'
    headerRow1.getCell(13).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } }
    headerRow1.getCell(13).value = 'TEJEDURÍA'
    headerRow1.getCell(17).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
    headerRow1.getCell(17).value = 'CALIDAD'
    headerRow1.getCell(20).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } }
    headerRow1.getCell(20).value = 'FIBRA HVI'
    
    // Bordes para la primera fila
    for (let col = 1; col <= 82; col++) {
      const cell = headerRow1.getCell(col)
      let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } }
      if (sectionEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }
      } else if (hviGroupEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FFD4A574' } } // Borde marrón claro para grupos HVI
      }
      cell.border = {
        right: rightBorder,
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }
      }
    }
    
    // Estilo de fila 2 (MAX) - Rojo
    const headerRow2 = worksheet.getRow(2)
    for (let col = 1; col <= 82; col++) {
      const cell = headerRow2.getCell(col)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFECACA' } }
      
      let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } }
      if (sectionEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }
      } else if (hviGroupEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FFD4A574' } }
      }
      
      cell.border = {
        right: rightBorder,
        bottom: { style: 'thin', color: { argb: 'FFFCA5A5' } }
      }
    }
    
    // Estilo de fila 3 (PROMEDIO) - Azul
    const headerRow3 = worksheet.getRow(3)
    for (let col = 1; col <= 82; col++) {
      const cell = headerRow3.getCell(col)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } }
      
      let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } }
      if (sectionEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }
      } else if (hviGroupEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FFD4A574' } }
      }
      
      cell.border = {
        right: rightBorder,
        bottom: { style: 'thin', color: { argb: 'FF93C5FD' } }
      }
    }
    
    // Estilo de fila 4 (MIN) - Verde
    const headerRow4 = worksheet.getRow(4)
    for (let col = 1; col <= 82; col++) {
      const cell = headerRow4.getCell(col)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }
      
      let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } }
      if (sectionEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }
      } else if (hviGroupEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FFD4A574' } }
      }
      
      cell.border = {
        right: rightBorder,
        bottom: { style: 'thin', color: { argb: 'FF6EE7B7' } }
      }
    }
    
    // Estilo de fila 5 (encabezados de columnas)
    const headerRow5 = worksheet.getRow(5)
    headerRow5.height = 30
    headerRow5.font = { bold: false, size: 9 }
    headerRow5.alignment = { vertical: 'top', horizontal: 'center', wrapText: true }
    
    // Aplicar estilo y bordes a cada celda de la fila 5
    for (let col = 1; col <= 82; col++) {
      const cell = headerRow5.getCell(col)
      
      // Color de fondo según la sección
      if (col >= 20 && col <= 82) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } }
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      }
      
      let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } }
      if (sectionEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }
      } else if (hviGroupEnds.includes(col)) {
        rightBorder = { style: 'medium', color: { argb: 'FFD4A574' } }
      }
      
      cell.border = {
        right: rightBorder,
        bottom: { style: 'medium', color: { argb: 'FF94A3B8' } }
      }
    }
    
    // Ajustar anchos de columnas
    worksheet.columns = [
      { key: 'ROLADA', width: 7 },
      { key: 'MAQ_OE', width: 10 },
      { key: 'LOTE', width: 10 },
      { key: 'ROT_106', width: 8 },
      { key: 'FECHA', width: 10 },
      { key: 'BASE', width: 12 },
      { key: 'COLOR', width: 7 },
      { key: 'MTS_IND', width: 9 },
      { key: 'R103', width: 7 },
      { key: 'CAV', width: 4 },
      { key: 'VEL_NOM', width: 7 },
      { key: 'VEL_PROM', width: 7 },
      { key: 'MTS_CRUDOS', width: 9 },
      { key: 'EFI_TEJ', width: 7 },
      { key: 'RU105', width: 8 },
      { key: 'RT105', width: 8 },
      { key: 'MTS_CAL', width: 9 },
      { key: 'CAL_PERCENT', width: 7 },
      { key: 'PTS_100M2', width: 8 },
      // Fibra HVI
      { key: 'MEZCLA', width: 28 },
      { key: 'F_INGRESO', width: 10 },
      // SCI + estadísticas
      { key: 'SCI', width: 6 },
      { key: 'SCI_MIN', width: 5 },
      { key: 'SCI_MAX', width: 5 },
      { key: 'SCI_DESV', width: 5 },
      // MST + estadísticas
      { key: 'MST', width: 6 },
      { key: 'MST_MIN', width: 5 },
      { key: 'MST_MAX', width: 5 },
      { key: 'MST_DESV', width: 5 },
      // MIC + estadísticas
      { key: 'MIC', width: 6 },
      { key: 'MIC_MIN', width: 5 },
      { key: 'MIC_MAX', width: 5 },
      { key: 'MIC_DESV', width: 5 },
      // MAT + estadísticas
      { key: 'MAT', width: 6 },
      { key: 'MAT_MIN', width: 5 },
      { key: 'MAT_MAX', width: 5 },
      { key: 'MAT_DESV', width: 5 },
      // UHML + estadísticas
      { key: 'UHML', width: 7 },
      { key: 'UHML_MIN', width: 5 },
      { key: 'UHML_MAX', width: 5 },
      { key: 'UHML_DESV', width: 5 },
      // UI + estadísticas
      { key: 'UI', width: 6 },
      { key: 'UI_MIN', width: 5 },
      { key: 'UI_MAX', width: 5 },
      { key: 'UI_DESV', width: 5 },
      // SF + estadísticas
      { key: 'SF', width: 6 },
      { key: 'SF_MIN', width: 5 },
      { key: 'SF_MAX', width: 5 },
      { key: 'SF_DESV', width: 5 },
      // STR + estadísticas
      { key: 'STR', width: 6 },
      { key: 'STR_MIN', width: 5 },
      { key: 'STR_MAX', width: 5 },
      { key: 'STR_DESV', width: 5 },
      // ELG + estadísticas
      { key: 'ELG', width: 6 },
      { key: 'ELG_MIN', width: 5 },
      { key: 'ELG_MAX', width: 5 },
      { key: 'ELG_DESV', width: 5 },
      // RD + estadísticas
      { key: 'RD', width: 6 },
      { key: 'RD_MIN', width: 5 },
      { key: 'RD_MAX', width: 5 },
      { key: 'RD_DESV', width: 5 },
      // PLUS_B + estadísticas
      { key: 'PLUS_B', width: 6 },
      { key: 'PLUS_B_MIN', width: 5 },
      { key: 'PLUS_B_MAX', width: 5 },
      { key: 'PLUS_B_DESV', width: 5 },
      // TrCNT + estadísticas
      { key: 'TrCNT', width: 6 },
      { key: 'TrCNT_MIN', width: 5 },
      { key: 'TrCNT_MAX', width: 5 },
      { key: 'TrCNT_DESV', width: 5 },
      // TrAR + estadísticas
      { key: 'TrAR', width: 6 },
      { key: 'TrAR_MIN', width: 5 },
      { key: 'TrAR_MAX', width: 5 },
      { key: 'TrAR_DESV', width: 5 },
      // TRID + estadísticas
      { key: 'TRID', width: 6 },
      { key: 'TRID_MIN', width: 5 },
      { key: 'TRID_MAX', width: 5 },
      { key: 'TRID_DESV', width: 5 },
      // Color percentages (sin estadísticas)
      { key: 'BCO', width: 6 },
      { key: 'GRI', width: 6 },
      { key: 'LG', width: 6 },
      { key: 'AMA', width: 6 },
      { key: 'LA', width: 6 }
    ]
    
    // Helper para obtener estadísticas de mezclas (maneja mezclas combinadas como "144,147,152")
    const getEstadisticaMezcla = (mistura, variable, stat) => {
      if (!mistura) return ''
      // Si es mezcla simple, buscar directamente
      const mezclasSplit = String(mistura).split(',').map(m => m.trim())
      // Usar la primera mezcla que tenga datos
      for (const m of mezclasSplit) {
        const val = hviEstadisticas.value[m]?.[variable]?.[stat]
        if (val !== undefined && val !== null) return val
      }
      return ''
    }
    
    // Agregar datos
    datos.value.forEach(item => {
      // Convertir fecha de string DD/MM/YYYY a Date para Excel
      let fechaDate = null
      if (item.FECHA) {
        const partes = item.FECHA.split('/')
        if (partes.length === 3) {
          // Fecha en formato DD/MM/YYYY
          fechaDate = new Date(parseInt(partes[2]), parseInt(partes[1]) - 1, parseInt(partes[0]))
        }
      }
      
      const parseNum = (val) => {
        if (val === null || val === undefined || val === '') return null
        const n = parseFloat(val)
        return isNaN(n) ? null : n
      }

      const row = worksheet.addRow({
        ROLADA: parseNum(item.ROLADA),
        MAQ_OE: item.MAQ_OE || '',
        LOTE: item.LOTE || '',
        ROT_106: calcularRot106Num(item.URDIDORA_ROTURAS, item.URDIDORA_METROS, item.NUM_FIOS),
        FECHA: fechaDate || '',
        BASE: item.BASE || '',
        COLOR: item.COLOR || '',
        MTS_IND: parseNum(item.MTS_IND),
        R103: parseNum(item.R103),
        CAV: calcularCav105Num(item.CAV, item.MTS_IND),
        VEL_NOM: parseNum(item.VEL_NOM),
        VEL_PROM: parseNum(item.VEL_PROM),
        MTS_CRUDOS: parseNum(item.MTS_CRUDOS),
        EFI_TEJ: parseNum(item.EFI_TEJ),
        RU105: parseNum(item.RU105),
        RT105: parseNum(item.RT105),
        MTS_CAL: parseNum(item.MTS_CAL),
        CAL_PERCENT: parseNum(item.CAL_PERCENT),
        PTS_100M2: parseNum(item.PTS_100M2),
        // Fibra HVI
        MEZCLA: item.MISTURA || '',
        F_INGRESO: item.FECHA_INGRESO || '',
        // SCI + estadísticas
        SCI: parseNum(item.SCI),
        SCI_MIN: parseNum(item.SCI_MIN),
        SCI_MAX: parseNum(item.SCI_MAX),
        SCI_DESV: parseNum(item.SCI_SIGMA),
        // MST + estadísticas
        MST: parseNum(item.MST),
        MST_MIN: parseNum(item.MST_MIN),
        MST_MAX: parseNum(item.MST_MAX),
        MST_DESV: parseNum(item.MST_SIGMA),
        // MIC + estadísticas
        MIC: parseNum(item.MIC),
        MIC_MIN: parseNum(item.MIC_MIN),
        MIC_MAX: parseNum(item.MIC_MAX),
        MIC_DESV: parseNum(item.MIC_SIGMA),
        // MAT + estadísticas
        MAT: parseNum(item.MAT),
        MAT_MIN: parseNum(item.MAT_MIN),
        MAT_MAX: parseNum(item.MAT_MAX),
        MAT_DESV: parseNum(item.MAT_SIGMA),
        // UHML + estadísticas
        UHML: parseNum(item.UHML),
        UHML_MIN: parseNum(item.UHML_MIN),
        UHML_MAX: parseNum(item.UHML_MAX),
        UHML_DESV: parseNum(item.UHML_SIGMA),
        // UI + estadísticas
        UI: parseNum(item.UI),
        UI_MIN: parseNum(item.UI_MIN),
        UI_MAX: parseNum(item.UI_MAX),
        UI_DESV: parseNum(item.UI_SIGMA),
        // SF + estadísticas
        SF: parseNum(item.SF),
        SF_MIN: parseNum(item.SF_MIN),
        SF_MAX: parseNum(item.SF_MAX),
        SF_DESV: parseNum(item.SF_SIGMA),
        // STR + estadísticas
        STR: parseNum(item.STR),
        STR_MIN: parseNum(item.STR_MIN),
        STR_MAX: parseNum(item.STR_MAX),
        STR_DESV: parseNum(item.STR_SIGMA),
        // ELG + estadísticas
        ELG: parseNum(item.ELG),
        ELG_MIN: parseNum(item.ELG_MIN),
        ELG_MAX: parseNum(item.ELG_MAX),
        ELG_DESV: parseNum(item.ELG_SIGMA),
        // RD + estadísticas
        RD: parseNum(item.RD),
        RD_MIN: parseNum(item.RD_MIN),
        RD_MAX: parseNum(item.RD_MAX),
        RD_DESV: parseNum(item.RD_SIGMA),
        // PLUS_B + estadísticas
        PLUS_B: parseNum(item.PLUS_B),
        PLUS_B_MIN: parseNum(item.PLUS_B_MIN),
        PLUS_B_MAX: parseNum(item.PLUS_B_MAX),
        PLUS_B_DESV: parseNum(item.PLUS_B_SIGMA),
        // TrCNT + estadísticas
        TrCNT: parseNum(item.TrCNT),
        TrCNT_MIN: parseNum(item.TrCNT_MIN),
        TrCNT_MAX: parseNum(item.TrCNT_MAX),
        TrCNT_DESV: parseNum(item.TrCNT_SIGMA),
        // TrAR + estadísticas
        TrAR: parseNum(item.TrAR),
        TrAR_MIN: parseNum(item.TrAR_MIN),
        TrAR_MAX: parseNum(item.TrAR_MAX),
        TrAR_DESV: parseNum(item.TrAR_SIGMA),
        // TRID + estadísticas
        TRID: parseNum(item.TRID),
        TRID_MIN: parseNum(item.TRID_MIN),
        TRID_MAX: parseNum(item.TRID_MAX),
        TRID_DESV: parseNum(item.TRID_SIGMA),
        // Color percentages (sin estadísticas)
        BCO: parseNum(item.COLOR_BCO_PCT),
        GRI: parseNum(item.COLOR_GRI_PCT),
        LG: parseNum(item.COLOR_LG_PCT),
        AMA: parseNum(item.COLOR_AMA_PCT),
        LA: parseNum(item.COLOR_LA_PCT)
      })
      
      row.height = 16
      row.alignment = { vertical: 'middle', horizontal: 'center' }
      row.font = { size: 9 }
      
      // Bordes y colores de fondo para cada celda
      const rowIndex = row.number
      const bgColor = rowIndex % 2 === 1 ? 'FFFFFFFF' : 'FFF8FAFC'
      const hviColor = rowIndex % 2 === 1 ? 'FFFFFEF8' : 'FFFFFBEB'
      
      for (let col = 1; col <= 82; col++) {
        const cell = row.getCell(col)
        
        // Color de fondo - amarillo claro para columnas de Fibra HVI
        if (col >= 20) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: hviColor } }
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        }
        
        let rightBorder = { style: 'thin', color: { argb: 'FFE2E8F0' } }
        if (sectionEnds.includes(col)) {
          rightBorder = { style: 'medium', color: { argb: 'FF64748B' } }
        } else if (hviGroupEnds.includes(col)) {
          rightBorder = { style: 'medium', color: { argb: 'FFD4A574' } }
        }
        
        cell.border = {
          right: rightBorder,
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
      }
      
      // Primera columna en negrita
      row.getCell(1).font = { bold: true, size: 9 }
      
      // Formato de fecha
      row.getCell('FECHA').numFmt = 'dd/mm/yyyy'
      
      // Formato numérico para columnas estándar
      row.getCell('ROLADA').numFmt = '0'
      row.getCell('MTS_IND').numFmt = '#,##0'
      row.getCell('R103').numFmt = '#,##0.00'
      row.getCell('CAV').numFmt = '#,##0.0'
      row.getCell('VEL_NOM').numFmt = '#,##0'
      row.getCell('VEL_PROM').numFmt = '#,##0.0'
      row.getCell('MTS_CRUDOS').numFmt = '#,##0'
      row.getCell('EFI_TEJ').numFmt = '#,##0.0'
      row.getCell('RU105').numFmt = '#,##0.00'
      row.getCell('RT105').numFmt = '#,##0.00'
      row.getCell('MTS_CAL').numFmt = '#,##0'
      row.getCell('CAL_PERCENT').numFmt = '#,##0.0'
      row.getCell('PTS_100M2').numFmt = '#,##0.0'
      row.getCell('ROT_106').numFmt = '0.00'
      
      // Formato numérico para Fibra HVI
      row.getCell('SCI').numFmt = '0.0'
      row.getCell('SCI_MIN').numFmt = '0'
      row.getCell('SCI_MAX').numFmt = '0'
      row.getCell('SCI_DESV').numFmt = '0.00'
      
      row.getCell('MST').numFmt = '0.0'
      row.getCell('MST_MIN').numFmt = '0.0'
      row.getCell('MST_MAX').numFmt = '0.0'
      row.getCell('MST_DESV').numFmt = '0.00'
      
      row.getCell('MIC').numFmt = '0.00'
      row.getCell('MIC_MIN').numFmt = '0.00'
      row.getCell('MIC_MAX').numFmt = '0.00'
      row.getCell('MIC_DESV').numFmt = '0.00'
      
      row.getCell('MAT').numFmt = '0.00'
      row.getCell('MAT_MIN').numFmt = '0.00'
      row.getCell('MAT_MAX').numFmt = '0.00'
      row.getCell('MAT_DESV').numFmt = '0.00'
      
      row.getCell('UHML').numFmt = '0.00'
      row.getCell('UHML_MIN').numFmt = '0.00'
      row.getCell('UHML_MAX').numFmt = '0.00'
      row.getCell('UHML_DESV').numFmt = '0.00'
      
      row.getCell('UI').numFmt = '0.0'
      row.getCell('UI_MIN').numFmt = '0.0'
      row.getCell('UI_MAX').numFmt = '0.0'
      row.getCell('UI_DESV').numFmt = '0.00'
      
      row.getCell('SF').numFmt = '0.0'
      row.getCell('SF_MIN').numFmt = '0.0'
      row.getCell('SF_MAX').numFmt = '0.0'
      row.getCell('SF_DESV').numFmt = '0.00'
      
      row.getCell('STR').numFmt = '0.0'
      row.getCell('STR_MIN').numFmt = '0.0'
      row.getCell('STR_MAX').numFmt = '0.0'
      row.getCell('STR_DESV').numFmt = '0.00'
      
      row.getCell('ELG').numFmt = '0.0'
      row.getCell('ELG_MIN').numFmt = '0.0'
      row.getCell('ELG_MAX').numFmt = '0.0'
      row.getCell('ELG_DESV').numFmt = '0.00'
      
      row.getCell('RD').numFmt = '0.0'
      row.getCell('RD_MIN').numFmt = '0.0'
      row.getCell('RD_MAX').numFmt = '0.0'
      row.getCell('RD_DESV').numFmt = '0.00'
      
      row.getCell('PLUS_B').numFmt = '0.0'
      row.getCell('PLUS_B_MIN').numFmt = '0.0'
      row.getCell('PLUS_B_MAX').numFmt = '0.0'
      row.getCell('PLUS_B_DESV').numFmt = '0.00'
      
      row.getCell('TrCNT').numFmt = '0'
      row.getCell('TrCNT_MIN').numFmt = '0'
      row.getCell('TrCNT_MAX').numFmt = '0'
      row.getCell('TrCNT_DESV').numFmt = '0.00'
      
      row.getCell('TrAR').numFmt = '0.00'
      row.getCell('TrAR_MIN').numFmt = '0.00'
      row.getCell('TrAR_MAX').numFmt = '0.00'
      row.getCell('TrAR_DESV').numFmt = '0.00'
      
      row.getCell('TRID').numFmt = '0'
      row.getCell('TRID_MIN').numFmt = '0'
      row.getCell('TRID_MAX').numFmt = '0'
      row.getCell('TRID_DESV').numFmt = '0.00'
      
      row.getCell('BCO').numFmt = '0.0'
      row.getCell('GRI').numFmt = '0.0'
      row.getCell('LG').numFmt = '0.0'
      row.getCell('AMA').numFmt = '0.0'
      row.getCell('LA').numFmt = '0.0'
      
      // Colores especiales para valores destacados
      row.getCell('ROT_106').font = { size: 9, color: { argb: 'FF059669' }, bold: true }
      row.getCell('R103').font = { size: 9, color: { argb: 'FF2563EB' }, bold: true }
      row.getCell('EFI_TEJ').font = { size: 9, color: { argb: 'FF7C3AED' }, bold: true }
      row.getCell('CAL_PERCENT').font = { size: 9, color: { argb: 'FFB45309' }, bold: true }
      row.getCell('SCI').font = { size: 9, color: { argb: 'FF0369A1' }, bold: true }
      row.getCell('MEZCLA').font = { size: 9, color: { argb: 'FFB45309' }, bold: true }
    })
    
    // Aplicar autofiltro desde la fila 5 (encabezados) hasta la última fila de datos
    const ultimaFila = worksheet.rowCount
    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: ultimaFila, column: 82 }
    }
    
    // Inmovilizar paneles en B6 (mantiene visible filas 1-5 y columna A)
    worksheet.views = [
      { state: 'frozen', xSplit: 1, ySplit: 5, topLeftCell: 'B6', activeCell: 'B6' }
    ]
    
    // Generar archivo y descargar
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    const now = new Date()
    const hhmmss = now.toTimeString().slice(0, 8).replace(/:/g, '')
    link.download = `Roladas_Fibra_HVI_${fechaInicio.value}_${fechaFin.value}_${hhmmss}.xlsx`
    link.click()
    window.URL.revokeObjectURL(url)
    
  } catch (error) {
    console.error('Error exportando a Excel:', error)
    alert('Error al exportar: ' + error.message)
  } finally {
    cargando.value = false
  }
}

// Inicializar fechas por defecto (últimos 30 días)
onMounted(() => {
  const hoy = new Date()
  const hace30Dias = new Date()
  hace30Dias.setDate(hoy.getDate() - 30)
  
  fechaFin.value = hoy.toISOString().split('T')[0]
  fechaInicio.value = hace30Dias.toISOString().split('T')[0]
})
</script>

<style scoped>
/* Estilos para mejorar la visualización de la tabla */
table {
  font-variant-numeric: tabular-nums;
}
</style>
