<template>
  <div class="analysis-view">
    <header class="analysis-toolbar" @mouseover="mostrarAyuda" @focusin="mostrarAyuda" @mouseleave="ayudaToolbar = ''" @focusout="ayudaToolbar = ''">
      <div class="flex items-center gap-2 min-w-0">
        <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-6 w-auto object-contain shrink-0" />
        <h1 class="text-sm font-semibold text-slate-800 truncate">Análisis Residuos de Índigo</h1>
      </div>
      <div class="toolbar-actions">
        <div class="date-navigation">
          <button @click="moverFecha(-1, true)" aria-label="Mes anterior" data-tooltip="Mes anterior" aria-describedby="indigo-toolbar-help" class="toolbar-button">&lt;&lt;</button>
          <button @click="moverFecha(-1)" aria-label="Día anterior" data-tooltip="Día anterior" aria-describedby="indigo-toolbar-help" class="toolbar-button">&lt;</button>
        <CustomDatepicker v-model="fechaSeleccionada" compact :show-buttons="false" @change="cargarDatos" />
          <button @click="moverFecha(1)" aria-label="Día siguiente" data-tooltip="Día siguiente" aria-describedby="indigo-toolbar-help" class="toolbar-button">&gt;</button>
          <button @click="moverFecha(1, true)" aria-label="Mes siguiente" data-tooltip="Mes siguiente" aria-describedby="indigo-toolbar-help" class="toolbar-button">&gt;&gt;</button>
        </div>
        <button @click="cargarDatos" :disabled="cargando" aria-label="Consultar" data-tooltip="Consultar" aria-describedby="indigo-toolbar-help" class="toolbar-button toolbar-query"><MagnifyingGlassIcon class="w-4 h-4" /></button>
        <div class="w-px h-5 bg-slate-200 mx-1"></div>
        <button @click="imprimirPagina" :disabled="cargando || exportando || !hayDatos" aria-label="Imprimir" data-tooltip="Imprimir en orientación apaisada" aria-describedby="indigo-toolbar-help" class="toolbar-button"><PrinterIcon class="w-4 h-4" /></button>
        <button @click="copiarComoImagen" :disabled="cargando || exportando || !hayDatos" aria-label="Copiar como imagen" data-tooltip="Copiar como imagen" aria-describedby="indigo-toolbar-help" class="toolbar-button"><PhotoIcon class="w-4 h-4" /></button>
        <button @click="copiarParaWhatsApp" :disabled="cargando || !hayDatos" aria-label="Copiar resumen para WhatsApp" data-tooltip="Copiar resumen para WhatsApp" aria-describedby="indigo-toolbar-help" class="toolbar-button"><ChatBubbleLeftRightIcon class="w-4 h-4" /></button>
      </div>
      <div class="toolbar-help-space" aria-hidden="true"></div>
      <div v-show="ayudaToolbar" ref="burbujaToolbar" id="indigo-toolbar-help" class="toolbar-help" role="tooltip" :style="posicionAyuda">{{ ayudaToolbar }}<span class="toolbar-help-arrow" :style="{ left: flechaAyuda + 'px' }"></span></div>
    </header>
    <div v-if="errorCarga" role="alert" class="rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-600">{{ errorCarga }}</div>
    <div class="report-scroll">
    <main ref="chartsContainer" class="analysis-report" :aria-busy="cargando">
      <section v-for="section in sections" :key="section.title" class="analysis-section">

        <div class="chart-grid" >
          <article v-for="panel in section.panels" :key="panel.title" class="chart-card">
            <div class="chart-heading"><div><h3>{{ panel.title }}<span v-if="panel.total" class="panel-total"> · {{ cargando ? '—' : panel.total }}</span></h3><p>{{ panel.subtitle }}</p></div><span class="chart-unit">{{ panel.unit }}</span></div>
            <div class="chart-body">
              <div v-if="cargando" class="chart-placeholder animate-pulse" role="status">Cargando datos…</div>
              <component v-else-if="panel.data" :is="panel.line ? Line : Bar" :data="panel.data" :options="panel.options" />
              <div v-else class="chart-placeholder">Sin datos para esta selección</div>
            </div>
          </article>
        </div>
      </section>
    </main>
    </div>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import CustomDatepicker from './CustomDatepicker.vue'
