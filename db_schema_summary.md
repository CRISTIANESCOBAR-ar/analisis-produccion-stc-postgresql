# Resumen de tablas y columnas

## Esquema: audit_recovery

### tb_produccion_stage

- **BATIDAS**: text
- **ENCOLH ACAB**: text
- **ESTIRAGEM REVISAO**: text
- **TEMPO LEIT MIN**: text
- **TOTAL MINUTOS TUR**: text
- **TOTAL MINUTOS TUR 1**: text
- **TOTAL MINUTOS TUR 2**: text
- **PARADA TEC TRAMA**: text
- **PARADA TEC URDUME**: text
- **PARADA TEC OUTROS**: text
- **PARADA TEC STOP**: text
- **BASE URDUME**: text
- **RPM LEITURA**: text
- **RPM NOMINALTEAR**: text
- **GRUPO TEAR**: text
- **DESC TEAR**: text
- **MODELO TEAR**: text
- **MAQ INDIGO**: text

## Esquema: public

### calidad

- **id**: integer(32)
- **filial**: character varying(2)
- **fecha_produccion**: date
- **partida**: character varying(20)
- **artigo**: character varying(20)
- **lote**: character varying(20)
- **rolada**: character varying(20)
- **revisor**: character varying(100)
- **metros_revisados**: numeric(12)
- **metros_2a**: numeric(12)
- **puntos_defecto**: integer(32)
- **puntos_100m2**: numeric(8)
- **porcentaje_calidad**: numeric(5)
- **created_at**: timestamp without time zone
- **updated_at**: timestamp without time zone

### import_control

- **id**: integer(32)
- **tabla_destino**: character varying(100)
- **archivo_origen**: character varying(500)
- **ultima_importacion**: timestamp without time zone
- **fecha_modificacion_archivo**: timestamp without time zone
- **registros_importados**: integer(32)
- **hash_archivo**: character varying(64)
- **estado**: character varying(20)
- **mensaje_error**: text
- **created_at**: timestamp without time zone
- **updated_at**: timestamp without time zone

### produccion

- **id**: integer(32)
- **filial**: character varying(2)
- **fecha_produccion**: date
- **turno**: character varying(1)
- **maquina**: character varying(10)
- **artigo**: character varying(20)
- **partida**: character varying(20)
- **metros_producidos**: numeric(12)
- **metros_2a**: numeric(12)
- **total_minutos**: integer(32)
- **minutos_producao**: integer(32)
- **minutos_parada**: integer(32)
- **eficiencia**: numeric(5)
- **velocidade_media**: numeric(8)
- **largura_tela**: numeric(6)
- **peso_rolo**: numeric(8)
- **created_at**: timestamp without time zone
- **updated_at**: timestamp without time zone

### residuos_indigo

- **id**: integer(32)
- **filial**: character varying(2)
- **fecha**: date
- **metros_producidos**: numeric(12)
- **estopa_azul_kg**: numeric(10)
- **porcentaje_estopa**: numeric(5)
- **created_at**: timestamp without time zone
- **updated_at**: timestamp without time zone

### resumen_produccion_diaria

- **fecha_produccion**: date
- **filial**: character varying(2)
- **total_maquinas**: bigint(64)
- **metros_totales**: numeric
- **eficiencia_promedio**: numeric
- **minutos_parada_total**: bigint(64)

### tb_calidad

