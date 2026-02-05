// =====================================================================
// Composable de Vue 3 para acceder a la API PostgreSQL
// =====================================================================
// Uso: import { useDatabase } from '@/composables/useDatabase'
// =====================================================================

import { ref, computed } from 'vue'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/produccion'

export function useDatabase() {
  const loading = ref(false)
  const error = ref(null)

  // Helper para hacer requests
  const fetchApi = async (endpoint, options = {}) => {
    loading.value = true
    error.value = null
    
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        ...options
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      return data
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  // Estado del sistema
  const getStatus = async () => {
    return await fetchApi('/status')
  }

  // ===================================================================
  // PRODUCCIÓN
  // ===================================================================
  
  const getProduccion = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/produccion?${queryString}`)
  }

  const getProduccionSummary = async (startDate, endDate) => {
    const params = new URLSearchParams({ startDate, endDate }).toString()
    return await fetchApi(`/produccion/summary?${params}`)
  }

  // ===================================================================
  // CALIDAD
  // ===================================================================
  
  const getCalidad = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad?${queryString}`)
  }

  const getRevisionCQ = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad/revision-cq?${queryString}`)
  }

  const getAvailableDates = async () => {
    return await fetchApi('/calidad/available-dates')
  }

  const getRevisorDetalle = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad/revisor-detalle?${queryString}`)
  }

  const getPartidaDetalle = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad/partida-detalle?${queryString}`)
  }

  const getDefectosDetalle = async (etiqueta) => {
    return await fetchApi(`/calidad/defectos-detalle?etiqueta=${etiqueta}`)
  }

  // ===================================================================
  // HISTÓRICO REVISORES
  // ===================================================================

  const getHistoricoRevisores = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad/historico-revisores?${queryString}`)
  }

  // ===================================================================
  // MESA DE TEST
  // ===================================================================

  const getMesaTest = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad/mesa-test?${queryString}`)
  }

  // ===================================================================
  // METROS POR SECTOR
  // ===================================================================

  const getMetrosSector = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad/metros-sector?${queryString}`)
  }

  // ===================================================================
  // CALIDAD DE FIBRA
  // ===================================================================

  const getCalidadFibra = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/calidad/fibra?${queryString}`)
  }

  // ===================================================================
  // PARADAS
  // ===================================================================
  
  const getParadas = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/paradas?${queryString}`)
  }

  const getTopMotivosParada = async (startDate, endDate) => {
    const params = new URLSearchParams({ startDate, endDate }).toString()
    return await fetchApi(`/paradas/top-motivos?${params}`)
  }

  // ===================================================================
  // FICHAS
  // ===================================================================
  
  const getFichas = async (search = '') => {
    const params = new URLSearchParams({ search }).toString()
    return await fetchApi(`/fichas?${params}`)
  }

  const getFichaByCodigo = async (codigo) => {
    return await fetchApi(`/fichas/${codigo}`)
  }

  // ===================================================================
  // TESTES
  // ===================================================================
  
  const getTestes = async (params = {}) => {
    const queryString = new URLSearchParams(params).toString()
    return await fetchApi(`/testes?${queryString}`)
  }

  // ===================================================================
  // RESIDUOS
  // ===================================================================
  
  const getResiduosIndigo = async () => {
    return await fetchApi('/residuos/indigo')
  }

  const getResiduosSector = async () => {
    return await fetchApi('/residuos/sector')
  }

  // ===================================================================
  // COSTOS MENSUALES
  // ===================================================================

  const getCostoItems = async () => {
    return await fetchApi('/costos/items')
  }

  const getCostosMensual = async (limite = 24) => {
    const params = new URLSearchParams({ limite: String(limite) }).toString()
    return await fetchApi(`/costos/mensual?${params}`)
  }

  const saveCostosMensual = async (rows) => {
    return await fetchApi('/costos/mensual', {
      method: 'PUT',
      body: JSON.stringify({ rows })
    })
  }

  return {
    // Estados
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    
    // Métodos
    getStatus,
    getProduccion,
    getProduccionSummary,
    getCalidad,
    getRevisionCQ,
    getAvailableDates,
    getRevisorDetalle,
    getPartidaDetalle,
    getDefectosDetalle,
    getHistoricoRevisores,
    getMesaTest,
    getMetrosSector,
    getCalidadFibra,
    getParadas,
    getTopMotivosParada,
    getFichas,
    getFichaByCodigo,
    getTestes,
    getResiduosIndigo,
    getResiduosSector,
    getCostoItems,
    getCostosMensual,
    saveCostosMensual
  }
}
