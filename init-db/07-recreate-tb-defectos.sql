-- ============================================
-- Script para recrear tb_DEFECTOS
-- Replica fielmente la estructura de SQLite
-- ============================================

-- Eliminar tabla existente si existe
DROP TABLE IF EXISTS tb_DEFECTOS CASCADE;

-- Crear tabla tb_DEFECTOS con 11 columnas (orden fiel a CSV y SQLite)
CREATE TABLE tb_DEFECTOS (
    FILIAL TEXT,
    PARTIDA TEXT,
    PECA TEXT,
    ETIQUETA TEXT,
    ARTIGO TEXT,
    NM_MERC TEXT,
    COD_DEF TEXT,
    DESC_DEFEITO TEXT,
    PONTOS TEXT,
    QUALIDADE TEXT,
    DATA_PROD TEXT
);

-- Crear índices para columnas clave
CREATE INDEX IF NOT EXISTS idx_defectos_partida ON tb_DEFECTOS(PARTIDA);
CREATE INDEX IF NOT EXISTS idx_defectos_artigo ON tb_DEFECTOS(ARTIGO);
CREATE INDEX IF NOT EXISTS idx_defectos_etiqueta ON tb_DEFECTOS(ETIQUETA);
CREATE INDEX IF NOT EXISTS idx_defectos_data_prod ON tb_DEFECTOS(DATA_PROD);
CREATE INDEX IF NOT EXISTS idx_defectos_cod_def ON tb_DEFECTOS(COD_DEF);
CREATE INDEX IF NOT EXISTS idx_defectos_qualidade ON tb_DEFECTOS(QUALIDADE);

-- Grant de permisos
GRANT ALL PRIVILEGES ON TABLE tb_DEFECTOS TO stc_user;

COMMENT ON TABLE tb_DEFECTOS IS 'Tabla de defectos por pieza - replicada desde SQLite';