import { Bar, Line } from 'vue-chartjs'
import { MagnifyingGlassIcon, PrinterIcon, PhotoIcon, ChatBubbleLeftRightIcon } from '@heroicons/vue/24/outline'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import Swal from 'sweetalert2'
import { domToPng } from 'modern-screenshot'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, LineElement, PointElement, ChartDataLabels)

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'
const cargando = ref(false)
const exportando = ref(false)
const errorCarga = ref('')
const datos = ref([])
const datosS = ref([])
const datosDia = ref([])
const datosDiaS = ref([])
const datosEstopaAzul = ref([])
const datosEstopaAzulDiario = ref([])
const chartsContainer = ref(null)
const ayudaToolbar = ref('')
const burbujaToolbar = ref(null)
const posicionAyuda = ref({})
const flechaAyuda = ref(0)
const mostrarAyuda = async (event) => {
  const button = event.target.closest('button[data-tooltip]')
  const header = event.currentTarget
  ayudaToolbar.value = button?.dataset.tooltip || ''
  if (!button) return
  await nextTick()
  if (ayudaToolbar.value !== button.dataset.tooltip || !burbujaToolbar.value) return
  const bounds = header.getBoundingClientRect()
  const anchor = button.getBoundingClientRect()
  const width = burbujaToolbar.value.offsetWidth
  const center = anchor.left + anchor.width / 2 - bounds.left
  const left = Math.max(8, Math.min(center - width / 2, bounds.width - width - 8))
  posicionAyuda.value = { left: left + 'px', top: (anchor.bottom - bounds.top + 6) + 'px' }
  flechaAyuda.value = Math.max(8, Math.min(center - left, width - 8))
}

// Inicializar con ayer
const getYesterday = () => {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const fechaSeleccionada = ref(getYesterday())
const moverFecha = (offset, porMes = false) => {
  const [year, month, day] = fechaSeleccionada.value.split('-').map(Number)
  const next = new Date(year, month - 1, day, 12)
  if (porMes) {
    next.setDate(1)
    next.setMonth(next.getMonth() + offset)
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
    next.setDate(Math.min(day, lastDay))
  } else next.setDate(next.getDate() + offset)
  fechaSeleccionada.value = [next.getFullYear(), String(next.getMonth() + 1).padStart(2, '0'), String(next.getDate()).padStart(2, '0')].join('-')
  cargarDatos()
}

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0
  }

  if (value === null || value === undefined) {
    return 0
  }

  let normalized = String(value).trim().replace(/\s+/g, '')
  if (!normalized) return 0

  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')

  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      normalized = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
  } else if (hasComma) {
    if (/^-?\d{1,3}(,\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/,/g, '')
    } else {
      normalized = normalized.replace(',', '.')
    }
  } else if (hasDot) {
    if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, '')
    }
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

