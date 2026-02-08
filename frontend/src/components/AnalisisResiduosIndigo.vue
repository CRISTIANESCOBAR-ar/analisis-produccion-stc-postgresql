<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col relative">
      <!-- Header -->
      <div class="flex items-center justify-between gap-4 flex-shrink-0 mb-4">
        <div class="flex items-center gap-6">
          <img src="/LogoSantana.jpg" alt="Santana Textiles" class="h-10 w-auto object-contain" />
          <h3 class="text-lg font-semibold text-slate-800">Análisis Residuos de Índigo</h3>
        </div>
        
        <div class="flex items-center gap-2">
          <button 
            @click="imprimirPagina"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-md transition-colors shadow-sm"
            v-tippy="{ content: 'Imprimir página en orientación apaisada', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            <span class="text-sm">Imprimir</span>
          </button>
          
          <button 
            @click="copiarComoImagen"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors shadow-sm"
            v-tippy="{ content: 'Copiar gráficos como imagen', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span class="text-sm">Imagen</span>
          </button>
          
          <button 
            @click="copiarParaWhatsApp"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors shadow-sm"
            v-tippy="{ content: 'Copiar resumen de análisis para WhatsApp', placement: 'bottom' }"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
            </svg>
            <span class="text-sm">WhatsApp</span>
          </button>
          
          <CustomDatepicker 
            v-model="fechaSeleccionada" 
            label="Hasta:" 
            :show-buttons="true"
            @change="cargarDatos" 
          />
        </div>
      </div>

      <!-- Charts Container -->
      <div ref="chartsContainer" class="flex-1 min-h-0 relative flex flex-col gap-4">
        <div v-if="cargando" class="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-10">
          <div class="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
        </div>
        
        <!-- Fila 1: Gráficos del Periodo -->
        <div class="flex-1 flex gap-4 min-w-0">
          <!-- Gráfico de Motivos de Residuos - Periodo -->
          <div class="flex-[3] h-full p-4 border border-slate-200 rounded-lg min-w-0 overflow-hidden">
            <Bar v-if="chartData" :data="chartData" :options="chartOptions" />
            <div v-else-if="!cargando" class="h-full flex items-center justify-center text-slate-400">
              No hay datos para el período seleccionado
            </div>
          </div>

          <!-- Gráfico de Columna S - Periodo -->
          <div class="flex-[1] h-full p-4 border border-slate-200 rounded-lg min-w-0 overflow-hidden">
            <Bar v-if="chartDataS" :data="chartDataS" :options="chartOptionsS" />
            <div v-else-if="!cargando" class="h-full flex items-center justify-center text-slate-400">
              No hay datos disponibles
            </div>
          </div>

          <!-- Gráfico de Estopa Azul por Mes - Periodo -->
          <div class="flex-[1.3] h-full px-2 py-4 border border-slate-200 rounded-lg min-w-0 overflow-hidden">
            <Bar v-if="chartDataEstopaAzul" :data="chartDataEstopaAzul" :options="chartOptionsEstopaAzul" />
            <div v-else-if="!cargando" class="h-full flex items-center justify-center text-slate-400">
              No hay datos disponibles
            </div>
          </div>
        </div>

        <!-- Fila 2: Gráficos del Día Específico -->
        <div class="flex-1 flex gap-4 min-w-0">
          <!-- Gráfico de Motivos de Residuos - Día -->
          <div class="flex-[3] h-full p-4 border border-slate-200 rounded-lg min-w-0 overflow-hidden">
            <Bar v-if="chartDataDia" :data="chartDataDia" :options="chartOptionsDia" />
            <div v-else-if="!cargando" class="h-full flex items-center justify-center text-slate-400">
              No hay datos para el día seleccionado
            </div>
          </div>

          <!-- Gráfico de Columna S - Día -->
          <div class="flex-[1] h-full p-4 border border-slate-200 rounded-lg min-w-0 overflow-hidden">
            <Bar v-if="chartDataDiaS" :data="chartDataDiaS" :options="chartOptionsDiaS" />
            <div v-else-if="!cargando" class="h-full flex items-center justify-center text-slate-400">
              No hay datos disponibles
            </div>
          </div>

          <!-- Gráfico de Estopa Azul por Mes - Día -->
          <div class="flex-[1.3] h-full px-2 py-4 border border-slate-200 rounded-lg min-w-0 overflow-hidden">
            <Bar v-if="chartDataEstopaAzulDia" :data="chartDataEstopaAzulDia" :options="chartOptionsEstopaAzulDia" />
            <div v-else-if="!cargando" class="h-full flex items-center justify-center text-slate-400">
              No hay datos disponibles
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import CustomDatepicker from './CustomDatepicker.vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import Swal from 'sweetalert2'
import { domToPng } from 'modern-screenshot'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale, ChartDataLabels)

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'
const cargando = ref(false)
const datos = ref([])
const datosS = ref([])
const datosDia = ref([])
const datosDiaS = ref([])
const datosEstopaAzul = ref([])
const datosEstopaAzulDiario = ref([])
const chartsContainer = ref(null)

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

