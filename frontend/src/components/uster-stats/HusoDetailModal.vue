<template>
    <div v-if="visible" class="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog"
        aria-modal="true">
        <!-- Backdrop -->
        <div class="fixed inset-0 bg-gradient-to-br from-slate-900/50 to-slate-800/50 backdrop-blur-sm z-40"
            @click="$emit('close')" aria-hidden="true"></div>

        <!-- Modal content -->
        <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full flex flex-col p-4 z-50 relative"
            style="height: 600px;" role="document" ref="modalRef">
            <!-- Botón anterior (pegado al lado izquierdo del modal) -->
            <button v-if="canNavigatePrevious" @click="$emit('navigate-previous')"
                v-tippy="{ content: 'Anterior ensayo', placement: 'left', theme: 'custom' }"
                class="absolute left-0 top-1/2 -translate-y-1/2 -ml-6 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 z-50"
                aria-label="Ensayo anterior">‹</button>

            <!-- Botón siguiente (pegado al lado derecho del modal) -->
            <button v-if="canNavigateNext" @click="$emit('navigate-next')"
                v-tippy="{ content: 'Siguiente ensayo', placement: 'right', theme: 'custom' }"
                class="absolute right-0 top-1/2 -translate-y-1/2 -mr-6 w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-50 z-50"
                aria-label="Ensayo siguiente">›</button>
            <header class="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 flex-shrink-0">
                <div class="flex flex-col gap-1">
                    <h3 class="text-xl font-bold text-slate-800">Detalle por Huso - {{ variableLabel }}</h3>
                    <div class="flex items-center gap-4 text-sm text-slate-600">
                        <span>Ensayo: <span class="font-semibold text-slate-900">{{ testnr }}</span></span>
                        <span v-if="timestamp">Fecha: <span class="font-semibold text-slate-900">{{ timestamp
                                }}</span></span>
                        <span v-if="oe">OE: <span class="font-semibold text-slate-900">{{ oe }}</span></span>
                        <span v-if="standardNe">Ne Estándar: <span class="font-semibold text-slate-900">{{ standardNe }}</span></span>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <!-- Checkbox para mostrar valores -->
                    <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                            type="checkbox" 
                            v-model="showValues"
                            @change="renderChart"
                            class="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        >
                        <span class="text-sm font-normal text-slate-700">Mostrar Valores</span>
                    </label>
                    
                    <!-- Copy as image button -->
                    <button @click="copyAsImage" type="button"
                        v-tippy="{ content: 'Copiar como imagen para WhatsApp', placement: 'bottom', theme: 'custom' }"
                        class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-slate-600 hover:text-blue-600 transition-all duration-200 group shadow-sm hover:shadow-md"
                        aria-label="Copiar como imagen">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>

                    <!-- Close button -->
                    <button @click="$emit('close')" type="button"
                        class="w-9 h-9 rounded-lg bg-white border border-slate-200 hover:border-red-400 hover:bg-red-50 flex items-center justify-center text-slate-600 hover:text-red-600 transition-all duration-200 shadow-sm hover:shadow-md"
                        aria-label="Cerrar">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </header>

            <!-- Stats cards - Horizontal layout -->
            <div class="grid grid-cols-7 gap-2 mb-3 flex-shrink-0">
                <div class="bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-blue-300 transition-colors">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-slate-500">Promedio</span>
                        <span class="text-sm font-bold text-slate-900">{{ formatValue(stats.mean) }}</span>
                    </div>
                </div>
                <div v-if="desvioPercent !== null" class="bg-white rounded-lg px-3 py-2 border border-slate-200 transition-colors" :class="desvioPercent !== null && Math.abs(parseFloat(desvioPercent)) <= 1.5 ? 'hover:border-green-300' : 'hover:border-red-300'">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-slate-500">Desvío %</span>
                        <span class="text-sm font-bold" :class="desvioColorClass">{{ desvioPercent }}</span>
                    </div>
                </div>
                <div class="bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-green-300 transition-colors">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-slate-500">Desv. Est. (σ)</span>
                        <span class="text-sm font-bold text-slate-900">{{ formatValue(stats.sd) }}</span>
                    </div>
                </div>
                <div class="bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-purple-300 transition-colors">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-slate-500">CV %</span>
                        <span class="text-sm font-bold text-slate-900">{{ formatValue(stats.cv) }}</span>
                    </div>
                </div>
                <div class="bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-orange-300 transition-colors">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-slate-500">Rango</span>
                        <span class="text-sm font-bold text-slate-900">{{ formatValue(stats.range) }}</span>
                    </div>
                </div>
                <div class="bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-cyan-300 transition-colors">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-slate-500">Ne Min (+1.5%)</span>
                        <span class="text-sm font-bold text-slate-900">{{ formatNeValue(stats.neMin) }}</span>
                    </div>
                </div>
                <div class="bg-white rounded-lg px-3 py-2 border border-slate-200 hover:border-amber-300 transition-colors">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-xs font-medium text-slate-500">Ne Max (-1.5%)</span>
                        <span class="text-sm font-bold text-slate-900">{{ formatNeValue(stats.neMax) }}</span>
                    </div>
                </div>
            </div>

            <!-- Chart -->
            <div class="flex-1 min-h-0 border border-slate-200 rounded-xl p-3 bg-slate-50 overflow-hidden">
                <div ref="chartRef" class="w-full h-full"></div>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import * as echarts from 'echarts'
