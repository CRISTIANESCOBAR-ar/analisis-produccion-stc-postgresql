<template>
  <div class="flex flex-col w-full h-screen p-4 bg-slate-50 overflow-hidden">
    <!-- Header / Selector -->
    <div class="mb-4 shrink-0 flex items-center justify-between gap-2">
      <div class="flex flex-col ml-8">
        <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
          <span class="p-1.5 bg-blue-100 text-blue-600 rounded-lg">🧬</span>
          Carga de Archivos HVI (Mistura)
        </h2>
      </div>
      
      <div class="flex items-center gap-2 flex-1 max-w-2xl justify-end">
        <!-- Acción: Comparación Muestra -->
        <button 
          @click="mostrarComparativa = true"
          title="Ver Comparativa Muestra vs Entrega"
          class="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all shadow-lg shadow-indigo-200 active:scale-95"
        >
          <span>⚖️ Comparar Muestras</span>
        </button>

        <div class="relative flex-1 group max-w-md">
          <input 
            v-model="folderPath"
            type="text" 
            placeholder="Ruta de la carpeta..."
            class="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 group-hover:bg-white"
            @change="saveFolderPath"
          />
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h3l2 3h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </span>
        </div>

        <button 
          @click="triggerFolderSelector"
          title="Seleccionar Carpeta"
          class="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-lg shadow-blue-200 shrink-0 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
        </button>

        <button 
          v-if="hasPersistedHandle"
          @click="refreshFolder"
          title="Actualizar lista"
          class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 transition-all shrink-0 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        <button 
          @click="processFiles"
          :disabled="!filesList.length"
          :title="filesList.length ? `Procesar (${filesList.length} archivos)` : 'Sin archivos'"
          class="p-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg transition-all shadow-lg shadow-green-200 shrink-0 active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Table Container -->
    <div class="flex flex-col flex-1 gap-4 overflow-hidden min-h-0">
      <!-- Top Table: TXT Files List -->
      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col h-[35%] shrink-0">
        <!-- Radiobutton Filters -->
        <div class="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-4 shrink-0">
          <span class="text-[10px] font-bold text-slate-500 uppercase">Mostrar:</span>
          <div class="flex items-center gap-3">
            <label v-for="opt in ['Todos', 'No guardados', 'Guardados']" :key="opt" class="flex items-center gap-1.5 cursor-pointer group">
              <input 
                type="radio" 
                v-model="filterStatus" 
                :value="opt" 
                class="w-3 h-3 text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span class="text-[11px] font-medium text-slate-600 group-hover:text-blue-600 transition-colors">{{ opt }}</span>
            </label>
          </div>
        </div>

        <div class="overflow-auto flex-1 h-full">
          <table class="w-full text-left border-collapse table-fixed">
            <thead class="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 shadow-sm">
              <tr>
                <th class="w-8 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider">Tipo</th>
                <th class="w-10 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider">Lote</th>
                <th class="w-30 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider">Prov.</th>
                <th class="w-10 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider">Grado</th>
                <th class="w-10 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider">Muestra</th>
                <th class="w-8 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider text-center">Cant.</th>
                <th class="w-11 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider">Color</th>
                <th class="w-8 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider text-center">Cort</th>
                <th class="w-120 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider">Obs</th>
                <th class="w-14 px-1 py-3 text-xs font-bold text-slate-700 tracking-wider text-center">Acción</th>
                <th class="w-10 px-1 py-2 text-xs font-bold text-slate-700 tracking-wider text-center">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr 
                v-for="(item, index) in filteredFiles" 
                :key="item.fileName" 
                @click="selectFile(item)"
                class="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                :class="{ 'bg-blue-50 border-l-4 border-blue-500': selectedFileName === item.fileName }"
              >
                <td class="px-1 py-2 text-xs">
                  <span 
                    class="px-1.5 py-0.5 rounded-full font-mono"
                    :class="item.tipo === 'Ent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'"
                  >
                    {{ item.tipo }}
                  </span>
                </td>
                <td class="px-1 py-2 text-xs font-mono text-slate-700">{{ item.loteEntrada }}</td>
                <td class="px-1 py-2 text-xs text-slate-600 truncate" :title="item.proveedor">{{ item.proveedor }}</td>
                <td class="px-1 py-2 text-xs text-slate-600 truncate">{{ item.grado }}</td>
                <td class="px-1 py-1 text-xs" @click.stop>
                  <input
                    v-model="item.muestra"
                    type="text"
                    :class="[
                      'w-full px-2 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:opacity-50',
                      selectedFileName === item.fileName ? 'bg-white' : ''
                    ]"
                  />
                </td>
                <td class="px-1 py-1 text-xs text-center" @click.stop>
                  <input 
                    v-model="item.cantidad"
                    type="number" 
                    :readonly="item.tipo === 'Ent'"
                    :class="[ item.tipo === 'Ent' ? 'bg-slate-50 text-blue-700' : '', selectedFileName === item.fileName ? 'bg-white' : '' ]"
                    class="w-full px-1 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none no-spinner text-center"
                  />
                </td>
                <td class="px-1 py-1 text-xs" @click.stop>
                  <select 
                    v-model="item.color"
                    class="w-full px-1 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    <option v-for="c in ['LG', 'BCO', 'LA', 'GRI', 'AMA']" :key="c" :value="c">{{ c }}</option>
                  </select>
                </td>
                <td class="px-1 py-1 text-xs" @click.stop>
                  <select
                    v-model="item.cort"
                    :disabled="item.tipo === 'Mue'"
                    :class="[ 'w-full px-1 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:opacity-50 cursor-pointer', selectedFileName === item.fileName ? 'bg-white' : '' ]"
                  >
                    <option v-for="n in [1, 2, 3]" :key="n" :value="n">{{ n }}</option>
                  </select>
                </td>
                <td class="px-1 py-1 text-xs" @click.stop>
                  <input 
                    v-model="item.obs"
                    type="text" 
                    :class="[ 'w-full px-1 py-1 border border-slate-200 rounded text-xs focus:ring-1 focus:ring-blue-500 outline-none', selectedFileName === item.fileName ? 'bg-white' : '' ]"
                  />
                </td>
                <td class="px-1 py-1 text-xs text-center" @click.stop>
                  <div class="flex items-center justify-center gap-1.5">
                    <button 
                      @click="handleSaveFromRow(item)"
                      :disabled="item.estado === 'Procesado'"
                      v-tippy="{ content: 'Guardar ensayo' }"
                      class="p-1.5 rounded-md transition-all sm:p-1"
                      :class="item.estado === 'Procesado' ? 'text-slate-300 cursor-not-allowed' : 'text-green-600 hover:bg-green-50 active:scale-95 border border-transparent hover:border-green-200'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                      </svg>
                    </button>
                    <button 
                      @click="handleEditFromRow(item)"
                      :disabled="item.estado !== 'Procesado'"
                      v-tippy="{ content: 'Editar metadatos' }"
                      class="p-1.5 rounded-md transition-all sm:p-1"
                      :class="item.estado !== 'Procesado' ? 'text-slate-200 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50 active:scale-95 border border-transparent hover:border-blue-200'"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </td>
                <td class="px-1 py-2 text-xs text-center">
                  <div v-if="item.estado === 'Procesado'" title="Guardado" class="flex justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div v-else title="Pendiente de guardar" class="flex justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </td>
              </tr>
              
              <tr v-if="parsedFiles.length === 0">
                <td colspan="10" class="px-4 py-16 text-center">
                  <p class="text-xs text-slate-400">No hay archivos</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Small Footer for Left Table -->
        <div class="bg-slate-50 border-t border-slate-200 px-3 py-2 shrink-0 flex justify-between items-center text-[10px]">
          <span class="text-slate-500">{{ parsedFiles.length }} archivos</span>
        </div>
      </div>

      <!-- Bottom Table: HVI Detailed Data -->
      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col flex-1 min-w-0">
        <div v-if="selectedFileName" class="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center shrink-0">
          <div class="flex items-center gap-3 flex-1">
            <span class="text-xs font-bold text-slate-700 truncate">Detalles: <span class="text-blue-600">{{ selectedFileName }}</span></span>
            <span class="text-[10px] text-slate-500 flex items-center gap-1 ml-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Formato: <b>Tipo_Lote_Proveedor_Grado_Fecha.txt</b>
            </span>
          </div>
          <!-- Botones de Acción -->
          <div class="flex items-center gap-2">
            
            <!-- Botón Exportar Excel -->
            <button 
              v-if="hviDetails.length > 0"
              @click="exportarExcel"
              title="Exportar a Excel"
              class="flex items-center justify-center p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all shadow-md active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </button>

            <!-- Selector Modelo -->
            <div v-if="hviDetails.length > 0" class="relative group">
              <select v-model="selectedModel" class="appearance-none pl-2 pr-5 py-1.5 text-[10px] uppercase font-bold bg-white border border-indigo-200 rounded-lg text-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer hover:border-indigo-400 transition-colors">
                <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                <option value="gemini-2.0-flash-exp">Gemini 2.0 Exp</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-indigo-400 group-hover:text-indigo-600">
                <svg class="fill-current h-3 w-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>

            <!-- NUEVO: Botón Análisis IA -->
            <button 
              v-if="hviDetails.length > 0"
              @click="solicitarAnalisisAI"
              :disabled="cargandoAI"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <span v-if="cargandoAI" class="animate-spin text-[10px]">🌀</span>
              <span v-else>✨ Análisis IA</span>
            </button>

             <!-- NUEVO: Botón Auditoría Contrato -->
            <button 
              v-if="hviDetails.length > 0"
              @click="verificarContrato(true)"
              :disabled="loadingAudit"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold rounded-lg transition-all shadow-md active:scale-95 disabled:opacity-50"
              title="Verificar contra Contrato y Tolerancias"
            >
              <span v-if="loadingAudit" class="animate-spin text-[10px]">⏳</span>
              <span v-else>📋 Verificar Contrato</span>
            </button>

            <!-- Botón Analizar -->
            <button 
              v-if="hviDetails.length > 0"
              @click="mostrarAnalizador = true"
              class="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-all shadow-md active:scale-95"
            >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Análisis Técnico
          </button>
        </div>
      </div>

        <div class="overflow-auto flex-1 h-full">
          <table class="w-full text-left border-collapse table-fixed min-w-300">
            <thead class="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
              <tr>
                <th class="w-20 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">Fardo</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">SCI</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">MST</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">MIC</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">MAT</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">UHML</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">UI</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">SF</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">STR</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">ELG</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">RD</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">+b</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">TIPO</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">TrCNT</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">TrAR</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 tracking-wider">TRID</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(row, idx) in hviDetails" :key="idx" 
                  :class="[
                    'hover:bg-slate-50 transition-colors',
                    clasificarFila(row).alertas.some(a => a.tipo === 'bandera-roja') ? 'ring-2 ring-red-400 ring-inset' : ''
                  ]">
                <td class="px-4 py-2 text-xs font-mono text-slate-700 relative">
                  {{ row.fardo }}
                  <!-- Indicadores de alerta -->
                  <div v-if="clasificarFila(row).alertas.length" class="absolute -right-1 top-0 flex flex-col gap-0.5">
                    <span v-for="(alerta, ai) in clasificarFila(row).alertas" :key="ai"
                          :title="alerta.mensaje"
                          :class="[
                            'w-2.5 h-2.5 rounded-full cursor-help',
                            alerta.tipo === 'bandera-roja' ? 'bg-red-500' : '',
                            alerta.tipo === 'riesgo-tenido' ? 'bg-purple-500' : '',
                            alerta.tipo === 'fibra-opaca' ? 'bg-amber-500' : ''
                          ]"></span>
                  </div>
                </td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('sci')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).sci)]">{{ row.sci }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.mst }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('mic')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).mic)]">{{ row.mic }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.mat }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('uhml')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).uhml)]">{{ row.uhml }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('ui')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).ui)]">{{ row.ui }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('sf')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).sf)]">{{ row.sf }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('str')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).str)]">{{ row.str }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.elg }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('rd')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).rd)]">{{ row.rd }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('plusB')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).plusB)]">{{ row.plusB }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.tipo }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('trCnt')) ? 'bg-red-500 text-white font-bold' : 'text-slate-600']">{{ row.trCnt }}</td>
                <td :class="['px-4 py-2 text-xs font-medium', isBaleFailed(row.fardo, toAuditKey('trAr')) ? 'bg-red-500 text-white font-bold' : getClaseColor(clasificarFila(row).trAr)]">{{ row.trAr }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.trid }}</td>
              </tr>
              <tr v-if="!hviDetails.length">
                <td colspan="16" class="px-4 py-16 text-center">
                  <div class="flex flex-col items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p class="text-sm">Seleccione un archivo de la izquierda para ver el detalle</p>
                  </div>
                </td>
              </tr>
            </tbody>
            <!-- Footer fijo con promedios -->
            <tfoot v-if="hviDetails.length" class="sticky bottom-0 z-10 bg-blue-50 border-t-2 border-blue-200">
              <tr class="font-bold text-blue-900 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                <td class="px-4 py-3 text-xs bg-blue-100/50">n = {{ hviDetails.length }} (Prom)</td>
                <td :title="getAuditTooltip(toAuditKey('sci'))" 
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('sci'), getClaseColor(clasificarMayorMejor(hviAverages.sci, PARAMETROS_HVI_INTERNACIONAL.SCI)))]">
                    {{ hviAverages.sci }}
                </td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.mst }}</td>
                <td :title="getAuditTooltip(toAuditKey('mic'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('mic'), getClaseColor(clasificarMIC(hviAverages.mic)))]">
                    {{ hviAverages.mic }}
                </td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.mat }}</td>
                <td :title="getAuditTooltip(toAuditKey('uhml'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('uhml'), getClaseColor(clasificarMayorMejor(hviAverages.uhml, PARAMETROS_HVI_INTERNACIONAL.UHML)))]">
                    {{ hviAverages.uhml }}
                </td>
                <td :title="getAuditTooltip(toAuditKey('ui'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('ui'), getClaseColor(clasificarMayorMejor(hviAverages.ui, PARAMETROS_HVI_INTERNACIONAL.UI)))]">
                    {{ hviAverages.ui }}
                </td>
                <td :title="getAuditTooltip(toAuditKey('sf'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('sf'), getClaseColor(clasificarMenorMejor(hviAverages.sf, PARAMETROS_HVI_INTERNACIONAL.SF)))]">
                    {{ hviAverages.sf }}
                </td>
                <td :title="getAuditTooltip(toAuditKey('str'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('str'), getClaseColor(clasificarMayorMejor(hviAverages.str, PARAMETROS_HVI_INTERNACIONAL.STR)))]">
                    {{ hviAverages.str }}
                </td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.elg }}</td>
                <td :title="getAuditTooltip(toAuditKey('rd'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('rd'), getClaseColor(clasificarMayorMejor(hviAverages.rd, PARAMETROS_HVI_INTERNACIONAL.RD)))]">
                    {{ hviAverages.rd }}
                </td>
                <td :title="getAuditTooltip(toAuditKey('plusB'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('plusB'), getClaseColor(clasificarMenorMejor(hviAverages.plusB, PARAMETROS_HVI_INTERNACIONAL.PLUS_B)))]">
                    {{ hviAverages.plusB }}
                </td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.tipo }}</td>
                <td :title="getAuditTooltip(toAuditKey('trCnt'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('trCnt'), '')]">
                    {{ hviAverages.trCnt }}
                </td>
                <td :title="getAuditTooltip(toAuditKey('trAr'))"
                    :class="['px-4 py-3 text-xs', getAuditClass(toAuditKey('trAr'), getClaseColor(clasificarMenorMejor(hviAverages.trAr, PARAMETROS_HVI_INTERNACIONAL.TRAR)))]">
                    {{ hviAverages.trAr }}
                </td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.trid }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        
        <!-- Leyenda de clasificación HVI -->
        <div v-if="hviDetails.length" class="mt-3 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
          <div class="flex flex-wrap items-center gap-4 text-xs">
            <span class="font-semibold text-slate-600">Clasificación:</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-green-100 border border-green-300"></span> Excelente</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-yellow-50 border border-yellow-300"></span> Aceptable</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-orange-100 border border-orange-300"></span> Crítico</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded bg-red-100 border border-red-300"></span> Fuera de rango</span>
            <span class="border-l border-slate-300 pl-4 font-semibold text-slate-600">Alertas:</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-red-500"></span> Bandera Roja (STR/SF)</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-purple-500"></span> Riesgo Teñido (MIC)</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-amber-500"></span> Fibra Opaca (RD)</span>
          </div>
          <!-- Resumen de alertas -->
          <div v-if="resumenAlertas.total > 0" class="mt-2 pt-2 border-t border-slate-200 flex flex-wrap gap-3 text-xs">
            <span v-if="resumenAlertas.banderaRoja" class="px-2 py-1 bg-red-100 text-red-700 rounded font-medium">
              {{ resumenAlertas.banderaRoja }} pacas con Bandera Roja
            </span>
            <span v-if="resumenAlertas.riesgoTenido" class="px-2 py-1 bg-purple-100 text-purple-700 rounded font-medium">
              {{ resumenAlertas.riesgoTenido }} pacas con Riesgo de Teñido
            </span>
            <span v-if="resumenAlertas.fibraOpaca" class="px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">
              {{ resumenAlertas.fibraOpaca }} pacas con Fibra Opaca
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden folder input pointer -->
    <input 
      ref="folderInput"
      type="file" 
      webkitdirectory 
      directory 
      multiple 
      class="hidden" 
      @change="handleFolderChange"
    />

    <!-- Modal Analizador HVI -->
    <Teleport to="body">
      <div v-if="mostrarAnalizador" 
           class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
           @click.self="mostrarAnalizador = false">
        <div class="relative w-full max-w-5xl max-h-[90vh] overflow-auto rounded-2xl shadow-2xl">
          <!-- Botón cerrar -->
          <button 
            @click="mostrarAnalizador = false"
            class="absolute top-4 right-4 z-10 p-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full transition-colors shadow-lg"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <!-- Componente Analizador -->
          <AnalizadorHVI 
            :pacas="hviDetails" 
            :metadata="selectedFileItem"
          />
        </div>
      </div>
    </Teleport>

    <!-- Modal Comparativa -->
    <Teleport to="body">
      <div v-if="mostrarComparativa" class="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
        <div class="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-auto relative">
          <button 
            @click="mostrarComparativa = false"
            class="absolute top-6 right-6 p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition-all active:scale-95"
          >
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <EnsayoHVICompare />
        </div>
      </div>
    </Teleport>

    <!-- Modal para el resultado de la IA -->
    <Teleport to="body">
      <div v-if="mostrarModalAI" class="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
          <div class="px-6 py-4 bg-linear-to-br from-purple-700 via-indigo-800 to-blue-900 text-white flex justify-between items-center">
            <div>
              <h3 class="font-bold text-base">Gemini 3: Predicción Técnica</h3>
              <p class="text-[10px] opacity-80 uppercase tracking-widest font-bold">Inteligencia Artificial aplicada a Fibras</p>
            </div>
            <button @click="mostrarModalAI = false" class="p-1.5 hover:bg-white/10 rounded-full transition-colors">
               <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="p-8 overflow-auto bg-slate-50 min-h-75">
            <div v-if="cargandoAI" class="flex flex-col items-center justify-center py-20">
              <div class="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
              <p class="text-sm text-slate-500 font-medium text-center">Analizando fardo por fardo para predecir neps y resistencia...</p>
            </div>
            <div v-else class="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-medium italic">
              {{ aiInsight }}
            </div>
          </div>
          <div class="px-6 py-3 bg-white border-t flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span>MODEL: {{ selectedModel.toUpperCase() }}</span>
            <span>DATA: FULL BALE FEEDBACK</span>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import Swal from 'sweetalert2';
