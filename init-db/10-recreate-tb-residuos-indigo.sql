-- ============================================================================
-- Tabla: tb_RESIDUOS_INDIGO
-- Descripción: Registro de residuos de índigo por sector y turno
-- Fuente: RelResIndigo.csv (hoja rptResiduosIndigo)
-- Estructura: 39 columnas, 15 registros aprox.
-- Nota: Mapeo CSV "DEVOL TEC." → PostgreSQL "DEVOL TEC#"
-- ============================================================================

DROP TABLE IF EXISTS tb_RESIDUOS_INDIGO CASCADE;

CREATE TABLE tb_RESIDUOS_INDIGO (
    "FILIAL" TEXT,
    "SETOR" TEXT,
    "DESC_SETOR" TEXT,
    "DT_MOV" TEXT,
    "TURNO" TEXT,
    "SUBPRODUTO" TEXT,
    "DESCRICAO" TEXT,
    "ID" TEXT,
    "PESO LIQUIDO (KG)" TEXT,
    "LOTE" TEXT,
    "PARTIDA" TEXT,
    "ROLADA" TEXT,
    "MOTIVO" TEXT,
    "DESC_MOTIVO" TEXT,
    "OPERADOR" TEXT,
    "NOME_OPER" TEXT,
    "PE DE ROLO" TEXT,
    "INDIGO" TEXT,
    "URDUME" TEXT,
    "TURNO CORTE" TEXT,
    "GAIOLA" TEXT,
    "OBS" TEXT,
    "PESO ROLO 01" TEXT,
    "PESO ROLO 02" TEXT,
    "PESO ROLO 03" TEXT,
    "PESO ROLO 04" TEXT,
    "PESO ROLO 05" TEXT,
    "PESO ROLO 06" TEXT,
    "PESO ROLO 07" TEXT,
    "PESO ROLO 08" TEXT,
    "PESO ROLO 09" TEXT,
    "PESO ROLO 10" TEXT,
    "PESO ROLO 11" TEXT,
    "PESO ROLO 12" TEXT,
    "PESO ROLO 13" TEXT,
    "PESO ROLO 14" TEXT,
    "PESO ROLO 15" TEXT,
    "PESO ROLO 16" TEXT,
    "DEVOL TEC#" TEXT
);

-- Índices para optimizar consultas
CREATE INDEX idx_residuos_indigo_dt_mov ON tb_RESIDUOS_INDIGO ("DT_MOV");
CREATE INDEX idx_residuos_indigo_descricao ON tb_RESIDUOS_INDIGO ("DESCRICAO");
CREATE INDEX idx_residuos_indigo_filial ON tb_RESIDUOS_INDIGO ("FILIAL");
CREATE INDEX idx_residuos_indigo_setor ON tb_RESIDUOS_INDIGO ("SETOR");
CREATE INDEX idx_residuos_indigo_turno ON tb_RESIDUOS_INDIGO ("TURNO");

COMMENT ON TABLE tb_RESIDUOS_INDIGO IS 'Residuos de índigo por sector y turno';
