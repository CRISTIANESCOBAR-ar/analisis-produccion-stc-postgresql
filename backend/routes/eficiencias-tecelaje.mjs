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
 * Helper: Calcular fecha+hora estimada de finalización del lote
 * Fórmula: MT_A_BATER / ((((RPM * 1440) / (BATIDAS/FIO * 100) * 0.90) / 90) * (EFIC_TURNO + 0.1)) + 0.25
 * El resultado en días fraccionarios se suma a la fecha actual → fecha proyectada de caída con hora.
 * Retorna { caida: "28/03/2026 08:45", caida_ms: <timestamp para ordenar> }
 */
function calcularCaida(mtABater, rpm, batidas, eficTurno) {
  const mtA = parseNumber(mtABater)
  const rpmN = parseNumber(rpm)
  const batN = parseNumber(batidas)
  const eficN = parseNumber(eficTurno)

  if (rpmN === 0 || batN === 0) return { caida: '--/--/---- --:--', caida_ms: Infinity, turno_caida: '--' }

  const denominador = (((rpmN * 1440) / (batN * 100)) * 0.9 / 90) * (eficN + 0.1)
  if (denominador === 0) return { caida: '--/--/---- --:--', caida_ms: Infinity, turno_caida: '--' }

  const diasRestantes = mtA / denominador + 0.25
  const fechaCaida = new Date(Date.now() + diasRestantes * 24 * 60 * 60 * 1000)

  const dd = String(fechaCaida.getDate()).padStart(2, '0')
  const mm = String(fechaCaida.getMonth() + 1).padStart(2, '0')
  const yyyy = fechaCaida.getFullYear()
  const hh = String(fechaCaida.getHours()).padStart(2, '0')
  const min = String(fechaCaida.getMinutes()).padStart(2, '0')

  const hora = fechaCaida.getHours()
  const turno_caida = hora >= 6 && hora < 14 ? 'A' :
                      hora >= 14 && hora < 22 ? 'B' : 'C'

  return { caida: `${dd}/${mm}/${yyyy} ${hh}:${min}`, caida_ms: fechaCaida.getTime(), turno_caida }
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
      FROM tb_proceso
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
        LEFT(PROC."ARTIGO", 1) AS tipo,
        LEFT(PROC."ARTIGO", 10) AS artigo,
        PROC."COR" AS color,
        PROC."DESC_NM_MERC" AS nombre,
        PROC."TRAMA_REDUZIDA_1" AS trama,
        ${sqlParseNumber('PROC."' + eficCol + '"')} AS efi,
        ${sqlParseNumber('PROC."MT_PREVISTA"')} * ((100 - COALESCE(${sqlParseNumber('FICHAS."ENC#ACAB URD"')}, 0)) / 100) AS metros,
        ${sqlParseNumber('PROC."MT_PREVISTA"')} AS metros_a_tejer,
        ${sqlParseNumber('PROC."MT_DISPONIV"')} AS tejido,
        ${sqlParseNumber('PROC."MT_A_BATER"')} AS resto,
        ${sqlParseNumber('PROC."MT_PROX24H"')} AS m24,
        COALESCE(${sqlParseNumber('FICHAS."ENC#ACAB URD"')}, 0) AS enc_urd,
        PROC."STATUS" AS status,
        CASE WHEN RIGHT(PROC."MAQUINA", 2) ~ '^[0-9]+$' THEN RIGHT(PROC."MAQUINA", 2)::int ELSE NULL END AS telar,
        ${sqlParseNumber('PROC."RPM"')} AS rpm,
        PROC."GRUPO_TEAR" AS grupo,
        LEFT(PROC."URDUME", 10) AS base_urdume,
        RIGHT(PROC."URDUME", 3) AS color_urdume,
        ${sqlParseNumber('PROC."NUM_FIOS"')} AS hilos,
        ${sqlParseNumber('PROC."LARGURA"')} AS ancho,
        ${sqlParseNumber('PROC."PARTIDA"')} AS partida,
        ${sqlParseNumber('PROC."BATIDAS"')} AS batidas_fio,
        FICHAS."SARJA" AS sarja,
        ${sqlParseNumber('FICHAS."BATIDAS/FIO"')} AS pas
      FROM tb_proceso PROC
      LEFT JOIN tb_fichas FICHAS ON FICHAS."ARTIGO CODIGO" = PROC."ARTIGO"
      WHERE BTRIM(PROC."PROCESSO") = 'TECELAGEM'
      ORDER BY COALESCE(CASE WHEN RIGHT(PROC."MAQUINA", 2) ~ '^[0-9]+$' THEN RIGHT(PROC."MAQUINA", 2)::int ELSE 0 END, 0) ASC
      LIMIT 500
    `

    const result = await query(sql, [], `eficiencias/detalle/${turno}`)

    // Enriquecimiento: agregar columna calculada de "Caída" (fecha+hora estimada) y ordenar ASC
    const rows = result.rows
      .map(row => {
        const partidaStr = row.partida != null ? String(row.partida) : ''
        const roladaStr = partidaStr.slice(-6).slice(0, 4)
        const { caida, caida_ms, turno_caida } = calcularCaida(
          row.resto,
          row.rpm,
          row.batidas_fio,
          row.efi
        )
        return {
          ...row,
          rolada: roladaStr.length === 4 ? Number(roladaStr) : null,
          caida,
          caida_ms,
          turno_caida
        }
      })
      .sort((a, b) => a.caida_ms - b.caida_ms)
      .map(({ caida_ms, ...rest }) => rest)

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
 * Maneja formato brasileño con punto de miles y coma decimal: 1.809,64
 */
function sqlParseNumber(colIdent) {
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      -- Formato brasileño con miles: 1.809,64  o  2.325,00
      WHEN ${colIdent} ~ '^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$' THEN
        REPLACE(REPLACE(${colIdent}, '.', ''), ',', '.')::numeric
      -- Formato coma-decimal simple: 462,20  o  96,11
      WHEN ${colIdent} ~ '^-?[0-9]+(,[0-9]+)?$' THEN
        REPLACE(${colIdent}, ',', '.')::numeric
      -- Formato punto-decimal o entero: 462.20  o  146
      WHEN ${colIdent} ~ '^-?[0-9]+[.][0-9]+$' THEN
        ${colIdent}::numeric
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
