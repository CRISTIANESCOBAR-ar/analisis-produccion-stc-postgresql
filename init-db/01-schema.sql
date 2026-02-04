-- =====================================================
-- SCHEMA COMPLETO INTEGRADO - STC PRODUCCIÓN V2
-- PostgreSQL 16
-- 22 tablas: 11 producción + 4 ensayos + 7 config/sistema
-- =====================================================

-- =====================================================
-- SECCIÓN 1: TABLAS DE PRODUCCIÓN (11 tablas)
-- =====================================================

-- ========== tb_PRODUCCION ==========
CREATE TABLE IF NOT EXISTS tb_PRODUCCION (
    id SERIAL PRIMARY KEY,
    FILIAL VARCHAR(2),
    DT_INICIO VARCHAR(10),
    HORA_INICIO VARCHAR(8),
    DT_FINAL VARCHAR(10),
    HORA_FINAL VARCHAR(8),
    DT_BASE_PRODUCAO VARCHAR(10) NOT NULL,
    TURNO VARCHAR(1),
    PARTIDA VARCHAR(20),
    PARTIDA_DUPLA VARCHAR(20),
    R VARCHAR(10),
    ARTIGO VARCHAR(20),
    COR VARCHAR(20),
    METRAGEM VARCHAR(20),
    "METRAGEM ENCOLH" VARCHAR(20),
    TEMPO VARCHAR(20),
    "VELOC CALC" VARCHAR(20),
    VELOC VARCHAR(20),
    EFICIENCIA VARCHAR(10),
    NUM_FIOS VARCHAR(10),
    S VARCHAR(5),
    MAQUINA VARCHAR(10) NOT NULL,
    RUPTURAS VARCHAR(20),
    CAVALOS VARCHAR(20),
    OPERADOR VARCHAR(100),
    "NM OPERADOR" VARCHAR(100),
    "NM MERCADO" VARCHAR(100),
    "LARG PAD" VARCHAR(20),
    "LARG INI" VARCHAR(20),
    "LARG FIM" VARCHAR(20),
    "TRAMA REDUZIDA 1" VARCHAR(50),
    "TRAMA REDUZIDA 2" VARCHAR(50),
    "RUP FIACAO" VARCHAR(20),
    "RUP URD" VARCHAR(20),
    "RUP OPER" VARCHAR(20),
    "LOTE FIACAO" VARCHAR(20),
    "MAQ  FIACAO" VARCHAR(20),
    ROLADA VARCHAR(20),
    SELETOR VARCHAR(20),
    QTDE_RUPTURA VARCHAR(20),
    COD_RUP VARCHAR(20),
    MOTIVO_RUP VARCHAR(200),
    TIPO_RUP VARCHAR(50),
    DESC_TP_RUPTURA VARCHAR(200),
    COD_CAVALO VARCHAR(20),
    DESC_CAVALO VARCHAR(200),
    QTDE_CAVALO VARCHAR(20),
    PONTOS_LIDOS VARCHAR(20),
    "PONTOS_100%" VARCHAR(20),
    BATIDAS VARCHAR(20),
    "ENCOLH ACAB" VARCHAR(20),
    "ESTIRAGEM REVISAO" VARCHAR(20),
    "TEMPO LEIT MIN" VARCHAR(20),
    "TOTAL MINUTOS TUR " VARCHAR(20),
    "TOTAL MINUTOS TUR 1" VARCHAR(20),
    "TOTAL MINUTOS TUR 2" VARCHAR(20),
    "PARADA TEC TRAMA" VARCHAR(20),
    "PARADA TEC URDUME" VARCHAR(20),
    "PARADA TEC OUTROS" VARCHAR(20),
    "PARADA TEC STOP" VARCHAR(20),
    "BASE URDUME" VARCHAR(20),
    "RPM LEITURA" VARCHAR(20),
    "RPM NOMINALTEAR" VARCHAR(20),
    "GRUPO TEAR" VARCHAR(50),
    "DESC TEAR" VARCHAR(100),
    "MODELO TEAR" VARCHAR(50),
    "MAQ INDIGO" VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produccion_dt_base ON tb_PRODUCCION(DT_BASE_PRODUCAO);
CREATE INDEX IF NOT EXISTS idx_produccion_artigo ON tb_PRODUCCION(ARTIGO);
CREATE INDEX IF NOT EXISTS idx_produccion_partida ON tb_PRODUCCION(PARTIDA);
CREATE INDEX IF NOT EXISTS idx_produccion_seletor ON tb_PRODUCCION(SELETOR);
CREATE INDEX IF NOT EXISTS idx_produccion_seletor_filial ON tb_PRODUCCION(SELETOR, FILIAL);
CREATE INDEX IF NOT EXISTS idx_produccion_partida_dt ON tb_PRODUCCION(PARTIDA, DT_BASE_PRODUCAO);
CREATE INDEX IF NOT EXISTS idx_produccion_composite ON tb_PRODUCCION(FILIAL, SELETOR, DT_BASE_PRODUCAO, PARTIDA) 
    WHERE PARTIDA IS NOT NULL AND PARTIDA != '';
CREATE INDEX IF NOT EXISTS idx_produccion_base_urdume ON tb_PRODUCCION("BASE URDUME");
CREATE INDEX IF NOT EXISTS idx_produccion_seletor_rolada ON tb_PRODUCCION(SELETOR, ROLADA) 
    WHERE ROLADA IS NOT NULL AND ROLADA != '';
CREATE INDEX IF NOT EXISTS idx_produccion_urdideira_partida ON tb_PRODUCCION(ROLADA, PARTIDA) 
    WHERE SELETOR='URDIDEIRA' AND PARTIDA IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_produccion_indigo_dtinicio ON tb_PRODUCCION(DT_INICIO) WHERE SELETOR='INDIGO';
CREATE INDEX IF NOT EXISTS idx_produccion_tecelagem_rolada ON tb_PRODUCCION(SELETOR, ROLADA) 
    WHERE SELETOR='TECELAGEM' AND ROLADA IS NOT NULL;

CREATE TRIGGER tb_produccion_updated_at BEFORE UPDATE ON tb_PRODUCCION
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_CALIDAD ==========
CREATE TABLE IF NOT EXISTS tb_CALIDAD (
    id SERIAL PRIMARY KEY,
    EMP VARCHAR(2),
    DAT_PROD VARCHAR(10),
    GRP_DEF VARCHAR(50),
    COD_DE VARCHAR(20),
    DEFEITO VARCHAR(200),
    INDIGO VARCHAR(20),
    CC VARCHAR(20),
    GRP_TEAR VARCHAR(50),
    TEAR VARCHAR(10),
    ARTIGO VARCHAR(20),
    COR VARCHAR(20),
    PARTIDA VARCHAR(20),
    G_CMEST VARCHAR(50),
    ACONDIC VARCHAR(50),
    GRP_TEC VARCHAR(50),
    TRAMA VARCHAR(50),
    ROLADA VARCHAR(20),
    METRAGEM VARCHAR(20),
    QUALIDADE VARCHAR(20),
    "PESO BRUTO" VARCHAR(20),
    "REVISOR FINAL" VARCHAR(100),
    HORA VARCHAR(8),
    "NM MERC" VARCHAR(100),
    "TUR TEC" VARCHAR(1),
    "T TEC1" VARCHAR(20),
    "T TEC2" VARCHAR(20),
    EMENDAS VARCHAR(20),
    PEÇA VARCHAR(20),
    ETIQUETA VARCHAR(50),
    "PESO LIQUIDO" VARCHAR(20),
    LARGURA VARCHAR(20),
    "GR/M2" VARCHAR(20),
    "T INDIGO" VARCHAR(20),
    PONTUACAO VARCHAR(20),
    REPROCESSO VARCHAR(50),
    "COD DIREC" VARCHAR(20),
    "DESC DIREC" VARCHAR(200),
    "DT INI TEC" VARCHAR(10),
    "HR INI TEC" VARCHAR(8),
    "DT FIM TEC" VARCHAR(10),
    "HR FIM TEC" VARCHAR(8),
    "RPM TECEL" VARCHAR(20),
    "GRUPO CMESTR" VARCHAR(50),
    URDUME VARCHAR(50),
    "MODELO TEAR" VARCHAR(50),
    "ST IND" VARCHAR(20),
    "G#PR" VARCHAR(50),
    "DT  TINGIMENTO" VARCHAR(10),
    "TURNO INDIGO" VARCHAR(1),
    "OPER INDIGO" VARCHAR(100),
    "LAVADEIRA 01" VARCHAR(50),
    "TURNO LAVAD " VARCHAR(1),
    "LAVADEIRA 02" VARCHAR(50),
    "TURNO LAVAD 1" VARCHAR(1),
    "LAVADEIRA 03" VARCHAR(50),
    "TURNO LAVAD 03" VARCHAR(1),
    INTEGRADA VARCHAR(50),
    "TURNO INTEGR" VARCHAR(1),
    "SANFOR 01" VARCHAR(50),
    "TURNO SANF 01" VARCHAR(1),
    "SANFOR 02" VARCHAR(50),
    "TURNO SANF 02" VARCHAR(1),
    CALANDRA VARCHAR(50),
    "TURNO CALAND" VARCHAR(1),
    ESTAMAPRIA VARCHAR(50),
    "TURNO ESTAMP" VARCHAR(1),
    "MERCERZ 01" VARCHAR(50),
    "TURNO MERC 01" VARCHAR(1),
    "MERCERZ 02" VARCHAR(50),
    "TURNO MERC 02" VARCHAR(1),
    "DATA PESAGEM" VARCHAR(10),
    "HORA PESAGEM" VARCHAR(8),
    "TURNO PESAGEM " VARCHAR(1),
    "LOCAL TECEL" VARCHAR(50),
    "DEF EMENDA" VARCHAR(20),
    "DESC DEF EMENDA" VARCHAR(200),
    HORARIO_REVISAO VARCHAR(8),
    TURNO_HORARIO_REVISAO VARCHAR(1),
    TURNO_REVISAO VARCHAR(1),
    DATA_REVISAO VARCHAR(10),
    "REVISOR EMENDA" VARCHAR(100),
    "HORA PECA FINAL" VARCHAR(8),
    "TURNO PECA FINAL" VARCHAR(1),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calidad_dat_prod ON tb_CALIDAD(DAT_PROD);
CREATE INDEX IF NOT EXISTS idx_calidad_rolada ON tb_CALIDAD(ROLADA);
CREATE INDEX IF NOT EXISTS idx_calidad_tear ON tb_CALIDAD(TEAR);
CREATE INDEX IF NOT EXISTS idx_calidad_qualidade ON tb_CALIDAD(QUALIDADE);
CREATE INDEX IF NOT EXISTS idx_calidad_artigo ON tb_CALIDAD(ARTIGO);
CREATE INDEX IF NOT EXISTS idx_calidad_revisor_fecha ON tb_CALIDAD("REVISOR FINAL", DAT_PROD);
CREATE INDEX IF NOT EXISTS idx_calidad_partida ON tb_CALIDAD(PARTIDA);
CREATE INDEX IF NOT EXISTS idx_calidad_revisor ON tb_CALIDAD("REVISOR FINAL");
CREATE INDEX IF NOT EXISTS idx_calidad_partida_dat_revisor ON tb_CALIDAD(PARTIDA, DAT_PROD, "REVISOR FINAL");
CREATE INDEX IF NOT EXISTS idx_calidad_rolada_emp ON tb_CALIDAD(ROLADA, EMP) 
    WHERE ROLADA IS NOT NULL AND ROLADA != '';
CREATE INDEX IF NOT EXISTS idx_calidad_rolada_qualidade ON tb_CALIDAD(ROLADA, QUALIDADE, EMP) 
    WHERE ROLADA IS NOT NULL;

CREATE TRIGGER tb_calidad_updated_at BEFORE UPDATE ON tb_CALIDAD
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_PARADAS ==========
CREATE TABLE IF NOT EXISTS tb_PARADAS (
    id SERIAL PRIMARY KEY,
    FILIAL VARCHAR(2),
    DT_BASE VARCHAR(10),
    TURNO VARCHAR(1),
    SETOR VARCHAR(50),
    MAQUINA VARCHAR(10),
    DT_INICIO VARCHAR(10),
    HR_INICIO VARCHAR(8),
    DT_FIM VARCHAR(10),
    HR_FIM VARCHAR(8),
    TEMPO_PARADA VARCHAR(20),
    MOTIVO VARCHAR(200),
    OBSERVACAO TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_paradas_dt_base ON tb_PARADAS(DT_BASE);
CREATE INDEX IF NOT EXISTS idx_paradas_maquina ON tb_PARADAS(MAQUINA);
CREATE INDEX IF NOT EXISTS idx_paradas_setor ON tb_PARADAS(SETOR);

CREATE TRIGGER tb_paradas_updated_at BEFORE UPDATE ON tb_PARADAS
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_PRODUCCION_OE ==========
CREATE TABLE IF NOT EXISTS tb_PRODUCCION_OE (
    id SERIAL PRIMARY KEY,
    FILIAL VARCHAR(2),
    "TIPO DE PRODU\u00c3\u0087AO" VARCHAR(50),
    MAQUINA VARCHAR(10),
    TURNO VARCHAR(1),
    "DATA BASE PRODU\u00c3\u0087AO" VARCHAR(10),
    "LOTE PRODUC" VARCHAR(20),
    "DATA/HORA INICIO" VARCHAR(20),
    "DATA/HORA FIM" VARCHAR(20),
    "TEMPO EM PRODU\u00c3\u0087AO" VARCHAR(20),
    "DESC ITEM" VARCHAR(200),
    "COR ITEM" VARCHAR(50),
    "TEMPO PARADAS" VARCHAR(20),
    "TIPO PARADA" VARCHAR(50),
    "TEMPO PRODUC EFETIVO" VARCHAR(20),
    "QTDE PROD BRUTA" VARCHAR(20),
    "QTDE PROD LIQUIDA" VARCHAR(20),
    "QTDE EMBALADA" VARCHAR(20),
    "QTDE A REMETER" VARCHAR(20),
    "TEMPO TOTAL TUR DISP" VARCHAR(20),
    "TEMPO PARADAS TUR" VARCHAR(20),
    EFICIENCIA VARCHAR(10),
    LADO VARCHAR(1),
    OPERADOR VARCHAR(100),
    "NM OPERADOR" VARCHAR(100),
    HORIMETRO VARCHAR(20),
    "VELOC MEDIA" VARCHAR(20),
    "VELOC NOMINAL" VARCHAR(20),
    "PRODU\u00c3\u0087AO/HORA" VARCHAR(20),
    "QUALIDADE FIBRA" VARCHAR(50),
    ESTIRAGEM VARCHAR(20),
    "QTDE FD G10" VARCHAR(20),
    "QTDE FD G25" VARCHAR(20),
    "QTDE FD G40" VARCHAR(20),
    "QTDE FD G60" VARCHAR(20),
    "PASAD OE" VARCHAR(50),
    "PESO EMBAL KG" VARCHAR(20),
    "NUM LOTES MISTURA" VARCHAR(10),
    "PESO REAL MISTURA" VARCHAR(20),
    "ENC.URD.M" VARCHAR(20),
    "TREFILA TORCAO FIACAO" VARCHAR(50),
    "NUMERO FIACAO" VARCHAR(20),
    "TORCAO FIACAO" VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_produccion_oe_dt_base ON tb_PRODUCCION_OE("DATA BASE PRODU\u00c3\u0087AO");
CREATE INDEX IF NOT EXISTS idx_produccion_oe_maquina ON tb_PRODUCCION_OE(MAQUINA);
CREATE INDEX IF NOT EXISTS idx_produccion_oe_lote ON tb_PRODUCCION_OE("LOTE PRODUC");

CREATE TRIGGER tb_produccion_oe_updated_at BEFORE UPDATE ON tb_PRODUCCION_OE
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_FICHAS ==========
CREATE TABLE IF NOT EXISTS tb_FICHAS (
    id SERIAL PRIMARY KEY,
    ARTIGO VARCHAR(20) UNIQUE NOT NULL,
    DESCRICAO VARCHAR(200),
    COMPOSICAO VARCHAR(200),
    LARGURA_CM VARCHAR(10),
    GRAMATURA VARCHAR(10),
    TRAMA VARCHAR(50),
    URDUME VARCHAR(50),
    RENDIMENTO VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fichas_artigo ON tb_FICHAS(ARTIGO);

CREATE TRIGGER tb_fichas_updated_at BEFORE UPDATE ON tb_FICHAS
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_METAS ==========
CREATE TABLE IF NOT EXISTS tb_METAS (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL UNIQUE,
    fiacao_meta DECIMAL(12,2),
    fiacao_enc_urd DECIMAL(5,2),
    indigo_meta DECIMAL(12,2),
    indigo_enc_urd DECIMAL(5,2),
    tecelagem_meta DECIMAL(12,2),
    tecelagem_enc_urd DECIMAL(5,2),
    acabamento_meta DECIMAL(12,2),
    acabamento_enc_urd DECIMAL(5,2),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_metas_fecha ON tb_METAS(fecha DESC);

CREATE TRIGGER tb_metas_updated_at BEFORE UPDATE ON tb_METAS
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_TESTES ==========
CREATE TABLE IF NOT EXISTS tb_TESTES (
    id SERIAL PRIMARY KEY,
    FILIAL VARCHAR(2),
    TURNO VARCHAR(1),
    MAQUINA VARCHAR(10),
    APROV VARCHAR(1),
    "DATA/HORA INICIO" VARCHAR(20),
    "DATA/HORA FIM" VARCHAR(20),
    "TEMPO EM PRODU\u00c3\u0087AO" VARCHAR(20),
    "DESC ITEM" VARCHAR(200),
    "LOTE PRODUC" VARCHAR(20),
    "QUALIDADE FIBRA" VARCHAR(50),
    ESTIRAGEM VARCHAR(20),
    "PASAD OE" VARCHAR(50),
    "TREFILA TORCAO FIACAO" VARCHAR(50),
    "NUMERO FIACAO" VARCHAR(20),
    "TORCAO FIACAO" VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_testes_maquina ON tb_TESTES(MAQUINA);
CREATE INDEX IF NOT EXISTS idx_testes_aprov ON tb_TESTES(APROV);
CREATE INDEX IF NOT EXISTS idx_testes_lote ON tb_TESTES("LOTE PRODUC");

CREATE TRIGGER tb_testes_updated_at BEFORE UPDATE ON tb_TESTES
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_DEFECTOS ==========
CREATE TABLE IF NOT EXISTS tb_DEFECTOS (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descripcion VARCHAR(200),
    grupo VARCHAR(50),
    gravedad VARCHAR(20),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_defectos_codigo ON tb_DEFECTOS(codigo);
CREATE INDEX IF NOT EXISTS idx_defectos_grupo ON tb_DEFECTOS(grupo);

CREATE TRIGGER tb_defectos_updated_at BEFORE UPDATE ON tb_DEFECTOS
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_RESIDUOS_INDIGO ==========
CREATE TABLE IF NOT EXISTS tb_RESIDUOS_INDIGO (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    metros_producidos DECIMAL(12,2),
    estopa_azul_kg DECIMAL(10,2),
    porcentaje_estopa DECIMAL(5,2),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_residuos_indigo_fecha ON tb_RESIDUOS_INDIGO(fecha DESC);

CREATE TRIGGER tb_residuos_indigo_updated_at BEFORE UPDATE ON tb_RESIDUOS_INDIGO
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_RESIDUOS_POR_SECTOR ==========
CREATE TABLE IF NOT EXISTS tb_RESIDUOS_POR_SECTOR (
    id SERIAL PRIMARY KEY,
    fecha DATE NOT NULL,
    sector VARCHAR(50) NOT NULL,
    tipo_residuo VARCHAR(100),
    cantidad_kg DECIMAL(10,2),
    metros_producidos DECIMAL(12,2),
    porcentaje DECIMAL(5,2),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(fecha, sector, tipo_residuo)
);

CREATE INDEX IF NOT EXISTS idx_residuos_sector_fecha ON tb_RESIDUOS_POR_SECTOR(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_residuos_sector_sector ON tb_RESIDUOS_POR_SECTOR(sector);

CREATE TRIGGER tb_residuos_sector_updated_at BEFORE UPDATE ON tb_RESIDUOS_POR_SECTOR
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_CALIDAD_FIBRA ==========
CREATE TABLE IF NOT EXISTS tb_CALIDAD_FIBRA (
    id SERIAL PRIMARY KEY,
    TIPO_MOV VARCHAR(20),
    MISTURA VARCHAR(20),
    FECHA VARCHAR(10),
    LOTE VARCHAR(20),
    FARDO VARCHAR(20),
    MIC VARCHAR(20),
    MAT VARCHAR(20),
    STR VARCHAR(20),
    UHM VARCHAR(20),
    UI VARCHAR(20),
    SFI VARCHAR(20),
    ELG VARCHAR(20),
    RD VARCHAR(20),
    PLUS_B VARCHAR(20),
    TrCNT VARCHAR(20),
    TrAR VARCHAR(20),
    TRID VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_calidad_fibra_tipo_mov ON tb_CALIDAD_FIBRA(TIPO_MOV);
CREATE INDEX IF NOT EXISTS idx_calidad_fibra_mistura ON tb_CALIDAD_FIBRA(MISTURA);
CREATE INDEX IF NOT EXISTS idx_calidad_fibra_fecha ON tb_CALIDAD_FIBRA(FECHA);

CREATE TRIGGER tb_calidad_fibra_updated_at BEFORE UPDATE ON tb_CALIDAD_FIBRA
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECCIÓN 2: TABLAS DE ENSAYOS (4 tablas)
-- Migradas desde carga-datos-docker (Oracle)
-- =====================================================

-- ========== TB_USTER_PAR ==========
CREATE TABLE IF NOT EXISTS tb_uster_par (
    testnr VARCHAR(20) PRIMARY KEY,
    nomcount NUMERIC(10,2),
    maschnr VARCHAR(50),
    lote VARCHAR(50),
    laborant VARCHAR(100),
    time_stamp VARCHAR(50),
    matclass VARCHAR(50),
    estiraje NUMERIC(10,2),
    pasador VARCHAR(50),
    obs TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uster_par_lote ON tb_uster_par(lote);
CREATE INDEX IF NOT EXISTS idx_uster_par_timestamp ON tb_uster_par(time_stamp);

CREATE TRIGGER uster_par_updated_at BEFORE UPDATE ON tb_uster_par
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== TB_USTER_TBL ==========
CREATE TABLE IF NOT EXISTS tb_uster_tbl (
    id SERIAL PRIMARY KEY,
    testnr VARCHAR(20) REFERENCES tb_uster_par(testnr) ON DELETE CASCADE,
    seqno INTEGER,
    no_ INTEGER,
    u_percent NUMERIC(10,4),
    cvm_percent NUMERIC(10,4),
    indice_percent NUMERIC(10,4),
    cvm_1m_percent NUMERIC(10,4),
    cvm_3m_percent NUMERIC(10,4),
    cvm_10m_percent NUMERIC(10,4),
    titulo NUMERIC(10,4),
    titulo_rel_perc NUMERIC(10,4),
    h NUMERIC(10,4),
    sh NUMERIC(10,4),
    sh_1m NUMERIC(10,4),
    sh_3m NUMERIC(10,4),
    sh_10m NUMERIC(10,4),
    delg_minus30_km NUMERIC(10,4),
    delg_minus40_km NUMERIC(10,4),
    delg_minus50_km NUMERIC(10,4),
    delg_minus60_km NUMERIC(10,4),
    grue_35_km NUMERIC(10,4),
    grue_50_km NUMERIC(10,4),
    grue_70_km NUMERIC(10,4),
    grue_100_km NUMERIC(10,4),
    neps_140_km NUMERIC(10,4),
    neps_200_km NUMERIC(10,4),
    neps_280_km NUMERIC(10,4),
    neps_400_km NUMERIC(10,4),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uster_tbl_testnr ON tb_uster_tbl(testnr);
CREATE INDEX IF NOT EXISTS idx_uster_tbl_seqno ON tb_uster_tbl(testnr, seqno);

CREATE TRIGGER uster_tbl_updated_at BEFORE UPDATE ON tb_uster_tbl
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== TB_TENSORAPID_PAR ==========
CREATE TABLE IF NOT EXISTS tb_tensorapid_par (
    testnr VARCHAR(20) PRIMARY KEY,
    ne_titulo VARCHAR(50),
    titulo NUMERIC(10,4),
    comment_text TEXT,
    long_prueba NUMERIC(10,2),
    time_stamp VARCHAR(50),
    lote VARCHAR(50),
    ne_titulo_type VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tensorapid_par_lote ON tb_tensorapid_par(lote);
CREATE INDEX IF NOT EXISTS idx_tensorapid_par_timestamp ON tb_tensorapid_par(time_stamp);

CREATE TRIGGER tensorapid_par_updated_at BEFORE UPDATE ON tb_tensorapid_par
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== TB_TENSORAPID_TBL ==========
CREATE TABLE IF NOT EXISTS tb_tensorapid_tbl (
    id SERIAL PRIMARY KEY,
    testnr VARCHAR(20) REFERENCES tb_tensorapid_par(testnr) ON DELETE CASCADE,
    huso_number INTEGER,
    tiempo_rotura NUMERIC(10,4),
    fuerza_b NUMERIC(10,4),
    elongacion NUMERIC(10,4),
    tenacidad NUMERIC(10,4),
    trabajo NUMERIC(10,4),
    huso_ensayos INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tensorapid_tbl_testnr ON tb_tensorapid_tbl(testnr);
CREATE INDEX IF NOT EXISTS idx_tensorapid_tbl_huso ON tb_tensorapid_tbl(testnr, huso_number);

CREATE TRIGGER tensorapid_tbl_updated_at BEFORE UPDATE ON tb_tensorapid_tbl
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECCIÓN 3: TABLAS DE CONFIGURACIÓN Y SISTEMA (7 tablas)
-- =====================================================

-- ========== import_control ==========
CREATE TABLE IF NOT EXISTS import_control (
    id SERIAL PRIMARY KEY,
    tabla_destino VARCHAR(100) NOT NULL UNIQUE,
    archivo_origen VARCHAR(500) NOT NULL,
    ultima_importacion TIMESTAMP,
    fecha_modificacion_archivo TIMESTAMP,
    registros_importados INTEGER DEFAULT 0,
    hash_archivo VARCHAR(64),
    estado VARCHAR(20) DEFAULT 'pending',
    mensaje_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_control_tabla ON import_control(tabla_destino);
CREATE INDEX IF NOT EXISTS idx_import_control_estado ON import_control(estado);

CREATE TRIGGER import_control_updated_at BEFORE UPDATE ON import_control
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== import_column_warnings ==========
CREATE TABLE IF NOT EXISTS import_column_warnings (
    id SERIAL PRIMARY KEY,
    tabla_destino VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    csv_path VARCHAR(500),
    extra_columns TEXT,
    missing_columns TEXT,
    total_csv_columns INTEGER,
    total_table_columns INTEGER
);

CREATE INDEX IF NOT EXISTS idx_warnings_tabla ON import_column_warnings(tabla_destino);
CREATE INDEX IF NOT EXISTS idx_warnings_timestamp ON import_column_warnings(timestamp DESC);

-- ========== schema_changes_log ==========
CREATE TABLE IF NOT EXISTS schema_changes_log (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(100) NOT NULL,
    cambio VARCHAR(20) NOT NULL,
    columna VARCHAR(200),
    tipo_dato VARCHAR(50),
    descripcion TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_schema_log_tabla ON schema_changes_log(tabla);
CREATE INDEX IF NOT EXISTS idx_schema_log_timestamp ON schema_changes_log(timestamp DESC);

-- ========== tb_COSTO_ITEMS ==========
CREATE TABLE IF NOT EXISTS tb_COSTO_ITEMS (
    id SERIAL PRIMARY KEY,
    item_name VARCHAR(200) NOT NULL UNIQUE,
    categoria VARCHAR(100),
    unidad VARCHAR(20),
    costo_unitario DECIMAL(12,4),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_costo_items_categoria ON tb_COSTO_ITEMS(categoria);

CREATE TRIGGER tb_costo_items_updated_at BEFORE UPDATE ON tb_COSTO_ITEMS
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_COSTO_ITEM_ALIAS ==========
CREATE TABLE IF NOT EXISTS tb_COSTO_ITEM_ALIAS (
    id SERIAL PRIMARY KEY,
    alias VARCHAR(200) NOT NULL UNIQUE,
    item_name VARCHAR(200) NOT NULL REFERENCES tb_COSTO_ITEMS(item_name) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_costo_alias_item ON tb_COSTO_ITEM_ALIAS(item_name);

-- ========== tb_COSTO_MENSUAL ==========
CREATE TABLE IF NOT EXISTS tb_COSTO_MENSUAL (
    id SERIAL PRIMARY KEY,
    periodo VARCHAR(7) NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    cantidad DECIMAL(12,2),
    costo_total DECIMAL(12,2),
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(periodo, item_name)
);

CREATE INDEX IF NOT EXISTS idx_costo_mensual_periodo ON tb_COSTO_MENSUAL(periodo DESC);
CREATE INDEX IF NOT EXISTS idx_costo_mensual_item ON tb_COSTO_MENSUAL(item_name);

CREATE TRIGGER tb_costo_mensual_updated_at BEFORE UPDATE ON tb_COSTO_MENSUAL
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== tb_PROCESO ==========
CREATE TABLE IF NOT EXISTS tb_PROCESO (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    sector VARCHAR(50),
    orden INTEGER,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proceso_sector ON tb_PROCESO(sector);
CREATE INDEX IF NOT EXISTS idx_proceso_activo ON tb_PROCESO(activo);

CREATE TRIGGER tb_proceso_updated_at BEFORE UPDATE ON tb_PROCESO
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMENTARIOS DE TABLAS
-- =====================================================
COMMENT ON TABLE tb_PRODUCCION IS 'Tabla principal de producción (~150K registros)';
COMMENT ON TABLE tb_CALIDAD IS 'Registros de control de calidad';
COMMENT ON TABLE tb_PARADAS IS 'Paradas de máquinas y motivos';
COMMENT ON TABLE tb_PRODUCCION_OE IS 'Producción OE con datos específicos (6,315 registros)';
COMMENT ON TABLE tb_FICHAS IS 'Fichas técnicas de artículos';
COMMENT ON TABLE tb_METAS IS 'Metas mensuales por sector';
COMMENT ON TABLE tb_TESTES IS 'Registros de tests de producción';
COMMENT ON TABLE tb_DEFECTOS IS 'Catálogo de defectos';
COMMENT ON TABLE tb_RESIDUOS_INDIGO IS 'Residuos del sector índigo';
COMMENT ON TABLE tb_RESIDUOS_POR_SECTOR IS 'Residuos por sector productivo';
COMMENT ON TABLE tb_CALIDAD_FIBRA IS 'Datos HVI de calidad de fibra';
COMMENT ON TABLE tb_uster_par IS 'Parámetros ensayos Uster (Oracle)';
COMMENT ON TABLE tb_uster_tbl IS 'Datos detallados Uster: U%, CVm%, irregularidades';
COMMENT ON TABLE tb_tensorapid_par IS 'Parámetros ensayos TensoRapid (Oracle)';
COMMENT ON TABLE tb_tensorapid_tbl IS 'Datos TensoRapid: fuerza, elongación, tenacidad';

-- =====================================================
-- GRANTS
-- =====================================================
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO stc_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO stc_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO stc_user;
