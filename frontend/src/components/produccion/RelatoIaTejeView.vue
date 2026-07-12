<template>
  <div class="min-h-screen bg-slate-50 flex flex-col font-sans">
    <!-- Toolbar superior -->
    <header class="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 shadow-sm shrink-0">
      <div class="max-w-7xl mx-auto px-4 md:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
        
        <!-- Título -->
        <div class="flex items-center gap-3">
          <div class="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-650 shadow-inner">
            <span class="text-2xl">✨</span>
          </div>
          <div>
            <h1 class="text-base md:text-lg font-extrabold text-slate-800 leading-tight">Relato de Calidad e IA</h1>
            <p class="text-[11px] text-slate-500 leading-tight">Informe integral y diagnóstico técnico operativo para Tejeduría</p>
          </div>
        </div>

        <!-- Filtros -->
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-0.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha Inicio</label>
            <CustomDatepicker v-model="fechaInicio" :show-buttons="false" />
          </div>
          <div class="flex flex-col gap-0.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Fecha Fin</label>
            <CustomDatepicker v-model="fechaFin" :show-buttons="false" />
          </div>
          <div class="flex flex-col gap-0.5">
            <label class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Formato</label>
            <select v-model="formato" class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-300">
              <option value="actual">Diagnóstico Operativo (Actual)</option>
              <option value="estrategico">Resumen Ejecutivo (Estratégico)</option>
            </select>
          </div>

          <div class="flex gap-2">
            <button
              @click="cargarReporte(false)"
              :disabled="loading || !fechaInicio || !fechaFin"
              class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all duration-150 disabled:opacity-50 shadow-md flex items-center gap-1.5"
            >
              <span v-if="loading" class="animate-spin inline-block border-2 border-white border-t-transparent rounded-full w-3.5 h-3.5"></span>
              <span>{{ loading ? 'Generando...' : (narrativa ? 'Actualizar Informe' : 'Generar Informe') }}</span>
            </button>
            <button
              v-if="narrativa"
              @click="cargarReporte(true)"
              :disabled="loading"
              class="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-650 hover:bg-slate-50 text-xs font-semibold transition-all duration-150"
              title="Volver a consultar a la IA ignorando la caché"
            >
              Forzar IA
            </button>
          </div>
        </div>

      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 md:px-6 py-6 overflow-x-hidden">
      <!-- Estado vacío -->
      <div v-if="!narrativa && !loading && !error" class="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center max-w-2xl mx-auto my-12">
        <div class="text-6xl mb-4">📑</div>
        <h2 class="text-xl font-extrabold text-slate-750">Generar Relato de Calidad e IA</h2>
        <p class="text-sm text-slate-500 mt-2 max-w-md mx-auto leading-relaxed">
          Selecciona el rango de fechas de producción y el formato deseado en la barra superior, luego presiona el botón para consultar los datos históricos y consolidar el diagnóstico de IA.
        </p>
      </div>

      <!-- Cargando -->
      <div v-if="loading" class="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center max-w-2xl mx-auto my-12">
        <div class="inline-block animate-spin text-4xl text-indigo-650 mb-4">⟳</div>
        <h3 class="text-lg font-bold text-slate-750">Procesando datos y redactando informe...</h3>
        <p class="text-xs text-slate-400 mt-2 leading-relaxed">
          La IA de Gemini está cruzando datos de paradas de telares, defectos por partida, metros producidos e indicadores de hilandería para construir las conclusiones y directivas.
        </p>
      </div>

      <!-- Error -->
      <div v-if="error" class="max-w-2xl mx-auto my-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl p-5 text-sm flex items-start gap-3 shadow-sm">
        <span class="text-lg shrink-0">⚠️</span>
        <div>
          <div class="font-bold text-red-900">Error al obtener el reporte</div>
          <div class="mt-1 text-red-800/90 leading-relaxed">{{ error }}</div>
        </div>
      </div>

      <!-- Aviso -->
      <div v-if="aviso" class="max-w-7xl mx-auto mb-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-xs flex items-start gap-3 shadow-sm">
        <span class="text-base shrink-0">⚠️</span>
        <div class="leading-relaxed">{{ aviso }}</div>
      </div>

      <!-- Reporte Layout: TOC + Contenido -->
      <div v-if="narrativa && !loading" class="grid lg:grid-cols-[240px_1fr] gap-6 items-start">
        
        <!-- TOC Sticky Sidebar -->
        <aside class="hidden lg:block sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto shrink-0 pr-1">
          <div class="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4 space-y-4">
            <div>
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Secciones</p>
              <nav class="space-y-1">
                <a v-for="sec in toc" :key="sec.id" :href="`#${sec.id}`"
                  @click.prevent="scrollTo(sec.id)"
                  class="block text-xs px-2.5 py-2 rounded-lg transition-all duration-150 leading-tight"
                  :class="activeId === sec.id ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-650 hover:bg-slate-50'">
                  {{ sec.title }}
                </a>
              </nav>
            </div>

            <hr class="border-slate-100" />

            <!-- Métricas de la Consulta -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-slate-400 uppercase">Origen</span>
                <span class="text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase border" :class="fuenteClass">
                  {{ fuenteLabel }}
                </span>
              </div>

              <!-- Tokens + costo -->
              <div v-if="tokenInfo" class="rounded-xl bg-slate-50 border border-slate-150/50 p-2.5 space-y-1.5 text-[10px]">
                <p class="font-bold text-slate-400 uppercase tracking-wider">Costo Computacional</p>
                <div class="flex justify-between">
                  <span class="text-slate-550">Tokens Entrada</span>
                  <span class="font-bold text-slate-700">{{ tokenInfo.tokensEntrada.toLocaleString('es-AR') }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-slate-550">Tokens Salida</span>
                  <span class="font-bold text-slate-700">{{ tokenInfo.tokensSalida.toLocaleString('es-AR') }}</span>
                </div>
                <div class="flex justify-between pt-1 border-t border-slate-200">
                  <span class="text-slate-550 font-semibold">Tokens Total</span>
                  <span class="font-extrabold text-slate-800">{{ tokenInfo.tokensTotal.toLocaleString('es-AR') }}</span>
                </div>
                <div class="flex justify-between pt-0.5">
                  <span class="text-slate-550">Costo Estimado</span>
                  <span class="font-extrabold text-emerald-650">U$S {{ tokenInfo.costoUSD.toFixed(4) }}</span>
                </div>
              </div>
            </div>

            <hr class="border-slate-100" />

            <!-- Herramientas de Exportación -->
            <div class="space-y-1.5">
              <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Exportar Informe</p>
              <button 
                @click="copiarTexto" 
                class="w-full text-left px-3 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md flex items-center gap-2"
              >
                📋 {{ copiado ? 'Copiado!' : 'Copiar Texto' }}
              </button>
              <button 
                @click="descargarMD" 
                class="w-full text-left px-3 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md flex items-center gap-2"
              >
                📝 Descargar Markdown
              </button>
              <button 
                @click="exportarPNG" 
                :disabled="!!exportando" 
                class="w-full text-left px-3 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                🖼️ {{ exportando === 'png' ? 'Generando PNG...' : 'Exportar Imagen (PNG)' }}
              </button>
              <button 
                @click="exportarPDF" 
                :disabled="!!exportando" 
                class="w-full text-left px-3 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                📄 {{ exportando === 'pdf' ? 'Generando PDF...' : 'Exportar PDF (A4)' }}
              </button>
              <button 
                @click="exportarDOCX" 
                :disabled="!!exportando" 
                class="w-full text-left px-3 py-2 border border-slate-200 bg-white text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                📝 {{ exportando === 'docx' ? 'Generando Word...' : 'Exportar Word (DOCX)' }}
              </button>
            </div>
          </div>
        </aside>

        <!-- Documento Reporte -->
        <article ref="docRef" class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-10 narrativa-prose flex-1 overflow-x-auto min-w-0">
          <div v-html="narrativaHtml"></div>

          <!-- Dynamic charts container will be injected or placed below the sections -->
          <div class="mt-8 pt-8 border-t border-slate-200" v-if="dataset.length > 0">
            <h3 class="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">📊 Gráficos Analíticos de Apoyo</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <!-- Gráfico de paradas por telar -->
              <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col min-h-[340px]">
                <h4 class="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider text-center">Frecuencia de Paradas por Telar (Promedio RT105 vs RU105)</h4>
                <div ref="loomChartRef" class="w-full flex-1 min-h-[280px]"></div>
              </div>
              <!-- Gráfico de distribución de defectos -->
              <div class="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col min-h-[340px]">
                <h4 class="text-xs font-bold text-slate-700 mb-3 uppercase tracking-wider text-center">Distribución Total de Puntos por Defecto (Pareto)</h4>
                <div ref="defectsChartRef" class="w-full flex-1 min-h-[280px]"></div>
              </div>
            </div>
          </div>
        </article>

      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import CustomDatepicker from '../CustomDatepicker.vue'
import Swal from 'sweetalert2'
import { toPng } from 'html-to-image'
import * as echarts from 'echarts'

marked.setOptions({ gfm: true, breaks: true })

const route = useRoute()
const router = useRouter()

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

// Fechas por defecto: últimas 4 semanas
function getPastDateString(offsetDays) {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// ── Estado ──
const fechaInicio = ref(String(route.query.fecha_inicio || getPastDateString(30)))
const fechaFin = ref(String(route.query.fecha_fin || getPastDateString(1)))
const formato = ref(String(route.query.formato || 'actual'))

const loading = ref(false)
const error = ref('')
const aviso = ref('')
const narrativa = ref('')
const fuente = ref('') // 'gemini' | 'cache' | 'local'
const modelo = ref('')
const tokenInfo = ref(null)

const dataset = ref([])
const defects = ref([])
const totalMetros = ref(0)
const totalAreaM2 = ref(0)

const copiado = ref(false)
const docRef = ref(null)
const loomChartRef = ref(null)
const defectsChartRef = ref(null)
const activeId = ref('')
const toc = ref([])
let scrollEl = null

// ── Clases CSS Dinámicas ──
const fuenteLabel = computed(() => {
  if (fuente.value === 'gemini') return `Gemini AI (${modelo.value.replace('gemini-', '')})`
  if (fuente.value === 'cache') return 'Caché'
  if (fuente.value === 'local') return 'Reglas Locales'
  return 'S/D'
})

const fuenteClass = computed(() => {
  if (fuente.value === 'gemini') return 'bg-purple-50 text-purple-700 border-purple-250/30'
  if (fuente.value === 'cache') return 'bg-emerald-50 text-emerald-700 border-emerald-250/30'
  if (fuente.value === 'local') return 'bg-slate-50 text-slate-650 border-slate-200'
  return 'bg-slate-50 text-slate-400 border-slate-200'
})

const fuenteBanner = computed(() => {
  const f = fuente.value
  if (f === 'gemini') {
    return `<div class="fuente-banner fuente-gemini"><strong>Informe Analítico de IA</strong> · Generado con modelo ${modelo.value.replace('gemini-', '')} en tiempo real.</div>`
  }
  if (f === 'cache') {
    return `<div class="fuente-banner fuente-cache"><strong>Informe Recuperado de Caché</strong> · Datos idénticos consultados previamente.</div>`
  }
  if (f === 'local') {
    return `<div class="fuente-banner fuente-local"><strong>Resumen Técnico Local</strong> · Generado por reglas de negocio por límite de cuota de IA.</div>`
  }
  return ''
})

// ── Renderizador de Markdown ──
function applyTableRowspan(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  doc.querySelectorAll('table').forEach(table => {
    const firstTh = table.querySelector('thead th')
    if (!firstTh || !/^grupo$/i.test(firstTh.textContent.trim())) return

    const rows = Array.from(table.querySelectorAll('tbody tr'))
    if (!rows.length) return

    let groupCell = null
    let groupSpan = 0

    function closeGroup() {
      if (groupCell && groupSpan > 1) groupCell.rowSpan = groupSpan
      if (groupCell) groupCell.classList.add('group-cell')
    }

    for (const row of rows) {
      const cell = row.cells[0]
      if (!cell) continue
      const text = cell.textContent.trim()

      if (text) {
        closeGroup()
        groupCell = cell
        groupSpan = 1
      } else {
        cell.style.display = 'none'
        groupSpan++
      }
    }
    closeGroup()
  })
  return doc.body.querySelector('div').innerHTML
}

const narrativaHtml = computed(() => {
  if (!narrativa.value) return ''
  try {
    const raw = DOMPurify.sanitize(marked.parse(narrativa.value), { ADD_ATTR: ['role'] })
    return fuenteBanner.value + applyTableRowspan(raw)
  } catch (e) {
    return `Error al formatear informe: ${e.message}`
  }
})

// ── Navegación e índice (TOC) ──
function findScrollParent(el) {
  let p = el?.parentElement
  while (p && p !== document.body) {
    const s = getComputedStyle(p)
    if (/(auto|scroll|overlay)/.test(s.overflowY)) return p
    p = p.parentElement
  }
  return window
}

function buildToc() {
  if (!docRef.value) return
  const newScrollEl = findScrollParent(docRef.value)
  if (newScrollEl !== scrollEl) {
    if (scrollEl) scrollEl.removeEventListener('scroll', onScroll)
    scrollEl = newScrollEl
    scrollEl.addEventListener('scroll', onScroll, { passive: true })
  }
  const headings = docRef.value.querySelectorAll('h1, h2, h3')
  toc.value = Array.from(headings).map((h, idx) => {
    if (!h.id) {
      h.id = `sec-${idx}-${(h.textContent || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`
    }
    return { id: h.id, title: h.textContent.trim(), level: h.tagName }
  })
}

function scrollTo(id) {
  const el = document.getElementById(id)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  activeId.value = id
}

function onScroll() {
  if (!toc.value.length) return
  const threshold = 140
  let current = toc.value[0].id
  for (const t of toc.value) {
    const el = document.getElementById(t.id)
    if (el && el.getBoundingClientRect().top <= threshold) {
      current = t.id
    }
  }
  activeId.value = current
}

// ── Carga de Datos y Narrativa de IA ──
async function cargarReporte(force = false) {
  if (!fechaInicio.value || !fechaFin.value) {
    error.value = 'Debes seleccionar una fecha de inicio y una de fin.'
    return
  }

  loading.value = true
  error.value = ''
  aviso.value = ''
  narrativa.value = ''

  // Actualizar query en la URL para compartir enlace
  router.replace({
    query: {
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value,
      formato: formato.value
    }
  })

  try {
    // 1. Obtener Datos consolidando Calidad y Producción
    const params = new URLSearchParams({
      fecha_inicio: fechaInicio.value,
      fecha_fin: fechaFin.value
    })
    
    const resDatos = await fetch(`${API_BASE}/api/calidad/datos-patrones-teje?${params}`)
    const dataDatos = await resDatos.json()

    if (!resDatos.ok) throw new Error(dataDatos.error || 'Error obteniendo datos de calidad')

    if (dataDatos.success) {
      dataset.value = Array.isArray(dataDatos.dataset) ? dataDatos.dataset : []
      defects.value = Array.isArray(dataDatos.defects) ? dataDatos.defects : []
      totalMetros.value = Number(dataDatos.total_metros || 0)
      totalAreaM2.value = Number(dataDatos.total_area_m2 || 0)
    } else {
      throw new Error('Formato de datos de calidad inválido')
    }

    if (dataset.value.length === 0) {
      narrativa.value = '# Sin registros de tejeduría\nNo se encontraron registros de tejeduría en el rango de fechas seleccionado.'
      loading.value = false
      return
    }

    // 2. Invocar Endpoint de IA
    const resIA = await fetch(`${API_BASE}/api/calidad/ia-patrones-teje`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataset: dataset.value,
        defects: defects.value,
        totalMetros: totalMetros.value,
        totalAreaM2: totalAreaM2.value,
        fechaInicio: fechaInicio.value,
        fechaFin: fechaFin.value,
        formato: formato.value,
        forceRefresh: force
      })
    })

    const dataIA = await resIA.json()
    if (!resIA.ok) throw new Error(dataIA.error || 'Error consultando diagnóstico a la IA')

    narrativa.value = dataIA.narrativa || dataIA.analisis || ''
    fuente.value = dataIA.fuente || 'gemini'
    modelo.value = dataIA.modelo || 'gemini-2.5-flash'
    aviso.value = dataIA.avisoModelo || dataIA.aviso || ''
    tokenInfo.value = dataIA.tokenInfo || null

    await nextTick()
    buildToc()
    initCharts()
  } catch (e) {
    console.error('Error al cargar reporte:', e)
    error.value = e.message || String(e)
    Swal.fire({
      icon: 'error',
      title: 'Error de carga',
      text: e.message || 'No se pudo generar el informe de patrones.'
    })
  } finally {
    loading.value = false
  }
}

