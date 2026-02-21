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
        <div class="shrink-0">
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
        <div class="px-6 py-4 border-b border-gray-200 bg-linear-to-r from-blue-500 to-blue-600">
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
                {{ formatDate(item.csv_modified) }}
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
        <div class="px-6 py-4 border-b border-gray-200 bg-linear-to-r from-purple-500 to-purple-600">
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

// Estrategia despliegue (Podman/servidor): misma origin y rutas relativas.
// En dev, Vite proxyfía /api hacia el backend. Si se necesita, VITE_API_BASE.
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
const API_URL = `${API_BASE}/api/produccion`

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

const normalizeCsvFolder = (folder) => {
  const s = String(folder || '').trim()
  if (!s) return ''
  // Si parece ruta Windows (C:\...), normaliza a backslash.
  if (/^[A-Za-z]:[\\/]/.test(s)) return s.replace(/\//g, '\\')
  // En Linux/contendor mantener /data/csv
  return s
}

// En producción (build servido desde contenedor), por defecto NO forzamos rutas del host.
// Deja vacío para que el backend use CSV_FOLDER (env) y el volumen montado.
const storedCsvFolder = localStorage.getItem('csvFolder')
const csvFolder = ref(import.meta.env.PROD ? '' : (storedCsvFolder || 'C:\\STC\\CSV'))
const columnWarnings = ref([])
const showColumnWarnings = ref(true)
const showSyncModal = ref(false)
const syncInProgress = ref(false)
const syncProgressMessage = ref('')
const syncResult = ref(null)
const syncOptions = ref({
  reimport: true
})

// Resultados de importación (para modal de resumen)
const importResults = ref([])
let importSessionStart = null

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
  csvFolder.value = normalizeCsvFolder(csvFolder.value)

  if (!csvFolder.value) {
    localStorage.removeItem('csvFolder')
    toast.fire({ icon: 'success', title: 'Usando carpeta por defecto' })
  } else {
    localStorage.setItem('csvFolder', csvFolder.value)
    toast.fire({ icon: 'success', title: 'Carpeta guardada' })
  }

  fetchStatus()
  fetchColumnWarnings()
}

onMounted(() => {
  fetchStatus()
  fetchColumnWarnings()
})

