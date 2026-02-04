<template>
    <div class="w-full h-screen flex flex-col p-1 overflow-hidden">
        <!-- Debug badge desarrollo -->
        <div v-if="showDebug"
            class="fixed bottom-2 right-2 z-50 bg-black/70 text-white text-xs px-2 py-1 rounded shadow">
            w: {{ viewportWidth }} | isMobile: {{ isMobile }}
        </div>

        <main
            class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col overflow-hidden">
            <div v-if="isLoading" class="text-center py-12 flex-1">
                <div class="text-slate-600 text-lg">Cargando datos...</div>
            </div>

            <div v-else-if="error" class="text-center py-12 flex-1">
                <div class="text-red-600 mb-4">Error: {{ error }}</div>
                <button @click="fetchData" class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    Reintentar
                </button>
            </div>

            <!-- Layout móvil (<768px) -->
            <template v-else-if="isMobile">
                <div class="flex flex-col h-full">
                    <!-- Fila 1: Ne (4ch) + Ver (métrica flexible) -->
                    <div class="mb-2 flex items-center gap-3 w-full flex-shrink-0">
                        <span class="text-sm text-slate-600 shrink-0">Ne:</span>
                        <select v-model="selectedNomcount" class="px-1 py-1 border rounded-md text-sm shrink-0"
                            style="width:10ch;min-width:10ch;max-width:10ch;">
                            <option :value="null">Elija Ne</option>
                            <option v-for="nomcount in availableNomcounts" :key="nomcount" :value="nomcount">
                                {{ nomcount }}
                            </option>
                        </select>
                        <span class="text-sm text-slate-600 shrink-0">OE:</span>
                        <select v-model="selectedOe" :disabled="!selectedNomcount"
                            class="px-1 py-1 border rounded-md text-sm shrink-0"
                            style="width:7ch;min-width:7ch;max-width:7ch;">
                            <option :value="null">Todos</option>
                            <option v-for="oe in availableOes" :key="oe" :value="oe">
                                {{ oe }}
                            </option>
                        </select>
                        <span class="text-sm text-slate-600 shrink-0">Ver:</span>
                        <select v-model="selectedVariable"
                            class="px-1 py-1 border rounded-md text-sm flex-1 min-w-0 max-w-full overflow-hidden text-ellipsis">
                            <option v-for="variable in availableVariables" :key="variable.key" :value="variable.key">
                                {{ variable.label }}
                            </option>
                        </select>
                    </div>
                    <!-- Fila 2: LCL, Prom., UCL -->
                    <div v-if="selectedNomcount"
                        class="mb-3 flex items-center gap-4 text-slate-700 text-xs flex-wrap flex-shrink-0">
                        <div class="whitespace-nowrap"><span class="font-semibold">LCL:</span> <span
                                class="text-blue-600 font-semibold">{{ globalLcl.toFixed(1) }}</span></div>
                        <div class="whitespace-nowrap"><span class="font-semibold">Prom.:</span> {{
                            globalMean.toFixed(1) }}</div>
                        <div class="whitespace-nowrap"><span class="font-semibold">UCL:</span> <span
                                class="text-red-600 font-semibold">{{ globalUcl.toFixed(1) }}</span></div>
                        <div class="whitespace-nowrap"><span class="font-semibold">Ensayos:</span> {{ stats.length }}
                        </div>
                    </div>
                    <!-- Mensaje si no hay Ne seleccionado -->
                    <div v-if="!selectedNomcount" class="text-center py-8 text-slate-500 flex-1">
                        Por favor seleccione un título nominal para ver el gráfico de control
                    </div>
                    <!-- Gráfico maximizado -->
                    <div v-else class="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div class="flex-1 min-h-0 overflow-hidden">
                            <StatsChart :stats="stats" :globalMean="globalMean" :globalUcl="globalUcl"
                                :globalLcl="globalLcl" :variableLabel="currentVariableLabel"
                                :standardValue="standardNeValue" @open-ensayo-detail="handleOpenEnsayoDetail"
                                @open-huso-detail="handleOpenHusoDetail" />
                        </div>
                    </div>
                </div>
            </template>

            <!-- Layout escritorio (>=768px) -->
            <div v-else class="flex flex-col h-full">
                <!-- Encabezado Minimalista -->
                <div class="px-1 py-2 mb-2 flex-shrink-0 border-b border-slate-100">
                    <div class="flex flex-wrap items-center justify-between gap-4">
                        
                        <!-- Izquierda: Data Source & Filtros -->
                        <div class="flex items-center gap-6">
                            <!-- Data Source Toggle (oculto en móvil) -->
                            <div class="hidden md:flex items-center gap-1">
                                <button @click="changeDataSource('oracle')" :disabled="!isLocalhost"
                                    v-tippy="{ content: isLocalhost ? 'Datos desde Oracle (Localhost)' : 'Oracle solo disponible en localhost', placement: 'bottom', theme: 'custom' }"
                                    :aria-label="'Cambiar a Oracle'" :class="[
                                        'inline-flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200',
                                        dataSource === 'oracle' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600',
                                        !isLocalhost ? 'opacity-50 cursor-not-allowed' : ''
                                    ]">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" stroke-width="2">
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                        <line x1="8" y1="21" x2="16" y2="21"></line>
                                        <line x1="12" y1="17" x2="12" y2="21"></line>
                                    </svg>
                                </button>
                                <button @click="changeDataSource('firebase')"
                                    v-tippy="{ content: 'Datos desde Firebase (Producción)', placement: 'bottom', theme: 'custom' }"
                                    aria-label="Cambiar a Firebase" :class="[
                                        'inline-flex items-center justify-center w-7 h-7 rounded-full transition-all duration-200',
                                        dataSource === 'firebase' ? 'bg-orange-500 text-white shadow-sm' : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                    ]">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24"
                                        fill="currentColor">
                                        <path
                                            d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z" />
                                    </svg>
                                </button>
                            </div>

                            <!-- Filtros -->
                            <div class="flex items-center gap-4">
                                <!-- Ne -->
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ne</span>
                                    <select v-model="selectedNomcount"
                                        class="px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-colors font-medium text-slate-700"
                                        style="width:10ch;min-width:10ch;max-width:10ch;">
                                        <option :value="null">Elija Ne</option>
                                        <option v-for="nomcount in availableNomcounts" :key="nomcount" :value="nomcount">
                                            {{ nomcount }}
                                        </option>
                                    </select>
                                </div>
                                <!-- OE -->
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OE</span>
                                    <select v-model="selectedOe" :disabled="!selectedNomcount"
                                        class="px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-colors text-slate-700 min-w-[5rem] disabled:opacity-50">
                                        <option :value="null">Todos</option>
                                        <option v-for="oe in availableOes" :key="oe" :value="oe">
                                            {{ oe }}
                                        </option>
                                    </select>
                                </div>
                                <!-- Ver -->
                                <div class="flex items-center gap-2">
                                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ver</span>
                                    <select v-model="selectedVariable"
                                        class="px-2 py-1 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 hover:bg-white transition-colors text-slate-700">
                                        <option v-for="variable in availableVariables" :key="variable.key"
                                            :value="variable.key">
                                            {{ variable.label }}
                                        </option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- Derecha: Stats & Atajos -->
                        <div class="flex items-center gap-6" v-if="selectedNomcount">
                            <!-- Stats Row -->
                            <div class="flex items-center gap-3 text-sm">
                                <!-- LCL -->
                                <div class="flex items-center gap-1.5">
                                    <span class="text-slate-400 font-medium text-xs uppercase">LCL</span>
                                    <span class="font-semibold text-orange-500">{{ globalLcl.toFixed(1) }}</span>
                                </div>
                                <div class="w-px h-3 bg-slate-200"></div>
                                <!-- Promedio -->
                                <div class="flex items-center gap-1.5">
                                    <span class="text-slate-400 font-medium text-xs uppercase">Promedio</span>
                                    <span class="font-semibold text-slate-700">{{ globalMean.toFixed(1) }}</span>
                                </div>
                                <div class="w-px h-3 bg-slate-200"></div>
                                <!-- UCL -->
                                <div class="flex items-center gap-1.5">
                                    <span class="text-slate-400 font-medium text-xs uppercase">UCL</span>
                                    <span class="font-semibold text-orange-500">{{ globalUcl.toFixed(1) }}</span>
                                </div>
                                <div class="w-px h-3 bg-slate-200"></div>
                                <!-- Total -->
                                <div class="flex items-center gap-1.5">
                                    <span class="text-slate-400 font-medium text-xs uppercase">Total</span>
                                    <span class="font-semibold text-slate-700">{{ stats.length }}</span>
                                </div>
                            </div>

                            <!-- Checkbox Mostrar Valores -->
                            <div class="flex items-center gap-2 pl-4 border-l border-slate-100">
                                <label class="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        v-model="showChartValues"
                                        class="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                    >
                                    <span class="text-xs font-normal text-slate-700">Mostrar Valores</span>
                                </label>
                            </div>

                            <!-- Atajos de teclado -->
                            <div class="hidden lg:flex items-center gap-1.5 pl-3 border-l border-slate-100">
                                <span class="text-[10px] text-slate-500 font-medium mr-0.5">Atajos:</span>
                                <span class="px-1 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] text-slate-500 font-mono cursor-help transition-colors hover:border-slate-300 hover:text-slate-700"
                                      v-tippy="{ content: 'Presione Ctrl sobre un punto del grafico para ver los valores de los ensayos de Uster y Tensorapid', placement: 'bottom' }">
                                    Ctrl
                                </span>
                                <span class="px-1 py-0.5 rounded border border-slate-200 bg-slate-50 text-[9px] text-slate-500 font-mono cursor-help transition-colors hover:border-slate-300 hover:text-slate-700"
                                      v-tippy="{ content: 'Presione Shift sobre un punto del grafico para ver un grafico con los valores de ese dia por cada huso', placement: 'bottom' }">
                                    Shift
                                </span>
                            </div>

                            <!-- Botón copiar gráfico -->
                            <div class="hidden lg:flex items-center pl-3 border-l border-slate-100">
                                <button @click="copyChartAsImage" type="button"
                                    v-tippy="{ content: 'Copiar como imagen para WhatsApp', placement: 'bottom', theme: 'custom' }"
                                    class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all duration-200 group shadow-sm hover:shadow-md"
                                    aria-label="Copiar como imagen">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                                        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Mostrar mensaje si no hay NOMCOUNT seleccionado -->
                <div v-if="!selectedNomcount" class="text-center py-8 text-slate-500 flex-1">
                    Por favor seleccione un título nominal para ver el gráfico de control
                </div>

                <!-- Gráfico maximizado -->
                <div v-else class="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <StatsChart :stats="stats" :globalMean="globalMean" :globalUcl="globalUcl" :globalLcl="globalLcl"
                        :variableLabel="currentVariableLabel" :standardValue="standardNeValue"
                        :showValues="showChartValues"
                        @open-ensayo-detail="handleOpenEnsayoDetail" @open-huso-detail="handleOpenHusoDetail" />
                </div>
            </div>

            <!-- Modal detalle de ensayo (mismo diseño que ResumenEnsayos) -->
            <div v-if="modalVisible" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog"
                aria-modal="true">
                <!-- Backdrop -->
                <div class="fixed inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm z-40"
                    @click="closeModal" aria-hidden="true"></div>

                <!-- Modal content -->
                <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col p-3 z-50 relative"
                    role="document">
                    <!-- Botón anterior (pegado al lado izquierdo del modal) -->
                    <button v-if="canNavigatePrevious" @click="navigatePrevious"
                        v-tippy="{ content: 'Anterior — Atajo: ← (ArrowLeft)', placement: 'left', theme: 'custom' }"
                        class="absolute left-0 top-1/2 -translate-y-1/2 -ml-6 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 z-50"
                        aria-label="Ensayo anterior">‹</button>

                    <!-- Botón siguiente (pegado al lado derecho del modal) -->
                    <button v-if="canNavigateNext" @click="navigateNext"
                        v-tippy="{ content: 'Siguiente — Atajo: → (ArrowRight)', placement: 'right', theme: 'custom' }"
                        class="absolute right-0 top-1/2 -translate-y-1/2 -mr-6 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 z-50"
                        aria-label="Ensayo siguiente">›</button>
                    <header class="flex items-start sm:items-center justify-between mb-2 pb-1 gap-3">
                        <div class="flex flex-col sm:flex-row sm:items-center gap-2 mx-8">
                            <div class="text-slate-600 text-sm">Fecha: <span
                                    class="text-slate-900 text-lg font-semibold ml-1">{{
                                        modalMeta.fechaStr }}</span>
                            </div>
                            <div class="text-slate-600 text-sm">Ne: <span
                                    class="text-slate-900 text-lg font-semibold ml-1">{{
                                        modalMeta.ne }}</span></div>
                            <div class="text-slate-600 text-sm">OE Nro.: <span
                                    class="text-slate-900 text-lg font-semibold ml-1">{{
                                        modalMeta.oe }}</span></div>
                            <div class="text-slate-600 text-sm">Ensayo Uster <span
                                    class="text-slate-900 text-lg font-semibold ml-1">{{ modalMeta.u }}</span> y
                                TensoRapid <span class="text-slate-900 text-lg font-semibold ml-1">{{ modalMeta.t
                                    }}</span></div>
                        </div>

                        <div class="flex items-center gap-2">
                            <!-- Copy as image button -->
                            <button @click="copyModalAsImage" type="button"
                                v-tippy="{ content: 'Copiar como imagen para WhatsApp', placement: 'bottom', theme: 'custom' }"
                                class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all duration-200 group shadow-sm hover:shadow-md"
                                aria-label="Copiar como imagen">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                    stroke-linejoin="round">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                            </button>

                            <!-- Close button -->
                            <button @click="closeModal" type="button"
                                class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 flex items-center justify-center text-slate-600 hover:text-red-600 transition-all duration-200 shadow-sm hover:shadow-md"
                                aria-label="Cerrar detalle">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" stroke-width="2" stroke-linecap="round"
                                    stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </header>

                    <!-- Observaciones, Op. Uster y Op. TensoRapid -->
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
                        <div v-if="mergedRows.length === 0" class="text-sm text-slate-600 py-8 text-center">No hay
                            datos para este ensayo.</div>
                        <div v-else class="rounded-xl border border-slate-200 overflow-auto max-h-[calc(98vh-8rem)]">
                            <table class="min-w-full text-xs">
                                <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-30">
                                    <tr>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Huso</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Titulo</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Desvío %</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            CVm %</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Delg -30%</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Delg -40%</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Delg -50%</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Grue +35%</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Grue +50%</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Neps +140%</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Neps +280%</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Fuerza B</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Elongación %</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Tenacidad</th>
                                        <th
                                            class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">
                                            Trabajo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(row, idx) in mergedRows" :key="idx"
                                        :class="['transition-colors duration-150', modalLoading ? 'bg-slate-50/50' : 'hover:bg-slate-50']">
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            row.NO }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.TITULO) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 font-semibold" :class="{
                                            'text-red-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) > 1.5,
                                            'text-blue-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) < -1.5,
                                            'text-green-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) >= -1.5 && parseFloat(row.DESVIO_PERCENT) <= 1.5,
                                            'text-slate-700': !row.DESVIO_PERCENT
                                        }">{{ row.DESVIO_PERCENT ? row.DESVIO_PERCENT + '%' : '' }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.CVM_PERCENT) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.DELG_MINUS30_KM) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.DELG_MINUS40_KM) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.DELG_MINUS50_KM) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.GRUE_35_KM) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.GRUE_50_KM) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.NEPS_140_KM) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.NEPS_280_KM) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.FUERZA_B) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.ELONGACION) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.TENACIDAD) }}</td>
                                        <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{
                                            fmtCell(row.TRABAJO) }}</td>
                                    </tr>

                                    <!-- Filas de estadísticas (Promedio, CV, s, Q95, Máx, Mín) -->
                                    <tr
                                        class="bg-gradient-to-r from-blue-50 to-indigo-50 font-semibold border-t-2 border-blue-200">
                                        <td class="px-3 py-1 text-slate-700">Promedio</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TITULO?.avg) }}</td>
                                        <td class="px-3 py-1 text-center font-semibold" :class="{
                                            'text-red-600': combinedStats.DESVIO_PERCENT?.avg > 1.5,
                                            'text-blue-600': combinedStats.DESVIO_PERCENT?.avg < -1.5,
                                            'text-green-600': combinedStats.DESVIO_PERCENT?.avg >= -1.5 && combinedStats.DESVIO_PERCENT?.avg <= 1.5,
                                            'text-slate-700': combinedStats.DESVIO_PERCENT?.avg == null
                                        }">
                                            {{ combinedStats.DESVIO_PERCENT?.avg != null ? (combinedStats.DESVIO_PERCENT.avg > 0 ? '+' : '') + fmtStat(combinedStats.DESVIO_PERCENT.avg) + '%' : '' }}
                                        </td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.CVM_PERCENT?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS30_KM?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS40_KM?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS50_KM?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_35_KM?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_50_KM?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_140_KM?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_280_KM?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.FUERZA_B?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.ELONGACION?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TENACIDAD?.avg) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TRABAJO?.avg) }}</td>
                                    </tr>
                                    <tr class="bg-blue-50/50 font-medium">
                                        <td class="px-3 py-1 text-slate-700">CV</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TITULO?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700"></td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.CVM_PERCENT?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS30_KM?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS40_KM?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS50_KM?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_35_KM?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_50_KM?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_140_KM?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_280_KM?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.FUERZA_B?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.ELONGACION?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TENACIDAD?.cv) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TRABAJO?.cv) }}</td>
                                    </tr>
                                    <tr class="bg-indigo-50/50 font-medium">
                                        <td class="px-3 py-1 text-slate-700">s</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TITULO?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700"></td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.CVM_PERCENT?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS30_KM?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS40_KM?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS50_KM?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_35_KM?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_50_KM?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_140_KM?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_280_KM?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.FUERZA_B?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.ELONGACION?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TENACIDAD?.sd) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TRABAJO?.sd) }}</td>
                                    </tr>
                                    <tr class="bg-blue-50/50 font-medium">
                                        <td class="px-3 py-1 text-slate-700">Q95</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TITULO?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700"></td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.CVM_PERCENT?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS30_KM?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS40_KM?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS50_KM?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_35_KM?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_50_KM?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_140_KM?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_280_KM?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.FUERZA_B?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.ELONGACION?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TENACIDAD?.q95) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TRABAJO?.q95) }}</td>
                                    </tr>
                                    <tr class="bg-indigo-50/50 font-medium">
                                        <td class="px-3 py-1 text-slate-700">Máx</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TITULO?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700"></td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.CVM_PERCENT?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS30_KM?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS40_KM?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS50_KM?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_35_KM?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_50_KM?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_140_KM?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_280_KM?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.FUERZA_B?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.ELONGACION?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TENACIDAD?.max) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TRABAJO?.max) }}</td>
                                    </tr>
                                    <tr class="bg-blue-50/50 font-medium">
                                        <td class="px-3 py-1 text-slate-700">Mín</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TITULO?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700"></td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.CVM_PERCENT?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS30_KM?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS40_KM?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.DELG_MINUS50_KM?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_35_KM?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.GRUE_50_KM?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_140_KM?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.NEPS_280_KM?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.FUERZA_B?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.ELONGACION?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TENACIDAD?.min) }}</td>
                                        <td class="px-3 py-1 text-center text-slate-700">{{
                                            fmtStat(combinedStats.TRABAJO?.min) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <!-- Loading overlay -->
                        <div v-if="modalLoading"
                            class="absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center">
                            <div
                                class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-slate-300 border-t-blue-600">
                            </div>
                            <p class="mt-3 text-base text-slate-700 font-medium">Cargando ensayo...</p>
                        </div>
                    </section>
                </div>
            </div>

            <!-- Huso detail modal (10 individual values) -->
            <HusoDetailModal :visible="husoModalVisible" :values="husoModalData.values"
                :husoNumbers="husoModalData.husoNumbers" :testnr="husoModalData.testnr"
                :timestamp="husoModalData.timestamp" :oe="husoModalData.oe" :standardNe="husoModalData.standardNe"
                :variableLabel="currentVariableLabel" 
                :canNavigatePrevious="canNavigateHusoPrevious"
                :canNavigateNext="canNavigateHusoNext"
                @close="closeHusoModal"
                @navigate-previous="navigateHusoPrevious"
                @navigate-next="navigateHusoNext" />
        </main>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import StatsChart from './uster-stats/StatsChart.vue'
import HusoDetailModal from './uster-stats/HusoDetailModal.vue'
import { fetchAllStatsData, setDataSource } from '../services/dataService'
import Swal from 'sweetalert2'
import { toPng } from 'html-to-image'

// Data fetched from backend
const usterTbl = ref([])
const usterPar = ref([])
const tensorapidTbl = ref([])
const tensorapidPar = ref([])
const isLoading = ref(false)
const error = ref(null)
const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
const dataSource = ref(isLocalhost ? 'oracle' : 'firebase') // Forzar firebase en producción

// Runtime flag para layout móvil (<768px) con matchMedia
const showDebug = ref(import.meta?.env?.DEV === true)
const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 0)
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth < 768 : false)
let mq = null
if (typeof window !== 'undefined') {
    mq = window.matchMedia('(max-width: 767px)')
    isMobile.value = mq.matches
}
function updateIsMobile() {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1024
    const mediaMatch = mq ? mq.matches : (width < 768)
    isMobile.value = mediaMatch
}
function handleResize() {
    updateIsMobile()
    viewportWidth.value = typeof window !== 'undefined' ? window.innerWidth : 0
}