// ── Herramientas de Exportación ──
async function copiarTexto() {
  try {
    await navigator.clipboard.writeText(narrativa.value)
    copiado.value = true
    setTimeout(() => { copiado.value = false }, 2000)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Texto copiado al portapapeles',
      showConfirmButton: false,
      timer: 1500
    })
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo copiar el texto.' })
  }
}

function descargarMD() {
  const blob = new Blob([narrativa.value], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `informe-patrones-teje-${fechaInicio.value}-a-${fechaFin.value}.md`
  a.click()
  URL.revokeObjectURL(url)
}

const exportando = ref('')

function baseFilename() {
  return `informe-patrones-teje-${fechaInicio.value}-a-${fechaFin.value}`
}

async function exportarPNG() {
  if (!docRef.value) return
  exportando.value = 'png'
  try {
    const dataUrl = await toPng(docRef.value, {
      quality: 1,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      style: { borderRadius: '0' },
    })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${baseFilename()}.png`
    a.click()
  } catch (e) {
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al generar imagen: ' + e.message })
  } finally {
    exportando.value = ''
  }
}

async function exportarPDF() {
  Swal.fire({
    title: 'Exportando PDF...',
    html: 'Preparando páginas del informe técnico...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading() }
  })
  
  try {
    const { default: jsPDF } = await import('jspdf')
    const A4_W = 595
    const A4_H = 842
    const MARGIN = 40
    const FOOTER_H = 22
    const usableW = A4_W - MARGIN * 2
    const usableH = A4_H - MARGIN * 2 - FOOTER_H
    const PIX_RATIO = 1.5

    const dataUrl = await toPng(docRef.value, {
      quality: 0.95,
      pixelRatio: PIX_RATIO,
      backgroundColor: '#ffffff',
      style: { borderRadius: '0' },
    })

    const img = new Image()
    img.src = dataUrl
    await new Promise(resolve => { img.onload = resolve })

    const imgW = img.naturalWidth
    const imgH = img.naturalHeight
    const scale = usableW / imgW
    const scaledH = imgH * scale

    const parentRect = docRef.value.getBoundingClientRect()
    const blockEls = docRef.value.querySelectorAll('h1,h2,h3,h4,p,li,tr,pre,blockquote')
    const elementBottoms = []
    blockEls.forEach(el => {
      const r = el.getBoundingClientRect()
      const bottomCSS = r.bottom - parentRect.top
      const bottomPDF = bottomCSS * PIX_RATIO * scale
      if (bottomPDF > 10) elementBottoms.push(Math.round(bottomPDF))
    })
    elementBottoms.sort((a, b) => a - b)

    const pageSlices = []
    let pageStart = 0

    while (pageStart < scaledH) {
      const idealEnd = pageStart + usableH
      if (idealEnd >= scaledH) {
        pageSlices.push({ startPt: pageStart, endPt: scaledH })
        break
      }
      const candidates = elementBottoms.filter(b => b > pageStart + 40 && b <= idealEnd)
      const breakAt = candidates.length > 0 ? candidates[candidates.length - 1] : idealEnd
      pageSlices.push({ startPt: pageStart, endPt: breakAt })
      pageStart = breakAt
    }

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const totalPages = pageSlices.length

    for (let i = 0; i < pageSlices.length; i++) {
      if (i > 0) pdf.addPage()
      const { startPt, endPt } = pageSlices[i]
      const sliceHPt = endPt - startPt
      const srcY = startPt / scale
      const srcH = sliceHPt / scale

      const canvas = document.createElement('canvas')
      canvas.width = imgW
      canvas.height = Math.ceil(srcH)
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, -srcY)

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.90), 'JPEG', MARGIN, MARGIN, usableW, sliceHPt)

      // Pie de página
      const lineY  = A4_H - MARGIN - 10
      const textY  = A4_H - MARGIN + 6
      pdf.setDrawColor(220, 225, 230)
      pdf.setLineWidth(0.5)
      pdf.line(MARGIN, lineY, A4_W - MARGIN, lineY)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.setTextColor(150, 150, 150)
      pdf.text(`Relato de Calidad e IA — Período: ${fechaInicio.value} a ${fechaFin.value}`, MARGIN, textY)
      pdf.text(`Página ${i + 1} de ${totalPages}`, A4_W - MARGIN, textY, { align: 'right' })
    }

    pdf.save(`${baseFilename()}.pdf`)
    Swal.close()
  } catch (e) {
    Swal.close()
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al exportar PDF: ' + e.message })
  }
}

async function exportarDOCX() {
  Swal.fire({
    title: 'Exportando Word...',
    html: 'Creando archivo de texto enriquecido...',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading() }
  })
  
  try {
    const docxLib = await import('docx')
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = docxLib
    const children = []

    children.push(new Paragraph({
      text: 'Relato de Calidad e IA - Auditoría de Tejeduría',
      heading: HeadingLevel.TITLE,
      spacing: { before: 200, after: 120 }
    }))
    children.push(new Paragraph({
      text: `Período auditado: ${fechaInicio.value} al ${fechaFin.value}`,
      spacing: { after: 240 }
    }))

    const lines = narrativa.value.split('\n')
    lines.forEach(l => {
      const lineTrim = l.trim()
      if (lineTrim.startsWith('###')) {
        children.push(new Paragraph({
          text: lineTrim.replace('###', '').trim(),
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 180, after: 80 }
        }))
      } else if (lineTrim.startsWith('##')) {
        children.push(new Paragraph({
          text: lineTrim.replace('##', '').trim(),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 }
        }))
      } else if (lineTrim.startsWith('#')) {
        children.push(new Paragraph({
          text: lineTrim.replace('#', '').trim(),
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 300, after: 120 }
        }))
      } else if (lineTrim.startsWith('-') || lineTrim.startsWith('*')) {
        children.push(new Paragraph({
          text: '• ' + lineTrim.substring(1).trim(),
          spacing: { after: 60 },
          indent: { left: 360 }
        }))
      } else if (lineTrim) {
        children.push(new Paragraph({
          text: lineTrim,
          spacing: { after: 100 }
        }))
      }
    })

    const doc = new Document({
      styles: {
        default: {
          document: { run: { font: 'Arial', size: 22 } }
        }
      },
      sections: [{
        properties: {
          page: {
            size: { width: 11906, height: 16838 } // A4
          }
        },
        children
      }]
    })

    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${baseFilename()}.docx`
    a.click()
    URL.revokeObjectURL(url)
    Swal.close()
  } catch (e) {
    Swal.close()
    Swal.fire({ icon: 'error', title: 'Error', text: 'Error al exportar DOCX: ' + e.message })
  }
}

let loomChart = null
let defectsChart = null

function initCharts() {
  if (loomChart) {
    loomChart.dispose()
    loomChart = null
  }
  if (defectsChart) {
    defectsChart.dispose()
    defectsChart = null
  }

  if (dataset.value.length === 0) return

  // 1. Gráfico de Paradas de Telar
  const loomMap = {}
  dataset.value.forEach(r => {
    const rawTelar = r.indicadores_tejeduria?.telar_asignado
    if (!rawTelar) return
    const lastThree = String(rawTelar).trim().slice(-3)
    const telar = lastThree.replace(/^0+/, '') || '0'
    const rt105 = Number(r.indicadores_tejeduria?.rt105_paradas_trama) || 0
    const ru105 = Number(r.indicadores_tejeduria?.ru105_paradas_urdimbre) || 0

    if (!loomMap[telar]) {
      loomMap[telar] = { telar, rtSum: 0, ruSum: 0, count: 0 }
    }
    loomMap[telar].rtSum += rt105
    loomMap[telar].ruSum += ru105
    loomMap[telar].count++
  })

  const loomList = Object.values(loomMap).map(l => ({
    telar: `Telar ${l.telar}`,
    rtAvg: +(l.rtSum / l.count).toFixed(2),
    ruAvg: +(l.ruSum / l.count).toFixed(2),
    totalAvg: +((l.rtSum + l.ruSum) / l.count).toFixed(2)
  }))

  loomList.sort((a, b) => b.totalAvg - a.totalAvg)
  const topLooms = loomList.slice(0, 8)

  if (loomChartRef.value) {
    loomChart = echarts.init(loomChartRef.value)
    loomChart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: ['Paradas Trama (RT105)', 'Paradas Urdimbre (RU105)'], bottom: 0, textStyle: { fontSize: 10 } },
      grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
      xAxis: { type: 'category', data: topLooms.map(l => l.telar), axisLabel: { fontSize: 10 } },
      yAxis: { type: 'value', name: 'Paradas/100k pas.', axisLabel: { fontSize: 10 } },
      series: [
        {
          name: 'Paradas Trama (RT105)',
          type: 'bar',
          data: topLooms.map(l => l.rtAvg),
          itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] }
        },
        {
          name: 'Paradas Urdimbre (RU105)',
          type: 'bar',
          data: topLooms.map(l => l.ruAvg),
          itemStyle: { color: '#f59e0b', borderRadius: [4, 4, 0, 0] }
        }
      ]
    })
  }

  // 2. Gráfico Pareto de Defectos
  const defectsList = defects.value.map(d => ({
    name: `${d.cod_def} - ${(d.desc_defeito || 'Otro').slice(0, 15)}`,
    value: Number(d.total_puntos) || 0
  }))

  if (defectsChartRef.value) {
    defectsChart = echarts.init(defectsChartRef.value)
    defectsChart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} pts ({d}%)' },
      legend: { orient: 'vertical', left: 'left', textStyle: { fontSize: 9 }, type: 'scroll', width: '35%' },
      series: [
        {
          name: 'Puntos por Defecto',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['68%', '50%'],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 10, fontWeight: 'bold' } },
          data: defectsList
        }
      ]
    })
  }
}

