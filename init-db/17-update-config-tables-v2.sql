-- Actualización para soportar estandares de Calidad y Mezcla V2

-- 1. Ampliar tabla de tolerancias para soportar Hard Caps y lógica de objetivos más flexible
ALTER TABLE tb_config_tolerancias 
ADD COLUMN IF NOT EXISTS limite_max_absoluto DECIMAL(5,2), -- Hard Cap Superior (Ej: <= 5.0)
ADD COLUMN IF NOT EXISTS limite_min_absoluto DECIMAL(5,2), -- Hard Cap Inferior (Si fuera necesario)
ADD COLUMN IF NOT EXISTS promedio_objetivo_max DECIMAL(5,2); -- Para casos como +b donde queremos < X

-- 2. Tabla de Histórico de Auditoría (Snapshots)
CREATE TABLE IF NOT EXISTS tb_historico_configuraciones (
    id SERIAL PRIMARY KEY,
    version_nombre VARCHAR(50) NOT NULL,
    fecha_guardado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    snapshot_json JSONB NOT NULL, -- Guarda { hilos: [], tolerancias: [] } completo
    usuario_responsable VARCHAR(100) -- Opcional, si hay auth
);

-- 3. Actualizar datos existentes (Migración simple)
-- MIC (4.3 min ideal, nuevo hard cap 5.0)
UPDATE tb_config_tolerancias 
SET limite_max_absoluto = 5.0 
WHERE parametro = 'MIC' AND version_nombre = 'Estándar 2026';

-- Seed data para nuevos parámetros si no existen
INSERT INTO tb_config_tolerancias (version_nombre, parametro, valor_ideal_min, rango_tol_min, rango_tol_max, porcentaje_min_ideal, limite_max_absoluto, promedio_objetivo_max)
SELECT 'Estándar 2026', 'RD', 72.0, 68.0, 70.0, 80, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM tb_config_tolerancias WHERE parametro = 'RD' AND version_nombre = 'Estándar 2026');

INSERT INTO tb_config_tolerancias (version_nombre, parametro, valor_ideal_min, rango_tol_min, rango_tol_max, porcentaje_min_ideal, limite_max_absoluto, promedio_objetivo_max)
SELECT 'Estándar 2026', '+b', NULL, NULL, NULL, 80, 12.0, 10.5
WHERE NOT EXISTS (SELECT 1 FROM tb_config_tolerancias WHERE parametro = '+b' AND version_nombre = 'Estándar 2026');
