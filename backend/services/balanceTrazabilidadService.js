/**
 * Servicio de Balance de Trazabilidad entre Tejeduría (Telar), Integrada (Acabado 165001) y Calidad (Mesa de Revisión).
 */

export function parseNumberPtBr(val) {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str || str === '-' || str === '--' || str.toUpperCase() === 'N/A') return 0;

  // Si tiene formato brasileño/latinoamericano: 1.521,00 o 207,27
  let normalized = str;
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  }
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

export function round(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round((num + Number.EPSILON) * factor) / factor;
}

export function calcularMetricasPartida(row) {
  const tecelagem = parseNumberPtBr(row.metros_tecelagem);
  const tecelagemEncolh = parseNumberPtBr(row.metros_tecelagem_encolh);
  const integrada = parseNumberPtBr(row.metros_acabamento_integrada);
  const calidad = parseNumberPtBr(row.metros_calidad_revisados);

  const diff_integrada_vs_encolh = round(integrada - tecelagemEncolh);
  const diff_calidad_vs_integrada = round(calidad - integrada);
  const diff_global_calidad_vs_encolh = round(calidad - tecelagemEncolh);

  const rend_telar_integrada_pct = tecelagemEncolh > 0
    ? round((integrada / tecelagemEncolh) * 100)
    : null;

  const rend_integrada_calidad_pct = integrada > 0
    ? round((calidad / integrada) * 100)
    : null;

  const rend_global_pct = tecelagemEncolh > 0
    ? round((calidad / tecelagemEncolh) * 100)
    : null;

  return {
    ...row,
    metros_tecelagem: tecelagem,
    metros_tecelagem_encolh: tecelagemEncolh,
    metros_acabamento_integrada: integrada,
    metros_calidad_revisados: calidad,
    diff_integrada_vs_encolh,
    diff_calidad_vs_integrada,
    diff_global_calidad_vs_encolh,
    rend_telar_integrada_pct,
    rend_integrada_calidad_pct,
    rend_global_pct
  };
}

export function procesarConsolidado(rows) {
  if (!rows || rows.length === 0) {
    return {
      partidas: [],
      kpis: {
        total_partidas: 0,
        total_metros_tecelagem: 0,
        total_metros_tecelagem_encolh: 0,
        total_metros_acabamento_integrada: 0,
        total_metros_calidad_revisados: 0,
        rend_global_telar_integrada_pct: null,
        rend_global_integrada_calidad_pct: null,
        rend_global_total_pct: null
      }
    };
  }

  let totalTec = 0;
  let totalTecEncolh = 0;
  let totalInt = 0;
  let totalCal = 0;

  const partidas = rows.map((r) => {
    const calc = calcularMetricasPartida(r);
    totalTec += calc.metros_tecelagem;
    totalTecEncolh += calc.metros_tecelagem_encolh;
    totalInt += calc.metros_acabamento_integrada;
    totalCal += calc.metros_calidad_revisados;
    return calc;
  });

  const rend_global_telar_integrada_pct = totalTecEncolh > 0
    ? round((totalInt / totalTecEncolh) * 100)
    : null;

  const rend_global_integrada_calidad_pct = totalInt > 0
    ? round((totalCal / totalInt) * 100)
    : null;

  const rend_global_total_pct = totalTecEncolh > 0
    ? round((totalCal / totalTecEncolh) * 100)
    : null;

  return {
    partidas,
    kpis: {
      total_partidas: partidas.length,
      total_metros_tecelagem: round(totalTec),
      total_metros_tecelagem_encolh: round(totalTecEncolh),
      total_metros_acabamento_integrada: round(totalInt),
      total_metros_calidad_revisados: round(totalCal),
      rend_global_telar_integrada_pct,
      rend_global_integrada_calidad_pct,
      rend_global_total_pct
    }
  };
}

/**
 * Expresión SQL estándar de casteo seguro de fechas desde DD/MM/YYYY o DD/MM/YY a DATE.
 */