function resizeCharts() {
  if (loomChart) loomChart.resize()
  if (defectsChart) defectsChart.resize()
}

// ── Lifecycle Hooks ──
onMounted(() => {
  if (fechaInicio.value && fechaFin.value) {
    cargarReporte(false)
  }
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  if (scrollEl && scrollEl.removeEventListener) {
    scrollEl.removeEventListener('scroll', onScroll)
  }
  window.removeEventListener('resize', resizeCharts)
  if (loomChart) loomChart.dispose()
  if (defectsChart) defectsChart.dispose()
})

watch(() => route.query, (q) => {
  if (q.fecha_inicio && q.fecha_inicio !== fechaInicio.value) fechaInicio.value = String(q.fecha_inicio)
  if (q.fecha_fin && q.fecha_fin !== fechaFin.value) fechaFin.value = String(q.fecha_fin)
  if (q.formato && q.formato !== formato.value) formato.value = String(q.formato)
})
</script>

<style scoped>
.narrativa-prose {
  color: #334155;
  line-height: 1.7;
  font-size: 14.5px;
}

.narrativa-prose :deep(.fuente-banner) {
  display: block;
  margin: 0 0 1.5rem;
  padding: .75rem 1rem;
  border-radius: .5rem;
  font-size: 13px;
  font-weight: 500;
  border-left: 4px solid currentColor;
}

