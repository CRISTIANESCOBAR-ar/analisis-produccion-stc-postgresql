-- ============================================
-- Script para recrear tb_PRODUCCION_OE
-- Replica fielmente la estructura de SQLite
-- ============================================

-- Eliminar tabla existente si existe
DROP TABLE IF EXISTS tb_PRODUCCION_OE CASCADE;

-- Crear tabla tb_PRODUCCION_OE con 45 columnas (orden fiel a CSV y SQLite)
CREATE TABLE tb_PRODUCCION_OE (
    FILIAL TEXT,
    "LOC. FISICO" TEXT,
    MAQUINA TEXT,
    NOME_MAQUINA TEXT,
    DATA_PRODUCAO TEXT,
    TURNO TEXT,
    LADO TEXT,
    ITEM TEXT,
    "DESC ITEM" TEXT,
    "HORA INICIAL" TEXT,
    "HORA FINAL" TEXT,
    RPM TEXT,
    "NUM FUSOS" TEXT,
    ALFA TEXT,
    "LOTE PRODUC" TEXT,
    "TÍTULO" TEXT,
    TEMPO TEXT,
    "TORCAO P POLEG" TEXT,
    "TORCAO P METRO" TEXT,
    "PROD MT/MIN" TEXT,
    "PROD KG/HR" TEXT,
    "PROD CALCULADA" TEXT,
    "PROD INFORMADA" TEXT,
    "EFIC CALCULADA" TEXT,
    "EFIC INFORMADA" TEXT,
    OPERADOR TEXT,
    "T.BOB." TEXT,
    "RPM CARD" TEXT,
    N TEXT,
    S TEXT,
    L TEXT,
    T TEXT,
    MO TEXT,
    "CP V+ SL+" TEXT,
    "CM V- SL-" TEXT,
    "CCp C+" TEXT,
    "CCm C-" TEXT,
    "JP (P+)" TEXT,
    "JM (P-)" TEXT,
    CVP TEXT,
    CVM TEXT,
    "CORT NAT" TEXT,
    "% ROB 01" TEXT,
    "% ROB 02" TEXT,
    "% ROB 03" TEXT
);

-- Crear índices para columnas clave
CREATE INDEX IF NOT EXISTS idx_produccion_oe_data_producao ON tb_PRODUCCION_OE(DATA_PRODUCAO);
CREATE INDEX IF NOT EXISTS idx_produccion_oe_maquina ON tb_PRODUCCION_OE(MAQUINA);
CREATE INDEX IF NOT EXISTS idx_produccion_oe_filial ON tb_PRODUCCION_OE(FILIAL);
CREATE INDEX IF NOT EXISTS idx_produccion_oe_turno ON tb_PRODUCCION_OE(TURNO);
CREATE INDEX IF NOT EXISTS idx_produccion_oe_item ON tb_PRODUCCION_OE(ITEM);
CREATE INDEX IF NOT EXISTS idx_produccion_oe_operador ON tb_PRODUCCION_OE(OPERADOR);

-- Grant de permisos
GRANT ALL PRIVILEGES ON TABLE tb_PRODUCCION_OE TO stc_user;

COMMENT ON TABLE tb_PRODUCCION_OE IS 'Tabla de producción OE (Open End) - replicada desde SQLite';