const cargarDatos = async () => {
  if (cargando.value) return
  cargando.value = true
  errorCarga.value = ''
  const fechaConsultada = fechaSeleccionada.value
  try {
    const [year, month, day] = fechaConsultada.split('-')
    const fechaInicio = `01/${month}/${year}`
    const fechaFin = `${day}/${month}/${year}`
    const fechaDia = `${day}/${month}/${year}`

    // Cargar datos del periodo y del día específico en paralelo
    const [respMotivos, respS, respMotivosDia, respSDia, respEstopaAzul, respEstopaAzulDiario] = await Promise.all([
      fetch(`${API_URL}/residuos-indigo-analisis?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`),
      fetch(`${API_URL}/produccion-indigo-resumen?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`),
      fetch(`${API_URL}/residuos-indigo-analisis?fecha_inicio=${fechaDia}&fecha_fin=${fechaDia}`),
      fetch(`${API_URL}/produccion-indigo-resumen?fecha_inicio=${fechaDia}&fecha_fin=${fechaDia}`),
      fetch(`${API_URL}/residuos-indigo-estopa-por-mes`),
      fetch(`${API_URL}/residuos-indigo-estopa-por-dia?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}`)
    ])

    if (!respMotivos.ok || !respS.ok || !respMotivosDia.ok || !respSDia.ok || !respEstopaAzul.ok || !respEstopaAzulDiario.ok) {
      throw new Error('Error al cargar datos')
    }

    datos.value = await respMotivos.json()
    const dataS = await respS.json()
    datosS.value = dataS.s_valores || []

    datosDia.value = await respMotivosDia.json()
    const dataSDia = await respSDia.json()
    datosDiaS.value = dataSDia.s_valores || []

    datosEstopaAzul.value = await respEstopaAzul.json()
    datosEstopaAzulDiario.value = await respEstopaAzulDiario.json()
  } catch (error) {
    console.error('Error:', error)
    errorCarga.value = 'No se pudieron cargar los datos. Volvé a consultar.'
    datos.value = []
    datosS.value = []
    datosDia.value = []
    datosDiaS.value = []
    datosEstopaAzul.value = []
    datosEstopaAzulDiario.value = []
  } finally {
    cargando.value = false
    if (fechaSeleccionada.value !== fechaConsultada) cargarDatos()
  }
}

