-- =====================================================
-- Tabla: tb_parametros_hvi
-- Descripción: Almacena los parámetros de calidad (rangos) 
--              para cada variable HVI utilizada en el resaltado
--              de datos en la UI de Análisis de Calidad Fibra
-- =====================================================

CREATE TABLE IF NOT EXISTS tb_parametros_hvi (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(20) NOT NULL UNIQUE, -- Código de la variable (ej: MIC, STR, UHML)
  nombre VARCHAR(100) NOT NULL,        -- Nombre completo (ej: Micronaire)
  descripcion TEXT,                    -- Descripción detallada de la variable
  unidad VARCHAR(20),                  -- Unidad de medida (%, g/tex, mm, etc)
  tipo_dato VARCHAR(20) NOT NULL,      -- 'decimal' o 'entero'
  decimales INTEGER DEFAULT 2,         -- Cantidad de decimales para tipo decimal
  
  -- Rangos de calidad
  optimo_min DECIMAL(10,4),           -- Valor mínimo óptimo
  optimo_max DECIMAL(10,4),           -- Valor máximo óptimo
  aceptable_min DECIMAL(10,4),        -- Valor mínimo aceptable
  aceptable_max DECIMAL(10,4),        -- Valor máximo aceptable
  critico_min DECIMAL(10,4),          -- Valor mínimo crítico
  critico_max DECIMAL(10,4),          -- Valor máximo crítico
  
  -- Metadatos
  activo BOOLEAN DEFAULT TRUE,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para búsquedas por código
CREATE INDEX IF NOT EXISTS idx_parametros_hvi_codigo ON tb_parametros_hvi(codigo);

-- Trigger para actualizar timestamp
CREATE OR REPLACE FUNCTION update_parametros_hvi_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_parametros_hvi_timestamp
BEFORE UPDATE ON tb_parametros_hvi
FOR EACH ROW
EXECUTE FUNCTION update_parametros_hvi_timestamp();

-- =====================================================
-- Datos iniciales con información de tooltips
-- =====================================================

INSERT INTO tb_parametros_hvi (codigo, nombre, descripcion, unidad, tipo_dato, decimales, optimo_min, optimo_max, aceptable_min, aceptable_max, critico_min, critico_max) VALUES
  ('SCI', 'Spinning Consistency Index', 'Fórmula matemática ponderada que combina todas las variables HVI. La "nota final" del lote. Da más peso a STR (resistencia) y UHML (longitud).', '', 'entero', 0, 140, NULL, 100, 139, NULL, 99),
  
  ('MST', 'Moisture (Humedad)', 'El "termómetro de confianza" del análisis. El algodón es higroscópico: sus propiedades físicas cambian con el agua. MST fuera de rango invalida precisión del HVI. Por cada 1% de aumento en humedad, STR aumenta ~1 unidad.', '%', 'decimal', 2, 6.5, 8.0, 6.0, 8.5, NULL, 5.9),
  
  ('MIC', 'Micronaire', 'Medida de permeabilidad al aire que combina finura y madurez de la fibra. MIC bajo (<3.4) indica fibra inmadura que colapsa formando Neps (puntos blancos que no se tiñen con índigo). MIC alto (>4.9) indica fibras muy maduras pero gruesas.', '', 'decimal', 2, 3.7, 4.2, 3.5, 4.8, NULL, 3.4),
  
  ('MAT', 'Maturity Index', 'Proporción de celulosa en la fibra. Mide el desarrollo de la pared celular. MAT bajo genera hilo moteado después del teñido índigo porque las fibras inmaduras reflejan luz diferente.', '', 'decimal', 2, 0.85, NULL, 0.76, 0.84, NULL, 0.75),
  
  ('UHML', 'Upper Half Mean Length', 'Longitud promedio de la mitad más larga de las fibras. Dicta el ajuste de distancias entre rodillos en la continua de hilar. Un UHML alto permite hilos más finos y resistentes. Variación alta entre pacas genera irregularidad de masa.', 'mm', 'decimal', 2, 29.0, NULL, 26.5, 28.9, NULL, 26.0),
  
  ('UI', 'Uniformity Index', 'Mide qué tan cerca está la longitud media de las fibras más largas. Un UI bajo indica que el algodón fue maltratado en el desmote, rompiendo fibras. UI < 78% genera hilo "sucio" visualmente y roturas frecuentes en telar.', '%', 'decimal', 2, 83.0, NULL, 79.0, 82.9, NULL, 78.0),
  
  ('SF', 'Short Fiber Index', 'Porcentaje de fibras menores a 12.7 mm que no se enganchan bien en el hilo. Genera "fly" (pelusa volando) en la planta, reduce eficiencia y ensucia el ambiente. En hilos Flame, SF alto hace que el hilo se desintegre en los puntos de transición.', '%', 'decimal', 2, NULL, 6.0, 6.1, 11.9, 12.0, NULL),
  
  ('STR', 'Strength (Tenacidad)', 'Resistencia a la rotura medida rompiendo un mazo de fibras (bundle). La resistencia del hilo es aproximadamente el 50% de la resistencia de la fibra. El Denim se somete a lavados agresivos; STR < 25 puede causar roturas en costuras.', 'g/tex', 'decimal', 2, 30.0, NULL, 25.0, 29.9, NULL, 24.0),
  
  ('ELG', 'Elongation (Elasticidad)', 'Capacidad de "resorte" de la fibra. Estiramiento antes de rotura. Absorbe mejor los impactos mecánicos en el telar, reduciendo roturas. Entre dos algodones con mismo STR, el que tenga mayor ELG siempre trabajará mejor.', '%', 'decimal', 2, 7.0, NULL, 5.5, 6.9, NULL, 5.0),
  
  ('RD', 'Reflectance (Brillo)', 'Mide el brillo: blanco vs gris. Escala de Nickerson-Hunter. Rd y +b juntos definen el TIPO en carta Nickerson-Hunter. TIPO 41 = Estándar Denim.', '', 'decimal', 2, 75.0, 80.0, 70.0, 74.9, NULL, 69.0),
  
  ('PLUS_B', '+b - Yellowness', 'Mide degradación por amarillamiento. Indica envejecimiento. +b alto indica algodón expuesto a lluvia o calor excesivo en campo, debilitando paredes de fibra. Altera tono final del azul índigo en Denim.', '', 'decimal', 2, 7.0, 9.0, 9.1, 11.9, 12.0, NULL),
  
  ('TIPO', 'Cotton Grade', 'Clasificación comercial basada en color, basura y preparación. Combinación de Rd y +b.', '', 'entero', 0, 11, 21, 31, 41, 51, NULL),
  
  ('TRCNT', 'Trash Count', 'Número de partículas de basura detectadas. TrCNT alto + TrAR bajo = Basura muy fragmentada (pimienta), MUY difícil de limpiar en apertura.', 'partículas', 'entero', 0, NULL, 15, 16, 49, 50, NULL),
  
  ('TRAR', 'Trash Area', 'Área superficial cubierta por basura en la muestra. TrCNT bajo + TrAR alto = Pocas partículas pero grandes (hojas), más fácil de limpiar que pimienta.', '%', 'decimal', 2, NULL, 0.20, 0.21, 0.59, 0.60, NULL),
  
  ('TRID', 'Trash ID / Grade', 'Clasificación visual del 1 al 7 basada principalmente en TrAR. TRID 1-2 es ideal para hilos finos. TRID 4-5 es aceptable para Denim. TRID 6-7 muy sucio (evitar).', '', 'entero', 0, 1, 2, 3, 5, 6, NULL);

COMMENT ON TABLE tb_parametros_hvi IS 'Parámetros de calidad para variables HVI con rangos óptimos, aceptables y críticos';
COMMENT ON COLUMN tb_parametros_hvi.codigo IS 'Código único de la variable HVI';
COMMENT ON COLUMN tb_parametros_hvi.descripcion IS 'Descripción técnica detallada extraída de tooltips HVI';
COMMENT ON COLUMN tb_parametros_hvi.optimo_min IS 'Límite inferior del rango óptimo';
COMMENT ON COLUMN tb_parametros_hvi.optimo_max IS 'Límite superior del rango óptimo';
COMMENT ON COLUMN tb_parametros_hvi.aceptable_min IS 'Límite inferior del rango aceptable';
COMMENT ON COLUMN tb_parametros_hvi.aceptable_max IS 'Límite superior del rango aceptable';
COMMENT ON COLUMN tb_parametros_hvi.critico_min IS 'Límite inferior del rango crítico';
COMMENT ON COLUMN tb_parametros_hvi.critico_max IS 'Límite superior del rango crítico';
