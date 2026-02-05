/**
 * Formatea un número con separador de miles (punto)
 * @param {number|string} num - Número a formatear
 * @returns {string} - Número formateado con separador de miles
 */
export function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '-'
  const val = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(val)) return '-'
  const rounded = Math.round(val)
  // Formatear con separador de miles (punto)
  return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Formatea un número decimal con separador de miles y decimales
 * @param {number|string} num - Número a formatear
 * @param {number} decimals - Cantidad de decimales (default: 2)
 * @returns {string} - Número formateado
 */
export function formatDecimal(num, decimals = 2) {
  if (num === null || num === undefined || num === '') return '-'
  const val = typeof num === 'string' ? parseFloat(num) : num
  if (isNaN(val)) return '-'
  const fixed = val.toFixed(decimals)
  const [intPart, decPart] = fixed.split('.')
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return decPart ? `${formattedInt},${decPart}` : formattedInt
}

/**
 * Formatea una fecha ISO a string legible
 * @param {string} isoString - Fecha en formato ISO
 * @returns {string} - Fecha formateada
 */
export function formatDate(isoString) {
  if (!isoString) return '-'
  return new Date(isoString).toLocaleString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}
