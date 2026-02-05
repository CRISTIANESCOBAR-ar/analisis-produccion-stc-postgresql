// =====================================================================
// Composable unificado para notificaciones
// =====================================================================
// Uso: import { useNotifications } from '@/composables/useNotifications'
// =====================================================================

import { ref, readonly } from 'vue'
import Swal from 'sweetalert2'

// Cola de notificaciones pendientes
const notificationQueue = ref([])
const isProcessing = ref(false)

/**
 * Tipos de notificación
 */
export const NotificationTypes = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
  QUESTION: 'question'
}

/**
 * Posiciones disponibles para toasts
 */
export const ToastPositions = {
  TOP_END: 'top-end',
  TOP_START: 'top-start',
  TOP_CENTER: 'top',
  BOTTOM_END: 'bottom-end',
  BOTTOM_START: 'bottom-start',
  BOTTOM_CENTER: 'bottom',
  CENTER: 'center'
}

/**
 * Configuración por defecto para toasts
 */
const defaultToastConfig = {
  toast: true,
  position: ToastPositions.TOP_END,
  timer: 3000,
  timerProgressBar: true,
  showConfirmButton: false,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
}

/**
 * Composable principal para notificaciones
 */
export function useNotifications() {
  
  /**
   * Muestra un toast (notificación pequeña)
   */
  const showToast = (message, type = NotificationTypes.INFO, options = {}) => {
    const config = {
      ...defaultToastConfig,
      icon: type,
      title: message,
      ...options
    }
    
    return Swal.fire(config)
  }
  
  /**
   * Muestra notificación de éxito
   */
  const success = (message, options = {}) => {
    return showToast(message, NotificationTypes.SUCCESS, {
      timer: 2500,
      ...options
    })
  }
  
  /**
   * Muestra notificación de error
   */
  const error = (message, options = {}) => {
    return showToast(message, NotificationTypes.ERROR, {
      timer: 5000,
      ...options
    })
  }
  
  /**
   * Muestra notificación de advertencia
   */
  const warning = (message, options = {}) => {
    return showToast(message, NotificationTypes.WARNING, {
      timer: 4000,
      ...options
    })
  }
  
  /**
   * Muestra notificación informativa
   */
  const info = (message, options = {}) => {
    return showToast(message, NotificationTypes.INFO, options)
  }
  
  /**
   * Muestra modal de confirmación
   * @returns {Promise<boolean>} true si confirma, false si cancela
   */
  const confirm = async (title, text, options = {}) => {
    const result = await Swal.fire({
      icon: 'question',
      title,
      text,
      showCancelButton: true,
      confirmButtonText: options.confirmText || 'Confirmar',
      cancelButtonText: options.cancelText || 'Cancelar',
      confirmButtonColor: options.confirmColor || '#3085d6',
      cancelButtonColor: options.cancelColor || '#d33',
      reverseButtons: true,
      ...options
    })
    
    return result.isConfirmed
  }
  
  /**
   * Muestra modal de confirmación para eliminar
   */
  const confirmDelete = async (itemName = 'este elemento') => {
    return confirm(
      '¿Estás seguro?',
      `Esta acción eliminará ${itemName} de forma permanente.`,
      {
        confirmText: 'Sí, eliminar',
        confirmColor: '#d33',
        icon: 'warning'
      }
    )
  }
  
  /**
   * Muestra indicador de carga
   * @returns {Function} Función para cerrar el indicador
   */
  const showLoading = (title = 'Procesando...', text = 'Por favor espera') => {
    Swal.fire({
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      willOpen: () => {
        Swal.showLoading()
      }
    })
    
    return () => Swal.close()
  }
  
  /**
   * Muestra progreso de una operación
   */
  const showProgress = (title, getCurrentProgress) => {
    let timerInterval
    
    return Swal.fire({
      title,
      html: '<div class="progress-container"><div class="progress-bar" id="swal-progress"></div></div><p id="swal-progress-text">0%</p>',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        const progressBar = document.getElementById('swal-progress')
        const progressText = document.getElementById('swal-progress-text')
        
        timerInterval = setInterval(() => {
          const progress = getCurrentProgress()
          if (progressBar) {
            progressBar.style.width = `${progress}%`
          }
          if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`
          }
          
          if (progress >= 100) {
            clearInterval(timerInterval)
            Swal.close()
          }
        }, 100)
      },
      willClose: () => {
        clearInterval(timerInterval)
      }
    })
  }
  
  /**
   * Muestra modal con input
   * @returns {Promise<string|null>} Valor ingresado o null si cancela
   */
  const prompt = async (title, options = {}) => {
    const result = await Swal.fire({
      title,
      input: options.inputType || 'text',
      inputLabel: options.label || '',
      inputPlaceholder: options.placeholder || '',
      inputValue: options.defaultValue || '',
      showCancelButton: true,
      confirmButtonText: options.confirmText || 'Aceptar',
      cancelButtonText: options.cancelText || 'Cancelar',
      inputValidator: options.validator || null,
      ...options
    })
    
    return result.isConfirmed ? result.value : null
  }
  
  /**
   * Muestra un mensaje de éxito con detalles expandibles
   */
  const successWithDetails = (title, summary, details) => {
    return Swal.fire({
      icon: 'success',
      title,
      html: `
        <p>${summary}</p>
        <details class="mt-3 text-left">
          <summary class="cursor-pointer text-blue-600 hover:text-blue-800">Ver detalles</summary>
          <pre class="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">${details}</pre>
        </details>
      `,
      confirmButtonText: 'Entendido'
    })
  }
  
  /**
   * Cierra cualquier notificación activa
   */
  const close = () => {
    Swal.close()
  }
  
  /**
   * Verifica si hay una notificación visible
   */
  const isVisible = () => {
    return Swal.isVisible()
  }
  
  return {
    // Métodos principales
    showToast,
    success,
    error,
    warning,
    info,
    
    // Modales
    confirm,
    confirmDelete,
    prompt,
    successWithDetails,
    
    // Loading/Progress
    showLoading,
    showProgress,
    
    // Utilidades
    close,
    isVisible,
    
    // Constantes
    NotificationTypes,
    ToastPositions
  }
}

// Instancia singleton
let instance = null
export function useGlobalNotifications() {
  if (!instance) {
    instance = useNotifications()
  }
  return instance
}
