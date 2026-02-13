<template>
  <div class="flex flex-col w-full h-screen p-4 bg-slate-50 overflow-hidden">
    <!-- Header / Selector -->
    <div class="bg-white rounded-xl shadow-md border border-slate-200 p-5 mb-4 shrink-0">
      <h2 class="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
        <span class="p-2 bg-blue-100 text-blue-600 rounded-lg">🧬</span>
        Carga de Archivos HVI (Calculo de Mistura)
      </h2>
      
      <div class="flex flex-col md:flex-row md:items-end gap-4">
        <div class="flex-1">
          <label class="block text-sm font-semibold text-slate-700 mb-2">Carpeta de archivos HVI (.txt):</label>
          <div class="flex gap-2">
            <div class="relative flex-1 group">
              <input 
                v-model="folderPath"
                type="text" 
                placeholder="Seleccione la carpeta o escriba la ruta..."
                class="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-slate-50 group-hover:bg-white"
                @change="saveFolderPath"
              />
              <span class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a2 2 0 012-2h3l2 3h6a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                </svg>
              </span>
            </div>
            <button 
              @click="triggerFolderSelector"
              class="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-blue-200 flex items-center gap-2 shrink-0 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Seleccionar Carpeta
            </button>
            <button 
              v-if="hasPersistedHandle"
              @click="refreshFolder"
              class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold transition-all border border-slate-300 flex items-center gap-2 shrink-0 active:scale-95"
              title="Actualizar lista de archivos"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>
          </div>
        </div>
        
        <div class="flex gap-2 shrink-0">
          <button 
            @click="processFiles"
            :disabled="!filesList.length"
            class="px-6 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-200 flex items-center gap-2 active:scale-95"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Procesar {{ filesList.length ? `(${filesList.length})` : '' }}
          </button>
        </div>
      </div>
      
      <p class="text-[11px] text-slate-500 mt-3 flex items-center gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Los archivos deben tener el formato: <b>Tipo_Lote_Proveedor_Grado_Fecha.txt</b> (ej: Ent_616_CARAM_C-1-2_21-01-2026.txt)
      </p>
    </div>

    <!-- Table Container -->
    <div class="flex flex-1 gap-4 overflow-hidden min-h-0">
      <!-- Left Table: TXT Files List -->
      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col w-[750px] shrink-0">
        <!-- Radiobutton Filters -->
        <div class="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-4 shrink-0">
          <span class="text-[10px] font-bold text-slate-500 uppercase">Mostrar:</span>
          <div class="flex items-center gap-3">
            <label v-for="opt in ['Todos', 'No guardados', 'Guardados']" :key="opt" class="flex items-center gap-1.5 cursor-pointer group">
              <input 
                type="radio" 
                v-model="filterStatus" 
                :value="opt" 
                class="w-3 h-3 text-blue-600 focus:ring-blue-500 border-slate-300"
              />
              <span class="text-[11px] font-medium text-slate-600 group-hover:text-blue-600 transition-colors">{{ opt }}</span>
            </label>
          </div>
        </div>

        <div class="overflow-auto flex-1 h-full">
          <table class="w-full text-left border-collapse table-fixed">
            <thead class="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 shadow-sm">
              <tr>
                <th class="w-16 px-3 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Tipo</th>
                <th class="w-16 px-3 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Lote</th>
                <th class="flex-1 px-3 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Prov.</th>
                <th class="w-20 px-3 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Grado</th>
                <th class="w-24 px-3 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Muestra</th>
                <th class="w-14 px-3 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Cant.</th>
                <th class="w-20 px-3 py-3 text-[10px] font-bold text-slate-700 uppercase tracking-wider">Color</th>
                <th class="w-16 px-3 py-2 text-[10px] font-bold text-slate-700 uppercase tracking-wider text-center">Estado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr 
                v-for="(item, index) in filteredFiles" 
                :key="item.fileName" 
                @click="selectFile(item)"
                class="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                :class="{ 'bg-blue-50 border-l-4 border-blue-500': selectedFileName === item.fileName }"
              >
                <td class="px-3 py-2 text-xs">
                  <span 
                    class="px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase"
                    :class="item.tipo === 'Ent' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'"
                  >
                    {{ item.tipo }}
                  </span>
                </td>
                <td class="px-3 py-2 text-xs font-mono text-slate-700 font-semibold">{{ item.loteEntrada }}</td>
                <td class="px-3 py-2 text-xs text-slate-600 truncate" :title="item.proveedor">{{ item.proveedor }}</td>
                <td class="px-3 py-2 text-xs text-slate-600 font-medium truncate">{{ item.grado }}</td>
                <td class="px-2 py-1 text-xs" @click.stop>
                  <input 
                    v-model="item.muestra"
                    type="text" 
                    placeholder="Muestra..."
                    class="w-full px-2 py-1 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:opacity-50"
                  />
                </td>
                <td class="px-2 py-1 text-xs" @click.stop>
                  <input 
                    v-model="item.cantidad"
                    type="number" 
                    :readonly="item.tipo === 'Ent'"
                    :class="{ 'bg-slate-50 font-semibold italic text-blue-700': item.tipo === 'Ent' }"
                    class="w-full px-1 py-1 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-blue-500 outline-none no-spinner"
                  />
                </td>
                <td class="px-2 py-1 text-xs" @click.stop>
                  <select 
                    v-model="item.color"
                    class="w-full px-1 py-1 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-blue-500 outline-none bg-white disabled:bg-slate-50 disabled:opacity-50 cursor-pointer"
                  >
                    <option value="">-</option>
                    <option v-for="c in ['LG', 'BCO', 'LA', 'COR', 'GRI', 'AMA']" :key="c" :value="c">{{ c }}</option>
                  </select>
                </td>
                <td class="px-3 py-2 text-xs text-center">
                  <span 
                    v-if="item.estado === 'Procesado'" 
                    class="inline-flex items-center gap-1 text-[9px] font-bold text-green-600"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                    Listo
                  </span>
                  <span 
                    v-else
                    class="inline-flex items-center gap-1 text-[9px] font-bold text-amber-600"
                  >
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Pend.
                  </span>
                </td>
              </tr>
              
              <tr v-if="parsedFiles.length === 0">
                <td colspan="6" class="px-4 py-16 text-center">
                  <p class="text-xs text-slate-400">No hay archivos</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <!-- Small Footer for Left Table -->
        <div class="bg-slate-50 border-t border-slate-200 px-3 py-2 shrink-0 flex justify-between items-center text-[10px]">
          <span class="text-slate-500">{{ parsedFiles.length }} archivos</span>
        </div>
      </div>

      <!-- Right Table: HVI Detailed Data -->
      <div class="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden flex flex-col flex-1 min-w-0">
        <div v-if="selectedFileName" class="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center shrink-0">
          <span class="text-xs font-bold text-slate-700 truncate">Detalles: <span class="text-blue-600">{{ selectedFileName }}</span></span>
          <button 
            @click="processFiles"
            class="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold rounded shadow-sm transition-all flex items-center gap-1.5"
            :disabled="!hviDetails.length"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
            GUARDAR COMPLETO
          </button>
        </div>

        <div class="overflow-auto flex-1 h-full">
          <table class="w-full text-left border-collapse table-fixed min-w-[1200px]">
            <thead class="sticky top-0 z-10 bg-slate-100 border-b border-slate-200">
              <tr>
                <th class="w-20 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">Fardo</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">SCI</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">MST</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">MIC</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">MAT</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">UHML</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">UI</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">SF</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">STR</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">ELG</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">RD</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">+b</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">TIPO</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">TrCNT</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">TrAR</th>
                <th class="w-16 px-4 py-3 text-xs font-bold text-slate-700 uppercase tracking-wider">TRID</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="(row, idx) in hviDetails" :key="idx" class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-2 text-xs font-mono text-slate-700">{{ row.fardo }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.sci }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.mst }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.mic }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.mat }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.uhml }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.ui }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.sf }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.str }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.elg }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.rd }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.plusB }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.tipo }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.trCnt }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.trAr }}</td>
                <td class="px-4 py-2 text-xs text-slate-600">{{ row.trid }}</td>
              </tr>
              <tr v-if="!hviDetails.length">
                <td colspan="16" class="px-4 py-16 text-center">
                  <div class="flex flex-col items-center justify-center text-slate-400">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 mb-2 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    <p class="text-sm">Seleccione un archivo de la izquierda para ver el detalle</p>
                  </div>
                </td>
              </tr>
            </tbody>
            <!-- Footer fijo con promedios -->
            <tfoot v-if="hviDetails.length" class="sticky bottom-0 z-10 bg-blue-50 border-t-2 border-blue-200">
              <tr class="font-bold text-blue-900 shadow-[0_-2px_4px_rgba(0,0,0,0.05)]">
                <td class="px-4 py-3 text-xs bg-blue-100/50">n = {{ hviDetails.length }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.sci }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.mst }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.mic }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.mat }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.uhml }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.ui }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.sf }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.str }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.elg }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.rd }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.plusB }}</td>
                <td class="px-4 py-3 text-xs italic text-blue-400">Prom.</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.trCnt }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.trAr }}</td>
                <td class="px-4 py-3 text-xs">{{ hviAverages.trid }}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>

    <!-- Hidden folder input pointer -->
    <input 
      ref="folderInput"
      type="file" 
      webkitdirectory 
      directory 
      multiple 
      class="hidden" 
      @change="handleFolderChange"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import Swal from 'sweetalert2';