- **EMP**: text
- **DAT_PROD**: text
- **GRP_DEF**: text
- **COD_DE**: text
- **DEFEITO**: text
- **INDIGO**: text
- **CC**: text
- **GRP_TEAR**: text
- **TEAR**: text
- **ARTIGO**: text
- **COR**: text
- **PARTIDA**: text
- **G_CMEST**: text
- **ACONDIC**: text
- **GRP_TEC**: text
- **TRAMA**: text
- **ROLADA**: text
- **METRAGEM**: text
- **QUALIDADE**: text
- **PESO BRUTO**: text
- **REVISOR FINAL**: text
- **HORA**: text
- **NM MERC**: text
- **TUR TEC**: text
- **T TEC1**: text
- **T TEC2**: text
- **EMENDAS**: text
- **PEÇA**: text
- **ETIQUETA**: text
- **PESO LIQUIDO**: text
- **LARGURA**: text
- **GR/M2**: text
- **T INDIGO**: text
- **PONTUACAO**: text
- **REPROCESSO**: text
- **COD DIREC**: text
- **DESC DIREC**: text
- **DT INI TEC**: text
- **HR INI TEC**: text
- **DT FIM TEC**: text
- **HR FIM TEC**: text
- **RPM TECEL**: text
- **GRUPO CMESTR**: text
- **URDUME**: text
- **MODELO TEAR**: text
- **ST IND**: text
- **G#PR**: text
- **DT  TINGIMENTO**: text
- **TURNO INDIGO**: text
- **OPER INDIGO**: text
- **LAVADEIRA 01**: text
- **TURNO LAVAD**: text
- **LAVADEIRA 02**: text
- **TURNO LAVAD 1**: text
- **LAVADEIRA 03**: text
- **TURNO LAVAD 03**: text
- **INTEGRADA**: text
- **TURNO INTEGR**: text
- **SANFOR 01**: text
- **TURNO SANF 01**: text
- **SANFOR 02**: text
- **TURNO SANF 02**: text
- **CALANDRA**: text
- **TURNO CALAND**: text
- **ESTAMAPRIA**: text
- **TURNO ESTAMP**: text
- **MERCERZ 01**: text
- **TURNO MERC 01**: text
- **MERCERZ 02**: text
- **TURNO MERC 02**: text
- **DATA PESAGEM**: text
- **HORA PESAGEM**: text
- **TURNO PESAGEM**: text
- **LOCAL TECEL**: text
- **DEF EMENDA**: text
- **DESC DEF EMENDA**: text
- **HORARIO_REVISAO**: text
- **TURNO_HORARIO_REVISAO**: text
- **TURNO_REVISAO**: text
- **DATA_REVISAO**: text
- **REVISOR EMENDA**: text
- **HORA PECA FINAL**: text
- **TURNO PECA FINAL**: text
- **G.PR**: text
- **DEFEITO MANCHA**: text

### tb_calidad_fibra

- **ITEM**: text
- **DESC_ITEM**: text
- **ID**: text
- **DATA_MOVIMENTO**: text
- **TIPO_MOV**: text
- **PRODUTOR**: text
- **PROCED**: text
- **LOTE**: text
- **PILHA**: text
- **DESTINO**: text
- **COR**: text
- **TP_MIC**: text
- **TP**: text
- **CLASSIFIC**: text
- **LOTE_INTERNO**: text
- **CORTEZA**: text
- **QTDE**: text
- **MISTURA**: text
- **SEQ**: text
- **TIPO_MP**: text
- **FORNECEDOR**: text
- **NMFORN**: text
- **NF**: text
- **LOTE_FIAC**: text
- **TAM**: text
- **SCI**: text
- **MST**: text
- **MIC**: text
- **MAT**: text
- **UHML**: text
- **UI**: text
- **SF**: text
- **STR**: text
- **ELG**: text
- **RD**: text
- **PLUS_B**: text
- **TIPO**: text
- **TrCNT**: text
- **TrAR**: text
- **TRID**: text
- **SAC**: text
- **PIM**: text
- **SC**: text
- **BENF**: text
- **TP_SELO**: text
- **NUM_SELO**: text
- **PESO**: text
- **PESO_MEDIO**: text
- **ENT_SAI**: text
- **UM**: text
- **OBSERVACAO**: text
- **IDFIL**: text
- **DT_EMISSAO**: text
- **DT_ENTRADA_PROD**: text
- **HR_ENTRADA_PROD**: text
- **TURNO_ENT_PROD**: text
- **LADO**: text
- **FARDOS_TESTADOS**: text
- **FORNECEDOR_2**: text
- **CONSIGNADO**: text
- **LIBERADO**: text
- **DATA_LIBERACAO**: text
- **DOC_VENDA**: text
- **DT_EMIS_DOC_VENDA**: text
- **USU_LIBEROU**: text
- **DT_INCLUSAO**: text
- **USU_INCLUSAO**: text
- **DT_ALTERACAO**: text
- **USU_ALTERACAO**: text

### tb_column_warnings_history

- **id**: bigint(64)
- **table_name**: text
- **csv_path**: text
- **detected_at**: timestamp with time zone
- **extra_columns**: ARRAY
- **missing_columns**: ARRAY

