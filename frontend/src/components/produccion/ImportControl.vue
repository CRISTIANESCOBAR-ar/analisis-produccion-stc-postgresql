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
            @click="showHistoryModal = true" 
            class="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-1.5 transition-colors text-sm shadow-sm"
            title="Ver historial de cambios y sincronizaciones"
          >
            <span>📋</span>
            Historial
          </button>
          <button 
            @click="forceImportAll" 
            class="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-1.5 transition-colors text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="importing || loading"
          >
            <span>⚡</span>
            Forzar Todo
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

    <!-- Alertas de Columnas -->
    <div v-if="showColumnWarnings && columnWarnings.length > 0" class="mb-4 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
      <div class="flex items-start">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3 flex-1">
          <h3 class="text-sm font-medium text-yellow-800">
            Columnas pendientes de sincronización
          </h3>
          <div class="mt-2 text-sm text-yellow-700">
            <p class="mb-3">Se detectaron columnas nuevas en el CSV que aún no están en la base de datos. Usa el botón "Sincronizar Columnas" para agregarlas.</p>
            <div class="space-y-3 max-h-48 overflow-y-auto">
              <div v-for="warning in columnWarnings" :key="warning.id" class="bg-white p-3 rounded border border-yellow-200">
                <div class="flex items-center justify-between mb-2">
                  <span class="font-semibold text-gray-900">{{ warning.table }}</span>
                  <span class="text-xs text-gray-500">{{ formatDate(warning.timestamp) }}</span>
                </div>
                <div v-if="warning.extraColumns.length > 0" class="mb-2">
                  <span class="text-xs font-medium text-orange-700">⚠️ Columnas nuevas en CSV (pendientes):</span>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span v-for="col in warning.extraColumns" :key="col" class="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
                      {{ col }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-600 mt-1 italic">Estas columnas se ignoran hasta que las sincronices. Usa el botón debajo para agregarlas a PostgreSQL.</p>
                </div>
                <div v-if="warning.missingColumns.length > 0">
                  <span class="text-xs font-medium text-blue-700">ℹ️ Columnas en PostgreSQL no presentes en CSV:</span>
                  <div class="mt-1 flex flex-wrap gap-1">
                    <span v-for="col in warning.missingColumns" :key="col" class="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded">
                      {{ col }}
                    </span>
                  </div>
                  <p class="text-xs text-gray-600 mt-1 italic">Normal: PostgreSQL las rellena con NULL automáticamente. No requiere acción.</p>
                </div>
              </div>
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <button @click="dismissColumnWarnings" class="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline">
              Ocultar
            </button>
            <button @click="openSyncModal" class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm">
              🔄 Sincronizar Columnas
            </button>
            <button @click="showHistoryModal = true" class="text-sm font-medium text-yellow-800 hover:text-yellow-900 underline">
              Ver historial completo
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Sincronización -->
    <div v-if="showSyncModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600">
          <h3 class="text-xl font-bold text-white flex items-center gap-2">
            <span>🔄</span>
            Sincronizar Columnas de CSV a PostgreSQL
          </h3>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <div v-if="!syncInProgress && !syncResult" class="space-y-4">
            <!-- Información general -->
            <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-lg">
              <div class="flex items-start">
                <svg class="h-5 w-5 text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/>
                </svg>
                <div class="ml-3 text-sm text-blue-700">
                  <p class="font-medium mb-1">Se agregarán columnas nuevas del CSV a la base de datos PostgreSQL</p>
                  <p>Las columnas se crearán como tipo TEXT y los registros existentes tendrán valores NULL.</p>
                </div>
              </div>
            </div>

            <!-- Tablas afectadas -->
            <div class="space-y-3">
              <h4 class="font-semibold text-gray-900">Tablas con columnas extra:</h4>
              <div class="space-y-2">
                <div v-for="warning in columnWarnings" :key="warning.id" class="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div class="flex items-center justify-between mb-3">
                    <span class="font-bold text-gray-900">{{ warning.table }}</span>
                    <span class="text-xs text-gray-500">{{ warning.extraColumns.length }} columna(s) nueva(s)</span>
                  </div>
                  <div class="flex flex-wrap gap-2">
                    <span v-for="col in warning.extraColumns" :key="col" class="inline-block bg-green-100 text-green-800 text-xs px-3 py-1 rounded-full font-medium">
                      + {{ col }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Opciones -->
            <div class="space-y-3 pt-4 border-t border-gray-200">
              <label class="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" v-model="syncOptions.reimport" class="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500">
                <div>
                  <span class="font-medium text-gray-900">Re-importar datos después de sincronizar</span>
                  <p class="text-sm text-gray-600 mt-1">
                    Esto volverá a importar los datos desde el CSV para capturar los valores de las columnas nuevas en registros históricos.
                    <strong class="text-yellow-700">Recomendado si necesitas los datos históricos.</strong>
                  </p>
                </div>
              </label>
            </div>

            <!-- Warning de re-importación -->
            <div v-if="!syncOptions.reimport" class="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
              <div class="flex items-start">
                <svg class="h-5 w-5 text-yellow-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                </svg>
                <div class="ml-3 text-sm text-yellow-700">
                  <p class="font-medium">Las columnas nuevas tendrán NULL en registros existentes</p>
                  <p class="mt-1">Podrás re-importar manualmente más tarde si necesitas capturar datos históricos.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Progreso -->
          <div v-if="syncInProgress" class="flex flex-col items-center justify-center py-12">
            <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mb-4"></div>
            <p class="text-lg font-medium text-gray-900">{{ syncProgressMessage }}</p>
            <p class="text-sm text-gray-600 mt-2">Esto puede tomar unos momentos...</p>
          </div>

          <!-- Resultado -->
          <div v-if="syncResult" class="space-y-4">
            <div v-if="syncResult.success" class="bg-green-50 border-l-4 border-green-400 p-4 rounded-r-lg">
              <div class="flex items-start">
                <svg class="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <div class="ml-3">
                  <p class="text-lg font-bold text-green-800">¡Sincronización completada!</p>
                  <p class="text-sm text-green-700 mt-1">{{ syncResult.message }}</p>
                </div>
              </div>
            </div>

            <div v-else class="bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
              <div class="flex items-start">
                <svg class="h-6 w-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <div class="ml-3">
                  <p class="text-lg font-bold text-red-800">Error en la sincronización</p>
                  <p class="text-sm text-red-700 mt-1">{{ syncResult.error || 'Error desconocido' }}</p>
                </div>
              </div>
            </div>

            <!-- Detalles del resultado -->
            <div v-if="syncResult.success && syncResult.addedColumns" class="border border-gray-200 rounded-lg p-4">
              <h5 class="font-semibold text-gray-900 mb-3">Columnas agregadas:</h5>
              <div class="flex flex-wrap gap-2">
                <span v-for="col in syncResult.addedColumns" :key="col" class="inline-block bg-blue-100 text-blue-800 text-sm px-3 py-1 rounded-full">
                  {{ col }}
                </span>
              </div>
            </div>

            <!-- Re-importación resultado -->
            <div v-if="syncResult.reimportResult" class="border border-gray-200 rounded-lg p-4">
              <div v-if="syncResult.reimportResult.success" class="flex items-center gap-2 text-green-700">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
                <span class="font-semibold">Datos re-importados correctamente</span>
              </div>
              <div v-else class="flex items-center gap-2 text-red-700">
                <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
                <span class="font-semibold">Error en la re-importación</span>
              </div>
            </div>

            <!-- Próximos pasos -->
            <div v-if="syncResult.success" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h5 class="font-semibold text-blue-900 mb-2">📋 Próximos pasos:</h5>
              <ul class="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li v-if="!syncOptions.reimport">Re-importa manualmente si necesitas datos históricos de las columnas nuevas</li>
                <li>Las próximas importaciones capturarán automáticamente los valores de las nuevas columnas</li>
                <li>Los warnings desaparecerán en la próxima importación</li>
                <li>Puedes ver el historial de cambios en el log de auditoría</li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button v-if="!syncInProgress && !syncResult" @click="closeSyncModal" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors">
            Cancelar
          </button>
          <button v-if="!syncInProgress && !syncResult" @click="applySyncColumns" class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            Aplicar Sincronización
          </button>
          <button v-if="syncResult" @click="closeSyncModalAndRefresh" class="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-sm">
            Cerrar y Refrescar
          </button>
        </div>
      </div>
    </div>

    <!-- Tabla de Estado -->
    <div class="flex-1 min-h-0 overflow-y-auto bg-white rounded-lg shadow-sm border border-gray-200">
      <table class="min-w-full divide-y divide-gray-200 table-fixed">
        <colgroup>
          <col style="width: 12%;">
          <col style="width: 14%;">
          <col style="width: 11%;">
          <col style="width: 13%;">
          <col style="width: 13%;">
          <col style="width: 8%;">
          <col style="width: 14%;">
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
                <div class="text-sm text-gray-500" :title="item.csv_file">{{ getFileName(item.csv_file) }}</div>
                <div class="text-xs text-gray-400">Hoja: {{ item.xlsx_sheet || '-' }}</div>
              </td>
              <td class="px-3 py-2 whitespace-nowrap">
                <div v-if="importing && currentImportTable === item.table" class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="animate-spin">⚙️</span>
                    <span class="text-sm font-medium text-blue-600">Importando...</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="bg-blue-400 h-2 rounded-full animate-pulse" style="width: 100%"></div>
                  </div>
                </div>
                <div v-else-if="importing && forceAllRunning && hasTableCompleted(item.table)" class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span>✓</span>
                    <span class="text-sm font-medium text-green-600">Completado</span>
                  </div>
                  <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="bg-green-500 h-2 rounded-full" style="width: 100%"></div>
                  </div>
                </div>
                <span v-else :class="getStatusClass(item.status)" class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full">
                  {{ getStatusLabel(item.status) }}
                </span>
              </td>
              <td class="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(item.file_modified || item.xlsx_last_modified) }}
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

    <!-- Modal de Historial de Logs -->
    <div v-if="showHistoryModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div class="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-purple-600">
          <div class="flex items-center justify-between">
            <h3 class="text-xl font-bold text-white flex items-center gap-2">
              <span>📋</span>
              Historial de Cambios y Sincronizaciones
            </h3>
            <button @click="showHistoryModal = false" class="text-white hover:text-gray-200 text-2xl">
              ✕
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex border-b border-gray-200 bg-gray-50">
          <button 
            @click="historyTab = 'warnings'" 
            :class="historyTab === 'warnings' ? 'border-b-2 border-purple-500 text-purple-600 bg-white' : 'text-gray-600 hover:text-gray-900'"
            class="px-6 py-3 font-medium text-sm transition-colors"
          >
            ⚠️ Diferencias Detectadas
          </button>
          <button 
            @click="historyTab = 'changes'" 
            :class="historyTab === 'changes' ? 'border-b-2 border-purple-500 text-purple-600 bg-white' : 'text-gray-600 hover:text-gray-900'"
            class="px-6 py-3 font-medium text-sm transition-colors"
          >
            🔄 Sincronizaciones Aplicadas
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-6 py-4">
          <!-- Tab: Diferencias Detectadas -->
          <div v-if="historyTab === 'warnings'" class="space-y-3">
            <div v-if="loadingHistory" class="text-center py-8 text-gray-500">
              <span class="animate-spin text-2xl">↻</span>
              <p class="mt-2">Cargando historial...</p>
            </div>
            <div v-else-if="warningsHistory.length === 0" class="text-center py-8 text-gray-500">
              <span class="text-4xl">✓</span>
              <p class="mt-2">No hay diferencias registradas</p>
            </div>
            <div v-else class="space-y-2">
              <div v-for="warning in warningsHistory" :key="warning.id" class="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                <div class="flex items-center justify-between mb-3">
                  <span class="font-bold text-gray-900">{{ warning.table_name }}</span>
                  <span class="text-xs text-gray-500">{{ formatDate(warning.detected_at) }}</span>
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div v-if="warning.extra_columns && warning.extra_columns.length > 0">
                    <span class="text-xs font-medium text-orange-700">⚠️ Columnas EXTRA en CSV:</span>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <span v-for="col in warning.extra_columns" :key="col" class="inline-block bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded">
                        {{ col }}
                      </span>
                    </div>
                  </div>
                  <div v-if="warning.missing_columns && warning.missing_columns.length > 0">
                    <span class="text-xs font-medium text-red-700">⚠️ Columnas FALTANTES en CSV:</span>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <span v-for="col in warning.missing_columns" :key="col" class="inline-block bg-red-100 text-red-800 text-xs px-2 py-0.5 rounded">
                        {{ col }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab: Sincronizaciones Aplicadas -->
          <div v-if="historyTab === 'changes'" class="space-y-3">
            <div v-if="loadingHistory" class="text-center py-8 text-gray-500">
              <span class="animate-spin text-2xl">↻</span>
              <p class="mt-2">Cargando historial...</p>
            </div>
            <div v-else-if="changesHistory.length === 0" class="text-center py-8 text-gray-500">
              <span class="text-4xl">📝</span>
              <p class="mt-2">No hay sincronizaciones registradas</p>
            </div>
            <div v-else class="space-y-2">
              <div v-for="change in changesHistory" :key="change.id" class="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-colors">
                <div class="flex items-center justify-between mb-3">
                  <div>
                    <span class="font-bold text-gray-900">{{ change.table_name }}</span>
                    <span class="ml-2 text-xs text-gray-500">{{ change.change_type }}</span>
                  </div>
                  <span class="text-xs text-gray-500">{{ formatDate(change.applied_at) }}</span>
                </div>
                <div class="space-y-2">
                  <div class="bg-gray-50 rounded p-2">
                    <span class="text-xs font-medium text-gray-700">Columnas agregadas:</span>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <span v-for="col in change.columns_added" :key="col" class="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-medium">
                        + {{ col }}
                      </span>
                    </div>
                  </div>
                  <div v-if="change.reimported" class="text-xs text-blue-600 flex items-center gap-1">
                    <span>🔄</span>
                    <span>Datos re-importados después de sincronizar</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center">
          <div class="text-sm text-gray-600">
            <span v-if="historyTab === 'warnings'">Total: {{ warningsHistory.length }} registro(s)</span>
            <span v-else>Total: {{ changesHistory.length }} sincronización(es)</span>
          </div>
          <button 
            @click="showHistoryModal = false" 
            class="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
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

// API URL para PostgreSQL backend
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

const csvFolder = ref(localStorage.getItem('csvFolder') || 'C:\\STC\\CSV')
const columnWarnings = ref([])
const showColumnWarnings = ref(true)
const showSyncModal = ref(false)
const syncInProgress = ref(false)
const syncProgressMessage = ref('')
const syncResult = ref(null)
const syncOptions = ref({
  reimport: true
})

// Historial de logs
const showHistoryModal = ref(false)
const historyTab = ref('warnings')
const warningsHistory = ref([])
const changesHistory = ref([])
const loadingHistory = ref(false)

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
    toast.fire({ icon: 'info', title: 'Escribe la ruta de la carpeta manualmente' })
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
  fetchColumnWarnings()
})

async function fetchColumnWarnings() {
  try {
    const res = await fetch(`${API_URL}/import/column-warnings`)
    if (!res.ok) return
    const data = await res.json()
    if (data.warnings && data.warnings.length > 0) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      columnWarnings.value = data.warnings.filter(w => {
        const warnDate = new Date(w.timestamp)
        return warnDate > oneDayAgo && w.hasDifferences
      })
    }
  } catch (err) {
    console.error('Error al obtener warnings de columnas:', err)
  }
}

