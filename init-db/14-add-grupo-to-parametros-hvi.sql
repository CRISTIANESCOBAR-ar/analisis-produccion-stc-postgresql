-- =====================================================
-- Migración: Agregar columna "grupo" a tb_parametros_hvi
-- Descripción: Agrupa las variables HVI por categorías técnicas
--              para mejorar la organización visual en la UI
-- =====================================================

-- Agregar columna grupo
ALTER TABLE tb_parametros_hvi 
ADD COLUMN IF NOT EXISTS grupo VARCHAR(50);

-- Actualizar registros existentes con sus grupos
UPDATE tb_parametros_hvi SET grupo = 'Índices Generales' WHERE codigo IN ('SCI', 'MST');
UPDATE tb_parametros_hvi SET grupo = 'Finura y Madurez' WHERE codigo IN ('MIC', 'MAT');
UPDATE tb_parametros_hvi SET grupo = 'Longitud' WHERE codigo IN ('UHML', 'UI', 'SF');
UPDATE tb_parametros_hvi SET grupo = 'Resistencia' WHERE codigo IN ('STR', 'ELG');
UPDATE tb_parametros_hvi SET grupo = 'Color' WHERE codigo IN ('RD', 'PLUS_B', 'TIPO');
UPDATE tb_parametros_hvi SET grupo = 'Contaminación' WHERE codigo IN ('TRCNT', 'TRAR', 'TRID');

-- Comentario de la columna
COMMENT ON COLUMN tb_parametros_hvi.grupo IS 'Categoría técnica de agrupación de la variable HVI';
