<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main ref="mainContentRef" class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col relative">
      <!-- Overlay de carga mejorado: cubre todo el panel y no se desplaza con el scroll -->
      <div v-if="cargando" class="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-50 rounded-2xl transition-all duration-300">
        <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
          <div class="relative">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="h-8 w-8 bg-blue-600 rounded-full animate-pulse opacity-10"></div>
            </div>
          </div>
          <div class="flex flex-col items-center gap-1">
            <span class="text-slate-500 font-medium tracking-wider uppercase text-[10px]">Cargando datos de</span>
            <span class="text-xl text-slate-800 font-bold">{{ mesFormateado }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-between gap-4 flex-shrink-0 mb-4">
        <div class="flex items-center gap-6">
          <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-10 w-auto object-contain" />
          <h3 class="text-lg font-semibold text-slate-800">Residuos de INDIGO y TEJEDURIA</h3>
          <div class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span class="text-sm font-medium text-slate-600">Costo URDIMBRE TEÑIDA:</span>
            <span class="text-sm font-bold text-blue-700">{{ formatCurrencyValue(costoUrdidoTenido) }}</span>
          </div>
        </div>
        
        <div class="flex items-center gap-2">
          <button
            @click="modalUpdate = true"
            class="inline-flex items-center justify-center w-[34px] h-[34px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            v-tippy="{ content: 'Actualizar datos desde archivos CSV', placement: 'bottom' }"
          >
            <span class="text-lg">🔄</span>
          </button>
          <button
            @click="exportarAExcel"
            class="inline-flex items-center gap-1 px-2 py-0 h-[34px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            v-tippy="{ content: 'Exportar a Excel (formato simple)', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12.9,14.5L15.8,19H14L12,15.6L10,19H8.2L11.1,14.5L8.2,10H10L12,13.4L14,10H15.8L12.9,14.5Z"/>
            </svg>
            <span class="text-sm">Excel</span>
          </button>
          <button
            @click="exportarAExcelConFormato"
            class="inline-flex items-center gap-1 px-2 py-0 h-[34px] bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            v-tippy="{ content: 'Exportar a Excel con formato completo (con logo y estructura)', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M15,18V16H13V18H15M15,14V12H13V14H15M10,18V16H8V18H10M10,14V12H8V14H10M15,10V8H13V10H15Z"/>
            </svg>
            <span class="text-sm">Excel Pro</span>
          </button>
          <button
            @click="exportarComoImagen"
            class="inline-flex items-center gap-1 px-2 py-0 h-[34px] bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            v-tippy="{ content: 'Copiar tabla completa al portapapeles (lista para pegar en WhatsApp o correo electrónico)', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01C17.18 3.03 14.69 2 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.188 8.188 0 0 1-1.26-4.38c.01-4.54 3.7-8.24 8.25-8.24M8.53 7.33c-.16 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.39 1 2.56.14.17 1.76 2.67 4.25 3.73.59.27 1.05.42 1.41.53.59.19 1.13.16 1.56.1.48-.07 1.46-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.16-.48-.27-.25-.14-1.47-.74-1.69-.82-.23-.08-.37-.12-.56.12-.16.25-.64.81-.78.97-.15.17-.29.19-.53.07-.26-.13-1.06-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.12-.24-.01-.39.11-.5.11-.11.27-.29.37-.44.13-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.11-.56-1.35-.77-1.84-.2-.48-.4-.42-.56-.43-.14 0-.3-.01-.47-.01z"/>
            </svg>
            <span class="text-sm">WhatsApp</span>
          </button>
          <CustomDatepicker 
            v-model="fechaSeleccionada" 
            label="Fecha:" 
            :show-buttons="true"
            @change="cargarDatos" 
          />
        </div>
      </div>

      <div class="flex-1 overflow-auto min-h-0 border border-slate-200 rounded-lg relative" ref="tablaRef">
        <table ref="tableElementRef" class="w-full text-sm text-left text-slate-600 font-[Verdana]">
          <thead class="text-xs text-slate-700 bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th scope="col" class="pl-2 pr-2 py-1 font-bold border-b border-slate-200 text-center">Fecha</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 border-l-2 text-right">Producción Índigo Metros</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Producción Índigo Kg</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Residuos Índigo Kg</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Residuos Índigo en %</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Meta Índigo %</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Desvío Índigo en Kg</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Desvío Índigo en Metros</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Desvío Índigo en $ (ARS)</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 border-l-2 text-right">Tejeduría Metros</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Tejeduría Kg</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Residuos Tejeduría Kg</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Residuos Tejeduría en %</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Meta Tejeduría %</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Desvío Tejeduría en Kg</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Desvío Tejeduría en Metros</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Anudados</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Promedio x Anudado Kg</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Desvío Tejeduría en $ (ARS)</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 border-l-2 text-right">ESTOPA AZUL PRODUCIDA</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">ESTOPA AZUL PRENSADA</th>
              <th scope="col" class="px-2 py-1 font-bold border-b border-slate-200 text-right">Diferencia</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr v-for="(item, index) in datosCompletos" :key="index" :class="index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'" class="transition-colors cursor-pointer" @dblclick="abrirDetalle(item.DT_BASE_PRODUCAO)">
              <td class="pl-2 pr-2 py-0 font-medium text-slate-900 whitespace-nowrap">{{ item.DT_BASE_PRODUCAO }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] border-l-2 border-slate-200">{{ formatNumber(item.TotalMetros) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-blue-700">{{ formatNumber(item.TotalKg) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-blue-700">{{ formatNumber(item.ResiduosKg) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold" :class="(item.TotalKg > 0 && (item.ResiduosKg / item.TotalKg * 100) > metaPercent) ? 'text-red-600' : 'text-green-600'">{{ formatPercent(item.ResiduosKg, item.TotalKg) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-slate-600">{{ formatDecimal(metaPercent) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold text-red-600">{{ formatDesvio(item.ResiduosKg, item.TotalKg, metaPercent) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold text-red-600">{{ formatDesvioMetros(item.TotalMetros, item.TotalKg, item.ResiduosKg, metaPercent) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold text-red-600">{{ formatCurrency(item.TotalMetros, item.TotalKg, item.ResiduosKg, metaPercent, costoUrdidoTenido) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] border-l-2 border-slate-200">{{ formatNumber(item.TejeduriaMetros) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-cyan-700">{{ formatNumber(item.TejeduriaKg) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-rose-700">{{ formatNumber(item.ResiduosTejeduriaKg) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold" :class="(item.TejeduriaKg > 0 && (item.ResiduosTejeduriaKg / item.TejeduriaKg * 100) > metaTejeduriaPercent) ? 'text-red-600' : 'text-green-600'">{{ formatPercent(item.ResiduosTejeduriaKg, item.TejeduriaKg) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-slate-600">{{ formatDecimal(metaTejeduriaPercent) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold text-red-600">{{ formatDesvio(item.ResiduosTejeduriaKg, item.TejeduriaKg, metaTejeduriaPercent) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold text-red-600">{{ formatDesvioMetros(item.TejeduriaMetros, item.TejeduriaKg, item.ResiduosTejeduriaKg, metaTejeduriaPercent) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-amber-600">{{ formatNumber(item.AnudadosCount) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-emerald-600">{{ formatPromedioAnudado(item.ResiduosTejeduriaKg, item.AnudadosCount) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] font-semibold text-red-600">{{ formatCurrency(item.TejeduriaMetros, item.TejeduriaKg, item.ResiduosTejeduriaKg, metaTejeduriaPercent, costoUrdidoTenido) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-blue-600 border-l-2 border-slate-200">{{ formatNumber(item.EstopaAzulProducida) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-green-600">{{ formatNumber(item.ResiduosPrensadaKg) }}</td>
              <td class="px-2 py-0 text-right font-[Verdana] text-red-500">{{ formatNumber(item.DiferenciaEstopa) }}</td>
            </tr>
            <tr v-if="datosCompletos.length === 0 && !cargando">
              <td colspan="22" class="px-6 py-8 text-center text-slate-500">
                No se encontraron datos para el período seleccionado.
              </td>
            </tr>
          </tbody>
          <tfoot v-if="datosCompletos.length > 0" class="bg-slate-100 font-bold text-slate-800 sticky bottom-0 shadow-inner">
            <tr>
              <td class="pl-2 pr-2 py-1 text-center">TOTAL</td>
              <td class="px-2 py-1 text-right font-mono border-l-2 border-slate-200">{{ formatNumber(totales.metros) }}</td>
              <td class="px-2 py-1 text-right font-mono text-blue-800">{{ formatNumber(totales.kg) }}</td>
              <td class="px-2 py-1 text-right font-mono text-blue-800">{{ formatNumber(totales.residuos) }}</td>
              <td class="px-2 py-1 text-right font-mono font-semibold" :class="(totales.kg > 0 && (totales.residuos / totales.kg * 100) > metaPercent) ? 'text-red-700' : 'text-green-700'">{{ formatPercent(totales.residuos, totales.kg) }}</td>
              <td class="px-2 py-1 text-right font-mono text-slate-700">{{ formatDecimal(metaPercent) }}</td>
              <td class="px-2 py-1 text-right font-mono font-semibold text-red-700">{{ totales.desvioKg > 0 ? formatNumber(totales.desvioKg) : '' }}</td>
              <td class="px-2 py-1 text-right font-mono font-semibold text-red-700">{{ totales.desvioMetros > 0 ? formatNumber(totales.desvioMetros) : '' }}</td>
              <td class="px-2 py-1 text-right font-mono font-semibold text-red-700">{{ totales.desvioIndigoPesos > 0 ? formatCurrencyValue(totales.desvioIndigoPesos) : '' }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] border-l-2 border-slate-200">{{ formatNumber(totales.tejeduriaMetros) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-cyan-800">{{ formatNumber(totales.tejeduriaKg) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-rose-800">{{ formatNumber(totales.residuosTejeduriaKg) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] font-semibold" :class="(totales.tejeduriaKg > 0 && (totales.residuosTejeduriaKg / totales.tejeduriaKg * 100) > metaTejeduriaPercent) ? 'text-red-700' : 'text-green-700'">{{ formatPercent(totales.residuosTejeduriaKg, totales.tejeduriaKg) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-slate-700">{{ formatDecimal(metaTejeduriaPercent) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] font-semibold text-red-700">{{ totales.desvioTejeduriaKg > 0 ? formatNumber(totales.desvioTejeduriaKg) : '' }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] font-semibold text-red-700">{{ totales.desvioTejeduriaMetros > 0 ? formatNumber(totales.desvioTejeduriaMetros) : '' }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-amber-700">{{ formatNumber(totales.anudadosCount) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-emerald-700">{{ formatPromedioAnudadoTotal(totales.residuosTejeduriaKg, totales.anudadosCount) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-green-800">{{ totales.desvioTejeduriaPesos > 0 ? formatCurrencyValue(totales.desvioTejeduriaPesos) : '' }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-blue-700 border-l-2 border-slate-200">{{ formatNumber(totales.estopaAzulProducida) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-green-700">{{ formatNumber(totales.residuosPrensadaKg) }}</td>
              <td class="px-2 py-1 text-right font-[Verdana] text-red-600">{{ formatNumber(totales.diferenciaEstopa) }}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </main>

    <!-- Modal de Detalle -->
    <DetalleResiduosModal 
      :show="modalDetalle" 
      :fecha-inicial="fechaModalDetalle" 
      @close="modalDetalle = false" 
    />

    <!-- Modal de Actualización -->
    <UpdateResiduosModal 
      :show="modalUpdate" 
      @close="modalUpdate = false" 
      @updated="cargarDatos"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import CustomDatepicker from './CustomDatepicker.vue'
import DetalleResiduosModal from './DetalleResiduosModal.vue'
import UpdateResiduosModal from './UpdateResiduosModal.vue'
import { useDatabase } from '../composables/useDatabase'
import { domToPng } from 'modern-screenshot'
import Swal from 'sweetalert2'
import ExcelJS from 'exceljs'

const { getCostosMensual } = useDatabase()

const datos = ref([])
const costosMensuales = ref([])
const costoUrdidoTenido = ref(0)
const cargando = ref(false)
const tablaRef = ref(null)
const tableElementRef = ref(null)
const mainContentRef = ref(null)
const modalDetalle = ref(false)
const modalUpdate = ref(false)
const fechaModalDetalle = ref('')
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

// Meta estándar (a futuro se cargará desde BD)
const metaPercent = ref(1.8)
const metaTejeduriaPercent = ref(0.3)

// Inicializar con la fecha de ayer
const getYesterday = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fechaSeleccionada = ref(getYesterday())

// Formatear mes para mostrar en el mensaje de carga
const mesFormateado = computed(() => {
  if (!fechaSeleccionada.value) return ''
  const [year, month] = fechaSeleccionada.value.split('-')
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
  return `${meses[parseInt(month) - 1]} ${year}`
})

// Calcular fecha de inicio (primer día del mes)
const fechaInicio = computed(() => {
  if (!fechaSeleccionada.value) return ''
  const [year, month] = fechaSeleccionada.value.split('-')
  return `${year}-${month}-01`
})

// Calcular fecha de fin (último día del mes)
const fechaFinMes = computed(() => {
  if (!fechaSeleccionada.value) return ''
  const [year, month] = fechaSeleccionada.value.split('-')
  // Obtener el último día del mes: día 0 del mes siguiente
  const lastDay = new Date(year, month, 0).getDate()
  return `${year}-${month}-${lastDay}`
})

// Generar lista completa de días del mes
const datosCompletos = computed(() => {
  if (!fechaSeleccionada.value) return []
  
  const [year, month, day] = fechaSeleccionada.value.split('-')
  const selectedDay = parseInt(day, 10)
  // Calcular días en el mes
  const daysInMonth = new Date(year, month, 0).getDate()
  const result = []
  
  // Crear mapa de datos existentes para búsqueda rápida
  const datosMap = new Map()
  datos.value.forEach(item => {
    datosMap.set(item.DT_BASE_PRODUCAO, item)
  })
  
  // Iterar por todos los días del mes
  for (let i = 1; i <= daysInMonth; i++) {
    // Formato DD/MM/YYYY
    const dayStr = i.toString().padStart(2, '0')
    const dateStr = `${dayStr}/${month}/${year}`
    
    // Si el día es menor o igual al seleccionado, buscamos datos reales
    if (i <= selectedDay) {
      if (datosMap.has(dateStr)) {
        const data = datosMap.get(dateStr)
        // Calcular campos derivados
        const residuosKg = Number(data.ResiduosKg) || 0
        const residuosTejeduriaKg = Number(data.ResiduosTejeduriaKg) || 0
        const residuosPrensadaKg = Number(data.ResiduosPrensadaKg) || 0
        
        const estopaAzulProducida = residuosKg + residuosTejeduriaKg
        const diferenciaEstopa = residuosPrensadaKg - estopaAzulProducida
        
        result.push({
          ...data,
          EstopaAzulProducida: estopaAzulProducida,
          DiferenciaEstopa: diferenciaEstopa
        })
      } else {
        result.push({
          DT_BASE_PRODUCAO: dateStr,
          TotalMetros: 0,
          TotalKg: 0,
          ResiduosKg: 0,
          TejeduriaMetros: 0,
          TejeduriaKg: 0,
          ResiduosTejeduriaKg: 0,
          AnudadosCount: 0,
          ResiduosPrensadaKg: 0,
          EstopaAzulProducida: 0,
          DiferenciaEstopa: 0
        })
      }
    } else {
      // Para días futuros en el mes, mostramos null para que no se renderice nada
      result.push({
        DT_BASE_PRODUCAO: dateStr,
        TotalMetros: null,
        TotalKg: null,
        ResiduosKg: null,
        TejeduriaMetros: null,
        TejeduriaKg: null,
        ResiduosTejeduriaKg: null,
        AnudadosCount: null,
        ResiduosPrensadaKg: null,
        EstopaAzulProducida: null,
        DiferenciaEstopa: null
      })
    }
  }
  
  return result
})

const totales = computed(() => {
  return datosCompletos.value.reduce((acc, item) => {
    acc.metros += Number(item.TotalMetros) || 0
    acc.kg += Number(item.TotalKg) || 0
    acc.residuos += Number(item.ResiduosKg) || 0
    acc.tejeduriaMetros += Number(item.TejeduriaMetros) || 0
    acc.tejeduriaKg += Number(item.TejeduriaKg) || 0
    acc.residuosTejeduriaKg += Number(item.ResiduosTejeduriaKg) || 0
    acc.anudadosCount += Number(item.AnudadosCount) || 0
    acc.residuosPrensadaKg += Number(item.ResiduosPrensadaKg) || 0
    acc.estopaAzulProducida += Number(item.EstopaAzulProducida) || 0
    acc.diferenciaEstopa += Number(item.DiferenciaEstopa) || 0
    
    // Calcular desvío en Kg para este día
    if (item.TotalKg > 0) {
      const residuosPercent = (item.ResiduosKg / item.TotalKg) * 100
      const desvioKg = ((residuosPercent - metaPercent.value) * item.TotalKg) / 100
      if (desvioKg > 0) {
        acc.desvioKg += desvioKg
        // Calcular desvío en metros para este día
        const desvioMetros = (item.TotalMetros / item.TotalKg) * desvioKg
        acc.desvioMetros += desvioMetros
        // Calcular valor monetario del desvío Índigo
        if (costoUrdidoTenido.value > 0) {
          acc.desvioIndigoPesos += desvioMetros * costoUrdidoTenido.value
        }
      }
    }

    // Calcular desvío Tejeduría
    if (item.TejeduriaKg > 0) {
      const residuosTejPercent = (item.ResiduosTejeduriaKg / item.TejeduriaKg) * 100
      const desvioTejKg = ((residuosTejPercent - metaTejeduriaPercent.value) * item.TejeduriaKg) / 100
      if (desvioTejKg > 0) {
        acc.desvioTejeduriaKg += desvioTejKg
        const desvioTejMetros = (item.TejeduriaMetros / item.TejeduriaKg) * desvioTejKg
        acc.desvioTejeduriaMetros += desvioTejMetros
        // Calcular valor monetario del desvío Tejeduría
        if (costoUrdidoTenido.value > 0) {
          acc.desvioTejeduriaPesos += desvioTejMetros * costoUrdidoTenido.value
        }
      }
    }
    
    return acc
  }, { 
    metros: 0, kg: 0, residuos: 0, desvioKg: 0, desvioMetros: 0, desvioIndigoPesos: 0,
    tejeduriaMetros: 0, tejeduriaKg: 0, residuosTejeduriaKg: 0,
    desvioTejeduriaKg: 0, desvioTejeduriaMetros: 0, desvioTejeduriaPesos: 0, anudadosCount: 0,
    residuosPrensadaKg: 0, estopaAzulProducida: 0, diferenciaEstopa: 0
  })
})

const formatNumber = (num) => {
  if (num === null || num === undefined || num === '') return ''
  // Formato entero con separador de miles (#.###0)
  return new Intl.NumberFormat('es-AR', { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 0 
  }).format(num)
}

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

const resolveMetaValue = (meta) => {
  if (meta && typeof meta === 'object' && 'value' in meta) {
    return toNumber(meta.value)
  }
  return toNumber(meta)
}

const formatPercent = (residuos, produccion) => {
  const prod = toNumber(produccion)
  if (prod === null) return ''
  if (prod === 0) return '0,0'
  const res = toNumber(residuos) || 0
  const percent = (res / prod) * 100
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(percent)
}

const formatDecimal = (num) => {
  const value = toNumber(num)
  if (value === null) return ''
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)
}

const formatDesvio = (residuos, produccion, meta = metaPercent.value) => {
  const prod = toNumber(produccion)
  if (!prod) return ''
  const res = toNumber(residuos) || 0
  const metaValue = resolveMetaValue(meta)
  if (metaValue === null) return ''
  const residuosPercent = (res / prod) * 100
  const desvio = ((residuosPercent - metaValue) * prod) / 100
  // No mostrar valores negativos (meta alcanzada o no superada)
  if (!Number.isFinite(desvio) || desvio <= 0) return ''
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(desvio)
}

const formatDesvioMetros = (metros, kg, residuos, meta = metaPercent.value) => {
  const kgValue = toNumber(kg)
  if (!kgValue) return ''
  const res = toNumber(residuos) || 0
  const metaValue = resolveMetaValue(meta)
  if (metaValue === null) return ''
  const residuosPercent = (res / kgValue) * 100
  const desvioKg = ((residuosPercent - metaValue) * kgValue) / 100
  // No mostrar si el desvío en Kg es negativo o cero
  if (!Number.isFinite(desvioKg) || desvioKg <= 0) return ''
  const metrosValue = toNumber(metros)
  if (!metrosValue) return ''
  const desvioMetros = (metrosValue / kgValue) * desvioKg
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(desvioMetros)
}

const formatPromedioAnudado = (residuos, anudados) => {
  const res = toNumber(residuos)
  const anud = toNumber(anudados)
  if (!res || res === 0) return ''
  if (!anud || anud === 0) return ''
  
  const promedio = res / anud
  
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(promedio)
}

const formatPromedioAnudadoTotal = (residuos, anudados) => {
  const res = toNumber(residuos)
  const anud = toNumber(anudados)
  if (!res || res <= 0) return ''
  if (!anud || anud === 0) return ''
  
  const promedio = res / anud
  
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(promedio)
}

const formatCurrency = (metros, kg, residuos, meta, costo) => {
  const kgValue = toNumber(kg)
  if (!kgValue) return ''
  const costoValue = resolveMetaValue(costo)
  if (!costoValue) return ''
  const res = toNumber(residuos) || 0
  const metaValue = resolveMetaValue(meta)
  if (metaValue === null) return ''
  const residuosPercent = (res / kgValue) * 100
  const desvioKg = ((residuosPercent - metaValue) * kgValue) / 100
  if (!Number.isFinite(desvioKg) || desvioKg <= 0) return ''
  const metrosValue = toNumber(metros)
  if (!metrosValue) return ''
  const desvioMetros = (metrosValue / kgValue) * desvioKg
  const valorPesos = desvioMetros * costoValue
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valorPesos)
}

const formatCurrencyValue = (valor) => {
  if (!valor || valor <= 0) return ''
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(valor)
}

const cargarCostos = async () => {
  if (!fechaSeleccionada.value) return
  
  try {
    // Convertir fecha a formato yyyymm (YYYY-MM)
    const [year, month] = fechaSeleccionada.value.split('-')
    const yyyymm = `${year}-${month}`
    
    // Optimización: cargar solo 3 meses (actual, anterior y siguiente) en lugar de 36
    const resultado = await getCostosMensual(3)
    
    // El API retorna {rows: Array}
    const costosArray = resultado?.rows || []
    costosMensuales.value = costosArray
    
    // Buscar el costo de URDIDO_TENIDO para el mes seleccionado
    let costoMes = costosArray.find(c => c.yyyymm === yyyymm && c.codigo === 'URDIDO_TENIDO')
    
    // Si no está en los últimos 3 meses, buscar específicamente ese mes en el backend
    if (!costoMes) {
      console.log(`🔍 Mes ${yyyymm} no está en los últimos 3 meses, consultando...`)
      const resultadoEspecifico = await getCostosMensual(100) // Cargar más meses para encontrarlo
      const costosExtendidos = resultadoEspecifico?.rows || []
      costoMes = costosExtendidos.find(c => c.yyyymm === yyyymm && c.codigo === 'URDIDO_TENIDO')
      
      if (costoMes) {
        console.log(`✅ Costo encontrado para ${yyyymm}: $${costoMes.ars_por_unidad}`)
      } else {
        console.warn(`⚠️ No se encontró costo para ${yyyymm}`)
      }
    }
    
    costoUrdidoTenido.value = costoMes ? Number(costoMes.ars_por_unidad) || 0 : 0
  } catch (error) {
    console.error('Error al cargar costos:', error)
    costoUrdidoTenido.value = 0
  }
}

const cargarDatos = async () => {
  if (!fechaSeleccionada.value) return
  
  cargando.value = true
  console.log(`📅 Cargando datos para el mes: ${mesFormateado.value}`)
  console.log(`🔍 Rango: ${fechaInicio.value} a ${fechaFinMes.value}`)
  
  try {
    // Cargar costos y datos en paralelo
    await cargarCostos()
    
    // Solicitar datos para todo el mes
    const url = `${API_URL}/residuos-indigo-tejeduria?fecha_inicio=${fechaInicio.value}&fecha_fin=${fechaFinMes.value}`
    console.log(`🌐 Consultando: ${url}`)
    const response = await fetch(url)
    if (!response.ok) throw new Error('Error al cargar datos')
    const data = await response.json()
    datos.value = data
    console.log(`✅ Datos cargados: ${data.length} registros para ${mesFormateado.value}`)
  } catch (error) {
    console.error('❌ Error:', error)
    alert('Error al cargar los datos: ' + error.message)
  } finally {
    cargando.value = false
  }
}

const exportarAExcel = async () => {
  try {
    // Crear workbook y worksheet con ExcelJS (formato simple)
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Residuos', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }], // Congelar fila de encabezado
      pageSetup: {
        paperSize: 5, // Legal
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.196850393700787,
          right: 0.196850393700787,
          top: 0.196850393700787,
          bottom: 0.393700787401575,
          header: 0.196850393700787,
          footer: 0.196850393700787
        },
        horizontalCentered: true,
        verticalCentered: false
      }
    })
    
    // Definir columnas con anchos (formato simple)
    worksheet.columns = [
      { header: 'Fecha', key: 'fecha', width: 10.86 },
      { header: 'Producción Índigo Metros', key: 'prod_ind_m', width: 9.43 },
      { header: 'Producción Índigo Kg', key: 'prod_ind_kg', width: 9.29 },
      { header: 'Residuos Índigo Kg', key: 'res_ind_kg', width: 8.43 },
      { header: 'Residuos Índigo en %', key: 'res_ind_pct', width: 8.43 },
      { header: 'Meta Índigo %', key: 'meta_ind', width: 6.43 },
      { header: 'Desvío Índigo en Kg', key: 'desv_ind_kg', width: 7 },
      { header: 'Desvío Índigo en Metros', key: 'desv_ind_m', width: 9.29 },
      { header: 'Desvío Índigo en $ (ARS)', key: 'desv_ind_ars', width: 11.71 },
      { header: 'Tejeduría Metros', key: 'tej_m', width: 7.71 },
      { header: 'Tejeduría Kg', key: 'tej_kg', width: 7.71 },
      { header: 'Residuos Tejeduría Kg', key: 'res_tej_kg', width: 9.57 },
      { header: 'Residuos Tejeduría en %', key: 'res_tej_pct', width: 8.43 },
      { header: 'Meta Tejeduría %', key: 'meta_tej', width: 7.71 },
      { header: 'Desvío Tejeduría en Kg', key: 'desv_tej_kg', width: 7.71 },
      { header: 'Desvío Tejeduría en Metros', key: 'desv_tej_m', width: 10 },
      { header: 'Anudados', key: 'anudados', width: 4.14 },
      { header: 'Promedio x Anudado Kg', key: 'prom_anud', width: 10.57 },
      { header: 'Desvío Tejeduría en $ (ARS)', key: 'desv_tej_ars', width: 10.57 },
      { header: 'ESTOPA AZUL PRODUCIDA', key: 'estopa_prod', width: 12.57 },
      { header: 'ESTOPA AZUL PRENSADA', key: 'estopa_prens', width: 11.29 },
      { header: 'Diferencia', key: 'diferencia', width: 6.14 }
    ]
    
    // Estilo del encabezado simple
    worksheet.getRow(1).height = 55
    for (let colNumber = 1; colNumber <= 22; colNumber++) {
      const cell = worksheet.getRow(1).getCell(colNumber)
      cell.font = { bold: true, color: { argb: 'FF334155' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
      
      if (colNumber === 2 || colNumber === 10 || colNumber === 20) {
        cell.border.left = { style: 'medium', color: { argb: 'FF94A3B8' } }
      }
    }
    
    const round0 = (value) => {
      const num = toNumber(value)
      return num === null ? null : Math.round(num)
    }

    const round2 = (value) => {
      const num = toNumber(value)
      return num === null ? null : Number(num.toFixed(2))
    }

    // Helper para calcular valores
    const calcDesvioKg = (residuos, produccion, meta) => {
      if (!produccion || produccion === 0) return null
      const residuosPercent = (residuos / produccion) * 100
      const desvio = ((residuosPercent - meta) * produccion) / 100
      return desvio > 0 ? desvio : null
    }
    
    const calcDesvioMetros = (metros, kg, residuos, meta) => {
      if (!kg || kg === 0) return null
      const desvioKg = calcDesvioKg(residuos, kg, meta)
      if (!desvioKg) return null
      return (metros / kg) * desvioKg
    }
    
    const calcDesvioArs = (metros, kg, residuos, meta, costo) => {
      if (!costo || costo === 0) return null
      const desvioMetros = calcDesvioMetros(metros, kg, residuos, meta)
      if (!desvioMetros) return null
      return desvioMetros * costo
    }
    
    // Agregar datos en formato simple con objetos
    datosCompletos.value.forEach(item => {
      // Convertir fecha
      let fechaExcel = null
      if (item.DT_BASE_PRODUCAO) {
        const [dia, mes, anio] = item.DT_BASE_PRODUCAO.split('/')
        fechaExcel = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia))
      }
      
      const totalMetros = round0(item.TotalMetros)
      const totalKg = round0(item.TotalKg)
      const residuosKg = round0(item.ResiduosKg)
      const tejeduriaMetros = round0(item.TejeduriaMetros)
      const tejeduriaKg = round0(item.TejeduriaKg)
      const residuosTejKg = round0(item.ResiduosTejeduriaKg)
      const residuosPrens = round0(item.ResiduosPrensadaKg)
      const estopaProd = round0(item.EstopaAzulProducida)
      const diferenciaEstopa = round0(item.DiferenciaEstopa)
      const anudados = round0(item.AnudadosCount)

      const desvioIndigoKg = calcDesvioKg(residuosKg, totalKg, metaPercent.value)
      const desvioIndigoMetros = calcDesvioMetros(totalMetros, totalKg, residuosKg, metaPercent.value)
      const desvioIndigoPesos = calcDesvioArs(item.TotalMetros, item.TotalKg, item.ResiduosKg, metaPercent.value, costoUrdidoTenido.value)
      const desvioTejKg = calcDesvioKg(residuosTejKg, tejeduriaKg, metaTejeduriaPercent.value)
      const desvioTejMetros = calcDesvioMetros(tejeduriaMetros, tejeduriaKg, residuosTejKg, metaTejeduriaPercent.value)
      const desvioTejPesos = calcDesvioArs(item.TejeduriaMetros, item.TejeduriaKg, item.ResiduosTejeduriaKg, metaTejeduriaPercent.value, costoUrdidoTenido.value)
      const promedioAnudado = (residuosTejKg && anudados && anudados > 0) 
        ? round2(residuosTejKg / anudados) 
        : null
      
      worksheet.addRow({
        fecha: fechaExcel,
        prod_ind_m: totalMetros,
        prod_ind_kg: totalKg,
        res_ind_kg: residuosKg,
        res_ind_pct: totalKg ? (residuosKg / totalKg) : null,
        meta_ind: metaPercent.value / 100,
        desv_ind_kg: desvioIndigoKg,
        desv_ind_m: desvioIndigoMetros,
        desv_ind_ars: desvioIndigoPesos,
        tej_m: tejeduriaMetros,
        tej_kg: tejeduriaKg,
        res_tej_kg: residuosTejKg,
        res_tej_pct: tejeduriaKg ? (residuosTejKg / tejeduriaKg) : null,
        meta_tej: metaTejeduriaPercent.value / 100,
        desv_tej_kg: desvioTejKg,
        desv_tej_m: desvioTejMetros,
        anudados,
        prom_anud: promedioAnudado,
        desv_tej_ars: desvioTejPesos,
        estopa_prod: estopaProd,
        estopa_prens: residuosPrens,
        diferencia: diferenciaEstopa
      })
    })
    
    // Agregar fila de totales
    const totalMetros = round0(totales.value.metros)
    const totalKg = round0(totales.value.kg)
    const totalResiduos = round0(totales.value.residuos)
    const totalTejMetros = round0(totales.value.tejeduriaMetros)
    const totalTejKg = round0(totales.value.tejeduriaKg)
    const totalResTej = round0(totales.value.residuosTejeduriaKg)
    const totalAnudados = round0(totales.value.anudadosCount)
    const totalEstopaProd = round0(totales.value.estopaAzulProducida)
    const totalEstopaPrens = round0(totales.value.residuosPrensadaKg)
    const totalDiffEstopa = round0(totales.value.diferenciaEstopa)
    const totalPromedioAnudado = (totalResTej && totalAnudados > 0) 
      ? round2(totalResTej / totalAnudados) 
      : null
    
    const totalRow = worksheet.addRow({
      fecha: 'TOTAL',
      prod_ind_m: totalMetros,
      prod_ind_kg: totalKg,
      res_ind_kg: totalResiduos,
      res_ind_pct: totalKg ? (totalResiduos / totalKg) : null,
      meta_ind: metaPercent.value / 100,
      desv_ind_kg: totales.value.desvioKg > 0 ? totales.value.desvioKg : null,
      desv_ind_m: totales.value.desvioMetros > 0 ? totales.value.desvioMetros : null,
      desv_ind_ars: totales.value.desvioIndigoPesos > 0 ? totales.value.desvioIndigoPesos : null,
      tej_m: totalTejMetros,
      tej_kg: totalTejKg,
      res_tej_kg: totalResTej,
      res_tej_pct: totalTejKg ? (totalResTej / totalTejKg) : null,
      meta_tej: metaTejeduriaPercent.value / 100,
      desv_tej_kg: totales.value.desvioTejeduriaKg > 0 ? totales.value.desvioTejeduriaKg : null,
      desv_tej_m: totales.value.desvioTejeduriaMetros > 0 ? totales.value.desvioTejeduriaMetros : null,
      anudados: totalAnudados,
      prom_anud: totalPromedioAnudado,
      desv_tej_ars: totales.value.desvioTejeduriaPesos > 0 ? totales.value.desvioTejeduriaPesos : null,
      estopa_prod: totalEstopaProd,
      estopa_prens: totalEstopaPrens,
      diferencia: totalDiffEstopa
    })
    
    // Estilo de fila de totales
    totalRow.height = 25
    for (let colNumber = 1; colNumber <= 22; colNumber++) {
      const cell = totalRow.getCell(colNumber)
      cell.font = { bold: true, color: { argb: 'FF1E293B' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    
    // Definir formatos comunes
    const formatos = {
      1: 'dd/mm/yyyy', // Fecha
      2: '#,##0', // Producción Metros
      3: '#,##0', // Producción Kg
      4: '#,##0', // Residuos Kg
      5: '0.0%', // Residuos %
      6: '0.0%', // Meta Índigo
      7: '#,##0', // Desvío Kg
      8: '#,##0', // Desvío Metros
      9: '"$"#,##0', // Desvío $
      10: '#,##0', // Tejeduría Metros
      11: '#,##0', // Tejeduría Kg
      12: '#,##0', // Residuos Tej Kg
      13: '0.0%', // Residuos Tej %
      14: '0.0%', // Meta Tej
      15: '#,##0', // Desvío Tej Kg
      16: '#,##0', // Desvío Tej Metros
      17: '#,##0', // Anudados
      18: '#,##0.00', // Promedio
      19: '"$"#,##0', // Desvío Tej $
      20: '#,##0', // Estopa Prod
      21: '#,##0', // Estopa Prens
      22: '#,##0'  // Diferencia
    }

    // Aplicar colores y estilos a TODAS las celdas de datos y totales
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header
      
      const isTotalRow = (rowNumber === worksheet.rowCount)
      
      for (let colNumber = 1; colNumber <= 22; colNumber++) {
        const cell = row.getCell(colNumber)
        
        cell.border = {
          top: { style: isTotalRow ? 'medium' : 'thin', color: { argb: isTotalRow ? 'FFCBD5E1' : 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
        
        if (colNumber === 2 || colNumber === 10 || colNumber === 20) {
          cell.border.left = { style: 'medium', color: { argb: 'FF94A3B8' } }
        }
        
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        
        if (formatos[colNumber]) {
          cell.numFmt = formatos[colNumber]
        }

        let color = null
        const val = cell.value
        
        if (colNumber === 3 || colNumber === 4) {
          color = isTotalRow ? 'FF1E40AF' : 'FF1D4ED8'
        }
        else if (colNumber === 5) {
          const meta = row.getCell(6).value
          color = (val > meta) ? 'FFDC2626' : 'FF16A34A'
        }
        else if (colNumber === 7 || colNumber === 8 || colNumber === 9) {
          if (val > 0) color = 'FFDC2626'
        }
        else if (colNumber === 11) {
          color = isTotalRow ? 'FF155E75' : 'FF0E7490'
        }
        else if (colNumber === 12) {
          color = isTotalRow ? 'FF9F1239' : 'FFBE123C'
        }
        else if (colNumber === 13) {
          const meta = row.getCell(14).value
          color = (val > meta) ? 'FFDC2626' : 'FF16A34A'
        }
        else if (colNumber === 15 || colNumber === 16 || colNumber === 19) {
          if (val > 0) color = 'FFDC2626'
        }
        else if (colNumber === 17) {
          color = isTotalRow ? 'FFB45309' : 'FFD97706'
        }
        else if (colNumber === 18) {
          color = isTotalRow ? 'FF047857' : 'FF059669'
        }
        else if (colNumber === 20) {
          color = isTotalRow ? 'FF1D4ED8' : 'FF2563EB'
        }
        else if (colNumber === 21) {
          color = isTotalRow ? 'FF15803D' : 'FF16A34A'
        }
        else if (colNumber === 22) {
          if (val !== 0 && val !== null) color = 'FFEF4444'
        }

        if (color) {
          cell.font = { ...cell.font, color: { argb: color }, bold: true }
        } else if (isTotalRow) {
          cell.font = { bold: true, color: { argb: 'FF1E293B' } }
        }
      }
    })
    
    // Establecer área de impresión
    const lastRow = worksheet.rowCount
    worksheet.pageSetup.printArea = `A1:V${lastRow}`
    
    // Generar nombre de archivo
    const ahora = new Date()
    const dia = ahora.getDate().toString().padStart(2, '0')
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0')
    const anio = ahora.getFullYear()
    const hora = ahora.getHours().toString().padStart(2, '0')
    const minuto = ahora.getMinutes().toString().padStart(2, '0')
    
    const nombreArchivo = `Residuos_${mesFormateado.value.replace(' ', '_')}_${dia}-${mes}-${anio}_${hora}${minuto}.xlsx`
    
    // Generar y descargar archivo
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nombreArchivo
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    // Notificación de éxito
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Excel generado',
      text: 'Archivo descargado exitosamente',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    console.error('Error al exportar a Excel:', error)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error al exportar',
      text: error.message,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true
    })
  }
}

const exportarAExcelConFormato = async () => {
  try {
    // Crear workbook y worksheet con ExcelJS (formato completo con logo)
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Residuos', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 6 }], // Congelar hasta fila 6
      pageSetup: {
        paperSize: 5,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: {
          left: 0.196850393700787,
          right: 0.196850393700787,
          top: 0.196850393700787,
          bottom: 0.393700787401575,
          header: 0.196850393700787,
          footer: 0.196850393700787
        },
        horizontalCentered: true,
        verticalCentered: false
      }
    })
    
    // Configurar anchos de columnas según archivo de referencia
    worksheet.columns = [
      { key: 'col_a', width: 0.86 },
      { key: 'col_b', width: 14.14 },
      { key: 'col_c', width: 13.29 },
      { key: 'col_d', width: 11.43 },
      { key: 'col_e', width: 8.71 },
      { key: 'col_f', width: 5.71 },
      { key: 'col_g', width: 13.0 },
      { key: 'col_h', width: 8.43 },
      { key: 'col_i', width: 9.29 },
      { key: 'col_j', width: 14.86 },
      { key: 'col_k', width: 11.71 },
      { key: 'col_l', width: 11.43 },
      { key: 'col_m', width: 8.71 },
      { key: 'col_n', width: 5.71 },
      { key: 'col_o', width: 13.0 },
      { key: 'col_p', width: 8.43 },
      { key: 'col_q', width: 9.29 },
      { key: 'col_r', width: 7.71 },
      { key: 'col_s', width: 8.71 },
      { key: 'col_t', width: 14.71 },
      { key: 'col_u', width: 12.71 },
      { key: 'col_v', width: 13.0 },
      { key: 'col_w', width: 10.29 }
    ]
    
    // FILA 1
    worksheet.getRow(1).height = 4.5
    
    // FILA 2: Logo + Título
    worksheet.getRow(2).height = 20.1
    worksheet.mergeCells('B2:B3')
    const cellLogo = worksheet.getCell('B2')
    cellLogo.alignment = { horizontal: 'center', vertical: 'middle' }
    
    try {
      const logoResponse = await fetch('/LogoSantana.jpg')
      const logoBlob = await logoResponse.blob()
      const logoArrayBuffer = await logoBlob.arrayBuffer()
      const logoBase64 = btoa(new Uint8Array(logoArrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''))
      
      const logoId = workbook.addImage({
        base64: logoBase64,
        extension: 'jpeg'
      })
      
      worksheet.addImage(logoId, {
        tl: { col: 1.1, row: 1.2 },
        ext: { width: 100, height: 35 }
      })
    } catch (logoError) {
      console.warn('No se pudo cargar el logo:', logoError)
    }
    
    worksheet.mergeCells('C2:T2')
    const cellTitulo = worksheet.getCell('C2')
    cellTitulo.value = 'SANTANA TEXTIL CHACO S.A. - UNIDAD V'
    cellTitulo.font = { name: 'Tahoma', size: 10, bold: true }
    cellTitulo.alignment = { horizontal: 'center', vertical: 'middle' }
    
    worksheet.mergeCells('U2:W2')
    const cellMesLabel = worksheet.getCell('U2')
    cellMesLabel.value = 'Mes'
    cellMesLabel.font = { name: 'Tahoma', size: 10 }
    cellMesLabel.alignment = { horizontal: 'center', vertical: 'middle' }
    
    // FILA 3
    worksheet.getRow(3).height = 20.1
    worksheet.mergeCells('C3:T3')
    const cellSubtitulo = worksheet.getCell('C3')
    cellSubtitulo.value = '\"SEGUIMIENTO de RESIDUOS ESTOPA TEÑIDA de ÍNDIGO y TEJEDURÍA\"'
    cellSubtitulo.font = { name: 'Tahoma', size: 10 }
    cellSubtitulo.alignment = { horizontal: 'center', vertical: 'middle' }
    
    worksheet.mergeCells('U3:W3')
    const cellFechaMes = worksheet.getCell('U3')
    if (fechaSeleccionada.value) {
      const [yyyy, mm, dd] = fechaSeleccionada.value.split('-')
      cellFechaMes.value = `${mesFormateado.value}`
      cellFechaMes.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    
    // FILA 5: Secciones
    worksheet.getRow(5).height = 20.1
    worksheet.mergeCells('C5:J5')
    const cellSeccionIndigo = worksheet.getCell('C5')
    cellSeccionIndigo.value = 'ÍNDIGO'
    cellSeccionIndigo.font = { name: 'Tahoma', size: 10, bold: true }
    cellSeccionIndigo.alignment = { horizontal: 'center', vertical: 'middle' }
    
    worksheet.mergeCells('K5:T5')
    const cellSeccionTej = worksheet.getCell('K5')
    cellSeccionTej.value = 'TEJEDURÍA'
    cellSeccionTej.font = { name: 'Tahoma', size: 10, bold: true }
    cellSeccionTej.alignment = { horizontal: 'center', vertical: 'middle' }
    
    worksheet.mergeCells('U5:W5')
    const cellBalance = worksheet.getCell('U5')
    cellBalance.value = 'BALANCE'
    cellBalance.font = { name: 'Tahoma', size: 10, bold: true }
    cellBalance.alignment = { horizontal: 'center', vertical: 'middle' }
    
    // FILA 6: Encabezados
    worksheet.getRow(6).height = 39.95
    const encabezados = ['', 'Fecha', 'Producción Metros', 'Producción Kg', 'Residuos Kg', 'Resid en %', 'Meta %', 'Desvió en Kg', 'Desvió en Metros', 'Desvió en $', 'Producción Metros', 'Producción Kg', 'Residuos Kg', 'Resid en %', 'Meta %', 'Desvió en Kg', 'Desvió en Metros', 'Cant. Anudados', 'Prom. x Anudado', 'Desvió en $', 'ESTOPA AZUL PRODUCIDA', 'ESTOPA AZUL PRENSADA', 'Diferencia']
    
    for (let colNumber = 1; colNumber <= encabezados.length; colNumber++) {
      const cell = worksheet.getRow(6).getCell(colNumber)
      cell.value = encabezados[colNumber - 1]
      cell.font = { name: 'Tahoma', size: 10 }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEA7E6C' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    }
    
    // Helpers
    const calcDesvioKg = (residuos, produccion, meta) => {
      if (!produccion || produccion === 0) return null
      const residuosPercent = (residuos / produccion) * 100
      const desvio = ((residuosPercent - meta) * produccion) / 100
      return desvio > 0 ? desvio : null
    }
    
    const calcDesvioMetros = (metros, kg, residuos, meta) => {
      if (!kg || kg === 0) return null
      const desvioKg = calcDesvioKg(residuos, kg, meta)
      if (!desvioKg) return null
      return (metros / kg) * desvioKg
    }
    
    const calcDesvioArs = (metros, kg, residuos, meta, costo) => {
      if (!costo || costo === 0) return null
      const desvioMetros = calcDesvioMetros(metros, kg, residuos, meta)
      if (!desvioMetros) return null
      return desvioMetros * costo
    }
    
    // Agregar datos
    datosCompletos.value.forEach(item => {
      let fechaExcel = null
      if (item.DT_BASE_PRODUCAO) {
        const [dia, mes, anio] = item.DT_BASE_PRODUCAO.split('/')
        fechaExcel = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia))
      }
      
      const desvioIndigoKg = calcDesvioKg(item.ResiduosKg, item.TotalKg, metaPercent.value)
      const desvioIndigoMetros = calcDesvioMetros(item.TotalMetros, item.TotalKg, item.ResiduosKg, metaPercent.value)
      const desvioIndigoPesos = calcDesvioArs(item.TotalMetros, item.TotalKg, item.ResiduosKg, metaPercent.value, costoUrdidoTenido.value)
      const desvioTejKg = calcDesvioKg(item.ResiduosTejeduriaKg, item.TejeduriaKg, metaTejeduriaPercent.value)
      const desvioTejMetros = calcDesvioMetros(item.TejeduriaMetros, item.TejeduriaKg, item.ResiduosTejeduriaKg, metaTejeduriaPercent.value)
      const desvioTejPesos = calcDesvioArs(item.TejeduriaMetros, item.TejeduriaKg, item.ResiduosTejeduriaKg, metaTejeduriaPercent.value, costoUrdidoTenido.value)
      const promedioAnudado = (item.ResiduosTejeduriaKg && item.AnudadosCount && item.AnudadosCount > 0) ? item.ResiduosTejeduriaKg / item.AnudadosCount : null
      
      const dataRow = worksheet.addRow(['', fechaExcel, item.TotalMetros ?? null, item.TotalKg ?? null, item.ResiduosKg ?? null, item.TotalKg ? (item.ResiduosKg / item.TotalKg) : null, metaPercent.value / 100, desvioIndigoKg, desvioIndigoMetros, desvioIndigoPesos, item.TejeduriaMetros ?? null, item.TejeduriaKg ?? null, item.ResiduosTejeduriaKg ?? null, item.TejeduriaKg ? (item.ResiduosTejeduriaKg / item.TejeduriaKg) : null, metaTejeduriaPercent.value / 100, desvioTejKg, desvioTejMetros, item.AnudadosCount ?? null, promedioAnudado, desvioTejPesos, item.EstopaAzulProducida ?? null, item.ResiduosPrensadaKg ?? null, item.DiferenciaEstopa ?? null])
      dataRow.height = 20.1
    })
    
    // Totales
    const totalPromedioAnudado = (totales.value.residuosTejeduriaKg && totales.value.anudadosCount > 0) ? totales.value.residuosTejeduriaKg / totales.value.anudadosCount : null
    const totalRow = worksheet.addRow(['', null, totales.value.metros, totales.value.kg, totales.value.residuos, totales.value.kg ? (totales.value.residuos / totales.value.kg) : null, metaPercent.value / 100, totales.value.desvioKg > 0 ? totales.value.desvioKg : null, totales.value.desvioMetros > 0 ? totales.value.desvioMetros : null, totales.value.desvioIndigoPesos > 0 ? totales.value.desvioIndigoPesos : null, totales.value.tejeduriaMetros, totales.value.tejeduriaKg, totales.value.residuosTejeduriaKg, totales.value.tejeduriaKg ? (totales.value.residuosTejeduriaKg / totales.value.tejeduriaKg) : null, metaTejeduriaPercent.value / 100, totales.value.desvioTejeduriaKg > 0 ? totales.value.desvioTejeduriaKg : null, totales.value.desvioTejeduriaMetros > 0 ? totales.value.desvioTejeduriaMetros : null, totales.value.anudadosCount, totalPromedioAnudado, totales.value.desvioTejeduriaPesos > 0 ? totales.value.desvioTejeduriaPesos : null, totales.value.estopaAzulProducida, totales.value.residuosPrensadaKg, totales.value.diferenciaEstopa])
    
    totalRow.height = 24.95
    for (let colNumber = 1; colNumber <= 23; colNumber++) {
      const cell = totalRow.getCell(colNumber)
      cell.font = { name: 'Tahoma', size: 10, bold: true }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    
    // Formatos
    const formatos = { 2: 'mm-dd-yy', 3: '#,##0', 4: '#,##0', 5: '#,##0', 6: '0.0%', 7: '0.0%', 8: '#,##0', 9: '#,##0', 10: '#,##0', 11: '#,##0', 12: '#,##0', 13: '#,##0', 14: '0.0%', 15: '0.0%', 16: '#,##0', 17: '#,##0', 18: '#,##0', 19: '#,##0.00', 20: '#,##0', 21: '#,##0', 22: '#,##0', 23: '#,##0' }

    // Aplicar estilos
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber <= 6) return
      const isTotalRow = (rowNumber === worksheet.rowCount)
      
      for (let colNumber = 1; colNumber <= 23; colNumber++) {
        const cell = row.getCell(colNumber)
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
        if (formatos[colNumber]) cell.numFmt = formatos[colNumber]

        let color = null
        const val = cell.value
        
        if (colNumber === 4 || colNumber === 5) color = isTotalRow ? 'FF1E40AF' : 'FF1D4ED8'
        else if (colNumber === 6) color = (val > row.getCell(7).value) ? 'FFDC2626' : 'FF16A34A'
        else if (colNumber === 8 || colNumber === 9 || colNumber === 10) { if (val > 0) color = 'FFDC2626' }
        else if (colNumber === 12) color = isTotalRow ? 'FF155E75' : 'FF0E7490'
        else if (colNumber === 13) color = isTotalRow ? 'FF9F1239' : 'FFBE123C'
        else if (colNumber === 14) color = (val > row.getCell(15).value) ? 'FFDC2626' : 'FF16A34A'
        else if (colNumber === 16 || colNumber === 17 || colNumber === 20) { if (val > 0) color = 'FFDC2626' }
        else if (colNumber === 18) color = isTotalRow ? 'FFB45309' : 'FFD97706'
        else if (colNumber === 19) color = isTotalRow ? 'FF047857' : 'FF059669'
        else if (colNumber === 21) color = isTotalRow ? 'FF1D4ED8' : 'FF2563EB'
        else if (colNumber === 22) color = isTotalRow ? 'FF15803D' : 'FF16A34A'
        else if (colNumber === 23) { if (val !== 0 && val !== null) color = 'FFEF4444' }

        if (color) {
          cell.font = { name: 'Tahoma', size: 10, color: { argb: color }, bold: true }
        } else if (isTotalRow) {
          cell.font = { name: 'Tahoma', size: 10, bold: true }
        } else {
          cell.font = { name: 'Tahoma', size: 10 }
        }
      }
    })
    
    const lastRow = worksheet.rowCount
    worksheet.pageSetup.printArea = `B1:W${lastRow}`
    
    const ahora = new Date()
    const dia = ahora.getDate().toString().padStart(2, '0')
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0')
    const anio = ahora.getFullYear()
    const hora = ahora.getHours().toString().padStart(2, '0')
    const minuto = ahora.getMinutes().toString().padStart(2, '0')
    
    const nombreArchivo = `Residuos_ProFormat_${mesFormateado.value.replace(' ', '_')}_${dia}-${mes}-${anio}_${hora}${minuto}.xlsx`
    
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = nombreArchivo
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Excel Pro generado',
      text: 'Archivo con formato completo descargado',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    console.error('Error al exportar a Excel:', error)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error al exportar',
      text: error.message,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true
    })
  }
}

const exportarComoImagen = async () => {
  if (!tableElementRef.value || !mainContentRef.value) return
  
  try {
    // Esperar un momento para que el DOM esté estable
    await new Promise(resolve => setTimeout(resolve, 100))

    // Esperar a que carguen fuentes (si el navegador lo soporta)
    if (document.fonts?.ready) {
      await document.fonts.ready
    }

    // Crear un contenedor temporal para renderizar header + tabla sin scroll.
    // Importante: evitar coordenadas negativas (pueden dar capturas en blanco en algunos motores).
    const tempContainer = document.createElement('div')
    tempContainer.style.position = 'fixed'
    tempContainer.style.left = '0'
    tempContainer.style.top = '0'
    // Mantenerlo detrás para evitar que el usuario lo perciba.
    // (Moverlo fuera del viewport puede volver a dar PNG en blanco en algunos casos)
    tempContainer.style.zIndex = '-1'
    tempContainer.style.opacity = '1'
    tempContainer.style.visibility = 'hidden'
    tempContainer.style.pointerEvents = 'none'
    tempContainer.style.background = '#ffffff'
    tempContainer.style.padding = '20px'
    tempContainer.style.boxSizing = 'border-box'
    tempContainer.style.overflow = 'visible'

    // Clonar header y tabla
    const headerDiv = mainContentRef.value.querySelector('.flex.items-center.justify-between')
    if (!headerDiv) {
      throw new Error('No se encontró el header para exportar')
    }

    const headerClone = headerDiv.cloneNode(true)
    headerClone.style.marginBottom = '16px'
    headerClone.style.width = '100%'
    headerClone.style.display = 'flex'
    headerClone.style.alignItems = 'center'
    headerClone.style.justifyContent = 'space-between'

    // En la imagen exportada: dejar un margen izquierdo de 4px al logo
    const logoClone = headerClone.querySelector('img')
    if (logoClone) {
      logoClone.style.marginLeft = '4px'
    }

    // En la imagen NO mostramos botones ni datepicker; en su lugar agregamos una leyenda a la derecha
    const buildLeyendaMesParts = () => {
      if (!fechaSeleccionada.value) return null
      const [yyyyRaw, mmRaw, ddRaw] = fechaSeleccionada.value.split('-')
      const yyyy = yyyyRaw
      const mm = String(mmRaw || '').padStart(2, '0')
      const dd = String(ddRaw || '').padStart(2, '0')
      const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
      const mesNombre = meses[(parseInt(mm, 10) || 1) - 1] || ''

      return {
        mesYAnio: `${mesNombre} de ${yyyy}`,
        desde: `01-${mm}-${yyyy}`,
        hasta: `${dd}-${mm}-${yyyy}`
      }
    }

    // El header tiene dos hijos principales: izquierda (logo/título/costo) y derecha (botones/datepicker)
    // Reemplazamos la parte derecha por la leyenda.
    const rightSide = headerClone.children?.[1]
    if (rightSide) {
      rightSide.innerHTML = ''
      rightSide.style.display = 'flex'
      rightSide.style.alignItems = 'center'
      rightSide.style.justifyContent = 'flex-end'
      rightSide.style.gap = '0'
      rightSide.style.paddingRight = '4px'

      const parts = buildLeyendaMesParts()
      if (parts) {
        const leyenda = document.createElement('div')
        leyenda.className = 'text-sm flex items-center gap-1 whitespace-nowrap'

        const mkSpan = (text, className) => {
          const s = document.createElement('span')
          s.className = className
          s.textContent = text
          return s
        }

        leyenda.appendChild(mkSpan('Mes:', 'text-slate-600 font-medium'))
        leyenda.appendChild(mkSpan(parts.mesYAnio, 'text-slate-800 font-bold'))
        leyenda.appendChild(mkSpan('-', 'text-slate-600 font-medium'))
        leyenda.appendChild(mkSpan('desde', 'text-slate-600 font-medium'))
        leyenda.appendChild(mkSpan(parts.desde, 'text-slate-800 font-bold'))
        leyenda.appendChild(mkSpan('a', 'text-slate-600 font-medium'))
        leyenda.appendChild(mkSpan(parts.hasta, 'text-slate-800 font-bold'))

        rightSide.appendChild(leyenda)
      }
    }

    tempContainer.appendChild(headerClone)

    const tableClone = tableElementRef.value.cloneNode(true)
    tableClone.style.width = `${tableElementRef.value.scrollWidth}px`
    tableClone.style.maxWidth = 'none'
    tableClone.style.overflow = 'visible'
    tableClone.style.borderCollapse = 'collapse'
    tempContainer.appendChild(tableClone)

    // Desactivar sticky en el clon (suele romper la renderización en capturas DOM->PNG)
    const stickyNodes = Array.from(tableClone.querySelectorAll('.sticky'))
    stickyNodes.forEach(node => {
      node.classList.remove('sticky', 'top-0', 'bottom-0', 'z-10', 'shadow-sm', 'shadow-inner')
      node.style.position = 'static'
      node.style.top = 'auto'
      node.style.bottom = 'auto'
      node.style.zIndex = 'auto'
      node.style.boxShadow = 'none'
    })

    document.body.appendChild(tempContainer)

    // Esperar imágenes dentro del contenedor (logo, etc.)
    const images = Array.from(tempContainer.querySelectorAll('img'))
    await Promise.all(
      images.map(img => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve()
        return new Promise(resolve => {
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        })
      })
    )

    // Ajustar ancho/alto del contenedor para que NO se corte la última columna
    const paddingX = 20 * 2
    const paddingY = 20 * 2
    const contentWidth = tableClone.scrollWidth
    const contentHeight = headerClone.scrollHeight + tableClone.scrollHeight + 16

    // Forzar que el header clonado ocupe el mismo ancho que la tabla (para alinear la leyenda al borde derecho)
    headerClone.style.width = `${contentWidth}px`

    tempContainer.style.width = `${contentWidth + paddingX + 40}px` // +40 extra por seguridad
    tempContainer.style.height = `${contentHeight + paddingY}px`

    // Asegurar layout antes de capturar
    tempContainer.getBoundingClientRect()
    tempContainer.style.visibility = 'visible'
    await new Promise(requestAnimationFrame)

    // Capturar el contenedor temporal con tamaño fijo
    let dataUrl
    try {
      dataUrl = await domToPng(tempContainer, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: contentWidth + paddingX + 40,
        height: contentHeight + paddingY
      })
    } finally {
      if (tempContainer.isConnected) {
        document.body.removeChild(tempContainer)
      }
    }
    
    // Convertir data URL a blob
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    
    // Intentar copiar al portapapeles primero
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': blob
        })
      ])
      
      // Mostrar notificación de éxito con toast
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Imagen copiada al portapapeles',
        text: 'Presiona Ctrl+V para pegar en WhatsApp o correo',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      })
    } catch (clipboardError) {
      // Si falla el portapapeles, descargar como fallback
      console.warn('No se pudo copiar al portapapeles, descargando archivo:', clipboardError)
      
      const nombreArchivo = `Residuos_INDIGO_TEJEDURIA_${mesFormateado.value.replace(' ', '_')}.png`
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nombreArchivo
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      // Notificación de descarga
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'Imagen descargada',
        text: 'Guardada en tu carpeta de Descargas',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      })
    }
  } catch (error) {
    console.error('Error al exportar:', error)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error al exportar',
      text: error.message,
      showConfirmButton: false,
      timer: 4000,
      timerProgressBar: true
    })
  }
}

const abrirDetalle = (fecha) => {
  if (!fecha || fecha === null || fecha === undefined) return
  
  // Convertir DD/MM/YYYY a YYYY-MM-DD
  const [dia, mes, anio] = fecha.split('/')
  fechaModalDetalle.value = `${anio}-${mes}-${dia}`
  modalDetalle.value = true
}

onMounted(() => {
  // cargarDatos ya llama a cargarCostos internamente
  cargarDatos()
})
</script>