import { toPng } from 'html-to-image'
import Swal from 'sweetalert2'

const props = defineProps({
    visible: { type: Boolean, default: false },
    values: { type: Array, default: () => [] },
    husoNumbers: { type: Array, default: () => [] },
    testnr: { type: String, default: '' },
    timestamp: { type: String, default: '' },
    oe: { type: String, default: '' },
    variableLabel: { type: String, default: '' },
    standardNe: { type: [String, Number], default: '' },
    canNavigatePrevious: { type: Boolean, default: false },
    canNavigateNext: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'navigate-previous', 'navigate-next'])

const chartRef = ref(null)
const modalRef = ref(null)
let chart = null
let isFirstRender = true // Flag para saber si es el primer render
const showValues = ref(true) // Mostrar valores en los puntos por defecto

// Calculate statistics
const stats = ref({
    mean: 0,
    sd: 0,
    cv: 0,
    lcl: 0,
    ucl: 0,
    min: 0,
    max: 0,
    range: 0,
    neMin: null,
    neMax: null
})

// Computed para el Desvío % entre Promedio y Ne Estándar
const desvioPercent = computed(() => {
    const neStandard = props.standardNe ? parseFloat(props.standardNe) : null
    if (!neStandard || !stats.value.mean) return null
    
    // Para Titulo Ne, la relación es inversa: Menor valor = Más grueso (+)
    const isTituloNe = props.variableLabel && props.variableLabel.toLowerCase().includes('titulo')
    
    let diff
    if (isTituloNe) {
        diff = neStandard - stats.value.mean
    } else {
        diff = stats.value.mean - neStandard
    }
    
    const desvio = (diff / neStandard) * 100
    const formatted = desvio.toFixed(2)
    // Agregar el signo + explícitamente cuando es positivo
    return desvio >= 0 ? `+${formatted}` : formatted
})

// Computed para la clase de color del Desvío %
const desvioColorClass = computed(() => {
    if (desvioPercent.value === null) return ''
    const val = parseFloat(desvioPercent.value)
    if (Math.abs(val) <= 1.5) return 'text-green-600' // Dentro del rango aceptable
    return 'text-red-600' // Fuera de rango
})

