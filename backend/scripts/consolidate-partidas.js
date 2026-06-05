/**
 * Node.js script to consolidate structured JSON objects per PARTIDA for AI analysis.
 * Usage:
 *   node backend/scripts/consolidate-partidas.js --partida 0551805
 *   node backend/scripts/consolidate-partidas.js --days 30
 *   node backend/scripts/consolidate-partidas.js --all
 */

import pg from 'pg';
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database Client Configuration
const client = new Client({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026'
});

async function run() {
  const args = process.argv.slice(2);
  let filterPartida = null;
  let filterDays = null;
  let allPartidas = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--partida' && args[i + 1]) {
      filterPartida = args[i + 1].trim();
      i++;
    } else if (args[i] === '--days' && args[i + 1]) {
      filterDays = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--all') {
      allPartidas = true;
    }
  }

  // If no arguments, default to 30 days of data
  if (!filterPartida && !filterDays && !allPartidas) {
    filterDays = 30;
    console.log(`💡 No filters specified. Defaulting to last ${filterDays} days of production.`);
  }

  try {
    await client.connect();
    console.log("✓ Connected to PostgreSQL database successfully.");

    // Build the selection criteria for Partidas
    let selectionClause = '';
    const params = [];

    if (filterPartida) {
      selectionClause = 'WHERE TRIM(BOTH FROM "PARTIDA") = $1';
      params.push(filterPartida);
      console.log(`🔍 Filtering by active PARTIDA: "${filterPartida}"`);
    } else if (filterDays) {
      selectionClause = `
        WHERE (
          CASE
            WHEN "DT_BASE_PRODUCAO" IS NULL OR "DT_BASE_PRODUCAO" = '' THEN NULL
            WHEN "DT_BASE_PRODUCAO" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DT_BASE_PRODUCAO" from 1 for 10), 'DD/MM/YYYY')
            WHEN "DT_BASE_PRODUCAO" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DT_BASE_PRODUCAO" from 1 for 10)::date
            ELSE NULL
          END
        ) >= CURRENT_DATE - $1
      `;
      params.push(filterDays);
      console.log(`📅 Selecting active partidas from the last ${filterDays} days.`);
    } else {
      console.log("🚀 Selecting ALL partidas in database.");
    }

    const querySql = `
      WITH partidas_list AS (
        SELECT DISTINCT TRIM(BOTH FROM "PARTIDA") AS target_partida
        FROM public.tb_produccion
        ${selectionClause}
      ),
      partida_prod AS (
        SELECT 
          TRIM(BOTH FROM p."PARTIDA") AS partida,
          COALESCE(
            MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."ARTIGO" END),
            MAX(CASE WHEN p."SELETOR" = 'ACABAMENTO' THEN p."ARTIGO" END),
            MAX(p."ARTIGO")
          ) AS artigo,
          MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."GRUPO TEAR" END) AS grupo_tear,
          -- INDIGO Indicators (from SELETOR = 'INDIGO')
          MAX(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."VELOC"), ',', '.'), '') AS NUMERIC) END) AS indigo_velocidad,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."RUPTURAS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_rupturas,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."CAVALOS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_cavalos,
          
          -- TECELAGEM Indicators (from SELETOR = 'TECELAGEM')
          MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."MAQUINA" END) AS tece_telar,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PONTOS_LIDOS"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_lidos,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PONTOS_100%"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS puntos_100,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PARADA TEC TRAMA"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS suma_paradas_trama,
          SUM(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN CAST(NULLIF(REPLACE(TRIM(p."PARADA TEC URDUME"::text), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS suma_paradas_urdimbre
        FROM public.tb_produccion p
        WHERE TRIM(BOTH FROM p."PARTIDA") IN (SELECT target_partida FROM partidas_list)
        GROUP BY TRIM(BOTH FROM p."PARTIDA")
      ),
      partida_calidad AS (
        SELECT 
          TRIM(BOTH FROM c."PARTIDA") AS partida,
          SUM(CASE WHEN TRIM(BOTH FROM c."QUALIDADE") IN ('1', 'PRIMEIRA') THEN CAST(NULLIF(REPLACE(REPLACE(TRIM(c."METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS metros_primeira
        FROM public.tb_calidad c
        WHERE TRIM(BOTH FROM c."PARTIDA") IN (SELECT target_partida FROM partidas_list)
        GROUP BY TRIM(BOTH FROM c."PARTIDA")
      ),
      partida_defectos AS (
        SELECT 
          TRIM(BOTH FROM d."PARTIDA") AS partida,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('340', '382', '387', '333', '319', '328', '386') THEN 1 END) AS total_defectos_trama_4ptos,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") IN ('312', '313', '310', '311') THEN 1 END) AS total_defectos_urdimbre,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '333' THEN 1 END) AS count_333,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '340' THEN 1 END) AS count_340,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '382' THEN 1 END) AS count_382,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '387' THEN 1 END) AS count_387,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '319' THEN 1 END) AS count_319,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '328' THEN 1 END) AS count_328,
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '386' THEN 1 END) AS count_386,
          SUM(CAST(NULLIF(REPLACE(TRIM(d."PONTOS"::text), ',', '.'), '') AS NUMERIC)) AS total_pontos
        FROM public.tb_defectos d
        WHERE TRIM(BOTH FROM d."PARTIDA") IN (SELECT target_partida FROM partidas_list)
          AND d."QUALIDADE" = '1'
        GROUP BY TRIM(BOTH FROM d."PARTIDA")
      ),
      partida_ficha AS (
        SELECT 
          f."ARTIGO CODIGO" AS artigo_codigo,
          f."COMPOSIÇÃO" AS composicion,
          f."TRAMA REDUZIDO" AS trama_reducido
        FROM public.tb_fichas f
      )
      SELECT 
        json_build_object(
          'partida', ctx.target_partida,
          'articulo', COALESCE(p.artigo, (SELECT "ARTIGO" FROM public.tb_calidad WHERE TRIM(BOTH FROM "PARTIDA") = ctx.target_partida LIMIT 1)),
          'grupo_tear', p.grupo_tear,
          'caracteristicas_trama', json_build_object(
            'composicion', f.composicion,
            'titulo', f.trama_reducido,
            'tipo_trama_filtro', CASE 
              WHEN REPLACE(REPLACE(UPPER(f.composicion), ' ', ''), 'Ã', 'A') IN ('100%ALGODON', '100%ALGODAO', '100%COTTON') THEN '100% CO - Ne ' || COALESCE(f.trama_reducido, '')
              WHEN (UPPER(f.composicion) LIKE '%ALGOD%' OR UPPER(f.composicion) LIKE '%COTTON%' OR UPPER(f.composicion) LIKE '%CO%') 
                   AND (UPPER(f.composicion) LIKE '%POLYESTER%' OR UPPER(f.composicion) LIKE '%POLIESTER%' OR UPPER(f.composicion) LIKE '%PES%') 
                   AND (UPPER(f.composicion) LIKE '%ELASTAN%' OR UPPER(f.composicion) LIKE '%SPANDEX%' OR UPPER(f.composicion) LIKE '%PUE%' OR UPPER(f.composicion) LIKE '%LYCRA%') THEN 'Mezcla Elástica'
              WHEN (UPPER(f.composicion) LIKE '%ALGOD%' OR UPPER(f.composicion) LIKE '%COTTON%' OR UPPER(f.composicion) LIKE '%CO%') 
                   AND (UPPER(f.composicion) LIKE '%POLYESTER%' OR UPPER(f.composicion) LIKE '%POLIESTER%' OR UPPER(f.composicion) LIKE '%PES%') THEN 'Mezcla Rígida'
              ELSE 'Otros'
            END
          ),
          'indicadores_indigo', json_build_object(
            'seletor', 'INDIGO',
            'velocidad_nominal', COALESCE(p.indigo_velocidad, 0),
            'r103_roturas_absolutas', COALESCE(p.indigo_rupturas, 0),
            'cav105_cavalos_absolutos', COALESCE(p.indigo_cavalos, 0)
          ),
          'indicadores_tejeduria', json_build_object(
            'seletor', 'TECELAGEM',
            'telar_asignado', p.tece_telar,
            'eficiencia_porcentaje', CASE WHEN p.puntos_100 > 0 THEN ROUND((p.puntos_lidos * 100.0 / p.puntos_100), 2) ELSE 0 END,
            'rt105_paradas_trama', COALESCE(p.suma_paradas_trama, 0),
            'ru105_paradas_urdimbre', COALESCE(p.suma_paradas_urdimbre, 0),
            'metros_primeira', COALESCE(c.metros_primeira, 0)
          ),
          'conteo_defectos_revisadora', json_build_object(
            'origen_tabla', 'tb_defectos',
            'total_defectos_trama_4ptos', COALESCE(d.total_defectos_trama_4ptos, 0),
            'total_defectos_urdimbre', COALESCE(d.total_defectos_urdimbre, 0),
            'total_pontos', COALESCE(d.total_pontos, 0),
            'pts_por_100m2', CASE WHEN c.metros_primeira > 0 THEN ROUND((COALESCE(d.total_pontos, 0) / c.metros_primeira) * 100, 2) ELSE 0 END,
            'detalle_frecuencia_codigo', json_build_object(
              '333_parada_tear', COALESCE(d.count_333, 0),
              '340_trama_mole', COALESCE(d.count_340, 0),
              '382_trama_curta', COALESCE(d.count_382, 0),
              '387_trama_dobrada', COALESCE(d.count_387, 0),
              '319_trama_quebrada', COALESCE(d.count_319, 0),
              '328_falta_trama', COALESCE(d.count_328, 0),
              '386_trama_dupla', COALESCE(d.count_386, 0)
            )
          )
        ) AS partida_json
      FROM partidas_list ctx
      LEFT JOIN partida_prod p ON p.partida = ctx.target_partida
      LEFT JOIN partida_calidad c ON c.partida = ctx.target_partida
      LEFT JOIN partida_defectos d ON d.partida = ctx.target_partida
      LEFT JOIN partida_ficha f ON f.artigo_codigo = p.artigo;
    `;

    const result = await client.query(querySql, params);
    
    // Extract JSON objects
    const consolidatedList = result.rows.map(r => r.partida_json);

    console.log(`📊 Successfully consolidated ${consolidatedList.length} partidas.`);

    if (filterPartida) {
      // Print single partida result to console
      console.log("\n--- CONSOLIDATED DATA OBJECT FOR THE ACTIVE PARTIDA ---");
      console.log(JSON.stringify(consolidatedList[0], null, 2));
    } else {
      // Save massive results to exports folder
      const exportsDir = path.join(__dirname, '..', '..', 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      const exportPath = path.join(exportsDir, 'partidas_consolidadas_ia.json');
      fs.writeFileSync(exportPath, JSON.stringify(consolidatedList, null, 2), 'utf-8');
      console.log(`💾 Massive JSON dataset saved to: ${exportPath}`);
    }

  } catch (err) {
    console.error("❌ Error running consolidation script:", err);
  } finally {
    await client.end();
    console.log("🔌 Database connection closed.");
  }
}

run();
