<template>
    <div class="w-full h-screen flex flex-col p-4 overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        <!-- Header -->
        <header class="flex items-center justify-between mb-4 pb-3 border-b border-slate-300">
            <div class="flex items-center gap-4">
                <h1 class="text-2xl font-bold text-slate-800">📊 Resumen Diario - Control de Calidad</h1>
                <div v-if="selectedDate && !showAllPendingReviews" class="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-semibold">
                    {{ formatDateDisplay(selectedDate) }}
                </div>
                <div v-if="showAllPendingReviews" class="px-3 py-1 bg-orange-100 text-orange-800 rounded-lg text-sm font-semibold flex items-center gap-2">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                    </span>
                    Modo: Revisión Global
                </div>
            </div>
            
            <div class="flex items-center gap-2">
                <button 
                    @click="toggleGlobalPendingReviews"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border"
                    :class="showAllPendingReviews 
                        ? 'bg-slate-800 text-white border-slate-800 hover:bg-slate-700' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'"
                >
                    <svg v-if="!showAllPendingReviews" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    {{ showAllPendingReviews ? 'Salir de Revisión Global' : 'Ver Todos los Pendientes' }}
                </button>
                
                <div class="flex items-center gap-2" v-if="!showAllPendingReviews">
                    <button 
                        @click="previousDay" 
                        class="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                        title="Día anterior"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <input 
                        type="date" 
                        v-model="selectedDate"
                        class="border-slate-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                    >
                    <button 
                        @click="nextDay" 
                        class="p-2 hover:bg-slate-200 rounded-full text-slate-600 transition-colors"
                        title="Día siguiente"
                    >
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </header>

        <!-- Loading state -->
        <div v-if="isLoading" class="flex-1 flex items-center justify-center">
            <div class="text-center">
                <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p class="text-slate-600">Cargando datos...</p>
            </div>
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex-1 flex items-center justify-center">
            <div class="text-center bg-red-50 border border-red-200 rounded-lg p-6">
                <svg class="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p class="text-red-800 font-semibold mb-2">Error al cargar datos</p>
                <p class="text-red-600 text-sm">{{ error }}</p>
            </div>
        </div>

        <!-- Empty state -->
        <div v-else-if="totalEnsayos === 0" class="flex-1 flex items-center justify-center">
            <div class="text-center bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-8">
                <svg class="w-16 h-16 text-slate-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="text-slate-600 font-semibold mb-2">No hay datos para esta fecha</p>
                <p class="text-slate-500 text-sm">Selecciona otra fecha o verifica que haya ensayos registrados</p>
            </div>
        </div>

        <!-- Main content -->
        <div v-else class="flex-1 min-h-0 overflow-hidden flex flex-col">
            <!-- Summary stats -->
            <div class="grid grid-cols-5 gap-2 mb-4">
                <!-- Total Ensayos - clickeable -->
                <button
                    @click="filterAll"
                    :disabled="showAllPendingReviews"
                    v-tippy="{ content: showAllPendingReviews ? 'No disponible en modo Revisión Global' : (statusFilter === 'all' ? 'Mostrando todos los ensayos' : 'Clic para ver todos los ensayos'), placement: 'bottom', theme: 'custom' }"
                    class="bg-white rounded-lg border-2 p-2 shadow-sm text-left transition-all"
                    :class="[
                        statusFilter === 'all' ? 'border-blue-500 bg-blue-50' : 'border-slate-200',
                        showAllPendingReviews ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:scale-105 active:scale-95'
                    ]"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1">
                            <span class="text-xs text-slate-600 truncate">Total</span>
                            <svg v-if="statusFilter === 'all'" class="w-3 h-3 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <div class="text-xl font-bold text-slate-900">{{ totalEnsayos }}</div>
                    </div>
                </button>
                
                <!-- Dentro de Rango - clickeable -->
                <button
                    @click="filterOk"
                    :disabled="showAllPendingReviews"
                    v-tippy="{ content: showAllPendingReviews ? 'No disponible en modo Revisión Global' : (statusFilter === 'ok' ? 'Clic para quitar filtro' : 'Clic para filtrar solo ensayos dentro de rango'), placement: 'bottom', theme: 'custom' }"
                    class="bg-white rounded-lg border-2 p-2 shadow-sm text-left transition-all"
                    :class="[
                        statusFilter === 'ok' ? 'border-green-500 bg-green-50' : 'border-slate-200',
                        showAllPendingReviews ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:scale-105 active:scale-95'
                    ]"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1">
                            <span class="text-xs text-slate-600 truncate">En Rango</span>
                            <svg v-if="statusFilter === 'ok'" class="w-3 h-3 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <div class="text-xl font-bold text-green-700">{{ withinRange }}</div>
                    </div>
                </button>
                
                <!-- Fuera de Rango - clickeable -->
                <button
                    @click="filterOutOfRange"
                    :disabled="showAllPendingReviews"
                    v-tippy="{ content: showAllPendingReviews ? 'No disponible en modo Revisión Global' : (statusFilter === 'out-of-range' ? 'Clic para quitar filtro' : 'Clic para filtrar solo ensayos fuera de rango'), placement: 'bottom', theme: 'custom' }"
                    class="bg-white rounded-lg border-2 p-2 shadow-sm text-left transition-all"
                    :class="[
                        statusFilter === 'out-of-range' ? 'border-red-500 bg-red-50' : 'border-slate-200',
                        showAllPendingReviews ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md hover:scale-105 active:scale-95'
                    ]"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1">
                            <span class="text-xs text-slate-600 truncate">Fuera Rango</span>
                            <svg v-if="statusFilter === 'out-of-range'" class="w-3 h-3 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <div class="text-xl font-bold text-red-600">{{ outOfRange }}</div>
                    </div>
                </button>

                <!-- No Revisados - clickeable -->
                <button
                    @click="filterNotReviewed"
                    v-tippy="{ content: statusFilter === 'not-reviewed' ? 'Clic para quitar filtro' : 'Clic para ver ensayos pendientes de revisión', placement: 'bottom', theme: 'custom' }"
                    class="bg-white rounded-lg border-2 p-2 shadow-sm text-left transition-all hover:shadow-md hover:scale-105 active:scale-95"
                    :class="statusFilter === 'not-reviewed' ? 'border-orange-500 bg-orange-50' : 'border-slate-200'"
                >
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1">
                            <span class="text-xs text-slate-600 truncate">No Revisados</span>
                            <svg v-if="statusFilter === 'not-reviewed'" class="w-3 h-3 text-orange-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                        </div>
                        <div class="text-xl font-bold text-orange-600">{{ pendingReviewCount }}</div>
                    </div>
                </button>
                
                <!-- % Conformidad - no clickeable -->
                <div 
                    class="bg-white rounded-lg border border-slate-200 p-2 shadow-sm"
                    v-tippy="{ content: 'Porcentaje de ensayos dentro del rango ±1.5%', placement: 'bottom', theme: 'custom' }"
                >
                    <div class="flex items-center justify-between">
                        <span class="text-xs text-slate-600 truncate">% Conf.</span>
                        <div class="text-xl font-bold" :class="conformityPercentage >= 95 ? 'text-green-600' : 'text-orange-600'">
                            {{ conformityPercentage.toFixed(1) }}%
                        </div>
                    </div>
                </div>
            </div>

            <!-- Table container -->
            <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
                <!-- Table -->
                <div class="flex-1 min-h-0 overflow-auto bg-white rounded-lg border border-slate-200 shadow-sm">
                    <!-- Empty filter results message -->
                    <div v-if="groupedData.length === 0" class="flex items-center justify-center h-full p-8">
                        <div class="text-center">
                            <svg class="w-12 h-12 text-slate-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                            </svg>
                            <p class="text-slate-600 font-semibold mb-1">No hay ensayos que cumplan este filtro</p>
                            <p class="text-slate-500 text-sm">En esta fecha todos los ensayos están 
                                <span v-if="statusFilter === 'ok'" class="font-medium">fuera de rango</span>
                                <span v-else-if="statusFilter === 'out-of-range'" class="font-medium">dentro del rango</span>
                                <span v-else-if="statusFilter === 'not-reviewed'" class="font-medium">revisados</span>
                            </p>
                            <button 
                                @click="filterAll"
                                class="mt-3 px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
                            >
                                Ver todos los ensayos
                            </button>
                        </div>
                    </div>
                    
                    <!-- Table with data -->
                    <table v-else class="w-full text-sm">
                        <thead class="bg-slate-100 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700 w-10">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-slate-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </th>
                                <th v-if="showAllPendingReviews" class="px-4 py-3 text-left font-semibold text-slate-700 w-24">Fecha</th>
                                <th class="px-4 py-3 text-left font-semibold text-slate-700 w-24">OE</th>
                                <th class="px-4 py-3 text-left font-semibold text-slate-700 w-28">Ne Estándar</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700 w-28">Ne Min (+1.5%)</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700 w-28">Ne Max (-1.5%)</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700 w-32">Valor Medido</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700 w-28">Desviación %</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700 w-24">Estiraje</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700 w-24">Estado</th>
                                <th class="px-4 py-3 text-left font-semibold text-slate-700">Ensayo</th>
                                <th class="px-4 py-3 text-center font-semibold text-slate-700">Visualizar</th>
                            </tr>
                        </thead>
                        <tbody>
                            <template v-for="(group, idx) in groupedData" :key="idx">
                                <!-- Data rows -->
                                <tr 
                                    v-for="ensayo in group.ensayos" 
                                    :key="ensayo.testnr"
                                    class="border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer"
                                    @click="openEnsayoDetail(ensayo.testnr)"
                                >
                                    <td class="px-4 py-3 text-center" @click.stop>
                                        <input 
                                            type="checkbox" 
                                            :checked="reviewedTestnrs.has(ensayo.testnr)"
                                            @change="toggleReview(ensayo.testnr)"
                                            class="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer transition-colors"
                                            :class="{'border-red-400 ring-2 ring-red-100': !reviewedTestnrs.has(ensayo.testnr) && ensayo.status !== 'ok'}"
                                        />
                                    </td>
                                    <td v-if="showAllPendingReviews" class="px-4 py-3 text-slate-600 text-xs">{{ ensayo.dateStr }}</td>
                                    <td class="px-4 py-3 text-slate-600">{{ group.oe }}</td>
                                    <td class="px-4 py-3 font-semibold text-slate-800">{{ group.ne }}</td>
                                    <td class="px-4 py-3 text-center text-orange-600 font-medium">
                                        {{ formatValue(ensayo.neMin) }}
                                    </td>
                                    <td class="px-4 py-3 text-center text-orange-600 font-medium">
                                        {{ formatValue(ensayo.neMax) }}
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <span 
                                            class="inline-block px-3 py-1 rounded-lg font-bold text-base"
                                            :class="getStatusClasses(ensayo.status)"
                                        >
                                            {{ formatValue(ensayo.avgTitulo) }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <span 
                                            class="inline-block font-semibold"
                                            :class="{
                                                'text-red-600': ensayo.deviation > 1.5,
                                                'text-green-600': ensayo.deviation >= -1.5 && ensayo.deviation <= 1.5,
                                                'text-blue-600': ensayo.deviation < -1.5
                                            }"
                                        >
                                            {{ ensayo.deviation > 0 ? '+' : '' }}{{ parseFloat(ensayo.deviation.toFixed(2)) }}%
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-center text-slate-700 font-medium">
                                        {{ ensayo.estiraje || '-' }}
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <span 
                                            class="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold"
                                            :class="getStatusBadgeClasses(ensayo.status)"
                                        >
                                            {{ getStatusText(ensayo.status) }}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-slate-700 font-mono text-xs">
                                        {{ ensayo.testnr }}
                                    </td>
                                    <td class="px-4 py-3 text-center">
                                        <div class="inline-flex items-center gap-2">
                                            <button
                                                @click.stop="openDataModal(ensayo.testnr)"
                                                class="inline-flex items-center gap-2 px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-xs font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm"
                                                v-tippy="{ content: 'Ver datos del ensayo', placement: 'top', theme: 'custom' }"
                                            >
                                                📊 Datos
                                            </button>
                                            <button
                                                @click.stop="openHusoModal(ensayo.testnr)"
                                                class="inline-flex items-center gap-2 px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-md text-xs font-medium transition-colors duration-150 shadow-sm whitespace-nowrap"
                                                v-tippy="{ content: 'Ver gráfico por huso', placement: 'top', theme: 'custom' }"
                                            >
                                                📈 Gráficos
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            </template>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <!-- Modals -->
        <!-- Data Modal -->
        <div v-if="showDataModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog"
            aria-modal="true" aria-labelledby="dataModalTitle">
            <!-- overlay -->
            <div class="fixed inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm z-40"
                @click="closeDataModal" aria-hidden="true"></div>

            <!-- modal content -->
            <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[95vh] flex flex-col p-3 z-50 relative"
                role="document">
                <!-- Botones de navegación flotantes en los costados del modal -->
                <button @click="modalPrev" :disabled="modalPrevDisabled" type="button"
                    v-tippy="{ content: 'Anterior ensayo', placement: 'left', theme: 'custom' }"
                    class="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed z-50"
                    aria-label="Anterior ensayo">‹</button>

                <button @click="modalNext" :disabled="modalNextDisabled" type="button"
                    v-tippy="{ content: 'Siguiente ensayo', placement: 'right', theme: 'custom' }"
                    class="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed z-50"
                    aria-label="Siguiente ensayo">›</button>

                <header class="flex items-start sm:items-center justify-between mb-2 pb-1 gap-3">
                    <div id="dataModalTitle" class="flex flex-col sm:flex-row sm:items-center gap-2 mx-8">
                        <div class="text-slate-600 text-sm">Fecha: <span class="text-slate-900 text-lg font-semibold ml-1">{{
                            modalMeta.fechaStr }}</span></div>
                        <div class="text-slate-600 text-sm">Ne: <span class="text-slate-900 text-lg font-semibold ml-1">{{
                            modalMeta.ne }}</span></div>
                        <div class="text-slate-600 text-sm">OE: <span class="text-slate-900 text-lg font-semibold ml-1">{{
                            modalMeta.oe }}</span></div>
                        <div class="text-slate-600 text-sm">Ensayo <span class="text-slate-900 text-lg font-semibold ml-1">{{
                            modalMeta.u }}</span></div>
                    </div>

                    <div class="flex items-center gap-2">
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
                        <button @click="closeDataModal" type="button"
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

                <!-- Observaciones (OBS) y Lab. Uster (LABORANT) -->
                <div v-if="modalMeta.obs || modalMeta.laborant || modalMeta.laborantTensor"
                    class="mx-8 flex items-center gap-4 text-slate-600 text-sm mb-2">
                    <div v-if="modalMeta.obs">
                        <span>Obs.:</span>
                        <span class="text-slate-900 text-sm font-normal ml-1">{{ modalMeta.obs }}</span>
                    </div>
                    <div v-if="modalMeta.laborant">
                        <span>Op. Uster:</span>
                        <span class="text-slate-900 text-sm font-normal ml-1">{{ modalMeta.laborant }}</span>
                    </div>
                    <div v-if="modalMeta.laborantTensor">
                        <span>Op. TensoRapid:</span>
                        <span class="text-slate-900 text-sm font-normal ml-1">{{ modalMeta.laborantTensor }}</span>
                    </div>
                </div>

                <section class="flex-1 relative">
                    <div v-if="mergedRows.length === 0" class="text-sm text-slate-600 py-8 text-center">
                        {{ modalLoading ? 'Cargando datos...' : 'No hay datos para este ensayo.' }}
                    </div>
                    <div v-else class="rounded-xl border border-slate-200 overflow-auto max-h-[calc(95vh-7rem)]">
                        <table class="min-w-full text-xs">
                            <thead class="bg-gradient-to-r from-slate-50 to-slate-100 sticky top-0 z-30">
                                <tr>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Huso</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Titulo</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Desvío %</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">CVm %</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -30%</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -40%</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Delg -50%</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +35%</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Grue +50%</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +140%</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Neps +280%</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Fuerza B</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Elongación %</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Tenacidad</th>
                                    <th class="px-3 py-2 text-center font-semibold text-slate-700 border-b border-slate-200">Trabajo</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="(row, idx) in mergedRows" :key="idx"
                                    :class="['transition-colors duration-150', modalLoading ? 'bg-slate-50/50' : 'hover:bg-slate-50']">
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ row.NO }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.TITULO) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 font-semibold" :class="{
                                        'text-red-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) > 1.5,
                                        'text-blue-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) < -1.5,
                                        'text-green-600': row.DESVIO_PERCENT && parseFloat(row.DESVIO_PERCENT) >= -1.5 && parseFloat(row.DESVIO_PERCENT) <= 1.5,
                                        'text-slate-700': !row.DESVIO_PERCENT
                                    }">
                                        <template v-if="row.DESVIO_PERCENT && row.DESVIO_PERCENT !== '—'">
                                            {{ row.DESVIO_PERCENT }}%
                                        </template>
                                        <template v-else>{{ row.DESVIO_PERCENT || '—' }}</template>
                                    </td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.CVM_PERCENT) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.DELG_MINUS30_KM) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.DELG_MINUS40_KM) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.DELG_MINUS50_KM) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.GRUE_35_KM) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.GRUE_50_KM) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.NEPS_140_KM) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.NEPS_280_KM) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.FUERZA_B) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.ELONGACION) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.TENACIDAD) }}</td>
                                    <td class="px-3 py-1 text-center border-b border-slate-100 text-slate-700">{{ fmtCell(row.TRABAJO) }}</td>
                                </tr>

                                <!-- Statistics rows -->
                                <tr class="bg-gradient-to-r from-blue-50 to-indigo-50 font-semibold border-t-2 border-blue-200">
                                    <td class="px-3 py-1 text-slate-700">
                                        <div class="flex items-center justify-center gap-1">
                                            <span>Promedio</span>
                                            <button
                                                v-tippy="{ content: 'La suma de todos los valores dividida por la cantidad de datos.', placement: 'top', theme: 'custom' }"
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
                                                                        <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO?.avg) }}</td>
                                                                        <td class="px-3 py-1 text-center font-semibold" :class="{
                                                                            'text-red-600': combinedStats.DESVIO_PERCENT?.avg != null && parseFloat(combinedStats.DESVIO_PERCENT.avg) > 1.5,
                                                                            'text-blue-600': combinedStats.DESVIO_PERCENT?.avg != null && parseFloat(combinedStats.DESVIO_PERCENT.avg) < -1.5,
                                                                            'text-green-600': combinedStats.DESVIO_PERCENT?.avg != null && parseFloat(combinedStats.DESVIO_PERCENT.avg) >= -1.5 && parseFloat(combinedStats.DESVIO_PERCENT.avg) <= 1.5,
                                                                            'text-slate-700': combinedStats.DESVIO_PERCENT?.avg == null
                                                                        }">
                                                                            <template v-if="combinedStats.DESVIO_PERCENT?.avg != null">{{ fmtStat(combinedStats.DESVIO_PERCENT.avg) }}%</template>
                                                                            <template v-else>—</template>
                                                                        </td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD?.avg) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO?.avg) }}</td>
                                </tr>

                                <tr class="bg-blue-50/50 font-medium">
                                    <td class="px-3 py-1 text-slate-700">
                                        <div class="flex items-center justify-center gap-1">
                                            <span>CV</span>
                                            <button
                                                v-tippy="{ content: 'Coeficiente de variación. Un CV del 5% indica baja variabilidad.', placement: 'top', theme: 'custom' }"
                                                aria-label="Info CV"
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
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">—</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD?.cv) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO?.cv) }}</td>
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
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">—</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD?.sd) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO?.sd) }}</td>
                                </tr>

                                <tr class="bg-blue-50/50 font-medium">
                                    <td class="px-3 py-1 text-slate-700">
                                        <div class="flex items-center justify-center gap-1">
                                            <span>Q95</span>
                                            <button
                                                v-tippy="{ content: 'Cuantil 95. El valor por debajo del cual se encuentra el 95% de los datos.', placement: 'top', theme: 'custom' }"
                                                aria-label="Info Q95"
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
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">—</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD?.q95) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO?.q95) }}</td>
                                </tr>

                                <tr class="bg-indigo-50/50 font-medium">
                                    <td class="px-3 py-1 text-slate-700">
                                        <div class="flex items-center justify-center gap-1">
                                            <span>Máx</span>
                                            <button
                                                v-tippy="{ content: 'Máximo. El valor más alto del conjunto de datos.', placement: 'top', theme: 'custom' }"
                                                aria-label="Info Max"
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
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">—</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD?.max) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO?.max) }}</td>
                                </tr>

                                <tr class="bg-blue-50/50 font-medium">
                                    <td class="px-3 py-1 text-slate-700">
                                        <div class="flex items-center justify-center gap-1">
                                            <span>Mín</span>
                                            <button
                                                v-tippy="{ content: 'Mínimo. El valor más bajo del conjunto de datos.', placement: 'top', theme: 'custom' }"
                                                aria-label="Info Min"
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
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TITULO?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">—</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.CVM_PERCENT?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS30_KM?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS40_KM?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.DELG_MINUS50_KM?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_35_KM?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.GRUE_50_KM?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_140_KM?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.NEPS_280_KM?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.FUERZA_B?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.ELONGACION?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TENACIDAD?.min) }}</td>
                                    <td class="px-3 py-1 text-center text-slate-700">{{ fmtStat(combinedStats.TRABAJO?.min) }}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>

        <!-- Huso Detail Modal -->
            <HusoDetailModal
                :visible="showHusoModal"
                :values="husoModalData.values"
                :huso-numbers="husoModalData.husoNumbers"
                :testnr="String(husoModalData.testnr || '')"
                :timestamp="husoModalData.timestamp"
                :oe="husoModalData.oe"
                variable-label="Titulo Ne"
                :standard-ne="husoModalData.standardNe"
                :can-navigate-previous="!modalPrevDisabled"
                :can-navigate-next="!modalNextDisabled"
                @close="showHusoModal = false"
                @navigate-previous="husoModalPrev"
                @navigate-next="husoModalNext"
            />
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { fetchAllStatsData } from '../services/dataService'
import HusoDetailModal from './uster-stats/HusoDetailModal.vue'
import { toPng } from 'html-to-image'
import Swal from 'sweetalert2'

