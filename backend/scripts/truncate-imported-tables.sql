-- Truncate all CSV-imported tables before reimport
TRUNCATE TABLE
  tb_produccion,
  tb_produccion_oe,
  tb_testes,
  tb_paradas,
  tb_fichas,
  tb_residuos_por_sector,
  tb_residuos_indigo,
  tb_calidad,
  tb_calidad_fibra,
  tb_proceso,
  tb_defectos
CASCADE;
