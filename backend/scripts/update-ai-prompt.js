import fs from 'fs';

const path = 'c:/stc-produccion-v2/backend/server.js';
let content = fs.readFileSync(path, 'utf8');

// 1. Replace the dataset query (querySql) in datos-patrones-teje
const oldQueryStart = "    const querySql = `\n      WITH piece_summary AS (";
const oldQueryEnd = "      ORDER BY pts_100m2 DESC NULLS LAST\n    `;";

const oldQueryBlock = content.substring(
    content.indexOf(oldQueryStart),
    content.indexOf(oldQueryEnd) + oldQueryEnd.length
);

const newQueryBlock = `    const querySql = \`
      WITH partidas_list AS (
        SELECT DISTINCT TRIM(BOTH FROM "PARTIDA") AS target_partida
        FROM public.tb_calidad
        WHERE "EMP" = 'STC'
          AND "QUALIDADE" IN ('1', 'PRIMEIRA') 
          AND (
            CASE
              WHEN "DAT_PROD" IS NULL OR "DAT_PROD" = '' THEN NULL
              WHEN "DAT_PROD" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DAT_PROD" from 1 for 10), 'DD/MM/YYYY')
              WHEN "DAT_PROD" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DAT_PROD" from 1 for 10)::date
              ELSE NULL
            END
          ) BETWEEN $1::date AND $2::date
      ),
      partida_prod AS (
        SELECT 
          TRIM(BOTH FROM p."PARTIDA") AS partida,
          COALESCE(
            MAX(CASE WHEN p."SELETOR" = 'TECELAGEM' THEN p."ARTIGO" END),
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
          MIN(c."DT INI TEC") AS dt_ini_tec,
          MIN(c."HR INI TEC") AS hr_ini_tec,
          MAX(c."DT FIM TEC") AS dt_fim_tec,
          MAX(c."HR FIM TEC") AS hr_fim_tec,
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
          'cronologia_tejeduria', json_build_object(
             'inicio', COALESCE(c.dt_ini_tec || ' ' || c.hr_ini_tec, ''),
             'fin', COALESCE(c.dt_fim_tec || ' ' || c.hr_fim_tec, '')
          ),
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
            'rt105_paradas_trama', CASE WHEN p.puntos_lidos > 0 THEN ROUND((p.suma_paradas_trama * 100000.0) / (p.puntos_lidos * 1000.0), 2) ELSE 0 END,
            'ru105_paradas_urdimbre', CASE WHEN p.puntos_lidos > 0 THEN ROUND((p.suma_paradas_urdimbre * 100000.0) / (p.puntos_lidos * 1000.0), 2) ELSE 0 END,
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
      LEFT JOIN partida_ficha f ON f.artigo_codigo = p.artigo
      ORDER BY (CASE WHEN c.metros_primeira > 0 THEN ROUND((COALESCE(d.total_pontos, 0) / c.metros_primeira) * 100, 2) ELSE 0 END) DESC;
    \`;`;

content = content.replace(oldQueryBlock, newQueryBlock);

// Replace result extraction
const oldExecStart = "const { rows: resultDataset } = await pool.query(querySql, [isoInicio, isoFin]);";
const newExecStart = `const { rows: resultDataset } = await pool.query(querySql, [isoInicio, isoFin]);
    const dataset = resultDataset.map(r => r.partida_json);`;

content = content.replace("const { rows: resultDataset } = await pool.query(querySql, [isoInicio, isoFin]);\n    const dataset = resultDataset;", newExecStart);

// 2. Replace the AI block in `ia-patrones-teje`
const oldAIBlockStart = "// Reducimos el payload para la IA para no saturar los límites de tokens";
const oldAIBlockEnd = "IMPORTANTE: Sé directo, profesional, usa terminología textil y no uses formatos complejos.`;";

const oldAIBlock = content.substring(
    content.indexOf(oldAIBlockStart),
    content.indexOf(oldAIBlockEnd) + oldAIBlockEnd.length
);

const newAIBlock = `// Reducimos el payload para la IA para no saturar los límites de tokens
        const cleanDataForAI = dataset.slice(0, 15).map(r => ({
          partida: r.partida,
          artigo: r.articulo,
          grupo_tear: r.grupo_tear,
          cronologia_tejeduria: r.cronologia_tejeduria,
          matriz_trama: r.caracteristicas_trama?.tipo_trama_filtro,
          indigo: r.indicadores_indigo,
          tejeduria: r.indicadores_tejeduria,
          revision_defectos: r.conteo_defectos_revisadora
        }));

        const cleanDefectsForAI = defects.slice(0, 10);

        const prompt = \`Actúa como un Ingeniero de Control de Calidad Textil y Auditor de Planta de Alta Performance. El volumen de metros analizados corresponde estrictamente a los "Metros Revisados de Primera" de tb_calidad. Analiza el siguiente JSON de datos consolidados:

1. RESUMEN GLOBAL DE DEFECTOS DEL PERIODO (Total metros: \${Number(totalMetros).toFixed(1)}m):
\${JSON.stringify(cleanDefectsForAI)}

2. DETALLE DE PARTIDAS CRÍTICAS (JSON Consolidados):
\${JSON.stringify(cleanDataForAI)}

Instrucciones Críticas de Análisis:

1. Análisis de Correlación Mecánica vs. Revisación (El Núcleo):
Calcula y analiza los ratios por partida crítica:
- Ratio de Traspaso de Trama: Compara las paradas mecánicas de trama (rt105_paradas_trama) contra el conteo físico de defectos (340_trama_mole, 382_trama_curta, 387_trama_dobrada).
- Ratio de Traspaso de Urdimbre: Compara las paradas de urdimbre (ru105_paradas_urdimbre) contra (313_fio_quebrado, 333_parada_tear).
Diagnóstico: Si paradas son altas pero defectos bajos, el operario trabaja bien. Si defectos superan o igualan paradas, detalla la falla en arranque o sensor.

2. Segmentación Física por Matriz de Trama:
Agrupa por tipo_trama_filtro. Da un dictamen sobre tramas 100% Algodón (Ne 9/1 vs Ne 7/1). Cruza esto con Índigo (r103_roturas_absolutas, cav105_cavalos_absolutos, velocidad_nominal) para saber si títulos finos venían penalizados desde la preparación.

3. Análisis Temporal y de Coincidencia (Clusters):
Revisa la cronologia_tejeduria (inicio/fin) de las partidas afectadas. Determina si los picos en ciertos telares fueron simultáneos. Si fueron contemporáneos, dicta si el patrón apunta a materia prima defectuosa (aislando la culpa del telar). Cruza con grupo_tear para identificar si la falla se mueve con el equipo humano o si es estática en la máquina.

Estructura Obligatoria del Output (en Markdown):
Sección 1: Diagnóstico de Correlación Matemática (Ratios de Traspaso por Partida).
Sección 2: Impacto Físico del Hilado (Dictamen de Composición y Títulos cruzado con Índigo).
Sección 3: Análisis Cronológico y Factor Humano (Simultaneidad y Grupo Tear).
Sección 4: Directivas Quirúrgicas de Planta (Acciones directas sin teoría genérica).\`;`;

content = content.replace(oldAIBlock, newAIBlock);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated AI payload and prompt successfully!");
