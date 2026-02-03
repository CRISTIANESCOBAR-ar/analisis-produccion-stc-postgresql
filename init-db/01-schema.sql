-- =====================================================
-- SCHEMA INICIAL - STC PRODUCCIÓN V2
-- Base de datos PostgreSQL 16
-- =====================================================

-- Extensiones útiles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Para búsquedas fuzzy

-- =====================================================
-- TABLA: produccion
-- Migrada de: tb_PRODUCCION
-- =====================================================
CREATE TABLE IF NOT EXISTS produccion (
    id SERIAL PRIMARY KEY,
    filial VARCHAR(2) NOT NULL,
    fecha_produccion DATE NOT NULL,
    turno VARCHAR(1),
    maquina VARCHAR(10) NOT NULL,
    artigo VARCHAR(20),
    partida VARCHAR(20),
    metros_producidos DECIMAL(12,2),
    metros_2a DECIMAL(12,2),
    total_minutos INTEGER,
    minutos_producao INTEGER,
    minutos_parada INTEGER,
    eficiencia DECIMAL(5,2),
    velocidade_media DECIMAL(8,2),
    largura_tela DECIMAL(6,2),
    peso_rolo DECIMAL(8,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT produccion_fecha_check CHECK (fecha_produccion >= '2020-01-01'),
    CONSTRAINT produccion_metros_check CHECK (metros_producidos >= 0),
    CONSTRAINT produccion_eficiencia_check CHECK (eficiencia BETWEEN 0 AND 100)
);

-- Índices para produccion
CREATE INDEX idx_produccion_fecha ON produccion(fecha_produccion DESC);
CREATE INDEX idx_produccion_filial ON produccion(filial);
CREATE INDEX idx_produccion_maquina ON produccion(maquina);
CREATE INDEX idx_produccion_partida ON produccion(partida);
CREATE INDEX idx_produccion_combined ON produccion(fecha_produccion, filial, maquina);
CREATE INDEX idx_produccion_artigo ON produccion(artigo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER produccion_updated_at
    BEFORE UPDATE ON produccion
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: calidad
-- Migrada de: tb_CALIDAD
-- =====================================================
CREATE TABLE IF NOT EXISTS calidad (
    id SERIAL PRIMARY KEY,
    filial VARCHAR(2) NOT NULL,
    fecha_produccion DATE NOT NULL,
    partida VARCHAR(20),
    artigo VARCHAR(20),
    lote VARCHAR(20),
    rolada VARCHAR(20),
    revisor VARCHAR(100),
    metros_revisados DECIMAL(12,2),
    metros_2a DECIMAL(12,2),
    puntos_defecto INTEGER DEFAULT 0,
    puntos_100m2 DECIMAL(8,2),
    porcentaje_calidad DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Restricciones
    CONSTRAINT calidad_fecha_check CHECK (fecha_produccion >= '2020-01-01'),
    CONSTRAINT calidad_metros_check CHECK (metros_revisados >= 0),
    CONSTRAINT calidad_porcentaje_check CHECK (porcentaje_calidad BETWEEN 0 AND 100)
);

-- Índices para calidad
CREATE INDEX idx_calidad_fecha ON calidad(fecha_produccion DESC);
CREATE INDEX idx_calidad_partida ON calidad(partida);
CREATE INDEX idx_calidad_revisor ON calidad(revisor);
CREATE INDEX idx_calidad_rolada ON calidad(rolada);
CREATE INDEX idx_calidad_combined ON calidad(fecha_produccion, filial);

CREATE TRIGGER calidad_updated_at
    BEFORE UPDATE ON calidad
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: residuos_indigo
-- Migrada de: tb_RESIDUOS_INDIGO
-- =====================================================
CREATE TABLE IF NOT EXISTS residuos_indigo (
    id SERIAL PRIMARY KEY,
    filial VARCHAR(2) NOT NULL,
    fecha DATE NOT NULL,
    metros_producidos DECIMAL(12,2),
    estopa_azul_kg DECIMAL(10,2),
    porcentaje_estopa DECIMAL(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_residuos_indigo_fecha ON residuos_indigo(fecha DESC);
CREATE INDEX idx_residuos_indigo_filial ON residuos_indigo(filial);

CREATE TRIGGER residuos_indigo_updated_at
    BEFORE UPDATE ON residuos_indigo
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- TABLA: import_control
-- Control de importaciones mejorado
-- =====================================================
CREATE TABLE IF NOT EXISTS import_control (
    id SERIAL PRIMARY KEY,
    tabla_destino VARCHAR(100) NOT NULL UNIQUE,
    archivo_origen VARCHAR(500) NOT NULL,
    ultima_importacion TIMESTAMP,
    fecha_modificacion_archivo TIMESTAMP,
    registros_importados INTEGER DEFAULT 0,
    hash_archivo VARCHAR(64),
    estado VARCHAR(20) DEFAULT 'pending', -- pending, success, error
    mensaje_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_import_control_tabla ON import_control(tabla_destino);
CREATE INDEX idx_import_control_estado ON import_control(estado);

CREATE TRIGGER import_control_updated_at
    BEFORE UPDATE ON import_control
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DATOS DE PRUEBA (Solo para validación inicial)
-- =====================================================
INSERT INTO produccion (filial, fecha_produccion, turno, maquina, artigo, partida, metros_producidos, eficiencia)
VALUES 
    ('05', '2026-02-01', 'A', '501', 'ART001', 'PART001', 1000.50, 85.5),
    ('05', '2026-02-01', 'B', '501', 'ART001', 'PART001', 950.25, 82.3),
    ('05', '2026-02-02', 'A', '502', 'ART002', 'PART002', 1100.75, 88.9)
ON CONFLICT DO NOTHING;

INSERT INTO calidad (filial, fecha_produccion, partida, revisor, metros_revisados, porcentaje_calidad)
VALUES
    ('05', '2026-02-01', 'PART001', 'REVISOR_1', 500.00, 98.5),
    ('05', '2026-02-02', 'PART002', 'REVISOR_2', 550.50, 97.8)
ON CONFLICT DO NOTHING;

-- =====================================================
-- VISTA: resumen_produccion_diaria
-- =====================================================
CREATE OR REPLACE VIEW resumen_produccion_diaria AS
SELECT 
    fecha_produccion,
    filial,
    COUNT(DISTINCT maquina) as total_maquinas,
    SUM(metros_producidos) as metros_totales,
    AVG(eficiencia) as eficiencia_promedio,
    SUM(minutos_parada) as minutos_parada_total
FROM produccion
GROUP BY fecha_produccion, filial
ORDER BY fecha_produccion DESC;

-- =====================================================
-- FUNCIÓN: obtener_estadisticas_mes
-- =====================================================
CREATE OR REPLACE FUNCTION obtener_estadisticas_mes(
    p_anio INTEGER,
    p_mes INTEGER
)
RETURNS TABLE (
    fecha DATE,
    metros_producidos DECIMAL,
    eficiencia_promedio DECIMAL,
    total_maquinas BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.fecha_produccion,
        SUM(p.metros_producidos)::DECIMAL as metros,
        AVG(p.eficiencia)::DECIMAL as efic,
        COUNT(DISTINCT p.maquina) as maquinas
    FROM produccion p
    WHERE EXTRACT(YEAR FROM p.fecha_produccion) = p_anio
      AND EXTRACT(MONTH FROM p.fecha_produccion) = p_mes
    GROUP BY p.fecha_produccion
    ORDER BY p.fecha_produccion;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANTS (Seguridad)
-- =====================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stc_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stc_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO stc_user;