### tb_config_hilos

- **id**: integer(32)
- **version_nombre**: character varying(50)
- **activa**: boolean
- **titulo_ne**: character varying(20)
- **aplicacion**: character varying(50)
- **sci_min**: integer(32)
- **str_min**: numeric(4)
- **mic_min**: numeric(3)
- **mic_max**: numeric(3)
- **sf_max**: numeric(4)
- **created_at**: timestamp without time zone

### tb_config_tolerancias

- **id**: integer(32)
- **version_nombre**: character varying(50)
- **parametro**: character varying(20)
- **valor_ideal_min**: numeric(5)
- **rango_tol_min**: numeric(5)
- **rango_tol_max**: numeric(5)
- **porcentaje_min_ideal**: integer(32)
- **created_at**: timestamp without time zone
- **limite_max_absoluto**: numeric(5)
- **limite_min_absoluto**: numeric(5)
- **promedio_objetivo_max**: numeric(5)

### tb_costo_item_alias

- **id**: integer(32)
- **item_id**: integer(32)
- **origen**: text
- **nombre_en_origen**: text

### tb_costo_items

- **id**: integer(32)
- **codigo**: text
- **descripcion**: text
- **unidad**: text
- **activo**: boolean

### tb_costo_mensual

- **id**: integer(32)
- **yyyymm**: text
- **item_id**: integer(32)
- **ars_por_unidad**: numeric
- **observaciones**: text

### tb_defectos

- **FILIAL**: text
- **PARTIDA**: text
- **PECA**: text
- **ETIQUETA**: text
- **ARTIGO**: text
- **NM_MERC**: text
- **COD_DEF**: text
- **DESC_DEFEITO**: text
- **PONTOS**: text
- **QUALIDADE**: text
- **DATA_PROD**: text

### tb_est_mp

- **id**: integer(32)
- **created_at**: timestamp without time zone
- **updated_at**: timestamp without time zone
- **ITEM**: text
- **DESC_ITEM**: text
- **PRODUTOR**: text
- **PROCED**: text
- **NMFORN**: text
- **TAM**: text
- **PILHA**: text
- **DESTINO**: text
- **LOTE**: text
- **TP**: text
- **CLASSIF**: text
- **COR**: text
- **TP MIC**: text
- **LOTE ADIC**: text
- **NUM. DOC (NF)**: text
- **QTDE ESTOQUE**: text
- **QTDE RESERV**: text
- **SALDO DISPONIVEL**: text
- **SCI**: text
- **MST**: text
- **MIC**: text
- **MAT**: text
- **UHML**: text
- **UI**: text
- **SF**: text
- **STR**: text
- **ELG**: text
- **RD**: text
- **+b**: text
- **TIPO**: text
- **TrCNT**: text
- **TrAR**: text
- **TRID**: text
- **SAC**: text
- **PIM**: text
- **SC**: text
- **TEM SELO**: text
- **SELO**: text
- **NUM. SELO**: text
- **BENF**: text
- **OBS**: text
- **PESO**: text
- **PESO_MEDIO**: text
- **UM**: text
- **DT_ULT_MOV**: text
- **TESTE**: text
- **CORTEZA**: text
- **CONSIGNADO**: text
- **CONSIG_DISP**: text
- **PEGAJOS**: text
- **DESC PEGAJOS**: text
- **CAULE**: text
- **DESC CAULE**: text
- **FOL SECA**: text
- **DESC FOL SECA**: text
- **MAN OLEO**: text
- **DESC MAN OLEO**: text
- **ENCARN**: text
- **DESC ENCARN**: text
- **FOL VERD**: text
- **DESC FOL VERD**: text
- **CASQUIN**: text
- **DESC CASQUIN**: text
- **PO**: text
- **DESC PO**: text

### tb_fichas

