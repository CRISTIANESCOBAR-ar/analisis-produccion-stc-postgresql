-- Validar calidad de datos en tb_FICHAS
SELECT 
  COUNT(*) as total_registros,
  COUNT(*) FILTER (WHERE "TRAMA" IS NOT NULL AND "TRAMA" != '') as con_trama,
  COUNT(*) FILTER (WHERE "SAP1" IS NOT NULL AND "SAP1" != '') as con_sap1,
  COUNT(*) FILTER (WHERE "SGS1" IS NOT NULL AND "SGS1" != '') as con_sgs1,
  COUNT(*) FILTER (WHERE "DESCRICAO1" IS NOT NULL AND "DESCRICAO1" != '') as con_desc1
FROM tb_fichas;

-- Muestra de datos con columnas duplicadas
SELECT 
  "ARTIGO CODIGO",
  "SAP" as sap_principal,
  "SAP1" as sap_duplicado,
  "TRAMA REDUZIDO" as trama_red_principal,
  "TRAMA REDUZIDO1" as trama_red_duplicado
FROM tb_fichas
WHERE "SAP1" IS NOT NULL AND "SAP1" != ''
LIMIT 5;
