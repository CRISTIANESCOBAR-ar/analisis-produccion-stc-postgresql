import pg from 'pg';
import 'dotenv/config'; // Load .env
const { Client } = pg;

const client = new Client({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026'
});

async function run() {
  try {
    await client.connect();
    console.log("=== Running querySql ===");
    const querySql = `
      WITH partida_context AS (
        SELECT '0551805'::text AS target_partida
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
        WHERE TRIM(BOTH FROM p."PARTIDA") = (SELECT target_partida FROM partida_context)
        GROUP BY TRIM(BOTH FROM p."PARTIDA")
      ),
      partida_calidad AS (
        SELECT 
          TRIM(BOTH FROM c."PARTIDA") AS partida,
          SUM(CASE WHEN TRIM(BOTH FROM c."QUALIDADE") IN ('1', 'PRIMEIRA') THEN CAST(NULLIF(REPLACE(REPLACE(TRIM(c."METRAGEM"::TEXT), '.', ''), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS metros_primeira
        FROM public.tb_calidad c
        WHERE TRIM(BOTH FROM c."PARTIDA") = (SELECT target_partida FROM partida_context)
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
          COUNT(CASE WHEN TRIM(BOTH FROM d."COD_DEF") = '387' THEN 1 END) AS count_387
        FROM public.tb_defectos d
        WHERE TRIM(BOTH FROM d."PARTIDA") = (SELECT target_partida FROM partida_context)
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
          'partida', (SELECT target_partida FROM partida_context),
          'articulo', COALESCE(p.artigo, (SELECT "ARTIGO" FROM public.tb_calidad WHERE TRIM(BOTH FROM "PARTIDA") = (SELECT target_partida FROM partida_context) LIMIT 1)),
          'grupo_tear', p.grupo_tear,
          'caracteristicas_trama', json_build_object(
            'composicion', f.composicion,
            'titulo', f.trama_reducido,
            'tipo_trama_filtro', CASE 
              WHEN REPLACE(UPPER(f.composicion), ' ', '') = '100%ALGODON' THEN '100% CO - Ne ' || COALESCE(f.trama_reducido, '')
              WHEN UPPER(f.composicion) LIKE '%ALGODON%' AND UPPER(f.composicion) LIKE '%POLYESTER%' AND (UPPER(f.composicion) LIKE '%ELASTANO%' OR UPPER(f.composicion) LIKE '%SPANDEX%') THEN 'Mezcla Elástica'
              WHEN UPPER(f.composicion) LIKE '%ALGODON%' AND UPPER(f.composicion) LIKE '%POLYESTER%' THEN 'Mezcla Rígida'
              ELSE 'Otro / Sin Clasificar'
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
            'detalle_frecuencia_codigo', json_build_object(
              '333_parada_tear', COALESCE(d.count_333, 0),
              '340_trama_mole', COALESCE(d.count_340, 0),
              '382_trama_curta', COALESCE(d.count_382, 0),
              '387_trama_dobrada', COALESCE(d.count_387, 0)
            )
          )
        ) AS partida_json
      FROM (SELECT target_partida FROM partida_context) ctx
      LEFT JOIN partida_prod p ON p.partida = ctx.target_partida
      LEFT JOIN partida_calidad c ON c.partida = ctx.target_partida
      LEFT JOIN partida_defectos d ON d.partida = ctx.target_partida
      LEFT JOIN partida_ficha f ON f.artigo_codigo = p.artigo;
    `;
    const res = await client.query(querySql);
    console.log("JSON Result:\n", JSON.stringify(res.rows[0]?.partida_json, null, 2));
  } catch (err) {
    console.error("Error details:", err);
  } finally {
    await client.end();
  }
}
run();
