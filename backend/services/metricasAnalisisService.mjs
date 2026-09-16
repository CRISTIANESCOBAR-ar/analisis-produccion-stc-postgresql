/**
 * Servicio y helpers puros para análisis diario de métricas de producción, calidad y metas.
 * Diseñado bajo principios de Clean Code / TDD para máxima testabilidad y cero acoplamiento.
 */

// Helpers de parseo SQL reutilizables
export function sqlParseDate(colIdent) {
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring(${colIdent} from 1 for 10), 'DD/MM/YYYY')
      WHEN ${colIdent} ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring(${colIdent} from 1 for 10)::date
      ELSE NULL
    END
  )`;
}

export function sqlParseNumber(colIdent) {
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`;
}

export function sqlParseNumberIntl(colIdent) {
  return `(
    CASE
      WHEN ${colIdent} IS NULL OR ${colIdent} = '' THEN NULL
      WHEN ${colIdent} ~ '^-?[0-9]{1,3}(\\.[0-9]{3})+(,[0-9]+)?$' THEN replace(replace(${colIdent}, '.', ''), ',', '.')::numeric
      WHEN ${colIdent} ~ '^-?[0-9]+([.,][0-9]+)?$' THEN replace(${colIdent}, ',', '.')::numeric
      ELSE NULL
    END
  )`;
}

/**
 * Genera la consulta SQL y los parámetros para metricas-diarias-produccion.
 * Si trama está definida y no vacía, agrega filtro por "TRAMA REDUZIDA 1".
 */
export function buildProduccionQuery({ fechaInicio, fechaFin, trama }) {
  const cleanTrama = typeof trama === 'string' ? trama.trim() : '';
  const hasTrama = cleanTrama.length > 0;

  const metragemNum = sqlParseNumber('"METRAGEM"');
  const rupturasNum = sqlParseNumber('"RUPTURAS"');
  const numFiosNum = sqlParseNumber('"NUM_FIOS"');
  const velocNum = sqlParseNumber('"VELOC"');
  const eficienciaClean = `regexp_replace("EFICIENCIA", '[^0-9,.-]', '', 'g')`;
  const eficienciaNum = sqlParseNumberIntl(eficienciaClean);
  const puntosLidosNum = sqlParseNumber('"PONTOS_LIDOS"');
  const puntos100Num = sqlParseNumberIntl('"PONTOS_100%"');
  const parTraNum = sqlParseNumber('"PARADA TEC TRAMA"');
  const parUrdNum = sqlParseNumber('"PARADA TEC URDUME"');

  const tramaFilter = hasTrama ? 'AND "TRAMA REDUZIDA 1" = $3' : '';
  const params = hasTrama ? [fechaInicio, fechaFin, cleanTrama] : [fechaInicio, fechaFin];

  const sql = `
    WITH BASE AS (
      SELECT
        ${sqlParseDate('"DT_BASE_PRODUCAO"')} AS FECHA_DB,
        "DT_BASE_PRODUCAO" AS FECHA,
        "SELETOR" AS SELETOR,
        ${metragemNum} AS METRAGEM,
        ${rupturasNum} AS RUPTURAS,
        ${numFiosNum} AS NUM_FIOS,
        ${velocNum} AS VELOC,
        CASE
          WHEN ${eficienciaNum} IS NULL OR ${eficienciaNum} = 0 THEN
            (${puntosLidosNum} * 100) / NULLIF(${puntos100Num}, 0)
          ELSE ${eficienciaNum}
        END AS EFICIENCIA,
        ${parTraNum} AS PARADA_TRAMA,
        ${parUrdNum} AS PARADA_URD
      FROM tb_produccion
      WHERE "FILIAL" = '05'
        AND ${sqlParseDate('"DT_BASE_PRODUCAO"')} BETWEEN $1::date AND $2::date
        ${tramaFilter}
    )
    SELECT
      FECHA_DB AS "FECHA_DB",
      FECHA AS "FECHA",
      SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (RUPTURAS * 1000000) ELSE 0 END)
        / NULLIF(SUM(CASE WHEN SELETOR IN ('URDIDEIRA','URDIDORA') THEN (METRAGEM * NUM_FIOS) ELSE 0 END), 0) AS "RU106_URDIDORA",
      SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END) AS "METROS_INDIGO",
      SUM(CASE WHEN SELETOR = 'INDIGO' THEN RUPTURAS ELSE 0 END) * 1000
        / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "R103_INDIGO",
      SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM * VELOC ELSE 0 END)
        / NULLIF(SUM(CASE WHEN SELETOR = 'INDIGO' THEN METRAGEM ELSE 0 END), 0) AS "VELOCIDAD_INDIGO",
      SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM * EFICIENCIA ELSE 0 END)
        / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END), 0) AS "EFICIENCIA_TELAR",
      SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_URD ELSE 0 END) * 100000
        / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RU105_TELAR",
      SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN PARADA_TRAMA ELSE 0 END) * 100000
        / NULLIF(SUM(CASE WHEN SELETOR = 'TECELAGEM' THEN METRAGEM ELSE 0 END) * 1000, 0) AS "RT105_TELAR"
    FROM BASE
    GROUP BY FECHA_DB, FECHA
    ORDER BY FECHA_DB ASC
  `;

  return { sql, params };
}

