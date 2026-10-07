/**
 * Servicio de Calibración y Desempeño de Revisores
 */

export function construirQueryRevisores() {
  const sql = `
    SELECT DISTINCT "REVISOR FINAL" as revisor
    FROM tb_calidad
    WHERE "REVISOR FINAL" IS NOT NULL AND "REVISOR FINAL" <> ''
    ORDER BY "REVISOR FINAL"
  `;
  return { sql, values: [] };
}

export function construirQueryRankingMetros({ fecha, tipo }) {
  let dateFilter = '';
  const values = [];
  
  if (tipo === 'mes') {
    dateFilter = `EXTRACT(YEAR FROM TO_DATE(C."DAT_PROD", 'DD/MM/YYYY')) = EXTRACT(YEAR FROM $1::date) 
                  AND EXTRACT(MONTH FROM TO_DATE(C."DAT_PROD", 'DD/MM/YYYY')) = EXTRACT(MONTH FROM $1::date)`;
    values.push(fecha);
  } else {
    // dia
    dateFilter = `TO_DATE(C."DAT_PROD", 'DD/MM/YYYY') = $1::date`;
    values.push(fecha);
  }

  const dateFilterPartidas = dateFilter.replace(/C\./g, '');

  const sql = `
    WITH Fichas AS (
      SELECT "ARTIGO CODIGO", MAX(REPLACE(REPLACE("LARGURA", '.', ''), ',', '.')::numeric) AS largura
      FROM tb_fichas
      GROUP BY "ARTIGO CODIGO"
    ),
    BaseData AS (
      SELECT 
        C."REVISOR FINAL" as revisor,
        C."PEÇA" as peca,
        MAX(C."QUALIDADE") as qualidade,
        SUM(REPLACE(REPLACE(C."METRAGEM", '.', ''), ',', '.')::numeric) as metros_pieza,
        AVG(COALESCE(REPLACE(REPLACE(C."PONTUACAO", '.', ''), ',', '.')::numeric, 0)) as puntos_pieza,
        SUM(REPLACE(REPLACE(C."METRAGEM", '.', ''), ',', '.')::numeric) * (COALESCE(MAX(F.largura), 150) / 100.0) as area_pieza,
        SUM(CASE WHEN C."REPROCESSO" = 'R' THEN REPLACE(REPLACE(C."METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) as metros_repro
      FROM tb_calidad C
      LEFT JOIN Fichas F ON C."ARTIGO" = F."ARTIGO CODIGO"
      WHERE ${dateFilter}
      GROUP BY C."REVISOR FINAL", C."PEÇA"
    ),
    PartidasCount AS (
      SELECT "REVISOR FINAL" as revisor, COUNT(DISTINCT "PARTIDA") as cant_partidas
      FROM tb_calidad
      WHERE "ST IND" != 'N' AND ${dateFilterPartidas}
      GROUP BY "REVISOR FINAL"
    )
    SELECT 
      B.revisor,
      SUM(B.metros_pieza) as total_metros,
      SUM(B.puntos_pieza) as total_puntos,
      SUM(B.area_pieza) as total_area,
      SUM(CASE WHEN B.puntos_pieza = 0 AND B.qualidade = 'PRIMEIRA' THEN 1 ELSE 0 END) as piezas_limpias,
      SUM(CASE WHEN B.qualidade = 'PRIMEIRA' THEN 1 ELSE 0 END) as piezas_primera,
      SUM(B.metros_repro) as total_reproceso,
      COALESCE(MAX(P.cant_partidas), 0) as cant_partidas_dif
    FROM BaseData B
    LEFT JOIN PartidasCount P ON B.revisor = P.revisor
    GROUP BY B.revisor
    ORDER BY total_metros DESC
  `;

  return { sql, values };
}

