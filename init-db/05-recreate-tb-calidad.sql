-- ============================================================================
-- Script: Recrear tb_CALIDAD con estructura SQLite funcional
-- Fecha: 2026-02-05
-- Descripción: Elimina tabla PostgreSQL y recrea con 87 columnas
-- ============================================================================

-- Eliminar tabla existente
DROP TABLE IF EXISTS tb_CALIDAD CASCADE;

-- Crear tabla con estructura SQLite (87 columnas)
CREATE TABLE tb_CALIDAD (
  "EMP" TEXT,
  "DAT_PROD" TEXT,
  "GRP_DEF" TEXT,
  "COD_DE" TEXT,
  "DEFEITO" TEXT,
  "INDIGO" TEXT,
  "CC" TEXT,
  "GRP_TEAR" TEXT,
  "TEAR" TEXT,
  "ARTIGO" TEXT,
  "COR" TEXT,
  "PARTIDA" TEXT,
  "G_CMEST" TEXT,
  "ACONDIC" TEXT,
  "GRP_TEC" TEXT,
  "TRAMA" TEXT,
  "ROLADA" TEXT,
  "METRAGEM" TEXT,
  "QUALIDADE" TEXT,
  "PESO BRUTO" TEXT,
  "REVISOR FINAL" TEXT,
  "HORA" TEXT,
  "NM MERC" TEXT,
  "TUR TEC" TEXT,
  "T TEC1" TEXT,
  "T TEC2" TEXT,
  "EMENDAS" TEXT,
  "PEÇA" TEXT,
  "ETIQUETA" TEXT,
  "PESO LIQUIDO" TEXT,
  "LARGURA" TEXT,
  "GR/M2" TEXT,
  "T INDIGO" TEXT,
  "PONTUACAO" TEXT,
  "REPROCESSO" TEXT,
  "COD DIREC" TEXT,
  "DESC DIREC" TEXT,
  "DT INI TEC" TEXT,
  "HR INI TEC" TEXT,
  "DT FIM TEC" TEXT,
  "HR FIM TEC" TEXT,
  "RPM TECEL" TEXT,
  "GRUPO CMESTR" TEXT,
  "URDUME" TEXT,
  "MODELO TEAR" TEXT,
  "ST IND" TEXT,
  "G#PR" TEXT,
  "DT  TINGIMENTO" TEXT,
  "TURNO INDIGO" TEXT,
  "OPER INDIGO" TEXT,
  "LAVADEIRA 01" TEXT,
  "TURNO LAVAD " TEXT,
  "LAVADEIRA 02" TEXT,
  "TURNO LAVAD 1" TEXT,
  "LAVADEIRA 03" TEXT,
  "TURNO LAVAD 03" TEXT,
  "INTEGRADA" TEXT,
  "TURNO INTEGR" TEXT,
  "SANFOR 01" TEXT,
  "TURNO SANF 01" TEXT,
  "SANFOR 02" TEXT,
  "TURNO SANF 02" TEXT,
  "CALANDRA" TEXT,
  "TURNO CALAND" TEXT,
  "ESTAMAPRIA" TEXT,
  "TURNO ESTAMP" TEXT,
  "MERCERZ 01" TEXT,
  "TURNO MERC 01" TEXT,
  "MERCERZ 02" TEXT,
  "TURNO MERC 02" TEXT,
  "DATA PESAGEM" TEXT,
  "HORA PESAGEM" TEXT,
  "TURNO PESAGEM " TEXT,
  "LOCAL TECEL" TEXT,
  "DEF EMENDA" TEXT,
  "DESC DEF EMENDA" TEXT,
  "HORARIO_REVISAO" TEXT,
  "TURNO_HORARIO_REVISAO" TEXT,
  "TURNO_REVISAO" TEXT,
  "DATA_REVISAO" TEXT,
  "REVISOR EMENDA" TEXT,
  "HORA PECA FINAL" TEXT,
  "TURNO PECA FINAL" TEXT,
  "G.PR" TEXT,
  "TURNO LAVAD" TEXT,
  "TURNO PESAGEM" TEXT,
  "DEFEITO MANCHA" TEXT
);

-- Crear índices para optimizar consultas
CREATE INDEX idx_calidad_artigo ON tb_CALIDAD("ARTIGO");
CREATE INDEX idx_calidad_partida ON tb_CALIDAD("PARTIDA");
CREATE INDEX idx_calidad_dat_prod ON tb_CALIDAD("DAT_PROD");
CREATE INDEX idx_calidad_rolada ON tb_CALIDAD("ROLADA");
CREATE INDEX idx_calidad_etiqueta ON tb_CALIDAD("ETIQUETA");

-- Mensaje de confirmación
SELECT 'tb_CALIDAD recreada con 87 columnas (estructura SQLite)' as status;