const emit = defineEmits(['navigate'])

const isLoading = ref(false)
const error = ref(null)
const selectedDate = ref(getTodayDate())
const usterTbl = ref([])
const usterPar = ref([])
const tensorapidTbl = ref([])
const tensorapidPar = ref([])
const statusFilter = ref('all') // 'all', 'ok', 'out-of-range', 'not-reviewed'
const reviewedTestnrs = ref(new Set())
const showAllPendingReviews = ref(false)

// Modal control
const showDataModal = ref(false)
const showHusoModal = ref(false)
const selectedTestnr = ref(null)
const modalLoading = ref(false)
const usterTblRows = ref([])
const tensorTblRows = ref([])

// Huso modal data (siguiendo el patrón de UsterStatsPage)
const husoModalData = ref({
    values: [],
    husoNumbers: [],
    testnr: null,
    timestamp: null,
    oe: null,
    standardNe: null
})

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

// Format date for display (DD/MM/YYYY)
function formatDateDisplay(dateStr) {
    if (!dateStr) return ''
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
}

// Parse date from various formats
function parseDate(dateValue) {
    if (!dateValue) return null
    
    if (dateValue instanceof Date) {
        return dateValue
    }
    
    if (typeof dateValue === 'string') {
        // Try dd/mm/yyyy format
        const m = dateValue.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
        if (m) {
            const day = Number(m[1])
            const mon = Number(m[2]) - 1
            let year = Number(m[3])
            if (year < 100) year += 2000
            return new Date(year, mon, day)
        }
        
        // Try ISO format
        const d = new Date(dateValue)
        if (!isNaN(d.getTime())) return d
    }
    
    if (typeof dateValue === 'number') {
        return dateValue > 1000000000000 ? new Date(dateValue) : new Date(dateValue * 1000)
    }
    
    return null
}