// Selected NOMCOUNT and variable
const selectedNomcount = ref(null)
const selectedVariable = ref('TITULO')
const selectedOe = ref(null)

// Available variables for selection
const availableVariables = [
    { key: 'TITULO', label: 'Titulo Ne', source: 'uster' },
    { key: 'CVM_PERCENT', label: 'CVM%', source: 'uster' },
    { key: 'DELG_MINUS30_KM', label: 'Delg -30% (km)', source: 'uster' },
    { key: 'DELG_MINUS40_KM', label: 'Delg -40% (km)', source: 'uster' },
    { key: 'DELG_MINUS50_KM', label: 'Delg -50% (km)', source: 'uster' },
    { key: 'GRUE_35_KM', label: 'Grue +35% (km)', source: 'uster' },
    { key: 'GRUE_50_KM', label: 'Grue +50% (km)', source: 'uster' },
    { key: 'NEPS_140_KM', label: 'Neps +140% (km)', source: 'uster' },
    { key: 'NEPS_280_KM', label: 'Neps +280% (km)', source: 'uster' },
    { key: 'FUERZA_B', label: 'Fuerza B (cN/tex)', source: 'tensorapid' },
    { key: 'ELONGACION', label: 'Elongación (%)', source: 'tensorapid' },
    { key: 'TENACIDAD', label: 'Tenacidad (cN/tex)', source: 'tensorapid' },
    { key: 'TRABAJO', label: 'Trabajo (N*mm)', source: 'tensorapid' }
]

