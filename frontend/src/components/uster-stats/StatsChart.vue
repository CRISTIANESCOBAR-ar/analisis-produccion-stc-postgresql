<template>
    <div class="w-full h-full">
        <div ref="chartRef" class="w-full h-full echarts-container" style="min-height:260px;"></div>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import * as echarts from 'echarts'

const props = defineProps({
    stats: { type: Array, default: () => [] },
    globalMean: { type: Number, required: true },
    globalUcl: { type: Number, required: true },
    globalLcl: { type: Number, required: true },
    variableLabel: { type: String, default: '' },
    standardValue: { type: Number, default: null },
    showValues: { type: Boolean, default: true }
})

const emit = defineEmits(['open-ensayo-detail', 'open-huso-detail'])

const chartRef = ref(null)
let chart = null
const hoveredPoint = ref(null) // Rastrear punto actualmente hovereado
let isFirstRender = true // Flag para saber si es el primer render
// Almacenar el estado actual de las leyendas para preservarlo entre renders
const legendState = ref(null)

function computeOptimalXLabelRotate(labels) {
    try {
        if (!chartRef.value) return 90
        const container = chartRef.value
        const cw = container.clientWidth || container.offsetWidth || 600
        if (!labels || labels.length <= 1) return 0

        // create canvas for text measurement
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        // try to get computed font of container, fallback to 12px sans-serif
        const style = window.getComputedStyle(container)
        const font = style && style.font ? style.font : '12px sans-serif'
        ctx.font = font

        // measure max label width
        let maxW = 0
        labels.forEach(l => {
            const txt = String(l)
            const w = ctx.measureText(txt).width
            if (w > maxW) maxW = w
        })

        const spacing = cw / labels.length

        // add small padding
        const padded = maxW + 10
        // if fits comfortably within spacing, keep horizontal; otherwise use vertical (90deg)
        if (padded <= spacing) return 0
        return 90
    } catch {
        return 90
    }
}

function computeRequiredBottomPx(labels, rotateDeg) {
    try {
        if (!chartRef.value) return 60
        const container = chartRef.value
        const style = window.getComputedStyle(container)
        const font = style && style.font ? style.font : '12px sans-serif'
        // extract font-size in px
        const fontSizeMatch = style && style.fontSize ? style.fontSize.match(/(\d+)(px)?/) : null
        const fontSizePx = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 12

        // measure max label width
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        ctx.font = font
        let maxW = 0
        labels.forEach(l => {
            const txt = String(l)
            const w = ctx.measureText(txt).width
            if (w > maxW) maxW = w
        })

        const rad = (rotateDeg || 0) * Math.PI / 180

        // rotated bounding box height approximation: |sin(theta)*textWidth| + |cos(theta)*fontSize|
        const rotatedHeight = Math.abs(Math.sin(rad)) * maxW + Math.abs(Math.cos(rad)) * fontSizePx
        // dynamically estimate legend height by simulating legend item layout
        const legendItems = ['Promedio Día', 'Media Global', 'LCL (-3σ)', 'UCL (+3σ)']
        const containerWidth = container.clientWidth || container.offsetWidth || 800
        // available width for legend is container width minus left/right grid margins (3% each)
        const availableWidth = Math.max(200, Math.floor(containerWidth * (1 - 0.03 - 0.03)))
        // measure each legend item width: marker + gap + text
        const markerW = 14 // approximate marker width
        const gap = 8
        const itemPadd = 12
        const measured = legendItems.map(text => {
            const w = ctx.measureText(text).width
            return Math.ceil(markerW + gap + w + itemPadd)
        })

        // simulate wrapping into rows
        let current = 0
        for (let w of measured) {
            if (current + w > availableWidth) {
                current = w // Eliminado rows++ porque no se usa
            } else {
                current += w
            }
        }

        // Calcular espacio para etiquetas X rotadas + espacio para la leyenda + padding
        // 25px para horizontal, 35px para rotación 90°
        return rotateDeg === 90 ? 35 : 25
    } catch {
        return 10
    }
}

