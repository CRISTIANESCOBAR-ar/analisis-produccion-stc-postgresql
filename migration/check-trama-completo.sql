-- Verificar columna TRAMA
SELECT "ARTIGO CODIGO", "TRAMA REDUZIDO", "TRAMA"
FROM tb_FICHAS
WHERE "TRAMA" IS NOT NULL AND "TRAMA" != ''
LIMIT 10;

-- Contar registros con TRAMA
SELECT 
  COUNT(*) as total,
  COUNT("TRAMA") AS con_trama,
  COUNT(*) - COUNT("TRAMA") AS sin_trama
FROM tb_FICHAS;
