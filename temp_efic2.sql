SELECT
  LEFT(PROC."ARTIGO", 1) AS tipo,
  LEFT(PROC."ARTIGO", 10) AS artigo,
  PROC."COR" AS color,
  (
    CASE
      WHEN PROC."EFIC_DIA" IS NULL OR PROC."EFIC_DIA" = '' THEN NULL
      WHEN PROC."EFIC_DIA" ~ '^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$' THEN
        REPLACE(REPLACE(PROC."EFIC_DIA", '.', ''), ',', '.')::numeric
      WHEN PROC."EFIC_DIA" ~ '^-?[0-9]+(,[0-9]+)?$' THEN
        REPLACE(PROC."EFIC_DIA", ',', '.')::numeric
      WHEN PROC."EFIC_DIA" ~ '^-?[0-9]+[.][0-9]+$' THEN
        PROC."EFIC_DIA"::numeric
      ELSE NULL
    END
  ) AS efi,
  (
    CASE
      WHEN PROC."MT_PREVISTA" IS NULL OR PROC."MT_PREVISTA" = '' THEN NULL
      WHEN PROC."MT_PREVISTA" ~ '^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$' THEN
        REPLACE(REPLACE(PROC."MT_PREVISTA", '.', ''), ',', '.')::numeric
      WHEN PROC."MT_PREVISTA" ~ '^-?[0-9]+(,[0-9]+)?$' THEN
        REPLACE(PROC."MT_PREVISTA", ',', '.')::numeric
      ELSE NULL
    END
  ) AS metros_a_tejer,
  (
    CASE
      WHEN PROC."MT_DISPONIV" IS NULL OR PROC."MT_DISPONIV" = '' THEN NULL
      WHEN PROC."MT_DISPONIV" ~ '^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$' THEN
        REPLACE(REPLACE(PROC."MT_DISPONIV", '.', ''), ',', '.')::numeric
      WHEN PROC."MT_DISPONIV" ~ '^-?[0-9]+(,[0-9]+)?$' THEN
        REPLACE(PROC."MT_DISPONIV", ',', '.')::numeric
      ELSE NULL
    END
  ) AS tejido,
  (
    CASE
      WHEN PROC."MT_A_BATER" IS NULL OR PROC."MT_A_BATER" = '' THEN NULL
      WHEN PROC."MT_A_BATER" ~ '^-?[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?$' THEN
        REPLACE(REPLACE(PROC."MT_A_BATER", '.', ''), ',', '.')::numeric
      WHEN PROC."MT_A_BATER" ~ '^-?[0-9]+(,[0-9]+)?$' THEN
        REPLACE(PROC."MT_A_BATER", ',', '.')::numeric
      ELSE NULL
    END
  ) AS resto,
  (
    CASE
      WHEN PROC."LARGURA" IS NULL OR PROC."LARGURA" = '' THEN NULL
      WHEN PROC."LARGURA" ~ '^-?[0-9]+(,[0-9]+)?$' THEN
        REPLACE(PROC."LARGURA", ',', '.')::numeric
      ELSE NULL
    END
  ) AS ancho,
  FICHAS."SARJA" AS sarja
FROM tb_proceso PROC
LEFT JOIN tb_fichas FICHAS ON FICHAS."ARTIGO CODIGO" = PROC."ARTIGO"
WHERE BTRIM(PROC."PROCESSO") = 'TECELAGEM'
ORDER BY COALESCE(CASE WHEN RIGHT(PROC."MAQUINA", 2) ~ '^[0-9]+$' THEN RIGHT(PROC."MAQUINA", 2)::int ELSE 0 END, 0) ASC
LIMIT 5;
