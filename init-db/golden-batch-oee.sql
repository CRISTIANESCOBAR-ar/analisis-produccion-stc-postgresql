-- Vista de Golden Batch con Ajuste OEE (Descuento de Paradas Exógenas)
-- Esta vista reemplaza la versión anterior incorporando el ajuste de eficiencia neta.

DROP VIEW IF EXISTS view_golden_batch_data CASCADE;

CREATE VIEW view_golden_batch_data AS
WITH -- 1. Calcular Minutos de Parada NO Atribuibles al Proceso (Exógenas)
PARADAS_EXOGENAS AS (
    SELECT 
        -- Casteo robusto de fecha: formato DD/MM/YY o DD/MM/YYYY
        CASE 
            WHEN "data_base" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}$' THEN to_date("data_base", 'DD/MM/YY')
            WHEN "data_base" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date("data_base", 'DD/MM/YYYY')
            ELSE NULL 
        END as fecha_parada,
        "maquina"::text as maquina_parada,
        "turno"::text as turno_parada,
        -- Sumamos duración de paradas exógenas (Falta Energía, Aire, etc.)
        -- Ajustamos tipos y formatos según tu estructura
        SUM(
            CASE 
                -- Si 'duracao' ya viene en minutos como entero
                WHEN "duracao" ~ '^[0-9]+$' THEN "duracao"::numeric
                -- Fallback si viene como texto
                ELSE 0 
            END
        ) as minutos_descuento
    FROM tb_paradas
    WHERE "motivo" IN ('401', '352', '301', '202') -- Energía, Aire, UrdimbreLogística, MantPrev
      AND "processo" = 'TEARES'
    GROUP BY 1, 2, 3
),
-- 2. Producción Ajustada (OEE Neto)
PRODUCCION_AJUSTADA AS (
    SELECT 
        p."ROLADA",
        p."MAQUINA",
        p."DT_BASE_PRODUCAO",
        p."TURNO",
        p."ARTIGO",
        -- Métricas originales
        COALESCE(CASE WHEN p."PONTOS_LIDOS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE(p."PONTOS_LIDOS", '.', ''), ',', '.')::numeric ELSE 0 END, 0) as ptos_real,
        COALESCE(CASE WHEN p."PONTOS_100%" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE(p."PONTOS_100%", '.', ''), ',', '.')::numeric ELSE 0 END, 0) as ptos_teorico,
        COALESCE(CASE WHEN p."METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE(p."METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END, 0) as metros_real,
        COALESCE(CASE WHEN p."PARADA TEC URDUME" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE(p."PARADA TEC URDUME", '.', ''), ',', '.')::numeric ELSE 0 END, 0) as paradas_urd,
        COALESCE(CASE WHEN p."PARADA TEC TRAMA" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE(p."PARADA TEC TRAMA", '.', ''), ',', '.')::numeric ELSE 0 END, 0) as paradas_trama,
        -- Tiempo Total del Turno (Asumimos 480 min si no está o calculamos)
        COALESCE(
           CASE WHEN p."TOTAL MINUTOS TUR" ~ '^[0-9]+$' THEN p."TOTAL MINUTOS TUR"::numeric ELSE 480 END, 
           480
        ) as minutos_turno_total,
        -- Traemos descuento
        COALESCE(pe.minutos_descuento, 0) as minutos_descuento
    FROM tb_produccion p
    LEFT JOIN PARADAS_EXOGENAS pe 
        ON (CASE 
              WHEN p."DT_BASE_PRODUCAO" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}$' THEN to_date(p."DT_BASE_PRODUCAO", 'DD/MM/YY')
              WHEN p."DT_BASE_PRODUCAO" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(p."DT_BASE_PRODUCAO", 'DD/MM/YYYY')
              ELSE NULL 
           END) = pe.fecha_parada
        AND p."MAQUINA" = pe.maquina_parada
        AND p."TURNO" = pe.turno_parada
    WHERE p."SELETOR" = 'TECELAGEM' AND p."FILIAL" = '05'
),
TEJIDOS_AGREGADO AS (
    SELECT 
        "ROLADA",
        -- Convertimos a fecha real ISO para evitar problemas de "Invalid Date" en JS
        CASE 
           WHEN MAX("DT_BASE_PRODUCAO") ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$' THEN to_date(MAX("DT_BASE_PRODUCAO"), 'DD/MM/YYYY')
           WHEN MAX("DT_BASE_PRODUCAO") ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}$' THEN to_date(MAX("DT_BASE_PRODUCAO"), 'DD/MM/YY')
           ELSE NULL -- O intentamos conversión directa
        END as "DATA",
        MAX("TURNO") as "TURNO",
        MAX("ARTIGO") as "ARTICULO",
        SUM(metros_real) as "TEJIDO_REAL_M",
        -- Cálculo de Eficiencia Ajustada (OEE) ponderada
        -- Sumamos Puntos Reales de todos los turnos de la rolada
        -- Dividimos por la suma de TEÓRICOS AJUSTADOS
        CASE 
            WHEN SUM(
                CASE 
                    -- Si el descuento es >= al turno completo, anulamos el teórico (evitar div/0 y negativos)
                    WHEN minutos_descuento >= minutos_turno_total THEN 0 
                    ELSE ptos_teorico * ((minutos_turno_total - minutos_descuento) / NULLIF(minutos_turno_total, 0))
                END
            ) = 0 THEN 0
            ELSE 
                (SUM(ptos_real) / 
                SUM(
                    CASE 
                        WHEN minutos_descuento >= minutos_turno_total THEN 0 
                        ELSE ptos_teorico * ((minutos_turno_total - minutos_descuento) / NULLIF(minutos_turno_total, 0))
                    END
                )) * 100
        END as efic_tej,
        
        -- Roturas Urdimbre (Igual que antes, pero filtrando metros 0)
        CASE 
            WHEN SUM(metros_real) = 0 THEN 0
            ELSE (SUM(paradas_urd) * 100000.0) / (SUM(metros_real) * 1000.0)
        END as ru_105,
        
        -- Roturas Trama (Nueva métrica)
        CASE 
            WHEN SUM(metros_real) = 0 THEN 0
            ELSE (SUM(paradas_trama) * 100000.0) / (SUM(metros_real) * 1000.0)
        END as rt_105

    FROM PRODUCCION_AJUSTADA
    -- Filtro Crítico: Solo consideramos registros donde HUBO intención de producir (Metros > 0 o Puntos > 0)
    -- O donde hubo paradas exógenas que justifican el 0.
    WHERE (metros_real > 0 OR ptos_real > 0 OR minutos_descuento > 0)
    GROUP BY "ROLADA"
),
URDIMBRES_LOTE AS (
    SELECT 
        "ROLADA",
        -- Un solo lote_id por ROLADA (MAX para elegir el principal, igual que SeguimientoRoladas)
        MAX(CAST(NULLIF(regexp_replace("LOTE FIACAO", '[^0-9]', '', 'g'), '') AS BIGINT)) as lote_id,
        -- Cálculo Roturas Urdidora (Rot 10^6) = (Rupturas * 10^6) / (Metros * NumFios)
        -- Misma fórmula que SeguimientoRoladasFibra.vue: calcularRot106
        CASE 
            WHEN SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) = 0
              OR MAX(CASE WHEN "NUM_FIOS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("NUM_FIOS", '.', ''), ',', '.')::numeric ELSE 0 END) = 0
            THEN 0
            ELSE (SUM(CASE WHEN "RUPTURAS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("RUPTURAS", '.', ''), ',', '.')::numeric ELSE 0 END) * 1000000.0) / 
                 (SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) *
                  MAX(CASE WHEN "NUM_FIOS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("NUM_FIOS", '.', ''), ',', '.')::numeric ELSE 1 END))
        END as rot_urd_urdidora
    FROM tb_produccion
    WHERE "SELETOR" IN ('URDIDEIRA', 'URDIDORA') 
      AND "LOTE FIACAO" IS NOT NULL
    GROUP BY "ROLADA"
),
INDIGO_INFO AS (
    SELECT 
        "ROLADA",
        -- Fecha inicial de la rolada en Índigo: MIN(DT_INICIO)
        MIN(
            CASE
                WHEN "DT_INICIO" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}' THEN to_date(substring("DT_INICIO" from 1 for 10), 'DD/MM/YYYY')
                WHEN "DT_INICIO" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN substring("DT_INICIO" from 1 for 10)::date
                ELSE NULL
            END
        ) as "INDIGO_FECHA",
        MAX("BASE URDUME") as "INDIGO_BASE",
        MAX("COR") as "INDIGO_COLOR",
        -- R10³ = (Rupturas * 1000) / Metros  (misma fórmula que SeguimientoRoladas "R103")
        CASE 
            WHEN SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) = 0 THEN NULL
            ELSE ROUND((
                SUM(CASE WHEN "RUPTURAS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("RUPTURAS", '.', ''), ',', '.')::numeric ELSE 0 END) * 1000.0
            ) / NULLIF(
                SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END)
            , 0), 2)
        END as "INDIGO_R",
        -- Cav 10⁵ = (Cavalos * 100000) / Metros  (misma fórmula que SeguimientoRoladas calcularCav105)
        CASE 
            WHEN SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) = 0 THEN NULL
            ELSE ROUND((
                SUM(CASE WHEN "CAVALOS" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("CAVALOS", '.', ''), ',', '.')::numeric ELSE 0 END) * 100000.0
            ) / NULLIF(
                SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END)
            , 0), 2)
        END as "INDIGO_CAVALOS",
        -- Vel.Nom = MAX(VELOC) parseado numéricamente
        MAX(CASE WHEN "VELOC" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("VELOC", '.', ''), ',', '.')::numeric ELSE NULL END) as "INDIGO_VEL_NOM",
        -- Vel.Prom = SUM(metragem * veloc) / SUM(metragem)  (promedio ponderado, igual que SeguimientoRoladas)
        CASE 
            WHEN SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) = 0 THEN NULL
            ELSE ROUND(
                SUM(
                    (CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END) *
                    COALESCE(CASE WHEN "VELOC" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("VELOC", '.', ''), ',', '.')::numeric ELSE NULL END, 0)
                ) / NULLIF(
                    SUM(CASE WHEN "METRAGEM" ~ '^[0-9.,]+$' THEN REPLACE(REPLACE("METRAGEM", '.', ''), ',', '.')::numeric ELSE 0 END)
                , 0)::numeric
            , 2)
        END as "INDIGO_VEL_REAL"
    FROM tb_produccion
    WHERE "SELETOR" = 'INDIGO'
    GROUP BY "ROLADA"
),
FIBRA_AGREGADA AS (
    SELECT 
        CAST(NULLIF(regexp_replace("LOTE_FIAC", '[^0-9]', '', 'g'), '') AS BIGINT) as lote_id,
        MAX("LOTE_FIAC") as "LOTE_FIBRA_TEXT", -- Guardamos el texto original
        MAX("MISTURA") as "MISTURA",           -- Guardamos la mistura
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
    WHERE "SCI" IS NOT NULL
    GROUP BY 1
)
SELECT 
    t."ROLADA",
    t."DATA",
    t."TURNO",
    t."ARTICULO",
    t."TEJIDO_REAL_M",
    t.efic_tej as "EFIC_TEJ",
    t.ru_105 as "RU_105",
    t.rt_105 as "RT_105", -- Roturas Trama
    t.ru_105 as "RUB_105", -- Duplicado para compatibilidad
    u.rot_urd_urdidora as "ROT_URD_URDI",
    i."INDIGO_FECHA",
    i."INDIGO_BASE",
    i."INDIGO_COLOR",
    i."INDIGO_R",
    i."INDIGO_CAVALOS",
    i."INDIGO_VEL_NOM",
    i."INDIGO_VEL_REAL",
    f."LOTE_FIBRA_TEXT",
    f."MISTURA",
    f.sci as "SCI",
    f.str as "STR",
    f.mic as "MIC",
    f.mst, f.mat, f.uhml, f.ui, f.sf, f.elg, f.trcnt
FROM TEJIDOS_AGREGADO t
JOIN URDIMBRES_LOTE u ON t."ROLADA" = u."ROLADA"
LEFT JOIN INDIGO_INFO i ON t."ROLADA" = i."ROLADA"
JOIN FIBRA_AGREGADA f ON u.lote_id = f.lote_id;
