<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="cerrar"></div>
      
      <!-- Modal Container -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        <!-- Header -->
        <div class="px-6 py-2 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <span class="text-lg">🔄</span>
            </div>
            <div>
              <h2 class="text-lg font-bold text-slate-800">Actualizar Datos de Residuos</h2>
              <p class="text-[10px] text-slate-500 font-medium">Sincronización con archivos CSV de origen</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="fetchStatus" 
              class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors"
              title="Refrescar estado"
              :disabled="loading || importing"
            >
              <span :class="{ 'animate-spin inline-block': loading }">↻</span>
            </button>
            <button @click="cerrar" class="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-auto p-4">
          <!-- Alerta de estado -->
          <div v-if="outdatedCount > 0" class="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
            <span class="text-lg">⚠️</span>
            <div class="flex-1">
              <h3 class="text-xs font-bold text-amber-800">Archivos desactualizados detectados</h3>
              <p class="text-[10px] text-amber-700 mt-0.5">Hay {{ outdatedCount }} archivo(s) con cambios recientes que no han sido importados.</p>
            </div>
            <button 
              @click="triggerUpdate" 
              class="px-3 py-1.5 bg-amber-600 text-white text-[10px] font-bold rounded-lg hover:bg-amber-700 transition-colors shadow-sm flex items-center gap-2"
              :disabled="importing"
            >
              <span v-if="importing" class="animate-spin">⚙️</span>
              <span v-else>🚀</span>
              Actualizar Todo
            </button>
          </div>

          <!-- Tabla de archivos -->
          <div class="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
            <table class="w-full text-sm text-left">
              <thead class="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th class="px-4 py-1.5">Archivo Origen</th>
                  <th class="px-4 py-1.5 text-center">Estado</th>
                  <th class="px-4 py-1.5">Última Modif.</th>
                  <th class="px-4 py-1.5">Última Import.</th>
                  <th class="px-4 py-1.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="item in filteredStatusList" :key="item.table" class="hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-1.5">
                    <div class="font-medium text-slate-800 text-xs">{{ getFileName(item.file) }}</div>
                    <div class="text-[9px] text-slate-400 uppercase tracking-wider">Hoja: {{ item.sheet }}</div>
                  </td>
                  <td class="px-4 py-1.5 text-center">
                    <div v-if="importing && currentImportTable === item.table" class="space-y-1">
                      <div class="flex items-center justify-center gap-1.5 text-blue-600 font-bold text-[9px]">
                        <span class="animate-spin">⚙️</span>
                        <span>IMPORTANDO...</span>
                      </div>
                      <div class="w-full bg-slate-100 rounded-full h-1 overflow-hidden border border-slate-200">
                        <div class="bg-blue-500 h-full rounded-full animate-pulse" style="width: 100%"></div>
                      </div>
                    </div>
                    <span v-else :class="getStatusClass(item.status)" class="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-tighter">
                      {{ getStatusLabel(item.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-1.5 text-[10px] text-slate-500">
                    {{ formatDate(item.file_modified) }}
                  </td>
                  <td class="px-4 py-1.5 text-[10px] text-slate-500">
                    {{ formatDate(item.last_import_date) }}
                  </td>
                  <td class="px-4 py-1.5 text-right">
                    <button 
                      @click="forceImport(item)" 
                      class="px-2 py-1 bg-orange-50 text-orange-600 hover:bg-orange-600 hover:text-white rounded-lg text-[9px] font-bold transition-all border border-orange-200 flex items-center gap-1 ml-auto disabled:opacity-50"
                      :disabled="importing || loading"
                    >
                      <span>⚡</span>
                      Forzar
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-2 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
          <div class="text-[9px] text-slate-400 font-medium">
            Carpeta de origen: <span class="text-slate-600">{{ csvFolder }}</span>
          </div>
          <button 
            @click="cerrar" 
            class="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors text-xs"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import Swal from 'sweetalert2'

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close', 'updated'])

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = API_BASE ? `${API_BASE}/api` : '/api'
const loading = ref(false)
const importing = ref(false)
const statusList = ref([])
const currentImportTable = ref(null)
const csvFolder = ref(localStorage.getItem('csvFolder') || 'C:\\STC')

// Tablas requeridas para el informe de residuos
const REQUIRED_TABLES = [
  'tb_FICHAS',
  'tb_RESIDUOS_INDIGO',
  'tb_RESIDUOS_POR_SECTOR',
  'tb_PARADAS',
  'tb_PRODUCCION',
  'tb_CALIDAD'
]

const filteredStatusList = computed(() => {
  return statusList.value.filter(item => REQUIRED_TABLES.includes(item.table))
    .sort((a, b) => REQUIRED_TABLES.indexOf(a.table) - REQUIRED_TABLES.indexOf(b.table))
})

const outdatedCount = computed(() => {
  return filteredStatusList.value.filter(item => 
    item.status === 'OUTDATED' || item.status === 'NOT_IMPORTED' || item.status === 'MISSING_FILE'
  ).length
})

const fetchStatus = async () => {
  loading.value = true
  try {
    const folderParam = csvFolder.value ? `?csvFolder=${encodeURIComponent(csvFolder.value)}` : ''
    const resp = await fetch(`${API_URL}/import-status${folderParam}`)
    if (!resp.ok) throw new Error('Error al obtener estado')
    statusList.value = await resp.json()
  } catch (error) {
    console.error('Error:', error)
  } finally {
    loading.value = false
  }
}

const triggerUpdate = async () => {
  const outdatedTables = filteredStatusList.value
    .filter(item => item.status === 'OUTDATED' || item.status === 'NOT_IMPORTED' || item.status === 'MISSING_FILE')
    .map(item => item.table)

  if (outdatedTables.length === 0) return

  importing.value = true
  const t0 = performance.now()
  
  try {
    // Simular progreso secuencial para la UI
    currentImportTable.value = outdatedTables[0]
    
    const resp = await fetch(`${API_URL}/import/update-outdated`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        tables: outdatedTables,
        csvFolder: csvFolder.value
      })
    })

    if (!resp.ok) throw new Error('Error en la actualización')
    
    const data = await resp.json()
    if (data.success) {
      const elapsedUI = Math.round(performance.now() - t0)
      const secondsUI = (elapsedUI / 1000).toFixed(2)
      const secondsServer = (data.timings?.totalMs / 1000).toFixed(2)

      await fetchStatus()
      
      Swal.fire({
        icon: 'success',
        title: '✓ Actualización Completa',
        html: `
          <div style="text-align: left; padding: 10px;">
            <div style="font-size: 1.1em; margin-bottom: 15px;">
              <strong>${outdatedTables.length} tabla(s)</strong> actualizadas correctamente.
            </div>
            <div style="background: #f3f4f6; padding: 12px; border-radius: 8px; font-family: monospace;">
              <div style="margin-bottom: 8px;">
                <span style="color: #059669; font-weight: bold;">⏱️ Servidor:</span> 
                <span style="font-size: 1.2em; font-weight: bold;">${secondsServer}s</span>
              </div>
              <div>
                <span style="color: #3b82f6; font-weight: bold;">🖥️ UI:</span> 
                <span style="font-size: 1.2em; font-weight: bold;">${secondsUI}s</span>
              </div>
            </div>
          </div>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#059669'
      })
      emit('updated')
    }
  } catch (error) {
    console.error('Error:', error)
    Swal.fire('Error', 'No se pudo completar la actualización', 'error')
  } finally {
    importing.value = false
    currentImportTable.value = null
  }
}

const forceImport = async (item) => {
  const result = await Swal.fire({
    title: `¿Forzar importación?`,
    text: `Se re-importará la tabla ${item.table} desde el archivo CSV.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ea580c',
    confirmButtonText: 'Sí, forzar',
    cancelButtonText: 'Cancelar'
  })

  if (!result.isConfirmed) return

  importing.value = true
  currentImportTable.value = item.table
  const t0 = performance.now()

  try {
    const resp = await fetch(`${API_URL}/import/force-table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        table: item.table,
        csvFolder: csvFolder.value
      })
    })

    if (!resp.ok) throw new Error('Error en la importación')
    
    const data = await resp.json()
    if (data.success) {
      const elapsed = Math.round(performance.now() - t0)
      const seconds = (elapsed / 1000).toFixed(2)

      await fetchStatus()
      
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: `${item.table} actualizada`,
        text: `${data.rows?.toLocaleString() || 0} filas • ${seconds}s`,
        showConfirmButton: false,
        timer: 3000
      })
      emit('updated')
    }
  } catch (error) {
    console.error('Error:', error)
    Swal.fire('Error', 'No se pudo completar la importación', 'error')
  } finally {
    importing.value = false
    currentImportTable.value = null
  }
}

const cerrar = () => {
  if (importing.value) return
  emit('close')
}

const getFileName = (path) => {
  if (!path) return '-'
  return path.split('\\').pop().split('/').pop()
}

const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getStatusLabel = (status) => {
  switch (status) {
    case 'UP_TO_DATE': return 'Actualizado'
    case 'OUTDATED': return 'Desactualizado'
    case 'NOT_IMPORTED': return 'Pendiente'
    case 'MISSING_FILE': return 'No encontrado'
    default: return status
  }
}

const getStatusClass = (status) => {
  switch (status) {
    case 'UP_TO_DATE': return 'bg-green-100 text-green-700'
    case 'OUTDATED': return 'bg-amber-100 text-amber-700'
    case 'NOT_IMPORTED': return 'bg-blue-100 text-blue-700'
    case 'MISSING_FILE': return 'bg-red-100 text-red-700'
    default: return 'bg-slate-100 text-slate-700'
  }
}

watch(() => props.show, (newVal) => {
  if (newVal) {
    fetchStatus()
  }
})

onMounted(() => {
  if (props.show) fetchStatus()
})
</script>

<style scoped>
.modal-enter-active, .modal-leave-active {
  transition: opacity 0.3s ease;
}
.modal-enter-from, .modal-leave-to {
  opacity: 0;
}
</style>