- **ARTIGO CODIGO**: text
- **ARTIGO**: text
- **COR**: text
- **NCM**: text
- **BASE**: text
- **UnP**: text
- **VENDA**: text
- **PRODUÇÃO**: text
- **NOME REDUZIDO**: text
- **NOME DE MERCADO**: text
- **COMPOSIÇÃO**: text
- **LARGURA cm**: text
- **g/m2**: text
- **TRAMA**: text
- **URDUME**: text
- **RENDIMENTO**: text
- **CLIENTE**: text
- **OBS**: text
- **ESTAMPARIA**: text
- **LINHA**: text
- **SARJA**: text
- **COD. RETALHO**: text
- **SAP**: text
- **TRAMA REDUZIDO**: text
- **SGS**: text
- **SGS UN 1**: text
- **DESCRIÇÃO**: text
- **BATIDAS/FIO**: text
- **NE RESULTANTE**: text
- **SAP 1**: text
- **TRAMA REDUZIDO 1**: text
- **SGS 1**: text
- **SGS UN 2**: text
- **DESCRIÇÃO 1**: text
- **BATIDAS/FIO 1**: text
- **NE RESULTANTE 1**: text
- **CONS.TR/m**: text
- **SGS 2**: text
- **QT.FIOS**: text
- **NE RESULTANTE 2**: text
- **SGS 3**: text
- **QT.FIOS 1**: text
- **NE RESULTANTE 3**: text
- **CONS.URD/m**: text
- **BATIDA**: text
- **LARG.PENTE**: text
- **LARG.CRU**: text
- **PESO/m CRU**: text
- **Oz/jd2**: text
- **Peso/m2**: text
- **LARGURA MIN**: text
- **LARGURA**: text
- **LARGURA MAX**: text
- **SKEW MIN**: text
- **SKEW MAX**: text
- **URD.MIN**: text
- **URD.MAX**: text
- **TRAMA MIN**: text
- **TRAMA MAX**: text
- **VAR STR.MIN TRAMA**: text
- **VAR STR.MAX TRAMA**: text
- **VAR STR.MIN URD**: text
- **VAR STR.MAX URD**: text
- **PONTOS**: text
- **ENC.TEC.URDUME**: text
- **ENC. TEC.TRAMA**: text
- **ENC.ACAB URD**: text
- **ENC.ACAB TRAMA**: text
- **LAV.AMAC.URD**: text
- **LAV.AMAC.TRM**: text
- **LAV STONE**: text
- **LAV STONE 1**: text
- **STRET LAV STONE**: text

### tb_historico_configuraciones

- **id**: integer(32)
- **version_nombre**: character varying(50)
- **fecha_guardado**: timestamp without time zone
- **snapshot_json**: jsonb
- **usuario_responsable**: character varying(100)

### tb_hvi_detalles

- **id**: integer(32)
- **ensayo_id**: integer(32)
- **fardo**: text
- **sci**: numeric
- **mst**: numeric
- **mic**: numeric
- **mat**: numeric
- **uhml**: numeric
- **ui**: numeric
- **sf**: numeric
- **str**: numeric
- **elg**: numeric
- **rd**: numeric
- **plus_b**: numeric
- **tipo**: text
- **tr_cnt**: numeric
- **tr_ar**: numeric
- **trid**: numeric

### tb_hvi_ensayos

- **id**: integer(32)
- **tipo**: text
- **lote**: text
- **proveedor**: text
- **grado**: text
- **fecha**: text
- **muestra**: text
- **archivo_fuente**: text
- **creado_at**: timestamp without time zone
- **cantidad**: integer(32)
- **color**: text
- **cort**: integer(32)
- **obs**: text

### tb_import_metadata

- **table_name**: text
- **last_import_date**: timestamp without time zone
- **file_mtime**: timestamp without time zone
- **rows_imported**: integer(32)
- **csv_file**: text
- **last_mode**: text
- **last_error**: text
- **last_duration_ms**: integer(32)
- **last_skipped**: integer(32)
- **last_mode_reason**: text
- **created_at**: timestamp without time zone
- **updated_at**: timestamp without time zone

### tb_metas

- **id**: bigint(64)
- **Dia**: date
- **Indigo**: numeric
- **Meta_Eficiencia_INDIGO**: numeric
- **Meta_Rotura_INDIGO**: numeric
- **Meta_Estopa_Azul**: numeric
- **Tejeduria**: numeric
- **RU105**: numeric
- **RT105**: numeric
- **EFI_Percent**: numeric
- **Meta_Estopa_Azul_Tejeduria**: numeric
- **Integrada**: numeric
- **Meta_Velocidad_Integrada**: numeric
- **Meta_ENC_URD_Integrada**: numeric
- **Revision**: numeric
- **Dia_Invertido**: integer(32)
- **created_at**: timestamp without time zone
- **updated_at**: timestamp without time zone