function calculateStats() {
    if (!props.values || props.values.length === 0) {
        stats.value = { mean: 0, sd: 0, cv: 0, lcl: 0, ucl: 0, min: 0, max: 0, range: 0, neMin: null, neMax: null }
        return
    }

    const n = props.values.length
    const mean = props.values.reduce((sum, v) => sum + v, 0) / n
    const variance = props.values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n
    const sd = Math.sqrt(variance)
    const cv = mean !== 0 ? (sd / mean) * 100 : 0
    const min = Math.min(...props.values)
    const max = Math.max(...props.values)
    const range = max - min

    // Calcular Ne Min y Ne Max si hay Ne Estándar
    const neStandard = props.standardNe ? parseFloat(props.standardNe) : null
    const neMin = neStandard ? neStandard * 0.985 : null
    const neMax = neStandard ? neStandard * 1.015 : null

    stats.value = {
        mean,
        sd,
        cv,
        lcl: mean - 3 * sd,
        ucl: mean + 3 * sd,
        min,
        max,
        range,
        neMin,
        neMax
    }
}

function formatValue(val) {
    if (val == null || isNaN(val)) return '—'
    return val.toFixed(2)
}

function formatNeValue(val) {
    if (val == null || isNaN(val)) return '—'
    return val.toFixed(2)
}

// Estado de la leyenda para calcular el eje Y dinámicamente
const legendState = ref({})