// Fetch data from backend (Oracle or Firebase)
async function fetchData() {
    isLoading.value = true
    error.value = null
    try {
        setDataSource(dataSource.value)
        const data = await fetchAllStatsData()

        usterTbl.value = data.usterTbl || []
        usterPar.value = data.usterPar || []
        tensorapidTbl.value = data.tensorapidTbl || []
        tensorapidPar.value = data.tensorapidPar || []

        console.log(`✅ Datos cargados desde ${data.source}:`, {
            usterPar: usterPar.value.length,
            usterTbl: usterTbl.value.length,
            tensorapidPar: tensorapidPar.value.length,
            tensorapidTbl: tensorapidTbl.value.length
        })
    } catch (err) {
        console.error('Error fetching data:', err)
        error.value = err.message
    } finally {
        isLoading.value = false
    }
}

// Change data source and reload
function changeDataSource(newSource) {
    if (!isLocalhost && newSource === 'oracle') {
        // No permitir cambiar a oracle en producción
        console.warn('La fuente Oracle solo está disponible en entorno local.')
        return
    }
    dataSource.value = newSource
    fetchData()
}

// Get current variable label for display
const currentVariableLabel = computed(() => {
    const variable = availableVariables.find(v => v.key === selectedVariable.value)
    return variable ? variable.label : selectedVariable.value
})