// Check if date matches selected date
function dateMatches(dateValue, targetDateStr) {
    const parsed = parseDate(dateValue)
    if (!parsed || isNaN(parsed.getTime())) return false
    
    const [targetYear, targetMonth, targetDay] = targetDateStr.split('-').map(Number)
    
    return (
        parsed.getFullYear() === targetYear &&
        parsed.getMonth() + 1 === targetMonth &&
        parsed.getDate() === targetDay
    )
}

// Format OE (remove leading zeros, extract letters)
function formatOe(oe) {
    if (!oe) return ''
    const str = String(oe).trim()
    const match = str.match(/^(\d+)\s*([A-Za-z]+)?/)
    if (!match) return str
    const numPart = parseInt(match[1], 10)
    const letterPart = match[2] ? match[2].substring(0, 2).toUpperCase() : ''
    return letterPart ? `${numPart} ${letterPart}` : String(numPart)
}

function formatNe(nomcount, matclass) {
    if (nomcount == null || nomcount === '') return ''
    let ne = String(nomcount).trim()
    if (matclass && String(matclass).toLowerCase() === 'hilo de fantasia') {
        return ne + 'F'
    }
    return ne
}

// Fetch data from backend
async function fetchData() {
    isLoading.value = true
    error.value = null
    
    try {
        const data = await fetchAllStatsData()
        usterTbl.value = data.usterTbl || []
        usterPar.value = data.usterPar || []
        tensorapidTbl.value = data.tensorapidTbl || []
        tensorapidPar.value = data.tensorapidPar || []
    } catch (err) {
        error.value = err.message
        console.error('Error fetching data:', err)
    } finally {
        isLoading.value = false
    }
}

