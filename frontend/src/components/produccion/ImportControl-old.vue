<template>
  <div class="w-full h-screen flex flex-col p-1">
    <main class="w-full flex-1 min-h-0 bg-white rounded-2xl shadow-xl px-4 py-3 border border-slate-200 flex flex-col">
      <div class="flex justify-between items-center mb-4 gap-4">
        <div class="flex items-center gap-4 flex-1 min-w-0">
          <h1 class="text-2xl font-bold text-gray-800 whitespace-nowrap">Control de Importaciones</h1>
          
          <!-- Configuración de Carpeta CSV (Compacta) -->
          <div class="flex items-center gap-2 flex-1 max-w-2xl bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
            <label class="text-xs font-bold text-gray-500 whitespace-nowrap uppercase tracking-wide">Carpeta CSV:</label>
            <input 
              v-model="csvFolder" 
              type="text" 
              class="flex-1 bg-transparent border-none text-sm focus:ring-0 p-0 text-gray-700 placeholder-gray-400"
              placeholder="Seleccione carpeta..."
              @change="saveFolder"
              @keyup.enter="saveFolder"
            />
            <button 
              @click="pickFolder" 
              class="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
              title="Examinar carpeta..."
            >
              📂
            </button>
          </div>
        </div>

        <div class="flex gap-2 shrink-0">
          <button 
            @click="fetchStatus" 
            class="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="loading || importing"
          >
            <span v-if="loading" class="animate-spin">↻</span>
            <span v-else>↻</span>
            Refrescar
          </button>
          <button 
            @click="triggerImport" 
            class="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 transition-colors text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="importing || loading"
          >
            <span>🚀</span>
            Actualizar
          </button>
        </div>
      </div>

    <!-- Resumen de Estado -->
    <div class="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
      <div class="bg-gray-50 px-3 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-600">Total Archivos:</div>
        <div class="text-lg font-bold text-gray-800">{{ statusList.length }}</div>
      </div>
      <div class="bg-gray-50 px-3 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-600">Actualizados:</div>
        <div class="text-lg font-bold text-green-600">{{ countStatus('UP_TO_DATE') }}</div>
      </div>
      <div class="bg-gray-50 px-3 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-600">Desactualizados:</div>
        <div class="text-lg font-bold text-yellow-600">{{ countStatus('OUTDATED') }}</div>
      </div>
      <div class="bg-gray-50 px-3 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-600">Faltantes / Error:</div>
        <div class="text-lg font-bold text-red-600">{{ countStatus('MISSING_FILE') + countStatus('NOT_IMPORTED') }}</div>
      </div>
      <div class="bg-gray-50 px-3 py-2 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-600">Tamaño DB:</div>
        <div class="text-lg font-bold text-purple-600">{{ dbInfo ? dbInfo.sizeMB + ' MB' : '-' }}</div>
      </div>
    </div>

    <!-- Tabla de Estado -->
    <div class="flex-1 min-h-0 overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200 table-fixed">
        <colgroup>
          <col style="width: 15%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
          <col style="width: 15%;">
          <col style="width: 10%;">
          <col style="width: 15%;">
        </colgroup>
        <thead class="bg-gray-50 sticky top-0 z-10">
          <tr>
              <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tabla Destino</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Archivo Origen</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Modif.</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Import.</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filas</th>
              <th scope="col" class="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-if="loading && statusList.length === 0">
              <td colspan="7" class="px-6 py-10 text-center text-gray-500">Cargando estado...</td>
            </tr>
            <tr v-else-if="statusList.length === 0">
              <td colspan="7" class="px-6 py-10 text-center text-gray-500">No hay configuraciones de importación disponibles.</td>
            </tr>
            <tr v-for="item in statusList" :key="item.table" class="hover:bg-gray-50 transition-colors">
              <td class="px-3 py-2 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">{{ item.table }}</div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <div class="text-sm text-gray-500" :title="item.file">{{ getFileName(item.file) }}</div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <!-- Estado: IMPORTING (actual en progreso) -->
                <div v-if="item.status === 'IMPORTING'" class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="animate-spin">⚙️</span>
                    <span class="text-sm font-medium text-blue-600">Importando...</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="bg-blue-400 h-2 rounded-full animate-pulse" style="width: 100%"></div>
                  </div>
                </div>
                
                <!-- Estado: COMPLETED (ya importada en este ciclo) -->
                <div v-else-if="item.status === 'COMPLETED'" class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span>✅</span>
                    <span class="text-sm font-medium text-green-600">Completada</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="bg-green-500 h-2 rounded-full" style="width: 100%"></div>
                  </div>
                </div>
                
                <!-- Estado: PENDING (en la cola esperando) -->
                <span v-else-if="item.status === 'PENDING'" 
                      class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  ⏳ Pendiente
                </span>
                
                <!-- Estado normal (cuando no está en proceso de importación masiva) -->
                <span v-else :class="getStatusClass(item.status)" class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ getStatusLabel(item.status) }}
                </span>
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(item.file_modified) }}
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                <div v-if="item.last_import_date">
                  {{ formatDate(item.last_import_date) }}
                </div>
                <div v-else class="text-gray-400">-</div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                {{ item.rows_imported !== null ? item.rows_imported.toLocaleString() : '-' }}
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-sm">
                <button 
                  @click="forceImportTable(item)" 
                  class="px-3 py-1 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-md text-xs font-medium transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  :disabled="importing || loading"
                >
                  <span v-if="importing && currentImportTable === item.table" class="animate-spin">⚙️</span>
                  <span v-else>⚡</span>
                  {{ importing && currentImportTable === item.table ? 'Procesando...' : 'Forzar' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    <!-- Log de Importación -->
    <div v-if="importOutput" class="mt-4 bg-gray-900 rounded-lg shadow-lg overflow-hidden">
      <div class="px-4 py-2 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
        <h3 class="text-sm font-mono text-gray-300">Log de Ejecución</h3>
        <button @click="importOutput = null" class="text-gray-400 hover:text-white">✕</button>
      </div>
      <pre class="p-4 text-xs font-mono text-green-400 overflow-auto max-h-96 whitespace-pre-wrap">{{ importOutput }}</pre>
    </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import Swal from 'sweetalert2'

const statusList = ref([])
const dbInfo = ref(null)
const loading = ref(false)
const importing = ref(false)
const importOutput = ref(null)
const currentImportTable = ref(null)
const forceAllRunning = ref(false)
const baselineImports = ref({})
const completedTables = ref(new Set())
const importQueue = ref(new Set())
let pollIntervalId = null

// Cambiar API_URL para apuntar al backend de stc-produccion-v2
const API_URL = 'http://localhost:3001/api/produccion'

const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 4000,
  timerProgressBar: true
})

