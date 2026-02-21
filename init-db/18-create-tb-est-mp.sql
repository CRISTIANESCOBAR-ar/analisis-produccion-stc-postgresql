-- Tabla base para el reporte de estado de materia prima
-- Fuente: rptEstMP.csv
CREATE TABLE IF NOT EXISTS tb_est_mp (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
-- Nota: Las columnas del CSV se agregarán automáticamente mediante la funcionalidad de "Sincronizar Columnas" o "Apply Import Strategy"
-- Si el CSV contiene columnas como 'codigo', 'descripcion', etc., se detectarán y se pedirá confirmación.
