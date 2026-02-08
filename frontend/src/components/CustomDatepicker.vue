<template>
  <div class="fecha-controls inline-flex items-center gap-2">
    <label v-if="label" class="text-sm text-slate-600 font-medium">{{ label }}</label>
    
    <div class="custom-datepicker relative" ref="datepickerRef">
      <input 
        type="text" 
        :value="displayDate" 
        class="filter-input datepicker-input w-32 px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all cursor-pointer bg-white"
        :placeholder="placeholder"
        @click="toggleCalendar"
        @keydown.left.prevent="cambiarFecha(-1)"
        @keydown.right.prevent="cambiarFecha(1)"
        readonly
      />
      <span class="calendar-icon absolute right-3 top-1/2 -translate-y-1/2 text-lg cursor-pointer select-none" @click="toggleCalendar">📅</span>

      <div v-if="showCalendar" class="calendar-dropdown absolute top-[calc(100%+4px)] right-0 bg-white border border-slate-200 rounded-lg shadow-xl p-3 z-50 min-w-[280px]">
        <div class="calendar-header flex justify-between items-center mb-3">
          <button class="calendar-nav-btn w-8 h-8 flex items-center justify-center border border-slate-200 rounded bg-white text-blue-600 hover:bg-blue-600 hover:text-white transition-colors" @click.stop="changeMonth(-1)">&lt;</button>
          <div class="calendar-selects flex gap-1">
            <select 
              :value="currentMonth.getMonth()" 
              @change="updateMonth" 
              @click.stop
              class="calendar-select text-sm font-semibold text-slate-700 bg-transparent border-none cursor-pointer hover:bg-slate-100 rounded px-1 focus:ring-0"
            >
              <option v-for="(month, index) in monthNames" :key="index" :value="index">
                {{ month }}
              </option>
            </select>
            <select 
              :value="currentMonth.getFullYear()" 
              @change="updateYear" 
              @click.stop
              class="calendar-select text-sm font-semibold text-slate-700 bg-transparent border-none cursor-pointer hover:bg-slate-100 rounded px-1 focus:ring-0"
            >
              <option v-for="year in years" :key="year" :value="year">
                {{ year }}
              </option>
            </select>
          </div>
          <button class="calendar-nav-btn w-8 h-8 flex items-center justify-center border border-slate-200 rounded bg-white text-blue-600 hover:bg-blue-600 hover:text-white transition-colors" @click.stop="changeMonth(1)">&gt;</button>
        </div>
        <div class="calendar-weekdays grid grid-cols-7 gap-1 mb-2">
          <span v-for="day in ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']" :key="day" class="text-center text-[11px] font-semibold text-slate-500">{{ day }}</span>
        </div>
        <div class="calendar-days grid grid-cols-7 gap-1">
          <button 
            v-for="day in calendarDays" 
            :key="day.key"
            :class="['calendar-day aspect-square flex items-center justify-center text-[13px] rounded border transition-colors', {
              'text-slate-300 bg-slate-50 border-transparent cursor-default': day.otherMonth,
              'bg-blue-600 text-white border-blue-600 font-semibold': day.selected,
              'border-blue-600 font-semibold text-slate-700': day.today && !day.selected,
              'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-600': !day.selected && !day.otherMonth && !day.today
            }]"
            @click.stop="selectDate(day)"
            :disabled="day.otherMonth"
          >
            {{ day.day }}
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="showButtons" class="flex gap-1">
      <button 
        class="inline-flex items-center justify-center px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm h-[34px]" 
        @click="cambiarMes(-1)" 
        @mousedown.prevent
        tabindex="-1"
        v-tippy="{ content: 'Mes anterior', placement: 'bottom' }"
      >&lt;&lt;</button>
      <button 
        class="inline-flex items-center justify-center px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm h-[34px]" 
        @click="cambiarFecha(-1)" 
        @mousedown.prevent
        tabindex="-1"
        v-tippy="{ content: 'Día anterior (←)', placement: 'bottom' }"
      >&lt;</button>
      <button 
        class="inline-flex items-center justify-center px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm h-[34px]" 
        @click="cambiarFecha(1)" 
        @mousedown.prevent
        tabindex="-1"
        v-tippy="{ content: 'Día siguiente (→)', placement: 'bottom' }"
      >&gt;</button>
      <button 
        class="inline-flex items-center justify-center px-2 py-1 border border-slate-200 bg-white text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors duration-150 shadow-sm h-[34px]" 
        @click="cambiarMes(1)" 
        @mousedown.prevent
        tabindex="-1"
        v-tippy="{ content: 'Mes siguiente', placement: 'bottom' }"
      >&gt;&gt;</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: {
    type: String,
    default: ''
  },
  placeholder: {
    type: String,
    default: 'Selecciona una fecha'
  },
  showButtons: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'change'])

const showCalendar = ref(false)
const calendarMonth = ref(new Date().getMonth())
const calendarYear = ref(new Date().getFullYear())
const datepickerRef = ref(null)