### tb_narrativa_cache

- **cache_key**: character varying(64)
- **lotes**: text
- **fecha**: character varying(20)
- **formato**: character varying(32)
- **modelo**: character varying(64)
- **data_hash**: character varying(64)
- **narrativa**: text
- **json_analisis_ia**: jsonb
- **modelo_usado**: character varying(64)
- **token_info**: jsonb
- **created_at**: timestamp with time zone
- **last_hit_at**: timestamp with time zone
- **hits**: integer(32)

### tb_narrativa_log

- **id**: integer(32)
- **lotes**: text
- **fecha_corte**: character varying(20)
- **formato**: character varying(32)
- **idioma**: character varying(10)
- **modelo**: character varying(64)
- **tokens_entrada**: integer(32)
- **tokens_salida**: integer(32)
- **tokens_total**: integer(32)
- **costo_usd**: numeric(12)
- **fuente**: character varying(16)
- **desde_cache**: boolean
- **created_at**: timestamp with time zone

### tb_paradas

- **FILIAL**: text
- **MAQUINA**: text
- **TP_MAQ**: text
- **PROCESSO**: text
- **DATA_BASE**: text
- **HORA_INICIO**: text
- **HORA_FINAL**: text
- **TURNO**: text
- **DURACAO**: text
- **NUM OCORREN**: text
- **OPERADOR**: text
- **NOME_OPER**: text
- **MOTIVO**: text
- **DESC_MOTIVO**: text
- **GRUPO**: text
- **DESC_GRP_MOTIVO**: text
- **CAUSA**: text
- **DESC_CAUSA**: text
- **LADO**: text
- **POSICAO**: text
- **PARTIDA**: text
- **URDUME**: text
- **INDIGO**: text
- **DATA_TINGIMENT**: text
- **TURNO_TING**: text
- **STATUS_INDIG**: text
- **OPER_TING**: text
- **NOME_OPER_TING**: text
- **GRUPO_MAQ**: text
- **OBS**: text
- **PARTIDA_ORIGINAL**: text
- **CV_ORIG**: text
- **ST_ORIG**: text
- **OBS_ORIG**: text
- **PARTIDA_ANTERIOR**: text
- **CV_ANT**: text
- **ST_ANT**: text
- **OBS_ANT**: text
- **PARTIDA_POSTERIOR**: text
- **CV_POS**: text
- **ST_POS**: text
- **OBS_POS**: text
- **ROLADA**: text
- **ID TROCA ROLADA**: text
- **MOTIVO1**: text
- **DESCRICAO MOTIVO**: text
- **ROLADA INICIAL**: text
- **COR**: text
- **ROLADA FINAL**: text
- **COR1**: text
- **OBS TROCA ROLADA**: text
- **TEMPO PREVISTO**: text
- **SUB-GRUPO**: text
- **DESC SUB-GRUPO**: text

### tb_parametros_hvi

- **id**: integer(32)
- **codigo**: character varying(20)
- **nombre**: character varying(100)
- **descripcion**: text
- **unidad**: character varying(20)
- **tipo_dato**: character varying(20)
- **decimales**: integer(32)
- **optimo_min**: numeric(10)
- **optimo_max**: numeric(10)
- **aceptable_min**: numeric(10)
- **aceptable_max**: numeric(10)
- **critico_min**: numeric(10)
- **critico_max**: numeric(10)
- **activo**: boolean
- **creado_en**: timestamp without time zone
- **actualizado_en**: timestamp without time zone

### tb_proceso