/**
 * Genera la consulta SQL y los parámetros para metricas-diarias-calidad.
 * Si trama está definida y no vacía, agrega filtro por "TRAMA".
 */
export function buildCalidadQuery({ fechaInicio, fechaFin, trama }) {
  const cleanTrama = typeof trama === 'string' ? trama.trim() : '';
  const hasTrama = cleanTrama.length > 0;

  const metragemNum = sqlParseNumber('"METRAGEM"');
  const pontuacaoNum = sqlParseNumber('"PONTUACAO"');
  const larguraNum = sqlParseNumber('"LARGURA"');

  const tramaFilter = hasTrama ? 'AND "TRAMA" = $3' : '';
  const params = hasTrama ? [fechaInicio, fechaFin, cleanTrama] : [fechaInicio, fechaFin];

  const sql = `
    SELECT
      ${sqlParseDate('"DAT_PROD"')} AS "FECHA_DB",
      "DAT_PROD" AS "FECHA",
      SUM(${metragemNum}) AS "METROS_TOTAL",
      SUM(CASE WHEN "QUALIDADE" ILIKE 'PRIMEIRA%' THEN ${metragemNum} ELSE 0 END) AS "METROS_1ERA",
      SUM(COALESCE(${pontuacaoNum}, 0)) AS "PONTOS",
      AVG(${larguraNum}) AS "LARGURA"
    FROM tb_calidad
    WHERE "EMP" = 'STC'
      AND "QUALIDADE" NOT ILIKE '%RETALHO%'
      AND ${sqlParseDate('"DAT_PROD"')} BETWEEN $1::date AND $2::date
      ${tramaFilter}
    GROUP BY "FECHA_DB", "FECHA"
    ORDER BY "FECHA_DB" ASC
  `;

  return { sql, params };
}

/**
 * Genera consulta para metas en rango de fechas.
 */
export function buildMetasRangoQuery({ fechaInicio, fechaFin }) {
  const sql = `
    SELECT to_char("Dia", 'YYYY-MM-DD') AS dia,
           "EFI_Percent" AS meta_efi,
           "RU105" AS meta_ru105,
           "RT105" AS meta_rt105,
           "Revision" AS meta_revision
    FROM tb_metas
    WHERE "Dia" >= $1::date AND "Dia" <= $2::date
    ORDER BY "Dia" ASC
  `;
  return { sql, params: [fechaInicio, fechaFin] };
}

/**
 * Genera consulta para obtener las tramas únicas (DISTINCT) del período desde tb_produccion.
 */
export function buildTramasPeriodoQuery({ fechaInicio, fechaFin }) {
  const dtBaseDate = sqlParseDate('p."DT_BASE_PRODUCAO"');
  const dtCalDate = sqlParseDate('c."DAT_PROD"');
  const sql = `
    SELECT DISTINCT TRIM(trama) AS trama
    FROM (
      SELECT p."TRAMA REDUZIDA 1" AS trama
      FROM tb_produccion p
      WHERE p."FILIAL" = '05'
        AND p."SELETOR" = 'TECELAGEM'
        AND ${dtBaseDate} >= $1::date
        AND ${dtBaseDate} <= $2::date
        AND p."TRAMA REDUZIDA 1" IS NOT NULL
        AND TRIM(p."TRAMA REDUZIDA 1") <> ''

      UNION

      SELECT c."TRAMA" AS trama
      FROM tb_calidad c
      WHERE c."EMP" = 'STC'
        AND c."QUALIDADE" NOT ILIKE '%RETALHO%'
        AND ${dtCalDate} >= $1::date
        AND ${dtCalDate} <= $2::date
        AND c."TRAMA" IS NOT NULL
        AND TRIM(c."TRAMA") <> ''
    ) sub
    ORDER BY trama ASC
  `;
  return { sql, params: [fechaInicio, fechaFin] };
}

/**
 * Genera consulta para obtener los defectos únicos del período desde tb_defectos.
 */