async function fetchColumnWarnings() {
  try {
    const folderParam = csvFolder.value ? `?csvFolder=${encodeURIComponent(csvFolder.value)}` : ''
    const res = await fetch(`${API_URL}/import/column-warnings${folderParam}`)
    if (!res.ok) return
    const data = await res.json()
    if (data.warnings && data.warnings.length > 0) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      columnWarnings.value = data.warnings.filter(w => {
        const warnDate = new Date(w.timestamp)
        // Solo mostrar warning si hay columnas EXTRA en el CSV que faltan en la DB.
        // Si solo faltan columnas en el CSV (missingColumns), no es un warning accionable.
        return warnDate > oneDayAgo && w.extraColumns && w.extraColumns.length > 0
      })
      showColumnWarnings.value = columnWarnings.value.length > 0
    } else {
      columnWarnings.value = []
      showColumnWarnings.value = false
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

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Mostrar modal con resumen de importaciones
function showImportSummaryModal() {
  if (importResults.value.length === 0) return
  
  const totalTime = importSessionStart ? ((performance.now() - importSessionStart) / 1000).toFixed(2) : '0'
  const totalRows = importResults.value.reduce((sum, r) => sum + (r.rows || 0), 0)
  const successCount = importResults.value.filter(r => r.success).length
  const failCount = importResults.value.filter(r => !r.success).length
  
  // Construir tabla HTML
  let tableRows = ''
  importResults.value.forEach(result => {
    const statusIcon = result.success ? '✅' : '❌'
    const statusColor = result.success ? 'text-green-600' : 'text-red-600'
    const timeText = result.time ? `${result.time}s` : '-'
    const rowsText = result.rows ? result.rows.toLocaleString() : '-'
    const modeText = escapeHtml(result.mode || '-')
    const modeReasonText = escapeHtml(result.modeReason || '')
    const modeReasonHtml = modeReasonText
      ? `<span class="text-xs text-gray-500 ml-2">${modeReasonText}</span>`
      : ''
    
    tableRows += `
      <tr class="border-b hover:bg-gray-50">
        <td class="px-4 py-2 text-center ${statusColor}">${statusIcon}</td>
        <td class="px-4 py-2 font-mono text-sm whitespace-nowrap">${escapeHtml(result.table)}</td>
        <td class="px-4 py-2 text-right font-semibold whitespace-nowrap">${rowsText}</td>
        <td class="px-4 py-2 text-left whitespace-nowrap">
          <span class="font-mono text-xs">${modeText}</span>${modeReasonHtml}
        </td>
        <td class="px-4 py-2 text-right text-gray-600 whitespace-nowrap">${timeText}</td>
      </tr>
    `
  })
  
  Swal.fire({
    html: `
      <div class="text-left">
        <div class="flex items-center gap-3 mb-3 whitespace-nowrap">
          <div class="w-8 h-8 rounded-full flex items-center justify-center ${failCount > 0 ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}" aria-hidden="true">
            ${failCount > 0 ? '⚠️' : '✅'}
          </div>
          <div class="text-lg font-semibold text-gray-700">📊 Resumen de Importaciones</div>

          <div class="ml-auto flex items-center gap-5 text-sm">
            <div class="flex items-baseline gap-2">
              <span class="text-xs text-gray-600">Total Tablas</span>
              <span class="font-bold text-blue-600">${importResults.value.length}</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-xs text-gray-600">Total Registros</span>
              <span class="font-bold text-green-600">${totalRows.toLocaleString()}</span>
            </div>
            <div class="flex items-baseline gap-2">
              <span class="text-xs text-gray-600">Tiempo Total</span>
              <span class="font-bold text-purple-600">${totalTime}s</span>
            </div>
          </div>
        </div>
        
        ${failCount > 0 ? `
          <div class="bg-red-50 border-l-4 border-red-500 p-3 mb-3 rounded">
            <p class="text-sm text-red-700">⚠️ ${failCount} tabla(s) con errores</p>
          </div>
        ` : ''}
        
        <div id="import-summary-table-wrap" class="overflow-auto" style="overflow-x: auto;">
          <table class="w-full text-sm border-collapse" style="white-space: nowrap;">
            <thead class="bg-gray-100 sticky top-0">
              <tr>
                <th class="px-4 py-2 text-center">Estado</th>
                <th class="px-4 py-2 text-left">Tabla</th>
                <th class="px-4 py-2 text-right">Registros</th>
                <th class="px-4 py-2 text-left">Modo</th>
                <th class="px-4 py-2 text-right">Tiempo</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `,
    confirmButtonText: 'Cerrar',
    width: '95vw',
    heightAuto: false,
    customClass: {
      htmlContainer: 'text-left'
    },
    didOpen: () => {
      const popup = Swal.getPopup()
      if (!popup) return

      // Limita el alto al viewport, pero sin forzar altura fija
      popup.style.maxHeight = '92vh'
      popup.style.overflow = 'hidden'
      // Evita que el botón quede recortado al fondo
      const currentPaddingBottom = Number.parseFloat(getComputedStyle(popup).paddingBottom || '0')
      if (currentPaddingBottom < 16) popup.style.paddingBottom = '16px'

      const actionsEl = popup.querySelector('.swal2-actions')
      if (actionsEl) {
        actionsEl.style.marginTop = '12px'
        actionsEl.style.paddingBottom = '8px'
      }

      const tableWrap = popup.querySelector('#import-summary-table-wrap')
      if (!tableWrap) return

      // Calcula el alto disponible real para el scroll de la tabla
      requestAnimationFrame(() => {
        const maxPopupHeightPx = Math.floor(window.innerHeight * 0.92)
        const popupRect = popup.getBoundingClientRect()
        const tableRect = tableWrap.getBoundingClientRect()
        const actions = popup.querySelector('.swal2-actions')
        const actionsHeight = actions ? actions.getBoundingClientRect().height : 0
        const popupPaddingBottom = Number.parseFloat(getComputedStyle(popup).paddingBottom || '0')

        const tableTopWithinPopup = tableRect.top - popupRect.top
        const safetyPx = 8
        const availableForTablePx = Math.max(
          160,
          maxPopupHeightPx - tableTopWithinPopup - actionsHeight - popupPaddingBottom - safetyPx
        )

        tableWrap.style.maxHeight = `${availableForTablePx}px`
        tableWrap.style.overflowY = 'auto'
      })
    }
  })
  
  // Limpiar resultados después de mostrar
  importResults.value = []
  importSessionStart = null
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
    
    // Iniciar sesión de importación
    importSessionStart = performance.now()
    importResults.value = []
    
    // Configurar polling para ver progreso en tiempo real
    const outdatedTablesNames = outdatedTables.map(t => t.table);
    importQueue.value = new Set(outdatedTablesNames)
    completedTables.value = new Set()
    
    // Guardar baseline para detectar cambios
    const snapshot = {}
    outdatedTables.forEach((s) => {
      snapshot[s.table] = {
        last: s.last_import_date,
        rows: s.rows_imported
      }
    })
    baselineImports.value = snapshot
    
    // Marcar tablas como pendientes en la UI
    statusList.value.forEach(item => {
      if (outdatedTablesNames.includes(item.table)) {
        item.status = 'IMPORTING'
      }
    })
    
    // Establecer primera tabla como actual
    currentImportTable.value = outdatedTablesNames[0] || null
    
    // Iniciar polling para monitorear progreso
    startPolling()

    try {
      const controller = new AbortController()
      // 10 minutos timeout - suficiente para múltiples tablas grandes
      const timeoutId = setTimeout(() => controller.abort(), 600000)

      const res = await fetch(`${API_URL}/import/update-outdated`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          tables: outdatedTablesNames,
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
      importQueue.value = new Set()
      completedTables.value = new Set()
      currentImportTable.value = null
      baselineImports.value = {}

      if (data.success || (data.results && data.results.length > 0)) {
        // Registrar resultados usando la respuesta del backend
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach(result => {
            importResults.value.push({
              table: result.table,
              rows: result.rows || 0,
              time: result.time || '-',
              success: result.success,
              mode: result.mode || '-',
              modeReason: result.modeReason || ''
            })
          })
        }
        
        // Refrescar estado de las tablas
        await fetchStatus()
        await fetchColumnWarnings()
        
        // Mostrar modal con resumen
        showImportSummaryModal()
      } else {
        throw new Error(data.error || 'Error en la importación')
      }
    } catch (err) {
      stopPolling()
      importing.value = false
      importQueue.value = new Set()
      completedTables.value = new Set()
      currentImportTable.value = null
      baselineImports.value = {}
      
      if (err.name === 'AbortError') {
        toastError.fire({ 
          title: 'Timeout', 
          text: 'La actualización tomó más de 10 minutos. Verifica el estado de las tablas.' 
        })
      } else {
        console.error(err)
        toastError.fire({ title: err.message || 'Falló la actualización' })
      }
      
      // Refrescar estado incluso si falla
      await fetchStatus()
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
    importing.value = true
    importOutput.value = null
    forceAllRunning.value = true
    
    // Iniciar sesión de importación
    importSessionStart = performance.now()
    importResults.value = []
    
    // Configurar polling para ver progreso
    const allTablesNames = statusList.value.map(s => s.table);
    importQueue.value = new Set(allTablesNames)
    completedTables.value = new Set()
    
    // Guardar baseline para detectar cambios
    const snapshot = {}
    statusList.value.forEach((s) => {
      snapshot[s.table] = {
        last: s.last_import_date,
        rows: s.rows_imported
      }
    })
    baselineImports.value = snapshot
    
    // Marcar todas como importando en la UI
    statusList.value.forEach(item => {
      item.status = 'IMPORTING'
    })
    
    // Establecer primera tabla como actual
    currentImportTable.value = allTablesNames[0] || null
    
    // Iniciar polling para monitorear progreso
    startPolling()

    try {
      const controller = new AbortController()
      // 15 minutos para todas las tablas
      const timeoutId = setTimeout(() => controller.abort(), 900000)

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
      importQueue.value = new Set()
      completedTables.value = new Set()
      currentImportTable.value = null
      baselineImports.value = {}

      if (data.success || (data.results && data.results.length > 0)) {
        // Registrar resultados usando la respuesta del backend
        if (data.results && Array.isArray(data.results)) {
          data.results.forEach(result => {
            importResults.value.push({
              table: result.table,
              rows: result.rows || 0,
              time: result.time || '-',
              success: result.success,
              mode: result.mode || '-',
              modeReason: result.modeReason || ''
            })
          })
        }
        
        // Refrescar estado
        await fetchStatus()
        await fetchColumnWarnings()
        
        // Mostrar modal con resumen
        showImportSummaryModal()
      } else {
        throw new Error(data.error || 'Error en la importación')
      }
    } catch (err) {
      stopPolling()
      importing.value = false
      forceAllRunning.value = false
      importQueue.value = new Set()
      completedTables.value = new Set()
      currentImportTable.value = null
      baselineImports.value = {}
      
      if (err.name === 'AbortError') {
        toastError.fire({ 
          title: 'Timeout', 
          text: 'La importación tomó más de 15 minutos. Verifica el estado manualmente.' 
        })
      } else {
        console.error(err)
        toastError.fire({ title: err.message || 'Falló la importación' })
      }
      
      // Refrescar estado incluso si falla
      await fetchStatus()
    }
  }
}

async function forceImportTable(item) {
  const result = await Swal.fire({
    title: `¿Forzar ${item.table}?`,
    html: `
      Se re-importará la tabla <strong>${item.table}</strong> desde:<br>
      <code>${getFileName(item.csv_file)}</code><br><br>
      <small class="text-gray-500">⏱️ Esto puede tomar varios minutos para tablas grandes.</small>
    `,
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
    
    // Iniciar sesión de importación si no existe
    if (!importSessionStart) {
      importSessionStart = performance.now()
      importResults.value = []
    }
    
    item.status = 'IMPORTING'
    
    const t0 = performance.now()
    const initialTimestamp = item.last_import_date ?? null
    
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000)
      
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
        
        const elapsed = (performance.now() - t0) / 1000
        
        // Registrar resultado
        importResults.value.push({
          table: item.table,
          rows: data.rows || 0,
          time: elapsed.toFixed(2),
          success: true,
          mode: data.mode || '-',
          modeReason: data.modeReason || ''
        })
        
        // Mostrar modal con resumen
        showImportSummaryModal()
      } else {
        throw new Error(data.error || 'Error desconocido')
      }
    } catch (err) {
      currentImportTable.value = null
      importing.value = false
      
      if (err.name === 'AbortError') {
        console.log('⏱️ Timeout después de 5 minutos - Verificando si completó...')
        
        // Esperar un poco para que el backend registre en tb_sync_history
        await new Promise(resolve => setTimeout(resolve, 2000))
        await fetchStatus()
        
        const updated = statusList.value.find(i => i.table === item.table)
        console.log('Estado anterior:', { table: item.table, timestamp: initialTimestamp })
        console.log('Estado actualizado:', { 
          table: updated?.table, 
          timestamp: updated?.last_import_date,
          rows: updated?.rows_imported,
          status: updated?.status
        })
        
        // Verificar si completó comparando timestamps o estado UP_TO_DATE
        const timestampChanged = updated?.last_import_date && updated.last_import_date !== initialTimestamp
        const isUpToDate = updated?.status === 'UP_TO_DATE'
        
        if (timestampChanged || isUpToDate) {
          console.log('✅ Importación completada detectada')
          
          const elapsed = (performance.now() - t0) / 1000
          
          // Registrar resultado
          importResults.value.push({
            table: item.table,
            rows: updated.rows_imported || 0,
            time: elapsed.toFixed(2),
            success: true
          })
          
          // Mostrar modal con resumen
          showImportSummaryModal()
          
          // Actualizar el item con los datos nuevos
          Object.assign(item, updated)
        } else {
          console.log('⚠️ No se detectó cambio - puede estar ejecutándose aún')
          
          // Registrar como fallido
          importResults.value.push({
            table: item.table,
            rows: 0,
            time: '-',
            success: false
          })
          
          showImportSummaryModal()
          
          toast.fire({ 
            icon: 'warning', 
            title: 'Timeout de respuesta', 
            text: 'La importación puede seguir ejecutándose. Usa "Refrescar" para verificar.' 
          })
        }
      } else {
        console.error('Error en importación:', err)
        
        // Registrar como fallido
        importResults.value.push({
          table: item.table,
          rows: 0,
          time: '-',
          success: false
        })
        
        showImportSummaryModal()
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
  }, 2000) // Cada 2 segundos en lugar de 500ms
}

function stopPolling() {
  if (pollIntervalId) {
    clearInterval(pollIntervalId)
    pollIntervalId = null
  }
}

function updateProgressPointers() {
  if (!importing.value) return
  
  // Actualizar conjunto de tablas completadas comparando con baseline
  const updatedSet = new Set(completedTables.value)
  
  statusList.value.forEach((s) => {
    const base = baselineImports.value[s.table]
    if (!base) return
    
    // Detectar cambio por timestamp o número de filas
    const changed = (base.last !== s.last_import_date) || (base.rows !== s.rows_imported)
    if (changed) {
      updatedSet.add(s.table)
    }
  })
  
  completedTables.value = updatedSet
  
  // Encontrar siguiente tabla en importQueue que no esté completada
  const tablesInQueue = Array.from(importQueue.value)
  const next = tablesInQueue.find((table) => !completedTables.value.has(table))
  
  currentImportTable.value = next || null
}
</script>