- **FILIAL**: text
- **PROCESSO**: text
- **PARTIDA**: text
- **ARTIGO**: text
- **COR**: text
- **DESC_NM_MERC**: text
- **MT_DISPONIV**: text
- **DT_PROD**: text
- **NUM_FIOS**: text
- **FLANGE**: text
- **BOBINA**: text
- **COD_BOBINA**: text
- **MISTURA_BOBINA**: text
- **OBS_PROCESSO**: text
- **OBS_BOBINA**: text
- **PRODUCAO_ANUAL_KG**: text
- **ITEM**: text
- **DESC_ITEM**: text
- **QTD_BOB**: text
- **MT_BOB**: text
- **KG_BOB**: text
- **LADO**: text
- **MAQUINA**: text
- **STATUS**: text
- **URDUME**: text
- **MT_PREVISTA**: text
- **MT_A_BATER**: text
- **MT_PROX24H**: text
- **BATIDAS**: text
- **RPM**: text
- **EFIC_TA**: text
- **EFIC_TB**: text
- **EFIC_TC**: text
- **EFIC_DIA**: text
- **ART_PROGR**: text
- **NM_MERC_PROG**: text
- **COR_PG**: text
- **URDUME_PRO**: text
- **GRUPO_TEAR**: text
- **REPROCESSO**: text
- **LARGURA**: text
- **TRAMA_REDUZIDA_1**: text
- **TRAMA_REDUZIDA_2**: text
- **DATA FINAL TECEL**: text
- **HORA_FINAL_TECEL**: text
- **TURNO_FINAL_TECE**: text
- **HORA_FINAL_TECEL_V2**: text
- **OBS ACABAMENTO**: text
- **COD MOT REP**: text
- **MOTIVO REPROCESSO**: text
- **OBS REPROCESSO**: text

### tb_produccion

- **FILIAL**: text
- **DT_INICIO**: text
- **HORA_INICIO**: text
- **DT_FINAL**: text
- **HORA_FINAL**: text
- **DT_BASE_PRODUCAO**: text
- **TURNO**: text
- **PARTIDA**: text
- **PARTIDA_DUPLA**: text
- **R**: text
- **ARTIGO**: text
- **COR**: text
- **METRAGEM**: text
- **METRAGEM ENCOLH**: text
- **TEMPO**: text
- **VELOC CALC**: text
- **VELOC**: text
- **EFICIENCIA**: text
- **NUM_FIOS**: text
- **S**: text
- **MAQUINA**: text
- **RUPTURAS**: text
- **CAVALOS**: text
- **OPERADOR**: text
- **NM OPERADOR**: text
- **NM MERCADO**: text
- **LARG PAD**: text
- **LARG INI**: text
- **LARG FIM**: text
- **TRAMA REDUZIDA 1**: text
- **TRAMA REDUZIDA 2**: text
- **RUP FIACAO**: text
- **RUP URD**: text
- **RUP OPER**: text
- **LOTE FIACAO**: text
- **MAQ  FIACAO**: text
- **ROLADA**: text
- **SELETOR**: text
- **QTDE_RUPTURA**: text
- **COD_RUP**: text
- **MOTIVO_RUP**: text
- **TIPO_RUP**: text
- **DESC_TP_RUPTURA**: text
- **COD_CAVALO**: text
- **DESC_CAVALO**: text
- **OBS**: text
- **TURNO_INDIGO**: text
- **QTDE_CAVALO**: text
- **PONTOS_LIDOS**: text
- **PONTOS_100%**: text
- **BATIDAS**: text
- **ENCOLH ACAB**: text
- **ESTIRAGEM REVISAO**: text
- **TEMPO LEIT MIN**: text
- **TOTAL MINUTOS TUR**: text
- **TOTAL MINUTOS TUR 1**: text
- **TOTAL MINUTOS TUR 2**: text
- **PARADA TEC TRAMA**: text
- **PARADA TEC URDUME**: text
- **PARADA TEC OUTROS**: text
- **PARADA TEC STOP**: text
- **BASE URDUME**: text
- **RPM LEITURA**: text
- **RPM NOMINALTEAR**: text
- **GRUPO TEAR**: text
- **DESC TEAR**: text
- **MODELO TEAR**: text
- **MAQ INDIGO**: text

### tb_produccion_carda

- **MAQUINA**: text
- **LF**: text
- **DATA**: text
- **T**: text
- **HR_INI**: text
- **HR_FINA**: text
- **ITEM**: text
- **DESC ITEM**: text
- **TITULO**: text
- **RPM**: text
- **TEMPO TOTAL**: text
- **PROD KG/H**: text
- **PROD CALC**: text
- **PROD INFORM**: text
- **EFIC INFOR**: text
- **EFIC CALC**: text
- **OBS**: text
- **D%**: text
- **CV**: text
- **CVIn**: text
- **PG**: text
- **A%**: text
- **T (25%)**: text
- **T (20%)**: text
- **T (15%)**: text
- **T1 (25%)**: text
- **T1 (20%)**: text
- **T1 (15%)**: text
- **T2 (25%)**: text
- **T2 (20%)**: text
- **T2 (15%)**: text