function buildOption(data, xLabelRotate = 0, bottomPx = 25, selectedLegend = null) {
    // Use formatted timestamp (dd/mm/yy) as x axis label when available; fallback to TESTNR
    const x = data.map(d => (d.timestampFmt ? d.timestampFmt : d.testnr))
    const y = data.map(d => d.mean)

    // Use global limits (constant across all TESTNR)
    const ucl = Array(x.length).fill(props.globalUcl)
    const lcl = Array(x.length).fill(props.globalLcl)
    const globalMeanLine = Array(x.length).fill(props.globalMean)

    // Función para calcular el rango Y basado en las series visibles
    const calculateYRange = (legendState) => {
        const visibleValues = [] // Empezar vacío
        
        // Incluir promedios (extraer valores si son objetos)
        y.forEach(val => {
            const numericVal = typeof val === 'object' && val !== null && val.value !== undefined 
                ? val.value 
                : val
            if (typeof numericVal === 'number' && !isNaN(numericVal)) {
                visibleValues.push(numericVal)
            }
        })
        
        // Incluir Media Global si está activa (o si no hay estado de leyenda, asumir activa)
        if (!legendState || legendState['Media Global'] !== false) {
            visibleValues.push(props.globalMean)
        }

        // Incluir valores según leyendas activas
        if (legendState && legendState['LCL (-3σ)'] !== false) {
            visibleValues.push(props.globalLcl)
        }
        if (legendState && legendState['UCL (+3σ)'] !== false) {
            visibleValues.push(props.globalUcl)
        }
        if (props.standardValue != null) {
            if (!legendState || legendState['Ne Estándar'] !== false) {
                visibleValues.push(props.standardValue)
            }
            if (!legendState || legendState['Ne Min (-1.5%)'] !== false) {
                visibleValues.push(props.standardValue * 0.985)
            }
            if (!legendState || legendState['Ne Max (+1.5%)'] !== false) {
                visibleValues.push(props.standardValue * 1.015)
            }
        }
        
        // Si solo tenemos los promedios, asegurar un margen razonable
        if (visibleValues.length === 0) return { yMin: 0, yMax: 100 }

        const minVal = Math.min(...visibleValues)
        const maxVal = Math.max(...visibleValues)
        const padding = (maxVal - minVal) * 0.1 || 0.1 // 10% padding

        return { yMin: minVal - padding, yMax: maxVal + padding }
    }

    // Calcular rango inicial
    // Si es primer render, usar configuración por defecto (LCL/UCL off)
    // Si no, usar selectedLegend pasado
    const currentLegend = selectedLegend || (isFirstRender ? { 'LCL (-3σ)': false, 'UCL (+3σ)': false } : null)
    const { yMin, yMax } = calculateYRange(currentLegend)

    const isVertical = xLabelRotate === 90

    return {
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

                // Obtener el índice del punto para acceder a los datos originales
                const dataIndex = params[0].dataIndex
                const pointData = data[dataIndex]

                // Fecha formateada, OE y NE (primera línea en negrita)
                const dateLabel = pointData?.timestampFmt || params[0].axisValue
                const oe = pointData?.oe ? ` | OE: ${pointData.oe}` : ''
                const ne = pointData?.ne ? ` | NE: ${pointData.ne}` : ''
                let result = `<div style="font-weight: 600; margin-bottom: 6px; color: #0f172a; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px;">${dateLabel}${oe}${ne}</div>`

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
        // Leyenda centrada y reordenada
        legend: {
            data: ['Promedio Día', 'Media Global', 'LCL (-3σ)', 'UCL (+3σ)', 
                   ...(props.standardValue != null ? ['Ne Estándar', 'Ne Min (-1.5%)', 'Ne Max (+1.5%)'] : [])],
            bottom: 0,
            left: 'center',
            selectedMode: true,
            itemGap: 16,
            textStyle: {
                color: '#64748b'
            }
        },
        // Grid ajustado
        grid: { left: '2%', right: '2%', top: '4%', bottom: bottomPx, containLabel: true },
        xAxis: {
            type: 'category',
            data: x,
            axisLabel: { 
                rotate: xLabelRotate, 
                interval: 0, 
                align: isVertical ? 'right' : 'center', 
                margin: 10,
                color: '#64748b',
                fontSize: 11
            },
            axisTick: { show: false },
            axisLine: { show: false }
        },
        yAxis: {
            type: 'value',
            min: yMin,
            max: yMax,
            axisLabel: {
                formatter: (value) => value.toFixed(1),
                color: '#64748b',
                fontSize: 11
            },
            splitLine: {
                lineStyle: {
                    type: 'dotted',
                    color: '#e2e8f0'
                }
            }
        },
        series: [
            {
                name: 'Promedio Día',
                type: 'line',
                data: y.map((val, idx) => {
                    // Si hay valor estándar, verificar si está fuera del rango ±1.5%
                    if (props.standardValue != null) {
                        const neMin = props.standardValue * 0.985
                        const neMax = props.standardValue * 1.015
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
                symbol: 'circle',
                showSymbol: true, // Siempre mostrar símbolos para destacar puntos fuera de rango
                symbolSize: 6,
                itemStyle: { color: '#3b82f6' }, // Blue 500
                lineStyle: { width: 1.25 },
                label: {
                    show: props.showValues,
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
                name: 'Media Global',
                type: 'line',
                data: globalMeanLine,
                lineStyle: { type: 'solid', color: '#1d4ed8', width: 1.25 }, // Intense Blue
                showSymbol: false
            },
            {
                name: 'LCL (-3σ)',
                type: 'line',
                data: lcl,
                lineStyle: { type: 'dashed', color: '#f97316', width: 1.25 }, // Orange
                showSymbol: false
            },
            {
                name: 'UCL (+3σ)',
                type: 'line',
                data: ucl,
                lineStyle: { type: 'dashed', color: '#f97316', width: 1.25 }, // Orange
                showSymbol: false
            },
            {
                name: 'Ne Estándar',
                type: 'line',
                data: props.standardValue != null ? Array(x.length).fill(props.standardValue) : [],
                lineStyle: { type: 'solid', color: '#16a34a', width: 1.25 }, // Green
                showSymbol: false,
                z: 10,
                silent: props.standardValue == null
            },
            {
                name: 'Ne Min (-1.5%)',
                type: 'line',
                data: props.standardValue != null ? Array(x.length).fill(props.standardValue * 0.985) : [],
                lineStyle: { type: 'dashed', color: '#ef4444', width: 1.25 }, // Red
                showSymbol: false,
                z: 9,
                silent: props.standardValue == null
            },
            {
                name: 'Ne Max (+1.5%)',
                type: 'line',
                data: props.standardValue != null ? Array(x.length).fill(props.standardValue * 1.015) : [],
                lineStyle: { type: 'dashed', color: '#ef4444', width: 1.25 }, // Red
                showSymbol: false,
                z: 9,
                silent: props.standardValue == null
            }
        ]
    }
}

function render() {
    if (!chart || !props.stats || chart.isDisposed()) return

    // compute labels and optimal rotation
    const labels = props.stats.map(d => (d.timestampFmt ? d.timestampFmt : d.testnr))
    const rotate = computeOptimalXLabelRotate(labels)
    // initial estimate (may be refined by chart.finished handler)
    const bottomPx = computeRequiredBottomPx(labels, rotate)
    console.log('StatsChart bottomPx calculated:', bottomPx)
    
    // Pass current legend state to buildOption
    const opt = buildOption(props.stats, rotate, bottomPx, legendState.value)
    
    // Solo en el primer render, establecer LCL y UCL como desactivados
    // En renders posteriores, usar el legendState almacenado
    if (isFirstRender) {
        // Primera vez: LCL y UCL desactivados por defecto
        opt.legend.selected = {
            'LCL (-3σ)': false,
            'UCL (+3σ)': false
        }
        legendState.value = { ...opt.legend.selected }
        isFirstRender = false
    } else if (legendState.value) {
        // Renders posteriores: usar el estado almacenado de las leyendas
        opt.legend.selected = { ...legendState.value }
    }
    
    chart.setOption(opt)
}

watch(() => [props.stats, props.globalMean, props.globalUcl, props.globalLcl, props.standardValue], () => {
    render()
}, { deep: true })

let _resizeHandler = null
let _keydownHandler = null
let _isUpdatingFromFinished = false // Flag para evitar loop de setOption
onMounted(() => {
    chart = echarts.init(chartRef.value)
    render()

    // Rastrear punto hovereado para tooltip
    chart.on('updateAxisPointer', (event) => {
        const dataIndex = event.axesInfo?.[0]?.value
        if (dataIndex != null && props.stats[dataIndex]) {
            hoveredPoint.value = props.stats[dataIndex]
        }
    })

    // Limpiar punto hovereado cuando el tooltip se oculta
    chart.on('globalout', () => {
        hoveredPoint.value = null
    })

    // Listener para cambios en la selección de leyendas (ajustar eje Y dinámicamente)
    // Listener para cambios en la selección de leyendas (ajustar eje Y dinámicamente)
    chart.on('legendselectchanged', (params) => {
        // Actualizar el estado de las leyendas en nuestro ref
        legendState.value = { ...params.selected }
        
        // Reconstruir opciones con el nuevo estado de leyenda para recalcular Y
        // Usamos la rotación y bottom actuales
        const currentOpt = chart.getOption()
        const rotate = currentOpt.xAxis[0].axisLabel.rotate
        const bottom = currentOpt.grid[0].bottom
        
        const newOpt = buildOption(props.stats, rotate, bottom, legendState.value)
        newOpt.legend.selected = legendState.value
        
        // Actualizar solo el eje Y, notMerge=false para preservar el resto de la config
        chart.setOption({
            yAxis: newOpt.yAxis
        }, false)
    })

    // Listener de teclado para Ctrl y Shift
    _keydownHandler = (e) => {
        if (!hoveredPoint.value) return

        // Ctrl/Cmd: abrir detalle completo del ensayo
        if ((e.ctrlKey || e.metaKey) && hoveredPoint.value.testnr) {
            e.preventDefault()
            emit('open-ensayo-detail', hoveredPoint.value.testnr)
        }
        
        // Shift: abrir detalle de husos
        if (e.shiftKey && hoveredPoint.value.testnr) {
            e.preventDefault()
            emit('open-huso-detail', hoveredPoint.value)
        }
    }
    window.addEventListener('keydown', _keydownHandler)

    // on resize, resize chart and re-render to recompute rotation
    _resizeHandler = () => {
        if (chart && !chart.isDisposed()) {
            chart.resize()
            render()
        }
    }
    window.addEventListener('resize', _resizeHandler)
    // register finished handler to measure the legend DOM after echarts has finished layout
    const finishedHandler = () => {
        // Prevenir recursión infinita o uso de instancia destruida
        if (_isUpdatingFromFinished || !chart || chart.isDisposed()) return

        try {
            const root = chartRef.value
            if (!root || !props.stats) return
            const labels = props.stats.map(d => (d.timestampFmt ? d.timestampFmt : d.testnr))
            const rotate = computeOptimalXLabelRotate(labels)

            // attempt to find legend element inside chart DOM
            let legendEl = root.querySelector('.echarts-legend') || root.querySelector('.ec-legend') || root.querySelector('[class*="legend"]')
            if (!legendEl) {
                const els = root.querySelectorAll('[class*="legend"]')
                if (els && els.length) legendEl = els[0]
            }

            if (legendEl) {
                Math.ceil(legendEl.getBoundingClientRect().height || 0) // Eliminado uso de legendHeight
            }

            // recompute rotatedHeight like computeRequiredBottomPx (use canvas)
            const style = window.getComputedStyle(root)
            const font = style && style.font ? style.font : '12px sans-serif'
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            ctx.font = font
            let maxW = 0
            labels.forEach(l => {
                const w = ctx.measureText(String(l)).width
                if (w > maxW) maxW = w
            })
            const fontSizeMatch = style && style.fontSize ? style.fontSize.match(/(\d+)(px)?/) : null
            const fontSizePx = fontSizeMatch ? parseInt(fontSizeMatch[1], 10) : 12
            const rad = (rotate || 0) * Math.PI / 180
            const rotatedHeight = Math.abs(Math.sin(rad)) * maxW + Math.abs(Math.cos(rad)) * fontSizePx
            
            // 25px para horizontal, 35px para rotación 90°
            const refinedBottom = rotate === 90 ? 35 : 25

            // if difference is meaningful, reapply option with refined bottom
            const currentBottom = chart.getOption().grid && chart.getOption().grid[0] && chart.getOption().grid[0].bottom ? chart.getOption().grid[0].bottom : null
            // note: chart.getOption().grid may return px or percent; we compare numerically when possible
            if (!currentBottom || Math.abs(refinedBottom - (Number(currentBottom) || 0)) > 6) {
                _isUpdatingFromFinished = true
                const opt2 = buildOption(props.stats, rotate, refinedBottom, legendState.value)
                if (legendState.value) {
                    opt2.legend.selected = legendState.value
                }
                // Use setTimeout to avoid "setOption should not be called during main process" warning
                setTimeout(() => {
                    if (chart && !chart.isDisposed()) {
                        chart.setOption(opt2)
                    }
                    _isUpdatingFromFinished = false
                }, 0)
            }
        } catch {
            // ignore
            _isUpdatingFromFinished = false
        }
    }
    chart.on('finished', finishedHandler)
})

// Watch para actualizar cuando cambie showValues
watch(() => props.showValues, () => {
    if (chart && !chart.isDisposed()) {
        render()
    }
})

onBeforeUnmount(() => {
    if (chart && !chart.isDisposed()) {
        chart.off('updateAxisPointer')
        chart.off('globalout')
        chart.off('finished')
        chart.dispose()
    }
    chart = null
    if (_resizeHandler) window.removeEventListener('resize', _resizeHandler)
    if (_keydownHandler) window.removeEventListener('keydown', _keydownHandler)
})
</script>

<style scoped>
.chart-container {
    width: 100%;
    height: 320px
}
</style>