const cargarDatos = async () => {
  cargando.value = true
  try {
    const [year, month, day] = fechaSeleccionada.value.split('-')
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
    datos.value = []
    datosS.value = []
    datosDia.value = []
    datosDiaS.value = []
    datosEstopaAzul.value = []
    datosEstopaAzulDiario.value = []
  } finally {
    cargando.value = false
  }
}

const chartData = computed(() => {
  if (datos.value.length === 0) return null
  
  // Función para dividir labels largos en múltiples líneas
  const splitLabel = (text, maxLength = 10) => {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''
    
    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxLength) {
        currentLine = currentLine ? currentLine + ' ' + word : word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })
    if (currentLine) lines.push(currentLine)
    
    return lines
  }
  
  // Encontrar el valor máximo
  const maxValue = Math.max(...datos.value.map(d => d.TotalKg))
  
  return {
    labels: datos.value.map(d => splitLabel(d.DESC_MOTIVO)),
    datasets: [
      {
        label: 'Kg Residuos',
        data: datos.value.map(d => d.TotalKg),
        backgroundColor: datos.value.map((d, i) => 
          d.TotalKg === maxValue ? '#dc2626' : (i % 2 === 0 ? '#0f172a' : '#3b82f6')
        ),
        borderRadius: 4,
      }
    ]
  }
})

const chartOptions = computed(() => {
  const [year, month, day] = fechaSeleccionada.value.split('-')
  const total = datos.value.reduce((sum, d) => sum + d.TotalKg, 0)
  
  // Función para formatear fecha a dd-mmm-yy
  const formatearFecha = (d, m, y) => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${d}-${meses[parseInt(m) - 1]}-${y.slice(2)}`
  }
  
  const fechaInicio = formatearFecha('01', month, year)
  const fechaFin = formatearFecha(day, month, year)
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Residuos por Motivo del Periodo ${fechaInicio} a ${fechaFin}`,
        font: {
          size: 24,
          weight: 'bold'
        },
        padding: {
          bottom: 30
        },
        color: '#000'
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        formatter: (value) => {
          const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          return `${Math.round(value).toLocaleString()}\n(${porcentaje}%)`
        },
        font: {
          weight: 'bold',
          size: 11
        },
        color: '#000'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: false
        },
        ticks: {
          display: false
        },
        border: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            weight: 'bold',
            size: 10
          },
          color: '#000',
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          padding: 5,
          callback: function(value, index) {
            const label = this.getLabelForValue(value);
            return Array.isArray(label) ? label : [label];
          }
        }
      }
    }
  }
})

const chartDataS = computed(() => {
  if (datosS.value.length === 0) return null
  
  // Encontrar el valor máximo
  const maxValue = Math.max(...datosS.value.map(d => d.count))
  const colores = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
  
  return {
    labels: datosS.value.map(d => d.S),
    datasets: [
      {
        label: 'Cantidad de Registros',
        data: datosS.value.map(d => d.count),
        backgroundColor: datosS.value.map((d, i) => 
          d.count === maxValue ? '#dc2626' : colores[i % colores.length]
        ),
        borderRadius: 4,
      }
    ]
  }
})

