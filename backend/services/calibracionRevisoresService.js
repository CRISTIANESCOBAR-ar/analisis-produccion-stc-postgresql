/**
 * Servicio de Calibración y Desempeño de Revisores
 */

export function construirQueryDefectosCatalogo() {
  const sql = `
    SELECT DISTINCT "COD_DEF", "DESC_DEFEITO"
    FROM tb_defectos
    WHERE "COD_DEF" IS NOT NULL AND "COD_DEF" <> ''
    ORDER BY "COD_DEF"
  `;
  return { sql, values: [] };
}

export function construirQueryCalibracion({ fechaInicio, fechaFin, codDefecto }) {
  let values = [codDefecto];
  let paramsIdx = 2;
  
  let dateFilter = '';
  if (fechaInicio && fechaFin) {
    dateFilter = `
      AND CASE 
        WHEN c."DAT_PROD" ~ '^\\d{2}/\\d{2}/\\d{4}$' 
        THEN TO_DATE(c."DAT_PROD", 'DD/MM/YYYY')
        ELSE c."DAT_PROD"::date 
      END BETWEEN $${paramsIdx} AND $${paramsIdx + 1}
    `;
    values.push(fechaInicio, fechaFin);
    paramsIdx += 2;
  }

  const sql = `
    WITH 
      piezas_por_revisor AS (
        SELECT 
          "REVISOR FINAL" AS revisor,
          COUNT(DISTINCT "PEÇA") AS total_piezas_revisadas
        FROM tb_calidad c
        WHERE "REVISOR FINAL" IS NOT NULL AND "REVISOR FINAL" <> ''
          ${dateFilter}
        GROUP BY "REVISOR FINAL"
      ),
      defectos_por_revisor AS (
        SELECT
          c."REVISOR FINAL" AS revisor,
          COUNT(DISTINCT c."PEÇA") AS piezas_con_defecto,
          SUM(CAST(REPLACE(REPLACE(d."PONTOS", '.', ''), ',', '.') AS NUMERIC)) AS puntos_totales
        FROM tb_calidad c
        INNER JOIN tb_defectos d 
          ON c."PARTIDA" = d."PARTIDA" 
          AND c."PEÇA" = d."PARTIDA" || d."PECA"
        WHERE c."REVISOR FINAL" IS NOT NULL AND c."REVISOR FINAL" <> ''
          AND d."COD_DEF" = $1
          ${dateFilter}
        GROUP BY c."REVISOR FINAL"
      )
    SELECT
      p.revisor,
      p.total_piezas_revisadas,
      COALESCE(d.piezas_con_defecto, 0)::integer AS piezas_con_defecto,
      ROUND(COALESCE(d.piezas_con_defecto, 0)::numeric / NULLIF(p.total_piezas_revisadas, 0) * 100, 2)::numeric AS tasa_deteccion_pct,
      COALESCE(d.puntos_totales, 0)::numeric AS puntos_totales,
      ROUND(COALESCE(d.puntos_totales, 0)::numeric / NULLIF(p.total_piezas_revisadas, 0), 4)::numeric AS severidad,
      ROUND(AVG(COALESCE(d.puntos_totales, 0)::numeric / NULLIF(p.total_piezas_revisadas, 0)) OVER(), 4)::numeric AS promedio_global_severidad
    FROM piezas_por_revisor p
    LEFT JOIN defectos_por_revisor d ON p.revisor = d.revisor
    ORDER BY severidad DESC NULLS LAST
  `;

  return { sql, values };
}

export function procesarResultadosCalibracion(rows) {
  if (!rows || rows.length === 0) {
    return {
      revisores: [],
      promedioGlobal: 0
    };
  }

  const promedioGlobal = rows[0]?.promedio_global_severidad != null 
    ? parseFloat(rows[0].promedio_global_severidad) 
    : 0;

  const revisores = rows.map(row => {
    const severidad = row.severidad != null ? parseFloat(row.severidad) : 0;
    
    let color = 'verde';
    if (promedioGlobal > 0) {
      if (severidad < promedioGlobal * 0.7) {
        color = 'rojo'; // Laxo
      } else if (severidad > promedioGlobal * 1.3) {
        color = 'amarillo'; // Estricto
      }
    } else {
       // Si el promedio es 0, todos los que tengan 0 son verdes, > 0 amarillo
       color = severidad > 0 ? 'amarillo' : 'verde';
    }

    return {
      revisor: row.revisor,
      total_piezas_revisadas: parseInt(row.total_piezas_revisadas, 10),
      piezas_con_defecto: parseInt(row.piezas_con_defecto, 10),
      tasa_deteccion_pct: row.tasa_deteccion_pct != null ? parseFloat(row.tasa_deteccion_pct) : 0,
      puntos_totales: row.puntos_totales != null ? parseFloat(row.puntos_totales) : 0,
      severidad: severidad,
      color: color
    };
  });

  return {
    revisores,
    promedioGlobal
  };
}