// State
const folderPath = ref(localStorage.getItem('hvi_last_folder_path') || '');
const filesList = ref([]);
const folderInput = ref(null);
const parsedFiles = ref([]);
const hasPersistedHandle = ref(false);

const selectedFileName = ref('');
const selectedFileItem = ref(null);
const hviDetails = ref([]);
const filterStatus = ref('No guardados'); // Todos, No guardados, Guardados

// Propiedad computada para filtrar la lista de archivos
const filteredFiles = computed(() => {
  if (filterStatus.value === 'Todos') return parsedFiles.value;
  if (filterStatus.value === 'Guardados') {
    return parsedFiles.value.filter(f => f.estado === 'Procesado');
  }
  if (filterStatus.value === 'No guardados') {
    return parsedFiles.value.filter(f => f.estado === 'Pendiente');
  }
  return parsedFiles.value;
});

// Propiedad computada para calcular los promedios
const hviAverages = computed(() => {
  if (!hviDetails.value.length) return {};
  
  const keys = ['sci', 'mst', 'mic', 'mat', 'uhml', 'ui', 'sf', 'str', 'elg', 'rd', 'plusB', 'trCnt', 'trAr', 'trid'];
  const sums = {};
  keys.forEach(k => sums[k] = 0);
  
  let validCounts = {};
  keys.forEach(k => validCounts[k] = 0);

  hviDetails.value.forEach(row => {
    keys.forEach(k => {
      const val = parseFloat(row[k]);
      if (!isNaN(val)) {
        sums[k] += val;
        validCounts[k]++;
      }
    });
  });

  const averages = {};
  keys.forEach(k => {
    if (validCounts[k] > 0) {
      const avg = sums[k] / validCounts[k];
      // Convertimos a string con coma decimal para visualizar como en tb_calidad_fibra
      averages[k] = avg.toFixed(2).replace('.', ',');
    } else {
      averages[k] = '-';
    }
  });
  
  return averages;
});

