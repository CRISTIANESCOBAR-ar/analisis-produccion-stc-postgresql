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

// ============================================================================
// VISTA POR ROLADA (V3 Plan)
// ============================================================================

export function construirQueryTrazabilidadPorRolada({ fechaInicio, fechaFin, codigosDefecto, roladas }) {
  let values = [];
  let paramsIdx = 1;

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

  let roladasFilter = '';
  if (roladas) {
    const roladasArray = String(roladas).split(',').map(l => l.trim()).filter(l => l);
    if (roladasArray.length > 0) {
      const placeholders = roladasArray.map((_, i) => `$${paramsIdx + i}`).join(', ');
      roladasFilter = `AND LTRIM("ROLADA", '0') IN (${placeholders})`;
      values.push(...roladasArray);
      paramsIdx += roladasArray.length;
    }
  }

  let defFilter = 'AND "COD_DEF" IN (\'205\')'; // fallback
  if (codigosDefecto) {
    const defArray = Array.isArray(codigosDefecto) ? codigosDefecto : String(codigosDefecto).split(',');
    const cleanDefs = defArray.map(d => String(d).trim()).filter(d => d);
    if (cleanDefs.length > 0) {
      const defPlaceholders = cleanDefs.map((_, i) => `$${paramsIdx + i}`).join(', ');
      defFilter = `AND "COD_DEF" IN (${defPlaceholders})`;
      values.push(...cleanDefs);
      paramsIdx += cleanDefs.length;
    }
  }

  const sql = `
    WITH
      IND AS (
        SELECT
          "ROLADA" AS rolada,
          MAX("DT_BASE_PRODUCAO") AS fecha_indigo,
          MAX("ARTIGO") AS base
        FROM tb_produccion
        WHERE "SELETOR" = 'INDIGO' AND "FILIAL" = '05'
          ${dateFilter}
          ${roladasFilter}
        GROUP BY "ROLADA"
      ),
      URD AS (
        SELECT
          p."ROLADA" AS rolada,
          string_agg(DISTINCT LTRIM(p."LOTE FIACAO", '0'), ', ') AS lotes_oe,
          string_agg(DISTINCT 
            CASE 
              WHEN p."MAQ FIACAO" ~ '^[0-9]+$' THEN CAST(CAST(RIGHT(p."MAQ FIACAO", 2) AS INTEGER) AS TEXT)
              ELSE p."MAQ FIACAO"
            END
          , ', ') AS maq_oe
        FROM tb_produccion p
        INNER JOIN IND i ON p."ROLADA" = i.rolada
        WHERE p."SELETOR" IN ('URDIDEIRA', 'URDIDORA') AND p."FILIAL" = '05'
        GROUP BY p."ROLADA"
      ),
      DEF AS (
        SELECT
          LEFT(RIGHT(BTRIM("PARTIDA"), 6), 4) AS rolada,
          SUM(CAST(REPLACE(REPLACE("PONTOS",'.','' ),',','.' ) AS NUMERIC)) AS puntos_revision
        FROM tb_defectos
        WHERE "QUALIDADE" = '1'
          ${defFilter}
        GROUP BY LEFT(RIGHT(BTRIM("PARTIDA"), 6), 4)
      )
    SELECT
      IND.rolada,
      URD.maq_oe,
      URD.lotes_oe,
      IND.base,
      IND.fecha_indigo,
      COALESCE(DEF.puntos_revision, 0) AS puntos_revision
    FROM IND
    LEFT JOIN URD ON URD.rolada = IND.rolada
    LEFT JOIN DEF ON LTRIM(DEF.rolada, '0') = LTRIM(IND.rolada, '0')
    ORDER BY CAST(NULLIF(LTRIM(IND.rolada, '0'), '') AS INTEGER) ASC NULLS LAST
  `;

  return { sql, values };
}

export function construirQueryCortesOE(lotes) {
  let values = [];
  let filter = '';
  
  if (lotes && lotes.length > 0) {
    const placeholders = lotes.map((_, i) => `$${i + 1}`).join(', ');
    filter = `WHERE LTRIM("LOTE PRODUC", '0') IN (${placeholders})`;
    values.push(...lotes);
  } else {
    filter = 'WHERE 1=0'; // No query if no lotes
  }

  const sql = `
    SELECT
      LTRIM("LOTE PRODUC", '0') AS lote,
      maquina,
      data_producao,
      turno,
      BTRIM("item") AS item,
      SUM(CAST(REPLACE(REPLACE("CORT NAT",'.','' ),',','.' ) AS NUMERIC)) AS cortes_nat,
      SUM(CAST(REPLACE(REPLACE("PROD INFORMADA",'.','' ),',','.' ) AS NUMERIC)) AS prod_kg
    FROM tb_produccion_oe
    ${filter}
    GROUP BY LTRIM("LOTE PRODUC", '0'), maquina, data_producao, turno, BTRIM("item")
  `;
  return { sql, values };
}