// Get all ensayos with status (unfiltered, for statistics)
const allEnsayosWithStatus = computed(() => {
    if (!usterPar.value.length) return []
    if (!showAllPendingReviews.value && !selectedDate.value) return []
    
    // Filter ensayos by selected date OR take all if global review mode
    const ensayosForDate = showAllPendingReviews.value 
        ? usterPar.value 
        : usterPar.value.filter(par => dateMatches(par.TIME_STAMP, selectedDate.value))
    
    if (ensayosForDate.length === 0) return []
    
    // Calculate average TITULO for each ensayo
    const ensayosWithAvg = ensayosForDate.map(par => {
        const testnr = par.TESTNR
        const rows = usterTbl.value.filter(row => row.TESTNR === testnr)
        
        const titulos = rows
            .map(row => parseFloat(row.TITULO))
            .filter(v => !isNaN(v))
        
        const avgTitulo = titulos.length > 0
            ? titulos.reduce((sum, v) => sum + v, 0) / titulos.length
            : null
        
        const neStandard = par.NOMCOUNT ? parseFloat(par.NOMCOUNT) : null
        const neMin = neStandard ? neStandard * 0.985 : null
        const neMax = neStandard ? neStandard * 1.015 : null
        
        let status = 'unknown'
        let deviation = 0
        
        if (avgTitulo !== null && neStandard !== null) {
            // Fórmula invertida: ((Ne - Medido) / Ne) × 100
            // Positivo = más grueso (medido < Ne), Negativo = más delgado (medido > Ne)
            deviation = ((neStandard - avgTitulo) / neStandard) * 100
            
            if (avgTitulo < neMin) {
                status = 'above'  // Titulo bajo = hilo más grueso = Alto
            } else if (avgTitulo > neMax) {
                status = 'below'  // Titulo alto = hilo más delgado = Bajo
            } else {
                status = 'ok'
            }
        }
        
        // Formatear fecha correctamente
        const parsedDate = parseDate(par.TIME_STAMP || par.DATE)
        const dateStr = parsedDate 
            ? `${String(parsedDate.getDate()).padStart(2, '0')}/${String(parsedDate.getMonth() + 1).padStart(2, '0')}/${parsedDate.getFullYear()}`
            : '-'
        
        return {
            testnr,
            dateStr,
            oe: formatOe(par.MASCHNR || par.OE),
            ne: formatNe(par.NOMCOUNT, par.MATCLASS),
            avgTitulo,
            neStandard,
            neMin,
            neMax,
            status,
            deviation,
            estiraje: par.ESTIRAJE || null
        }
    }).filter(e => e.avgTitulo !== null && e.neStandard !== null)
    
    return ensayosWithAvg
})