import ExcelJS from 'exceljs';
import AnalizadorHVI from './AnalizadorHVI.vue';  
import EnsayoHVICompare from './EnsayoHVICompare.vue';

// (Moved watch/toAuditKey further down to fix initialization error)

// =====================================================
// PARÁMETROS HVI INTERNACIONALES PARA CLASIFICACIÓN
// =====================================================
const PARAMETROS_HVI_INTERNACIONAL = {
  // --- Variables de Hilabilidad ---
  SCI:  { min_excelente: 120, min_aceptable: 100, critico: 85 },
  STR:  { min_excelente: 30,  min_aceptable: 27,  critico: 24 }, // g/tex
  SF:   { max_excelente: 7.5, max_aceptable: 11.0, critico: 13.5 }, // %
  UI:   { min_excelente: 83,  min_aceptable: 81,  critico: 79 }, // %
  UHML: { min_excelente: 28.5, min_aceptable: 27.0, critico: 25.5 }, // mm

  // --- Variables de Madurez y Teñido ---
  MIC:  { 
    rango_premium: [3.8, 4.2], 
    rango_aceptable: [3.5, 4.9], 
    descuento_por_madurez: 3.4, // <3.4 Riesgo de neps de teñido
    descuento_por_finura: 5.0    // >5.0 Fibra muy gruesa/tosca
  },
  
  // --- Variables de Color (Daño Climático) ---
  RD:   { min_excelente: 75, min_aceptable: 70, critico: 65 }, // Brillo/Reflectancia
  PLUS_B: { max_excelente: 8.5, max_aceptable: 10.5, critico: 12.0 }, // Amarillez (Daño por calor/hongos)

  // --- Variables de Limpieza ---
  TRAR: { max_excelente: 0.35, max_aceptable: 0.55, critico: 0.80 } // % de Área de basura
};