// Cerrar al hacer clic fuera
const handleClickOutside = (event) => {
  if (datepickerRef.value && !datepickerRef.value.contains(event.target)) {
    showCalendar.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

const displayDate = computed(() => {
  if (!props.modelValue) return ''
  const [year, month, day] = props.modelValue.split('-').map(Number)
  const fecha = new Date(year, month - 1, day)
  const diaNum = fecha.getDate().toString().padStart(2, '0')
  const mes = (fecha.getMonth() + 1).toString().padStart(2, '0')
  const anio = fecha.getFullYear()
  return `${diaNum}/${mes}/${anio}`
})

const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const years = computed(() => {
  const currentYear = new Date().getFullYear()
  const startYear = 2020
  const yearList = []
  for (let y = startYear; y <= currentYear + 1; y++) {
    yearList.push(y)
  }
  return yearList
})

const currentMonth = computed(() => {
  return new Date(calendarYear.value, calendarMonth.value)
})

// Sincronizar calendario con la fecha seleccionada cuando se abre
watch(() => showCalendar.value, (newVal) => {
  if (newVal && props.modelValue) {
    const [year, month] = props.modelValue.split('-').map(Number)
    calendarMonth.value = month - 1
    calendarYear.value = year
  }
})

function updateMonth(event) {
  calendarMonth.value = parseInt(event.target.value)
}

function updateYear(event) {
  calendarYear.value = parseInt(event.target.value)
}

const calendarDays = computed(() => {
  const days = []
  const firstDay = new Date(calendarYear.value, calendarMonth.value, 1)
  const lastDay = new Date(calendarYear.value, calendarMonth.value + 1, 0)
  const prevLastDay = new Date(calendarYear.value, calendarMonth.value, 0)
  
  const startDayOfWeek = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const prevDaysInMonth = prevLastDay.getDate()
  
  // Días del mes anterior
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    days.push({
      day: prevDaysInMonth - i,
      otherMonth: true,
      key: `prev-${prevDaysInMonth - i}`
    })
  }
  
  // Días del mes actual
  const today = new Date()
  const selectedDate = props.modelValue ? new Date(props.modelValue + 'T00:00:00') : null
  
  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(calendarYear.value, calendarMonth.value, i)
    days.push({
      day: i,
      otherMonth: false,
      selected: selectedDate && 
                selectedDate.getDate() === i && 
                selectedDate.getMonth() === calendarMonth.value && 
                selectedDate.getFullYear() === calendarYear.value,
      today: today.getDate() === i && 
             today.getMonth() === calendarMonth.value && 
             today.getFullYear() === calendarYear.value,
      key: `current-${i}`,
      date: currentDate
    })
  }
  
  // Días del mes siguiente para completar la grilla
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      day: i,
      otherMonth: true,
      key: `next-${i}`
    })
  }
  
  return days
})

function toggleCalendar() {
  showCalendar.value = !showCalendar.value
}

function changeMonth(offset) {
  calendarMonth.value += offset
  if (calendarMonth.value > 11) {
    calendarMonth.value = 0
    calendarYear.value++
  } else if (calendarMonth.value < 0) {
    calendarMonth.value = 11
    calendarYear.value--
  }
}

function selectDate(day) {
  if (day.otherMonth) return
  
  const y = calendarYear.value
  const m = (calendarMonth.value + 1).toString().padStart(2, '0')
  const d = day.day.toString().padStart(2, '0')
  const newDate = `${y}-${m}-${d}`
  
  emit('update:modelValue', newDate)
  emit('change', newDate)
  
  showCalendar.value = false
}

function cambiarFecha(dias) {
  if (!props.modelValue) return
  const [year, month, day] = props.modelValue.split('-').map(Number)
  const fecha = new Date(year, month - 1, day)
  fecha.setDate(fecha.getDate() + dias)
  
  const y = fecha.getFullYear()
  const m = (fecha.getMonth() + 1).toString().padStart(2, '0')
  const d = fecha.getDate().toString().padStart(2, '0')
  const newDate = `${y}-${m}-${d}`
  
  emit('update:modelValue', newDate)
  emit('change', newDate)
}

function cambiarMes(meses) {
  if (!props.modelValue) return
  const [year, month, day] = props.modelValue.split('-').map(Number)
  
  // Crear fecha con el primer día del mes actual
  const fecha = new Date(year, month - 1, 1)
  
  // Cambiar el mes (siempre desde el día 1 para evitar problemas con meses de diferente longitud)
  fecha.setMonth(fecha.getMonth() + meses)
  
  // Obtener fecha actual (hoy)
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  
  // Verificar si el mes destino es el mes actual
  const esMesActual = fecha.getFullYear() === hoy.getFullYear() && 
                      fecha.getMonth() === hoy.getMonth()
  
  let diaFinal
  if (esMesActual) {
    // Si es el mes actual, usar ayer
    const ayer = new Date(hoy)
    ayer.setDate(ayer.getDate() - 1)
    diaFinal = ayer.getDate()
  } else {
    // Si no es el mes actual, usar el último día del mes
    const ultimoDiaDelMes = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()
    diaFinal = ultimoDiaDelMes
  }
  
  fecha.setDate(diaFinal)
  
  const y = fecha.getFullYear()
  const m = (fecha.getMonth() + 1).toString().padStart(2, '0')
  const d = fecha.getDate().toString().padStart(2, '0')
  const newDate = `${y}-${m}-${d}`
  
  emit('update:modelValue', newDate)
  emit('change', newDate)
}
</script>

<style scoped>
/* Estilos específicos si no se cubren con Tailwind */
</style>
