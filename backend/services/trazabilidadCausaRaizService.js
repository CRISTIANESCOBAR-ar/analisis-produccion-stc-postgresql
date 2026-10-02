/**
 * Servicio de Trazabilidad Causa Raíz
 */

export function construirQueryTrazabilidadCausaRaiz({ fechaInicio, fechaFin, codDefecto, lotes }) {
  let values = [codDefecto];
  let paramsIdx = 2;
  
  let dateFilter = '';
  if (fechaInicio && fechaFin) {
    dateFilter = `
      AND CASE 
        WHEN "DT_BASE_PRODUCAO" ~ '^\\d{2}/\\d{2}/\\d{4}$' 
        THEN TO_DATE("DT_BASE_PRODUCAO", 'DD/MM/YYYY')
        ELSE "DT_BASE_PRODUCAO"::date 
      END BETWEEN $${paramsIdx} AND $${paramsIdx + 1}
    `;
    values.push(fechaInicio, fechaFin);
    paramsIdx += 2;
  }

  let loteFilter = '';
  if (lotes) {
    const lotesArray = lotes.split(',').map(l => l.trim()).filter(l => l);
    if (lotesArray.length > 0) {
      const placeholders = lotesArray.map((_, i) => `$${paramsIdx + i}`).join(', ');
      loteFilter = `AND LTRIM("LOTE FIACAO", '0') IN (${placeholders})`;
      values.push(...lotesArray);
      paramsIdx += lotesArray.length;
    }
  }

  const sql = `
    WITH
      lotes_periodo AS (
        SELECT DISTINCT
          LTRIM("LOTE FIACAO", '0') AS lote
        FROM tb_produccion
        WHERE "LOTE FIACAO" IS NOT NULL AND "LOTE FIACAO" <> ''
          ${dateFilter}
          ${loteFilter}
      ),
      roladas_lote AS (
        SELECT
          LTRIM(p."LOTE FIACAO", '0') AS lote,
          COUNT(DISTINCT p."PARTIDA") AS total_partidas,
          COUNT(DISTINCT p."ROLADA") AS total_roladas
        FROM tb_produccion p
        INNER JOIN lotes_periodo lp ON LTRIM(p."LOTE FIACAO", '0') = lp.lote
        GROUP BY LTRIM(p."LOTE FIACAO", '0')
      ),
      defectos_lote AS (
        SELECT
          LTRIM(p."LOTE FIACAO", '0') AS lote,
          SUM(CAST(REPLACE(REPLACE(d."PONTOS", '.', ''), ',', '.') AS NUMERIC)) AS puntos_defecto,
          COUNT(*) AS ocurrencias_defecto
        FROM tb_produccion p
        INNER JOIN tb_defectos d ON p."PARTIDA" = d."PARTIDA"
        INNER JOIN lotes_periodo lp ON LTRIM(p."LOTE FIACAO", '0') = lp.lote
        WHERE d."COD_DEF" = $1
        GROUP BY LTRIM(p."LOTE FIACAO", '0')
      ),
      hvi_lote AS (
        SELECT
          LTRIM("MISTURA", '0') AS lote,
          AVG(CAST(REPLACE(REPLACE("UI", '.', ''), ',', '.') AS NUMERIC)) AS avg_ui,
          AVG(CAST(REPLACE(REPLACE("SF", '.', ''), ',', '.') AS NUMERIC)) AS avg_sf,
          AVG(CAST(REPLACE(REPLACE("MIC", '.', ''), ',', '.') AS NUMERIC)) AS avg_mic,
          AVG(CAST(REPLACE(REPLACE("TrCNT", '.', ''), ',', '.') AS NUMERIC)) AS avg_trcnt
        FROM tb_calidad_fibra
        WHERE "MISTURA" IS NOT NULL AND "MISTURA" <> ''
        GROUP BY LTRIM("MISTURA", '0')
      ),
      uster_lote AS (
        SELECT
          LTRIM(SPLIT_PART(u.lote, '-', 2), '0') AS lote,
          AVG(t.neps_140_km) AS avg_neps_140,
          AVG(t.grue_50_km) AS avg_grue_50,
          AVG(t.cvm_percent) AS avg_cvm
        FROM tb_uster_par u
        INNER JOIN tb_uster_tbl t ON t.testnr = u.testnr
        WHERE u.lote LIKE 'HD-%'
        GROUP BY LTRIM(SPLIT_PART(u.lote, '-', 2), '0')
      ),
      tensorapid_lote AS (
        SELECT
          LTRIM(SPLIT_PART(u.lote, '-', 2), '0') AS lote,
          AVG(tt.tenacidad) AS avg_tenacidad,
          AVG(tt.elongacion) AS avg_elongacion
        FROM tb_tensorapid_par tp
        INNER JOIN tb_uster_par u ON tp.uster_testnr = u.testnr
        INNER JOIN tb_tensorapid_tbl tt ON tt.testnr = tp.testnr
        WHERE u.lote LIKE 'HD-%'
        GROUP BY LTRIM(SPLIT_PART(u.lote, '-', 2), '0')
      ),
      oe_lote AS (
        SELECT
          LTRIM("LOTE PRODUC", '0') AS lote,
          CAST(RIGHT(maquina, 2) AS INTEGER)::TEXT 
            || CASE WHEN lado IN ('A','B') THEN lado ELSE '' END AS maquina_label,
          SUM(CAST(REPLACE(REPLACE("CORT NAT", '.', ''), ',', '.') AS NUMERIC)) AS cortes_totales,
          SUM(CAST(REPLACE(REPLACE("PROD INFORMADA", '.', ''), ',', '.') AS NUMERIC)) AS prod_total
        FROM tb_produccion_oe
        WHERE "LOTE PRODUC" IS NOT NULL AND "LOTE PRODUC" <> ''
        GROUP BY LTRIM("LOTE PRODUC", '0'),
                 CAST(RIGHT(maquina, 2) AS INTEGER)::TEXT 
                   || CASE WHEN lado IN ('A','B') THEN lado ELSE '' END
      )
    SELECT
      lp.lote,
      COALESCE(rl.total_partidas, 0)::integer AS total_partidas,
      COALESCE(rl.total_roladas, 0)::integer AS total_roladas,
      COALESCE(dl.puntos_defecto, 0)::numeric AS puntos_defecto,
      COALESCE(dl.ocurrencias_defecto, 0)::integer AS ocurrencias_defecto,
      ROUND(h.avg_ui, 2)::numeric AS avg_ui,
      ROUND(h.avg_sf, 2)::numeric AS avg_sf,
      ROUND(h.avg_mic, 2)::numeric AS avg_mic,
      ROUND(h.avg_trcnt, 2)::numeric AS avg_trcnt,
      ROUND(us.avg_neps_140, 2)::numeric AS avg_neps_140,
      ROUND(us.avg_grue_50, 2)::numeric AS avg_grue_50,
      ROUND(us.avg_cvm, 2)::numeric AS avg_cvm,
      ROUND(ten.avg_tenacidad, 2)::numeric AS avg_tenacidad,
      ROUND(ten.avg_elongacion, 2)::numeric AS avg_elongacion,
      oe.maquina_label AS oe_maquina,
      oe.cortes_totales AS cortes_oe_absolutos,
      ROUND(oe.cortes_totales / NULLIF(oe.prod_total, 0), 4)::numeric AS tasa_cortes_oe
    FROM lotes_periodo lp
    LEFT JOIN roladas_lote rl ON rl.lote = lp.lote
    LEFT JOIN defectos_lote dl ON dl.lote = lp.lote
    LEFT JOIN hvi_lote h ON h.lote = lp.lote
    LEFT JOIN uster_lote us ON us.lote = lp.lote
    LEFT JOIN tensorapid_lote ten ON ten.lote = lp.lote
    LEFT JOIN oe_lote oe ON oe.lote = lp.lote
    ORDER BY CAST(NULLIF(lp.lote, '') AS INTEGER) ASC NULLS LAST
  `;

  return { sql, values };
}