// =====================================================
// FUNCIONES DE CLASIFICACIÓN HVI
// =====================================================

/**
 * Clasifica un valor "mayor es mejor" (SCI, STR, UI, UHML, RD)
 * Retorna: 'excelente' | 'aceptable' | 'critico' | 'fuera'
 */
function clasificarMayorMejor(valor, params) {
  const v = parseFloat(valor);
  if (isNaN(v)) return 'sin-dato';
  if (v >= params.min_excelente) return 'excelente';
  if (v >= params.min_aceptable) return 'aceptable';
  if (v >= params.critico) return 'critico';
  return 'fuera';
}

/**
 * Clasifica un valor "menor es mejor" (SF, PLUS_B, TRAR)
 * Retorna: 'excelente' | 'aceptable' | 'critico' | 'fuera'
 */
function clasificarMenorMejor(valor, params) {
  const v = parseFloat(valor);
  if (isNaN(v)) return 'sin-dato';
  if (v <= params.max_excelente) return 'excelente';
  if (v <= params.max_aceptable) return 'aceptable';
  if (v <= params.critico) return 'critico';
  return 'fuera';
}

/**
 * Clasifica MIC (dentro de rango es mejor)
 * Retorna: 'premium' | 'aceptable' | 'riesgo-tenido' | 'fibra-gruesa'
 */