// Inicializar revisados cuando cambian los datos
watch(allEnsayosWithStatus, (ensayos) => {
    // Mantener los que ya estaban revisados manualmente
    const newSet = new Set(reviewedTestnrs.value)
    
    ensayos.forEach(e => {
        // Si está OK, lo marcamos como revisado automáticamente (si no estaba ya)
        if (e.status === 'ok') {
            newSet.add(e.testnr)
        }
        // Si está fuera de rango, NO lo agregamos (queda pendiente de revisión manual)
        // A menos que ya estuviera en el set (revisado previamente en esta sesión)
    })
    
    reviewedTestnrs.value = newSet
}, { immediate: true })

function toggleReview(testnr) {
    const newSet = new Set(reviewedTestnrs.value)
    if (newSet.has(testnr)) {
        newSet.delete(testnr)
    } else {
        newSet.add(testnr)
    }
    reviewedTestnrs.value = newSet
}

// Filter and group data by OE and Ne
const groupedData = computed(() => {
    const allEnsayos = allEnsayosWithStatus.value
    
    if (allEnsayos.length === 0) return []
    
    // Apply status filter
    let filteredEnsayos = allEnsayos
    if (statusFilter.value === 'ok') {
        filteredEnsayos = allEnsayos.filter(e => e.status === 'ok')
    } else if (statusFilter.value === 'out-of-range') {
        filteredEnsayos = allEnsayos.filter(e => e.status === 'below' || e.status === 'above')
    } else if (statusFilter.value === 'not-reviewed') {
        filteredEnsayos = allEnsayos.filter(e => !reviewedTestnrs.value.has(e.testnr))
    }
    
    // Group by OE and Ne
    const groups = {}
    
    for (const ensayo of filteredEnsayos) {
        const key = `${ensayo.oe}|${ensayo.ne}`
        if (!groups[key]) {
            groups[key] = {
                oe: ensayo.oe,
                ne: ensayo.ne,
                ensayos: []
            }
        }
        groups[key].ensayos.push(ensayo)
    }
    
    // Convert to array and sort by OE then Ne
    const result = Object.values(groups)
    
    result.sort((a, b) => {
        // Sort by OE (numeric part)
        const oeA = parseInt(a.oe) || 0
        const oeB = parseInt(b.oe) || 0
        if (oeA !== oeB) return oeA - oeB
        
        // Then by Ne
        const neA = parseFloat(a.ne) || 0
        const neB = parseFloat(b.ne) || 0
        return neA - neB
    })
    
    return result
})

// Summary statistics (always based on ALL ensayos, not filtered)
const totalEnsayos = computed(() => {
    return allEnsayosWithStatus.value.length
})

const withinRange = computed(() => {
    return allEnsayosWithStatus.value.filter(e => e.status === 'ok').length
})