export function buildDefectosPeriodoQuery({ fechaInicio, fechaFin, trama }) {
  const dtProdDate = sqlParseDate('d."DATA_PROD"');
  const cleanTrama = typeof trama === 'string' ? trama.trim() : '';
  const hasTrama = cleanTrama.length > 0;
  
  const params = [fechaInicio, fechaFin];
  let joinSql = "";
  let filterSql = "";
  let paramIdx = 3;

  if (hasTrama) {
    joinSql = `INNER JOIN tb_calidad c ON c."PEÇA" = (d."PARTIDA" || d."PECA")`;
    filterSql = ` AND c."QUALIDADE" ILIKE 'PRIMEIRA%' AND c."TRAMA" = $${paramIdx}`;
    params.push(cleanTrama);
  } else {
    // Si no hay trama seleccionada (Totales), igual cruzamos con tb_calidad 
    // para mantener la consistencia de contar solo piezas de PRIMERA
    joinSql = `INNER JOIN tb_calidad c ON c."PEÇA" = (d."PARTIDA" || d."PECA")`;
    filterSql = ` AND c."QUALIDADE" ILIKE 'PRIMEIRA%'`;
  }

  const sql = `
    SELECT DISTINCT 
      TRIM(d."COD_DEF") as "COD_DEF", 
      TRIM(d."DESC_DEFEITO") as "DESC_DEFEITO"
    FROM tb_defectos d
    ${joinSql}
    WHERE ${dtProdDate} >= $1::date AND ${dtProdDate} <= $2::date
      AND d."COD_DEF" IS NOT NULL 
      AND TRIM(d."COD_DEF") <> ''
      AND d."QUALIDADE" = '1'
      ${filterSql}
    ORDER BY "COD_DEF"
  `;
  return { sql, params };
}

/**
 * Genera consulta para obtener los puntos diarios filtrados por defectos específicos.
 */
export function buildMetricasDiariasDefectosQuery({ fechaInicio, fechaFin, codDef, trama }) {
  const dtProdDate = sqlParseDate('d."DATA_PROD"');
  const cleanTrama = typeof trama === 'string' ? trama.trim() : '';
  const hasTrama = cleanTrama.length > 0;
  
  const params = [fechaInicio, fechaFin];
  let filterSql = "";
  let joinSql = "";
  let paramIdx = 3;

  if (hasTrama) {
    joinSql = `INNER JOIN tb_calidad c ON c."PEÇA" = (d."PARTIDA" || d."PECA")`;
    filterSql += ` AND c."QUALIDADE" ILIKE 'PRIMEIRA%' AND c."TRAMA" = $${paramIdx}`;
    params.push(cleanTrama);
    paramIdx++;
  } else {
    // Si no hay trama seleccionada (Totales), igual cruzamos con tb_calidad 
    // para mantener la consistencia de contar solo piezas de PRIMERA
    joinSql = `INNER JOIN tb_calidad c ON c."PEÇA" = (d."PARTIDA" || d."PECA")`;
    filterSql += ` AND c."QUALIDADE" ILIKE 'PRIMEIRA%'`;
  }

  if (codDef && typeof codDef === 'string' && codDef.trim() !== '') {
    const codigos = codDef.split(',').map(c => c.trim()).filter(c => c !== '');
    if (codigos.length > 0) {
      filterSql += ` AND d."COD_DEF" = ANY($${paramIdx}::text[])`;
      params.push(codigos);
    }
  }

  const sql = `
    SELECT
      ${dtProdDate} AS "FECHA_DB",
      ${dtProdDate} AS "FECHA",
      SUM(d."PONTOS"::numeric) AS "PONTOS_DEFECTO"
    FROM tb_defectos d
    ${joinSql}
    WHERE ${dtProdDate} >= $1::date
      AND ${dtProdDate} <= $2::date
      AND d."QUALIDADE" = '1'
      ${filterSql}
    GROUP BY ${dtProdDate}
    ORDER BY ${dtProdDate} ASC
  `;
  return { sql, params };
}

/**
 * Transforma y calcula métricas derivadas de calidad.
 */
export function mapCalidadRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const metrosTotal = Number(r.METROS_TOTAL);
    const metros1era = Number(r.METROS_1ERA);
    const pontos = Number(r.PONTOS);
    const largura = Number(r.LARGURA);

    const calPct = metrosTotal > 0 && !isNaN(metros1era)
      ? (metros1era / metrosTotal) * 100
      : null;

    const areaM2 = metrosTotal > 0 && largura > 0
      ? (metrosTotal * largura) / 100
      : 0;

    const pts100 = areaM2 > 0 && !isNaN(pontos)
      ? (pontos * 100) / areaM2
      : null;

    return {
      FECHA_DB: r.FECHA_DB,
      FECHA: r.FECHA,
      CALIDAD_PERCENT: calPct,
      PTS_100M2: pts100,
      METROS_1ERA: r.METROS_1ERA,
      METROS_TOTAL: r.METROS_TOTAL,
      AREA_M2: areaM2,
      ROLLOS: null
    };
  });
}

/**
 * Calcula { min, max, avg } para campos numéricos en un array de datos.
 */
export function calculateRangos(datos, keys) {
  const rangos = {};
  if (!Array.isArray(datos) || !Array.isArray(keys)) return rangos;

  for (const key of keys) {
    const vals = datos
      .map((d) => d?.[key])
      .filter((v) => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)))
      .map(Number);

    if (!vals.length) continue;

    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    rangos[key] = { min, max, avg };
  }

  return rangos;
}