// Función auxiliar para construir las opciones del gráfico
function buildOption(selectedLegend = null) {
    const xData = props.husoNumbers.length > 0 
        ? props.husoNumbers.map(n => String(n))
        : props.values.map((_, i) => String(i + 1))
    const yData = props.values

    // Check if this is Titulo Ne variable
    const isTituloNe = props.variableLabel && props.variableLabel.toLowerCase().includes('titulo')
    const neStandard = props.standardNe ? parseFloat(props.standardNe) : null

    // Build legend data
    const legendData = ['Valor', 'Promedio', 'LCL (-3σ)', 'UCL (+3σ)']
    if (isTituloNe && neStandard) {
        legendData.push('Ne Estándar', 'Ne Min (+1.5%)', 'Ne Max (-1.5%)')
    }

    // Construir series
    const series = [
        {
            name: 'Valor',
            type: 'line',
            data: yData.map((val, idx) => {
                // Si hay Ne Estándar, verificar si el punto está fuera del rango ±1.5%
                if (neStandard && isTituloNe) {
                    const neMin = neStandard * 0.985
                    const neMax = neStandard * 1.015
                    const isOutOfRange = val < neMin || val > neMax
                    
                    return {
                        value: val,
                        itemStyle: isOutOfRange ? { 
                            color: '#ef4444',
                            borderColor: '#fff',
                            borderWidth: 2,
                            shadowBlur: 6,
                            shadowColor: 'rgba(239, 68, 68, 0.4)'
                        } : { color: '#3b82f6' },
                        symbolSize: isOutOfRange ? 8 : 6
                    }
                }
                return val
            }),
            smooth: false,
            showSymbol: true, // Siempre mostrar símbolos para ver los puntos fuera de rango
            symbolSize: 6,
            itemStyle: { color: '#3b82f6' },
            lineStyle: { width: 1.5 },
            label: {
                show: showValues.value,
                position: 'top',
                formatter: (params) => {
                    const val = typeof params.value === 'object' ? params.value.value : params.value
                    return val.toFixed(2)
                },
                fontSize: 10,
                color: '#475569',
                fontWeight: 500
            }
        },
        {
            name: 'Promedio',
            type: 'line',
            data: Array(xData.length).fill(stats.value.mean),
            lineStyle: { type: 'solid', color: '#10b981', width: 1.5 },
            showSymbol: false
        },
        {
            name: 'LCL (-3σ)',
            type: 'line',
            data: Array(xData.length).fill(stats.value.lcl),
            lineStyle: { type: 'dashed', color: '#ef4444', width: 1.5 },
            showSymbol: false
        },
        {
            name: 'UCL (+3σ)',
            type: 'line',
            data: Array(xData.length).fill(stats.value.ucl),
            lineStyle: { type: 'dashed', color: '#ef4444', width: 1.5 },
            showSymbol: false
        }
    ]

    // Add Ne Estándar lines only for Titulo Ne
    if (isTituloNe && neStandard) {
        series.push(
            {
                name: 'Ne Estándar',
                type: 'line',
                data: Array(xData.length).fill(neStandard),
                lineStyle: { type: 'solid', color: '#8b5cf6', width: 1.5 },
                showSymbol: false,
                z: 3
            },
            {
                name: 'Ne Min (+1.5%)',
                type: 'line',
                data: Array(xData.length).fill(neStandard * 0.985),
                lineStyle: { type: 'dashed', color: '#f59e0b', width: 1.5 },
                showSymbol: false,
                z: 2
            },
            {
                name: 'Ne Max (-1.5%)',
                type: 'line',
                data: Array(xData.length).fill(neStandard * 1.015),
                lineStyle: { type: 'dashed', color: '#f59e0b', width: 1.5 },
                showSymbol: false,
                z: 2
            }
        )
    }

    // Calcular rango Y basado en series visibles
    let yMin = Infinity
    let yMax = -Infinity

    series.forEach(s => {
        // Verificar si la serie está visible (usar selectedLegend si se proporciona)
        const isVisible = selectedLegend ? (selectedLegend[s.name] !== false) : true
        if (!isVisible) return

        const seriesData = s.data
        seriesData.forEach(val => {
            // Extraer el valor numérico (puede ser number o {value: number})
            const numericVal = typeof val === 'object' && val !== null && val.value !== undefined 
                ? val.value 
                : val
            
            if (typeof numericVal === 'number' && !isNaN(numericVal)) {
                if (numericVal < yMin) yMin = numericVal
                if (numericVal > yMax) yMax = numericVal
            }
        })
    })

    // Agregar margen de 5% arriba y abajo
    const range = yMax - yMin
    const margin = range * 0.05
    yMin = yMin - margin
    yMax = yMax + margin

    const option = {
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#fff',
            borderColor: '#e2e8f0',
            textStyle: {
                color: '#1e293b',
                fontSize: 12
            },
            extraCssText: 'box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1); border-radius: 8px;',
            formatter: (params) => {
                if (!params || params.length === 0) return ''

                // Primera línea: Huso y variable
                const husoLabel = params[0].axisValue
                let result = `<div style="font-weight: 600; margin-bottom: 6px; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">Huso ${husoLabel} | ${props.variableLabel}</div>`

                // Mostrar cada serie con su color, nombre y valor
                params.forEach(item => {
                    // Ignorar series ocultas o sin valor
                    if (item.value === undefined || item.value === null) return
                    
                    const value = typeof item.value === 'number' ? item.value.toFixed(2) : item.value
                    result += `<div style="display: flex; align-items: center; justify-content: space-between; margin: 3px 0; gap: 12px;">
                        <div style="display: flex; align-items: center;">
                            ${item.marker} 
                            <span style="margin-left: 4px; color: #475569;">${item.seriesName}</span>
                        </div>
                        <span style="font-weight: 500; color: #1e293b;">${value}</span>
                    </div>`
                })

                return result
            }
        },
        legend: {
            data: legendData,
            bottom: 0,
            left: 'center'
        },
        grid: { left: '8%', right: '4%', top: '8%', bottom: 60, containLabel: false },
        xAxis: {
            type: 'category',
            data: xData,
            axisLabel: { rotate: 0, interval: 0 }
        },
        yAxis: {
            type: 'value',
            min: yMin,
            max: yMax,
            axisLabel: {
                formatter: (value) => value.toFixed(2)
            }
        },
        series
    }

    return option
}

function renderChart() {
    if (!chart || chart.isDisposed() || !props.values || props.values.length === 0) {
        return
    }

    // Solo en el primer render, establecer LCL y UCL como desactivados
    if (isFirstRender) {
        const initialLegendState = {
            'LCL (-3σ)': false,
            'UCL (+3σ)': false
        }
        legendState.value = initialLegendState
        
        // Construir opciones con el estado inicial correcto para calcular Y correctamente
        const option = buildOption(initialLegendState)
        option.legend.selected = initialLegendState
        
        isFirstRender = false
        chart.setOption(option, { notMerge: true })
    } else {
        const option = buildOption(legendState.value)
        chart.setOption(option, { notMerge: false })
    }
}