export function construirQueryCortesEnergia() {
  const sql = `
    SELECT 
      data_base AS fecha,
      turno,
      COUNT(DISTINCT hora_inicio) AS eventos_energia,
      SUM(CAST(REPLACE(duracao, ',', '.') AS NUMERIC)) / 
        NULLIF(COUNT(DISTINCT maquina), 0) AS duracion_promedio_min
    FROM tb_paradas
    WHERE BTRIM(processo) = 'TEARES'
      AND CAST(motivo AS INTEGER) = 401
    GROUP BY data_base, turno
  `;
  return { sql, values: [] };
}

export function procesarTrazabilidadPorRolada(roladasRows, oeRows, energiaRows, hviMap) {
  if (!roladasRows || roladasRows.length === 0) {
    return { data: [], maquinasOE: [] };
  }

  const baseItemMap = {
    'U10/1-4760': ['0523096'],
    'U12.5-4760': ['0957330'],
    '10+10F4760': ['0523096', '0804526'],
    'U12.5-5696': ['0957330'],
    'U10+9F4760': ['0523096', '0957615'],
    'U12/1-4760': ['0523098'],
    'U13/1-5696': ['0803047']
  };

  // Pre-process OE and Energia
  // Energia: map by fecha + turno
  const energiaMap = new Map();
  if (energiaRows) {
    for (const er of energiaRows) {
      const key = `${er.fecha}_${er.turno}`;
      energiaMap.set(key, parseInt(er.eventos_energia || 0, 10));
    }
  }

  // OE: group by lote -> array of rows
  const oeByLote = new Map();
  if (oeRows) {
    for (const o of oeRows) {
      const lote = o.lote;
      if (!oeByLote.has(lote)) oeByLote.set(lote, []);
      oeByLote.get(lote).push(o);
    }
  }

  const resultData = [];
  const maquinasSet = new Set();

  for (const r of roladasRows) {
    const lotes = r.lotes_oe ? r.lotes_oe.split(',').map(l => l.trim()).filter(l => l) : [];
    const maquinasUrd = r.maq_oe ? r.maq_oe.split(',').map(m => m.trim()).filter(m => m) : [];
    const base10 = r.base ? r.base.substring(0, 10).toUpperCase() : '';
    const allowedItems = baseItemMap[base10] || [];
    
    // Agg HVI for this rolada based on its lotes
    let sumUI = 0, sumMic = 0, sumSF = 0;
    let countHvi = 0;
    
    // Agg OE metrics and periods
    const roladaMaquinas = new Map();
    const periodosRolada = new Set();

    for (const lote of lotes) {
      // HVI
      if (hviMap && hviMap[lote]) {
        const { UI, MIC, SF } = hviMap[lote];
        if (UI) { sumUI += parseFloat(UI); sumMic += parseFloat(MIC); sumSF += parseFloat(SF); countHvi++; }
      }

      // OE & Energia
      if (oeByLote.has(lote)) {
        const rowsForLote = oeByLote.get(lote);
        for (const o of rowsForLote) {
          if (allowedItems.length > 0 && !allowedItems.includes(o.item)) {
            continue;
          }

          let maquinaKey = 'Desconocida';
          if (o.maquina) {
            const mRaw = o.maquina.replace(/[^0-9]/g, '');
            if (mRaw.length >= 2) {
              maquinaKey = parseInt(mRaw.slice(-2), 10).toString();
            } else if (mRaw) {
              maquinaKey = parseInt(mRaw, 10).toString();
            }
          }

          if (maquinasUrd.length > 0 && !maquinasUrd.includes(maquinaKey)) {
            continue;
          }

          maquinasSet.add(maquinaKey);

          if (!roladaMaquinas.has(maquinaKey)) {
            roladaMaquinas.set(maquinaKey, { cortes: 0, prod: 0 });
          }
          const rm = roladaMaquinas.get(maquinaKey);
          rm.cortes += parseFloat(o.cortes_nat || 0);
          rm.prod += parseFloat(o.prod_kg || 0);

          if (o.data_producao && o.turno) {
            periodosRolada.add(`${o.data_producao}_${o.turno}`);
          }
        }
      }
    }

    // Calcular eventos de energía para esta rolada
    let cortesEnergia = 0;
    for (const p of periodosRolada) {
      if (energiaMap.has(p)) {
        cortesEnergia += energiaMap.get(p);
      }
    }

    // Build the row object
    const rowObj = {
      rolada: r.rolada,
      maq_oe: r.maq_oe,
      lotes_oe: r.lotes_oe,
      base: r.base,
      fecha_indigo: r.fecha_indigo,
      hvi_ui: countHvi > 0 ? (sumUI / countHvi).toFixed(1) : null,
      hvi_mic: countHvi > 0 ? (sumMic / countHvi).toFixed(2) : null,
      hvi_sf: countHvi > 0 ? (sumSF / countHvi).toFixed(1) : null,
      cortes_energia: cortesEnergia,
      puntos_revision: parseFloat(r.puntos_revision || 0)
    };

    // Cortes por maquina
    for (const maq of maquinasSet) {
      if (roladaMaquinas.has(maq)) {
        const md = roladaMaquinas.get(maq);
        rowObj[`cortes_maq_${maq}`] = md.prod > 0 ? parseFloat((md.cortes / md.prod).toFixed(4)) : null;
      } else {
        rowObj[`cortes_maq_${maq}`] = null;
      }
    }

    resultData.push(rowObj);
  }

  // Sort maquina columns numerically if possible
  const maquinasOE = Array.from(maquinasSet).sort((a, b) => {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });

  return { data: resultData, maquinasOE };
}