const chartOptionsS = computed(() => {
  const total = datosS.value.reduce((sum, d) => sum + d.count, 0)
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Producción ÍNDIGO por Tipo',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 30
        },
        color: '#000'
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 4,
        formatter: (value) => {
          const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          return `${value.toLocaleString()}\n(${porcentaje}%)`
        },
        font: {
          weight: 'bold',
          size: 11
        },
        color: '#000'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: false
        },
        ticks: {
          display: false
        },
        border: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            weight: 'bold',
            size: 10
          },
          color: '#000'
        }
      }
    }
  }
})

// Gráficos del día específico
const chartDataDia = computed(() => {
  if (datosDia.value.length === 0) return null
  
  const splitLabel = (text, maxLength = 10) => {
    const words = text.split(' ')
    const lines = []
    let currentLine = ''
    
    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= maxLength) {
        currentLine = currentLine ? currentLine + ' ' + word : word
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    })
    if (currentLine) lines.push(currentLine)
    
    return lines
  }
  
  // Encontrar el valor máximo
  const maxValue = Math.max(...datosDia.value.map(d => d.TotalKg))
  
  return {
    labels: datosDia.value.map(d => splitLabel(d.DESC_MOTIVO)),
    datasets: [
      {
        label: 'Kg Residuos',
        data: datosDia.value.map(d => d.TotalKg),
        backgroundColor: datosDia.value.map((d, i) => 
          d.TotalKg === maxValue ? '#dc2626' : (i % 2 === 0 ? '#0f172a' : '#3b82f6')
        ),
        borderRadius: 4,
      }
    ]
  }
})

const chartOptionsDia = computed(() => {
  const [year, month, day] = fechaSeleccionada.value.split('-')
  const total = datosDia.value.reduce((sum, d) => sum + d.TotalKg, 0)
  
  const formatearFecha = (d, m, y) => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${d}-${meses[parseInt(m) - 1]}-${y.slice(2)}`
  }
  
  const fecha = formatearFecha(day, month, year)
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Residuos por Motivo del Día ${fecha}`,
        font: {
          size: 24,
          weight: 'bold'
        },
        padding: {
          bottom: 30
        },
        color: '#000'
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        formatter: (value) => {
          const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          return `${Math.round(value).toLocaleString()}\n(${porcentaje}%)`
        },
        font: {
          weight: 'bold',
          size: 11
        },
        color: '#000'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: false
        },
        ticks: {
          display: false
        },
        border: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            weight: 'bold',
            size: 10
          },
          color: '#000',
          maxRotation: 0,
          minRotation: 0,
          autoSkip: false,
          padding: 5,
          callback: function(value, index) {
            const label = this.getLabelForValue(value);
            return Array.isArray(label) ? label : [label];
          }
        }
      }
    }
  }
})

const chartDataDiaS = computed(() => {
  if (datosDiaS.value.length === 0) return null
  
  // Encontrar el valor máximo
  const maxValue = Math.max(...datosDiaS.value.map(d => d.count))
  const colores = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']
  
  return {
    labels: datosDiaS.value.map(d => d.S),
    datasets: [
      {
        label: 'Cantidad de Registros',
        data: datosDiaS.value.map(d => d.count),
        backgroundColor: datosDiaS.value.map((d, i) => 
          d.count === maxValue ? '#dc2626' : colores[i % colores.length]
        ),
        borderRadius: 4,
      }
    ]
  }
})

const chartOptionsDiaS = computed(() => {
  const total = datosDiaS.value.reduce((sum, d) => sum + d.count, 0)
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Producción ÍNDIGO por Tipo',
        font: {
          size: 16,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 30
        },
        color: '#000'
      },
      datalabels: {
        anchor: 'end',
        align: 'end',
        offset: 4,
        formatter: (value) => {
          const porcentaje = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
          return `${value.toLocaleString()}\n(${porcentaje}%)`
        },
        font: {
          weight: 'bold',
          size: 11
        },
        color: '#000'
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: false
        },
        ticks: {
          display: false
        },
        border: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            weight: 'bold',
            size: 10
          },
          color: '#000'
        }
      }
    }
  }
})