const outOfRange = computed(() => {
    return allEnsayosWithStatus.value.filter(e => e.status === 'below' || e.status === 'above').length
})

const pendingReviewCount = computed(() => {
    return allEnsayosWithStatus.value.filter(e => !reviewedTestnrs.value.has(e.testnr)).length
})

const conformityPercentage = computed(() => {
    if (totalEnsayos.value === 0) return 0
    return (withinRange.value / totalEnsayos.value) * 100
})

// Formatting helpers
function formatValue(val) {
    if (val == null || isNaN(val)) return '—'
    return val.toFixed(2)
}

function getStatusClasses(status) {
    switch (status) {
        case 'ok':
            return 'bg-green-100 text-green-800 border border-green-300'
        case 'below':
            return 'bg-blue-100 text-blue-800 border border-blue-300'
        case 'above':
            return 'bg-red-100 text-red-800 border border-red-300'
        default:
            return 'bg-slate-100 text-slate-600 border border-slate-300'
    }
}

function getStatusBadgeClasses(status) {
    switch (status) {
        case 'ok':
            return 'bg-green-100 text-green-800'
        case 'below':
            return 'bg-blue-100 text-blue-800'
        case 'above':
            return 'bg-red-100 text-red-800'
        default:
            return 'bg-slate-100 text-slate-600'
    }
}

function getStatusText(status) {
    switch (status) {
        case 'ok':
            return '✓ OK'
        case 'below':
            return '↓ Bajo'
        case 'above':
            return '↑ Alto'
        default:
            return '?'
    }
}

// Modal functions
async function openDataModal(testnr) {
    selectedTestnr.value = testnr
    showDataModal.value = true
    modalLoading.value = true
    
    try {
        // Buscar datos en usterTbl
        let usterRows = usterTbl.value.filter(r =>
            String(r.TESTNR || r.testnr || '') === String(testnr)
        )
        
        // Deduplicar por TESTNR+NO
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
            const no = String(r.NO ?? r.NO_ ?? r.HUSO ?? r.huso ?? '')
            return tn && no ? `${tn}#${no}` : undefined
        })
        
        usterTblRows.value = usterRows
        
        // Buscar datos de TENSORAPID si existen
        // Paso 1: Buscar TENSORAPID_PAR que tengan USTER_TESTNR = testnr seleccionado
        const tensorParMatches = (tensorapidPar.value || []).filter(r => {
            const usterTestnr = String(r.USTER_TESTNR || r.uster_testnr || r.usterTestnr || r.USTERTESTNR || '')
            return usterTestnr === String(testnr)
        })
        
        // Paso 2: Obtener los TESTNR de esos TENSORAPID_PAR
        const tensorTestnrsList = tensorParMatches.map(r => String(r.TESTNR || r.testnr || '')).filter(Boolean)
        
        // Paso 3: Buscar filas en TENSORAPID_TBL que coincidan con esos TESTNR
        let tensorRows = (tensorapidTbl.value || []).filter(r => {
            const tblTestnr = String(r.TESTNR || r.testnr || '')
            return tensorTestnrsList.includes(tblTestnr)
        })
        
        // Deduplicar por TESTNR+HUSO_NUMBER en TENSORAPID_TBL
        tensorRows = dedupe(tensorRows, (r) => {
            const tn = String(r.TESTNR || r.testnr || '')
            const no = String(r.HUSO_NUMBER ?? r.NO ?? r.no ?? '')
            return tn && no ? `${tn}#${no}` : undefined
        })
        
        tensorTblRows.value = tensorRows
        
    } catch (err) {
        console.error('Error loading modal data:', err)
    } finally {
        modalLoading.value = false
    }
}

function openHusoModal(testnr) {
    if (!testnr) return
    
    // Buscar y cargar los datos de Uster para el testnr seleccionado
    let usterRows = usterTbl.value.filter(r => String(r.TESTNR || r.testnr || '') === String(testnr))
    
    // Deduplicar por TESTNR+NO
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
        const no = String(r.NO ?? r.NO_ ?? r.HUSO ?? r.huso ?? '')
        return tn && no ? `${tn}#${no}` : undefined
    })
    
    // Ordenar por NO_ y extraer valores y husos
    const sortedRows = usterRows
        .map(r => ({
            no: r.NO ?? r.NO_ ?? r.HUSO ?? r.huso ?? '',
            titulo: r.TITULO ?? r.titulo ?? r.NE ?? r.ne ?? null,
            row: r
        }))
        .filter(x => x.titulo !== null && x.titulo !== undefined)
        .map(x => ({ ...x, nNum: parseInt(x.no) || 0 }))
        .sort((a, b) => a.nNum - b.nNum)
    
    const values = sortedRows.map(x => Number(x.titulo)).filter(n => Number.isFinite(n))
    const husoNumbers = sortedRows.map(x => String(x.no))
    
    // Buscar metadata del ensayo
    const parMatch = usterPar.value.find(p => 
        String(p.TESTNR || p.testnr) === String(testnr)
    )
    
    let timestamp = null
    if (parMatch?.TIME_STAMP || parMatch?.time_stamp || parMatch?.DATUM || parMatch?.datum) {
        const fecha = parseDate(parMatch.TIME_STAMP || parMatch.time_stamp || parMatch.DATUM || parMatch.datum)
        if (fecha) {
            timestamp = `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}`
        }
    }
    
    const oe = formatOe(parMatch?.MASCHNR || parMatch?.maschnr || parMatch?.OE || parMatch?.oe)
    const standardNe = parMatch?.NOMCOUNT || parMatch?.nomcount || null
    
    // Llenar husoModalData antes de abrir el modal
    husoModalData.value = {
        values,
        husoNumbers,
        testnr,
        timestamp,
        oe,
        standardNe
    }
    
    selectedTestnr.value = testnr
    showHusoModal.value = true
}

function openEnsayoDetail(testnr) {
    // Open data modal by default when clicking row
    openDataModal(testnr)
}

function closeDataModal() {
    showDataModal.value = false
    selectedTestnr.value = null
}

