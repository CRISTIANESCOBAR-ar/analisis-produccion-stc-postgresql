<template>
  <div class="p-3 sm:p-5 space-y-4 w-full">
    <!-- BARRA SUPERIOR / HEADER COMPACTO -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-3 sm:p-4">
      <div class="flex flex-col 2xl:flex-row 2xl:items-center 2xl:justify-between gap-3">
        <!-- Título y descripción en línea compacta -->
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 text-lg font-bold flex-shrink-0">
            📉
          </div>
          <div>
            <div class="flex flex-wrap items-baseline gap-x-3">
              <h1 class="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
                Análisis Eficiencia Telares vs Calidad
              </h1>
              <p class="text-xs text-slate-500 hidden sm:inline">
                Correlación de eficiencia y roturas (RU105 / RT105) con calidad (Pts/100m² y Calidad %) por trama
              </p>
            </div>
            <p class="text-[11px] text-slate-500 sm:hidden">
              Correlación de eficiencia y roturas con calidad por trama
            </p>
          </div>
        </div>

        <!-- Botones de Acción: Excel, Copiar Imagen, Imprimir -->
        <div class="flex items-center gap-1.5 self-end 2xl:self-auto flex-shrink-0">
          <button
            @click="exportarExcel"
            :disabled="loading || !datosDiarios.length"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Exportar informe a Excel con formato tabla moderno"
          >
            <span>📥</span>
            <span>Excel</span>
          </button>

          <button
            @click="copiarGraficoComoImagen"
            :disabled="loading || !datosDiarios.length"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Copiar imagen del gráfico al portapapeles"
          >
            <span>📋</span>
            <span>{{ copiandoImg ? 'Copiando...' : 'Copiar Gráfico' }}</span>
          </button>

          <button
            @click="imprimirReporte"
            :disabled="loading || !datosDiarios.length"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-700 text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Imprimir informe con gráfico y tabla resumen"
          >
            <span>🖨️</span>
            <span>Imprimir</span>
          </button>
        </div>
      </div>

      <!-- FILTROS: Fecha Inicio, Fecha Fin, Sector, Trama, Defectos, Actualizar -->
      <div class="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-end gap-2.5 sm:gap-3">
        <div class="w-36">
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Fecha Desde</label>
          <CustomDatepicker v-model="fechaInicio" :show-buttons="false" />
        </div>

        <div class="w-36">
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Fecha Hasta</label>
          <CustomDatepicker v-model="fechaFin" :show-buttons="false" />
        </div>

        <div class="w-44 sm:w-48">
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Sector (Defectos)</label>
          <div class="relative">
            <select
              v-model="sectorSeleccionado"
              @change="alCambiarSector"
              class="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 pr-7 appearance-none transition-colors"
            >
              <option value="">Todos los sectores</option>
              <option v-for="sector in sectoresDisponibles" :key="sector" :value="sector">
                {{ sector }}
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div class="w-48 sm:w-56">
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Trama</label>
          <div class="relative">
            <select
              v-model="tramaSeleccionada"
              @change="alCambiarTrama"
              :disabled="loadingTramas"
              class="w-full bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 pr-7 appearance-none transition-colors disabled:opacity-50"
            >
              <option value="" v-if="loadingTramas">Cargando tramas...</option>
              <option value="" v-else>Todas las tramas{{ tramasDisponibles.length ? ` (${tramasDisponibles.length})` : '' }}</option>
              <option v-for="t in tramasDisponibles" :key="t" :value="t">
                {{ t }}
              </option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
              <svg v-if="!loadingTramas" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </div>
        </div>

        <div class="w-48 sm:w-56 relative">
          <label class="block text-[11px] font-semibold text-slate-600 mb-0.5">Defectos</label>
          <div class="relative">
            <!-- Botón del Dropdown -->
            <button
              type="button"
              @click="dropdownDefectosAbierto = !dropdownDefectosAbierto"
              :disabled="loadingDefectos"
              class="w-full text-left bg-slate-50 border border-slate-300 text-slate-800 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 pr-7 transition-colors disabled:opacity-50 flex items-center justify-between"
            >
              <span class="truncate block w-full pr-2">
                <span v-if="loadingDefectos">Cargando...</span>
                <span v-else-if="defectosSeleccionados.length === 0">Totales (Todos)</span>
                <span v-else>{{ defectosSeleccionados.length }} seleccionados</span>
              </span>
              <svg v-if="!loadingDefectos" class="w-3.5 h-3.5 text-slate-500 flex-shrink-0 absolute right-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0 absolute right-2" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </button>

            <!-- Overlay para capturar clicks fuera -->
            <div v-if="dropdownDefectosAbierto" @click="dropdownDefectosAbierto = false" class="fixed inset-0 z-10"></div>
            
            <!-- Menú Dropdown -->
            <div v-if="dropdownDefectosAbierto" class="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              <div class="p-2 border-b border-slate-100 sticky top-0 bg-white z-10">
                <button
                  @click.prevent="defectosSeleccionados = []; alCambiarDefectos()"
                  class="text-xs text-blue-600 font-semibold hover:text-blue-700 hover:bg-blue-50 w-full text-left px-2 py-1.5 rounded transition-colors"
                >
                  Deseleccionar Todos (Totales)
                </button>
              </div>
              <ul class="p-1">
                <li v-if="defectosDisponibles.length === 0" class="p-2 text-xs text-slate-500 text-center">No hay defectos</li>
                <li v-for="def in defectosDisponibles" :key="def.COD_DEF">
                  <label class="flex items-start gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      :value="def.COD_DEF"
                      v-model="defectosSeleccionados"
                      @change="alCambiarDefectos"
                      class="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div class="flex flex-col overflow-hidden">
                      <span class="text-xs font-semibold text-slate-800 truncate">{{ def.COD_DEF }}</span>
                      <span class="text-[10px] text-slate-500 leading-tight truncate" :title="def.DESC_DEFEITO">{{ def.DESC_DEFEITO }}</span>
                    </div>
                  </label>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <button
          @click="cargarDatosCompletos"
          :disabled="loading"
          class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
        >
          <svg
            :class="{ 'animate-spin': loading }"
            class="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ loading ? 'Actualizando...' : 'Actualizar' }}</span>
        </button>
      </div>
    </div>

    <!-- MENSAJE DE ERROR -->
    <div v-if="error" class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
      <div class="flex items-center">
        <span class="text-red-500 mr-2 text-lg">⚠️</span>
        <p class="text-xs text-red-700 font-medium">{{ error }}</p>
      </div>
    </div>

    <!-- SECCIÓN DEL GRÁFICO ECHARTS -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5 relative">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-2 border-b border-slate-100 gap-2">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
          <h2 class="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Evolución Diaria: Eficiencia, Roturas y Calidad
          </h2>
        </div>
        <div class="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
          <span>💡</span>
          <span>Hacé clic en cualquier elemento de la leyenda para ocultar o mostrar su serie (ej: <strong>Meta EFI %</strong>)</span>
        </div>
      </div>

      <!-- Contenedor del gráfico -->
      <div class="relative w-full" style="min-height: 420px;">
        <div
          ref="chartRef"
          class="w-full h-full"
          style="min-height: 420px;"
        ></div>

        <!-- Loading overlay -->
        <div
          v-if="loading"
          class="absolute inset-0 bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center z-10"
        >
          <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-xs font-semibold text-slate-600 mt-2">Cargando métricas...</span>
        </div>

        <!-- Estado sin datos -->
        <div
          v-if="!loading && (!datosDiarios || datosDiarios.length === 0)"
          class="absolute inset-0 flex flex-col items-center justify-center text-slate-400"
        >
          <span class="text-4xl mb-2">📊</span>
          <p class="text-sm font-medium text-slate-600">No se encontraron registros para el período y trama seleccionados</p>
          <p class="text-xs text-slate-400 mt-1">Modificá el rango de fechas o seleccioná "Todas las tramas"</p>
        </div>
      </div>
    </div>

    <!-- SECCIÓN TABLA RESUMEN -->
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-5">
      <div class="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
          <h2 class="text-sm font-semibold text-slate-800 uppercase tracking-wide">
            Resumen Estadístico del Período
          </h2>
        </div>
        <span class="text-xs text-slate-500 font-medium">
          Total de días: <strong class="text-slate-800">{{ datosDiarios.length }}</strong>
          <span v-if="tramaSeleccionada"> | Trama: <strong class="text-blue-600">{{ tramaSeleccionada }}</strong></span>
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="bg-slate-50 text-slate-600 border-b border-slate-200">
              <th class="py-2.5 px-3 font-semibold">Métrica</th>
              <th class="py-2.5 px-3 font-semibold text-center">Promedio</th>
              <th class="py-2.5 px-3 font-semibold text-center">Mínimo</th>
              <th class="py-2.5 px-3 font-semibold text-center">Máximo</th>
              <th class="py-2.5 px-3 font-semibold text-center">Meta Promedio</th>
              <th class="py-2.5 px-3 font-semibold text-center">Desvío vs Meta</th>
              <th class="py-2.5 px-3 font-semibold text-center">Estado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <!-- EFI % -->
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-blue-600"></span>
                <span>Eficiencia %</span>
              </td>
              <td class="py-2.5 px-3 text-center font-semibold text-slate-900">
                {{ formatVal(resumenStats.eficiencia?.avg, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.eficiencia?.min, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.eficiencia?.max, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600 font-medium">
                {{ formatVal(resumenStats.eficiencia?.metaAvg, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center font-semibold" :class="getDesvioClass(resumenStats.eficiencia)">
                {{ formatDesvio(resumenStats.eficiencia?.desvio, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center">
                <span
                  v-if="resumenStats.eficiencia?.metaAvg != null"
                  :class="resumenStats.eficiencia?.isAlert ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'"
                  class="px-2 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1"
                >
                  {{ resumenStats.eficiencia?.isAlert ? '⚠️ Bajo Meta' : '✅ Conforme' }}
                </span>
                <span v-else class="text-slate-400">-</span>
              </td>
            </tr>

            <!-- RU105 -->
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                <span>RU105 (Urdidura)</span>
              </td>
              <td class="py-2.5 px-3 text-center font-semibold text-slate-900">
                {{ formatVal(resumenStats.ru105?.avg) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.ru105?.min) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.ru105?.max) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600 font-medium">
                {{ formatVal(resumenStats.ru105?.metaAvg) }}
              </td>
              <td class="py-2.5 px-3 text-center font-semibold" :class="getDesvioClass(resumenStats.ru105)">
                {{ formatDesvio(resumenStats.ru105?.desvio) }}
              </td>
              <td class="py-2.5 px-3 text-center">
                <span
                  v-if="resumenStats.ru105?.metaAvg != null"
                  :class="resumenStats.ru105?.isAlert ? 'bg-red-100 text-red-800 border-red-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'"
                  class="px-2 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1"
                >
                  {{ resumenStats.ru105?.isAlert ? '⚠️ Exceso Roturas' : '✅ Conforme' }}
                </span>
                <span v-else class="text-slate-400">-</span>
              </td>
            </tr>

            <!-- RT105 -->
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-red-600"></span>
                <span>RT105 (Trama)</span>
              </td>
              <td class="py-2.5 px-3 text-center font-semibold text-slate-900">
                {{ formatVal(resumenStats.rt105?.avg) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.rt105?.min) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.rt105?.max) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600 font-medium">
                {{ formatVal(resumenStats.rt105?.metaAvg) }}
              </td>
              <td class="py-2.5 px-3 text-center font-semibold" :class="getDesvioClass(resumenStats.rt105)">
                {{ formatDesvio(resumenStats.rt105?.desvio) }}
              </td>
              <td class="py-2.5 px-3 text-center">
                <span
                  v-if="resumenStats.rt105?.metaAvg != null"
                  :class="resumenStats.rt105?.isAlert ? 'bg-red-100 text-red-800 border-red-300' : 'bg-emerald-100 text-emerald-800 border-emerald-300'"
                  class="px-2 py-0.5 rounded-full text-[11px] font-semibold border inline-flex items-center gap-1"
                >
                  {{ resumenStats.rt105?.isAlert ? '⚠️ Exceso Roturas' : '✅ Conforme' }}
                </span>
                <span v-else class="text-slate-400">-</span>
              </td>
            </tr>

            <!-- Calidad % -->
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
                <span>Calidad % (1era)</span>
              </td>
              <td class="py-2.5 px-3 text-center font-semibold text-slate-900">
                {{ formatVal(resumenStats.calidad?.avg, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.calidad?.min, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.calidad?.max, '%') }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-400">-</td>
              <td class="py-2.5 px-3 text-center text-slate-400">-</td>
              <td class="py-2.5 px-3 text-center">
                <span class="text-slate-400 text-xs">-</span>
              </td>
            </tr>

            <!-- Pts/100m² -->
            <tr class="hover:bg-slate-50/80 transition-colors">
              <td class="py-2.5 px-3 font-medium text-slate-800 flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-purple-600"></span>
                <span>Pts / 100m²</span>
              </td>
              <td class="py-2.5 px-3 text-center font-semibold text-slate-900">
                {{ formatVal(resumenStats.pts100?.avg) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.pts100?.min) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-600">
                {{ formatVal(resumenStats.pts100?.max) }}
              </td>
              <td class="py-2.5 px-3 text-center text-slate-400">-</td>
              <td class="py-2.5 px-3 text-center text-slate-400">-</td>
              <td class="py-2.5 px-3 text-center">
                <span class="text-slate-400 text-xs">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import ExcelJS from 'exceljs'
import Swal from 'sweetalert2'
import CustomDatepicker from '../CustomDatepicker.vue'
import {
  getDefaultDateRange,
  extractDistinctTramas,
  mergeMetricasPorFecha,
  calculateResumenStats,
  buildEChartsOption
} from '../../utils/analisisEficienciaCalidadHelper.js'
import { exportarAnalisisExcel } from '../../utils/analisisEficienciaCalidadExcel.js'

// Base URL de API
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const apiUrl = (path) => `${API_BASE}${path}`

// Estado de fechas y filtros
const defaults = getDefaultDateRange()
const fechaInicio = ref(defaults.fechaInicio)
const fechaFin = ref(defaults.fechaFin)
const tramaSeleccionada = ref('')
const tramasDisponibles = ref([])

const sectoresDisponibles = ref([])
const sectorSeleccionado = ref('')

const defectosDisponibles = ref([])
const defectosSeleccionados = ref([])
const dropdownDefectosAbierto = ref(false)
const loadingDefectos = ref(false)

// Estados de carga y error
const loading = ref(false)
const loadingTramas = ref(false)
const copiandoImg = ref(false)
const error = ref(null)

// Datos y estadísticas
const datosDiarios = ref([])
const resumenStats = ref({})
const metasGlobales = ref([])

// Referencia ECharts y estado de leyendas
const chartRef = ref(null)
let chartInstance = null
const legendState = ref(null)

// Formateadores auxiliares para la UI
function formatVal(val, suffix = '') {
  if (val === null || val === undefined || isNaN(val)) return '-'
  return `${Number(val).toFixed(2)}${suffix}`
}

function formatDesvio(val, suffix = '') {
  if (val === null || val === undefined || isNaN(val)) return '-'
  const sign = val > 0 ? '+' : ''
  return `${sign}${Number(val).toFixed(2)}${suffix}`
}

function getDesvioClass(stat) {
  if (!stat || stat.desvio === null || stat.desvio === undefined) return 'text-slate-500'
  return stat.isAlert ? 'text-red-600' : 'text-emerald-600'
}

// Inicialización de ECharts
function initChart() {
  if (!chartRef.value) return
  if (chartInstance && !chartInstance.isDisposed()) {
    chartInstance.dispose()
  }
  chartInstance = echarts.init(chartRef.value)

  // Preservar estado de clicks en leyenda
  chartInstance.on('legendselectchanged', (params) => {
    legendState.value = { ...params.selected }
  })
}

// Render del gráfico
function renderChart() {
  if (!chartInstance || chartInstance.isDisposed()) return

  // Dibujar como área si hay un sector seleccionado y NO hay defectos individuales seleccionados
  const drawAsArea = !!sectorSeleccionado.value && defectosSeleccionados.value.length === 0

  const option = buildEChartsOption(datosDiarios.value, { drawAsArea })

  // Aplicar el estado de selección de leyenda guardado por el usuario
  if (legendState.value) {
    option.legend.selected = { ...legendState.value }
  } else {
    // Estado inicial: metas desactivadas por defecto
    legendState.value = { ...option.legend.selected }
  }

  chartInstance.setOption(option, true)
}


// 1. Cargar tramas del período usando el endpoint dedicado / fallback roturas
async function cargarTramasDelPeriodo() {
  if (!fechaInicio.value || !fechaFin.value) return
  loadingTramas.value = true
  try {
    const params = `fechaInicio=${fechaInicio.value}&fechaFin=${fechaFin.value}&date=${fechaFin.value}&monthStart=${fechaInicio.value}&monthEnd=${fechaFin.value}`

    // Intentar primero con el endpoint dedicado de tramas
    let res = await fetch(apiUrl(`/api/produccion/tramas?${params}`))
    if (!res.ok) {
      // Fallback al endpoint de eficiencia-roturas
      res = await fetch(apiUrl(`/api/produccion/eficiencia-roturas?${params}`))
    }

    if (res.ok) {
      const data = await res.json()
      const rawList = Array.isArray(data) ? data : (data?.datos || [])
      const tramas = extractDistinctTramas(rawList)
      tramasDisponibles.value = tramas

      // Si la trama seleccionada no existe en el nuevo período, resetear selección
      if (tramaSeleccionada.value && !tramas.includes(tramaSeleccionada.value)) {
        tramaSeleccionada.value = ''
      }
    }
  } catch (err) {
    console.warn('No se pudieron cargar las tramas del período:', err)
  } finally {
    loadingTramas.value = false
  }
}

// 1b. Cargar defectos del período
async function cargarDefectosDelPeriodo() {
  if (!fechaInicio.value || !fechaFin.value) return
  loadingDefectos.value = true
  try {
    const tramaQuery = tramaSeleccionada.value ? `&trama=${encodeURIComponent(tramaSeleccionada.value)}` : ''
    const sectorQuery = sectorSeleccionado.value ? `&sector=${encodeURIComponent(sectorSeleccionado.value)}` : ''
    const params = `fechaInicio=${fechaInicio.value}&fechaFin=${fechaFin.value}${tramaQuery}${sectorQuery}`
    
    // Primero, traemos los defectos completos para extraer los sectores (sin filtro de sector)
    const paramsAllSectors = `fechaInicio=${fechaInicio.value}&fechaFin=${fechaFin.value}${tramaQuery}`
    const resAll = await fetch(apiUrl(`/api/produccion/defectos?${paramsAllSectors}`))
    if (resAll.ok) {
      const dataAll = await resAll.json()
      // Extraemos todos los sectores únicos de la tabla devuelta
      const allSectors = Array.from(new Set(dataAll.map(d => d.SECTOR).filter(Boolean)))
      sectoresDisponibles.value = allSectors.sort()
    }

    // Ahora traemos la lista filtrada para el combobox
    const res = await fetch(apiUrl(`/api/produccion/defectos?${params}`))
    if (res.ok) {
      const data = await res.json()
      defectosDisponibles.value = data || []
      // Limpiar selección de defectos que ya no están en el nuevo rango/sector
      defectosSeleccionados.value = defectosSeleccionados.value.filter(
        sel => defectosDisponibles.value.some(d => d.COD_DEF === sel)
      )
    }
  } catch (err) {
    console.warn('No se pudieron cargar los defectos del período:', err)
  } finally {
    loadingDefectos.value = false
  }
}

// Observar cambio de fechas para refrescar automáticamente
watch([fechaInicio, fechaFin], () => {
  cargarTramasDelPeriodo()
  cargarDefectosDelPeriodo()
})

// 2. Cargar datos de producción y calidad (y metas si es recarga completa)
async function cargarDatos({ recargarMetas = true } = {}) {
  loading.value = true
  error.value = null

  try {
    const tramaQuery = tramaSeleccionada.value ? `&trama=${encodeURIComponent(tramaSeleccionada.value)}` : ''
    const paramsBase = `fechaInicio=${fechaInicio.value}&fechaFin=${fechaFin.value}`

    const fetchProduccion = fetch(apiUrl(`/api/metricas-diarias-produccion?${paramsBase}${tramaQuery}`)).then(r => r.json())
    const fetchCalidad = fetch(apiUrl(`/api/metricas-diarias-calidad?${paramsBase}${tramaQuery}`)).then(r => r.json())

    let fetchMetas = Promise.resolve(null)
    if (recargarMetas || metasGlobales.value.length === 0) {
      fetchMetas = fetch(apiUrl(`/api/metas-rango?${paramsBase}`)).then(r => r.json())
    }

    let fetchDefectos = Promise.resolve(null)
    const sectorQuery = sectorSeleccionado.value ? `&sector=${encodeURIComponent(sectorSeleccionado.value)}` : ''
    
    // Si hay un sector seleccionado O hay defectos específicos seleccionados
    if (sectorSeleccionado.value || defectosSeleccionados.value.length > 0) {
      const codigos = defectosSeleccionados.value.join(',')
      fetchDefectos = fetch(apiUrl(`/api/metricas-diarias-defectos?${paramsBase}${tramaQuery}${sectorQuery}&codDef=${codigos}`)).then(r => r.json())
    }

    const [resProd, resCal, resMetas, resDefectos] = await Promise.all([
      fetchProduccion,
      fetchCalidad,
      fetchMetas,
      fetchDefectos
    ])

    const dataProd = resProd?.datos || []
    const dataCal = resCal?.datos || []
    if (resMetas) {
      metasGlobales.value = resMetas?.datos || []
    }
    const dataDefectos = resDefectos?.datos || null

    // Merge por fecha de los datasets
    const merged = mergeMetricasPorFecha({
      produccion: dataProd,
      calidad: dataCal,
      metas: metasGlobales.value,
      defectos: dataDefectos
    })

    datosDiarios.value = merged
    resumenStats.value = calculateResumenStats(merged)

    await nextTick()
    renderChart()
  } catch (err) {
    console.error('Error cargando datos de análisis:', err)
    error.value = 'Ocurrió un error al cargar las métricas. Por favor, reintentá.'
  } finally {
    loading.value = false
  }
}

// Carga completa (incluye listas)
async function cargarDatosCompletos() {
  await Promise.all([cargarTramasDelPeriodo(), cargarDefectosDelPeriodo(), cargarDatos({ recargarMetas: true })])
}

// Cambio en combobox de trama (filtra producción y calidad manteniendo metas globales)
async function alCambiarTrama() {
  await cargarDefectosDelPeriodo()
  await cargarDatos({ recargarMetas: false })
}

// Cambio en combobox de sector
async function alCambiarSector() {
  defectosSeleccionados.value = [] // Resetear defectos al cambiar de sector
  await cargarDefectosDelPeriodo()
  await cargarDatos({ recargarMetas: false })
}

// Cambio en checkbox de defectos
async function alCambiarDefectos() {
  await cargarDatos({ recargarMetas: false })
}

// -------------------------------------------------------------
// ACCIONES DE EXPORTACIÓN
// -------------------------------------------------------------

// A. Exportar a Excel con formato moderno (ExcelJS)
async function exportarExcel() {
  if (!datosDiarios.value.length) return
  try {
    await exportarAnalisisExcel(ExcelJS, {
      datos: datosDiarios.value,
      resumenStats: resumenStats.value,
      fechaInicio: fechaInicio.value,
      fechaFin: fechaFin.value,
      trama: tramaSeleccionada.value,
      defectos: defectosSeleccionados.value
    })
    Swal.fire({
      icon: 'success',
      title: 'Excel generado',
      text: 'El archivo se ha descargado exitosamente.',
      timer: 2000,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    })
  } catch (err) {
    console.error('Error exportando a Excel:', err)
    Swal.fire({
      icon: 'error',
      title: 'Error al exportar',
      text: 'No se pudo generar el archivo Excel.'
    })
  }
}

// B. Copiar gráfico como imagen al portapapeles
async function copiarGraficoComoImagen() {
  if (!chartInstance || chartInstance.isDisposed()) return
  copiandoImg.value = true

  try {
    const dataUrl = chartInstance.getDataURL({
      pixelRatio: 2,
      backgroundColor: '#ffffff'
    })

    const response = await fetch(dataUrl)
    const blob = await response.blob()

    if (navigator?.clipboard?.write && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      Swal.fire({
        icon: 'success',
        title: '¡Copiado!',
        text: 'Imagen del gráfico copiada al portapapeles.',
        timer: 1800,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      })
    } else {
      // Fallback: descarga directa si el portapapeles no está disponible
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = `Grafico_Eficiencia_vs_Calidad_${fechaInicio.value}_al_${fechaFin.value}.png`
      a.click()
      Swal.fire({
        icon: 'info',
        title: 'Imagen descargada',
        text: 'La imagen se descargó en tu equipo.',
        timer: 2000,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      })
    }
  } catch (err) {
    console.error('Error al copiar imagen:', err)
    Swal.fire({
      icon: 'error',
      title: 'No se pudo copiar',
      text: 'Ocurrió un inconveniente al generar la imagen.'
    })
  } finally {
    copiandoImg.value = false
  }
}

// C. Imprimir informe con gráfico y tabla
function imprimirReporte() {
  if (!chartInstance || chartInstance.isDisposed()) return

  const imgData = chartInstance.getDataURL({
    pixelRatio: 2,
    backgroundColor: '#ffffff'
  })

  const tramaLabel = tramaSeleccionada.value || 'Todas las tramas'

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Informe Eficiencia vs Calidad</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 20px;
          color: #1e293b;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #0284c7;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .title {
          font-size: 18px;
          font-weight: bold;
          color: #0f172a;
        }
        .meta {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }
        .chart-box {
          text-align: center;
          margin: 16px 0;
          page-break-inside: avoid;
        }
        .chart-box img {
          max-width: 100%;
          height: auto;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          margin-top: 14px;
          page-break-inside: avoid;
        }
        th {
          background-color: #f1f5f9 !important;
          color: #334155;
          font-weight: 600;
          text-align: center;
          padding: 8px 6px;
          border: 1px solid #cbd5e1;
        }
        td {
          padding: 6px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        td.left {
          text-align: left;
          font-weight: 600;
        }
        .alert {
          color: #dc2626;
          font-weight: bold;
        }
        .ok {
          color: #16a34a;
          font-weight: bold;
        }
        @media print {
          body { margin: 10mm; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="title">Santana Textiles Chaco — Informe Eficiencia vs Calidad</div>
          <div class="meta">
            <strong>Período:</strong> ${fechaInicio.value} al ${fechaFin.value} (${datosDiarios.value.length} días) |
            <strong>Trama:</strong> ${tramaLabel}
          </div>
        </div>
        <div class="meta">
          Generado: ${new Date().toLocaleString('es-AR')}
        </div>
      </div>

      <div class="chart-box">
        <img src="${imgData}" />
      </div>

      <table>
        <thead>
          <tr>
            <th>Métrica</th>
            <th>Promedio</th>
            <th>Mínimo</th>
            <th>Máximo</th>
            <th>Meta Promedio</th>
            <th>Desvío vs Meta</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="left">Eficiencia %</td>
            <td>${formatVal(resumenStats.value.eficiencia?.avg, '%')}</td>
            <td>${formatVal(resumenStats.value.eficiencia?.min, '%')}</td>
            <td>${formatVal(resumenStats.value.eficiencia?.max, '%')}</td>
            <td>${formatVal(resumenStats.value.eficiencia?.metaAvg, '%')}</td>
            <td class="${resumenStats.value.eficiencia?.isAlert ? 'alert' : 'ok'}">${formatDesvio(resumenStats.value.eficiencia?.desvio, '%')}</td>
            <td>${resumenStats.value.eficiencia?.metaAvg != null ? (resumenStats.value.eficiencia?.isAlert ? '⚠️ Bajo Meta' : '✅ Conforme') : '-'}</td>
          </tr>
          <tr>
            <td class="left">RU105 (Urdidura)</td>
            <td>${formatVal(resumenStats.value.ru105?.avg)}</td>
            <td>${formatVal(resumenStats.value.ru105?.min)}</td>
            <td>${formatVal(resumenStats.value.ru105?.max)}</td>
            <td>${formatVal(resumenStats.value.ru105?.metaAvg)}</td>
            <td class="${resumenStats.value.ru105?.isAlert ? 'alert' : 'ok'}">${formatDesvio(resumenStats.value.ru105?.desvio)}</td>
            <td>${resumenStats.value.ru105?.metaAvg != null ? (resumenStats.value.ru105?.isAlert ? '⚠️ Exceso Roturas' : '✅ Conforme') : '-'}</td>
          </tr>
          <tr>
            <td class="left">RT105 (Trama)</td>
            <td>${formatVal(resumenStats.value.rt105?.avg)}</td>
            <td>${formatVal(resumenStats.value.rt105?.min)}</td>
            <td>${formatVal(resumenStats.value.rt105?.max)}</td>
            <td>${formatVal(resumenStats.value.rt105?.metaAvg)}</td>
            <td class="${resumenStats.value.rt105?.isAlert ? 'alert' : 'ok'}">${formatDesvio(resumenStats.value.rt105?.desvio)}</td>
            <td>${resumenStats.value.rt105?.metaAvg != null ? (resumenStats.value.rt105?.isAlert ? '⚠️ Exceso Roturas' : '✅ Conforme') : '-'}</td>
          </tr>
          <tr>
            <td class="left">Calidad % (1era)</td>
            <td>${formatVal(resumenStats.value.calidad?.avg, '%')}</td>
            <td>${formatVal(resumenStats.value.calidad?.min, '%')}</td>
            <td>${formatVal(resumenStats.value.calidad?.max, '%')}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
          </tr>
          <tr>
            <td class="left">Pts / 100m²</td>
            <td>${formatVal(resumenStats.value.pts100?.avg)}</td>
            <td>${formatVal(resumenStats.value.pts100?.min)}</td>
            <td>${formatVal(resumenStats.value.pts100?.max)}</td>
            <td>-</td>
            <td>-</td>
            <td>-</td>
          </tr>
        </tbody>
      </table>
    </body>
    </html>
  `

  const ventana = window.open('', '_blank', 'width=1100,height=850')
  if (!ventana) {
    Swal.fire({
      icon: 'warning',
      title: 'Ventana bloqueada',
      text: 'Por favor habilitá las ventanas emergentes para imprimir.'
    })
    return
  }

  ventana.document.write(html)
  ventana.document.close()

  ventana.onload = () => {
    ventana.focus()
    setTimeout(() => {
      let printed = false
      const cerrar = () => { if (!ventana.closed) ventana.close() }
      ventana.onafterprint = cerrar
      ventana.onfocus = () => { if (printed) cerrar() }
      setTimeout(cerrar, 30000)
      ventana.print()
      printed = true
    }, 150)
  }
}

// Redimensión responsiva con ResizeObserver
let resizeObserver = null
function handleResize() {
  if (chartInstance && !chartInstance.isDisposed()) {
    chartInstance.resize()
  }
}

// Lifecycle
onMounted(async () => {
  initChart()

  // ResizeObserver: redimensiona el gráfico ante cualquier cambio de tamaño del contenedor
  if (chartRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => {
      handleResize()
    })
    resizeObserver.observe(chartRef.value)
  } else {
    // Fallback para navegadores sin ResizeObserver
    window.addEventListener('resize', handleResize)
  }

  await cargarDatosCompletos()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  } else {
    window.removeEventListener('resize', handleResize)
  }
  if (chartInstance && !chartInstance.isDisposed()) {
    chartInstance.dispose()
    chartInstance = null
  }
})
</script>

<style scoped>
/* Transición suave para cards y botones */
button {
  transition: all 0.15s ease-in-out;
}
</style>
