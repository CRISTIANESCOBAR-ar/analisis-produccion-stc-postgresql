<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main ref="mainContentRef" class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <!-- Header -->
      <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 lg:gap-4 flex-shrink-0 mb-4">
        <div class="flex items-center gap-3 lg:gap-6 w-full lg:w-auto">
          <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-8 lg:h-10 w-auto object-contain" />
          <h3 class="text-base lg:text-lg font-semibold text-slate-800">Consulta ROLADA ÍNDIGO</h3>
        </div>
        
        <div class="flex flex-wrap items-center gap-2 lg:gap-3 w-full lg:w-auto">
          <div class="flex items-center gap-2 flex-1 lg:flex-initial">
            <label for="rolada-input" class="text-sm font-medium text-slate-700 whitespace-nowrap">ROLADA:</label>
            <input
              id="rolada-input"
              v-model.number="roladaInput"
              type="number"
              placeholder="4 dígitos"
              maxlength="4"
              class="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full lg:w-28 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              @input="onRoladaInput"
              @keyup.enter="buscarRolada"
            />
          </div>
          <button
            @click="buscarRolada"
            :disabled="!roladaInput || cargando"
            class="inline-flex items-center gap-2 px-3 lg:px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors shadow-sm text-sm"
            v-tippy="{ content: 'Buscar datos de la ROLADA', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <path d="m21 21-4.35-4.35"></path>
            </svg>
            <span class="hidden sm:inline">Buscar</span>
          </button>
          <button
            v-if="datosAgrupados.length > 0"
            @click="copiarComoImagen"
            class="inline-flex items-center gap-1 px-2 lg:px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            v-tippy="{ content: 'Copiar tabla como imagen al portapapeles', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span class="text-xs lg:text-sm hidden sm:inline">Img</span>
          </button>
          <button
            v-if="datosAgrupados.length > 0"
            @click="exportarAExcel"
            class="inline-flex items-center gap-1 px-2 lg:px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            v-tippy="{ content: 'Exportar tabla a archivo Excel', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M12.9,14.5L15.8,19H14L12,15.6L10,19H8.2L11.1,14.5L8.2,10H10L12,13.4L14,10H15.8L12.9,14.5Z"/>
            </svg>
            <span class="text-xs lg:text-sm hidden sm:inline">Excel</span>
          </button>
        </div>
      </div>

      <!-- Loading Overlay -->
      <div v-if="cargando" class="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center z-50 rounded-2xl">
        <div class="flex flex-col items-center gap-4 bg-white/90 px-10 py-8 rounded-2xl shadow-2xl border border-blue-100">
          <div class="relative">
            <div class="animate-spin rounded-full h-16 w-16 border-4 border-blue-50 border-t-blue-600"></div>
          </div>
          <span class="text-xl text-slate-800 font-bold">Consultando...</span>
        </div>
      </div>

      <!-- Tabla de resultados -->
      <div v-if="datosAgrupados.length > 0" class="flex-1 overflow-auto min-h-0 border border-slate-200 rounded-lg">
        <table ref="tablaRef" class="w-full min-w-[1200px] text-xs lg:text-sm text-left text-slate-600 font-[Verdana]">
          <thead class="text-xs text-slate-700 bg-slate-50 sticky top-0 z-10 shadow-sm">
            <tr>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-left">Partida</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-center">Fecha Inicio</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-center">Hora Inicio</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-center">Fecha Final</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-center">Hora Final</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-center">Turno</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-left">Base</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-left">Color</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-right">Metros</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-right">Veloc.</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-center">S</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-right">R103</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-right">Roturas</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-right">CV</th>
              <th class="px-2 lg:px-3 py-2 font-bold border-b border-slate-200 text-left">Operador</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200">
            <tr 
              v-for="(item, index) in datosAgrupados" 
              :key="index" 
              :class="index % 2 === 0 ? 'bg-white hover:bg-slate-50' : 'bg-slate-50 hover:bg-slate-100'" 
              class="transition-colors"
            >
              <td class="px-2 lg:px-3 py-2">{{ item.PARTIDA ? item.PARTIDA.replace(/^0/, '') : '' }}</td>
              <td class="px-2 lg:px-3 py-2 text-center">{{ formatDate(item.DT_INICIO) }}</td>
              <td class="px-2 lg:px-3 py-2 text-center font-mono">{{ item.HORA_INICIO }}</td>
              <td class="px-2 lg:px-3 py-2 text-center">{{ formatDate(item.DT_FINAL) }}</td>
              <td class="px-2 lg:px-3 py-2 text-center font-mono">{{ item.HORA_FINAL }}</td>
              <td class="px-2 lg:px-3 py-2 text-center font-semibold text-blue-700">{{ item.TURNO }}</td>
              <td class="px-2 lg:px-3 py-2">{{ item.ARTIGO ? item.ARTIGO.substring(0, 10) : '' }}</td>
              <td class="px-2 lg:px-3 py-2">{{ item.COR }}</td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono">{{ formatNumber(item.METRAGEM) }}</td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono">{{ formatNumber(item.VELOC) }}</td>
              <td class="px-2 lg:px-3 py-2 text-center">{{ item.S }}</td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono text-purple-600">{{ calcularR103(item.RUPTURAS, item.METRAGEM) }}</td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono text-red-600">{{ item.RUPTURAS }}</td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono">{{ formatNumber(item.CAVALOS) }}</td>
              <td class="px-2 lg:px-3 py-2">{{ item.NM_OPERADOR }}</td>
            </tr>
          </tbody>
          <tfoot v-if="datosAgrupados.length > 0" class="bg-slate-100 font-bold text-slate-800 sticky bottom-0 shadow-inner">
            <tr>
              <td class="px-2 lg:px-3 py-2 text-left">TOTAL</td>
              <td class="px-2 lg:px-3 py-2 text-center"></td>
              <td class="px-2 lg:px-3 py-2 text-center"></td>
              <td class="px-2 lg:px-3 py-2 text-center"></td>
              <td class="px-2 lg:px-3 py-2 text-center"></td>
              <td class="px-2 lg:px-3 py-2 text-center"></td>
              <td class="px-2 lg:px-3 py-2"></td>
              <td class="px-2 lg:px-3 py-2"></td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono text-slate-900">{{ formatNumber(totales.metros) }}</td>
              <td class="px-2 lg:px-3 py-2 text-right"></td>
              <td class="px-2 lg:px-3 py-2 text-center"></td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono text-purple-700">{{ calcularR103(totales.roturas, totales.metros) }}</td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono text-red-700">{{ totales.roturas }}</td>
              <td class="px-2 lg:px-3 py-2 text-right font-mono text-slate-900">{{ formatNumber(totales.cv) }}</td>
              <td class="px-2 lg:px-3 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Empty state -->
      <div v-else-if="!cargando && roladaBuscada" class="flex-1 flex flex-col items-center justify-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mb-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"></circle>
          <path d="m21 21-4.35-4.35"></path>
        </svg>
        <p class="text-lg font-medium">No se encontraron resultados</p>
        <p class="text-sm">No hay datos para ROLADA: {{ roladaBuscada }}</p>
      </div>

      <!-- Initial state -->
      <div v-else-if="!cargando" class="flex-1 flex flex-col items-center justify-center text-slate-500">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-20 w-20 mb-4 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="9" x2="15" y2="9"></line>
          <line x1="9" y1="15" x2="15" y2="15"></line>
        </svg>
        <p class="text-lg font-medium">Ingrese un número de ROLADA</p>
        <p class="text-sm">Utilice el campo de búsqueda arriba para consultar</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ExcelJS from 'exceljs'
import Swal from 'sweetalert2'
import { domToPng } from 'modern-screenshot'

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'

const roladaInput = ref(null)
const roladaBuscada = ref(null)
const datos = ref([])
const cargando = ref(false)
const tablaRef = ref(null)
const mainContentRef = ref(null)

// Agrupar datos por PARTIDA
const datosAgrupados = computed(() => {
  if (datos.value.length === 0) return []
  
  const grupos = {}
  
  datos.value.forEach(item => {
    const partida = item.PARTIDA
    
    if (!grupos[partida]) {
      grupos[partida] = []
    }
    grupos[partida].push(item)
  })
  
  // Convertir grupos en filas agrupadas
  return Object.keys(grupos).map(partida => {
    const registros = grupos[partida]
    
    if (registros.length === 1) {
      return registros[0]
    }
    
    // Ordenar por fecha y hora para encontrar inicio y fin
    registros.sort((a, b) => {
      const dateTimeA = `${a.DT_INICIO} ${a.HORA_INICIO}`
      const dateTimeB = `${b.DT_INICIO} ${b.HORA_INICIO}`
      return dateTimeA.localeCompare(dateTimeB)
    })
    
    const primerRegistro = registros[0]
    const ultimoRegistro = registros[registros.length - 1]
    
    // Sumar metros, roturas y CV
    const metrosTotal = registros.reduce((sum, r) => sum + (parseFloat(r.METRAGEM) || 0), 0)
    const roturasTotal = registros.reduce((sum, r) => sum + (parseInt(r.RUPTURAS) || 0), 0)
    const cvTotal = registros.reduce((sum, r) => sum + (parseFloat(r.CAVALOS) || 0), 0)
    
    return {
      PARTIDA: partida,
      DT_INICIO: primerRegistro.DT_INICIO,
      HORA_INICIO: primerRegistro.HORA_INICIO,
      DT_FINAL: ultimoRegistro.DT_FINAL,
      HORA_FINAL: ultimoRegistro.HORA_FINAL,
      TURNO: primerRegistro.TURNO,
      ARTIGO: primerRegistro.ARTIGO,
      COR: primerRegistro.COR,
      METRAGEM: metrosTotal,
      VELOC: primerRegistro.VELOC,
      S: primerRegistro.S,
      RUPTURAS: roturasTotal,
      CAVALOS: cvTotal,
      NM_OPERADOR: primerRegistro.NM_OPERADOR
    }
  })
})

// Calcular totales
const totales = computed(() => {
  return datosAgrupados.value.reduce((acc, item) => {
    acc.metros += parseFloat(item.METRAGEM) || 0
    acc.roturas += parseInt(item.RUPTURAS) || 0
    acc.cv += parseFloat(item.CAVALOS) || 0
    return acc
  }, { metros: 0, roturas: 0, cv: 0 })
})

const formatDate = (dateStr) => {
  if (!dateStr) return ''
  // Si ya está en formato DD/MM/YYYY, devolverlo tal cual
  if (dateStr.includes('/')) return dateStr
  // Si es formato ISO, convertir a DD/MM/YYYY
  const date = new Date(dateStr)
  if (isNaN(date)) return dateStr
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${day}/${month}/${year}`
}

const formatNumber = (num) => {
  if (num === null || num === undefined || num === '') return ''
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num)
}

const calcularR103 = (roturas, metros) => {
  if (!metros || metros === 0) return ''
  const valor = (roturas * 1000) / metros
  return new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(valor)
}

const onRoladaInput = (event) => {
  const value = event.target.value
  // Limitar a 4 dígitos
  if (value.length > 4) {
    event.target.value = value.slice(0, 4)
    roladaInput.value = parseInt(value.slice(0, 4))
  }
  // Auto-ejecutar búsqueda al llegar a 4 dígitos
  if (value.length === 4 && !cargando.value) {
    buscarRolada()
  }
}

// Convertir hora string (HH:MM) a fracción de día para Excel
const convertirHoraAExcel = (horaStr) => {
  if (!horaStr) return null
  const [horas, minutos] = horaStr.split(':').map(Number)
  return (horas + minutos / 60) / 24
}

const buscarRolada = async () => {
  if (!roladaInput.value) {
    Swal.fire({
      icon: 'warning',
      title: 'Campo requerido',
      text: 'Por favor ingrese un número de ROLADA',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
    return
  }

  cargando.value = true
  roladaBuscada.value = roladaInput.value
  datos.value = []

  try {
    const response = await fetch(`${API_URL}/consulta-rolada-indigo?rolada=${roladaInput.value}`)
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }

    const data = await response.json()
    datos.value = data

    if (data.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin resultados',
        text: `No se encontraron datos para ROLADA ${roladaInput.value}`,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
      })
    }
  } catch (error) {
    console.error('Error al buscar ROLADA:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'No se pudo realizar la consulta. Verifique la conexión con la API.',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } finally {
    cargando.value = false
  }
}

const copiarComoImagen = async () => {
  if (!mainContentRef.value || datosAgrupados.value.length === 0) return
  
  try {
    // Crear overlay blanco para cubrir la pantalla durante la captura
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(255, 255, 255, 0.95);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      font-family: system-ui, sans-serif;
      backdrop-filter: blur(4px);
    `
    
    // Crear contenedor del mensaje
    const messageContainer = document.createElement('div')
    messageContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 24px 32px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
    `
    
    // Spinner animado
    const spinner = document.createElement('div')
    spinner.style.cssText = `
      width: 40px;
      height: 40px;
      border: 4px solid rgb(226, 232, 240);
      border-top-color: rgb(37, 99, 235);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    `
    
    // Agregar keyframes para la animación
    const style = document.createElement('style')
    style.textContent = `
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `
    document.head.appendChild(style)
    
    // Mensaje
    const message = document.createElement('div')
    message.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: rgb(15, 23, 42);
    `
    message.textContent = 'Capturando imagen...'
    
    const subMessage = document.createElement('div')
    subMessage.style.cssText = `
      font-size: 14px;
      color: rgb(100, 116, 139);
    `
    subMessage.textContent = 'Por favor espera un momento'
    
    messageContainer.appendChild(spinner)
    messageContainer.appendChild(message)
    messageContainer.appendChild(subMessage)
    overlay.appendChild(messageContainer)
    document.body.appendChild(overlay)
    
    // Delay para que el overlay se muestre completamente
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Crear contenedor temporal debajo del overlay
    const tempContainer = document.createElement('div')
    tempContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      background: rgb(255, 255, 255);
      padding: 30px;
      z-index: 9998;
      pointer-events: none;
      width: ${mainContentRef.value.scrollWidth + 100}px;
    `
    document.body.appendChild(tempContainer)
    
    // Crear header
    const headerDiv = document.createElement('div')
    headerDiv.style.cssText = `
      display: flex;
      align-items: center;
      gap: 24px;
      margin-bottom: 20px;
    `
    
    // Logo
    const logo = document.querySelector('main img[alt="Santana Textiles"]')
    if (logo) {
      const logoClone = logo.cloneNode(true)
      logoClone.style.cssText = 'height: 40px; width: auto;'
      headerDiv.appendChild(logoClone)
    }
    
    // Título
    const titulo = document.createElement('h3')
    titulo.textContent = `Consulta ROLADA ÍNDIGO - ${roladaBuscada.value}`
    titulo.style.cssText = 'font-size: 18px; font-weight: 600; color: rgb(15, 23, 42); margin: 0;'
    headerDiv.appendChild(titulo)
    
    tempContainer.appendChild(headerDiv)
    
    // Clonar tabla
    const tableClone = tablaRef.value.cloneNode(true)
    tableClone.style.cssText = `
      border: 1px solid rgb(226, 232, 240);
      border-radius: 8px;
      overflow: hidden;
      font-family: Verdana, sans-serif;
      font-size: 14px;
    `
    
    tempContainer.appendChild(tableClone)
    
    // Esperar imágenes
    const images = tempContainer.querySelectorAll('img')
    await Promise.all(
      Array.from(images).map(img => {
        if (img.complete) return Promise.resolve()
        return new Promise(resolve => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        })
      })
    )
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Capturar con domToPng
    let dataUrl
    try {
      dataUrl = await domToPng(tempContainer, {
        scale: 2,
        backgroundColor: '#ffffff',
        width: tempContainer.scrollWidth,
        height: tempContainer.scrollHeight
      })
    } finally {
      // Remover overlay y contenedor temporal
      if (style.isConnected) {
        document.head.removeChild(style)
      }
      if (overlay.isConnected) {
        document.body.removeChild(overlay)
      }
      if (tempContainer.isConnected) {
        document.body.removeChild(tempContainer)
      }
    }
    
    // Convertir a blob y copiar
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': blob
      })
    ])
    
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Imagen copiada al portapapeles',
      text: 'Presiona Ctrl+V para pegar',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    console.error('Error al copiar imagen:', error)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error al generar imagen',
      text: error.message || 'No se pudo crear la imagen',
      showConfirmButton: false,
      timer: 3000
    })
  }
}

const exportarAExcel = async () => {
  if (datosAgrupados.value.length === 0) return

  try {
    // Crear workbook y worksheet con ExcelJS
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('ROLADA INDIGO', {
      views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }],
      pageSetup: {
        paperSize: 5, // Legal
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 1,
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
    
    // Definir columnas con anchos
    worksheet.columns = [
      { header: 'Partida', key: 'partida', width: 12 },
      { header: 'Fecha Inicio', key: 'fecha_inicio', width: 12 },
      { header: 'Hora Inicio', key: 'hora_inicio', width: 11 },
      { header: 'Fecha Final', key: 'fecha_final', width: 12 },
      { header: 'Hora Final', key: 'hora_final', width: 11 },
      { header: 'Turno', key: 'turno', width: 8 },
      { header: 'Base', key: 'base', width: 15 },
      { header: 'Color', key: 'color', width: 10 },
      { header: 'Metros', key: 'metros', width: 10 },
      { header: 'Veloc.', key: 'veloc', width: 8 },
      { header: 'S', key: 's', width: 6 },
      { header: 'R103', key: 'r103', width: 8 },
      { header: 'Roturas', key: 'roturas', width: 9 },
      { header: 'CV', key: 'cv', width: 8 },
      { header: 'Operador', key: 'operador', width: 25 }
    ]
    
    // Estilo del encabezado - aplicar solo a las columnas con datos
    const headerRow = worksheet.getRow(1)
    headerRow.height = 30
    
    // Aplicar estilos solo a las 15 columnas
    for (let i = 1; i <= 15; i++) {
      const cell = headerRow.getCell(i)
      cell.font = { bold: true, color: { argb: 'FF334155' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'medium', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
    }
    
    // Calcular totales
    const totales = {
      metros: 0,
      roturas: 0,
      cv: 0
    }
    
    // Agregar datos
    datosAgrupados.value.forEach(item => {
      // Convertir fechas
      let fechaInicioExcel = null
      let fechaFinalExcel = null
      
      if (item.DT_INICIO) {
        const [dia, mes, anio] = item.DT_INICIO.split('/')
        fechaInicioExcel = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia))
      }
      
      if (item.DT_FINAL) {
        const [dia, mes, anio] = item.DT_FINAL.split('/')
        fechaFinalExcel = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia))
      }
      
      // Acumular totales
      totales.metros += parseFloat(item.METRAGEM) || 0
      totales.roturas += parseInt(item.RUPTURAS) || 0
      totales.cv += parseFloat(item.CAVALOS) || 0
      
      // Calcular R103
      const metros = parseFloat(item.METRAGEM) || 0
      const roturas = parseInt(item.RUPTURAS) || 0
      const r103 = metros > 0 ? (roturas * 1000) / metros : null
      
      // Convertir horas a formato Excel (fracción de día)
      const horaInicioExcel = item.HORA_INICIO ? convertirHoraAExcel(item.HORA_INICIO) : null
      const horaFinalExcel = item.HORA_FINAL ? convertirHoraAExcel(item.HORA_FINAL) : null
      
      worksheet.addRow({
        partida: parseInt(item.PARTIDA ? item.PARTIDA.replace(/^0/, '') : '0'),
        fecha_inicio: fechaInicioExcel,
        hora_inicio: horaInicioExcel,
        fecha_final: fechaFinalExcel,
        hora_final: horaFinalExcel,
        turno: item.TURNO,
        base: item.ARTIGO ? item.ARTIGO.substring(0, 10) : '',
        color: item.COR,
        metros: metros || null,
        veloc: parseFloat(item.VELOC) || null,
        s: item.S,
        r103: r103,
        roturas: roturas || null,
        cv: parseFloat(item.CAVALOS) || null,
        operador: item.NM_OPERADOR
      })
    })
    
    // Agregar fila de totales
    const r103Total = totales.metros > 0 ? (totales.roturas * 1000) / totales.metros : null
    
    const totalRow = worksheet.addRow({
      partida: 'TOTAL',
      fecha_inicio: null,
      hora_inicio: null,
      fecha_final: null,
      hora_final: null,
      turno: null,
      base: null,
      color: null,
      metros: totales.metros,
      veloc: null,
      s: null,
      r103: r103Total,
      roturas: totales.roturas,
      cv: totales.cv,
      operador: null
    })
    
    // Estilo de fila de totales - aplicar solo a columnas con datos
    totalRow.height = 25
    
    // Aplicar estilos solo a las 15 columnas
    for (let i = 1; i <= 15; i++) {
      const cell = totalRow.getCell(i)
      cell.font = { bold: true, color: { argb: 'FF1E293B' } }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
      cell.alignment = { horizontal: 'center', vertical: 'middle' }
    }
    
    // Definir formatos
    const formatos = {
      2: 'dd/mm/yyyy', // Fecha Inicio
      3: 'hh:mm', // Hora Inicio
      4: 'dd/mm/yyyy', // Fecha Final
      5: 'hh:mm', // Hora Final
      9: '#,##0', // Metros
      10: '#,##0', // Veloc
      12: '0.0', // R103
      13: '#,##0', // Roturas
      14: '#,##0.00' // CV
    }
    
    // Aplicar estilos a todas las filas
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return // Skip header
      
      const isTotalRow = (rowNumber === worksheet.rowCount)
      
      for (let colNumber = 1; colNumber <= 15; colNumber++) {
        const cell = row.getCell(colNumber)
        
        // Bordes
        cell.border = {
          top: { style: isTotalRow ? 'medium' : 'thin', color: { argb: isTotalRow ? 'FFCBD5E1' : 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        }
        
        // Alineación
        if (colNumber === 15) { // Solo Operador a la izquierda
          cell.alignment = { horizontal: 'left', vertical: 'middle' }
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
        
        // Formatos numéricos
        if (formatos[colNumber]) {
          cell.numFmt = formatos[colNumber]
        }
        
        // Colores
        let color = null
        const val = cell.value
        
        if (colNumber === 6) { // Turno
          color = isTotalRow ? 'FF1E40AF' : 'FF1D4ED8'
        } else if (colNumber === 9) { // Metros
          color = isTotalRow ? 'FF1E293B' : 'FF334155'
        } else if (colNumber === 12) { // R103
          color = isTotalRow ? 'FF7C3AED' : 'FF9333EA'
        } else if (colNumber === 13 && val > 0) { // Roturas
          color = 'FFDC2626'
        }
        
        if (color) {
          cell.font = { ...row.font, color: { argb: color }, bold: true }
        } else if (isTotalRow) {
          cell.font = { bold: true, color: { argb: 'FF1E293B' } }
        }
      }
    })
    
    // Establecer área de impresión
    const lastRow = worksheet.rowCount
    worksheet.pageSetup.printArea = `A1:O${lastRow}`
    
    // Generar nombre de archivo
    const ahora = new Date()
    const dia = ahora.getDate().toString().padStart(2, '0')
    const mes = (ahora.getMonth() + 1).toString().padStart(2, '0')
    const anio = ahora.getFullYear()
    const hora = ahora.getHours().toString().padStart(2, '0')
    const minuto = ahora.getMinutes().toString().padStart(2, '0')
    
    const nombreArchivo = `Consulta_ROLADA_${roladaBuscada.value}_${dia}-${mes}-${anio}_${hora}${minuto}.xlsx`
    
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
    
    Swal.fire({
      icon: 'success',
      title: 'Exportación exitosa',
      text: `Archivo ${nombreArchivo} descargado`,
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    })
  } catch (error) {
    console.error('Error al exportar:', error)
    Swal.fire({
      icon: 'error',
      title: 'Error al exportar',
      text: error.message || 'No se pudo generar el archivo',
      toast: true,
      position: 'top-end',
      showConfirmButton: false,
      timer: 3000
    })
  }
}
</script>