function dismissColumnWarnings() {
  showColumnWarnings.value = false
  columnWarnings.value = []
}

function openSyncModal() {
  showSyncModal.value = true
  syncResult.value = null
  syncInProgress.value = false
  syncOptions.value.reimport = true
}

function closeSyncModal() {
  showSyncModal.value = false
  syncResult.value = null
  syncInProgress.value = false
}

async function closeSyncModalAndRefresh() {
  closeSyncModal()
  await fetchStatus()
  await fetchColumnWarnings()
}

async function applySyncColumns() {
  syncInProgress.value = true
  syncProgressMessage.value = 'Sincronizando columnas...'

  try {
    const results = []
    
    for (const warning of columnWarnings.value) {
      syncProgressMessage.value = `Sincronizando ${warning.table}...`
      
      const response = await fetch(`${API_URL}/schema/sync-columns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table: warning.table,
          csvPath: warning.csvPath,
          reimport: syncOptions.value.reimport
        })
      })

      if (!response.ok) {
        throw new Error(`Error en ${warning.table}: ${response.statusText}`)
      }

      const data = await response.json()
      results.push({ table: warning.table, ...data })
    }

    const totalAdded = results.reduce((sum, r) => sum + (r.columnsAdded || 0), 0)
    const allColumns = results.flatMap(r => r.addedColumns || [])
    const hasErrors = results.some(r => r.errors && r.errors.length > 0)

    syncResult.value = {
      success: !hasErrors && totalAdded > 0,
      message: totalAdded > 0 
        ? `Se agregaron ${totalAdded} columna(s) en ${results.length} tabla(s)`
        : 'No se agregaron columnas nuevas',
      columnsAdded: totalAdded,
      addedColumns: allColumns,
      reimportResult: syncOptions.value.reimport ? {
        success: results.every(r => !r.reimportResult || r.reimportResult.success)
      } : null
    }

  } catch (err) {
    syncResult.value = {
      success: false,
      error: err.message || 'Error desconocido en la sincronización'
    }
    console.error('Error en sincronización:', err)
  } finally {
    syncInProgress.value = false
  }
}

async function fetchStatus() {
  loading.value = true
  try {
    const folderParam = csvFolder.value ? `?csvFolder=${encodeURIComponent(csvFolder.value)}` : ''
    const [resStatus, resDb] = await Promise.all([
      fetch(`${API_URL}/import-status${folderParam}`),
      fetch(`${API_URL}/status`)
    ])
    
    if (!resStatus.ok) throw new Error('Error al obtener estado de importación')
    const freshData = await resStatus.json()
    
    if (forceAllRunning.value) {
      const completed = completedTables.value
      const current = currentImportTable.value
      const tablasEnCola = importQueue.value
      
      statusList.value = freshData.map(item => {
        if (item.table === current) {
          item.status = 'IMPORTING'
        } else if (!completed.has(item.table) && tablasEnCola.has(item.table)) {
          item.status = 'PENDING'
        }
        return item
      })
    } else {
      statusList.value = freshData
    }
    
    if (resDb.ok) {
      dbInfo.value = await resDb.json()
    }

    if (importing.value) {
      updateProgressPointers()
    }
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
    importing.value = true
    importOutput.value = null
    forceAllRunning.value = true
    
    importQueue.value = new Set(outdatedTables.map(t => t.table))
    
    outdatedTables.forEach(item => {
      item.status = 'PENDING'
    })
    
    const snapshot = {}
    outdatedTables.forEach((s) => {
      snapshot[s.table] = {
        last: s.last_import_date,
        rows: s.rows_imported
      }
    })
    baselineImports.value = snapshot
    completedTables.value = new Set()
    currentImportTable.value = outdatedTables[0]?.table || null
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

      stopPolling()
      importing.value = false
      forceAllRunning.value = false
      completedTables.value = new Set()
      currentImportTable.value = null
      importQueue.value = new Set()

      if (data.success) {
        const elapsedUI = Math.round(performance.now() - t0)
        const elapsedServer = data?.timings?.totalMs || 0
        const secondsUI = (elapsedUI / 1000).toFixed(2)
        const secondsServer = (elapsedServer / 1000).toFixed(2)
        
        await fetchStatus()
        await fetchColumnWarnings()
        
        const dataRows = outdatedTables.reduce((sum, t) => {
          const updated = statusList.value.find(s => s.table === t.table)
          return sum + (updated?.rows_imported || 0)
        }, 0)
        
        Swal.fire({
          icon: 'success',
          title: '✓ Actualización Completa',
          html: `
            <div style="text-align: left; padding: 10px;">
              <div style="font-size: 1.1em; margin-bottom: 15px;">
                <strong>${outdatedTables.length} tabla(s)</strong> • <strong>${dataRows.toLocaleString()}</strong> registros importados
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
          confirmButtonColor: '#059669',
          allowOutsideClick: false
        })
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
    } catch (err) {
      stopPolling()
      importing.value = false
      forceAllRunning.value = false
      completedTables.value = new Set()
      currentImportTable.value = null
      importQueue.value = new Set()
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
    case 'PENDING': return 'bg-orange-100 text-orange-800'
    case 'IMPORTING': return 'bg-blue-100 text-blue-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'UP_TO_DATE': return 'Actualizado'
    case 'OUTDATED': return 'Desactualizado'
    case 'NOT_IMPORTED': return 'Pendiente'
    case 'MISSING_FILE': return 'Archivo No Encontrado'
    case 'ERROR_READING_FILE': return 'Error Lectura'
    case 'PENDING': return 'Pendiente'
    case 'IMPORTING': return 'Importando...'
    default: return status
  }
}

