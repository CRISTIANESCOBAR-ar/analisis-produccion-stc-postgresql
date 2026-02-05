-- ============================================================================
-- Tabla: tb_PROCESO
-- Descripción: Posición de stock en proceso (estoque en producción)
-- Fuente: rpsPosicaoEstoquePRD.csv (hoja rptStock)
-- Estructura: 40 columnas, ~130 registros
-- Nota: SQLite usa tb_PROCESO (una S), no tb_PROCESSO
-- ============================================================================

DROP TABLE IF EXISTS tb_PROCESO CASCADE;

CREATE TABLE tb_PROCESO (
    "FILIAL" TEXT,
    "PROCESSO" TEXT,
    "PARTIDA" TEXT,
    "ARTIGO" TEXT,
    "COR" TEXT,
    "DESC_NM_MERC" TEXT,
    "MT_DISPONIV" TEXT,
    "DT_PROD" TEXT,
    "NUM_FIOS" TEXT,
    "FLANGE" TEXT,
    "LADO" TEXT,
    "MAQUINA" TEXT,
    "STATUS" TEXT,
    "URDUME" TEXT,
    "MT_PREVISTA" TEXT,
    "MT_A_BATER" TEXT,
    "MT_PROX24H" TEXT,
    "BATIDAS" TEXT,
    "RPM" TEXT,
    "EFIC_TA" TEXT,
    "EFIC_TB" TEXT,
    "EFIC_TC" TEXT,
    "EFIC_DIA" TEXT,
    "ART_PROGR" TEXT,
    "NM_MERC_PROG" TEXT,
    "COR_PG" TEXT,
    "URDUME_PRO" TEXT,
    "GRUPO_TEAR" TEXT,
    "REPROCESSO" TEXT,
    "LARGURA" TEXT,
    "TRAMA_REDUZIDA_1" TEXT,
    "TRAMA_REDUZIDA_2" TEXT,
    "DATA FINAL TECEL" TEXT,
    "HORA_FINAL_TECEL" TEXT,
    "TURNO_FINAL_TECE" TEXT,
    "HORA_FINAL_TECEL_V2" TEXT,
    "OBS ACABAMENTO" TEXT,
    "COD MOT REP" TEXT,
    "MOTIVO REPROCESSO" TEXT,
    "OBS REPROCESSO" TEXT
);

-- Índices para optimizar consultas
CREATE INDEX idx_proceso_partida ON tb_PROCESO ("PARTIDA");
CREATE INDEX idx_proceso_dt_prod ON tb_PROCESO ("DT_PROD");
CREATE INDEX idx_proceso_maquina ON tb_PROCESO ("MAQUINA");
CREATE INDEX idx_proceso_filial ON tb_PROCESO ("FILIAL");
CREATE INDEX idx_proceso_status ON tb_PROCESO ("STATUS");
CREATE INDEX idx_proceso_artigo ON tb_PROCESO ("ARTIGO");

COMMENT ON TABLE tb_PROCESO IS 'Posición de stock en proceso (producción en curso)';