function sqlSafeDate(col) {
  return `CASE 
    WHEN ${col} ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring(${col} from 1 for 10), 'DD/MM/YYYY')
    WHEN ${col} ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{2}' THEN to_date(substring(${col} from 1 for 8), 'DD/MM/YY')
    WHEN ${col} ~ '^[0-9]{4}-[0-1][0-9]-[0-3][0-9]' THEN to_date(substring(${col} from 1 for 10), 'YYYY-MM-DD')
    ELSE NULL 
  END`;
}

/**
 * Expresión SQL de parseo seguro de números con comas y puntos a NUMERIC.
 */
function sqlSafeNumeric(col) {
  return `COALESCE(NULLIF(REGEXP_REPLACE(REPLACE(REPLACE(${col}, '.', ''), ',', '.'), '[^0-9.-]', '', 'g'), '')::NUMERIC, 0)`;
}

export function construirQueryBalance({ sectorMatriz = 'INTEGRADA', fechaInicio, fechaFin, search = '' }) {
  const allowedSectores = ['INTEGRADA', 'TECELAGEM', 'CALIDAD'];
  const sector = allowedSectores.includes(String(sectorMatriz).toUpperCase())
    ? String(sectorMatriz).toUpperCase()
    : 'INTEGRADA';

  const values = [];
  let paramIdx = 1;

  let dateFilter = '';
  if (fechaInicio && fechaFin) {
    values.push(fechaInicio);
    values.push(fechaFin);
    dateFilter = `BETWEEN $${paramIdx++}::date AND $${paramIdx++}::date`;
  } else if (fechaInicio) {
    values.push(fechaInicio);
    dateFilter = `>= $${paramIdx++}::date`;
  } else if (fechaFin) {
    values.push(fechaFin);
    dateFilter = `<= $${paramIdx++}::date`;
  }

  let searchFilter = '';
  if (search && String(search).trim() !== '') {
    values.push(`%${String(search).trim()}%`);
    searchFilter = `AND (m.partida ILIKE $${paramIdx} OR m.artigo ILIKE $${paramIdx})`;
    paramIdx++;
  }

  let cteMatriz = '';

  if (sector === 'INTEGRADA') {
    cteMatriz = `
      matriz_partidas AS (
        SELECT 
          "PARTIDA" AS partida,
          MAX("ARTIGO") AS artigo,
          MIN(${sqlSafeDate('"DT_INICIO"')}) AS fecha_matriz,
          MIN("DT_INICIO") AS fecha_str,
          SUM(${sqlSafeNumeric('"METRAGEM"')}) AS metros_acabamento_integrada
        FROM tb_produccion
        WHERE "SELETOR" = 'ACABAMENTO' 
          AND "MAQUINA" = '165001'
          AND "PARTIDA" IS NOT NULL AND "PARTIDA" <> ''
          ${dateFilter ? `AND ${sqlSafeDate('"DT_INICIO"')} ${dateFilter}` : ''}
        GROUP BY "PARTIDA"
      )
    `;
  } else if (sector === 'TECELAGEM') {
    cteMatriz = `
      matriz_partidas AS (
        SELECT 
          "PARTIDA" AS partida,
          MAX("ARTIGO") AS artigo,
          MIN(${sqlSafeDate('"DT_INICIO"')}) AS fecha_matriz,
          MIN("DT_INICIO") AS fecha_str,
          SUM(${sqlSafeNumeric('"METRAGEM"')}) AS metros_tecelagem,
          SUM(${sqlSafeNumeric('"METRAGEM ENCOLH"')}) AS metros_tecelagem_encolh
        FROM tb_produccion
        WHERE "SELETOR" = 'TECELAGEM'
          AND "PARTIDA" IS NOT NULL AND "PARTIDA" <> ''
          ${dateFilter ? `AND ${sqlSafeDate('"DT_INICIO"')} ${dateFilter}` : ''}
        GROUP BY "PARTIDA"
      )
    `;
  } else {
    // CALIDAD
    cteMatriz = `
      matriz_partidas AS (
        SELECT 
          "PARTIDA" AS partida,
          MAX("ARTIGO") AS artigo,
          MIN(${sqlSafeDate('"DAT_PROD"')}) AS fecha_matriz,
          MIN("DAT_PROD") AS fecha_str,
          SUM(${sqlSafeNumeric('"METRAGEM"')}) AS metros_calidad_revisados
        FROM tb_calidad
        WHERE "PARTIDA" IS NOT NULL AND "PARTIDA" <> ''
          ${dateFilter ? `AND ${sqlSafeDate('"DAT_PROD"')} ${dateFilter}` : ''}
        GROUP BY "PARTIDA"
      )
    `;
  }

  // CTEs dependientes para cruzar los otros sectores
  const sql = `
    WITH ${cteMatriz},
    tecelagem_agg AS (
      SELECT 
        t."PARTIDA" AS partida,
        MAX(t."ARTIGO") AS artigo,
        SUM(${sqlSafeNumeric('t."METRAGEM"')}) AS metros_tecelagem,
        SUM(${sqlSafeNumeric('t."METRAGEM ENCOLH"')}) AS metros_tecelagem_encolh
      FROM tb_produccion t
      INNER JOIN matriz_partidas m ON t."PARTIDA" = m.partida
      WHERE t."SELETOR" = 'TECELAGEM'
      GROUP BY t."PARTIDA"
    ),
    integrada_agg AS (
      SELECT 
        i."PARTIDA" AS partida,
        MAX(i."ARTIGO") AS artigo,
        SUM(${sqlSafeNumeric('i."METRAGEM"')}) AS metros_acabamento_integrada
      FROM tb_produccion i
      INNER JOIN matriz_partidas m ON i."PARTIDA" = m.partida
      WHERE i."SELETOR" = 'ACABAMENTO' AND i."MAQUINA" = '165001'
      GROUP BY i."PARTIDA"
    ),
    calidad_agg AS (
      SELECT 
        c."PARTIDA" AS partida,
        SUM(${sqlSafeNumeric('c."METRAGEM"')}) AS metros_calidad_revisados
      FROM tb_calidad c
      INNER JOIN matriz_partidas m ON c."PARTIDA" = m.partida
      GROUP BY c."PARTIDA"
    )
    SELECT 
      m.partida,
      COALESCE(m.artigo, tec.artigo, int_g.artigo, 'S/D') AS artigo,
      m.fecha_matriz,
      m.fecha_str,
      ${sector === 'TECELAGEM' ? 'COALESCE(m.metros_tecelagem, 0)' : 'COALESCE(tec.metros_tecelagem, 0)'} AS metros_tecelagem,
      ${sector === 'TECELAGEM' ? 'COALESCE(m.metros_tecelagem_encolh, 0)' : 'COALESCE(tec.metros_tecelagem_encolh, 0)'} AS metros_tecelagem_encolh,
      ${sector === 'INTEGRADA' ? 'COALESCE(m.metros_acabamento_integrada, 0)' : 'COALESCE(int_g.metros_acabamento_integrada, 0)'} AS metros_acabamento_integrada,
      ${sector === 'CALIDAD' ? 'COALESCE(m.metros_calidad_revisados, 0)' : 'COALESCE(cal.metros_calidad_revisados, 0)'} AS metros_calidad_revisados
    FROM matriz_partidas m
    LEFT JOIN tecelagem_agg tec ON m.partida = tec.partida
    LEFT JOIN integrada_agg int_g ON m.partida = int_g.partida
    LEFT JOIN calidad_agg cal ON m.partida = cal.partida
    WHERE 1=1
    ${searchFilter}
    ORDER BY m.fecha_matriz DESC NULLS LAST, m.partida DESC;
  `;

  return { sql, values };
}