const formatNumber = (value, digits = 0) => Number(value).toLocaleString('es-AR', { maximumFractionDigits: digits })
const totalKg = (rows) => rows.reduce((sum, row) => sum + toNumber(row.TotalKg), 0)
const diaLabel = computed(() => fechaSeleccionada.value.split('-').reverse().join('/'))
const periodoLabel = computed(() => '01/' + fechaSeleccionada.value.split('-').slice(0, 2).reverse().join('/') + ' al ' + diaLabel.value)
const hayDatos = computed(() => [datos, datosDia, datosS, datosDiaS, datosEstopaAzul, datosEstopaAzulDiario].some(rows => rows.value.length))
const chartFont = "'Trebuchet MS', 'Segoe UI', Ubuntu, system-ui, sans-serif"
const typeColors = ['#4f46e5', '#0891b2', '#64748b', '#7c3aed', '#0d9488']
const allTypes = computed(() => [...new Set([...datosS.value, ...datosDiaS.value].map(row => String(row.S)))].sort())
const bars = (rows, labelKey, valueKey, types = false) => {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => toNumber(b[valueKey]) - toNumber(a[valueKey]))
  return { labels: sorted.map(row => String(row[labelKey] ?? 'Sin tipo')), datasets: [{ label: types ? 'Registros' : 'Residuos (kg)', data: sorted.map(row => toNumber(row[valueKey])), backgroundColor: sorted.map((row, index) => types ? typeColors[allTypes.value.indexOf(String(row.S)) % typeColors.length] : index === 0 ? '#4f46e5' : '#a5b4fc'), borderRadius: 5, maxBarThickness: 22 }] }
}
const options = (horizontal = false, unit = 'kg') => ({
  responsive: true, maintainAspectRatio: false, animation: false, indexAxis: horizontal ? 'y' : 'x',
  layout: { padding: { right: horizontal ? 92 : 12, top: 16 } },
  plugins: {
    legend: { display: false },
    tooltip: { backgroundColor: '#ffffff', titleColor: '#334155', bodyColor: '#475569', borderColor: '#cbd5e1', borderWidth: 1, padding: 10, cornerRadius: 6, displayColors: false, titleFont: { family: chartFont, size: 12, weight: '500' }, bodyFont: { family: chartFont, size: 11 }, callbacks: { label: ctx => {
      const value = Number(ctx.raw)
      const total = ctx.dataset.data.reduce((sum, n) => sum + Number(n), 0)
      return formatNumber(value, 1) + ' ' + unit + (horizontal && total > 0 ? ' · ' + formatNumber(value / total * 100, 1) + '%' : '')
    } } },
    datalabels: { display: horizontal, anchor: 'end', align: 'end', offset: 6, color: '#475569', font: { family: chartFont, size: 11, weight: 500 }, formatter: (value, ctx) => {
      const total = ctx.dataset.data.reduce((sum, n) => sum + Number(n), 0)
      return formatNumber(value) + (total > 0 ? ' · ' + formatNumber(value / total * 100, 1) + '%' : '')
    } }
  },
  scales: {
    x: { beginAtZero: true, border: { display: false }, grid: { display: horizontal, color: '#f1f5f9' }, ticks: { color: '#64748b', font: { family: chartFont, size: 11 }, maxRotation: 0, autoSkip: true, callback: horizontal ? value => formatNumber(value) : function(value) { return this.getLabelForValue(value) } } },
    y: { beginAtZero: true, border: { display: false }, grid: { display: !horizontal, color: '#f1f5f9' }, ticks: { color: '#475569', font: { family: chartFont, size: 11 }, callback: horizontal ? function(value) {
      const label = String(this.getLabelForValue(value))
      if (label.length <= 30) return label
      const lines = ['']
      for (const word of label.split(' ')) {
        if ((lines[lines.length - 1] + ' ' + word).trim().length > 30) lines.push(word)
        else lines[lines.length - 1] = (lines[lines.length - 1] + ' ' + word).trim()
      }
      return lines.filter(Boolean)
    } : value => formatNumber(value) } }
  }
})
const trend = (rows, daily = false) => {
  if (!rows.length) return null
  const sorted = [...rows].sort((a, b) => {
    const key = row => daily ? row.Fecha.split('/').reverse().join('-') : row.Mes
    return key(a).localeCompare(key(b))
  })
  const values = sorted.map(row => toNumber(row.KgResiduo))
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return { labels: sorted.map(row => daily ? row.Fecha.slice(0, 5) : row.Mes.split('-').reverse().join('/')), datasets: [
    { label: 'Estopa azul (kg)', data: values, backgroundColor: sorted.map((row, index) => index === sorted.length - 1 ? '#4f46e5' : '#a5b4fc'), borderColor: '#4f46e5', borderWidth: daily ? 2 : 0, borderRadius: 4, maxBarThickness: 32, pointBackgroundColor: sorted.map(row => row.Fecha === diaLabel.value ? '#0f172a' : '#4f46e5'), pointRadius: daily ? 3 : 0, pointHoverRadius: 5, tension: 0.25 },
    ...(!daily ? [{ type: 'line', label: 'Promedio de meses disponibles', data: values.map(() => average), borderColor: '#64748b', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, datalabels: { display: false } }] : [])
  ] }
}
const historyOptions = computed(() => {
  const config = options()
  config.plugins.legend = { display: true, position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, color: '#64748b', font: { family: chartFont, size: 11 } } }
  return config
})
const productionTotal = rows => formatNumber(rows.reduce((sum, row) => sum + toNumber(row.count), 0)) + ' registros'
const sections = computed(() => [
  { title: 'Acumulado del mes', panels: [
    { title: 'Residuos del mes', total: formatNumber(totalKg(datos.value)) + ' kg', subtitle: periodoLabel.value, unit: 'kg / %', data: bars(datos.value, 'DESC_MOTIVO', 'TotalKg'), options: options(true) },
    { title: 'Producción del mes', total: productionTotal(datosS.value), subtitle: periodoLabel.value, unit: 'registros / %', data: bars(datosS.value, 'S', 'count', true), options: options(true, 'registros') },
    { title: 'Estopa azul · 12 meses', subtitle: 'Último mes destacado · línea de promedio', unit: 'kg', data: trend(datosEstopaAzul.value), options: historyOptions.value }
  ] },
  { title: 'Día seleccionado', panels: [
    { title: 'Residuos del día', total: formatNumber(totalKg(datosDia.value)) + ' kg', subtitle: diaLabel.value, unit: 'kg / %', data: bars(datosDia.value, 'DESC_MOTIVO', 'TotalKg'), options: options(true) },
    { title: 'Producción del día', total: productionTotal(datosDiaS.value), subtitle: diaLabel.value, unit: 'registros / %', data: bars(datosDiaS.value, 'S', 'count', true), options: options(true, 'registros') },
    { title: 'Estopa azul · evolución diaria', subtitle: periodoLabel.value, unit: 'kg', data: trend(datosEstopaAzulDiario.value, true), options: options(), line: true }
  ] }
])