.narrativa-prose :deep(.fuente-gemini) {
  background: #f5f3ff;
  color: #6d28d9;
  border-color: #8b5cf6;
}

.narrativa-prose :deep(.fuente-cache) {
  background: #ecfdf5;
  color: #047857;
  border-color: #10b981;
}

.narrativa-prose :deep(.fuente-local) {
  background: #fef3c7;
  color: #92400e;
  border-color: #f59e0b;
}

.narrativa-prose :deep(h1) {
  font-size: 1.65rem;
  font-weight: 800;
  color: #0f172a;
  margin: 1.8rem 0 1rem;
  padding-bottom: .5rem;
  border-bottom: 2px solid #e2e8f0;
  scroll-margin-top: 100px;
}

.narrativa-prose :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin: 1.6rem 0 .8rem;
  padding-bottom: .35rem;
  border-bottom: 1px solid #e2e8f0;
  scroll-margin-top: 100px;
}

.narrativa-prose :deep(h3) {
  font-size: 1.05rem;
  font-weight: 700;
  color: #334155;
  margin: 1.2rem 0 .6rem;
  scroll-margin-top: 100px;
}

.narrativa-prose :deep(p) {
  margin: .6rem 0;
}

.narrativa-prose :deep(ul), .narrativa-prose :deep(ol) {
  margin: .6rem 0 1rem 1.4rem;
}