// Computed
const counts = computed(() => {
  const total = parsedFiles.value.length;
  const ent = parsedFiles.value.filter(f => f.tipo === 'Ent').length;
  return { total, ent };
});

// IndexedDB helpers for DirectoryHandle persistence
function openDb() {
  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open('carga-hvi', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveDirHandle(handle) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readwrite');
    const store = tx.objectStore('handles');
    const r = store.put(handle, 'dir');
    r.onsuccess = () => resolve(true);
    r.onerror = () => reject(r.error);
  });
}

async function getDirHandle() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('handles', 'readonly');
    const store = tx.objectStore('handles');
    const r = store.get('dir');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function verifyPermission(handle) {
  if (!handle) return false;
  try {
    if (await handle.queryPermission({ mode: 'read' }) === 'granted') return true;
    if (await handle.requestPermission({ mode: 'read' }) === 'granted') return true;
  } catch (err) {
    console.warn('verifyPermission error', err);
  }
  return false;
}

// Methods
const saveFolderPath = () => {
  localStorage.setItem('hvi_last_folder_path', folderPath.value);
};

const triggerFolderSelector = async () => {
  // Use File System Access API if available
  if ('showDirectoryPicker' in window) {
    try {
      const handle = await window.showDirectoryPicker();
      await saveDirHandle(handle);
      hasPersistedHandle.value = true;
      folderPath.value = handle.name;
      saveFolderPath();
      await scanDirectory(handle);
      return;
    } catch (err) {
      console.warn('showDirectoryPicker error or cancelled', err);
    }
  }

  // Fallback to hidden input
  if (folderInput.value) {
    folderInput.value.click();
  }
};

async function scanDirectory(dirHandle) {
  const results = [];
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind === 'file' && name.toLowerCase().endsWith('.txt')) {
        results.push(parseFileName(name, handle));
      }
    }
    
    // Verificar estado en la DB antes de mostrar
    if (results.length > 0) {
      try {
        const response = await fetch('/api/hvi/check-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileNames: results.map(f => f.fileName) })
        });
        const result = await response.json();
        if (result.success) {
          results.forEach(f => {
            if (result.existingNames.includes(f.fileName)) {
              f.estado = 'Procesado';
            }
          });
        }
      } catch (err) {
        console.warn('Error checking files status:', err);
      }
    }

    parsedFiles.value = results;
    filesList.value = results; // Para el contador de procesar
  } catch (err) {
    console.error('Error scanning directory', err);
  }
}