const copiarParaWhatsApp = async () => {
  try {
    const [year, month, day] = fechaSeleccionada.value.split('-')
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
    const mesNombre = meses[parseInt(month) - 1]

    // Construir mensaje
    let mensaje = `📊 *ANÁLISIS RESIDUOS DE ÍNDIGO*\n`
    mensaje += `📅 Período: 01/${month}/${year} - ${day}/${month}/${year}\n`
    mensaje += `━━━━━━━━━━━━━━━━━━━━━━\n\n`

    // Residuos del periodo
    if (datos.value.length > 0) {
      const total = datos.value.reduce((sum, d) => sum + toNumber(d.TotalKg), 0)
      mensaje += `📦 *RESIDUOS DEL PERIODO (${mesNombre})*\n`
      mensaje += `Total: *${Math.round(total).toLocaleString()} kg*\n\n`

      datos.value.forEach(d => {
        const porcentaje = total > 0 ? ((toNumber(d.TotalKg) / total) * 100).toFixed(1) : '0.0'
        mensaje += `• ${d.DESC_MOTIVO}: ${Math.round(toNumber(d.TotalKg)).toLocaleString()} kg (${porcentaje}%)\n`
      })
      mensaje += `\n`
    }

    // Producción del periodo
    if (datosS.value.length > 0) {
      const total = datosS.value.reduce((sum, d) => sum + toNumber(d.count), 0)
      mensaje += `🏭 *PRODUCCIÓN ÍNDIGO DEL PERIODO*\n`
      mensaje += `Total registros: *${total.toLocaleString()}*\n\n`

      datosS.value.forEach(d => {
        const porcentaje = total > 0 ? ((toNumber(d.count) / total) * 100).toFixed(1) : '0.0'
        mensaje += `• ${d.S}: ${toNumber(d.count).toLocaleString()} (${porcentaje}%)\n`
      })
      mensaje += `\n`
    }

    // Residuos del día
    if (datosDia.value.length > 0) {
      const total = datosDia.value.reduce((sum, d) => sum + toNumber(d.TotalKg), 0)
      mensaje += `━━━━━━━━━━━━━━━━━━━━━━\n`
      mensaje += `📦 *RESIDUOS DEL DÍA ${day}/${month}/${year}*\n`
      mensaje += `Total: *${Math.round(total).toLocaleString()} kg*\n\n`

      datosDia.value.forEach(d => {
        const porcentaje = total > 0 ? ((toNumber(d.TotalKg) / total) * 100).toFixed(1) : '0.0'
        mensaje += `• ${d.DESC_MOTIVO}: ${Math.round(toNumber(d.TotalKg)).toLocaleString()} kg (${porcentaje}%)\n`
      })
      mensaje += `\n`
    }

    // Producción del día
    if (datosDiaS.value.length > 0) {
      const total = datosDiaS.value.reduce((sum, d) => sum + toNumber(d.count), 0)
      mensaje += `🏭 *PRODUCCIÓN ÍNDIGO DEL DÍA*\n`
      mensaje += `Total registros: *${total.toLocaleString()}*\n\n`

      datosDiaS.value.forEach(d => {
        const porcentaje = total > 0 ? ((toNumber(d.count) / total) * 100).toFixed(1) : '0.0'
        mensaje += `• ${d.S}: ${toNumber(d.count).toLocaleString()} (${porcentaje}%)\n`
      })
    }

    mensaje += `\n━━━━━━━━━━━━━━━━━━━━━━\n`
    mensaje += `📊 Reporte generado: ${new Date().toLocaleString('es-ES')}`

    // Copiar al portapapeles
    await navigator.clipboard.writeText(mensaje)

    // Mostrar notificación
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Copiado al portapapeles',
      text: 'Presiona Ctrl+V para pegar en WhatsApp',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    console.error('Error al copiar:', error)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error al copiar',
      text: 'No se pudo copiar el mensaje',
      showConfirmButton: false,
      timer: 3000
    })
  }
}