.narrativa-prose :deep(li) {
  margin: .35rem 0;
}

.narrativa-prose :deep(strong) {
  color: #0f172a;
  font-weight: 750;
}

.narrativa-prose :deep(em) {
  color: #475569;
  font-style: italic;
}

.narrativa-prose :deep(code) {
  background: #f1f5f9;
  padding: .15rem .4rem;
  border-radius: .35rem;
  font-size: .88em;
  color: #be185d;
  font-family: ui-monospace, 'SF Mono', monospace;
}

.narrativa-prose :deep(blockquote) {
  margin: 1rem 0;
  padding: .75rem 1.2rem;
  border-left: 4px solid #6366f1;
  background: linear-gradient(90deg, rgba(99,102,241,.06), rgba(99,102,241,.005));
  color: #334155;
  border-radius: .5rem;
  font-style: italic;
}

.narrativa-prose :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 1.2rem 0;
  font-size: .85rem;
  border: 1px solid #e2e8f0;
  border-radius: .6rem;
  overflow: hidden;
}

.narrativa-prose :deep(thead) {
  background: #f8fafc;
}

.narrativa-prose :deep(th), .narrativa-prose :deep(td) {
  padding: .65rem .85rem;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
}

.narrativa-prose :deep(th) {
  font-weight: 700;
  color: #334155;
  font-size: .75rem;
  text-transform: uppercase;
  letter-spacing: .03em;
}

.narrativa-prose :deep(tr:last-child td) {
  border-bottom: 0;
}

.narrativa-prose :deep(tr:nth-child(even) td) {
  background: #fafafa;
}

.narrativa-prose :deep(hr) {
  border: 0;
  border-top: 1px dashed #cbd5e1;
  margin: 1.5rem 0;
}
</style>