// Lista plana de ensayos filtrados para navegación del modal
const filteredTests = computed(() => {
    const allEnsayos = allEnsayosWithStatus.value
    
    if (allEnsayos.length === 0) return []
    
    // Apply status filter
    let filtered = allEnsayos
    if (statusFilter.value === 'ok') {
        filtered = allEnsayos.filter(e => e.status === 'ok')
    } else if (statusFilter.value === 'out-of-range') {
        filtered = allEnsayos.filter(e => e.status === 'below' || e.status === 'above')
    } else if (statusFilter.value === 'not-reviewed') {
        filtered = allEnsayos.filter(e => !reviewedTestnrs.value.has(e.testnr))
    }
    
    // Mapear a formato con TESTNR para compatibilidad con funciones de navegación
    return filtered.map(e => ({ TESTNR: e.testnr, ...e }))
})

// Navegación del modal
const modalIndex = computed(() => {
    const testnr = selectedTestnr.value
    if (!testnr) return -1
    const list = filteredTests.value || []
    return list.findIndex(t => String(t.TESTNR || t.testnr) === String(testnr))
})

const modalPrevDisabled = computed(() => modalIndex.value <= 0)
const modalNextDisabled = computed(() => {
    const list = filteredTests.value || []
    return modalIndex.value === -1 || modalIndex.value >= list.length - 1
})

function modalPrev() {
    if (modalPrevDisabled.value) return
    const list = filteredTests.value || []
    const prev = list[modalIndex.value - 1]
    const testnr = prev?.TESTNR || prev?.testnr
    if (testnr) {
        openDataModal(testnr)
    }
}

function modalNext() {
    if (modalNextDisabled.value) return
    const list = filteredTests.value || []
    const next = list[modalIndex.value + 1]
    const testnr = next?.TESTNR || next?.testnr
    if (testnr) {
        openDataModal(testnr)
    }
}

// Funciones de navegación para el modal de husos
function husoModalPrev() {
    if (modalPrevDisabled.value) return
    const list = filteredTests.value || []
    const prev = list[modalIndex.value - 1]
    const testnr = prev?.TESTNR || prev?.testnr
    if (testnr) {
        openHusoModal(testnr)
    }
}

function husoModalNext() {
    if (modalNextDisabled.value) return
    const list = filteredTests.value || []
    const next = list[modalIndex.value + 1]
    const testnr = next?.TESTNR || next?.testnr
    if (testnr) {
        openHusoModal(testnr)
    }
}

// Merged rows for modal (combine Uster + TensoRapid data)
const mergedRows = computed(() => {
    const uster = usterTblRows.value || []
    const tensor = tensorTblRows.value || []
    
    // Obtener Ne estándar desde modalMeta
    const neStandard = modalMeta.value?.ne ? parseFloat(String(modalMeta.value.ne).replace('Flame', '').trim()) : 0
    
    // Crear mapa de datos TensoRapid por HUSO_NUMBER
    const tensorMap = {}
    tensor.forEach(t => {
        const no = String(t.HUSO_NUMBER || t.NO || t.no || '')
        if (no) tensorMap[no] = t
    })
    
    // Combinar filas por HUSO (NO en Uster, HUSO_NUMBER en Tensor)
    const merged = []
    const maxLen = Math.max(uster.length, tensor.length)
    
    for (let i = 0; i < maxLen; i++) {
        const uRow = uster[i] || {}
        const tRow = tensor[i] || {}
        
        const usterNo = String(uRow.NO ?? uRow.NO_ ?? '')
        const tensorByNo = usterNo ? tensorMap[usterNo] : null
        const tData = tensorByNo || tRow
        
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
            NO: uRow.NO ?? uRow.NO_ ?? tData.HUSO_NUMBER ?? (i + 1),
            TITULO: tituloVal,
            DESVIO_PERCENT: desvioPercent,
            CVM_PERCENT: uRow.CVM_PERCENT ?? uRow['CVM_%'] ?? '',
            DELG_MINUS30_KM: uRow.DELG_MINUS30_KM ?? uRow['DELG_-30%'] ?? '',
            DELG_MINUS40_KM: uRow.DELG_MINUS40_KM ?? uRow['DELG_-40%'] ?? '',
            DELG_MINUS50_KM: uRow.DELG_MINUS50_KM ?? uRow['DELG_-50%'] ?? '',
            GRUE_35_KM: uRow.GRUE_35_KM ?? uRow['GRUE_+35%'] ?? '',
            GRUE_50_KM: uRow.GRUE_50_KM ?? uRow['GRUE_+50%'] ?? '',
            NEPS_140_KM: uRow.NEPS_140_KM ?? uRow['NEPS_+140%'] ?? '',
            NEPS_280_KM: uRow.NEPS_280_KM ?? uRow['NEPS_+280%'] ?? '',
            FUERZA_B: tData.FUERZA_B ?? tData.fuerza_b ?? '',
            ELONGACION: tData.ELONGACION ?? tData.elongacion ?? '',
            TENACIDAD: tData.TENACIDAD ?? tData.tenacidad ?? '',
            TRABAJO: tData.TRABAJO ?? tData.trabajo ?? ''
        })
    }
    
    return merged
})

// Datos para el modal de gráfico por huso (Titulo Ne)
const husoModalHusos = computed(() => {
    // Extrae y ordena los husos para el gráfico
    const arr = (usterTblRows.value || []).map(r => {
        // Prioridad: NO, NO_, HUSO, huso
        if (r.NO !== undefined && r.NO !== null) return String(r.NO)
        if (r.NO_ !== undefined && r.NO_ !== null) return String(r.NO_)
        if (r.HUSO !== undefined && r.HUSO !== null) return String(r.HUSO)
        if (r.huso !== undefined && r.huso !== null) return String(r.huso)
        return ''
    })
    return arr
        .map(v => ({ v, n: parseInt(v) || 0 }))
        .sort((a, b) => a.n - b.n)
        .map(x => x.v)
})

const husoModalValues = computed(() => {
    // Extrae y ordena los valores de TITULO/NE para el gráfico
    const list = (usterTblRows.value || []).map(r => {
        let no = ''
        if (r.NO !== undefined && r.NO !== null) no = String(r.NO)
        else if (r.NO_ !== undefined && r.NO_ !== null) no = String(r.NO_)
        else if (r.HUSO !== undefined && r.HUSO !== null) no = String(r.HUSO)
        else if (r.huso !== undefined && r.huso !== null) no = String(r.huso)
        let titulo = null
        if (r.TITULO !== undefined && r.TITULO !== null) titulo = Number(r.TITULO)
        else if (r.titulo !== undefined && r.titulo !== null) titulo = Number(r.titulo)
        else if (r.NE !== undefined && r.NE !== null) titulo = Number(r.NE)
        else if (r.ne !== undefined && r.ne !== null) titulo = Number(r.ne)
        return { no, titulo }
    })
    return list
        .map(x => ({ ...x, n: parseInt(x.no) || 0 }))
        .sort((a, b) => a.n - b.n)
        .map(x => x.titulo)
        .filter(n => Number.isFinite(n))
})

