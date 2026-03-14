-- ============================================
-- Script para recrear tb_PRODUCCION_CARDA
-- Replica fielmente la estructura esperada de rptProducaoCarda.csv
-- ============================================

DROP TABLE IF EXISTS tb_PRODUCCION_CARDA CASCADE;

CREATE TABLE tb_PRODUCCION_CARDA (
    MAQUINA TEXT,
    LF TEXT,
    DATA TEXT,
    T TEXT,
    HR_INI TEXT,
    HR_FINA TEXT,
    ITEM TEXT,
    "DESC ITEM" TEXT,
    TITULO TEXT,
    RPM TEXT,
    "TEMPO TOTAL" TEXT,
    "PROD KG/H" TEXT,
    "PROD CALC" TEXT,
    "PROD INFORM" TEXT,
    "EFIC INFOR" TEXT,
    "EFIC CALC" TEXT,
    OBS TEXT,
    "D%" TEXT,
    CV TEXT,
    CVIn TEXT,
    PG TEXT,
    "A%" TEXT,
    "T (25%)" TEXT,
    "T (20%)" TEXT,
    "T (15%)" TEXT,
    "T1 (25%)" TEXT,
    "T1 (20%)" TEXT,
    "T1 (15%)" TEXT,
    "T2 (25%)" TEXT,
    "T2 (20%)" TEXT,
    "T2 (15%)" TEXT
);

CREATE INDEX IF NOT EXISTS idx_produccion_carda_data ON tb_PRODUCCION_CARDA(DATA);
CREATE INDEX IF NOT EXISTS idx_produccion_carda_maquina ON tb_PRODUCCION_CARDA(MAQUINA);
CREATE INDEX IF NOT EXISTS idx_produccion_carda_turno ON tb_PRODUCCION_CARDA(T);
CREATE INDEX IF NOT EXISTS idx_produccion_carda_item ON tb_PRODUCCION_CARDA(ITEM);

GRANT ALL PRIVILEGES ON TABLE tb_PRODUCCION_CARDA TO stc_user;

COMMENT ON TABLE tb_PRODUCCION_CARDA IS 'Tabla de producción de cardas (turno/maquina) importada desde rptProducaoCarda.csv';