export function construirQueryHVI(lotes) {
  let values = [];
  let filter = 'WHERE 1=0';
  if (lotes && lotes.length > 0) {
    // the lotes array already contains stripped short strings (e.g. "104")
    const placeholders = lotes.map((_, i) => `$${i + 1}::text`).join(', ');
    filter = `WHERE "TIPO_MOV" = 'MIST' AND "MISTURA" IS NOT NULL AND CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS INTEGER)::TEXT IN (${placeholders})`;
    values.push(...lotes);
  }

  const sql = `
    SELECT
      "LOTE_FIAC",
      CAST(REPLACE(REPLACE("UI", '.', ''), ',', '.') AS NUMERIC) AS "UI",
      CAST(REPLACE(REPLACE("MIC", '.', ''), ',', '.') AS NUMERIC) AS "MIC",
      CAST(REPLACE(REPLACE("SF", '.', ''), ',', '.') AS NUMERIC) AS "SF",
      CASE 
        WHEN "PESO" IS NULL OR "PESO" = '' THEN 0
        ELSE CAST(REPLACE(REPLACE("PESO", '.', ''), ',', '.') AS NUMERIC)
      END AS "PESO"
    FROM tb_calidad_fibra
    ${filter}
  `;
  return { sql, values };
}

export function procesarResultadosHVI(rows) {
  const hviMap = {};
  for (const row of rows) {
    const key = String(row.LOTE_FIAC || '').replace(/^0+/, '').trim();
    if (!key) continue;
    if (!hviMap[key]) {
      hviMap[key] = { pesoTotal: 0, sumUI: 0, sumMIC: 0, sumSF: 0 };
    }
    const target = hviMap[key];
    const peso = Number(row.PESO) || 0;
    target.pesoTotal += peso;
    if (!isNaN(row.UI) && row.UI !== null) target.sumUI += Number(row.UI) * peso;
    if (!isNaN(row.MIC) && row.MIC !== null) target.sumMIC += Number(row.MIC) * peso;
    if (!isNaN(row.SF) && row.SF !== null) target.sumSF += Number(row.SF) * peso;
  }
  
  const finalMap = {};
  for (const key in hviMap) {
    const target = hviMap[key];
    if (target.pesoTotal > 0) {
      finalMap[key] = {
        UI: (target.sumUI / target.pesoTotal).toFixed(1),
        MIC: (target.sumMIC / target.pesoTotal).toFixed(2),
        SF: (target.sumSF / target.pesoTotal).toFixed(1)
      };
    }
  }
  return finalMap;
}
