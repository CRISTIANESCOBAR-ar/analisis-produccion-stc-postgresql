/**
 * Script de diagnóstico: verifica la trazabilidad
 * tb_uster_par.lote ↔ tb_calidad_fibra.MISTURA
 */
import { fileURLToPath } from 'url';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  host:     process.env.PG_HOST     || 'localhost',
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DATABASE || 'stc_produccion',
  user:     process.env.PG_USER     || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
});

async function run() {
  const client = await pool.connect();
  try {

    console.log('\n=== 1. Últimos 10 lotes en tb_uster_par ===');
    const uster = await client.query(`
      SELECT 
        lote, 
        nomcount, 
        LEFT(time_stamp, 20) AS ts,
        COALESCE(
          (regexp_match(lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(lote, '(\\d+)'))[1]
        ) AS mistura_extraida
      FROM tb_uster_par 
      ORDER BY time_stamp DESC 
      LIMIT 10
    `);
    console.table(uster.rows);

    console.log('\n=== 2. LOTE_FIAC disponibles en tb_calidad_fibra (MIST) — primeros 20 ===');
    const hvi = await client.query(`
      SELECT DISTINCT
        "LOTE_FIAC",
        "LOTE_FIAC"::integer AS lote_fiac_num,
        COUNT(*) OVER (PARTITION BY "LOTE_FIAC") AS filas
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND "LOTE_FIAC" ~ '^\\d+$'
        AND "LOTE_FIAC" IS NOT NULL
      ORDER BY "LOTE_FIAC"::integer DESC
      LIMIT 20
    `);
    console.table(hvi.rows);

    console.log('\n=== 2b. ¿Existen LOTE_FIAC 56, 99, 107 en tb_calidad_fibra? ===');
    const check = await client.query(`
      SELECT "LOTE_FIAC", "LOTE_FIAC"::integer AS num, "MISTURA", COUNT(*) AS filas
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND "LOTE_FIAC" ~ '^\\d+$'
        AND "LOTE_FIAC"::integer IN (56, 99, 107, 108)
      GROUP BY "LOTE_FIAC", "MISTURA"
      ORDER BY "LOTE_FIAC"::integer
    `);
    console.log('Filas:', check.rowCount);
    if (check.rowCount > 0) console.table(check.rows);
    else console.log('⚠ No encontrados. Rango real de LOTE_FIAC en la tabla:');

    const rango = await client.query(`
      SELECT MIN("LOTE_FIAC"::integer) AS min_lote, MAX("LOTE_FIAC"::integer) AS max_lote
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST' AND "LOTE_FIAC" ~ '^\\d+$'
    `);
    console.table(rango.rows);

    console.log('\n=== 3. Cruce por LOTE_FIAC::integer = lote extraído de Uster ===');
    const cruce = await client.query(`
      SELECT 
        u.lote,
        COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        )::integer AS mistura_num,
        cf."LOTE_FIAC",
        cf."MISTURA",
        cf."STR", cf."SCI"
      FROM tb_uster_par u
      JOIN tb_calidad_fibra cf 
        ON cf."TIPO_MOV" = 'MIST'
        AND cf."LOTE_FIAC" ~ '^\\d+$'
        AND cf."LOTE_FIAC"::integer = COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        )::integer
      LIMIT 10
    `);
    console.log('Filas encontradas en cruce:', cruce.rowCount);
    if (cruce.rowCount > 0) console.table(cruce.rows);
    else console.log('⚠️  Sin coincidencias. Revisar formato de lote vs MISTURA.');

    console.log('\n=== 4. Conteo total de registros por tabla ===');
    const counts = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM tb_uster_par)        AS uster_par,
        (SELECT COUNT(*) FROM tb_uster_tbl)        AS uster_tbl,
        (SELECT COUNT(*) FROM tb_tensorapid_par)   AS tensorapid_par,
        (SELECT COUNT(*) FROM tb_tensorapid_tbl)   AS tensorapid_tbl,
        (SELECT COUNT(*) FROM tb_calidad_fibra WHERE "TIPO_MOV"='MIST') AS calidad_mist
    `);
    console.table(counts.rows);

    console.log('\n=== 5. DIAGNÓSTICO JOIN PASO A PASO ===');

    const pasoA = await client.query(`
      SELECT COUNT(*) AS uster_en_rango FROM tb_uster_par u
      WHERE TO_DATE(SPLIT_PART(u.time_stamp, ' ', 1), 'DD/MM/YYYY')
            BETWEEN '2024-01-01'::date AND '2026-02-25'::date
    `);
    console.log('A) Uster en rango 2024-2026:', pasoA.rows[0].uster_en_rango);

    const pasoB = await client.query(`
      SELECT u.lote, u.nomcount,
        COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        )::integer AS lote_num
      FROM tb_uster_par u
      WHERE TO_DATE(SPLIT_PART(u.time_stamp, ' ', 1), 'DD/MM/YYYY')
            BETWEEN '2024-01-01'::date AND '2026-02-25'::date
      LIMIT 5
    `);
    console.log('B) Lotes en rango con número extraído:');
    console.table(pasoB.rows);

    const pasoC = await client.query(`
      SELECT COUNT(*) AS tbl_rows FROM tb_uster_par u
      JOIN tb_uster_tbl t ON t.testnr = u.testnr
      WHERE TO_DATE(SPLIT_PART(u.time_stamp, ' ', 1), 'DD/MM/YYYY')
            BETWEEN '2024-01-01'::date AND '2026-02-25'::date
    `);
    console.log('C) uster_par JOIN uster_tbl en rango:', pasoC.rows[0].tbl_rows);

    const pasoD = await client.query(`
      SELECT testnr, cvm_percent, h, neps_200_km FROM tb_uster_tbl LIMIT 3
    `);
    console.log('D) Formato de cvm_percent en uster_tbl (¿coma o punto?):');
    console.table(pasoD.rows);

    const pasoE = await client.query(`
      SELECT u.lote,
        COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        )::integer AS lote_num,
        ha.lote_fiac_num, ha.str_avg
      FROM tb_uster_par u
      JOIN (
        SELECT "LOTE_FIAC"::integer AS lote_fiac_num,
               ROUND(AVG(REPLACE("STR",',','.')::numeric),2) AS str_avg
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV"='MIST' AND "LOTE_FIAC" ~ '^\\d+$' AND "STR" ~ '^[0-9]'
        GROUP BY "LOTE_FIAC"::integer
      ) ha ON ha.lote_fiac_num = COALESCE(
          (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
          (regexp_match(u.lote, '(\\d+)'))[1]
        )::integer
      WHERE TO_DATE(SPLIT_PART(u.time_stamp, ' ', 1), 'DD/MM/YYYY')
            BETWEEN '2024-01-01'::date AND '2026-02-25'::date
      LIMIT 5
    `);
    console.log('E) Join completo uster_par + hvi_avg (LOTE_FIAC):', pasoE.rowCount, 'filas');
    if (pasoE.rowCount > 0) console.table(pasoE.rows);

    console.log('\n=== 6. Tipos de datos de columnas numéricas en tb_uster_tbl ===');
    const tipos = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'tb_uster_tbl'
        AND column_name IN ('cvm_percent','h','neps_200_km','delg_minus50_km','grue_50_km','titulo')
      ORDER BY column_name
    `);
    console.table(tipos.rows);

    console.log('\n=== 7. Prueba AVG directo en uster_tbl ===');
    const avgTest = await client.query(`
      SELECT 
        COUNT(*) AS total,
        AVG(cvm_percent) AS avg_cvm,
        AVG(h)           AS avg_h,
        AVG(neps_200_km) AS avg_neps
      FROM tb_uster_tbl t
      WHERE t.testnr IN (SELECT testnr FROM tb_uster_par WHERE lote LIKE 'HD-107%')
    `);
    console.table(avgTest.rows);

    console.log('\n=== 8. CTE COMPLETA — igual que el endpoint ===');
    const cteFull = await client.query(`
      WITH uster_lotes AS (
        SELECT
          u.testnr,
          u.lote AS lote_raw,
          u.nomcount,
          u.time_stamp,
          COALESCE(
            (regexp_match(u.lote, '[A-Za-z]+[-\\s]+(\\d+)'))[1],
            (regexp_match(u.lote, '(\\d+)'))[1]
          ) AS mistura_num
        FROM tb_uster_par u
        WHERE u.time_stamp IS NOT NULL
          AND TO_DATE(SPLIT_PART(u.time_stamp, ' ', 1), 'DD/MM/YYYY')
              BETWEEN '2024-01-01'::date AND '2026-02-25'::date
      ),
      uster_avg AS (
        SELECT
          testnr,
          ROUND(AVG(cvm_percent)::numeric, 2)    AS cvm,
          ROUND(AVG(h)::numeric, 2)              AS vellosidad,
          ROUND(AVG(neps_200_km)::numeric, 1)    AS neps_200,
          ROUND(AVG(delg_minus50_km)::numeric, 1) AS thin_50,
          ROUND(AVG(grue_50_km)::numeric, 1)     AS thick_50
        FROM tb_uster_tbl
        GROUP BY testnr
      ),
      tenso_avg AS (
        SELECT
          p.uster_testnr,
          ROUND(AVG(t.tenacidad)::numeric, 2)  AS tenacidad,
          ROUND(AVG(t.elongacion)::numeric, 2) AS elongacion
        FROM tb_tensorapid_par p
        JOIN tb_tensorapid_tbl t ON t.testnr = p.testnr
        WHERE p.uster_testnr IS NOT NULL
        GROUP BY p.uster_testnr
      ),
      hvi_avg AS (
        SELECT
          "LOTE_FIAC"::integer                                AS lote_fiac_num,
          ROUND(AVG(REPLACE("STR",  ',', '.')::numeric), 2)  AS str_avg,
          ROUND(AVG(REPLACE("SCI",  ',', '.')::numeric), 2)  AS sci_avg,
          ROUND(AVG(REPLACE("MIC",  ',', '.')::numeric), 3)  AS mic_avg,
          ROUND(AVG(REPLACE("UHML", ',', '.')::numeric), 2)  AS uhml_avg,
          COUNT(*)                                           AS fardos
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND "LOTE_FIAC" ~ '^\\d+$'
          AND "STR"  ~ '^[0-9][0-9,\\.]*$'
          AND "SCI"  ~ '^[0-9][0-9,\\.]*$'
          AND "MIC"  ~ '^[0-9][0-9,\\.]*$'
          AND "UHML" ~ '^[0-9][0-9,\\.]*$'
        GROUP BY "LOTE_FIAC"::integer
      )
      SELECT
        ul.lote_raw, ul.mistura_num, ul.nomcount AS ne_titulo,
        TO_DATE(SPLIT_PART(ul.time_stamp, ' ', 1), 'DD/MM/YYYY') AS fecha,
        ua.cvm, ua.vellosidad, ua.neps_200, ua.thin_50, ua.thick_50,
        ta.tenacidad, ta.elongacion,
        ha.str_avg AS str, ha.sci_avg AS sci, ha.mic_avg AS mic, ha.uhml_avg AS uhml
      FROM uster_lotes ul
      JOIN uster_avg  ua ON ua.testnr = ul.testnr
      LEFT JOIN tenso_avg ta ON ta.uster_testnr = ul.testnr
      JOIN hvi_avg ha ON ha.lote_fiac_num = ul.mistura_num::integer
      ORDER BY ul.time_stamp ASC
    `);
    console.log('CTE completa devuelve:', cteFull.rowCount, 'filas');
    if (cteFull.rowCount > 0) console.table(cteFull.rows.slice(0, 5));

  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(e => { console.error('ERROR:', e.message, '\n', e.stack); process.exit(1); });