export function procesarConsolidadoCausaRaiz(rows) {
  if (!rows || rows.length === 0) {
    return { data: [], kpis: {} };
  }

  // Agrupar filas por lote (ya que oe_lote puede duplicar por máquina)
  const lotesMap = new Map();

  let sumCortes = 0;
  let countCortes = 0;
  let sumTrcnt = 0;
  let countTrcnt = 0;
  let sumMic = 0;
  let countMic = 0;
  let totalPuntosDefecto = 0;

  for (const row of rows) {
    let loteData = lotesMap.get(row.lote);
    
    if (!loteData) {
      loteData = {
        lote: row.lote,
        total_partidas: parseInt(row.total_partidas, 10),
        total_roladas: parseInt(row.total_roladas, 10),
        puntos_defecto: parseFloat(row.puntos_defecto || 0),
        ocurrencias_defecto: parseInt(row.ocurrencias_defecto || 0, 10),
        avg_ui: row.avg_ui != null ? parseFloat(row.avg_ui) : null,
        avg_sf: row.avg_sf != null ? parseFloat(row.avg_sf) : null,
        avg_mic: row.avg_mic != null ? parseFloat(row.avg_mic) : null,
        avg_trcnt: row.avg_trcnt != null ? parseFloat(row.avg_trcnt) : null,
        avg_neps_140: row.avg_neps_140 != null ? parseFloat(row.avg_neps_140) : null,
        avg_grue_50: row.avg_grue_50 != null ? parseFloat(row.avg_grue_50) : null,
        avg_cvm: row.avg_cvm != null ? parseFloat(row.avg_cvm) : null,
        avg_tenacidad: row.avg_tenacidad != null ? parseFloat(row.avg_tenacidad) : null,
        avg_elongacion: row.avg_elongacion != null ? parseFloat(row.avg_elongacion) : null,
        maquinas_oe: []
      };
      
      lotesMap.set(row.lote, loteData);

      // Sumar para KPIs globales (solo una vez por lote)
      if (loteData.avg_trcnt !== null) {
        sumTrcnt += loteData.avg_trcnt;
        countTrcnt++;
      }
      if (loteData.avg_mic !== null) {
        sumMic += loteData.avg_mic;
        countMic++;
      }
      totalPuntosDefecto += loteData.puntos_defecto;
    }

    if (row.oe_maquina) {
      const cortesAbsolutos = row.cortes_oe_absolutos != null ? parseInt(row.cortes_oe_absolutos, 10) : 0;
      const tasaCortes = row.tasa_cortes_oe != null ? parseFloat(row.tasa_cortes_oe) : 0;
      loteData.maquinas_oe.push({
        maquina: row.oe_maquina,
        cortes_absolutos: cortesAbsolutos,
        tasa_cortes: tasaCortes
      });
      
      sumCortes += tasaCortes;
      countCortes++;
    }
  }

  // Convertir a array y calcular promedios de OE por lote
  const data = Array.from(lotesMap.values()).map(lote => {
    // Calcular promedio general de OE si hay múltiples máquinas para simplificar gráficos
    let cortesPromedio = null;
    if (lote.maquinas_oe.length > 0) {
      const sum = lote.maquinas_oe.reduce((acc, curr) => acc + curr.tasa_cortes, 0);
      cortesPromedio = sum / lote.maquinas_oe.length;
    }
    
    return {
      ...lote,
      cortes_oe_promedio: cortesPromedio
    };
  });

  const kpis = {
    avg_cortes_oe: countCortes > 0 ? sumCortes / countCortes : 0,
    avg_trcnt: countTrcnt > 0 ? sumTrcnt / countTrcnt : 0,
    avg_mic: countMic > 0 ? sumMic / countMic : 0,
    total_puntos_defecto: totalPuntosDefecto
  };

  return { data, kpis };
}
