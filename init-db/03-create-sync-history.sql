-- Tabla para historial de sincronizaciones y cambios de columnas
CREATE TABLE IF NOT EXISTS tb_sync_history (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  operation_type TEXT NOT NULL, -- 'COLUMN_SYNC', 'IMPORT', 'FORCE_IMPORT'
  table_name TEXT NOT NULL,
  description TEXT,
  columns_added TEXT[], -- Array de columnas agregadas
  columns_count INTEGER DEFAULT 0,
  rows_affected INTEGER DEFAULT 0,
  success BOOLEAN DEFAULT TRUE,
  error_message TEXT,
  execution_time_ms INTEGER,
  user_action TEXT -- 'AUTO', 'MANUAL'
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_sync_history_timestamp ON tb_sync_history(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_history_table ON tb_sync_history(table_name);
CREATE INDEX IF NOT EXISTS idx_sync_history_operation ON tb_sync_history(operation_type);

-- Vista para últimas sincronizaciones
CREATE OR REPLACE VIEW v_recent_syncs AS
SELECT 
  id,
  timestamp,
  operation_type,
  table_name,
  description,
  columns_count,
  rows_affected,
  success,
  execution_time_ms
FROM tb_sync_history
ORDER BY timestamp DESC
LIMIT 100;

COMMENT ON TABLE tb_sync_history IS 'Registro de sincronizaciones de esquema e importaciones de datos';
COMMENT ON COLUMN tb_sync_history.operation_type IS 'Tipo: COLUMN_SYNC (agregar columnas), IMPORT (importación), FORCE_IMPORT (reimportación forzada)';
COMMENT ON COLUMN tb_sync_history.columns_added IS 'Array de nombres de columnas que fueron agregadas en la sincronización';