### tb_produccion_oe

- **FILIAL**: text
- **LOC. FISICO**: text
- **MAQUINA**: text
- **NOME_MAQUINA**: text
- **DATA_PRODUCAO**: text
- **TURNO**: text
- **LADO**: text
- **ITEM**: text
- **DESC ITEM**: text
- **HORA INICIAL**: text
- **HORA FINAL**: text
- **RPM**: text
- **NUM FUSOS**: text
- **ALFA**: text
- **LOTE PRODUC**: text
- **TÍTULO**: text
- **TEMPO**: text
- **TORCAO P POLEG**: text
- **TORCAO P METRO**: text
- **PROD MT/MIN**: text
- **PROD KG/HR**: text
- **PROD CALCULADA**: text
- **PROD INFORMADA**: text
- **EFIC CALCULADA**: text
- **EFIC INFORMADA**: text
- **OPERADOR**: text
- **T.BOB.**: text
- **RPM CARD**: text
- **N**: text
- **S**: text
- **L**: text
- **T**: text
- **MO**: text
- **CP V+ SL+**: text
- **CM V- SL-**: text
- **CCp C+**: text
- **CCm C-**: text
- **JP (P+)**: text
- **JM (P-)**: text
- **CVP**: text
- **CVM**: text
- **CORT NAT**: text
- **% ROB 01**: text
- **% ROB 02**: text
- **% ROB 03**: text

### tb_residuos_indigo

- **FILIAL**: text
- **SETOR**: text
- **DESC_SETOR**: text
- **DT_MOV**: text
- **TURNO**: text
- **SUBPRODUTO**: text
- **DESCRICAO**: text
- **ID**: text
- **PESO LIQUIDO (KG)**: text
- **LOTE**: text
- **PARTIDA**: text
- **ROLADA**: text
- **MOTIVO**: text
- **DESC_MOTIVO**: text
- **OPERADOR**: text
- **NOME_OPER**: text
- **PE DE ROLO**: text
- **INDIGO**: text
- **URDUME**: text
- **TURNO CORTE**: text
- **GAIOLA**: text
- **OBS**: text
- **PESO ROLO 01**: text
- **PESO ROLO 02**: text
- **PESO ROLO 03**: text
- **PESO ROLO 04**: text
- **PESO ROLO 05**: text
- **PESO ROLO 06**: text
- **PESO ROLO 07**: text
- **PESO ROLO 08**: text
- **PESO ROLO 09**: text
- **PESO ROLO 10**: text
- **PESO ROLO 11**: text
- **PESO ROLO 12**: text
- **PESO ROLO 13**: text
- **PESO ROLO 14**: text
- **PESO ROLO 15**: text
- **PESO ROLO 16**: text
- **DEVOL TEC#**: text

### tb_residuos_por_sector

- **FILIAL**: text
- **SETOR**: text
- **DESC_SETOR**: text
- **DT_MOV**: text
- **TURNO**: text
- **SUBPRODUTO**: text
- **DESCRICAO**: text
- **ID**: text
- **PESO LIQUIDO (KG)**: text
- **LOTE**: text
- **OPERADOR**: text
- **NOME_OPER**: text
- **OBS**: text

### tb_schema_changes_log

- **id**: bigint(64)
- **table_name**: text
- **change_type**: text
- **applied_at**: timestamp with time zone
- **columns_added**: ARRAY
- **reimported**: boolean
- **success**: boolean
- **error_message**: text

### tb_tensorapid_par

- **testnr**: text
- **ne_titulo**: numeric
- **titulo**: text
- **comment_text**: text
- **long_prueba**: numeric
- **time_stamp**: text
- **lote**: text
- **ne_titulo_type**: text
- **created_at**: timestamp with time zone
- **updated_at**: timestamp with time zone
- **uster_testnr**: text
- **catalog**: text
- **time**: text
- **sortiment**: text
- **article**: text
- **maschnr**: text
- **matclass**: text
- **nomcount**: numeric
- **nomtwist**: text
- **uscode**: text
- **laborant**: text
- **comment**: text
- **tuname**: text
- **groups**: text
- **within**: text
- **total**: text
- **unspoolgroups**: text
- **length**: text
- **extspeed**: text
- **pretension**: text
- **clamppressure**: text
- **cycleforcell**: text
- **cycleforceul**: text
- **nmbofforcecycles**: text
- **cyclelongll**: text
- **cyclelongul**: text
- **nmbofelongcycles**: text
- **forcef1rel**: text
- **elongatione1rel**: text
- **evaltimerel**: text
- **preloadcyclesrel**: text
- **forcef1ret**: text
- **elongatione1ret**: text
- **evaltimeret**: text
- **preloadcyclesret**: text

