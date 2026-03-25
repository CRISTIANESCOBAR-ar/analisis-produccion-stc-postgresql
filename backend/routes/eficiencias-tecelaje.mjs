/**
 * Rutas para Eficiencias de Tecelaje
 * Replica la macro VBA que calcula eficiencias por turno (A/B/C/DÍA)
 * Fuente: tb_proceso JOIN tb_fichas con filtro PROCESSO = 'TECELAGEM'
 */

import express from 'express'

const router = express.Router()

/**
 * Helper: Convertir valor TEXT a número
 */
function parseNumber(value) {
  if (!value) return 0
  const num = parseFloat(String(value).replace(',', '.'))
  return isNaN(num) ? 0 : num
}

/**
 * Helper: Calcular tiempo caída en formato hh:mm
 * Fórmula: MT_A_BATER / ((((RPM * 1440) / (BATIDAS/FIO * 100) * 0.90) / 90) * (EFIC_TURNO + 0.1)) + 0.25
 */
function calcularCaida(mtABater, rpm, batidas, eficTurno) {
  const mtA = parseNumber(mtABater)
  const rpmN = parseNumber(rpm)
  const batN = parseNumber(batidas)
  const eficN = parseNumber(eficTurno)

  if (rpmN === 0 || batN === 0) return '--:--'

  const denominador = (((rpmN * 1440) / (batN * 100)) * 0.9 / 90) * (eficN + 0.1)
  if (denominador === 0) return '--:--'

  const horas = mtA / denominador + 0.25
  const h = Math.floor(horas)
  const m = Math.round((horas - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * GET /api/produccion/eficiencias/resumen
 * Retorna eficiencias promedio por FILIAL para TECELAGEM
 * Respuesta: { EFIC_TA, EFIC_TB, EFIC_TC, EFIC_DIA }
 */
export async function getEficienciasResumen(req, res, query) {
  try {
    const sql = `
      SELECT
        LEFT("FILIAL", 1) AS UN,
        ROUND(AVG(${sqlParseNumber('"EFIC_TA"')}), 1) AS EFIC_TA,
        ROUND(AVG(${sqlParseNumber('"EFIC_TB"')}), 1) AS EFIC_TB,
        ROUND(AVG(${sqlParseNumber('"EFIC_TC"')}), 1) AS EFIC_TC,
        ROUND(AVG(${sqlParseNumber('"EFIC_DIA"')}), 1) AS EFIC_DIA
      FROM tb_processo
      WHERE BTRIM("PROCESSO") = 'TECELAGEM'
      GROUP BY LEFT("FILIAL", 1), "PROCESSO"
      LIMIT 1
    `

    const result = await query(sql, [], 'eficiencias/resumen')
    const row = result.rows[0] || {
      UN: '--',
      EFIC_TA: 0,
      EFIC_TB: 0,
      EFIC_TC: 0,
      EFIC_DIA: 0
    }

    res.json({
      EFIC_TA: `${row.efic_ta || 0}%`,
      EFIC_TB: `${row.efic_tb || 0}%`,
      EFIC_TC: `${row.efic_tc || 0}%`,
      EFIC_DIA: `${row.efic_dia || 0}%`
    })
  } catch (err) {
    console.error('Error en eficiencias/resumen:', err)
    res.status(500).json({ error: err.message })
  }
}

/**
 * POST /api/produccion/eficiencias/detalle
 * Body: { turno: 'A' | 'B' | 'C' | 'DIA' }
 * Retorna tabla de "caídas" (piezas en tecelaje) con cálculo de tiempo
 */
export async function getEficienciasDetalle(req, res, query) {
  try {
    const turno = (String(req.body?.turno || 'DIA')).toUpperCase()
    if (!['A', 'B', 'C', 'DIA'].includes(turno)) {
      return res.status(400).json({ error: 'Turno debe ser A, B, C o DIA' })
    }

    // Seleccionar columna de eficiencia según turno
    const eficCol = turno === 'A' ? 'EFIC_TA' :
                    turno === 'B' ? 'EFIC_TB' :
                    turno === 'C' ? 'EFIC_TC' :
                    'EFIC_DIA'

    const sql = `
      SELECT
        LEFT("ARTIGO", 1) AS tipo,
        LEFT("ARTIGO", 10) AS artigo,
        "COR" AS color,
        "DESC_NM_MERC" AS nombre,
        "TRAMA_REDUZIDA_1" AS trama,
        ${sqlParseNumber('"EFIC_' + turno + '"')} AS eficiencia,
        ${sqlParseNumber('"MT_PREVISTA"')} * ((100 - COALESCE(FICHAS."ENC#ACAB URD", 0)) / 100) AS metros,
        "STATUS" AS status,
        RIGHT("MAQUINA", 2)::int AS telar,
        ${sqlParseNumber('"RPM"')} AS rpm,
        "GRUPO_TEAR" AS grupo,
        LEFT("URDUME", 10) AS base_urdume,
        RIGHT("URDUME", 3) AS color_urdume,
        ${sqlParseNumber('"NUM_FIOS"')} AS hilos,
        ${sqlParseNumber('"PARTIDA"')} AS partida,
        ${sqlParseNumber('"MT_A_BATER"')} AS mt_a_bater
      FROM tb_processo PROC
      LEFT JOIN tb_fichas FICHAS ON FICHAS."ARTIGO CODIGO" = PROC."ARTIGO"
      WHERE BTRIM(PROC."PROCESSO") = 'TECELAGEM'
      ORDER BY COALESCE(RIGHT(PROC."MAQUINA", 2)::int, 0) ASC
      LIMIT 500
    `

    const result = await query(sql, [], `eficiencias/detalle/${turno}`)

    // Enriquecimiento: agregar columna calculada de "Caída" (tiempo estimado)
    const rows = result.rows.map(row => ({
      ...row,
      caida: calcularCaida(
        row.mt_a_bater,
        row.rpm,
        row.batidas_fio, // Esta viene desde el LEFT JOIN con FICHAS
        row.eficiencia
      )
    }))

    res.json({
      turno,
      total: rows.length,
      data: rows
    })
  } catch (err) {
    console.error('Error en eficiencias/detalle:', err)
    res.status(500).json({ error: err.message })
  }
}

/**
 * Helper SQL: parsear número desde TEXT
 */
function sqlParseNumber(colIdent) {
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN REPLACE(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`
}

/**
 * Mount routes
 */
router.get('/resumen', (req, res) => {
  // Será pasado por server.js como middleware
  res.json({ message: 'Use POST to /detalle' })
})

router.post('/detalle', (req, res) => {
  // Será pasado por server.js como middleware
  res.json({ message: 'Route configured in server.js' })
})

export default router