async function refreshFolder() {
  try {
    const handle = await getDirHandle();
    if (!handle) return;
    const ok = await verifyPermission(handle);
    if (ok) {
      await scanDirectory(handle);
    }
  } catch (err) {
    console.warn('refreshFolder error', err);
  }
}

const handleFolderChange = async (event) => {
  const selectedFiles = Array.from(event.target.files);
  const txtFiles = selectedFiles.filter(f => f.name.toLowerCase().endsWith('.txt'));
  
  // Parse names for the table
  const results = txtFiles.map(file => parseFileName(file.name, null, file));

  // Verificar estado en la DB antes de mostrar
  if (results.length > 0) {
    try {
      const response = await fetch('/api/hvi/check-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileNames: results.map(f => f.fileName) })
      });
      const result = await response.json();
      if (result.success) {
        results.forEach(f => {
          if (result.existingNames.includes(f.fileName)) {
            f.estado = 'Procesado';
          }
        });
      }
    } catch (err) {
      console.warn('Error checking files status:', err);
    }
  }

  parsedFiles.value = results;
  filesList.value = results;

  // Intentar extraer el nombre de la carpeta si es posible
  if (txtFiles.length > 0 && txtFiles[0].webkitRelativePath) {
    const parts = txtFiles[0].webkitRelativePath.split('/');
    if (parts.length > 1) {
      folderPath.value = parts[0];
      saveFolderPath();
    }
  }
};

const parseFileName = (fileName, handle = null, file = null) => {
  // Formato esperado: Tipo_Lote_Proveedor_Grado_Fecha.txt
  // Ejemplo: Ent_616_CARAM_C-1-2_21-01-2026.txt
  
  // 1. Quitar extension
  const nameOnly = fileName.replace(/\.txt$/i, "");
  
  // 2. Separar por guiones bajos
  const parts = nameOnly.split('_');
  
  // 3. Extraer según lógica solicitada
  // Tipo: 3 primeras letras (o parte 0)
  const tipo = parts[0] ? parts[0].substring(0, 3) : "???";
  
  // Lote/Entrada: desde el cuarto carácter hasta que aparece un _ (o parte 1)
  const loteEntrada = parts[1] || "";
  
  // Proveedor: desde el segundo _ hasta el proximo _ (parte 2)
  const proveedor = parts[2] || "";
  
  // Lógica revisada para manejar guiones bajos variables en Grado y Fecha
  // El Grado puede tener múltiples segmentos (ej: C_1-2) y la Fecha es el último segmento
  let grado = "";
  let fecha = "";

  if (parts.length > 3) {
    // La fecha es siempre el último segmento del nombre
    fecha = parts[parts.length - 1];
    
    // El grado es todo lo que está entre el proveedor (index 2) y la fecha (el último)
    // Unimos con "-" para cumplir con el formato solicitado (C-1-2)
    let rawGrado = parts.slice(3, -1).join('-');
    
    // Transformar formatos como C-1-2 a C 1/2, D-1-4 a D 1/4, etc.
    // Buscamos el patrón: Letra-Número-Número
    grado = rawGrado.replace(/^([A-Z])-(\d)-(\d)$/, '$1 $2/$3');
  }

  return {
    fileName,
    handle,
    file,
    tipo,
    loteEntrada,
    proveedor,
    grado,
    fecha,
    muestra: "", // Input para el usuario
    cantidad: "", // Cantidad (Nuevo)
    color: "",    // Color (Nuevo)
    estado: "Pendiente"
  };
};

const selectFile = async (item) => {
  selectedFileName.value = item.fileName;
  selectedFileItem.value = item;
  hviDetails.value = [];

  try {
    let content = '';
    if (item.handle) {
      // From File System Access API
      const file = await item.handle.getFile();
      content = await file.text();
    } else if (item.file) {
      // From fallback input
      content = await item.file.text();
    }
    
    if (content) {
      parseHviDetails(content);
      
      // Para TIPO "Ent", autocompletar la cantidad con el número de fardos encontrados
      if (item.tipo === 'Ent' && hviDetails.value.length > 0) {
        item.cantidad = hviDetails.value.length;
      }
    }
  } catch (err) {
    console.error('Error reading HVI file', err);
  }
};