const captureReport = async () => {
  const report = chartsContainer.value
  if (!report) throw new Error('No se encontró el reporte')
  await document.fonts.ready
  await Promise.all([...report.querySelectorAll('img')].map(img => img.decode().catch(() => {})))
  const bounds = report.getBoundingClientRect()
  // Renderizar los gráficos a la misma resolución que el PNG evita ampliar
  // sus mapas de bits de pantalla (texto y trazos borrosos al pegarlos).
  const desiredScale = Math.max(3, Math.min(4, window.devicePixelRatio || 1))
  const scale = Math.max(1, Math.min(desiredScale, Math.sqrt(20000000 / Math.max(1, bounds.width * bounds.height))))
  const charts = [...report.querySelectorAll('canvas')].map(canvas => ChartJS.getChart(canvas)).filter(Boolean)
  const original = charts.map(chart => ({ chart, width: chart.width, height: chart.height,
    ratio: chart.config.options.devicePixelRatio,
    hasRatio: Object.prototype.hasOwnProperty.call(chart.config.options, 'devicePixelRatio') }))
  try {
    for (const { chart, width, height } of original) {
      chart.config.options.devicePixelRatio = scale
      chart.resize(width, height)
      chart.update('none')
    }
    return await domToPng(report, { scale, dpi: Math.round(96 * scale), backgroundColor: '#f8fafc' })
  } finally {
    for (const { chart, width, height, ratio, hasRatio } of original) {
      if (!chart.canvas) continue
      if (hasRatio) chart.config.options.devicePixelRatio = ratio
      else delete chart.config.options.devicePixelRatio
      chart.resize(width, height)
      chart.update('none')
    }
  }
}
const showExportError = (error) => Swal.fire({ icon: 'error', title: 'No se pudo exportar', text: error.message, confirmButtonText: 'Cerrar' })
const copiarComoImagen = async () => {
  exportando.value = true
  try {
    const dataUrl = await captureReport()
    const blob = await (await fetch(dataUrl)).blob()
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Imagen copiada', showConfirmButton: false, timer: 3000 })
    } catch {
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = 'residuos-indigo-' + fechaSeleccionada.value + '.png'
      link.click()
      Swal.fire({ toast: true, position: 'top-end', icon: 'info', title: 'Imagen descargada', showConfirmButton: false, timer: 3000 })
    }
  } catch (error) { showExportError(error) } finally { exportando.value = false }
}
const imprimirPagina = async () => {
  const printWindow = window.open('', '_blank', 'width=1200,height=800')
  if (!printWindow) { showExportError(new Error('Permití las ventanas emergentes para imprimir.')); return }
  printWindow.document.write('<p>Preparando reporte…</p>')
  exportando.value = true
  try {
    const dataUrl = await captureReport()
    printWindow.document.open()
    printWindow.document.write('<!doctype html><html><head><title>Residuos de Índigo</title><style>@page{size:landscape;margin:5mm}body{margin:0}img{width:100%;height:auto}</style></head><body><img src="' + dataUrl + '" /></body></html>')
    printWindow.document.close()
    const image = printWindow.document.querySelector('img')
    await image.decode()
    printWindow.focus()
    printWindow.print()
  } catch (error) { printWindow.close(); showExportError(error) } finally { exportando.value = false }
}