const husoStandardNe = computed(() => {
    const neStr = modalMeta.value?.ne ? String(modalMeta.value.ne) : ''
    const n = parseFloat(neStr.replace('Flame', '').replace(',', '.'))
    return Number.isFinite(n) ? n : ''
})

// Combined statistics for modal
const combinedStats = computed(() => {
    const merged = mergedRows.value
    if (merged.length === 0) return {}
    
    const stats = {}
    const fields = ['TITULO', 'DESVIO_PERCENT', 'CVM_PERCENT', 'DELG_MINUS30_KM', 'DELG_MINUS40_KM', 'DELG_MINUS50_KM',
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

    return stats
})

// Modal metadata
const modalMeta = computed(() => {
    if (!selectedTestnr.value) return {}
    
    // Buscar en usterPar
    const parMatch = usterPar.value.find(p => 
        String(p.TESTNR || p.testnr) === String(selectedTestnr.value)
    )
    
    if (!parMatch) return {}
    
    // Usar TIME_STAMP en lugar de DATUM
    const fecha = parseDate(parMatch.TIME_STAMP || parMatch.time_stamp || parMatch.DATUM || parMatch.datum)
    const fechaStr = fecha ? `${String(fecha.getDate()).padStart(2, '0')}/${String(fecha.getMonth() + 1).padStart(2, '0')}/${fecha.getFullYear()}` : '—'
    
    // Buscar laborante de TENSORAPID_PAR
    const tensorParMatch = (tensorapidPar.value || []).find(tp => {
        const usterTestnr = String(tp.USTER_TESTNR || tp.uster_testnr || tp.usterTestnr || tp.USTERTESTNR || '')
        return usterTestnr === String(selectedTestnr.value)
    })
    
    const laborantTensor = tensorParMatch ? (tensorParMatch.LABORANT || tensorParMatch.laborant || '') : ''
    
    return {
        fechaStr,
        ne: formatNe(parMatch.NOMCOUNT || parMatch.nomcount, parMatch.MATCLASS || parMatch.matclass),
        // Usar MASCHNR primero, luego OE como fallback
        oe: formatOe(parMatch.MASCHNR || parMatch.maschnr || parMatch.OE || parMatch.oe),
        u: parMatch.TESTNR || parMatch.testnr,
        t: '—', // TensoRapid testnr
        obs: parMatch.OBS || parMatch.obs || '',
        laborant: parMatch.LABORANT || parMatch.laborant || '',
        laborantTensor: laborantTensor
    }
})

// Format cell helper
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

// Format statistics helper
function fmtStat(val) {
    if (val == null) return '—'
    const n = Number(val)
    if (isNaN(n)) return '—'
    // Formatear con hasta 2 decimales, quitando ceros innecesarios
    return Number(n.toFixed(2)).toString()
}

// Copy modal as image for WhatsApp
async function copyModalAsImage() {
    try {
        // Find the modal content element
        const modalEl = document.querySelector('[role="document"]')
        if (!modalEl) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo encontrar el modal.' })
            return
        }

        // Find and hide close button temporarily
        const closeBtn = document.querySelector('[aria-label="Cerrar detalle"]')
        const closeBtnDisplay = closeBtn?.style.display
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

        await new Promise(resolve => setTimeout(resolve, 120))

        // Capture the modal as PNG
        const dataUrl = await toPng(modalEl, {
            quality: 0.95,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            skipFonts: true,
            cacheBust: true
        })

        // Restore console.error
        console.error = originalConsoleError

        // Restore button
        if (closeBtn) closeBtn.style.display = closeBtnDisplay

        // Convert dataURL to blob
        const blob = await (await fetch(dataUrl)).blob()

        // Copy to clipboard
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ])

        Swal.fire({
            icon: 'success',
            title: '✓ Copiado',
            text: 'La imagen se copió al portapapeles. Ahora puedes pegarla en WhatsApp.',
            timer: 2500,
            showConfirmButton: false
        })
    } catch (err) {
        console.error('Error copying modal as image:', err)
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo copiar la imagen. ' + (err.message || '')
        })
    }
}

// Modal functions

// Filter functions - toggle behavior
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

function filterNotReviewed() {
    statusFilter.value = statusFilter.value === 'not-reviewed' ? 'all' : 'not-reviewed'
}

function toggleGlobalPendingReviews() {
    showAllPendingReviews.value = !showAllPendingReviews.value
    if (showAllPendingReviews.value) {
        // Al activar, forzar filtro de no revisados
        statusFilter.value = 'not-reviewed'
    } else {
        // Al desactivar, volver a ver todo (pero filtrado por fecha actual)
        statusFilter.value = 'all'
    }
}

// Date navigation functions
function previousDay() {
    if (!selectedDate.value) return
    const current = new Date(selectedDate.value + 'T00:00:00')
    current.setDate(current.getDate() - 1)
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    selectedDate.value = `${year}-${month}-${day}`
}

function nextDay() {
    if (!selectedDate.value) return
    const current = new Date(selectedDate.value + 'T00:00:00')
    current.setDate(current.getDate() + 1)
    const year = current.getFullYear()
    const month = String(current.getMonth() + 1).padStart(2, '0')
    const day = String(current.getDate()).padStart(2, '0')
    selectedDate.value = `${year}-${month}-${day}`
}

// Watch date changes
watch(selectedDate, () => {
    // Don't reset filter when date changes - keep the active filter
    // This allows users to navigate through dates while maintaining their filter selection
})

onMounted(() => {
    fetchData()
    
    // Handle Escape key to close modals
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            if (showDataModal.value) {
                closeDataModal()
            } else if (showHusoModal.value) {
                showHusoModal.value = false
            }
        }
    }
    
    window.addEventListener('keydown', handleEscape)
    
    // Cleanup
    return () => {
        window.removeEventListener('keydown', handleEscape)
    }
})
</script>

<style scoped>
/* Custom scrollbar for table */
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