### tb_tensorapid_tbl

- **id**: integer(32)
- **testnr**: text
- **huso_number**: integer(32)
- **tiempo_rotura**: numeric
- **fuerza_b**: numeric
- **elongacion**: numeric
- **tenacidad**: numeric
- **trabajo**: numeric
- **huso_ensayos**: text
- **created_at**: timestamp with time zone
- **updated_at**: timestamp with time zone

### tb_testes

- **MAQUINA**: text
- **ARTIGO**: text
- **NM_MERC**: text
- **PARTIDA**: text
- **METRAGEM**: text
- **DT_PROD**: text
- **HORA_PROD**: text
- **TURNO**: text
- **LARG_AL**: text
- **GRAMAT**: text
- **POTEN**: text
- **%_ENC_URD**: text
- **%_ENC_TRAMA**: text
- **%_SK1**: text
- **%_SK2**: text
- **%_SK3**: text
- **%_SK4**: text
- **%_SKE**: text
- **%_STT**: text
- **%_SKM**: text
- **APROV**: text
- **COD_ART**: text
- **COR_ART**: text
- **OBS**: text
- **REPROCESSO**: text
- **SEQ TESTE**: text

### tb_uster_carda_par

- **testnr**: text
- **source_prefix**: text
- **catalog**: text
- **sortiment**: text
- **style**: text
- **machine_family**: text
- **nomcount**: numeric
- **maschnr**: text
- **lote**: text
- **laborant**: text
- **time_stamp**: text
- **matclass**: text
- **obs**: text
- **created_at**: timestamp with time zone
- **updated_at**: timestamp with time zone

### tb_uster_carda_tbl

- **id**: bigint(64)
- **testnr**: text
- **seqno**: integer(32)
- **no_**: numeric
- **u_percent**: numeric
- **cvm_percent**: numeric
- **cvm_1m_percent**: numeric
- **cvm_3m_percent**: numeric
- **cvm_10m_percent**: numeric
- **titulo_machine**: numeric
- **titulo_rel_perc**: numeric
- **created_at**: timestamp with time zone

### tb_uster_carda_titulo_tbl

- **id**: bigint(64)
- **testnr**: text
- **repno**: smallint(16)
- **titulo**: numeric
- **created_at**: timestamp with time zone

### tb_uster_par

- **testnr**: text
- **nomcount**: text
- **maschnr**: text
- **lote**: text
- **laborant**: text
- **time_stamp**: text
- **matclass**: text
- **estiraje**: text
- **pasador**: text
- **obs**: text
- **created_at**: timestamp with time zone
- **updated_at**: timestamp with time zone

### tb_uster_tbl

- **id**: bigint(64)
- **testnr**: text
- **seqno**: integer(32)
- **no_**: text
- **u_percent**: numeric
- **cvm_percent**: numeric
- **indice_percent**: numeric
- **cvm_1m_percent**: numeric
- **cvm_3m_percent**: numeric
- **cvm_10m_percent**: numeric
- **titulo**: numeric
- **titulo_rel_perc**: numeric
- **h**: numeric
- **sh**: numeric
- **sh_1m**: numeric
- **sh_3m**: numeric
- **sh_10m**: numeric
- **delg_minus30_km**: numeric
- **delg_minus40_km**: numeric
- **delg_minus50_km**: numeric
- **delg_minus60_km**: numeric
- **grue_35_km**: numeric
- **grue_50_km**: numeric
- **grue_70_km**: numeric
- **grue_100_km**: numeric
- **neps_140_km**: numeric
- **neps_200_km**: numeric
- **neps_280_km**: numeric
- **neps_400_km**: numeric
- **created_at**: timestamp with time zone