// Helper: formatear Ne con 'Flame' si es hilo de fantasía
function formatNe(nomcount, matclass) {
    if (nomcount == null || nomcount === '') return ''
    let ne = String(nomcount).trim()
    if (matclass && String(matclass).toLowerCase() === 'hilo de fantasia') {
        return ne + 'Flame'
    }
    return ne
}

// Format OE: remove leading zeros and extract first 2 letters
// Example: "0012ABCD" -> "12 AB", "5XY" -> "5 XY", "003 LP" -> "3 LP"
function formatOe(oe) {
    if (!oe) return oe
    const str = String(oe).trim()
    if (!str) return str

    // Separar números y letras (con o sin espacio intermedio)
    const match = str.match(/^(\d+)\s*([A-Za-z]+)?/)
    if (!match) return str

    const numPart = parseInt(match[1], 10) // Quita ceros a la izquierda
    const letterPart = match[2] ? match[2].substring(0, 2).toUpperCase() : ''

    return letterPart ? `${numPart} ${letterPart}` : String(numPart)
}

// Get unique NOMCOUNT values
const availableNomcounts = computed(() => {
    const nomcounts = new Set()
    for (const row of usterPar.value) {
        if (row.NOMCOUNT != null && row.NOMCOUNT !== '') {
            const formattedNe = formatNe(row.NOMCOUNT, row.MATCLASS)
            nomcounts.add(formattedNe)
        }
    }
    return Array.from(nomcounts).sort((a, b) => {
        const numA = parseFloat(a)
        const numB = parseFloat(b)
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB
        return String(a).localeCompare(String(b))
    })
})

