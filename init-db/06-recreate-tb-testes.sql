-- ============================================
-- Script para recrear tb_TESTES
-- Replica fielmente la estructura de SQLite
-- ============================================

-- Eliminar tabla existente si existe
DROP TABLE IF EXISTS tb_TESTES CASCADE;

-- Crear tabla tb_TESTES con 26 columnas (orden fiel a CSV y SQLite)
CREATE TABLE tb_TESTES (
    MAQUINA TEXT,
    ARTIGO TEXT,
    NM_MERC TEXT,
    PARTIDA TEXT,
    METRAGEM TEXT,
    DT_PROD TEXT,
    HORA_PROD TEXT,
    TURNO TEXT,
    LARG_AL TEXT,
    GRAMAT TEXT,
    POTEN TEXT,
    "%_ENC_URD" TEXT,
    "%_ENC_TRAMA" TEXT,
    "%_SK1" TEXT,
    "%_SK2" TEXT,
    "%_SK3" TEXT,
    "%_SK4" TEXT,
    "%_SKE" TEXT,
    "%_STT" TEXT,
    "%_SKM" TEXT,
    APROV TEXT,
    COD_ART TEXT,
    COR_ART TEXT,
    OBS TEXT,
    REPROCESSO TEXT,
    "SEQ TESTE" TEXT
);

-- Crear índices para columnas clave
CREATE INDEX IF NOT EXISTS idx_testes_artigo ON tb_TESTES(ARTIGO);
CREATE INDEX IF NOT EXISTS idx_testes_partida ON tb_TESTES(PARTIDA);
CREATE INDEX IF NOT EXISTS idx_testes_dt_prod ON tb_TESTES(DT_PROD);
CREATE INDEX IF NOT EXISTS idx_testes_maquina ON tb_TESTES(MAQUINA);
CREATE INDEX IF NOT EXISTS idx_testes_turno ON tb_TESTES(TURNO);

-- Grant de permisos
GRANT ALL PRIVILEGES ON TABLE tb_TESTES TO stc_user;

COMMENT ON TABLE tb_TESTES IS 'Tabla de testes físicos - replicada desde SQLite';
