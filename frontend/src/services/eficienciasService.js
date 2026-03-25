/**
 * Eficiencias Service - Tecelaje
 * Endpoints: /api/produccion/eficiencias/resumen y /api/produccion/eficiencias/detalle
 */

const API_BASE = '/api/produccion/eficiencias'

/**
 * GET /api/produccion/eficiencias/resumen
 * Retorna { EFIC_TA, EFIC_TB, EFIC_TC, EFIC_DIA }
 */
export async function fetchEficienciasResumen() {
  const response = await fetch(`${API_BASE}/resumen`)
  if (!response.ok) throw new Error(`Error al obtener resumen: ${response.statusText}`)
  return response.json()
}

/**
 * POST /api/produccion/eficiencias/detalle
 * @param {string} turno - 'A' | 'B' | 'C' | 'DIA'
 * Retorna { turno, total, data: [...] }
 */
export async function fetchEficienciasDetalle(turno = 'DIA') {
  const response = await fetch(`${API_BASE}/detalle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ turno: turno.toUpperCase() })
  })
  if (!response.ok) throw new Error(`Error al obtener detalle: ${response.statusText}`)
  return response.json()
}
