-- Vista de Trazabilidad Completa (Base para Golden Batch)
-- Une: Tejeduría (Performance) <-> Urdidora (Lote) <-> Fibra (HVI)

DROP VIEW IF EXISTS view_golden_batch_data CASCADE;

CREATE VIEW view_golden_batch_data AS
WITH IND AS (
    -- Filtramos solo Roladas de Índigo Filial 05 para asegurar consistencia
    SELECT DISTINCT "ROLADA"
    FROM tb_produccion
    WHERE "SELETOR" = 'INDIGO' AND "FILIAL" = '05'
),
TEJIDOS AS (
    SELECT 
        "ROLADA",
        -- Eficiencia Real: Puntos Lidos / Puntos 100%
        CASE 
            WHEN SUM(CASE WHEN "PONTOS_100%" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("PONTOS_100%", '.', ''), ',', '.')::numeric ELSE 0 END) = 0 THEN 0
            ELSE (SUM(CASE WHEN "PONTOS_LIDOS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("PONTOS_LIDOS", '.', ''), ',', '.')::numeric ELSE 0 END) / SUM(CASE WHEN "PONTOS_100%" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("PONTOS_100%", '.', ''), ',', '.')::numeric ELSE 0 END)) * 100 
        END AS efic_tej,
        -- Roturas Urdimbre x 10^5 metros
        CASE 
            WHEN SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) = 0 THEN 0
            ELSE (SUM(CASE WHEN "PARADA TEC URDUME" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("PARADA TEC URDUME", '.', ''), ',', '.')::numeric ELSE 0 END) * 100000.0) / (SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) * 1000.0) 
        END AS ru_105,
        SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) as metros_tejidos
    FROM tb_produccion
    WHERE "SELETOR" = 'TECELAGEM' 
      AND "FILIAL" = '05'
      -- Filtro de limpieza: Solo consideramos turnos donde la máquina realmente produjo.
      -- Si METROS o PUNTOS LEIDOS son > 0, intentó trabajar.
      AND (
          (CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) > 0
          OR 
          (CASE WHEN "PONTOS_LIDOS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("PONTOS_LIDOS", '.', ''), ',', '.')::numeric ELSE 0 END) > 0
      )
    GROUP BY "ROLADA"
),
URDIMBRES_LOTE AS (
    -- Paso Crítico: Extraer el Lote de Hilo de la Urdidora
    SELECT 
        "ROLADA",
        -- Limpieza de LOTE (quitar letras, espacios, ceros iniciales irrlevantes para cruce)
        CAST(NULLIF(regexp_replace("LOTE FIACAO", '[^0-9]', '', 'g'), '') AS BIGINT) as lote_id
    FROM tb_produccion
    WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA') 
      AND "LOTE FIACAO" IS NOT NULL
    GROUP BY "ROLADA", "LOTE FIACAO"
),
FIBRA_AGREGADA AS (
    -- Promediamos HVI por LOTE (un lote puede tener varias mezclas o entradas)
    SELECT 
        CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS BIGINT) as lote_id,
        AVG(CASE WHEN "SCI" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("SCI", '.', ''), ',', '.')::numeric ELSE NULL END) as sci,
        AVG(CASE WHEN "MST" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("MST", '.', ''), ',', '.')::numeric ELSE NULL END) as mst,
        AVG(CASE WHEN "MIC" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("MIC", '.', ''), ',', '.')::numeric ELSE NULL END) as mic,
        AVG(CASE WHEN "MAT" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("MAT", '.', ''), ',', '.')::numeric ELSE NULL END) as mat,
        AVG(CASE WHEN "UHML" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("UHML", '.', ''), ',', '.')::numeric ELSE NULL END) as uhml,
        AVG(CASE WHEN "UI" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("UI", '.', ''), ',', '.')::numeric ELSE NULL END) as ui,
        AVG(CASE WHEN "SF" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("SF", '.', ''), ',', '.')::numeric ELSE NULL END) as sf,
        AVG(CASE WHEN "STR" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("STR", '.', ''), ',', '.')::numeric ELSE NULL END) as str,
        AVG(CASE WHEN "ELG" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("ELG", '.', ''), ',', '.')::numeric ELSE NULL END) as elg,
        AVG(CASE WHEN "RD" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("RD", '.', ''), ',', '.')::numeric ELSE NULL END) as rd,
        AVG(CASE WHEN "PLUS_B" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("PLUS_B", '.', ''), ',', '.')::numeric ELSE NULL END) as plus_b,
        AVG(CASE WHEN "TrCNT" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("TrCNT", '.', ''), ',', '.')::numeric ELSE NULL END) as trcnt
    FROM tb_calidad_fibra
    -- Excluir nulos o ceros que ensucien
    WHERE "SCI" IS NOT NULL
    GROUP BY 1
)
SELECT 
    t."ROLADA",
    t.efic_tej,
    t.ru_105,
    f.sci, f.mst, f.mic, f.mat, f.uhml, f.ui, f.sf, f.str, f.elg
FROM TEJIDOS t
JOIN IND i ON t."ROLADA" = i."ROLADA"
JOIN URDIMBRES_LOTE u ON t."ROLADA" = u."ROLADA"
JOIN FIBRA_AGREGADA f ON u.lote_id = f.lote_id;

-- QUERY DE ANÁLISIS "GOLDEN BATCH"
-- Ejecutar esto para obtener los parámetros ideales

/*
SELECT 
    'GOLDEN BATCH (Efic > 92%, RU < 5)' as categoria,
    COUNT(*) as casos,
    ROUND(AVG(sci), 1) as sci_ideal,
    ROUND(AVG(str), 1) as str_ideal,
    ROUND(AVG(mic), 2) as mic_ideal,
    ROUND(AVG(uhml), 2) as uhml_ideal,
    ROUND(AVG(sf), 1) as sf_ideal
FROM view_golden_batch_data
WHERE efic_tej > 92 AND ru_105 < 5

UNION ALL

SELECT 
    'PROBLEMATICOS (Efic < 88%)' as categoria,
    COUNT(*) as casos,
    ROUND(AVG(sci), 1) as sci_bad,
    ROUND(AVG(str), 1) as str_bad,
    ROUND(AVG(mic), 2) as mic_bad,
    ROUND(AVG(uhml), 2) as uhml_bad,
    ROUND(AVG(sf), 1) as sf_bad
FROM view_golden_batch_data
WHERE efic_tej < 88;
*/
