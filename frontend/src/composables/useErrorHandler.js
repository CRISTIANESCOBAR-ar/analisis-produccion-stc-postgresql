// =====================================================================
// Composable centralizado para manejo de errores
// =====================================================================
// Uso: import { useErrorHandler } from '@/composables/useErrorHandler'
// =====================================================================
// Nota: Los accesos dinámicos son seguros - claves controladas internamente
/* eslint-disable security/detect-object-injection */

import { ref, readonly } from 'vue'
import Swal from 'sweetalert2'

// Estado global de errores
const globalError = ref(null)
const errorHistory = ref([])
const MAX_ERROR_HISTORY = 50

/**
 * Tipos de error para categorización
 */
export const ErrorTypes = {
  NETWORK: 'network',
  API: 'api',
  VALIDATION: 'validation',
  AUTH: 'auth',
  UNKNOWN: 'unknown'
}

/**
 * Detecta el tipo de error basado en el objeto de error
 */
const detectErrorType = (error) => {
  if (!error) return ErrorTypes.UNKNOWN
  
  // Error de red (fetch failed, timeout, etc.)
  if (error.name === 'TypeError' && error.message?.includes('fetch')) {
    return ErrorTypes.NETWORK
  }
  
  // Error de autenticación
  if (error.status === 401 || error.status === 403) {
    return ErrorTypes.AUTH
  }
  
  // Error de API (status codes)
  if (error.status >= 400 && error.status < 600) {
    return ErrorTypes.API
  }
  
  // Error de validación
  if (error.name === 'ValidationError' || error.type === 'validation') {
    return ErrorTypes.VALIDATION
  }
  
  return ErrorTypes.UNKNOWN
}

/**
 * Obtiene mensaje amigable según el tipo de error
 */
const getFriendlyMessage = (error, type) => {
  const messages = {
    [ErrorTypes.NETWORK]: 'No se pudo conectar al servidor. Verifica tu conexión a internet.',
    [ErrorTypes.AUTH]: 'Sesión expirada o no autorizado. Por favor, inicia sesión nuevamente.',
    [ErrorTypes.API]: error?.message || 'Error al procesar la solicitud en el servidor.',
    [ErrorTypes.VALIDATION]: error?.message || 'Los datos ingresados no son válidos.',
    [ErrorTypes.UNKNOWN]: 'Ocurrió un error inesperado. Por favor, intenta nuevamente.'
  }
  
  return messages[type] || messages[ErrorTypes.UNKNOWN]
}

/**
 * Composable principal para manejo de errores
 */
export function useErrorHandler() {
  
  /**
   * Maneja un error y muestra notificación al usuario
   * @param {Error|Object} error - El error a manejar
   * @param {string} context - Contexto donde ocurrió el error (ej: 'CargarDatos')
   * @param {Object} options - Opciones adicionales
   */
  const handleError = (error, context = '', options = {}) => {
    const {
      silent = false,        // No mostrar notificación
      toast = true,          // Mostrar como toast (vs modal)
      logToConsole = true,   // Log en consola
      duration = 5000        // Duración del toast
    } = options
    
    const errorType = detectErrorType(error)
    const friendlyMessage = getFriendlyMessage(error, errorType)
    const timestamp = new Date().toISOString()
    
    // Crear objeto de error estructurado
    const errorRecord = {
      id: Date.now(),
      type: errorType,
      message: friendlyMessage,
      originalMessage: error?.message || String(error),
      context,
      timestamp,
      stack: error?.stack
    }
    
    // Guardar en estado global
    globalError.value = errorRecord
    
    // Agregar al historial (limitado)
    errorHistory.value.unshift(errorRecord)
    if (errorHistory.value.length > MAX_ERROR_HISTORY) {
      errorHistory.value.pop()
    }
    
    // Log en consola si está habilitado
    if (logToConsole) {
      console.error(`[${context || 'Error'}]`, {
        type: errorType,
        message: friendlyMessage,
        original: error
      })
    }
    
    // Mostrar notificación si no es silencioso
    if (!silent) {
      if (toast) {
        Swal.fire({
          icon: 'error',
          title: context || 'Error',
          text: friendlyMessage,
          toast: true,
          position: 'top-end',
          timer: duration,
          timerProgressBar: true,
          showConfirmButton: false,
          didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
          }
        })
      } else {
        Swal.fire({
          icon: 'error',
          title: context || 'Error',
          text: friendlyMessage,
          confirmButtonText: 'Entendido',
          confirmButtonColor: '#3085d6'
        })
      }
    }
    
    return errorRecord
  }
  
  /**
   * Wrapper para ejecutar funciones async con manejo de errores automático
   * @param {Function} fn - Función async a ejecutar
   * @param {string} context - Contexto del error
   * @param {Object} options - Opciones de manejo de error
   */
  const tryCatch = async (fn, context = '', options = {}) => {
    try {
      return await fn()
    } catch (error) {
      handleError(error, context, options)
      return null
    }
  }
  
  /**
   * Limpia el error global actual
   */
  const clearError = () => {
    globalError.value = null
  }
  
  /**
   * Limpia todo el historial de errores
   */
  const clearHistory = () => {
    errorHistory.value = []
    globalError.value = null
  }
  
  /**
   * Obtiene errores filtrados por tipo
   */
  const getErrorsByType = (type) => {
    return errorHistory.value.filter(e => e.type === type)
  }
  
  return {
    // Estado (readonly para prevenir mutaciones externas)
    globalError: readonly(globalError),
    errorHistory: readonly(errorHistory),
    
    // Métodos
    handleError,
    tryCatch,
    clearError,
    clearHistory,
    getErrorsByType,
    
    // Constantes
    ErrorTypes
  }
}

// Exportar instancia singleton para uso global
let instance = null
export function useGlobalErrorHandler() {
  if (!instance) {
    instance = useErrorHandler()
  }
  return instance
}
