<template>
  <div class="w-full h-screen flex bg-gray-50 text-slate-800">
    <!-- Sidebar: Lista de tablas -->
    <aside class="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
      <div class="p-4 border-b border-slate-100 bg-slate-50">
        <h2 class="font-bold text-slate-700 text-sm uppercase tracking-wider flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          Base de Datos
        </h2>
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        <ul class="space-y-1">
          <li v-for="table in tables" :key="table">
            <button 
              @click="selectTable(table)"
              class="w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors outline-none focus:ring-2 focus:ring-blue-500"
              :class="selectedTable === table ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
            >
              {{ table }}
            </button>
          </li>
        </ul>
      </div>
    </aside>

    <!-- Área principal: Datos de la tabla -->
    <main class="flex-1 flex flex-col min-w-0 overflow-hidden bg-white m-2 rounded-xl shadow-sm border border-slate-200">
      <div v-if="selectedTable" class="flex flex-col h-full">
        <!-- Header de la tabla (Título y Buscador) -->
        <header class="flex items-center justify-between p-4 border-b border-slate-200 shrink-0">
          <div>
            <h1 class="text-xl font-bold text-slate-800 flex items-center gap-2">
              {{ selectedTable }}
              <span v-if="loading" class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full animate-pulse">Cargando...</span>
            </h1>
            <p class="text-xs text-slate-500 mt-1">
              Mostrando página {{ currentPage }} de {{ totalPages }} ({{ totalRows }} registros en total)
            </p>
          </div>
          <div class="flex items-center gap-3">
            <div class="relative">
              <input 
                type="text" 
                v-model="searchQuery" 
                @keyup.enter="handleSearch"
                placeholder="Buscar (presiona Enter)..."
                class="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button @click="fetchTableData" class="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Recargar">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        <!-- Contenedor scrolleable de la tabla -->
        <div class="flex-1 overflow-auto bg-slate-50 relative">
          <table v-if="columns.length > 0" class="min-w-full text-left text-sm whitespace-nowrap">
            <thead class="sticky top-0 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] z-10">
              <tr>
                <th v-for="col in columns" :key="col" class="px-4 py-3 font-semibold text-slate-700 text-xs uppercase tracking-wider border-b border-slate-200">
                  {{ col }}
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 bg-white">
              <tr v-for="(row, idx) in tableData" :key="idx" class="hover:bg-slate-50/80 transition-colors group">
                <td v-for="col in columns" :key="col" class="px-4 py-2.5 text-slate-600 group-hover:text-slate-900 border-r border-slate-50 last:border-r-0 max-w-[300px] truncate" :title="String(row[col])">
                  {{ row[col] === null ? '-' : row[col] }}
                </td>
              </tr>
              <tr v-if="tableData.length === 0 && !loading">
                <td :colspan="columns.length" class="px-4 py-8 text-center text-slate-400">
                  No se encontraron resultados
                </td>
              </tr>
            </tbody>
          </table>
          <div v-else-if="!loading" class="flex h-full items-center justify-center text-slate-400">
            No hay estructura de columnas disponible
          </div>
        </div>

        <!-- Paginación -->
        <footer class="p-3 border-t border-slate-200 bg-white shrink-0 flex items-center justify-between">
          <span class="text-sm text-slate-500">Filas por página: {{ itemsPerPage }}</span>
          <div class="flex gap-2">
            <button 
              @click="changePage(currentPage - 1)" 
              :disabled="currentPage <= 1 || loading"
              class="px-3 py-1.5 rounded text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              Anterior
            </button>
            <button 
              @click="changePage(currentPage + 1)" 
              :disabled="currentPage >= totalPages || loading"
              class="px-3 py-1.5 rounded text-sm font-medium border border-slate-200 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors bg-white shadow-sm"
            >
              Siguiente
            </button>
          </div>
        </footer>
      </div>

      <!-- Estado vacío inicial -->
      <div v-else class="flex flex-col items-center justify-center h-full text-slate-400">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
        <p class="text-lg font-medium text-slate-500">Selecciona una tabla para explorar</p>
        <p class="text-sm mt-1">Utiliza el panel lateral para navegar por las tablas disponibles.</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const tables = ref([])
const selectedTable = ref(null)
const columns = ref([])
const tableData = ref([])

const loading = ref(false)
const searchQuery = ref('')

// Pagination
const currentPage = ref(1)
const itemsPerPage = ref(50)
const totalPages = ref(1)
const totalRows = ref(0)

const fetchTables = async () => {
  try {
    const res = await fetch('http://localhost:3001/api/database/tables')
    const json = await res.json()
    if (json.success) {
      tables.value = json.tables
    }
  } catch (e) {
    console.error('Error al cargar tablas:', e)
  }
}

const fetchTableData = async () => {
  if (!selectedTable.value) return
  
  loading.value = true
  try {
    const url = new URL(`http://localhost:3001/api/database/tables/${selectedTable.value}/data`)
    url.searchParams.set('page', currentPage.value)
    url.searchParams.set('limit', itemsPerPage.value)
    if (searchQuery.value) {
      url.searchParams.set('search', searchQuery.value)
    }

    const res = await fetch(url)
    const json = await res.json()
    
    if (json.success) {
      columns.value = json.columns
      tableData.value = json.data
      
      totalPages.value = json.pagination.totalPages
      totalRows.value = json.pagination.total
      currentPage.value = json.pagination.page
    }
  } catch (e) {
    console.error(`Error al cargar datos de ${selectedTable.value}:`, e)
  } finally {
    loading.value = false
  }
}

const selectTable = (tableName) => {
  if (selectedTable.value === tableName) return
  selectedTable.value = tableName
  searchQuery.value = ''
  currentPage.value = 1
  tableData.value = []
  columns.value = []
  fetchTableData()
}

const handleSearch = () => {
  currentPage.value = 1
  fetchTableData()
}

const changePage = (newPage) => {
  if (newPage < 1 || newPage > totalPages.value) return
  currentPage.value = newPage
  fetchTableData()
}

// Navegación por teclado global
const handleKeydown = (e) => {
  if (!tables.value.length) return
  
  // No interceptar si el usuario está escribiendo en el buscador
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

  const currentIndex = tables.value.indexOf(selectedTable.value)
  
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIndex = currentIndex < tables.value.length - 1 ? currentIndex + 1 : 0
    selectTable(tables.value[nextIndex])
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : tables.value.length - 1
    selectTable(tables.value[prevIndex])
  }
}

onMounted(() => {
  fetchTables()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