function clasificarMIC(valor) {
  const v = parseFloat(valor);
  if (isNaN(v)) return 'sin-dato';
  const p = PARAMETROS_HVI_INTERNACIONAL.MIC;
  
  if (v >= p.rango_premium[0] && v <= p.rango_premium[1]) return 'premium';
  if (v >= p.rango_aceptable[0] && v <= p.rango_aceptable[1]) return 'aceptable';
  if (v < p.descuento_por_madurez) return 'riesgo-tenido';
  if (v > p.descuento_por_finura) return 'fibra-gruesa';
  return 'fuera';
}

/**
 * Evalúa una paca completa y retorna alertas especiales
 */
function evaluarAlertasPaca(row) {
  const alertas = [];
  const str = parseFloat(row.str);
  const sf = parseFloat(row.sf);
  const mic = parseFloat(row.mic);
  const rd = parseFloat(row.rd);
  const sci = parseFloat(row.sci);
  
  // Bandera Roja de Producción: STR o SF críticos (sin importar SCI alto)
  if (!isNaN(str) && str < PARAMETROS_HVI_INTERNACIONAL.STR.critico) {
    alertas.push({ tipo: 'bandera-roja', mensaje: `STR crítico (${str} < ${PARAMETROS_HVI_INTERNACIONAL.STR.critico})` });
  }
  if (!isNaN(sf) && sf > PARAMETROS_HVI_INTERNACIONAL.SF.critico) {
    alertas.push({ tipo: 'bandera-roja', mensaje: `SF crítico (${sf} > ${PARAMETROS_HVI_INTERNACIONAL.SF.critico})` });
  }
  
  // Riesgo de Teñido: MIC fuera del rango aceptable
  if (!isNaN(mic)) {
    const micParams = PARAMETROS_HVI_INTERNACIONAL.MIC;
    if (mic < micParams.rango_aceptable[0] || mic > micParams.rango_aceptable[1]) {
      alertas.push({ tipo: 'riesgo-tenido', mensaje: `MIC fuera de rango (${mic})` });
    }
  }
  
  // Fibra Opaca / Posible daño por humedad: RD < 70
  if (!isNaN(rd) && rd < PARAMETROS_HVI_INTERNACIONAL.RD.min_aceptable) {
    alertas.push({ tipo: 'fibra-opaca', mensaje: `RD bajo (${rd} < 70) - Posible daño por humedad` });
  }
  
  return alertas;
}

/**
 * Obtiene la clase CSS para una celda según su clasificación
 */
function getClaseColor(clasificacion) {
  const clases = {
    'excelente': 'bg-green-100 text-green-800',
    'premium': 'bg-green-100 text-green-800',
    'aceptable': 'bg-yellow-50 text-yellow-800',
    'critico': 'bg-orange-100 text-orange-800',
    'fuera': 'bg-red-100 text-red-800',
    'riesgo-tenido': 'bg-purple-100 text-purple-800',
    'fibra-gruesa': 'bg-orange-100 text-orange-800',
    'sin-dato': 'text-slate-400'
  };
  return clases[clasificacion] || '';
}

/**
 * Clasifica todos los parámetros de una fila
 */
function clasificarFila(row) {
  const P = PARAMETROS_HVI_INTERNACIONAL;
  return {
    sci: clasificarMayorMejor(row.sci, P.SCI),
    str: clasificarMayorMejor(row.str, P.STR),
    sf: clasificarMenorMejor(row.sf, P.SF),
    ui: clasificarMayorMejor(row.ui, P.UI),
    uhml: clasificarMayorMejor(row.uhml, P.UHML),
    mic: clasificarMIC(row.mic),
    rd: clasificarMayorMejor(row.rd, P.RD),
    plusB: clasificarMenorMejor(row.plusB, P.PLUS_B),
    trAr: clasificarMenorMejor(row.trAr, P.TRAR),
    alertas: evaluarAlertasPaca(row)
  };
}