// Get unique OEs for selected NOMCOUNT
const availableOes = computed(() => {
    if (!selectedNomcount.value) return []
    const oes = new Set()
    for (const row of usterPar.value) {
        const formattedNe = formatNe(row.NOMCOUNT, row.MATCLASS)
        if (formattedNe === selectedNomcount.value) {
            const oe = row.MASCHNR || row.OE || row.OE_NRO || null
            if (oe != null && oe !== '') {
                oes.add(formatOe(oe))
            }
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

// Reset selectedOe when selectedNomcount changes
watch(selectedNomcount, () => {
    selectedOe.value = null
})

// Get TESTNRs for selected NOMCOUNT and OE
const filteredTestnrs = computed(() => {
    if (!selectedNomcount.value) return []
    return usterPar.value
        .filter(row => {
            const formattedNe = formatNe(row.NOMCOUNT, row.MATCLASS)
            if (formattedNe !== selectedNomcount.value) return false

            // Si hay OE seleccionado, filtrar por OE
            if (selectedOe.value) {
                const rawOe = row.MASCHNR || row.OE || row.OE_NRO || null
                return formatOe(rawOe) === selectedOe.value
            }
            return true
        })
        .map(row => row.TESTNR)
        .filter(Boolean)
})

// Process data: group by TESTNR and compute stats (filtered by selected NOMCOUNT)
const stats = computed(() => {
    if (!selectedNomcount.value) return []

    // Detect if current variable is from TENSORAPID
    const currentVar = availableVariables.find(v => v.key === selectedVariable.value)
    const isTensorapid = currentVar?.source === 'tensorapid'

    // Filter TESTNR based on selected NOMCOUNT
    const validTestnrs = new Set(filteredTestnrs.value)

    // Group rows by TESTNR (only for TESTNRs matching selected NOMCOUNT)
    const grouped = {}

    if (isTensorapid) {
        // For TENSORAPID variables: map USTER_TESTNR -> TENSORAPID_TESTNR(s)
        const usterToTensorMap = new Map()
        for (const tpar of tensorapidPar.value) {
            const usterTestnr = tpar.USTER_TESTNR
            const tensorTestnr = tpar.TESTNR
            if (!usterTestnr || !tensorTestnr) continue

            if (!usterToTensorMap.has(usterTestnr)) {
                usterToTensorMap.set(usterTestnr, [])
            }
            usterToTensorMap.get(usterTestnr).push(tensorTestnr)
        }

        // For each USTER TESTNR in validTestnrs, find corresponding TENSORAPID TESTNRs
        for (const usterTestnr of validTestnrs) {
            const tensorTestnrs = usterToTensorMap.get(usterTestnr) || []

            for (const row of tensorapidTbl.value) {
                if (!tensorTestnrs.includes(row.TESTNR)) continue

                const variableValue = parseFloat(row[selectedVariable.value])
                if (isNaN(variableValue)) continue

                // Group by USTER_TESTNR (not TENSORAPID TESTNR) for consistent display
                if (!grouped[usterTestnr]) {
                    grouped[usterTestnr] = { values: [], timestamps: [], oe: null, ne: null }
                }
                grouped[usterTestnr].values.push(variableValue)

                // Get timestamp, OE and NE from USTER_PAR (for consistency across all variables)
                const parRow = usterPar.value.find(p => p.TESTNR === usterTestnr)
                if (parRow) {
                    if (parRow.TIME_STAMP) {
                        grouped[usterTestnr].timestamps.push(parRow.TIME_STAMP)
                    }
                    if (!grouped[usterTestnr].oe) {
                        const rawOe = parRow.MASCHNR || parRow.OE || parRow.OE_NRO || null
                        grouped[usterTestnr].oe = formatOe(rawOe)
                    }
                    if (!grouped[usterTestnr].ne) {
                        grouped[usterTestnr].ne = formatNe(parRow.NOMCOUNT, parRow.MATCLASS)
                    }
                }
            }
        }
    } else {
        // For USTER variables: process normally
        for (const row of usterTbl.value) {
            const testnr = row.TESTNR
            if (!testnr || !validTestnrs.has(testnr)) continue

            // Parse selected variable as number
            const variableValue = parseFloat(row[selectedVariable.value])
            if (isNaN(variableValue)) continue

            if (!grouped[testnr]) {
                grouped[testnr] = { values: [], timestamps: [], oe: null, ne: null }
            }
            grouped[testnr].values.push(variableValue)
            // collect TIME_STAMP (if available) for later selection
            let ts = row.TIME_STAMP
            // if TIME_STAMP not present or not parseable, try to fallback to USTER_PAR entry for this TESTNR
            if (!ts) {
                const parRow = usterPar.value.find(p => p.TESTNR === testnr)
                if (parRow && parRow.TIME_STAMP) ts = parRow.TIME_STAMP
            }
            if (ts) grouped[testnr].timestamps.push(ts)
            // Get OE from USTER_PAR if not already set
            if (!grouped[testnr].oe || !grouped[testnr].ne) {
                const parRow = usterPar.value.find(p => p.TESTNR === testnr)
                if (parRow) {
                    if (!grouped[testnr].oe) {
                        const rawOe = parRow.MASCHNR || parRow.OE || parRow.OE_NRO || null
                        grouped[testnr].oe = formatOe(rawOe)
                    }
                    if (!grouped[testnr].ne) {
                        grouped[testnr].ne = formatNe(parRow.NOMCOUNT, parRow.MATCLASS)
                    }
                }
            }
        }
    }

    // helper: robust date parsing from various DB formats
    function parseDateValue(t) {
        if (!t) return null
        if (t instanceof Date) return t
        // numbers -> epoch
        if (typeof t === 'number') return new Date(t)
        const s = String(t).trim()
        if (/^\d+$/.test(s)) {
            const n = Number(s)
            // if looks like epoch seconds or ms
            if (n > 1000000000000) return new Date(n) // ms
            if (n > 1000000000) return new Date(n * 1000) // seconds
        }

        // PRIORITY 1: explicit dd/mm/yyyy HH:mm or dd/mm/yy patterns (European format with optional time)
        let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+\d{1,2}:\d{2})?$/)
        if (m) {
            const part1 = Number(m[1])
            const part2 = Number(m[2])
            let year = Number(m[3])
            if (year < 100) year += 2000

            // Disambiguate formats:
            // - if first part > 12 => it's day (dd/mm)
            // - else if second part > 12 => it's day is second (mm/dd)
            // - else ambiguous -> assume European dd/mm (user preference)
            let day, mon
            if (part1 > 12) {
                day = part1
                mon = part2 - 1
            } else if (part2 > 12) {
                // treat as mm/dd
                day = part2
                mon = part1 - 1
            } else {
                // ambiguous: default to European dd/mm
                day = part1
                mon = part2 - 1
            }
            return new Date(year, mon, day)
        }
        // PRIORITY 2: DD-MON-YY like 05-NOV-25 (Oracle format)
        m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/i)
        if (m) {
            const monNames = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 }
            const monStr = m[2].toUpperCase()
            const monIdx = monNames[monStr]
            if (monIdx !== undefined) {
                let year = Number(m[3])
                if (year < 100) year += 2000
                return new Date(year, monIdx, Number(m[1]))
            }
        }

        // PRIORITY 3: ISO formats and other recognized formats (may interpret as American mm/dd)
        // Only use as fallback after explicit European formats checked
        let d = new Date(s)
        if (!isNaN(d.getTime())) return d

        return null
    }

    // Compute mean for each TESTNR
    const result = []
    for (const [testnr, payload] of Object.entries(grouped)) {
        const values = payload.values || []
        if (values.length === 0) continue

        const mean = values.reduce((sum, v) => sum + v, 0) / values.length

        // choose a representative timestamp for this TESTNR: pick earliest available after robust parsing
        let chosenTs = null
        if (payload.timestamps && payload.timestamps.length > 0) {
            const dates = payload.timestamps
                .map(t => parseDateValue(t))
                .filter(Boolean)
            if (dates.length > 0) {
                dates.sort((a, b) => a - b)
                chosenTs = dates[0]
            }
        }

        // format timestamp as dd/mm/yy for display (fallback to TESTNR if missing)
        let timestampFmt = null
        let timestampISO = null
        if (chosenTs) {
            const dd = String(chosenTs.getDate()).padStart(2, '0')
            const mm = String(chosenTs.getMonth() + 1).padStart(2, '0')
            const yy = String(chosenTs.getFullYear()).slice(-2)
            timestampFmt = `${dd}/${mm}/${yy}`
            timestampISO = chosenTs.toISOString()
        }

        result.push({
            testnr,
            n: values.length,
            mean,
            values,
            timestampISO,
            timestampFmt,
            oe: payload.oe || null,
            ne: payload.ne || null
        })
    }

    // Sort by timestamp if available, otherwise by TESTNR
    result.sort((a, b) => {
        if (a.timestampISO && b.timestampISO) return String(a.timestampISO).localeCompare(String(b.timestampISO))
        return String(a.testnr).localeCompare(String(b.testnr))
    })

    return result
})