onMounted(() => {
  cargarDatos()
})
</script>

<style scoped>
.analysis-view { --ui-font: 'Trebuchet MS', 'Segoe UI', Ubuntu, system-ui, sans-serif; --heading-font: var(--ui-font); font-family: var(--ui-font); height: 100%; min-height: 0; display: flex; flex-direction: column; overflow: hidden; padding: 16px; background: #f8fafc; color: #1e293b; }
.analysis-view :deep(button), .analysis-view :deep(input), .analysis-view :deep(select) { font-family: var(--ui-font); }
.analysis-toolbar { position: relative; z-index: 20; flex-shrink: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 4px 12px; min-height: 48px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; box-shadow: 0 1px 2px #0f172a08; }
.report-scroll { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; }
.toolbar-help-space { grid-column: 1 / -1; height: 30px; }
.toolbar-help { position: absolute; z-index: 30; pointer-events: none; width: max-content; max-width: calc(100% - 16px); padding: 5px 9px; border: 1px solid #cbd5e1; border-radius: 6px; background: #fff; color: #475569; box-shadow: 0 2px 6px #0f172a0d; font-size: 11px; line-height: 16px; }
.toolbar-help-arrow { position: absolute; top: -4px; width: 7px; height: 7px; background: white; border-left: 1px solid #cbd5e1; border-top: 1px solid #cbd5e1; transform: translateX(-50%) rotate(45deg); }
.date-navigation { display: flex; align-items: center; gap: 4px; }
.toolbar-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.toolbar-button { height: 32px; width: 32px; border-radius: 6px; border: 1px solid #cbd5e1; background: white; color: #475569; display: flex; align-items: center; justify-content: center; transition: background-color .15s; cursor: pointer; }
.toolbar-button:hover { background: #f8fafc; }
.toolbar-query { border-color: #bfdbfe; background: #eff6ff; color: #2563eb; }
.toolbar-query:hover { background: #dbeafe; }
.toolbar-button:disabled { opacity: .4; cursor: not-allowed; }
.toolbar-button:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
.analysis-report { height: 100%; min-height: 0; padding: 10px 0 0; display: grid; grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px; }
.analysis-section { min-height: 0; }
.chart-grid { height: 100%; min-height: 0; display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 2fr) minmax(0, 3fr); gap: 10px; }
.chart-card { display: flex; flex-direction: column; min-height: 0; min-width: 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; box-shadow: 0 1px 2px #0f172a05; }
.panel-total { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; color: #4338ca; white-space: nowrap; }
.chart-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #e2e8f0; flex-shrink: 0; }
.chart-heading h3 { font-size: 18px; line-height: 1.25; font-weight: 700; letter-spacing: -.02em; color: #0f172a; }
.chart-heading p { font-size: 11px; color: #64748b; margin-top: 5px; }
.chart-unit { border-radius: 4px; background: #eef2ff; color: #6366f1; font-size: 10px; padding: 3px 6px; white-space: nowrap; }
.chart-body { position: relative; min-width: 0; min-height: 0; flex: 1; }
.chart-placeholder { height: 100%; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: #f8fafc; color: #94a3b8; font-size: 12px; }
@media (max-width: 900px) { .analysis-report { height: auto; display: block; } .analysis-section + .analysis-section { margin-top: 10px; } .chart-grid { height: auto; grid-template-columns: 1fr; } .chart-body { flex: none; height: 240px; } }
@media (max-width: 640px) { .analysis-view { padding: 10px; } .analysis-toolbar { grid-template-columns: 1fr; } .toolbar-actions { width: 100%; justify-content: flex-start; flex-wrap: wrap; } }
@media print { .analysis-toolbar { display: none; } .analysis-view { height: auto; overflow: visible; padding: 0; } .report-scroll { overflow: visible; } .analysis-report { height: 180mm; } .chart-card { break-inside: avoid; } @page { size: landscape; margin: 5mm; } }
</style>