// Helper to map lowercase frontend keys to uppercase backend keys
const toAuditKey = (k) => {
  const map = { 'sci': 'SCI', 'mic': 'MIC', 'mat': 'MAT', 'uhml': 'LEN', 'ui': 'UNF', 'sf': 'SFI', 'str': 'STR', 'elg': 'ELG', 'rd': 'RD', 'plusB': '+b', 'trCnt': 'TRASH' };
  return map[k] || k.toUpperCase();
};

// State
const folderPath = ref(localStorage.getItem('hvi_last_folder_path') || '');
const mostrarAnalizador = ref(false);
const mostrarComparativa = ref(false);
const filesList = ref([]);
const folderInput = ref(null);
const parsedFiles = ref([]);
const hasPersistedHandle = ref(false);

const selectedFileName = ref('');
const selectedFileItem = ref(null);
const hviDetails = ref([]);
const filterStatus = ref('No guardados'); // Todos, No guardados, Guardados

// Watch for data changes to auto-audit
watch(hviDetails, (newVal) => {
  if (newVal && newVal.length > 0) {
    verificarContrato(false); // Auto-audit, no alerts
  } else {
    auditResult.value = null;
  }
});

// =====================================================
// ESTADOS PARA IA (Gemini 3)
// =====================================================
const aiInsight = ref('');
const selectedModel = ref('gemini-2.0-flash'); // Default rápido y estable
const modelosDisponibles = [
  { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro (Preview) - Potente' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview) - Veloz' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash - Producción' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Exp)' }
];
const cargandoAI = ref(false);
const mostrarModalAI = ref(false);
const auditResult = ref(null);
const loadingAudit = ref(false);

const verificarContrato = async (isManual = false) => {
  if (!hviDetails.value.length) return;
  
  loadingAudit.value = true;
  auditResult.value = null; // Reset
  
  try {
    const response = await fetch('http://localhost:3001/api/config/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bales: hviDetails.value.map(b => ({ ...b, LOTE: b.fardo })),
        version_nombre: 'Estándar 2026' // O tomar seleccionada si agregamos selector
      })
    });
    
    const json = await response.json();
    if (json.success) {
      auditResult.value = json.data;
      
      // Feedback visual inmediato si hay rechazo
      if (json.data.overallStatus === 'RECHAZO') {
        const hasDistribFailure = json.data.details.some(d => d.includes('Dispersión Alta'));
        let mensaje = "El lote no cumple con los estándares de mezcla configurados.";
        
        if (hasDistribFailure) {
           mensaje = "ALERTA DE MEZCLA: Lote rechazado por exceso de fardos en zona de tolerancia (> 20%).";
           aiInsight.value = mensaje + " Revise celdas rojas de MIC/SCI."; 
        } else {
           mensaje = "Violaciones de límites absolutos (Hard Cap) o promedios detectadas.";
           aiInsight.value = json.data.details.join('\n');
        }

        // Mostrar Swal solo si fue clic manual
        if (isManual === true) { 
             Swal.fire({
                title: 'Lote Rechazado por Auditoría',
                html: `<div class="text-left text-sm">${json.data.details.map(d => `• ${d}`).join('<br>')}</div>`,
                icon: 'error',
                confirmButtonText: 'Entendido'
            });
        }
      } else if (json.data.overallStatus === 'ADVERTENCIA') {
          if (isManual === true) {
            Swal.fire({
                title: 'Advertencia de Calidad',
                text: 'El lote presenta desviaciones menores en la distribución.',
                icon: 'warning'
            });
          }
      } else {
         // Éxito
         if (isManual === true) { 
             Swal.fire({
                title: 'Lote Aprobado',
                text: 'Cumple con Estándar 2026 (Promedios, Hard Caps y Distribución)',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false
             });
         }
      }
    }
  } catch (e) {
    console.error("Audit error", e);
    Swal.fire('Error', 'No se pudo conectar con el servicio de auditoría', 'error');
  } finally {
    loadingAudit.value = false;
  }
};

const getAuditTooltip = (param) => {
  if (!auditResult.value || !auditResult.value.parameterResults[param]) return null;
  const res = auditResult.value.parameterResults[param];
  let text = `Promedio: ${res.avg} (${res.status})`;
  if (res.hardCapViolations > 0) text += ` | HARD CAP: ${res.hardCapViolations} pacas`;
  if (res.distribution && res.distribution.outliersPct > 0) {
    text += ` | Fuera Rango: ${res.distribution.outliersPct}%`;
  }
  return text;
};

const getAuditClass = (param, originalClass) => {
  if (!auditResult.value || !auditResult.value.parameterResults[param]) return originalClass;
  const status = auditResult.value.parameterResults[param].status;
  if (status === 'RECHAZO') return 'bg-red-600 text-white font-black animate-pulse'; // Carmesí fuerte
  if (status === 'ADVERTENCIA') return 'bg-amber-100 text-amber-800';
  return originalClass;
};

// Check if specific cell failed audit
const isBaleFailed = (rowId, param) => {
  if (!auditResult.value) return false;
  const pRes = auditResult.value.parameterResults[param];
  if (!pRes || !pRes.failedBales) return false;
  // Match rowId (string/int loose check)
  return pRes.failedBales.some(fb => fb.id == rowId);
};

const solicitarAnalisisAI = async () => {
  if (!selectedFileItem.value || !hviDetails.value.length) {
    Swal.fire({
      icon: 'warning',
      title: 'Seleccione un archivo',
      text: 'Debe seleccionar un archivo con datos para realizar el análisis de IA.'
    });
    return;
  }
  
  cargandoAI.value = true;
  mostrarModalAI.value = true;
  aiInsight.value = '';

  try {
    const lote = selectedFileItem.value.loteEntrada;
    const archivosDelLote = parsedFiles.value
      .filter(f => f.loteEntrada === lote)
      .map(f => f.tipo);

    const response = await fetch('http://localhost:3001/api/hvi/predecir-hilatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel.value,
        lote,
        proveedor: selectedFileItem.value.proveedor,
        pacas: hviDetails.value,
        metadata: {
          grado: selectedFileItem.value.grado,
          tipo: selectedFileItem.value.tipo
        },
        contexto: archivosDelLote
      })
    });

    const data = await response.json();
    if (data.success) {
      aiInsight.value = data.insight;
    } else {
      aiInsight.value = "Error en el análisis: " + (data.error || "Respuesta inválida");
    }
  } catch (err) {
    console.error("Error al conectar con IA:", err);
    aiInsight.value = "Error crítico al conectar con el servidor de análisis Gemini 3.";
  } finally {
    cargandoAI.value = false;
  }
};

// Propiedad computada para filtrar la lista de archivos
const filteredFiles = computed(() => {
  if (filterStatus.value === 'Todos') return parsedFiles.value;
  if (filterStatus.value === 'Guardados') {
    return parsedFiles.value.filter(f => f.estado === 'Procesado');
  }
  if (filterStatus.value === 'No guardados') {
    return parsedFiles.value.filter(f => f.estado === 'Pendiente');
  }
  return parsedFiles.value;
});