// Compute global statistics over all values
const globalStats = computed(() => {
    const allValues = stats.value.flatMap(s => s.values)

    if (allValues.length === 0) {
        return { mean: 0, sd: 0, ucl: 0, lcl: 0 }
    }

    const mean = allValues.reduce((sum, v) => sum + v, 0) / allValues.length

    const variance = allValues.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / allValues.length
    const sd = Math.sqrt(variance)

    const ucl = mean + 3 * sd
    const lcl = mean - 3 * sd

    return { mean, sd, ucl, lcl }
})

const globalMean = computed(() => globalStats.value.mean)
const globalUcl = computed(() => globalStats.value.ucl)
const globalLcl = computed(() => globalStats.value.lcl)

// Get standard Ne value (NOMCOUNT) when a Ne is selected
const standardNeValue = computed(() => {
    // Only show standard line for 'TITULO' (Titulo Ne) variable
    if (!selectedNomcount.value) return null
    if (selectedVariable.value !== 'TITULO') return null

    // Find a PAR row that matches the selected Ne
    for (const row of usterPar.value) {
        const formattedNe = formatNe(row.NOMCOUNT, row.MATCLASS)
        if (formattedNe === selectedNomcount.value) {
            const nomcount = parseFloat(row.NOMCOUNT)
            if (!isNaN(nomcount)) {
                console.log('[standardNeValue] Showing standard line for Ne:', selectedNomcount.value, 'Value:', nomcount)
                return nomcount
            }
        }
    }
    return null
})

// Handler para abrir detalle de ensayo al presionar Ctrl en tooltip
const modalVisible = ref(false)
const modalLoading = ref(false)
const modalTestnr = ref(null)
const modalMeta = ref({})
const mergedRows = ref([])
const combinedStats = ref({})

// Huso detail modal state
const husoModalVisible = ref(false)
const husoModalData = ref({
    values: [],
    husoNumbers: [],
    testnr: null,
    timestamp: null,
    oe: null,
    standardNe: null
})
const showChartValues = ref(true) // Mostrar valores en el gráfico por defecto

// Helper functions for modal
function fmtCell(val) {
    if (val == null || val === '') return '—'
    const n = Number(val)
    if (isNaN(n)) return '—'
    return Number(n.toFixed(2)).toString()
}

function fmtStat(val) {
    if (val == null || val === '') return '—'
    const n = Number(val)
    if (isNaN(n)) return '—'
    return Number(n.toFixed(2)).toString()
}

async function handleOpenEnsayoDetail(testnr) {
    if (!testnr) return

    modalTestnr.value = testnr
    modalVisible.value = true
    modalLoading.value = true

    try {
        // Buscar datos en usterPar para metadata
        const parRow = usterPar.value.find(p => p.TESTNR === testnr)
        const rawOe = parRow?.MASCHNR || parRow?.OE || parRow?.OE_NRO || ''
        const formattedOe = formatOe(rawOe)

        // Formato de fecha usando la misma lógica que el gráfico
        let fechaStr = ''
        if (parRow?.TIME_STAMP) {
            // Parse the date using the same robust parsing as stats computation
            const ts = parRow.TIME_STAMP
            let d = null
            
            if (ts instanceof Date) {
                d = ts
            } else if (typeof ts === 'string') {
                // Try dd/mm/yyyy HH:mm or dd/mm/yy format first (European)
                const m = String(ts).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2})?$/)
                if (m) {
                    const day = Number(m[1])
                    const mon = Number(m[2]) - 1
                    let year = Number(m[3])
                    if (year < 100) year += 2000
                    d = new Date(year, mon, day)
                } else {
                    // Try DD-MON-YY format (Oracle)
                    const m2 = String(ts).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/i)
                    if (m2) {
                        const monNames = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 }
                        const monStr = m2[2].toUpperCase()
                        const monIdx = monNames[monStr]
                        if (monIdx !== undefined) {
                            let year = Number(m2[3])
                            if (year < 100) year += 2000
                            d = new Date(year, monIdx, Number(m2[1]))
                        }
                    }
                }
            } else if (typeof ts === 'number') {
                d = ts > 1000000000000 ? new Date(ts) : new Date(ts * 1000)
            }
            
            if (d && !isNaN(d.getTime())) {
                const dd = String(d.getDate()).padStart(2, '0')
                const mm = String(d.getMonth() + 1).padStart(2, '0')
                const yy = String(d.getFullYear()).slice(-2)
                fechaStr = `${dd}/${mm}/${yy}`
            }
        }

        modalMeta.value = {
            fechaStr,
            ne: formatNe(parRow?.NOMCOUNT, parRow?.MATCLASS) || '',
            oe: formattedOe,
            u: testnr,
            t: '', // TensoRapid TESTNR (se completa si hay match)
            obs: parRow?.OBS || '',
            laborant: parRow?.LABORANT || '',
            tensorLaborant: '' // Operador TensoRapid (se completa si hay match)
        }

        // Filtrar filas USTER_TBL
        let usterRows = (usterTbl.value || []).filter(r =>
            String(r.TESTNR || '') === String(testnr)
        )

        // Deduplicar
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

        // Buscar TensoRapid relacionado
        const tensorParMatches = (tensorapidPar.value || []).filter(r => {
            const usterTestnr = String(r.USTER_TESTNR || '')
            return usterTestnr === String(testnr)
        })

        const tensorTestnrsList = tensorParMatches.map(r => String(r.TESTNR || '')).filter(Boolean)
        if (tensorTestnrsList.length > 0) {
            modalMeta.value.t = tensorTestnrsList.join(', ')
            // Obtener el operador del primer TensoRapid match
            if (tensorParMatches[0]?.LABORANT) {
                modalMeta.value.tensorLaborant = tensorParMatches[0].LABORANT
            }
        }

        let tensorRows = (tensorapidTbl.value || []).filter(r => {
            const tblTestnr = String(r.TESTNR || '')
            return tensorTestnrsList.includes(tblTestnr)
        })

        tensorRows = dedupe(tensorRows, (r) => {
            const tn = String(r.TESTNR || r.testnr || '')
            const no = String(r.HUSO_NUMBER ?? r.NO ?? r.no ?? '')
            return tn && no ? `${tn}#${no}` : undefined
        })

        // Merge filas por número de huso (no por índice)
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

        // Solo mostrar husos que existen en Uster
        const usterHusos = Array.from(usterByHuso.keys())
        
        // Ordenar numéricamente los husos
        const sortedHusos = usterHusos.sort((a, b) => {
            const numA = parseInt(a) || 0
            const numB = parseInt(b) || 0
            return numA - numB
        })

        const merged = []

        // Obtener Ne estándar para calcular desvíos
        // modalMeta.value.ne ya tiene el Ne formateado (ej: "30" o "30Flame")
        const neStandard = parseFloat(String(modalMeta.value.ne || '').replace(',', '.'))

        sortedHusos.forEach(husoNum => {
            const uRow = usterByHuso.get(husoNum) || {}
            const tRow = tensorByHuso.get(husoNum) || {}

            // Calcular Desvío %
            const tituloVal = uRow.TITULO ?? ''
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
                FUERZA_B: tRow.FUERZA_B ?? '',
                ELONGACION: tRow.ELONGACION ?? '',
                TENACIDAD: tRow.TENACIDAD ?? '',
                TRABAJO: tRow.TRABAJO ?? ''
            })
        })

        mergedRows.value = merged

        // Calcular estadísticas
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
                const sum = values.reduce((a, b) => a + b, 0)
                const avg = sum / values.length
                const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / values.length
                const sd = Math.sqrt(variance)
                const cv = avg !== 0 ? (sd / avg) * 100 : null

                values.sort((a, b) => a - b)
                const q95Index = Math.floor(values.length * 0.95)
                const q95 = values[q95Index]
                const max = values[values.length - 1]
                const min = values[0]

                stats[field] = { avg, cv, sd, q95, max, min }
            } else {
                stats[field] = { avg: null, cv: null, sd: null, q95: null, max: null, min: null }
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
    } finally {
        modalLoading.value = false
    }
}

