<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-emerald-50 p-6">
    <!-- Header -->
    <div class="mb-6 bg-white/90 backdrop-blur-sm rounded-2xl shadow-lg border border-slate-200 p-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-md">
            <span class="text-2xl">⚙️</span>
          </div>
          <div>
            <h1 class="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-teal-700 bg-clip-text text-transparent">
              Parámetros de Calidad HVI
            </h1>
            <p class="text-sm text-slate-600 mt-0.5">Gestión de rangos óptimos, aceptables y críticos para cada variable</p>
          </div>
        </div>
        <button
          @click="abrirModalCrear"
          class="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
        >
          <span class="text-lg">➕</span>
          <span>Nuevo Parámetro</span>
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="cargando" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="animate-spin rounded-full h-16 w-16 border-b-2 border-emerald-600 mx-auto mb-4"></div>
        <p class="text-slate-600">Cargando parámetros...</p>
      </div>
    </div>

    <!-- Lista de Parámetros Agrupados -->
    <div v-else class="space-y-8">
      <div 
        v-for="grupo in ordenGrupos.filter(g => parametrosAgrupados[g] && parametrosAgrupados[g].length > 0)"
        :key="grupo"
      >
        <!-- Título del Grupo -->
        <div class="mb-4 flex items-center gap-3">
          <h2 class="text-xl font-bold text-slate-700">{{ grupo }}</h2>
          <div class="flex-1 h-px bg-gradient-to-r from-slate-300 to-transparent"></div>
          <span class="text-sm text-slate-500 font-medium">{{ parametrosAgrupados[grupo].length }} variable{{ parametrosAgrupados[grupo].length !== 1 ? 's' : '' }}</span>
        </div>

        <!-- Tarjetas del Grupo -->
        <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          <div
            v-for="param in parametrosAgrupados[grupo]"
            :key="param.id"
            class="bg-white rounded-2xl shadow-md border border-slate-200 hover:shadow-xl transition-all duration-300 overflow-hidden group"
          >
        <!-- Header de la Card -->
        <div class="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="text-2xl font-bold text-white">{{ param.codigo }}</span>
                <span v-if="param.unidad" class="text-xs text-emerald-100 bg-white/20 px-2 py-0.5 rounded-full">
                  {{ param.unidad }}
                </span>
              </div>
              <h3 class="text-white font-semibold text-base">{{ param.nombre }}</h3>
            </div>
            <div class="flex gap-1">
              <button
                @click="abrirModalEditar(param)"
                v-tippy="{ content: 'Editar parámetro', placement: 'top' }"
                class="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
              >
                <span class="text-white text-sm">✏️</span>
              </button>
              <button
                @click="eliminarParametro(param)"
                v-tippy="{ content: 'Eliminar parámetro', placement: 'top' }"
                class="w-8 h-8 bg-white/20 hover:bg-red-500 rounded-lg flex items-center justify-center transition-colors"
              >
                <span class="text-white text-sm">🗑️</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Contenido de la Card -->
        <div class="p-5">
          <!-- Descripción -->
          <p class="text-xs text-slate-600 mb-4 line-clamp-3">
            {{ param.descripcion || 'Sin descripción' }}
          </p>

          <!-- Rangos -->
          <div class="space-y-2">
            <!-- Rango Óptimo -->
            <div v-if="param.optimo_min !== null || param.optimo_max !== null" class="flex items-center gap-2">
              <div class="w-2 h-2 bg-emerald-500 rounded-full"></div>
              <span class="text-xs font-semibold text-slate-700 w-20">Óptimo:</span>
              <span class="text-xs text-slate-600 flex-1">
                {{ formatearRango(param.optimo_min, param.optimo_max, param.tipo_dato, param.decimales) }}
              </span>
            </div>

            <!-- Rango Aceptable -->
            <div v-if="param.aceptable_min !== null || param.aceptable_max !== null" class="flex items-center gap-2">
              <div class="w-2 h-2 bg-amber-500 rounded-full"></div>
              <span class="text-xs font-semibold text-slate-700 w-20">Aceptable:</span>
              <span class="text-xs text-slate-600 flex-1">
                {{ formatearRango(param.aceptable_min, param.aceptable_max, param.tipo_dato, param.decimales) }}
              </span>
            </div>

            <!-- Rango Crítico -->
            <div v-if="param.critico_min !== null || param.critico_max !== null" class="flex items-center gap-2">
              <div class="w-2 h-2 bg-red-500 rounded-full"></div>
              <span class="text-xs font-semibold text-slate-700 w-20">Crítico:</span>
              <span class="text-xs text-slate-600 flex-1">
                {{ formatearRango(param.critico_min, param.critico_max, param.tipo_dato, param.decimales) }}
              </span>
            </div>
          </div>

          <!-- Estado -->
          <div class="mt-4 pt-4 border-t border-slate-100">
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-500">Estado:</span>
              <span :class="[
                'px-2.5 py-0.5 rounded-full text-xs font-medium',
                param.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
              ]">
                {{ param.activo ? 'Activo' : 'Inactivo' }}
              </span>
            </div>
          </div>
        </div>
      </div>
        </div>
      </div>
    </div>

    <!-- Modal Crear/Editar -->
    <transition name="modal">
      <div
        v-if="modalAbierto"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        @click.self="cerrarModal"
      >
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          <!-- Header del Modal -->
          <div class="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between">
            <h2 class="text-xl font-bold text-white">
              {{ modoEdicion ? 'Editar Parámetro HVI' : 'Nuevo Parámetro HVI' }}
            </h2>
            <button
              @click="cerrarModal"
              class="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-lg flex items-center justify-center transition-colors"
            >
              <span class="text-white text-xl">×</span>
            </button>
          </div>

          <!-- Contenido del Modal -->
          <div class="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            <form @submit.prevent="guardarParametro" class="space-y-6">
              <!-- Fila 1: Información Básica -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <!-- Código -->
                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1.5">
                    Código <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="formulario.codigo"
                    type="text"
                    :disabled="modoEdicion"
                    required
                    maxlength="20"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 disabled:cursor-not-allowed uppercase text-sm"
                    placeholder="Ej: MIC"
                  />
                </div>

                <!-- Unidad -->
                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1.5">Unidad</label>
                  <input
                    v-model="formulario.unidad"
                    type="text"
                    maxlength="20"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    placeholder="%, g/tex, mm"
                  />
                </div>

                <!-- Tipo de Dato -->
                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1.5">
                    Tipo de Dato <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="formulario.tipo_dato"
                    required
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  >
                    <option value="decimal">Decimal</option>
                    <option value="entero">Entero</option>
                  </select>
                </div>

                <!-- Decimales -->
                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1.5">Decimales</label>
                  <input
                    v-model.number="formulario.decimales"
                    type="number"
                    min="0"
                    max="4"
                    :disabled="formulario.tipo_dato === 'entero'"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-100 text-sm"
                  />
                </div>
              </div>

              <!-- Fila 2: Nombre y Grupo -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1.5">
                    Nombre <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="formulario.nombre"
                    type="text"
                    required
                    maxlength="100"
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                    placeholder="Ej: Micronaire"
                  />
                </div>

                <div>
                  <label class="block text-sm font-semibold text-slate-700 mb-1.5">
                    Grupo <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="formulario.grupo"
                    required
                    class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                  >
                    <option value="">Selecciona un grupo...</option>
                    <option v-for="grupo in gruposDisponibles" :key="grupo" :value="grupo">
                      {{ grupo }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- Fila 3: Descripción -->
              <div>
                <label class="block text-sm font-semibold text-slate-700 mb-1.5">Descripción</label>
                <textarea
                  v-model="formulario.descripcion"
                  rows="3"
                  class="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm resize-none"
                  placeholder="Descripción técnica de la variable..."
                ></textarea>
              </div>

              <!-- Rangos de Calidad -->
              <div class="space-y-4">
                <h3 class="text-base font-bold text-slate-800 border-b border-slate-200 pb-2">Rangos de Calidad</h3>

                <!-- Rango Óptimo -->
                <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                  <div class="flex items-center gap-2 mb-3">
                    <div class="w-3 h-3 bg-emerald-500 rounded-full"></div>
                    <h4 class="text-sm font-bold text-emerald-800">Rango Óptimo</h4>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Mínimo</label>
                      <input
                        v-model="formulario.optimo_min"
                        type="number"
                        step="0.01"
                        class="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Máximo</label>
                      <input
                        v-model="formulario.optimo_max"
                        type="number"
                        step="0.01"
                        class="w-full px-3 py-2 border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <!-- Rango Aceptable -->
                <div class="bg-amber-50 rounded-xl p-4 border border-amber-200">
                  <div class="flex items-center gap-2 mb-3">
                    <div class="w-3 h-3 bg-amber-500 rounded-full"></div>
                    <h4 class="text-sm font-bold text-amber-800">Rango Aceptable</h4>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Mínimo</label>
                      <input
                        v-model="formulario.aceptable_min"
                        type="number"
                        step="0.01"
                        class="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Máximo</label>
                      <input
                        v-model="formulario.aceptable_max"
                        type="number"
                        step="0.01"
                        class="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>

                <!-- Rango Crítico -->
                <div class="bg-red-50 rounded-xl p-4 border border-red-200">
                  <div class="flex items-center gap-2 mb-3">
                    <div class="w-3 h-3 bg-red-500 rounded-full"></div>
                    <h4 class="text-sm font-bold text-red-800">Rango Crítico</h4>
                  </div>
                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Mínimo</label>
                      <input
                        v-model="formulario.critico_min"
                        type="number"
                        step="0.01"
                        class="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-semibold text-slate-700 mb-1">Máximo</label>
                      <input
                        v-model="formulario.critico_max"
                        type="number"
                        step="0.01"
                        class="w-full px-3 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Estado -->
              <div class="flex items-center gap-3">
                <input
                  v-model="formulario.activo"
                  type="checkbox"
                  id="activo"
                  class="w-4 h-4 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500"
                />
                <label for="activo" class="text-sm font-semibold text-slate-700">Parámetro activo</label>
              </div>
            </form>
          </div>

          <!-- Footer del Modal -->
          <div class="bg-slate-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
            <button
              @click="cerrarModal"
              type="button"
              class="px-5 py-2.5 border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-100 transition-colors font-medium"
            >
              Cancelar
            </button>
            <button
              @click="guardarParametro"
              :disabled="guardando"
              class="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
            >
              <span v-if="guardando" class="animate-spin">⏳</span>
              <span>{{ guardando ? 'Guardando...' : 'Guardar' }}</span>
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// Estado
const parametros = ref([])
const cargando = ref(false)
const modalAbierto = ref(false)
const modoEdicion = ref(false)
const guardando = ref(false)

// Formulario
const formularioVacio = {
  codigo: '',
  nombre: '',
  descripcion: '',
  grupo: '',
  unidad: '',
  tipo_dato: 'decimal',
  decimales: 2,
  optimo_min: null,
  optimo_max: null,
  aceptable_min: null,
  aceptable_max: null,
  critico_min: null,
  critico_max: null,
  activo: true
}

// Grupos disponibles
const gruposDisponibles = [
  'Índices Generales',
  'Finura y Madurez',
  'Longitud',
  'Resistencia',
  'Color',
  'Contaminación'
]

const formulario = ref({ ...formularioVacio })
const parametroEditando = ref(null)

// Agrupar parámetros por grupo
const parametrosAgrupados = computed(() => {
  const grupos = {}
  parametros.value.forEach(param => {
    const grupo = param.grupo || 'Sin Grupo'
    if (!grupos[grupo]) {
      grupos[grupo] = []
    }
    grupos[grupo].push(param)
  })
  return grupos
})

// Orden de grupos para visualización
const ordenGrupos = [
  'Índices Generales',
  'Finura y Madurez',
  'Longitud',
  'Resistencia',
  'Color',
  'Contaminación',
  'Sin Grupo'
]

// Cargar parámetros
async function cargarParametros() {
  cargando.value = true
  try {
    const response = await fetch(`${API_URL}/parametros-hvi`)
    const data = await response.json()
    
    if (data.success) {
      parametros.value = data.parametros
    } else {
      console.error('Error cargando parámetros:', data.error)
      alert('Error al cargar parámetros HVI')
    }
  } catch (error) {
    console.error('Error:', error)
    alert('Error de conexión al cargar parámetros')
  } finally {
    cargando.value = false
  }
}

// Abrir modal para crear
function abrirModalCrear() {
  modoEdicion.value = false
  parametroEditando.value = null
  formulario.value = { ...formularioVacio }
  modalAbierto.value = true
}

// Abrir modal para editar
function abrirModalEditar(param) {
  modoEdicion.value = true
  parametroEditando.value = param
  formulario.value = {
    codigo: param.codigo,
    nombre: param.nombre,
    descripcion: param.descripcion || '',
    grupo: param.grupo || '',
    unidad: param.unidad || '',
    tipo_dato: param.tipo_dato,
    decimales: param.decimales,
    optimo_min: param.optimo_min,
    optimo_max: param.optimo_max,
    aceptable_min: param.aceptable_min,
    aceptable_max: param.aceptable_max,
    critico_min: param.critico_min,
    critico_max: param.critico_max,
    activo: param.activo
  }
  modalAbierto.value = true
}

// Cerrar modal
function cerrarModal() {
  modalAbierto.value = false
  setTimeout(() => {
    formulario.value = { ...formularioVacio }
    parametroEditando.value = null
    modoEdicion.value = false
  }, 300)
}

// Guardar parámetro
async function guardarParametro() {
  guardando.value = true
  try {
    // Convertir strings vacíos a null para valores numéricos
    const datos = {
      ...formulario.value,
      optimo_min: formulario.value.optimo_min === '' ? null : parseFloat(formulario.value.optimo_min),
      optimo_max: formulario.value.optimo_max === '' ? null : parseFloat(formulario.value.optimo_max),
      aceptable_min: formulario.value.aceptable_min === '' ? null : parseFloat(formulario.value.aceptable_min),
      aceptable_max: formulario.value.aceptable_max === '' ? null : parseFloat(formulario.value.aceptable_max),
      critico_min: formulario.value.critico_min === '' ? null : parseFloat(formulario.value.critico_min),
      critico_max: formulario.value.critico_max === '' ? null : parseFloat(formulario.value.critico_max)
    }

    const url = modoEdicion.value 
      ? `${API_URL}/parametros-hvi/${parametroEditando.value.id}`
      : `${API_URL}/parametros-hvi`
    
    const method = modoEdicion.value ? 'PUT' : 'POST'
    
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    })
    
    const data = await response.json()
    
    if (data.success) {
      alert(data.message)
      cerrarModal()
      await cargarParametros()
    } else {
      alert('Error: ' + data.error)
    }
  } catch (error) {
    console.error('Error:', error)
    alert('Error de conexión al guardar parámetro')
  } finally {
    guardando.value = false
  }
}