async function copyAsImage() {
    try {
        if (!modalRef.value) return

        // Seleccionar todos los controles a ocultar durante la captura
        const toHideSelectors = [
            '[aria-label="Copiar como imagen"]',
            '[aria-label="Cerrar"]',
            '[aria-label="Ensayo anterior"]',
            '[aria-label="Ensayo siguiente"]',
            'label:has(input[type="checkbox"])' // Mostrar Valores
        ]

        const hiddenElements = []
        toHideSelectors.forEach(sel => {
            const el = modalRef.value.querySelector(sel)
            if (el) {
                hiddenElements.push({ el, originalDisplay: el.style.display })
                el.style.display = 'none'
            }
        })

        // Pequeño delay para permitir reflow sin los elementos
        await new Promise(resolve => setTimeout(resolve, 80))

        const dataUrl = await toPng(modalRef.value, {
            quality: 1.0,
            pixelRatio: 2,
            backgroundColor: '#ffffff',
            skipFonts: true // Evita errores CORS con Google Fonts
        })

        // Restaurar todos los elementos ocultados
        hiddenElements.forEach(({ el, originalDisplay }) => {
            el.style.display = originalDisplay || ''
        })

        // Convert to blob and copy
        const blob = await (await fetch(dataUrl)).blob()
        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ])

        Swal.fire({
            icon: 'success',
            title: '¡Copiado!',
            text: 'La imagen se copió al portapapeles. Puedes pegarla en WhatsApp.',
            timer: 2000,
            showConfirmButton: false
        })
    } catch (err) {
        console.error('Error copying image:', err)
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo copiar la imagen.'
        })
    }
}

watch(() => props.visible, async (newVal) => {
    if (newVal) {
        // Reset flag cuando se abre el modal para que LCL/UCL inicien desactivados
        isFirstRender = true
        legendState.value = {} // Reset legend state
        calculateStats()
        await nextTick()
        
        // Wait for DOM to be fully rendered with dimensions
        const tryInitChart = async (retries = 10) => {
            for (let i = 0; i < retries; i++) {
                await nextTick()
                if (chartRef.value && chartRef.value.clientWidth > 0 && chartRef.value.clientHeight > 0) {
                    // Dispose existing chart if any
                    if (chart) {
                        chart.dispose()
                    }
                    
                    // Initialize new chart
                    chart = echarts.init(chartRef.value)
                    
                    // Listener para cambios en la selección de leyendas (ajustar eje Y dinámicamente)
                    chart.on('legendselectchanged', (params) => {
                        // Actualizar el estado de las leyendas
                        legendState.value = { ...params.selected }
                        
                        // Reconstruir opciones con el nuevo estado de leyenda para recalcular Y
                        const newOpt = buildOption(legendState.value)
                        newOpt.legend.selected = legendState.value
                        
                        // Actualizar el eje Y con el nuevo rango calculado
                        chart.setOption({
                            yAxis: newOpt.yAxis
                        }, false)
                    })
                    
                    renderChart()
                    
                    // Force resize after a small delay to ensure proper rendering
                    setTimeout(() => {
                        if (chart && !chart.isDisposed()) {
                            chart.resize()
                        }
                    }, 100)
                    
                    return
                }
                await new Promise(resolve => setTimeout(resolve, 100))
            }
        }
        
        tryInitChart()
    } else {
        // Clean up when modal closes
        if (chart) {
            chart.dispose()
            chart = null
        }
    }
})