function closeModal() {
    modalVisible.value = false
    modalTestnr.value = null
    modalMeta.value = {}
    mergedRows.value = []
    combinedStats.value = {}
}

// Computed properties para navegación del modal
const currentModalIndex = computed(() => {
    if (!modalTestnr.value || stats.value.length === 0) return -1
    return stats.value.findIndex(s => s.testnr === modalTestnr.value)
})

const canNavigatePrevious = computed(() => currentModalIndex.value > 0)
const canNavigateNext = computed(() => currentModalIndex.value >= 0 && currentModalIndex.value < stats.value.length - 1)

// Funciones de navegación del modal
function navigatePrevious() {
    if (!canNavigatePrevious.value) return
    const prevStat = stats.value[currentModalIndex.value - 1]
    if (prevStat) {
        handleOpenEnsayoDetail(prevStat.testnr)
    }
}

function navigateNext() {
    if (!canNavigateNext.value) return
    const nextStat = stats.value[currentModalIndex.value + 1]
    if (nextStat) {
        handleOpenEnsayoDetail(nextStat.testnr)
    }
}

// Handler para abrir detalle de huso (10 valores individuales) al presionar Shift
async function handleOpenHusoDetail(pointData) {
    if (!pointData || !pointData.testnr) return

    const testnr = pointData.testnr
    const variableKey = selectedVariable.value

    console.log('[handleOpenHusoDetail] Opening huso detail for:', { testnr, variableKey })

    // Determine if variable is from USTER or TENSORAPID
    const currentVar = availableVariables.find(v => v.key === variableKey)
    const isTensorapid = currentVar?.source === 'tensorapid'

    let values = []
    let husoNumbers = []

    if (isTensorapid) {
        // For TENSORAPID: find matching TENSORAPID_TESTNR(s) via USTER_TESTNR
        const tensorTestnrs = tensorapidPar.value
            .filter(p => p.USTER_TESTNR === testnr)
            .map(p => p.TESTNR)

        // Get all rows for these TENSORAPID TESTNRs with huso numbers
        const rows = tensorapidTbl.value
            .filter(row => tensorTestnrs.includes(row.TESTNR))
            .sort((a, b) => (a.NO_ || a.NO || 0) - (b.NO_ || b.NO || 0))
        
        values = rows.map(row => parseFloat(row[variableKey])).filter(v => !isNaN(v))
        husoNumbers = rows.map(row => row.NO_ || row.NO || row.HUSO).filter(Boolean)
    } else {
        // For USTER: get rows matching TESTNR with huso numbers
        const rows = usterTbl.value
            .filter(row => row.TESTNR === testnr)
            .sort((a, b) => (a.NO_ || a.NO || 0) - (b.NO_ || b.NO || 0))
        
        values = rows.map(row => parseFloat(row[variableKey])).filter(v => !isNaN(v))
        husoNumbers = rows.map(row => row.NO_ || row.NO || row.HUSO).filter(Boolean)
    }

    // Get metadata from USTER_PAR
    const parRow = usterPar.value.find(p => p.TESTNR === testnr)
    let timestamp = null
    if (parRow?.TIME_STAMP) {
        // Parse the date using the same robust parsing as stats computation
        const ts = parRow.TIME_STAMP
        let d = null
        
        if (ts instanceof Date) {
            d = ts
        } else if (typeof ts === 'string') {
            // Try dd/mm/yyyy HH:mm or dd/mm/yy format first (European)
            const m = String(ts).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+\d{1,2}:\d{2})?$/)
            if (m) {
                const day = Number(m[1])
                const mon = Number(m[2]) - 1
                let year = Number(m[3])
                if (year < 100) year += 2000
                d = new Date(year, mon, day)
            } else {
                // Try DD-MON-YY format (Oracle)
                const m2 = String(ts).match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/i)
                if (m2) {
                    const monNames = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 }
                    const monStr = m2[2].toUpperCase()
                    const monIdx = monNames[monStr]
                    if (monIdx !== undefined) {
                        let year = Number(m2[3])
                        if (year < 100) year += 2000
                        d = new Date(year, monIdx, Number(m2[1]))
                    }
                }
            }
        } else if (typeof ts === 'number') {
            d = ts > 1000000000000 ? new Date(ts) : new Date(ts * 1000)
        }
        
        if (d && !isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0')
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const yy = String(d.getFullYear()).slice(-2)
            timestamp = `${dd}/${mm}/${yy}`
        }
    }

    const rawOe = parRow?.MASCHNR || parRow?.OE || parRow?.OE_NRO || null
    const oe = formatOe(rawOe)
    const standardNe = parRow?.NOMCOUNT || selectedNomcount.value

    // Populate modal data
    husoModalData.value = {
        values,
        husoNumbers,
        testnr,
        timestamp,
        oe,
        standardNe
    }

    husoModalVisible.value = true
}