// Gráficos de Estopa Azul por Mes
const chartDataEstopaAzul = computed(() => {
  if (datosEstopaAzul.value.length === 0) return null
  
  // Encontrar el valor máximo
  const maxValue = Math.max(...datosEstopaAzul.value.map(d => d.KgResiduo))
  
  return {
    labels: datosEstopaAzul.value.map(d => {
      const [year, month] = d.Mes.split('-')
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      return `${meses[parseInt(month) - 1]}-${year.slice(2)}`
    }),
    datasets: [
      {
        label: 'Kg de Estopa Azul',
        data: datosEstopaAzul.value.map(d => d.KgResiduo),
        backgroundColor: datosEstopaAzul.value.map((d) => 
          d.KgResiduo === maxValue ? '#dc2626' : '#3b82f6'
        ),
        borderRadius: 4,
      }
    ]
  }
})

const chartOptionsEstopaAzul = computed(() => {
  const total = datosEstopaAzul.value.reduce((sum, d) => sum + d.KgResiduo, 0)
  const promedio = datosEstopaAzul.value.length > 0 ? (total / datosEstopaAzul.value.length).toFixed(0) : 0
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Estopa Azul por Mes (Últimos 12 Meses)`,
        font: {
          size: 14,
          weight: 'bold'
        },
        padding: {
          top: 5,
          bottom: 20
        },
        color: '#000'
      },
      datalabels: {
        display: false
      },
      tooltip: {
        callbacks: {
          afterLabel: (context) => {
            const value = context.raw
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
            return `${percentage}% del total`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: '#e5e7eb'
        },
        ticks: {
          callback: function(value) {
            return Math.round(value).toLocaleString() + ' kg'
          },
          font: {
            size: 9
          },
          color: '#666'
        },
        border: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            weight: 'bold',
            size: 9
          },
          color: '#000',
          maxRotation: 90,
          minRotation: 90,
          autoSkip: false,
          padding: 5
        }
      }
    }
  }
})

const chartDataEstopaAzulDia = computed(() => {
  // Para el día, mostrar los datos diarios del mes seleccionado
  if (datosEstopaAzulDiario.value.length === 0) return null
  
  const maxValue = Math.max(...datosEstopaAzulDiario.value.map(d => d.KgResiduo))
  
  return {
    labels: datosEstopaAzulDiario.value.map(d => {
      // Formato: DD/MM/YYYY -> DD
      const [dia] = d.Fecha.split('/')
      return dia
    }),
    datasets: [
      {
        label: 'Kg de Estopa Azul',
        data: datosEstopaAzulDiario.value.map(d => d.KgResiduo),
        backgroundColor: datosEstopaAzulDiario.value.map((d) => 
          d.KgResiduo === maxValue ? '#dc2626' : '#10b981'
        ),
        borderRadius: 4,
      }
    ]
  }
})

const chartOptionsEstopaAzulDia = computed(() => {
  const total = datosEstopaAzulDiario.value.reduce((sum, d) => sum + d.KgResiduo, 0)
  const [year, month, day] = fechaSeleccionada.value.split('-')
  
  // Función para formatear fecha a dd-mmm-yy
  const formatearFecha = (d, m, y) => {
    const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${d}-${meses[parseInt(m) - 1]}-${y.slice(2)}`
  }
  
  const fechaInicio = formatearFecha('01', month, year)
  const fechaFin = formatearFecha(day, month, year)
  
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: `Estopa Azul por Día del Periodo ${fechaInicio} a ${fechaFin}`,
        font: {
          size: 14,
          weight: 'bold'
        },
        padding: {
          top: 5,
          bottom: 20
        },
        color: '#000'
      },
      datalabels: {
        display: false
      },
      tooltip: {
        callbacks: {
          afterLabel: (context) => {
            const value = context.raw
            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0'
            return `${percentage}% del total del mes`
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true,
          color: '#e5e7eb'
        },
        ticks: {
          callback: function(value) {
            return Math.round(value).toLocaleString() + ' kg'
          },
          font: {
            size: 9
          },
          color: '#666'
        },
        border: {
          display: false
        }
      },
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            weight: 'bold',
            size: 9
          },
          color: '#000',
          maxRotation: 90,
          minRotation: 90,
          autoSkip: false,
          padding: 5
        }
      }
    }
  }
})

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
      const total = datos.value.reduce((sum, d) => sum + d.TotalKg, 0)
      mensaje += `📦 *RESIDUOS DEL PERIODO (${mesNombre})*\n`
      mensaje += `Total: *${Math.round(total).toLocaleString()} kg*\n\n`
      
      datos.value.forEach(d => {
        const porcentaje = ((d.TotalKg / total) * 100).toFixed(1)
        mensaje += `• ${d.DESC_MOTIVO}: ${Math.round(d.TotalKg).toLocaleString()} kg (${porcentaje}%)\n`
      })
      mensaje += `\n`
    }
    
    // Producción del periodo
    if (datosS.value.length > 0) {
      const total = datosS.value.reduce((sum, d) => sum + d.count, 0)
      mensaje += `🏭 *PRODUCCIÓN ÍNDIGO DEL PERIODO*\n`
      mensaje += `Total registros: *${total.toLocaleString()}*\n\n`
      
      datosS.value.forEach(d => {
        const porcentaje = ((d.count / total) * 100).toFixed(1)
        mensaje += `• ${d.S}: ${d.count.toLocaleString()} (${porcentaje}%)\n`
      })
      mensaje += `\n`
    }
    
    // Residuos del día
    if (datosDia.value.length > 0) {
      const total = datosDia.value.reduce((sum, d) => sum + d.TotalKg, 0)
      mensaje += `━━━━━━━━━━━━━━━━━━━━━━\n`
      mensaje += `📦 *RESIDUOS DEL DÍA ${day}/${month}/${year}*\n`
      mensaje += `Total: *${Math.round(total).toLocaleString()} kg*\n\n`
      
      datosDia.value.forEach(d => {
        const porcentaje = ((d.TotalKg / total) * 100).toFixed(1)
        mensaje += `• ${d.DESC_MOTIVO}: ${Math.round(d.TotalKg).toLocaleString()} kg (${porcentaje}%)\n`
      })
      mensaje += `\n`
    }
    
    // Producción del día
    if (datosDiaS.value.length > 0) {
      const total = datosDiaS.value.reduce((sum, d) => sum + d.count, 0)
      mensaje += `🏭 *PRODUCCIÓN ÍNDIGO DEL DÍA*\n`
      mensaje += `Total registros: *${total.toLocaleString()}*\n\n`
      
      datosDiaS.value.forEach(d => {
        const porcentaje = ((d.count / total) * 100).toFixed(1)
        mensaje += `• ${d.S}: ${d.count.toLocaleString()} (${porcentaje}%)\n`
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

const copiarComoImagen = async () => {
  if (!chartsContainer.value) return

  /*
    Genera la imagen usando un canvas off‑screen y copia al portapapeles.
    Motivo: evitar crear elementos temporales visibles que producían un parpadeo.

    Fallbacks implementados (en orden):
      1) `navigator.clipboard.write` con `ClipboardItem` (imagen binaria).
      2) Si falla, copiar el `dataURL` con `navigator.clipboard.writeText(dataUrl)`.
      3) Si eso falla, abrir la imagen en una nueva pestaña para que el usuario la guarde.
      4) (Opcional) volver al método visible con `domToPng` si se requiere — no aplicado automáticamente.
  */

  try {
    const pixelScale = Math.max(1, window.devicePixelRatio || 1) * 2
    const padding = 30
    const headerContentHeight = 40
    const headerTop = padding
    const headerHeight = headerContentHeight
    const contentOffsetY = headerTop + headerHeight + padding

    const containerRect = chartsContainer.value.getBoundingClientRect()

    const canvases = Array.from(chartsContainer.value.querySelectorAll('canvas'))
    if (canvases.length === 0) throw new Error('No hay canvases para copiar')

    // Calcular bounding box relativo al contenedor
    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity
    const rects = canvases.map(c => c.getBoundingClientRect())
    rects.forEach(r => {
      const left = r.left - containerRect.left
      const top = r.top - containerRect.top
      minLeft = Math.min(minLeft, left)
      minTop = Math.min(minTop, top)
      maxRight = Math.max(maxRight, left + r.width)
      maxBottom = Math.max(maxBottom, top + r.height)
    })

    const contentWidth = Math.ceil(maxRight - minLeft)
    const contentHeight = Math.ceil(maxBottom - minTop)

    const canvasWidth = Math.round((contentWidth + padding * 2) * pixelScale)
    const canvasHeight = Math.round((contentOffsetY + contentHeight + padding) * pixelScale)

    const out = document.createElement('canvas')
    out.width = canvasWidth
    out.height = canvasHeight
    const ctx = out.getContext('2d')

    // Fondo blanco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)

    // Dibujar header (logo y título) en coordenadas CSS, ajustadas por pixelScale
    const logo = document.querySelector('main img[alt="Santana Textiles"]')
    let currentX = padding
    const logoHeight = 40
    if (logo) {
      try {
        if (logo.complete) {
          const logoRect = logo.getBoundingClientRect()
          const aspect = logoRect.width && logoRect.height ? (logoRect.width / logoRect.height) : 1
          const logoWidth = logoHeight * aspect
          ctx.drawImage(logo, currentX * pixelScale, headerTop * pixelScale, logoWidth * pixelScale, logoHeight * pixelScale)
          currentX += logoWidth + 16
        } else {
          const img = new Image()
          img.src = logo.src
          await new Promise(resolve => { img.onload = resolve; img.onerror = resolve })
          const aspect = img.width && img.height ? (img.width / img.height) : 1
          const logoWidth = logoHeight * aspect
          ctx.drawImage(img, currentX * pixelScale, headerTop * pixelScale, logoWidth * pixelScale, logoHeight * pixelScale)
          currentX += logoWidth + 16
        }
      } catch (e) {
        // ignore
      }
    }

    ctx.fillStyle = '#0f172a'
    ctx.font = `${16 * pixelScale}px sans-serif`
    ctx.fillText('Análisis Residuos de Índigo', currentX * pixelScale, (headerTop + 26) * pixelScale)

    // Dibujar cada canvas con coordenadas correctas y resoluciones
    canvases.forEach((orig, i) => {
      const r = rects[i]
      const leftRel = r.left - containerRect.left
      const topRel = r.top - containerRect.top
      const destX = (padding + (leftRel - minLeft)) * pixelScale
      const destY = (contentOffsetY + (topRel - minTop)) * pixelScale
      const destW = r.width * pixelScale
      const destH = r.height * pixelScale

      try {
        const srcW = orig.width || r.width * (window.devicePixelRatio || 1)
        const srcH = orig.height || r.height * (window.devicePixelRatio || 1)
        ctx.drawImage(orig, 0, 0, srcW, srcH, destX, destY, destW, destH)
      } catch (err) {
        // fallback: usar dataURL de canvas
        try {
          const data = orig.toDataURL('image/png')
          const img = new Image()
          img.src = data
          img.onload = () => {
            ctx.drawImage(img, destX, destY, destW, destH)
          }
        } catch (e) {
          console.warn('No se pudo dibujar canvas:', e)
        }
      }
    })

    // Pequeña espera por si hay onload pendientes
    await new Promise(resolve => setTimeout(resolve, 50))

    const blob = await new Promise(resolve => out.toBlob(resolve, 'image/png', 1))
    if (!blob) throw new Error('No se pudo generar la imagen')

    // Intento principal: escribir imagen binaria al portapapeles
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
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
      return
    } catch (errWrite) {
      console.warn('Escritura de imagen en portapapeles falló, intentando fallback:', errWrite)
    }

    // Fallback 1: copiar dataURL como texto
    try {
      const dataUrl = out.toDataURL('image/png')
      await navigator.clipboard.writeText(dataUrl)
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'DataURL copiado al portapapeles',
        text: 'Algunos destinos no pegarán esta entrada como imagen; guarda la imagen manualmente si es necesario.',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true
      })
      return
    } catch (errText) {
      console.warn('Fallback writeText falló:', errText)
    }

    // Fallback 2: abrir imagen en nueva pestaña para que el usuario la guarde/pegue manualmente
    try {
      const dataUrl2 = out.toDataURL('image/png')
      const w = window.open('', '_blank')
      if (w) {
        w.document.write(`<html><head><title>Imagen</title></head><body style="margin:0"><img src="${dataUrl2}" style="max-width:100%;height:auto;display:block;margin:0 auto;"/></body></html>`)
        w.document.close()
        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'info',
          title: 'Imagen abierta en nueva pestaña',
          text: 'Guárdala o cópiala manualmente.',
          showConfirmButton: false,
          timer: 3500,
          timerProgressBar: true
        })
        return
      }
    } catch (errOpen) {
      console.warn('Abrir nueva pestaña falló:', errOpen)
    }

    throw new Error('No se pudo copiar la imagen ni realizar fallbacks')
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