// Watch para detectar cambios en testnr (navegación entre ensayos)
watch(() => props.testnr, async (newTestnr, oldTestnr) => {
    // Solo actuar si el modal está visible y el testnr cambió
    if (props.visible && newTestnr !== oldTestnr && chart && !chart.isDisposed()) {
        // Recalcular estadísticas con los nuevos valores
        calculateStats()
        
        // Reiniciar flag de primer render para resetear leyenda (LCL/UCL desactivados)
        isFirstRender = true
        legendState.value = {}
        
        // Re-renderizar el gráfico
        await nextTick()
        renderChart()
        
        // Forzar resize después de un delay para asegurar renderizado correcto
        setTimeout(() => {
            if (chart && !chart.isDisposed()) {
                chart.resize()
            }
        }, 100)
    }
})

// Watch para detectar cambios en values o husoNumbers (para ResumenDiario)
watch([() => props.values, () => props.husoNumbers], async () => {
    // Solo actuar si el modal está visible y hay datos
    if (props.visible && props.values?.length > 0) {
        // Si no hay chart, intentar inicializarlo
        if (!chart || chart.isDisposed()) {
            await nextTick()
            
            // Esperar a que chartRef tenga dimensiones
            const tryInitChart = async (retries = 10) => {
                for (let i = 0; i < retries; i++) {
                    await nextTick()
                    if (chartRef.value && chartRef.value.clientWidth > 0 && chartRef.value.clientHeight > 0) {
                        // Verificar de nuevo si ya existe chart (puede haberse creado por otro watch)
                        if (chart && !chart.isDisposed()) {
                            // Chart ya existe, solo actualizar
                            calculateStats()
                            renderChart()
                            return
                        }
                        
                        // Inicializar chart
                        chart = echarts.init(chartRef.value)
                        
                        // Listener para cambios en leyenda
                        chart.on('legendselectchanged', (params) => {
                            legendState.value = { ...params.selected }
                            const newOpt = buildOption(legendState.value)
                            newOpt.legend.selected = legendState.value
                            chart.setOption({ yAxis: newOpt.yAxis }, false)
                        })
                        
                        // Calcular stats y renderizar
                        calculateStats()
                        renderChart()
                        
                        setTimeout(() => {
                            if (chart && !chart.isDisposed()) {
                                chart.resize()
                            }
                        }, 100)
                        
                        return
                    }
                    await new Promise(resolve => setTimeout(resolve, 100))
                }
                console.warn('[HusoDetailModal] Could not initialize chart after retries')
            }
            
            tryInitChart()
        } else {
            // Chart ya existe, solo actualizar
            // Recalcular estadísticas con los nuevos valores
            calculateStats()
            
            // Re-renderizar el gráfico
            await nextTick()
            renderChart()
            
            // Forzar resize después de un delay para asegurar renderizado correcto
            setTimeout(() => {
                if (chart && !chart.isDisposed()) {
                    chart.resize()
                }
            }, 100)
        }
    }
}, { deep: true })

onMounted(() => {
    // Don't initialize chart here, wait for visible watcher

    // Listener global para teclas: Esc, Flecha Izquierda y Derecha
    const handleGlobalKey = (event) => {
        if (!props.visible) return

        const tag = (event.target && event.target.tagName) ? String(event.target.tagName).toLowerCase() : ''
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || event.isComposing) return

        if (event.key === 'Escape') {
            emit('close')
            return
        }
        if ((event.key === 'ArrowLeft' || event.key === 'Left') && props.canNavigatePrevious) {
            event.preventDefault()
            emit('navigate-previous')
            return
        }
        if ((event.key === 'ArrowRight' || event.key === 'Right') && props.canNavigateNext) {
            event.preventDefault()
            emit('navigate-next')
            return
        }
    }
    window.addEventListener('keydown', handleGlobalKey)

    // Clean up on unmount
    onBeforeUnmount(() => {
        window.removeEventListener('keydown', handleGlobalKey)
        if (chart && !chart.isDisposed()) {
            chart.dispose()
            chart = null
        }
    })
})

</script>

<style scoped>
/* Modal styles are inherited from parent */
</style>