export function procesarResultadosRanking(rows, revisoresSeleccionados) {
  if (!revisoresSeleccionados || revisoresSeleccionados.length === 0) {
    return [];
  }

  const formatRow = (row, revisorName) => {
    const metros = row ? parseFloat(row.total_metros) || 0 : 0;
    const puntos = row ? parseFloat(row.total_puntos) || 0 : 0;
    const area = row ? parseFloat(row.total_area) || 0 : 0;
    const limpias = row ? parseInt(row.piezas_limpias, 10) || 0 : 0;
    const primera = row ? parseInt(row.piezas_primera, 10) || 0 : 0;
    const repro = row ? parseFloat(row.total_reproceso) || 0 : 0;
    const partidas = row ? parseInt(row.cant_partidas_dif, 10) || 0 : 0;

    return {
      revisor: revisorName,
      metros_totales: metros,
      pts_100m: area > 0 ? parseFloat(((puntos / area) * 100).toFixed(2)) : 0,
      pct_sin_defecto: primera > 0 ? parseFloat(((limpias / primera) * 100).toFixed(2)) : 0,
      metros_repro: repro,
      partidas_no_n: partidas
    };
  };

  const processed = revisoresSeleccionados.map(r => {
    const found = (rows || []).find(row => row.revisor === r);
    return formatRow(found, r);
  }).sort((a, b) => b.metros_totales - a.metros_totales);

  processed.forEach((d, i) => d.ord = i + 1);
  return processed;
}

export function construirQueryIA({ fechaInicio, fechaFin }) {
  let values = [];
  let paramsIdx = 1;
  
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
      piezas_unicas AS (
        SELECT 
          c."PARTIDA",
          c."PEÇA",
          c."REVISOR FINAL" AS revisor,
          c."ROLADA",
          MAX(CAST(REPLACE(REPLACE(c."METRAGEM", '.', ''), ',', '.') AS NUMERIC)) AS metros,
          MAX(CASE WHEN c."QUALIDADE" = 'CORTES NATURALES' THEN 1 ELSE 0 END) AS es_corte_natural
        FROM tb_calidad c
        WHERE c."REVISOR FINAL" IS NOT NULL AND c."REVISOR FINAL" <> ''
          ${dateFilter}
        GROUP BY c."PARTIDA", c."PEÇA", c."REVISOR FINAL", c."ROLADA"
      ),
      puntos_por_pieza AS (
        SELECT 
          "PARTIDA" || "PECA" AS "PEÇA",
          SUM(CASE WHEN "COD_DEF" = '205' THEN CAST(REPLACE(REPLACE("PONTOS", '.', ''), ',', '.') AS NUMERIC) ELSE 0 END) as puntos_205,
          SUM(CAST(REPLACE(REPLACE("PONTOS", '.', ''), ',', '.') AS NUMERIC)) as puntos_totales
        FROM tb_defectos
        GROUP BY "PARTIDA", "PECA"
      )
    SELECT
      pu."ROLADA" as rolada,
      pu.revisor,
      SUM(pu.metros) AS metros_totales,
      SUM(pu.es_corte_natural) AS cortes_naturales,
      SUM(COALESCE(ppp.puntos_205, 0)) as pts_205,
      SUM(COALESCE(ppp.puntos_totales, 0)) as pts_totales
    FROM piezas_unicas pu
    LEFT JOIN puntos_por_pieza ppp ON pu."PEÇA" = ppp."PEÇA"
    WHERE pu."ROLADA" IS NOT NULL AND pu."ROLADA" <> ''
    GROUP BY pu."ROLADA", pu.revisor
    ORDER BY pu."ROLADA", pu.revisor
  `;

  return { sql, values };
}

export function procesarResultadosIA(rows) {
  if (!rows || rows.length === 0) {
    return [];
  }

  const roladasMap = {};

  rows.forEach(row => {
    const rolada = row.rolada;
    if (!roladasMap[rolada]) {
      roladasMap[rolada] = [];
    }

    const metros = parseFloat(row.metros_totales) || 0;
    const ptsTotales = parseFloat(row.pts_totales) || 0;
    const pts205 = parseFloat(row.pts_205) || 0;
    
    roladasMap[rolada].push({
      revisor: row.revisor,
      pts_100m: metros > 0 ? parseFloat(((ptsTotales / metros) * 100).toFixed(2)) : 0,
      pts_205_100m: metros > 0 ? parseFloat(((pts205 / metros) * 100).toFixed(2)) : 0,
      cortes_naturales: parseInt(row.cortes_naturales, 10) || 0,
      metros_totales: metros
    });
  });

  return Object.keys(roladasMap).map(rolada => ({
    rolada,
    desempeño_revisores: roladasMap[rolada]
  }));
}