// Propiedad computada para calcular los promedios
const hviAverages = computed(() => {
  if (!hviDetails.value.length) return {};
  
  const keys = ['sci', 'mst', 'mic', 'mat', 'uhml', 'ui', 'sf', 'str', 'elg', 'rd', 'plusB', 'tipo', 'trCnt', 'trAr', 'trid'];
  const sums = {};
  keys.forEach(k => sums[k] = 0);
  
  let validCounts = {};
  keys.forEach(k => validCounts[k] = 0);

  hviDetails.value.forEach(row => {
    keys.forEach(k => {
      const val = parseFloat(row[k]);
      if (!isNaN(val)) {
        sums[k] += val;
        validCounts[k]++;
      }
    });
  });

  const averages = {};
  keys.forEach(k => {
    if (validCounts[k] > 0) {
      const avg = sums[k] / validCounts[k];
      
      // Ajustar precisión según el tipo de campo
      let precision = 2;
      if (['sci', 'mst', 'tipo'].includes(k)) precision = 1;
      if (['trCnt', 'trid'].includes(k)) precision = 0;

      // Para 'tipo' mostramos punto como solicitó el usuario, para el resto seguimos con coma
      if (k === 'tipo') {
        averages[k] = avg.toFixed(precision);
      } else {
        averages[k] = avg.toFixed(precision).replace('.', ',');
      }
    } else {
      averages[k] = '-';
    }
  });
  
  return averages;
});

// Computed que resume las alertas de todas las pacas
const resumenAlertas = computed(() => {
  if (!hviDetails.value.length) return { total: 0, banderaRoja: 0, riesgoTenido: 0, fibraOpaca: 0 };
  
  let banderaRoja = 0;
  let riesgoTenido = 0;
  let fibraOpaca = 0;
  
  hviDetails.value.forEach(row => {
    const alertas = evaluarAlertasPaca(row);
    if (alertas.some(a => a.tipo === 'bandera-roja')) banderaRoja++;
    if (alertas.some(a => a.tipo === 'riesgo-tenido')) riesgoTenido++;
    if (alertas.some(a => a.tipo === 'fibra-opaca')) fibraOpaca++;
  });
  
  return {
    total: banderaRoja + riesgoTenido + fibraOpaca,
    banderaRoja,
    riesgoTenido,
    fibraOpaca
  };
});

// Computed
const counts = computed(() => {
  const total = parsedFiles.value.length;
  const ent = parsedFiles.value.filter(f => f.tipo === 'Ent').length;
  return { total, ent };
});

// IndexedDB helpers for DirectoryHandle persistence
function openDb() {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('carga-hvi', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    const r = store.put(handle, 'dir');
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

async function getDirHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const store = tx.objectStore('handles');
    const r = store.get('dir');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function verifyPermission(handle) {
  if (!handle) return false;
  try {
    if (await handle.queryPermission({ mode: 'read' }) === 'granted') return true;
    if (await handle.requestPermission({ mode: 'read' }) === 'granted') return true;
  } catch (err) {
    console.warn('verifyPermission error', err);
  }
  return false;
}

// Methods
const saveFolderPath = () => {
  localStorage.setItem('hvi_last_folder_path', folderPath.value);
};

const triggerFolderSelector = async () => {
  // Use File System Access API if available
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker();
      await saveDirHandle(handle);
      hasPersistedHandle.value = true;
      folderPath.value = handle.name;
      saveFolderPath();
      await scanDirectory(handle);
      return;
    } catch (err) {
      console.warn('showDirectoryPicker error or cancelled', err);
    }
  }

  // Fallback to hidden input
  if (folderInput.value) {
    folderInput.value.click();
  }
};

async function scanDirectory(dirHandle) {
  const results = [];
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && name.toLowerCase().endsWith('.txt')) {
        results.push(parseFileName(name, handle));
      }
    }
    
    // Verificar estado en la DB antes de mostrar
    if (results.length > 0) {
      try {
        const response = await fetch('/api/hvi/check-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileNames: results.map(f => f.fileName) })
        });
        const result = await response.json();
        if (result.success) {
          // Marcar procesados
          results.forEach(f => {
            if (result.existingNames.includes(f.fileName)) {
              f.estado = 'Procesado';
            }
          });

          // Traer metadatos guardados para los archivos procesados y mezclarlos
          if (result.existingNames.length > 0) {
            try {
              const metaResp = await fetch('/api/hvi/get-metadata', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileNames: result.existingNames })
              });
              const metaJson = await metaResp.json();
              if (metaJson.success && metaJson.metadata) {
                      // aplicar metadata a los resultados de forma segura
                      results.forEach(f => {
                        const m = metaJson.metadata[f.fileName];
                        if (m) {
                          if (m.muestra !== undefined && m.muestra !== null) f.muestra = m.muestra;
                          if (m.cantidad !== undefined && m.cantidad !== null) f.cantidad = m.cantidad;
                          if (m.color !== undefined && m.color !== null) f.color = m.color;
                          if (m.cort !== undefined && m.cort !== null) f.cort = m.cort;
                          if (m.obs !== undefined && m.obs !== null) f.obs = m.obs;
                          // normalizar cabecera
                          if (m.tipo !== undefined && m.tipo !== null) f.tipo = m.tipo;
                          if (m.loteEntrada !== undefined && m.loteEntrada !== null) f.loteEntrada = m.loteEntrada;
                          else if (m.lote !== undefined && m.lote !== null) f.loteEntrada = m.lote;
                          if (m.proveedor !== undefined && m.proveedor !== null) f.proveedor = m.proveedor;
                          if (m.grado !== undefined && m.grado !== null) f.grado = m.grado;
                          if (m.fecha !== undefined && m.fecha !== null) f.fecha = m.fecha;
                        }
                      });
              }
            } catch (err) {
              console.warn('Error fetching HVI metadata:', err);
            }
          }
        }
      } catch (err) {
        console.warn('Error checking files status:', err);
      }
    }

    parsedFiles.value = results;
    filesList.value = results; // Para el contador de procesar
  } catch (err) {
    console.error('Error scanning directory', err);
  }
}

async function refreshFolder() {
  try {
    const handle = await getDirHandle();
    if (!handle) return;
    const ok = await verifyPermission(handle);
    if (ok) {
      await scanDirectory(handle);
    }
  } catch (err) {
    console.warn('refreshFolder error', err);
  }
}