// Eliminar parámetro
async function eliminarParametro(param) {
  if (!confirm(`¿Estás seguro de eliminar el parámetro ${param.codigo} - ${param.nombre}?`)) {
    return
  }

  try {
    const response = await fetch(`${API_URL}/parametros-hvi/${param.id}`, {
      method: 'DELETE'
    })
    
    const data = await response.json()
    
    if (data.success) {
      alert(data.message)
      await cargarParametros()
    } else {
      alert('Error: ' + data.error)
    }
  } catch (error) {
    console.error('Error:', error)
    alert('Error de conexión al eliminar parámetro')
  }
}

// Formatear rango para mostrar
function formatearRango(min, max, tipoDato, decimales) {
  const formatear = (val) => {
    if (val === null || val === undefined) return null
    return tipoDato === 'entero' ? Math.round(val) : parseFloat(val).toFixed(decimales)
  }

  const minStr = formatear(min)
  const maxStr = formatear(max)

  if (minStr !== null && maxStr !== null) {
    return `${minStr} - ${maxStr}`
  } else if (minStr !== null) {
    return `≥ ${minStr}`
  } else if (maxStr !== null) {
    return `≤ ${maxStr}`
  }
  return 'No especificado'
}

// Lifecycle
onMounted(() => {
  cargarParametros()
})
</script>

<style scoped>
/* Transición del modal */
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from, .modal-leave-to {
  opacity: 0;
}

.modal-enter-active > div,
.modal-leave-active > div {
  transition: transform 0.3s ease;
}

.modal-enter-from > div,
.modal-leave-to > div {
  transform: scale(0.95);
}

/* Line clamp */
.line-clamp-3 {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>