import fs from 'fs';

const path = 'c:/stc-produccion-v2/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Update querySql
const oldQueryStart = `      WITH piece_summary AS (`;
const oldQueryEnd = "ORDER BY pts_100m2 DESC NULLS LAST";
const startIndex = content.indexOf(oldQueryStart);
const endIndexMatch = content.indexOf(oldQueryEnd, startIndex);
const exactEnd = content.indexOf("`;", endIndexMatch) + 2;

const queryToInject = `      WITH partidas_list AS (
        SELECT DISTINCT TRIM(BOTH FROM "PARTIDA") AS target_partida
        FROM public.tb_produccion
        WHERE "PARTIDA" IS NOT NULL AND TRIM(BOTH FROM "PARTIDA") <> ''
          AND (
            CASE
              WHEN "DT_BASE_PRODUCAO" IS NULL OR "DT_BASE_PRODUCAO" = '' THEN NULL
              WHEN "DT_BASE_PRODUCAO" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DT_BASE_PRODUCAO" from 1 for 10), 'DD/MM/YYYY')
              WHEN "DT_BASE_PRODUCAO" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DT_BASE_PRODUCAO" from 1 for 10)::date
              ELSE NULL
            END
          ) BETWEEN $1::date AND $2::date
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
          MAX(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."VELOC"), ',', '.'), '') AS NUMERIC) END) AS indigo_velocidad,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."RUPTURAS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_rupturas,
          SUM(CASE WHEN p."SELETOR" = 'INDIGO' THEN CAST(NULLIF(REPLACE(TRIM(p."CAVALOS"), ',', '.'), '') AS NUMERIC) ELSE 0 END) AS indigo_cavalos,
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
    \`;`;

content = content.substring(0, startIndex) + queryToInject + content.substring(exactEnd);

// 2. Update mapping logic
content = content.replace(
  'const dataset = dbResult.rows;',
  'const dataset = dbResult.rows.map(r => r.partida_json).sort((a,b) => b.conteo_defectos_revisadora.pts_por_100m2 - a.conteo_defectos_revisadora.pts_por_100m2);'
);

// 3. Update cleanDataForAI
const oldCleanData = `        const cleanDataForAI = dataset.slice(0, 15).map(r => ({
          partida: r.partida,
          artigo: r.artigo,
          maquina: r.maquina,
          eficiencia: r.eficiencia,
          metros: r.metros_revisados,
          pts_100m2: r.pts_100m2,
          cod_def: r.cod_def,
          defecto: r.desc_defeito,
          puntos_defecto: r.puntos_defecto
        }));`;

const newCleanData = `        const cleanDataForAI = dataset.slice(0, 15).map(r => ({
          partida: r.partida,
          artigo: r.articulo,
          maquina: r.indicadores_tejeduria.telar_asignado,
          eficiencia: r.indicadores_tejeduria.eficiencia_porcentaje,
          metros: r.indicadores_tejeduria.metros_primeira,
          pts_100m2: r.conteo_defectos_revisadora.pts_por_100m2,
          defectos: r.conteo_defectos_revisadora.detalle_frecuencia_codigo
        }));`;

content = content.replace(oldCleanData, newCleanData);

// 4. Update Fallback string
const oldFallback = `* Partida más crítica: **Partida \${dataset[0].partida}** (Artigo: \${dataset[0].artigo}, Telar: \${dataset[0].maquina}) con **\${dataset[0].pts_100m2} Pts/100m²**.`;
const newFallback = `* Partida más crítica: **Partida \${dataset[0]?.partida}** (Artigo: \${dataset[0]?.articulo}, Telar: \${dataset[0]?.indicadores_tejeduria?.telar_asignado}) con **\${dataset[0]?.conteo_defectos_revisadora?.pts_por_100m2} Pts/100m²**.`;

content = content.replace(oldFallback, newFallback);

fs.writeFileSync(path, content, 'utf8');
console.log('Update successful!');
