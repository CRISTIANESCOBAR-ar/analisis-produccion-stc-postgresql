-- ============================================================================
-- Script: Recrear tb_PRODUCCION con estructura SQLite funcional
-- Fecha: 2026-02-05
-- Descripción: Elimina tabla PostgreSQL incompleta y recrea con 66 columnas
-- ============================================================================

-- Eliminar tabla existente
DROP TABLE IF EXISTS tb_PRODUCCION CASCADE;

-- Crear tabla con estructura SQLite (66 columnas)
CREATE TABLE tb_PRODUCCION (
  "FILIAL" TEXT,
  "DT_INICIO" TEXT,
  "HORA_INICIO" TEXT,
  "DT_FINAL" TEXT,
  "HORA_FINAL" TEXT,
  "DT_BASE_PRODUCAO" TEXT,
  "TURNO" TEXT,
  "PARTIDA" TEXT,
  "PARTIDA_DUPLA" TEXT,
  "R" TEXT,
  "ARTIGO" TEXT,
  "COR" TEXT,
  "METRAGEM" TEXT,
  "METRAGEM ENCOLH" TEXT,
  "TEMPO" TEXT,
  "VELOC CALC" TEXT,
  "VELOC" TEXT,
  "EFICIENCIA" TEXT,
  "NUM_FIOS" TEXT,
  "S" TEXT,
  "MAQUINA" TEXT,
  "RUPTURAS" TEXT,
  "CAVALOS" TEXT,
  "OPERADOR" TEXT,
  "NM OPERADOR" TEXT,
  "NM MERCADO" TEXT,
  "LARG PAD" TEXT,
  "LARG INI" TEXT,
  "LARG FIM" TEXT,
  "TRAMA REDUZIDA 1" TEXT,
  "TRAMA REDUZIDA 2" TEXT,
  "RUP FIACAO" TEXT,
  "RUP URD" TEXT,
  "RUP OPER" TEXT,
  "LOTE FIACAO" TEXT,
  "MAQ FIACAO" TEXT,
  "ROLADA" TEXT,
  "SELETOR" TEXT,
  "QTDE_RUPTURA" TEXT,
  "COD_RUP" TEXT,
  "MOTIVO_RUP" TEXT,
  "TIPO_RUP" TEXT,
  "DESC_TP_RUPTURA" TEXT,
  "COD_CAVALO" TEXT,
  "DESC_CAVALO" TEXT,
  "QTDE_CAVALO" TEXT,
  "PONTOS_LIDOS" TEXT,
  "PONTOS_100%" TEXT,
  "BATIDAS" TEXT,
  "ENCOLH ACAB" TEXT,
  "ESTIRAGEM REVISAO" TEXT,
  "TEMPO LEIT MIN" TEXT,
  "TOTAL MINUTOS TUR" TEXT,
  "TOTAL MINUTOS TUR 1" TEXT,
  "TOTAL MINUTOS TUR 2" TEXT,
  "PARADA TEC TRAMA" TEXT,
  "PARADA TEC URDUME" TEXT,
  "PARADA TEC OUTROS" TEXT,
  "PARADA TEC STOP" TEXT,
  "BASE URDUME" TEXT,
  "RPM LEITURA" TEXT,
  "RPM NOMINALTEAR" TEXT,
  "GRUPO TEAR" TEXT,
  "DESC TEAR" TEXT,
  "MODELO TEAR" TEXT,
  "MAQ INDIGO" TEXT
);

-- Crear índices para optimizar consultas
CREATE INDEX idx_produccion_artigo ON tb_PRODUCCION("ARTIGO");
CREATE INDEX idx_produccion_partida ON tb_PRODUCCION("PARTIDA");
CREATE INDEX idx_produccion_dt_inicio ON tb_PRODUCCION("DT_INICIO");
CREATE INDEX idx_produccion_dt_base ON tb_PRODUCCION("DT_BASE_PRODUCAO");
CREATE INDEX idx_produccion_maquina ON tb_PRODUCCION("MAQUINA");

-- Mensaje de confirmación
SELECT 'tb_PRODUCCION recreada con 66 columnas (estructura SQLite)' as status;