function hasTableCompleted(table) {
  return completedTables.value.has(table)
}

async function forceImportAll() {
  const result = await Swal.fire({
    title: '¿Forzar importación completa?',
    html: "Se re-importarán <strong>todas las tablas</strong>, incluso las marcadas como actualizadas.<br><br><em>Esto puede tomar varios minutos.</em>",
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ea580c',
    cancelButtonColor: '#6b7280',
    confirmButtonText: 'Sí, forzar todas',
    cancelButtonText: 'Cancelar'
  })

  if (result.isConfirmed) {
    importing.value = true
    importOutput.value = null
    forceAllRunning.value = true
    
    importQueue.value = new Set(statusList.value.map(s => s.table))
    
    statusList.value.forEach(item => {
      item.status = 'PENDING'
    })
    
    const snapshot = {}
    statusList.value.forEach((s) => {
      snapshot[s.table] = {
        last: s.last_import_date,
        rows: s.rows_imported
      }
    })
    baselineImports.value = snapshot
    completedTables.value = new Set()
    currentImportTable.value = statusList.value[0]?.table || null
    startPolling()
    const t0 = performance.now()

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 330000)

      const res = await fetch(`${API_URL}/import/force-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvFolder: csvFolder.value }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const data = await res.json()

      stopPolling()
      importing.value = false
      forceAllRunning.value = false
      completedTables.value = new Set()
      currentImportTable.value = null
      importQueue.value = new Set()

      if (data.success) {
        const elapsedUI = Math.round(performance.now() - t0)
        const elapsedServer = data?.timings?.totalMs || 0
        const secondsUI = (elapsedUI / 1000).toFixed(2)
        const secondsServer = (elapsedServer / 1000).toFixed(2)
        
        await fetchStatus().catch(err => console.error('Error refreshing status:', err))
        await fetchColumnWarnings()
        
        const tablesWithErrors = statusList.value.filter(s => 
          s.status === 'MISSING' || 
          s.status === 'ERRORED' || 
          s.last_import_date === 'Archivo No Encontrado' ||
          s.last_import_date === 'Error en importación'
        )
        
        const successfulTables = statusList.value.filter(s => 
          s.status !== 'MISSING' && 
          s.status !== 'ERRORED' && 
          s.last_import_date !== 'Archivo No Encontrado' &&
          s.last_import_date !== 'Error en importación'
        )
        
        const dataRows = successfulTables
          .filter(s => s.table !== 'tb_FICHAS')
          .reduce((sum, s) => sum + (s.rows_imported || 0), 0)
        
        const hasErrors = tablesWithErrors.length > 0
        const icon = hasErrors ? 'warning' : 'success'
        const title = hasErrors 
          ? '⚠️ Importación Completada con Advertencias' 
          : '✓ Importación Completa'
        
        let warningsHtml = ''
        if (hasErrors) {
          const errorList = tablesWithErrors.map(t => 
            `<li><strong>${t.table}</strong>: ${t.last_import_date || t.status}</li>`
          ).join('')
          warningsHtml = `
            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-top: 15px; border-radius: 4px; text-align: left;">
              <div style="font-weight: bold; color: #92400e; margin-bottom: 8px;">⚠️ Problemas detectados:</div>
              <ul style="margin: 0; padding-left: 20px; color: #78350f; font-size: 0.9em;">
                ${errorList}
              </ul>
            </div>
          `
        }
        
        await Swal.fire({
          icon: icon,
          title: title,
          html: `
            <div style="text-align: left; padding: 10px;">
              <div style="font-size: 1.1em; margin-bottom: 15px;">
                <strong>${successfulTables.length} tablas</strong> • <strong>${dataRows.toLocaleString()}</strong> registros importados
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
              ${warningsHtml}
            </div>
          `,
          confirmButtonText: 'Entendido',
          confirmButtonColor: hasErrors ? '#f59e0b' : '#059669',
          allowOutsideClick: false
        })
        
        await fetchStatus()
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
    } catch (err) {
      stopPolling()
      importing.value = false
      forceAllRunning.value = false
      completedTables.value = new Set()
      currentImportTable.value = null
      importQueue.value = new Set()
      if (err.name === 'AbortError') {
        toast.fire({ icon: 'warning', title: 'Timeout', text: 'La importación completa tomó demasiado tiempo' })
      } else {
        console.error(err)
        toastError.fire({ title: err.message || 'Falló la ejecución del script' })
      }
    }
  }
}

async function forceImportTable(item) {
  const result = await Swal.fire({
    title: `¿Forzar ${item.table}?`,
    html: `Se re-importará la tabla <strong>${item.table}</strong> desde:<br><code>${getFileName(item.csv_file)}</code>`,
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
    forceAllRunning.value = false
    
    item.status = 'IMPORTING'
    
    const t0 = performance.now()
    const initialTimestamp = item.last_import_date ?? null
    
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
        await fetchColumnWarnings()
        
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
        const updated = statusList.value.find(i => i.table === item.table)
        if (updated && updated.last_import_date && updated.last_import_date !== initialTimestamp) {
          toast.fire({
            icon: 'success',
            title: `${item.table} importada`,
            text: `${updated.rows_imported?.toLocaleString() || 0} filas (detectado por estado)`
          })
        } else {
          toast.fire({ icon: 'warning', title: 'Timeout', text: 'La importación tomó demasiado tiempo (>90s)' })
        }
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

// Funciones para cargar historiales
async function loadWarningsHistory() {
  loadingHistory.value = true
  try {
    const res = await fetch(`${API_URL}/import/warnings-history?limit=100`)
    if (!res.ok) throw new Error('Error al cargar historial de diferencias')
    const data = await res.json()
    warningsHistory.value = data.history || []
  } catch (err) {
    console.error('Error al cargar historial de warnings:', err)
    toastError.fire({ title: 'No se pudo cargar el historial de diferencias' })
    warningsHistory.value = []
  } finally {
    loadingHistory.value = false
  }
}

async function loadChangesHistory() {
  loadingHistory.value = true
  try {
    const res = await fetch(`${API_URL}/schema/changes-log?limit=100`)
    if (!res.ok) throw new Error('Error al cargar historial de sincronizaciones')
    const data = await res.json()
    changesHistory.value = data.changes || []
  } catch (err) {
    console.error('Error al cargar historial de cambios:', err)
    toastError.fire({ title: 'No se pudo cargar el historial de sincronizaciones' })
    changesHistory.value = []
  } finally {
    loadingHistory.value = false
  }
}

// Watch para cargar datos cuando cambia el tab o se abre el modal
watch(showHistoryModal, (newVal) => {
  if (newVal) {
    loadWarningsHistory()
    loadChangesHistory()
  }
})

watch(historyTab, (newTab) => {
  if (showHistoryModal.value) {
    if (newTab === 'warnings') {
      loadWarningsHistory()
    } else if (newTab === 'changes') {
      loadChangesHistory()
    }
  }
})

function startPolling() {
  stopPolling()
  pollIntervalId = setInterval(async () => {
    if (!importing.value) {
      stopPolling()
      return
    }
    await fetchStatus()
    updateProgressPointers()
  }, 500)
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
}

function updateProgressPointers() {
  if (!importing.value) return
  if (forceAllRunning.value) {
    const updatedSet = new Set(completedTables.value)
    statusList.value.forEach((s) => {
      const base = baselineImports.value[s.table]
      if (!base) return
      const changed = (base.last !== s.last_import_date) || (base.rows !== s.rows_imported)
      if (changed) {
        updatedSet.add(s.table)
      }
    })
    completedTables.value = updatedSet
    const tablesInBaseline = Object.keys(baselineImports.value)
    const next = tablesInBaseline.find((table) => !completedTables.value.has(table))
    currentImportTable.value = next || null
  } else {
    const next = statusList.value.find((s) => s.status !== 'UP_TO_DATE')
    currentImportTable.value = next ? next.table : null
  }
}
</script>
