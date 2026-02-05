-- ============================================================================
-- Tabla: tb_CALIDAD_FIBRA
-- Descripción: Calidad y movimiento de materia prima (fibra/algodón)
-- Fuente: rptMovimMP.csv (hoja rptMovimMP)
-- Estructura: 69 columnas, ~14,964 registros
-- Nota: 12 columnas requieren mapeo de nombres, FORNECEDOR aparece duplicado
-- ============================================================================

DROP TABLE IF EXISTS tb_CALIDAD_FIBRA CASCADE;

CREATE TABLE tb_CALIDAD_FIBRA (
    "ITEM" TEXT,
    "DESC_ITEM" TEXT,
    "ID" TEXT,
    "DATA_MOVIMENTO" TEXT,
    "TIPO_MOV" TEXT,
    "PRODUTOR" TEXT,
    "PROCED" TEXT,
    "LOTE" TEXT,
    "PILHA" TEXT,
    "DESTINO" TEXT,
    "COR" TEXT,
    "TP_MIC" TEXT,
    "TP" TEXT,
    "CLASSIFIC" TEXT,
    "LOTE_INTERNO" TEXT,
    "CORTEZA" TEXT,
    "QTDE" TEXT,
    "MISTURA" TEXT,
    "SEQ" TEXT,
    "TIPO_MP" TEXT,
    "FORNECEDOR" TEXT,
    "NMFORN" TEXT,
    "NF" TEXT,
    "LOTE_FIAC" TEXT,
    "TAM" TEXT,
    "SCI" TEXT,
    "MST" TEXT,
    "MIC" TEXT,
    "MAT" TEXT,
    "UHML" TEXT,
    "UI" TEXT,
    "SF" TEXT,
    "STR" TEXT,
    "ELG" TEXT,
    "RD" TEXT,
    "PLUS_B" TEXT,
    "TIPO" TEXT,
    "TrCNT" TEXT,
    "TrAR" TEXT,
    "TRID" TEXT,
    "SAC" TEXT,
    "PIM" TEXT,
    "SC" TEXT,
    "BENF" TEXT,
    "TP_SELO" TEXT,
    "NUM_SELO" TEXT,
    "PESO" TEXT,
    "PESO_MEDIO" TEXT,
    "ENT_SAI" TEXT,
    "UM" TEXT,
    "OBSERVACAO" TEXT,
    "IDFIL" TEXT,
    "DT_EMISSAO" TEXT,
    "DT_ENTRADA_PROD" TEXT,
    "HR_ENTRADA_PROD" TEXT,
    "TURNO_ENT_PROD" TEXT,
    "LADO" TEXT,
    "FARDOS_TESTADOS" TEXT,
    "FORNECEDOR_2" TEXT,
    "CONSIGNADO" TEXT,
    "LIBERADO" TEXT,
    "DATA_LIBERACAO" TEXT,
    "DOC_VENDA" TEXT,
    "DT_EMIS_DOC_VENDA" TEXT,
    "USU_LIBEROU" TEXT,
    "DT_INCLUSAO" TEXT,
    "USU_INCLUSAO" TEXT,
    "DT_ALTERACAO" TEXT,
    "USU_ALTERACAO" TEXT
);

-- Índices para optimizar consultas
CREATE INDEX idx_calidad_fibra_data ON tb_CALIDAD_FIBRA ("DATA_MOVIMENTO");
CREATE INDEX idx_calidad_fibra_lote ON tb_CALIDAD_FIBRA ("LOTE");
CREATE INDEX idx_calidad_fibra_fornecedor ON tb_CALIDAD_FIBRA ("FORNECEDOR");
CREATE INDEX idx_calidad_fibra_item ON tb_CALIDAD_FIBRA ("ITEM");
CREATE INDEX idx_calidad_fibra_tipo_mov ON tb_CALIDAD_FIBRA ("TIPO_MOV");
CREATE INDEX idx_calidad_fibra_produtor ON tb_CALIDAD_FIBRA ("PRODUTOR");

COMMENT ON TABLE tb_CALIDAD_FIBRA IS 'Calidad y movimientos de materia prima (fibra/algodón)';
