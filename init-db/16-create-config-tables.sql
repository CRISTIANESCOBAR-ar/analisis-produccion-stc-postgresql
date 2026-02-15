-- 1. Tabla de Tipos de Hilo y sus Estándares (Yarn Standards)
CREATE TABLE IF NOT EXISTS tb_config_hilos (
    id SERIAL PRIMARY KEY,
    version_nombre VARCHAR(50) NOT NULL DEFAULT 'v1', -- Ej: 'Verano 2026'
    activa BOOLEAN DEFAULT TRUE,
    titulo_ne VARCHAR(20) NOT NULL, -- Ej: '10/1 Flame'
    aplicacion VARCHAR(50), -- Ej: 'Urdimbre', 'Trama'
    sci_min INTEGER NOT NULL,
    str_min DECIMAL(4,1) NOT NULL,
    mic_min DECIMAL(3,2) NOT NULL,
    mic_max DECIMAL(3,2) NOT NULL,
    sf_max DECIMAL(4,1) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Tabla de Tolerancias de Mezcla de Fibra (Mixing Rules)
CREATE TABLE IF NOT EXISTS tb_config_tolerancias (
    id SERIAL PRIMARY KEY,
    version_nombre VARCHAR(50) NOT NULL, -- FK lógica con tb_config_hilos
    parametro VARCHAR(20) NOT NULL, -- 'MIC', 'STR', 'LEN', 'ELG'
    valor_ideal_min DECIMAL(5,2), -- Valor base del ideal (Ej: 4.3 para mic)
    rango_tol_min DECIMAL(5,2), -- Rango aceptable min (Ej: 3.0)
    rango_tol_max DECIMAL(5,2), -- Rango aceptable max (Ej: 3.5)
    porcentaje_min_ideal INTEGER NOT NULL DEFAULT 80, -- Ej: 80% o 90% (La regla 80/20)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Seed Data: Hilos (Títulos)
INSERT INTO tb_config_hilos (version_nombre, titulo_ne, aplicacion, sci_min, str_min, mic_min, mic_max, sf_max) VALUES
('Estándar 2026', '7/1', 'Trama Gruesa', 80, 23.0, 3.8, 4.5, 14.0),
('Estándar 2026', '9/1', 'Trama Media', 85, 24.0, 3.8, 4.4, 13.5),
('Estándar 2026', '9.5/1 Flame', 'Urdimbre', 90, 24.5, 3.8, 4.2, 13.0),
('Estándar 2026', '10/1', 'Urdimbre', 95, 25.0, 3.8, 4.2, 12.5),
('Estándar 2026', '10/1 Flame', 'Urdimbre', 100, 25.5, 3.9, 4.2, 12.0),
('Estándar 2026', '12.5/1', 'Urdimbre Base', 110, 27.0, 4.0, 4.4, 11.0),
('Estándar 2026', '14/1', 'Trama Fina', 115, 28.5, 4.0, 4.2, 9.5);

-- 4. Seed Data: Tolerancias de Mezcla
INSERT INTO tb_config_tolerancias (version_nombre, parametro, valor_ideal_min, rango_tol_min, rango_tol_max, porcentaje_min_ideal) VALUES
('Estándar 2026', 'MIC', 4.3, 3.0, 3.5, 90), -- 90% > 4.3
('Estándar 2026', 'LEN', 26.5, 25.0, 26.0, 80), -- 80% > 26.5mm
('Estándar 2026', 'STR', 26.5, 25.0, 26.0, 80), -- 80% > 26.5 g/tex
('Estándar 2026', 'ELG', 6.3, 5.0, 6.0, 80); -- Elongación