const handleFolderChange = async (event) => {
  const selectedFiles = Array.from(event.target.files);
  const txtFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.txt'));
  
  // Parse names for the table
  const results = txtFiles.map(file => parseFileName(file.name, null, file));

  // Verificar estado en la DB antes de mostrar
  if (results.length > 0) {
    try {
      const response = await fetch('/api/hvi/check-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNames: results.map(f => f.fileName) })
      });
      const result = await response.json();
      if (result.success) {
        // Marcar procesados
        results.forEach(f => {
          if (result.existingNames.includes(f.fileName)) {
            f.estado = 'Procesado';
          }
        });

        // Traer metadatos guardados y mezclarlos
        if (result.existingNames.length > 0) {
          try {
            const metaResp = await fetch('/api/hvi/get-metadata', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fileNames: result.existingNames })
            });
            const metaJson = await metaResp.json();
            if (metaJson.success && metaJson.metadata) {
              results.forEach(f => {
                const m = metaJson.metadata[f.fileName];
                if (m) {
                  if (m.muestra !== undefined && m.muestra !== null) f.muestra = m.muestra;
                  if (m.cantidad !== undefined && m.cantidad !== null) f.cantidad = m.cantidad;
                  if (m.color !== undefined && m.color !== null) f.color = m.color;
                  if (m.cort !== undefined && m.cort !== null) f.cort = m.cort;
                  if (m.obs !== undefined && m.obs !== null) f.obs = m.obs;
                }
              });
            }
          } catch (err) {
            console.warn('Error fetching HVI metadata:', err);
          }
        }
      }
    } catch (err) {
      console.warn('Error checking files status:', err);
    }
  }

  parsedFiles.value = results;
  filesList.value = results;

  // Intentar extraer el nombre de la carpeta si es posible
  if (txtFiles.length > 0 && txtFiles[0].webkitRelativePath) {
    const parts = txtFiles[0].webkitRelativePath.split('/');
    if (parts.length > 1) {
      folderPath.value = parts[0];
      saveFolderPath();
    }
  }
};

const parseFileName = (fileName, handle = null, file = null) => {
  // Formato esperado: Tipo_Lote_Proveedor_Grado_Fecha.txt
  // Ejemplo: Ent_616_CARAM_C-1-2_21-01-2026.txt
  
  // 1. Quitar extension
  const nameOnly = fileName.replace(/\.txt$/i, "");
  
  // 2. Separar por guiones bajos
  const parts = nameOnly.split('_');
  
  // 3. Extraer según lógica solicitada
  // Tipo: 3 primeras letras (o parte 0) - Normalizar a Título (Ent, Mue)
  let rawTipo = parts[0] ? parts[0].substring(0, 3).toLowerCase() : "???";
  const tipo = rawTipo === 'ent' ? 'Ent' : (rawTipo === 'mue' ? 'Mue' : parts[0]);
  
  // Lote/Entrada: desde el cuarto carácter hasta que aparece un _ (o parte 1)
  const loteEntrada = parts[1] || "";
  
  // Proveedor: desde el segundo _ hasta el proximo _ (parte 2)
  const proveedor = parts[2] || "";
  
  // Lógica revisada para manejar guiones bajos variables en Grado y Fecha
  // El Grado puede tener múltiples segmentos (ej: C_1-2) y la Fecha es el último segmento
  let grado = "";
  let fecha = "";

  if (parts.length > 3) {
    // La fecha es siempre el último segmento del nombre
    fecha = parts[parts.length - 1];
    
    // El grado es todo lo que está entre el proveedor (index 2) y la fecha (el último)
    // Unimos con "-" para cumplir con el formato solicitado (C-1-2)
    let rawGrado = parts.slice(3, -1).join('-');
    
    // Transformar formatos como C-1-2 a C 1/2, D-1-4 a D 1/4, etc.
    // Buscamos el patrón: Letra-Número-Número
    grado = rawGrado.replace(/^([A-Z])-(\d)-(\d)$/, '$1 $2/$3');
  }

  return {
    fileName,
    handle,
    file,
    tipo,
    loteEntrada,
    proveedor,
    grado,
    fecha,
    muestra: "", // Input para el usuario
    cantidad: "", // Cantidad (Nuevo)
    color: "",    // Color (Nuevo)
    cort: "",     // Cort (Nuevo)
    obs: "",      // Observaciones (Nuevo)
    estado: "Pendiente"
  };
};

const selectFile = async (item) => {
  selectedFileName.value = item.fileName;
  selectedFileItem.value = item;
  hviDetails.value = [];

  try {
    let content = '';
    if (item.handle) {
      // From File System Access API
      const file = await item.handle.getFile();
      content = await file.text();
    } else if (item.file) {
      // From fallback input
      content = await item.file.text();
    }
    
    if (content) {
      parseHviDetails(content);
      
      // Para TIPO "Ent", autocompletar la cantidad con el número de fardos encontrados
      if (item.tipo === 'Ent' && hviDetails.value.length > 0) {
        item.cantidad = hviDetails.value.length;
      }
    }
  } catch (err) {
    console.error('Error reading HVI file', err);
  }
};

const handleSaveFromRow = async (item) => {
  if (selectedFileName.value !== item.fileName) {
    await selectFile(item);
  }
  processFiles();
};

const handleEditFromRow = (item) => {
  // Simplemente selecciona la fila para permitir editar los campos en la tabla
  if (selectedFileName.value !== item.fileName) {
    selectFile(item);
  }
};

const parseHviDetails = (content) => {
  const lines = content.split('\n');
  const detailRows = [];
  
  // Las informaciones empiezan en la fila 14 (index 13)
  for (let i = 13; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Separado por Espacio (múltiples espacios tratados como uno)
    const columns = line.split(/\s+/);
    
    // Criterio de validación: Ignorar filas de resumen tipo "Average" o "Q99%"
    // Y detenerse si encontramos 'n' en la primera columna (columna 1 según el usuario)
    const firstCol = columns[0] ? columns[0].toLowerCase() : '';
    
    // Criterio de parada: letra 'n' en la primera columna (marca el inicio de estadísticas)
    if (firstCol === 'n') {
      break;
    }
    
    // Filtrar filas de resumen y encabezados repetidos
    if (firstCol.includes('average') || firstCol.includes('q99%') || firstCol === '+/-' || firstCol === 'bale') {
      continue;
    }

    // Criterio de limpieza profunda: La segunda columna (ID/SCI) debe ser un número válido
    const secondColVal = columns[1];
    if (!secondColVal || isNaN(parseFloat(secondColVal))) {
      continue;
    }

    if (columns.length < 16) continue;
    
    // El usuario solicita que en la columna TIPO (grado de color) se cambie el "-" por "."
    // internamente para cálculos, aunque se muestre con coma en la tabla.
    const tipoFormateado = columns[12] ? columns[12].replace('-', '.') : '';
    
    detailRows.push({
      fardo: columns[0],
      sci: columns[1],
      mst: columns[2],
      mic: columns[3],
      mat: columns[4],
      uhml: columns[5],
      ui: columns[6],
      sf: columns[7],
      str: columns[8],
      elg: columns[9],
      rd: columns[10],
      plusB: columns[11], // Corresponde a PLUS_B en DB
      tipo: tipoFormateado,
      trCnt: columns[13],
      trAr: columns[14],
      trid: columns[15]
    });
  }
  hviDetails.value = detailRows;
};