const parseHviDetails = (content) => {
  const lines = content.split('\n');
  const detailRows = [];
  
  // Las informaciones empiezan en la fila 14 (index 13)
  for (let i = 13; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Separado por Espacio (múltiples espacios tratados como uno)
    const columns = line.split(/\s+/);
    
    // Criterio de validación: Ignorar filas de resumen tipo "Average" o "Q99%"
    // Y detenerse si encontramos 'n' en la primera columna (columna 1 según el usuario)
    const firstCol = columns[0] ? columns[0].toLowerCase() : '';
    
    // Criterio de parada: letra 'n' en la primera columna (marca el inicio de estadísticas)
    if (firstCol === 'n') {
      break;
    }
    
    // Filtrar filas de resumen y encabezados repetidos
    if (firstCol.includes('average') || firstCol.includes('q99%') || firstCol === '+/-' || firstCol === 'bale') {
      continue;
    }

    // Criterio de limpieza profunda: La segunda columna (ID/SCI) debe ser un número válido
    const secondColVal = columns[1];
    if (!secondColVal || isNaN(parseFloat(secondColVal))) {
      continue;
    }

    if (columns.length < 16) continue;
    
    // El usuario solicita que en la columna TIPO (grado de color) se cambie el "-" por ","
    // Ejemplo: 23-2 -> 23,2 para ser compatible con tb_calidad_fibra
    const tipoFormateado = columns[12] ? columns[12].replace('-', ',') : '';
    
    detailRows.push({
      fardo: columns[0],
      sci: columns[1],
      mst: columns[2],
      mic: columns[3],
      mat: columns[4],
      uhml: columns[5],
      ui: columns[6],
      sf: columns[7],
      str: columns[8],
      elg: columns[9],
      rd: columns[10],
      plusB: columns[11], // Corresponde a PLUS_B en DB
      tipo: tipoFormateado,
      trCnt: columns[13],
      trAr: columns[14],
      trid: columns[15]
    });
  }
  hviDetails.value = detailRows;
};

const processFiles = async () => {
  if (!selectedFileItem.value || hviDetails.value.length === 0) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: 'Seleccione un archivo con datos',
      showConfirmButton: false,
      timer: 3000
    });
    return;
  }

  // Validación de cantidad para muestras
  if (selectedFileItem.value.tipo === 'Mue' && (!selectedFileItem.value.cantidad || selectedFileItem.value.cantidad <= 0)) {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'warning',
      title: 'Debe ingresar la cantidad para muestras',
      showConfirmButton: false,
      timer: 3000
    });
    return;
  }

  // Toast de "Guardando..."
  const loadingToast = Swal.fire({
    title: 'Guardando datos...',
    html: 'Por favor, espere',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    const payload = {
      files: [
        {
          metadata: {
            fileName: selectedFileItem.value.fileName,
            tipo: selectedFileItem.value.tipo,
            loteEntrada: selectedFileItem.value.loteEntrada,
            proveedor: selectedFileItem.value.proveedor,
            grado: selectedFileItem.value.grado,
            fecha: selectedFileItem.value.fecha,
            muestra: selectedFileItem.value.muestra,
            cantidad: selectedFileItem.value.cantidad,
            color: selectedFileItem.value.color
          },
          details: hviDetails.value
        }
      ]
    };

    const response = await fetch('/api/hvi/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    // Cerrar loading
    Swal.close();

    if (result.success) {
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Datos guardados correctamente',
        showConfirmButton: false,
        timer: 3000
      });
      selectedFileItem.value.estado = "Procesado";
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error al guardar',
        text: result.error
      });
    }
  } catch (err) {
    Swal.close();
    console.error("Error en processFiles:", err);
    Swal.fire({
      icon: 'error',
      title: 'Error de conexión',
      text: 'No se pudo contactar con el servidor'
    });
  }
};

onMounted(async () => {
  try {
    const handle = await getDirHandle();
    if (handle) {
      hasPersistedHandle.value = true;
      console.log('Carpeta persistida encontrada:', handle.name);
      folderPath.value = handle.name;
      
      // Verificar permisos y escanear automáticamente
      const ok = await verifyPermission(handle);
      if (ok) {
        await scanDirectory(handle);
      }
    }
  } catch (err) {
    console.warn('onMounted getDirHandle error', err);
  }
});
</script>

<style scoped>
/* Estilos para quitar los spinners de los inputs de tipo number */
.no-spinner::-webkit-inner-spin-button,
.no-spinner::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.no-spinner {
  -moz-appearance: textfield;
}

.overflow-auto::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.overflow-auto::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.overflow-auto::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.overflow-auto::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>