const toastError = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 5000,
  timerProgressBar: true,
  icon: 'error'
})

const csvFolder = ref(localStorage.getItem('csvFolder') || 'C:\\STC')

// Abrir diálogo de selección de carpeta
async function pickFolder() {
  try {
    const res = await fetch(`${API_URL}/system/pick-folder`, { method: 'POST' })
    if (!res.ok) throw new Error('Error al abrir diálogo')
    
    const data = await res.json()
    if (data.path) {
      csvFolder.value = data.path
      saveFolder()
    }
  } catch (err) {
    console.error(err)
    toastError.fire({ title: 'No se pudo abrir el selector de carpetas' })
  }
}

// Guardar carpeta en localStorage y refrescar
const saveFolder = () => {
  if (!csvFolder.value) return
  csvFolder.value = csvFolder.value.replace(/\//g, '\\')
  localStorage.setItem('csvFolder', csvFolder.value)
  toast.fire({ icon: 'success', title: 'Carpeta guardada' })
  fetchStatus()
}

onMounted(() => {
  fetchStatus()
})

async function fetchStatus() {
  loading.value = true
  try {
    const folderParam = csvFolder.value ? `?csvFolder=${encodeURIComponent(csvFolder.value)}` : ''
    const resStatus = await fetch(`${API_URL}/import-status${folderParam}`)
    
    if (!resStatus.ok) throw new Error('Error al obtener estado de importación')
    const freshData = await resStatus.json()
    
    // Si está corriendo forceAllRunning o triggerImport, preservar estados visuales
    if (forceAllRunning.value && importing.value) {
      const completed = completedTables.value
      const current = currentImportTable.value
      const tablasEnCola = importQueue.value
      
      console.log('Polling actualización - Completadas:', [...completed], 'Actual:', current)
      
      statusList.value = freshData.map(item => {
        // Tabla actualmente en proceso
        if (item.table === current) {
          return { ...item, status: 'IMPORTING' }
        } 
        // Tabla ya completada en este ciclo
        else if (completed.has(item.table)) {
          return { ...item, status: 'COMPLETED' }
        } 
        // Tabla en cola esperando
        else if (tablasEnCola.has(item.table)) {
          return { ...item, status: 'PENDING' }
        }
        // Resto mantiene su estado original
        return item
      })
    } else {
      statusList.value = freshData
    }
    
    // Simular dbInfo (se implementará en backend)
    dbInfo.value = { sizeMB: '0.0' }
  } catch (err) {
    console.error(err)
    toastError.fire({ title: 'No se pudo conectar con el servidor de API' })
  } finally {
    loading.value = false
  }
}

async function triggerImport() {
  const outdatedTables = statusList.value.filter(item => 
    item.status === 'OUTDATED' || item.status === 'NOT_IMPORTED' || item.status === 'MISSING_FILE'
  )
  
  if (outdatedTables.length === 0) {
    Swal.fire({
      icon: 'info',
      title: 'Sin cambios',
      text: 'Todas las tablas están actualizadas',
      confirmButtonColor: '#3085d6'
    })
    return
  }

  const result = await Swal.fire({
    title: '¿Iniciar actualización?',
    html: `Se importarán <strong>${outdatedTables.length} tabla(s) desactualizada(s)</strong>:<br><br>${outdatedTables.map(t => `• ${t.table}`).join('<br>')}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Sí, actualizar'
  })

  if (result.isConfirmed) {
    console.log('🚀 Iniciando importación masiva...')
    importing.value = true
    importOutput.value = null
    
    // Preparar para seguimiento de progreso
    forceAllRunning.value = true
    importQueue.value = new Set(outdatedTables.map(t => t.table))
    
    console.log('📋 Tablas en cola:', [...importQueue.value])
    
    // Marcar todas como PENDING en la UI
    outdatedTables.forEach(item => { item.status = 'PENDING' })
    
    // Snapshot del estado actual para comparar cambios
    const snapshot = {}
    statusList.value.forEach(s => {
      snapshot[s.table] = {
        last: s.last_import_date,
        rows: s.rows_imported
      }
    })
    baselineImports.value = snapshot
    console.log('📸 Baseline guardado:', baselineImports.value)
    
    completedTables.value = new Set()
    currentImportTable.value = outdatedTables[0]?.table || null
    console.log('▶️ Primera tabla:', currentImportTable.value)
    
    // Iniciar polling para actualización visual
    startPolling()
    
    const t0 = performance.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 120000)

      const res = await fetch(`${API_URL}/import/update-outdated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tables: outdatedTables.map(t => t.table),
          csvFolder: csvFolder.value
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()
      
      console.log('✅ Respuesta del servidor:', data)
      
      // Detener polling y limpiar estados
      stopPolling()
      importing.value = false
      forceAllRunning.value = false
      completedTables.value = new Set()
      importQueue.value = new Set()
      currentImportTable.value = null

      if (data.success) {
        const elapsed = Math.round(performance.now() - t0)
        const seconds = (elapsed / 1000).toFixed(2)
        
        await fetchStatus()
        
        // Preparar resumen detallado de las tablas importadas
        const resultsDetails = data.results && data.results.length > 0
          ? data.results.map(r => 
              `<tr>
                <td style="padding:4px 8px;text-align:left;border-bottom:1px solid #e5e7eb">${r.table}</td>
                <td style="padding:4px 8px;text-align:right;border-bottom:1px solid #e5e7eb">${r.rows?.toLocaleString() || 0}</td>
                <td style="padding:4px 8px;text-align:center;border-bottom:1px solid #e5e7eb">${r.success ? '✅' : '❌'}</td>
              </tr>`
            ).join('')
          : ''
        
        const detailsTable = resultsDetails 
          ? `<div style="margin-top:16px;max-height:300px;overflow-y:auto;">
              <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                  <tr style="background:#f3f4f6;">
                    <th style="padding:6px 8px;text-align:left;">Tabla</th>
                    <th style="padding:6px 8px;text-align:right;">Filas</th>
                    <th style="padding:6px 8px;text-align:center;">Estado</th>
                  </tr>
                </thead>
                <tbody>${resultsDetails}</tbody>
              </table>
            </div>`
          : ''
        
        Swal.fire({
          icon: 'success',
          title: '✓ Actualización Completa',
          html: `<div style="text-align:left;">
                  <p style="margin:8px 0;"><strong>${outdatedTables.length} tabla(s)</strong> importadas en <strong>${seconds}s</strong></p>
                  ${detailsTable}
                </div>`,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#059669',
          width: '600px'
        })
      } else {
        // Mostrar detalles de los errores
        const failedTables = data.results?.filter(r => !r.success) || []
        const errorDetails = failedTables.map(t => `${t.table}: ${t.error}`).join('<br>')
        throw new Error(data.message || `Errores:<br>${errorDetails}`)
      }
    } catch (err) {
      stopPolling()
      importing.value = false
      forceAllRunning.value = false
      completedTables.value = new Set()
      importQueue.value = new Set()
      currentImportTable.value = null
      
      if (err.name === 'AbortError') {
        toast.fire({ icon: 'warning', title: 'Timeout', text: 'La actualización tomó demasiado tiempo' })
      } else {
        console.error(err)
        toastError.fire({ title: err.message || 'Falló la actualización' })
      }
    }
  }
}

function getFileName(path) {
  if (!path) return '-'
  return path.split('\\').pop().split('/').pop()
}

function countStatus(status) {
  return statusList.value.filter(i => i.status === status).length
}

function getStatusClass(status) {
  switch (status) {
    case 'UP_TO_DATE': return 'bg-green-100 text-green-800'
    case 'OUTDATED': return 'bg-yellow-100 text-yellow-800'
    case 'NOT_IMPORTED': return 'bg-blue-100 text-blue-800'
    case 'MISSING_FILE': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'UP_TO_DATE': return 'Actualizado'
    case 'OUTDATED': return 'Desactualizado'
    case 'NOT_IMPORTED': return 'Pendiente'
    case 'MISSING_FILE': return 'Archivo No Encontrado'
    default: return status
  }
}

async function forceImportTable(item) {
  const result = await Swal.fire({
    title: `¿Forzar ${item.table}?`,
    html: `Se re-importará la tabla <strong>${item.table}</strong> desde:<br><code>${getFileName(item.file)}</code>`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ea580c',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, forzar',
    cancelButtonText: 'Cancelar'
  })

  if (result.isConfirmed) {
    importing.value = true
    importOutput.value = null
    currentImportTable.value = item.table
    item.status = 'IMPORTING'
    
    const t0 = performance.now()
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 90000)
      
      const res = await fetch(`${API_URL}/import/force-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: item.table, csvFolder: csvFolder.value }),
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      
      const data = await res.json()
      
      if (data.success) {
        currentImportTable.value = null
        importing.value = false
        
        await fetchStatus()
        
        const elapsed = Math.round(performance.now() - t0)
        const seconds = (elapsed / 1000).toFixed(2)
        toast.fire({
          icon: 'success',
          title: `✓ ${item.table} importada`,
          text: `${data.rows?.toLocaleString() || 0} filas • ${seconds}s`,
          timer: 4000
        })
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
    } catch (err) {
      currentImportTable.value = null
      importing.value = false
      
      if (err.name === 'AbortError') {
        console.error('Timeout después de 90 segundos')
        await fetchStatus()
        toast.fire({ icon: 'warning', title: 'Timeout', text: 'La importación tomó demasiado tiempo (>90s)' })
      } else {
        console.error('Error en importación:', err)
        toastError.fire({ title: err.message || 'Falló la importación' })
      }
    }
  }
}

function formatDate(isoString) {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString()
}

function startPolling() {
  stopPolling()
  console.log('🔄 Iniciando polling de progreso (cada 1 segundo)')
  
  pollIntervalId = setInterval(async () => {
    if (!importing.value) {
      console.log('⏹ Polling detenido: importing = false')
      stopPolling()
      return
    }
    
    console.log('📊 Polling: Actualizando estado...')
    await fetchStatus()
    updateProgressPointers()
  }, 1000) // Aumentado de 500ms a 1s para reducir carga
}

function stopPolling() {
  if (pollIntervalId) {
    console.log('⏹ Polling detenido')
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
}

function updateProgressPointers() {
  if (!importing.value || !forceAllRunning.value) return
  
  console.log('updateProgressPointers llamado')
  
  // Detectar tablas completadas comparando con baseline
  const updatedSet = new Set(completedTables.value)
  let hasChanges = false
  
  statusList.value.forEach((item) => {
    const base = baselineImports.value[item.table]
    if (!base) return
    
    // Verificar si hubo cambios en la importación
    const dateChanged = base.last !== item.last_import_date
    const rowsChanged = base.rows !== item.rows_imported
    
    if (dateChanged || rowsChanged) {
      if (!updatedSet.has(item.table)) {
        console.log(`✅ Tabla completada detectada: ${item.table}`)
        console.log(`  Base: last=${base.last}, rows=${base.rows}`)
        console.log(`  Actual: last=${item.last_import_date}, rows=${item.rows_imported}`)
        hasChanges = true
      }
      updatedSet.add(item.table)
    }
  })
  
  if (hasChanges) {
    completedTables.value = updatedSet
  }
  
  // Determinar cuál es la tabla actual en proceso
  // Es la primera tabla en importQueue que NO está en completedTables
  const tablesInQueue = Array.from(importQueue.value)
  const nextTable = tablesInQueue.find((table) => !completedTables.value.has(table))
  
  if (nextTable !== currentImportTable.value) {
    console.log(`🔄 Tabla actual cambió: ${currentImportTable.value} → ${nextTable}`)
    currentImportTable.value = nextTable || null
  }
  
  // Si todas las tablas están completadas, detener el proceso
  if (!nextTable && completedTables.value.size === tablesInQueue.length) {
    console.log('✅ Todas las tablas completadas, deteniendo polling')
    stopPolling()
  }
}

function hasTableCompleted(table) {
  return completedTables.value.has(table)
}

</script>