// -----------------------------------------------------
// Exportar a Excel
// -----------------------------------------------------
const exportarExcel = async () => {
  if (hviDetails.value.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Sin datos',
      text: 'No hay datos HVI para exportar'
    });
    return;
  }

  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Datos HVI');

    // Configurar columnas con los nombres de la interfaz
    worksheet.columns = [
      { header: 'Fardo', key: 'fardo', width: 14 },
      { header: 'SCI', key: 'sci', width: 8 },
      { header: 'MST', key: 'mst', width: 8 },
      { header: 'MIC', key: 'mic', width: 8 },
      { header: 'MAT', key: 'mat', width: 8 },
      { header: 'UHML', key: 'uhml', width: 8 },
      { header: 'UI', key: 'ui', width: 8 },
      { header: 'SF', key: 'sf', width: 8 },
      { header: 'STR', key: 'str', width: 8 },
      { header: 'ELG', key: 'elg', width: 8 },
      { header: 'Rd', key: 'rd', width: 8 },
      { header: '+b', key: 'plusB', width: 8 },
      { header: 'TIPO', key: 'tipo', width: 10 },
      { header: 'TrCnt', key: 'trCnt', width: 8 },
      { header: 'TrAr', key: 'trAr', width: 8 },
      { header: 'TrID', key: 'trid', width: 8 },
    ];

    // Datos
    hviDetails.value.forEach(row => {
      worksheet.addRow({
        fardo: row.fardo,
        sci: parseFloat(row.sci) || 0,
        mst: parseFloat(row.mst) || 0,
        mic: parseFloat(row.mic) || 0,
        mat: parseFloat(row.mat) || 0,
        uhml: parseFloat(row.uhml) || 0,
        ui: parseFloat(row.ui) || 0,
        sf: parseFloat(row.sf) || 0,
        str: parseFloat(row.str) || 0,
        elg: parseFloat(row.elg) || 0,
        rd: parseFloat(row.rd) || 0,
        plusB: parseFloat(row.plusB) || 0,
        tipo: row.tipo, // String usually
        trCnt: parseFloat(row.trCnt) || 0,
        trAr: parseFloat(row.trAr) || 0,
        trid: parseFloat(row.trid) || 0
      });
    });

    // Estilo de Cabecera (Azul Oscuro, Texto Blanco)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' } // slate-800 equivalent
      };
      cell.font = {
        color: { argb: 'FFFFFFFF' },
        bold: true
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Estilo de datos (Bordes y Centrado)
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        
        // Formato condicional simple (ejemplo: alternar gris claro)
        if (rowNumber % 2 === 0) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF8FAFC' } // slate-50
          };
        }
      });
    });

    // Generar Buffer y Descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Crear link temporal
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `HVI_Export_${selectedFileName.value || 'data'}.xlsx`;
    anchor.click();
    window.URL.revokeObjectURL(url);

    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Excel exportado correctamente',
      showConfirmButton: false,
      timer: 2000
    });

  } catch (error) {
    console.error('Error exportando Excel:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo exportar el archivo Excel'
    });
  }
};

const processFiles = async () => {
  if (!selectedFileItem.value || hviDetails.value.length === 0) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: 'Seleccione un archivo con datos',
      showConfirmButton: false,
      timer: 3000
    });
    return;
  }

  // Validación de Color
  if (!selectedFileItem.value.color) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: 'Debe seleccionar un Color',
      showConfirmButton: false,
      timer: 3000
    });
    return;
  }

  // Validación de Cort (solo para Ent)
  if (selectedFileItem.value.tipo !== 'Mue' && !selectedFileItem.value.cort) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: 'Debe seleccionar un valor para Cort',
      showConfirmButton: false,
      timer: 3000
    });
    return;
  }

  // Validación de cantidad para muestras
  if (selectedFileItem.value.tipo === 'Mue' && (!selectedFileItem.value.cantidad || selectedFileItem.value.cantidad <= 0)) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: 'Debe ingresar la cantidad para muestras',
      showConfirmButton: false,
      timer: 3000
    });
    return;
  }

  // Toast de "Guardando..."
  const loadingToast = Swal.fire({
    title: 'Guardando datos...',
    html: 'Por favor, espere',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const payload = {
      files: [
        {
          metadata: {
            fileName: selectedFileItem.value.fileName,
            tipo: selectedFileItem.value.tipo,
            loteEntrada: selectedFileItem.value.loteEntrada,
            proveedor: selectedFileItem.value.proveedor,
            grado: selectedFileItem.value.grado,
            fecha: selectedFileItem.value.fecha,
            muestra: selectedFileItem.value.muestra,
            cantidad: selectedFileItem.value.cantidad,
            color: selectedFileItem.value.color,
            cort: selectedFileItem.value.tipo === 'Mue' ? null : selectedFileItem.value.cort,
            obs: selectedFileItem.value.obs
          },
          details: hviDetails.value
        }
      ]
    };

    const response = await fetch('/api/hvi/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    // Cerrar loading
    Swal.close();

    if (result.success) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Datos guardados correctamente',
        showConfirmButton: false,
        timer: 3000
      });
      selectedFileItem.value.estado = "Procesado";

      // Si no quedan archivos en la tabla 1 o todos están procesados,
      // limpiar la selección y los detalles (tabla 2) para que no persistan.
      const allProcessed = parsedFiles.value.length === 0 || parsedFiles.value.every(f => f.estado === 'Procesado');
      if (allProcessed) {
        selectedFileName.value = '';
        selectedFileItem.value = null;
        hviDetails.value = [];
      }
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: result.error
      });
    }
  } catch (err) {
    Swal.close();
    console.error("Error en processFiles:", err);
    Swal.fire({
      icon: 'error',
      title: 'Error de conexión',
      text: 'No se pudo contactar con el servidor'
    });
  }
};

onMounted(async () => {
  try {
    const handle = await getDirHandle();
    if (handle) {
      hasPersistedHandle.value = true;
      console.log('Carpeta persistida encontrada:', handle.name);
      folderPath.value = handle.name;
      
      // Verificar permisos y escanear automáticamente
      const ok = await verifyPermission(handle);
      if (ok) {
        await scanDirectory(handle);
      }
    }
  } catch (err) {
    console.warn('onMounted getDirHandle error', err);
  }
});
</script>

<style scoped>
/* Estilos para quitar los spinners de los inputs de tipo number */
.no-spinner::-webkit-inner-spin-button,
.no-spinner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

.no-spinner {
  -moz-appearance: textfield;
  appearance: textfield;
}

.overflow-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.overflow-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.overflow-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