function closeHusoModal() {
    husoModalVisible.value = false
    husoModalData.value = {
        values: [],
        husoNumbers: [],
        testnr: null,
        timestamp: null,
        oe: null,
        standardNe: null
    }
}

// Computed properties para navegación del modal de huso
const currentHusoModalIndex = computed(() => {
    if (!husoModalData.value.testnr || stats.value.length === 0) return -1
    return stats.value.findIndex(s => s.testnr === husoModalData.value.testnr)
})

const canNavigateHusoPrevious = computed(() => currentHusoModalIndex.value > 0)
const canNavigateHusoNext = computed(() => currentHusoModalIndex.value >= 0 && currentHusoModalIndex.value < stats.value.length - 1)

// Funciones de navegación del modal de huso
function navigateHusoPrevious() {
    if (!canNavigateHusoPrevious.value) return
    const prevStat = stats.value[currentHusoModalIndex.value - 1]
    if (prevStat) {
        handleOpenHusoDetail({ testnr: prevStat.testnr })
    }
}

function navigateHusoNext() {
    if (!canNavigateHusoNext.value) return
    const nextStat = stats.value[currentHusoModalIndex.value + 1]
    if (nextStat) {
        handleOpenHusoDetail({ testnr: nextStat.testnr })
    }
}

async function copyChartAsImage() {
    try {
        // Buscar el contenedor principal de la página (main con bg-white rounded-2xl)
        const pageContainer = document.querySelector('main.bg-white.rounded-2xl')
        if (!pageContainer) {
            await Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo encontrar el gráfico.'
            })
            return
        }

        const { toPng } = await import('html-to-image')
        const dataUrl = await toPng(pageContainer, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            skipFonts: true, // Evitar error de CORS con Google Fonts
            cacheBust: true
        })

        const blob = await (await fetch(dataUrl)).blob()
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ])

        await Swal.fire({
            icon: 'success',
            title: '¡Copiado!',
            text: 'Gráfico copiado al portapapeles',
            timer: 1500,
            showConfirmButton: false
        })
    } catch (err) {
        console.error('Error al copiar gráfico:', err)
        await Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo copiar el gráfico.'
        })
    }
}

async function copyModalAsImage() {
    try {
        const modalEl = document.querySelector('[role="document"]')
        if (!modalEl) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo encontrar el modal.'
            })
            return
        }

        // Hide buttons temporarily to clean the capture (use visibility to avoid layout shift)
        const copyBtn = document.querySelector('[aria-label="Copiar como imagen"]')
        const closeBtn = document.querySelector('[aria-label="Cerrar detalle"]')

        // Store original visibility values
        const originalCopyVis = copyBtn ? copyBtn.style.visibility : ''
        const originalCloseVis = closeBtn ? closeBtn.style.visibility : ''

        if (copyBtn) copyBtn.style.visibility = 'hidden'
        if (closeBtn) closeBtn.style.visibility = 'hidden'

        // Small delay to ensure DOM updates before capture
        await new Promise(resolve => setTimeout(resolve, 50))

        // Show loading state with minimal timer
        Swal.fire({
            title: 'Capturando...',
            allowOutsideClick: false,
            showConfirmButton: false,
            timer: 50,
            didOpen: () => {
                Swal.showLoading()
            }
        })

        // Temporarily suppress console.error for CSS and CORS warnings from html-to-image
        const originalConsoleError = console.error
        console.error = (...args) => {
            const message = args[0]?.toString() || ''
            if (message.includes('CSS rules') || message.includes('cssRules') || message.includes('SecurityError')) {
                return
            }
            originalConsoleError.apply(console, args)
        }

        try {
            const dataUrl = await toPng(modalEl, {
                quality: 0.95,
                pixelRatio: 2,
                backgroundColor: '#ffffff',
                skipFonts: true,
                cacheBust: true
            })

            // Restore console.error
            console.error = originalConsoleError

            // Restore buttons
            if (copyBtn) copyBtn.style.visibility = originalCopyVis
            if (closeBtn) closeBtn.style.visibility = originalCloseVis

            // Convert data URL to blob
            const response = await fetch(dataUrl)
            const blob = await response.blob()

            // Try to copy to clipboard
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        'image/png': blob
                    })
                ])

                Swal.fire({
                    icon: 'success',
                    title: '¡Copiado!',
                    text: 'Pega en WhatsApp: Ctrl+V',
                    timer: 1500,
                    showConfirmButton: false
                })
            } catch (clipboardErr) {
                // Fallback: download the image
                console.warn('[copyModalAsImage] Clipboard failed, downloading instead:', clipboardErr)
                const link = document.createElement('a')
                link.download = `ensayo-${modalTestnr.value || 'detalle'}.png`
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
        } catch (captureErr) {
            console.error('[copyModalAsImage] Capture error:', captureErr)
            // Restore console.error
            console.error = originalConsoleError
            // Restore buttons
            if (copyBtn) copyBtn.style.visibility = originalCopyVis
            if (closeBtn) closeBtn.style.visibility = originalCloseVis

            Swal.fire({
                icon: 'error',
                title: 'Error al capturar',
                text: 'No se pudo generar la imagen.'
            })
        }
    } catch (err) {
        console.error('[copyModalAsImage] Unexpected error:', err)
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al copiar la imagen.'
        })
    }
}

onMounted(() => {
    fetchData()
    window.addEventListener('resize', handleResize)
    console.log('[UsterStatsPage] mount width=', viewportWidth.value, 'isMobile=', isMobile.value)
    if (mq) {
        try {
            mq.addEventListener('change', (e) => {
                isMobile.value = e.matches
                viewportWidth.value = typeof window !== 'undefined' ? window.innerWidth : 0
                console.log('[UsterStatsPage] matchMedia change width=', viewportWidth.value, 'isMobile=', isMobile.value)
            })
        } catch { /* ignore */ }
    }
    
    // Add ESC key listener to close modals
    const handleEscKey = (event) => {
        if (event.key === 'Escape') {
            if (modalVisible.value) {
                closeModal()
            } else if (husoModalVisible.value) {
                closeHusoModal()
            }
        }
    }
    window.addEventListener('keydown', handleEscKey)
    
    // Clean up ESC listener on unmount
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', handleEscKey)
        try { window.removeEventListener('resize', handleResize) } catch { /* ignore */ }
    })
})


</script>

<style scoped>
/* Basic responsive tweaks; the layout uses CSS grid for responsiveness */
</style>