async function imprimirPagina() {
  if (!chartsContainer.value) {
    window.print()
    return
  }
  
  /*
    Genera la imagen usando un canvas off‑screen y abre ventana de impresión.
    Motivo: evitar crear elementos temporales visibles que producían un parpadeo en pantalla.
  */
  
  try {
    const pixelScale = Math.max(1, window.devicePixelRatio || 1) * 2
    const padding = 20
    const gap = 16
    const headerContentHeight = 35
    const headerTop = padding
    const headerHeight = headerContentHeight
    const contentOffsetY = headerTop + headerHeight + padding

    const containerRect = chartsContainer.value.getBoundingClientRect()

    const canvases = Array.from(chartsContainer.value.querySelectorAll('canvas'))
    if (canvases.length === 0) throw new Error('No hay canvases para imprimir')

    const rects = canvases.map(c => c.getBoundingClientRect())
    
    // Calcular bounding box con gap incluido
    let minLeft = Infinity, minTop = Infinity, maxRight = -Infinity, maxBottom = -Infinity
    rects.forEach((r, idx) => {
      const left = r.left - containerRect.left
      const top = r.top - containerRect.top
      minLeft = Math.min(minLeft, left)
      minTop = Math.min(minTop, top)
      maxRight = Math.max(maxRight, left + r.width)
      maxBottom = Math.max(maxBottom, top + r.height)
    })

    // Escala uniforme para que todo se vea más profesional y grande
    const uniformScale = 1.2
    const contentWidth = Math.ceil((maxRight - minLeft) * uniformScale)
    const contentHeight = Math.ceil((maxBottom - minTop) * uniformScale)

    const canvasWidth = Math.round((contentWidth + padding * 2) * pixelScale)
    const canvasHeight = Math.round((contentOffsetY + contentHeight + padding) * pixelScale)

    const out = document.createElement('canvas')
    out.width = canvasWidth
    out.height = canvasHeight
    const ctx = out.getContext('2d')

    // Fondo blanco
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)

    // Dibujar header (logo y título)
    const logo = document.querySelector('main img[alt="Santana Textiles"]')
    let currentX = padding
    const logoHeight = 35
    if (logo) {
      try {
        if (logo.complete) {
          const logoRect = logo.getBoundingClientRect()
          const aspect = logoRect.width && logoRect.height ? (logoRect.width / logoRect.height) : 1
          const logoWidth = logoHeight * aspect
          ctx.drawImage(logo, currentX * pixelScale, headerTop * pixelScale, logoWidth * pixelScale, logoHeight * pixelScale)
          currentX += logoWidth + 16
        } else {
          const img = new Image()
          img.src = logo.src
          await new Promise(resolve => { img.onload = resolve; img.onerror = resolve })
          const aspect = img.width && img.height ? (img.width / img.height) : 1
          const logoWidth = logoHeight * aspect
          ctx.drawImage(img, currentX * pixelScale, headerTop * pixelScale, logoWidth * pixelScale, logoHeight * pixelScale)
          currentX += logoWidth + 16
        }
      } catch (e) {
        // ignore
      }
    }

    ctx.fillStyle = '#0f172a'
    ctx.font = `bold ${16 * pixelScale}px sans-serif`
    ctx.fillText('Análisis Residuos de Índigo', currentX * pixelScale, (headerTop + 24) * pixelScale)

    // Dibujar cada canvas manteniendo proporciones y con bordes
    const borderColor = 'rgb(226, 232, 240)'
    const borderWidth = 1 * pixelScale
    const borderRadius = 4 * pixelScale
    
    canvases.forEach((orig, i) => {
      const r = rects[i]
      const leftRel = r.left - containerRect.left
      const topRel = r.top - containerRect.top
      
      // Escalar uniformemente manteniendo proporciones
      const destX = (padding + (leftRel - minLeft) * uniformScale) * pixelScale
      const destY = (contentOffsetY + (topRel - minTop) * uniformScale) * pixelScale
      const destW = r.width * uniformScale * pixelScale
      const destH = r.height * uniformScale * pixelScale

      try {
        const srcW = orig.width || r.width * (window.devicePixelRatio || 1)
        const srcH = orig.height || r.height * (window.devicePixelRatio || 1)
        ctx.drawImage(orig, 0, 0, srcW, srcH, destX, destY, destW, destH)
      } catch (err) {
        try {
          const data = orig.toDataURL('image/png')
          const img = new Image()
          img.src = data
          img.onload = () => {
            ctx.drawImage(img, destX, destY, destW, destH)
          }
        } catch (e) {
          console.warn('No se pudo dibujar canvas:', e)
        }
      }
      
      // Dibujar borde del contenedor con esquinas redondeadas
      ctx.strokeStyle = borderColor
      ctx.lineWidth = borderWidth
      ctx.beginPath()
      ctx.moveTo(destX + borderRadius, destY)
      ctx.lineTo(destX + destW - borderRadius, destY)
      ctx.quadraticCurveTo(destX + destW, destY, destX + destW, destY + borderRadius)
      ctx.lineTo(destX + destW, destY + destH - borderRadius)
      ctx.quadraticCurveTo(destX + destW, destY + destH, destX + destW - borderRadius, destY + destH)
      ctx.lineTo(destX + borderRadius, destY + destH)
      ctx.quadraticCurveTo(destX, destY + destH, destX, destY + destH - borderRadius)
      ctx.lineTo(destX, destY + borderRadius)
      ctx.quadraticCurveTo(destX, destY, destX + borderRadius, destY)
      ctx.closePath()
      ctx.stroke()
    })

    // Pequeña espera por si hay onload pendientes
    await new Promise(resolve => setTimeout(resolve, 50))

    const dataUrl = out.toDataURL('image/png', 1)
    
    // Abrir ventana de impresión con la imagen
    const printWindow = window.open('', '_blank', 'width=1200,height=800')
    if (!printWindow) {
      throw new Error('No se pudo abrir la ventana de impresión. Verifica que los pop-ups estén permitidos.')
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Análisis Residuos Índigo - Impresión</title>
        <style>
          @page {
            size: landscape;
            margin: 5mm 5mm 10mm 5mm;
          }
          body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: flex-start;
          }
          img {
            max-width: 100%;
            max-height: 100vh;
            object-fit: contain;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" onload="setTimeout(function() { window.print(); window.close(); }, 200);" />
      </body>
      </html>
    `)
    printWindow.document.close()
    
  } catch (error) {
    console.error('Error al imprimir:', error)
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'error',
      title: 'Error al preparar impresión',
      text: error.message || 'No se pudo generar la imagen para imprimir',
      showConfirmButton: false,
      timer: 3000
    })
  }
}

onMounted(() => {
  cargarDatos()
})
</script>

<style>
/* Estilos globales de impresión */
@media print {
  /* Ocultar TODOS los botones, sidebar y navegación */
  button,
  .fixed,
  aside,
  nav,
  [role="button"] {
    display: none !important;
    visibility: hidden !important;
  }
}
</style>

<style scoped>
@media print {
  @page {
    size: landscape;
    margin: 5mm 5mm 10mm 5mm;
  }
}
</style>
