-- ============================================
-- Script para recrear tb_PARADAS
-- Replica fielmente la estructura de SQLite
-- ============================================

-- Eliminar tabla existente si existe
DROP TABLE IF EXISTS tb_PARADAS CASCADE;

-- Crear tabla tb_PARADAS con 54 columnas (orden fiel a SQLite)
CREATE TABLE tb_PARADAS (
    FILIAL TEXT,
    MAQUINA TEXT,
    TP_MAQ TEXT,
    PROCESSO TEXT,
    DATA_BASE TEXT,
    HORA_INICIO TEXT,
    HORA_FINAL TEXT,
    TURNO TEXT,
    DURACAO TEXT,
    "NUM OCORREN" TEXT,
    OPERADOR TEXT,
    NOME_OPER TEXT,
    MOTIVO TEXT,
    DESC_MOTIVO TEXT,
    GRUPO TEXT,
    DESC_GRP_MOTIVO TEXT,
    CAUSA TEXT,
    DESC_CAUSA TEXT,
    LADO TEXT,
    POSICAO TEXT,
    PARTIDA TEXT,
    URDUME TEXT,
    INDIGO TEXT,
    DATA_TINGIMENT TEXT,
    TURNO_TING TEXT,
    STATUS_INDIG TEXT,
    OPER_TING TEXT,
    NOME_OPER_TING TEXT,
    GRUPO_MAQ TEXT,
    OBS TEXT,
    PARTIDA_ORIGINAL TEXT,
    CV_ORIG TEXT,
    ST_ORIG TEXT,
    OBS_ORIG TEXT,
    PARTIDA_ANTERIOR TEXT,
    CV_ANT TEXT,
    ST_ANT TEXT,
    OBS_ANT TEXT,
    PARTIDA_POSTERIOR TEXT,
    CV_POS TEXT,
    ST_POS TEXT,
    OBS_POS TEXT,
    ROLADA TEXT,
    "ID TROCA ROLADA" TEXT,
    MOTIVO1 TEXT,
    "DESCRICAO MOTIVO" TEXT,
    "ROLADA INICIAL" TEXT,
    COR TEXT,
    "ROLADA FINAL" TEXT,
    COR1 TEXT,
    "OBS TROCA ROLADA" TEXT,
    "TEMPO PREVISTO" TEXT,
    "SUB-GRUPO" TEXT,
    "DESC SUB-GRUPO" TEXT
);

-- Crear índices para columnas clave
CREATE INDEX IF NOT EXISTS idx_paradas_data_base ON tb_PARADAS(DATA_BASE);
CREATE INDEX IF NOT EXISTS idx_paradas_maquina ON tb_PARADAS(MAQUINA);
CREATE INDEX IF NOT EXISTS idx_paradas_filial ON tb_PARADAS(FILIAL);
CREATE INDEX IF NOT EXISTS idx_paradas_turno ON tb_PARADAS(TURNO);
CREATE INDEX IF NOT EXISTS idx_paradas_motivo ON tb_PARADAS(MOTIVO);
CREATE INDEX IF NOT EXISTS idx_paradas_partida ON tb_PARADAS(PARTIDA);

-- Grant de permisos
GRANT ALL PRIVILEGES ON TABLE tb_PARADAS TO stc_user;

COMMENT ON TABLE tb_PARADAS IS 'Tabla de paradas de máquinas - replicada desde SQLite';
