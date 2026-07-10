--
-- PostgreSQL database dump
--

\restrict aulYzcU62h6ldveebETUdJdSCbkCkjJ37Ddql5eVgYpa5OicIiz8G4d8UEI8ZCl

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: obtener_estadisticas_mes(integer, integer); Type: FUNCTION; Schema: public; Owner: stc_user
--

CREATE FUNCTION public.obtener_estadisticas_mes(p_anio integer, p_mes integer) RETURNS TABLE(fecha date, metros_producidos numeric, eficiencia_promedio numeric, total_maquinas bigint)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.fecha_produccion,
        SUM(p.metros_producidos)::DECIMAL as metros,
        AVG(p.eficiencia)::DECIMAL as efic,
        COUNT(DISTINCT p.maquina) as maquinas
    FROM produccion p
    WHERE EXTRACT(YEAR FROM p.fecha_produccion) = p_anio
      AND EXTRACT(MONTH FROM p.fecha_produccion) = p_mes
    GROUP BY p.fecha_produccion
    ORDER BY p.fecha_produccion;
END;
$$;


ALTER FUNCTION public.obtener_estadisticas_mes(p_anio integer, p_mes integer) OWNER TO stc_user;

--
-- Name: update_parametros_hvi_timestamp(); Type: FUNCTION; Schema: public; Owner: stc_user
--

CREATE FUNCTION public.update_parametros_hvi_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.actualizado_en = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_parametros_hvi_timestamp() OWNER TO stc_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: stc_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO stc_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: calidad; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.calidad (
    id integer NOT NULL,
    filial character varying(2) NOT NULL,
    fecha_produccion date NOT NULL,
    partida character varying(20),
    artigo character varying(20),
    lote character varying(20),
    rolada character varying(20),
    revisor character varying(100),
    metros_revisados numeric(12,2),
    metros_2a numeric(12,2),
    puntos_defecto integer DEFAULT 0,
    puntos_100m2 numeric(8,2),
    porcentaje_calidad numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT calidad_fecha_check CHECK ((fecha_produccion >= '2020-01-01'::date)),
    CONSTRAINT calidad_metros_check CHECK ((metros_revisados >= (0)::numeric)),
    CONSTRAINT calidad_porcentaje_check CHECK (((porcentaje_calidad >= (0)::numeric) AND (porcentaje_calidad <= (100)::numeric)))
);


ALTER TABLE public.calidad OWNER TO stc_user;

--
-- Name: calidad_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.calidad_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.calidad_id_seq OWNER TO stc_user;

--
-- Name: calidad_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.calidad_id_seq OWNED BY public.calidad.id;


--
-- Name: import_control; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.import_control (
    id integer NOT NULL,
    tabla_destino character varying(100) NOT NULL,
    archivo_origen character varying(500) NOT NULL,
    ultima_importacion timestamp without time zone,
    fecha_modificacion_archivo timestamp without time zone,
    registros_importados integer DEFAULT 0,
    hash_archivo character varying(64),
    estado character varying(20) DEFAULT 'pending'::character varying,
    mensaje_error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.import_control OWNER TO stc_user;

--
-- Name: import_control_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.import_control_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.import_control_id_seq OWNER TO stc_user;

--
-- Name: import_control_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.import_control_id_seq OWNED BY public.import_control.id;


--
-- Name: produccion; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.produccion (
    id integer NOT NULL,
    filial character varying(2) NOT NULL,
    fecha_produccion date NOT NULL,
    turno character varying(1),
    maquina character varying(10) NOT NULL,
    artigo character varying(20),
    partida character varying(20),
    metros_producidos numeric(12,2),
    metros_2a numeric(12,2),
    total_minutos integer,
    minutos_producao integer,
    minutos_parada integer,
    eficiencia numeric(5,2),
    velocidade_media numeric(8,2),
    largura_tela numeric(6,2),
    peso_rolo numeric(8,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT produccion_eficiencia_check CHECK (((eficiencia >= (0)::numeric) AND (eficiencia <= (100)::numeric))),
    CONSTRAINT produccion_fecha_check CHECK ((fecha_produccion >= '2020-01-01'::date)),
    CONSTRAINT produccion_metros_check CHECK ((metros_producidos >= (0)::numeric))
);


ALTER TABLE public.produccion OWNER TO stc_user;

--
-- Name: produccion_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.produccion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.produccion_id_seq OWNER TO stc_user;

--
-- Name: produccion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.produccion_id_seq OWNED BY public.produccion.id;


--
-- Name: residuos_indigo; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.residuos_indigo (
    id integer NOT NULL,
    filial character varying(2) NOT NULL,
    fecha date NOT NULL,
    metros_producidos numeric(12,2),
    estopa_azul_kg numeric(10,2),
    porcentaje_estopa numeric(5,2),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.residuos_indigo OWNER TO stc_user;

--
-- Name: residuos_indigo_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.residuos_indigo_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.residuos_indigo_id_seq OWNER TO stc_user;

--
-- Name: residuos_indigo_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.residuos_indigo_id_seq OWNED BY public.residuos_indigo.id;


--
-- Name: resumen_produccion_diaria; Type: VIEW; Schema: public; Owner: stc_user
--

CREATE VIEW public.resumen_produccion_diaria AS
 SELECT fecha_produccion,
    filial,
    count(DISTINCT maquina) AS total_maquinas,
    sum(metros_producidos) AS metros_totales,
    avg(eficiencia) AS eficiencia_promedio,
    sum(minutos_parada) AS minutos_parada_total
   FROM public.produccion
  GROUP BY fecha_produccion, filial
  ORDER BY fecha_produccion DESC;


ALTER VIEW public.resumen_produccion_diaria OWNER TO stc_user;

--
-- Name: tb_calidad; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_calidad (
    "EMP" text,
    "DAT_PROD" text,
    "GRP_DEF" text,
    "COD_DE" text,
    "DEFEITO" text,
    "INDIGO" text,
    "CC" text,
    "GRP_TEAR" text,
    "TEAR" text,
    "ARTIGO" text,
    "COR" text,
    "PARTIDA" text,
    "G_CMEST" text,
    "ACONDIC" text,
    "GRP_TEC" text,
    "TRAMA" text,
    "ROLADA" text,
    "METRAGEM" text,
    "QUALIDADE" text,
    "PESO BRUTO" text,
    "REVISOR FINAL" text,
    "HORA" text,
    "NM MERC" text,
    "TUR TEC" text,
    "T TEC1" text,
    "T TEC2" text,
    "EMENDAS" text,
    "PEÇA" text,
    "ETIQUETA" text,
    "PESO LIQUIDO" text,
    "LARGURA" text,
    "GR/M2" text,
    "T INDIGO" text,
    "PONTUACAO" text,
    "REPROCESSO" text,
    "COD DIREC" text,
    "DESC DIREC" text,
    "DT INI TEC" text,
    "HR INI TEC" text,
    "DT FIM TEC" text,
    "HR FIM TEC" text,
    "RPM TECEL" text,
    "GRUPO CMESTR" text,
    "URDUME" text,
    "MODELO TEAR" text,
    "ST IND" text,
    "G#PR" text,
    "DT  TINGIMENTO" text,
    "TURNO INDIGO" text,
    "OPER INDIGO" text,
    "LAVADEIRA 01" text,
    "TURNO LAVAD " text,
    "LAVADEIRA 02" text,
    "TURNO LAVAD 1" text,
    "LAVADEIRA 03" text,
    "TURNO LAVAD 03" text,
    "INTEGRADA" text,
    "TURNO INTEGR" text,
    "SANFOR 01" text,
    "TURNO SANF 01" text,
    "SANFOR 02" text,
    "TURNO SANF 02" text,
    "CALANDRA" text,
    "TURNO CALAND" text,
    "ESTAMAPRIA" text,
    "TURNO ESTAMP" text,
    "MERCERZ 01" text,
    "TURNO MERC 01" text,
    "MERCERZ 02" text,
    "TURNO MERC 02" text,
    "DATA PESAGEM" text,
    "HORA PESAGEM" text,
    "TURNO PESAGEM " text,
    "LOCAL TECEL" text,
    "DEF EMENDA" text,
    "DESC DEF EMENDA" text,
    "HORARIO_REVISAO" text,
    "TURNO_HORARIO_REVISAO" text,
    "TURNO_REVISAO" text,
    "DATA_REVISAO" text,
    "REVISOR EMENDA" text,
    "HORA PECA FINAL" text,
    "TURNO PECA FINAL" text,
    "G.PR" text,
    "TURNO LAVAD" text,
    "TURNO PESAGEM" text,
    "DEFEITO MANCHA" text
);


ALTER TABLE public.tb_calidad OWNER TO stc_user;

--
-- Name: tb_calidad_fibra; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_calidad_fibra (
    "ITEM" text,
    "DESC_ITEM" text,
    "ID" text,
    "DATA_MOVIMENTO" text,
    "TIPO_MOV" text,
    "PRODUTOR" text,
    "PROCED" text,
    "LOTE" text,
    "PILHA" text,
    "DESTINO" text,
    "COR" text,
    "TP_MIC" text,
    "TP" text,
    "CLASSIFIC" text,
    "LOTE_INTERNO" text,
    "CORTEZA" text,
    "QTDE" text,
    "MISTURA" text,
    "SEQ" text,
    "TIPO_MP" text,
    "FORNECEDOR" text,
    "NMFORN" text,
    "NF" text,
    "LOTE_FIAC" text,
    "TAM" text,
    "SCI" text,
    "MST" text,
    "MIC" text,
    "MAT" text,
    "UHML" text,
    "UI" text,
    "SF" text,
    "STR" text,
    "ELG" text,
    "RD" text,
    "PLUS_B" text,
    "TIPO" text,
    "TrCNT" text,
    "TrAR" text,
    "TRID" text,
    "SAC" text,
    "PIM" text,
    "SC" text,
    "BENF" text,
    "TP_SELO" text,
    "NUM_SELO" text,
    "PESO" text,
    "PESO_MEDIO" text,
    "ENT_SAI" text,
    "UM" text,
    "OBSERVACAO" text,
    "IDFIL" text,
    "DT_EMISSAO" text,
    "DT_ENTRADA_PROD" text,
    "HR_ENTRADA_PROD" text,
    "TURNO_ENT_PROD" text,
    "LADO" text,
    "FARDOS_TESTADOS" text,
    "FORNECEDOR_2" text,
    "CONSIGNADO" text,
    "LIBERADO" text,
    "DATA_LIBERACAO" text,
    "DOC_VENDA" text,
    "DT_EMIS_DOC_VENDA" text,
    "USU_LIBEROU" text,
    "DT_INCLUSAO" text,
    "USU_INCLUSAO" text,
    "DT_ALTERACAO" text,
    "USU_ALTERACAO" text
);


ALTER TABLE public.tb_calidad_fibra OWNER TO stc_user;

--
-- Name: TABLE tb_calidad_fibra; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_calidad_fibra IS 'Calidad y movimientos de materia prima (fibra/algodón)';


--
-- Name: tb_column_warnings_history; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_column_warnings_history (
    id bigint NOT NULL,
    table_name text NOT NULL,
    csv_path text,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    extra_columns text[] DEFAULT '{}'::text[] NOT NULL,
    missing_columns text[] DEFAULT '{}'::text[] NOT NULL
);


ALTER TABLE public.tb_column_warnings_history OWNER TO stc_user;

--
-- Name: tb_column_warnings_history_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_column_warnings_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_column_warnings_history_id_seq OWNER TO stc_user;

--
-- Name: tb_column_warnings_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_column_warnings_history_id_seq OWNED BY public.tb_column_warnings_history.id;


--
-- Name: tb_config_hilos; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_config_hilos (
    id integer NOT NULL,
    version_nombre character varying(50) DEFAULT 'v1'::character varying NOT NULL,
    activa boolean DEFAULT true,
    titulo_ne character varying(20) NOT NULL,
    aplicacion character varying(50),
    sci_min integer NOT NULL,
    str_min numeric(4,1) NOT NULL,
    mic_min numeric(3,2) NOT NULL,
    mic_max numeric(3,2) NOT NULL,
    sf_max numeric(4,1) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.tb_config_hilos OWNER TO stc_user;

--
-- Name: tb_config_hilos_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_config_hilos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_config_hilos_id_seq OWNER TO stc_user;

--
-- Name: tb_config_hilos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_config_hilos_id_seq OWNED BY public.tb_config_hilos.id;


--
-- Name: tb_config_tolerancias; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_config_tolerancias (
    id integer NOT NULL,
    version_nombre character varying(50) NOT NULL,
    parametro character varying(20) NOT NULL,
    valor_ideal_min numeric(5,2),
    rango_tol_min numeric(5,2),
    rango_tol_max numeric(5,2),
    porcentaje_min_ideal integer DEFAULT 80 NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    limite_max_absoluto numeric(5,2),
    limite_min_absoluto numeric(5,2),
    promedio_objetivo_max numeric(5,2)
);


ALTER TABLE public.tb_config_tolerancias OWNER TO stc_user;

--
-- Name: tb_config_tolerancias_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_config_tolerancias_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_config_tolerancias_id_seq OWNER TO stc_user;

--
-- Name: tb_config_tolerancias_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_config_tolerancias_id_seq OWNED BY public.tb_config_tolerancias.id;


--
-- Name: tb_defectos; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_defectos (
    "FILIAL" text,
    "PARTIDA" text,
    "PECA" text,
    "ETIQUETA" text,
    "ARTIGO" text,
    "NM_MERC" text,
    "COD_DEF" text,
    "DESC_DEFEITO" text,
    "PONTOS" text,
    "QUALIDADE" text,
    "DATA_PROD" text
);


ALTER TABLE public.tb_defectos OWNER TO stc_user;

--
-- Name: TABLE tb_defectos; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_defectos IS 'Tabla de defectos por pieza - replicada desde SQLite';


--
-- Name: tb_est_mp; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_est_mp (
    id integer NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    "ITEM" text,
    "DESC_ITEM" text,
    "PRODUTOR" text,
    "PROCED" text,
    "NMFORN" text,
    "TAM" text,
    "PILHA" text,
    "DESTINO" text,
    "LOTE" text,
    "TP" text,
    "CLASSIF" text,
    "COR" text,
    "TP MIC" text,
    "LOTE ADIC" text,
    "NUM. DOC (NF)" text,
    "QTDE ESTOQUE" text,
    "QTDE RESERV" text,
    "SALDO DISPONIVEL" text,
    "SCI" text,
    "MST" text,
    "MIC" text,
    "MAT" text,
    "UHML" text,
    "UI" text,
    "SF" text,
    "STR" text,
    "ELG" text,
    "RD" text,
    "+b" text,
    "TIPO" text,
    "TrCNT" text,
    "TrAR" text,
    "TRID" text,
    "SAC" text,
    "PIM" text,
    "SC" text,
    "TEM SELO" text,
    "SELO" text,
    "NUM. SELO" text,
    "BENF" text,
    "OBS" text,
    "PESO" text,
    "PESO_MEDIO" text,
    "UM" text,
    "DT_ULT_MOV" text,
    "TESTE" text,
    "CORTEZA" text,
    "CONSIGNADO" text,
    "CONSIG_DISP" text,
    "PEGAJOS" text,
    "DESC PEGAJOS" text,
    "CAULE" text,
    "DESC CAULE" text,
    "FOL SECA" text,
    "DESC FOL SECA" text,
    "MAN OLEO" text,
    "DESC MAN OLEO" text,
    "ENCARN" text,
    "DESC ENCARN" text,
    "FOL VERD" text,
    "DESC FOL VERD" text,
    "CASQUIN" text,
    "DESC CASQUIN" text,
    "PO" text,
    "DESC PO" text
);


ALTER TABLE public.tb_est_mp OWNER TO stc_user;

--
-- Name: tb_est_mp_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_est_mp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_est_mp_id_seq OWNER TO stc_user;

--
-- Name: tb_est_mp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_est_mp_id_seq OWNED BY public.tb_est_mp.id;


--
-- Name: tb_fichas; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_fichas (
    "ARTIGO CODIGO" text,
    "ARTIGO" text,
    "COR" text,
    "NCM" text,
    "BASE" text,
    "UnP" text,
    "VENDA" text,
    "PRODUÇÃO" text,
    "NOME REDUZIDO" text,
    "NOME DE MERCADO" text,
    "COMPOSIÇÃO" text,
    "LARGURA cm" text,
    "g/m2" text,
    "TRAMA" text,
    "URDUME" text,
    "RENDIMENTO" text,
    "CLIENTE" text,
    "OBS" text,
    "ESTAMPARIA" text,
    "LINHA" text,
    "SARJA" text,
    "COD. RETALHO" text,
    "SAP" text,
    "TRAMA REDUZIDO" text,
    "SGS" text,
    "SGS UN 1" text,
    "DESCRIÇÃO" text,
    "BATIDAS/FIO" text,
    "NE RESULTANTE" text,
    "SAP 1" text,
    "TRAMA REDUZIDO 1" text,
    "SGS 1" text,
    "SGS UN 2" text,
    "DESCRIÇÃO 1" text,
    "BATIDAS/FIO 1" text,
    "NE RESULTANTE 1" text,
    "CONS.TR/m" text,
    "SGS 2" text,
    "QT.FIOS" text,
    "NE RESULTANTE 2" text,
    "SGS 3" text,
    "QT.FIOS 1" text,
    "NE RESULTANTE 3" text,
    "CONS.URD/m" text,
    "BATIDA" text,
    "LARG.PENTE" text,
    "LARG.CRU" text,
    "PESO/m CRU" text,
    "Oz/jd2" text,
    "Peso/m2" text,
    "LARGURA MIN" text,
    "LARGURA" text,
    "LARGURA MAX" text,
    "SKEW MIN" text,
    "SKEW MAX" text,
    "URD.MIN" text,
    "URD.MAX" text,
    "TRAMA MIN" text,
    "TRAMA MAX" text,
    "VAR STR.MIN TRAMA" text,
    "VAR STR.MAX TRAMA" text,
    "VAR STR.MIN URD" text,
    "VAR STR.MAX URD" text,
    "PONTOS" text,
    "ENC.TEC.URDUME" text,
    "ENC. TEC.TRAMA" text,
    "ENC.ACAB URD" text,
    "ENC.ACAB TRAMA" text,
    "LAV.AMAC.URD" text,
    "LAV.AMAC.TRM" text,
    "LAV STONE" text,
    "LAV STONE 1" text,
    "STRET LAV STONE" text
);


ALTER TABLE public.tb_fichas OWNER TO stc_user;

--
-- Name: tb_historico_configuraciones; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_historico_configuraciones (
    id integer NOT NULL,
    version_nombre character varying(50) NOT NULL,
    fecha_guardado timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    snapshot_json jsonb NOT NULL,
    usuario_responsable character varying(100)
);


ALTER TABLE public.tb_historico_configuraciones OWNER TO stc_user;

--
-- Name: tb_historico_configuraciones_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_historico_configuraciones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_historico_configuraciones_id_seq OWNER TO stc_user;

--
-- Name: tb_historico_configuraciones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_historico_configuraciones_id_seq OWNED BY public.tb_historico_configuraciones.id;


--
-- Name: tb_hvi_detalles; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_hvi_detalles (
    id integer NOT NULL,
    ensayo_id integer,
    fardo text,
    sci numeric,
    mst numeric,
    mic numeric,
    mat numeric,
    uhml numeric,
    ui numeric,
    sf numeric,
    str numeric,
    elg numeric,
    rd numeric,
    plus_b numeric,
    tipo text,
    tr_cnt numeric,
    tr_ar numeric,
    trid numeric
);


ALTER TABLE public.tb_hvi_detalles OWNER TO stc_user;

--
-- Name: tb_hvi_detalles_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_hvi_detalles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_hvi_detalles_id_seq OWNER TO stc_user;

--
-- Name: tb_hvi_detalles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_hvi_detalles_id_seq OWNED BY public.tb_hvi_detalles.id;


--
-- Name: tb_hvi_ensayos; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_hvi_ensayos (
    id integer NOT NULL,
    tipo text,
    lote text NOT NULL,
    proveedor text,
    grado text,
    fecha text,
    muestra text,
    archivo_fuente text,
    creado_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    cantidad integer,
    color text,
    cort integer,
    obs text
);


ALTER TABLE public.tb_hvi_ensayos OWNER TO stc_user;

--
-- Name: tb_hvi_ensayos_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_hvi_ensayos_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_hvi_ensayos_id_seq OWNER TO stc_user;

--
-- Name: tb_hvi_ensayos_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_hvi_ensayos_id_seq OWNED BY public.tb_hvi_ensayos.id;


--
-- Name: tb_import_metadata; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_import_metadata (
    table_name text NOT NULL,
    last_import_date timestamp without time zone,
    file_mtime timestamp without time zone,
    rows_imported integer,
    csv_file text,
    last_mode text,
    last_error text,
    last_duration_ms integer,
    last_skipped integer,
    last_mode_reason text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tb_import_metadata OWNER TO stc_user;

--
-- Name: tb_metas; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_metas (
    id bigint NOT NULL,
    "Dia" date NOT NULL,
    "Indigo" numeric,
    "Meta_Eficiencia_INDIGO" numeric,
    "Meta_Rotura_INDIGO" numeric,
    "Meta_Estopa_Azul" numeric,
    "Tejeduria" numeric,
    "RU105" numeric,
    "RT105" numeric,
    "EFI_Percent" numeric,
    "Meta_Estopa_Azul_Tejeduria" numeric,
    "Integrada" numeric,
    "Meta_Velocidad_Integrada" numeric,
    "Meta_ENC_URD_Integrada" numeric,
    "Revision" numeric,
    "Dia_Invertido" integer,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.tb_metas OWNER TO stc_user;

--
-- Name: tb_metas_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_metas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_metas_id_seq OWNER TO stc_user;

--
-- Name: tb_metas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_metas_id_seq OWNED BY public.tb_metas.id;


--
-- Name: tb_paradas; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_paradas (
    filial text,
    maquina text,
    tp_maq text,
    processo text,
    data_base text,
    hora_inicio text,
    hora_final text,
    turno text,
    duracao text,
    "NUM OCORREN" text,
    operador text,
    nome_oper text,
    motivo text,
    desc_motivo text,
    grupo text,
    desc_grp_motivo text,
    causa text,
    desc_causa text,
    lado text,
    posicao text,
    partida text,
    urdume text,
    indigo text,
    data_tingiment text,
    turno_ting text,
    status_indig text,
    oper_ting text,
    nome_oper_ting text,
    grupo_maq text,
    obs text,
    partida_original text,
    cv_orig text,
    st_orig text,
    obs_orig text,
    partida_anterior text,
    cv_ant text,
    st_ant text,
    obs_ant text,
    partida_posterior text,
    cv_pos text,
    st_pos text,
    obs_pos text,
    rolada text,
    "ID TROCA ROLADA" text,
    motivo1 text,
    "DESCRICAO MOTIVO" text,
    "ROLADA INICIAL" text,
    cor text,
    "ROLADA FINAL" text,
    cor1 text,
    "OBS TROCA ROLADA" text,
    "TEMPO PREVISTO" text,
    "SUB-GRUPO" text,
    "DESC SUB-GRUPO" text
);


ALTER TABLE public.tb_paradas OWNER TO stc_user;

--
-- Name: TABLE tb_paradas; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_paradas IS 'Tabla de paradas de máquinas - replicada desde SQLite';


--
-- Name: tb_parametros_hvi; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_parametros_hvi (
    id integer NOT NULL,
    codigo character varying(20) NOT NULL,
    nombre character varying(100) NOT NULL,
    descripcion text,
    unidad character varying(20),
    tipo_dato character varying(20) NOT NULL,
    decimales integer DEFAULT 2,
    optimo_min numeric(10,4),
    optimo_max numeric(10,4),
    aceptable_min numeric(10,4),
    aceptable_max numeric(10,4),
    critico_min numeric(10,4),
    critico_max numeric(10,4),
    activo boolean DEFAULT true,
    creado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    actualizado_en timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    grupo character varying(50)
);


ALTER TABLE public.tb_parametros_hvi OWNER TO stc_user;

--
-- Name: TABLE tb_parametros_hvi; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_parametros_hvi IS 'Parámetros de calidad para variables HVI con rangos óptimos, aceptables y críticos';


--
-- Name: COLUMN tb_parametros_hvi.codigo; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.codigo IS 'Código único de la variable HVI';


--
-- Name: COLUMN tb_parametros_hvi.descripcion; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.descripcion IS 'Descripción técnica detallada extraída de tooltips HVI';


--
-- Name: COLUMN tb_parametros_hvi.optimo_min; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.optimo_min IS 'Límite inferior del rango óptimo';


--
-- Name: COLUMN tb_parametros_hvi.optimo_max; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.optimo_max IS 'Límite superior del rango óptimo';


--
-- Name: COLUMN tb_parametros_hvi.aceptable_min; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.aceptable_min IS 'Límite inferior del rango aceptable';


--
-- Name: COLUMN tb_parametros_hvi.aceptable_max; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.aceptable_max IS 'Límite superior del rango aceptable';


--
-- Name: COLUMN tb_parametros_hvi.critico_min; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.critico_min IS 'Límite inferior del rango crítico';


--
-- Name: COLUMN tb_parametros_hvi.critico_max; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.critico_max IS 'Límite superior del rango crítico';


--
-- Name: COLUMN tb_parametros_hvi.grupo; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_parametros_hvi.grupo IS 'Categoría técnica de agrupación de la variable HVI';


--
-- Name: tb_parametros_hvi_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_parametros_hvi_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_parametros_hvi_id_seq OWNER TO stc_user;

--
-- Name: tb_parametros_hvi_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_parametros_hvi_id_seq OWNED BY public.tb_parametros_hvi.id;


--
-- Name: tb_proceso; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_proceso (
    "FILIAL" text,
    "PROCESSO" text,
    "PARTIDA" text,
    "ARTIGO" text,
    "COR" text,
    "DESC_NM_MERC" text,
    "MT_DISPONIV" text,
    "DT_PROD" text,
    "NUM_FIOS" text,
    "FLANGE" text,
    "LADO" text,
    "MAQUINA" text,
    "STATUS" text,
    "URDUME" text,
    "MT_PREVISTA" text,
    "MT_A_BATER" text,
    "MT_PROX24H" text,
    "BATIDAS" text,
    "RPM" text,
    "EFIC_TA" text,
    "EFIC_TB" text,
    "EFIC_TC" text,
    "EFIC_DIA" text,
    "ART_PROGR" text,
    "NM_MERC_PROG" text,
    "COR_PG" text,
    "URDUME_PRO" text,
    "GRUPO_TEAR" text,
    "REPROCESSO" text,
    "LARGURA" text,
    "TRAMA_REDUZIDA_1" text,
    "TRAMA_REDUZIDA_2" text,
    "DATA FINAL TECEL" text,
    "HORA_FINAL_TECEL" text,
    "TURNO_FINAL_TECE" text,
    "HORA_FINAL_TECEL_V2" text,
    "OBS ACABAMENTO" text,
    "COD MOT REP" text,
    "MOTIVO REPROCESSO" text,
    "OBS REPROCESSO" text
);


ALTER TABLE public.tb_proceso OWNER TO stc_user;

--
-- Name: TABLE tb_proceso; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_proceso IS 'Posición de stock en proceso (producción en curso)';


--
-- Name: tb_produccion; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_produccion (
    "FILIAL" text,
    "DT_INICIO" text,
    "HORA_INICIO" text,
    "DT_FINAL" text,
    "HORA_FINAL" text,
    "DT_BASE_PRODUCAO" text,
    "TURNO" text,
    "PARTIDA" text,
    "PARTIDA_DUPLA" text,
    "R" text,
    "ARTIGO" text,
    "COR" text,
    "METRAGEM" text,
    "METRAGEM ENCOLH" text,
    "TEMPO" text,
    "VELOC CALC" text,
    "VELOC" text,
    "EFICIENCIA" text,
    "NUM_FIOS" text,
    "S" text,
    "MAQUINA" text,
    "RUPTURAS" text,
    "CAVALOS" text,
    "OPERADOR" text,
    "NM OPERADOR" text,
    "NM MERCADO" text,
    "LARG PAD" text,
    "LARG INI" text,
    "LARG FIM" text,
    "TRAMA REDUZIDA 1" text,
    "TRAMA REDUZIDA 2" text,
    "RUP FIACAO" text,
    "RUP URD" text,
    "RUP OPER" text,
    "LOTE FIACAO" text,
    "MAQ FIACAO" text,
    "ROLADA" text,
    "SELETOR" text,
    "QTDE_RUPTURA" text,
    "COD_RUP" text,
    "MOTIVO_RUP" text,
    "TIPO_RUP" text,
    "DESC_TP_RUPTURA" text,
    "COD_CAVALO" text,
    "DESC_CAVALO" text,
    "QTDE_CAVALO" text,
    "PONTOS_LIDOS" text,
    "PONTOS_100%" text,
    "BATIDAS" text,
    "ENCOLH ACAB" text,
    "ESTIRAGEM REVISAO" text,
    "TEMPO LEIT MIN" text,
    "TOTAL MINUTOS TUR" text,
    "TOTAL MINUTOS TUR 1" text,
    "TOTAL MINUTOS TUR 2" text,
    "PARADA TEC TRAMA" text,
    "PARADA TEC URDUME" text,
    "PARADA TEC OUTROS" text,
    "PARADA TEC STOP" text,
    "BASE URDUME" text,
    "RPM LEITURA" text,
    "RPM NOMINALTEAR" text,
    "GRUPO TEAR" text,
    "DESC TEAR" text,
    "MODELO TEAR" text,
    "MAQ INDIGO" text
);


ALTER TABLE public.tb_produccion OWNER TO stc_user;

--
-- Name: tb_produccion_carda; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_produccion_carda (
    maquina text,
    lf text,
    data text,
    t text,
    hr_ini text,
    hr_fina text,
    item text,
    "DESC ITEM" text,
    titulo text,
    rpm text,
    "TEMPO TOTAL" text,
    "PROD KG/H" text,
    "PROD CALC" text,
    "PROD INFORM" text,
    "EFIC INFOR" text,
    "EFIC CALC" text,
    obs text,
    "D%" text,
    cv text,
    cvin text,
    pg text,
    "A%" text,
    "T (25%)" text,
    "T (20%)" text,
    "T (15%)" text,
    "T1 (25%)" text,
    "T1 (20%)" text,
    "T1 (15%)" text,
    "T2 (25%)" text,
    "T2 (20%)" text,
    "T2 (15%)" text
);


ALTER TABLE public.tb_produccion_carda OWNER TO stc_user;

--
-- Name: TABLE tb_produccion_carda; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_produccion_carda IS 'Tabla de producción de cardas (turno/maquina) importada desde rptProducaoCarda.csv';


--
-- Name: tb_produccion_oe; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_produccion_oe (
    filial text,
    "LOC. FISICO" text,
    maquina text,
    nome_maquina text,
    data_producao text,
    turno text,
    lado text,
    item text,
    "DESC ITEM" text,
    "HORA INICIAL" text,
    "HORA FINAL" text,
    rpm text,
    "NUM FUSOS" text,
    alfa text,
    "LOTE PRODUC" text,
    "TÍTULO" text,
    tempo text,
    "TORCAO P POLEG" text,
    "TORCAO P METRO" text,
    "PROD MT/MIN" text,
    "PROD KG/HR" text,
    "PROD CALCULADA" text,
    "PROD INFORMADA" text,
    "EFIC CALCULADA" text,
    "EFIC INFORMADA" text,
    operador text,
    "T.BOB." text,
    "RPM CARD" text,
    n text,
    s text,
    l text,
    t text,
    mo text,
    "CP V+ SL+" text,
    "CM V- SL-" text,
    "CCp C+" text,
    "CCm C-" text,
    "JP (P+)" text,
    "JM (P-)" text,
    cvp text,
    cvm text,
    "CORT NAT" text,
    "% ROB 01" text,
    "% ROB 02" text,
    "% ROB 03" text
);


ALTER TABLE public.tb_produccion_oe OWNER TO stc_user;

--
-- Name: TABLE tb_produccion_oe; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_produccion_oe IS 'Tabla de producción OE (Open End) - replicada desde SQLite';


--
-- Name: tb_residuos_indigo; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_residuos_indigo (
    "FILIAL" text,
    "SETOR" text,
    "DESC_SETOR" text,
    "DT_MOV" text,
    "TURNO" text,
    "SUBPRODUTO" text,
    "DESCRICAO" text,
    "ID" text,
    "PESO LIQUIDO (KG)" text,
    "LOTE" text,
    "PARTIDA" text,
    "ROLADA" text,
    "MOTIVO" text,
    "DESC_MOTIVO" text,
    "OPERADOR" text,
    "NOME_OPER" text,
    "PE DE ROLO" text,
    "INDIGO" text,
    "URDUME" text,
    "TURNO CORTE" text,
    "GAIOLA" text,
    "OBS" text,
    "PESO ROLO 01" text,
    "PESO ROLO 02" text,
    "PESO ROLO 03" text,
    "PESO ROLO 04" text,
    "PESO ROLO 05" text,
    "PESO ROLO 06" text,
    "PESO ROLO 07" text,
    "PESO ROLO 08" text,
    "PESO ROLO 09" text,
    "PESO ROLO 10" text,
    "PESO ROLO 11" text,
    "PESO ROLO 12" text,
    "PESO ROLO 13" text,
    "PESO ROLO 14" text,
    "PESO ROLO 15" text,
    "PESO ROLO 16" text,
    "DEVOL TEC#" text
);


ALTER TABLE public.tb_residuos_indigo OWNER TO stc_user;

--
-- Name: TABLE tb_residuos_indigo; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_residuos_indigo IS 'Residuos de índigo por sector y turno';


--
-- Name: tb_residuos_por_sector; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_residuos_por_sector (
    "FILIAL" text,
    "SETOR" text,
    "DESC_SETOR" text,
    "DT_MOV" text,
    "TURNO" text,
    "SUBPRODUTO" text,
    "DESCRICAO" text,
    "ID" text,
    "PESO LIQUIDO (KG)" text,
    "LOTE" text,
    "OPERADOR" text,
    "NOME_OPER" text,
    "OBS" text
);


ALTER TABLE public.tb_residuos_por_sector OWNER TO stc_user;

--
-- Name: tb_schema_changes_log; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_schema_changes_log (
    id bigint NOT NULL,
    table_name text NOT NULL,
    change_type text DEFAULT 'ADD_COLUMNS'::text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    columns_added text[] DEFAULT '{}'::text[] NOT NULL,
    reimported boolean DEFAULT false NOT NULL,
    success boolean DEFAULT true NOT NULL,
    error_message text
);


ALTER TABLE public.tb_schema_changes_log OWNER TO stc_user;

--
-- Name: tb_schema_changes_log_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_schema_changes_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_schema_changes_log_id_seq OWNER TO stc_user;

--
-- Name: tb_schema_changes_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_schema_changes_log_id_seq OWNED BY public.tb_schema_changes_log.id;


--
-- Name: tb_sync_history; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_sync_history (
    id integer NOT NULL,
    "timestamp" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    operation_type text NOT NULL,
    table_name text NOT NULL,
    description text,
    columns_added text[],
    columns_count integer DEFAULT 0,
    rows_affected integer DEFAULT 0,
    success boolean DEFAULT true,
    error_message text,
    execution_time_ms integer,
    user_action text
);


ALTER TABLE public.tb_sync_history OWNER TO stc_user;

--
-- Name: TABLE tb_sync_history; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_sync_history IS 'Registro de sincronizaciones de esquema e importaciones de datos';


--
-- Name: COLUMN tb_sync_history.operation_type; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_sync_history.operation_type IS 'Tipo: COLUMN_SYNC (agregar columnas), IMPORT (importación), FORCE_IMPORT (reimportación forzada)';


--
-- Name: COLUMN tb_sync_history.columns_added; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON COLUMN public.tb_sync_history.columns_added IS 'Array de nombres de columnas que fueron agregadas en la sincronización';


--
-- Name: tb_sync_history_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_sync_history_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_sync_history_id_seq OWNER TO stc_user;

--
-- Name: tb_sync_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_sync_history_id_seq OWNED BY public.tb_sync_history.id;


--
-- Name: tb_tensorapid_par; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_tensorapid_par (
    testnr text NOT NULL,
    ne_titulo numeric,
    titulo text,
    comment_text text,
    long_prueba numeric,
    time_stamp text,
    lote text,
    ne_titulo_type text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    uster_testnr text,
    catalog text,
    "time" text,
    sortiment text,
    article text,
    maschnr text,
    matclass text,
    nomcount numeric,
    nomtwist text,
    uscode text,
    laborant text,
    comment text,
    tuname text,
    groups text,
    within text,
    total text,
    unspoolgroups text,
    length text,
    extspeed text,
    pretension text,
    clamppressure text,
    cycleforcell text,
    cycleforceul text,
    nmbofforcecycles text,
    cyclelongll text,
    cyclelongul text,
    nmbofelongcycles text,
    forcef1rel text,
    elongatione1rel text,
    evaltimerel text,
    preloadcyclesrel text,
    forcef1ret text,
    elongatione1ret text,
    evaltimeret text,
    preloadcyclesret text
);


ALTER TABLE public.tb_tensorapid_par OWNER TO stc_user;

--
-- Name: tb_tensorapid_tbl; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_tensorapid_tbl (
    id integer NOT NULL,
    testnr text,
    huso_number integer,
    tiempo_rotura numeric,
    fuerza_b numeric,
    elongacion numeric,
    tenacidad numeric,
    trabajo numeric,
    huso_ensayos text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


ALTER TABLE public.tb_tensorapid_tbl OWNER TO stc_user;

--
-- Name: tb_tensorapid_tbl_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_tensorapid_tbl_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_tensorapid_tbl_id_seq OWNER TO stc_user;

--
-- Name: tb_tensorapid_tbl_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_tensorapid_tbl_id_seq OWNED BY public.tb_tensorapid_tbl.id;


--
-- Name: tb_testes; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_testes (
    maquina text,
    artigo text,
    nm_merc text,
    partida text,
    metragem text,
    dt_prod text,
    hora_prod text,
    turno text,
    larg_al text,
    gramat text,
    poten text,
    "%_ENC_URD" text,
    "%_ENC_TRAMA" text,
    "%_SK1" text,
    "%_SK2" text,
    "%_SK3" text,
    "%_SK4" text,
    "%_SKE" text,
    "%_STT" text,
    "%_SKM" text,
    aprov text,
    cod_art text,
    cor_art text,
    obs text,
    reprocesso text,
    "SEQ TESTE" text
);


ALTER TABLE public.tb_testes OWNER TO stc_user;

--
-- Name: TABLE tb_testes; Type: COMMENT; Schema: public; Owner: stc_user
--

COMMENT ON TABLE public.tb_testes IS 'Tabla de testes físicos - replicada desde SQLite';


--
-- Name: tb_uster_carda_par; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_uster_carda_par (
    testnr text NOT NULL,
    source_prefix text NOT NULL,
    catalog text,
    sortiment text,
    style text,
    machine_family text,
    nomcount numeric,
    maschnr text,
    lote text,
    laborant text,
    time_stamp text,
    matclass text,
    obs text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tb_uster_carda_par OWNER TO stc_user;

--
-- Name: tb_uster_carda_tbl; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_uster_carda_tbl (
    id bigint NOT NULL,
    testnr text NOT NULL,
    seqno integer NOT NULL,
    no_ numeric,
    u_percent numeric,
    cvm_percent numeric,
    cvm_1m_percent numeric,
    cvm_3m_percent numeric,
    cvm_10m_percent numeric,
    titulo_machine numeric,
    titulo_rel_perc numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    source_prefix text NOT NULL
);


ALTER TABLE public.tb_uster_carda_tbl OWNER TO stc_user;

--
-- Name: tb_uster_carda_tbl_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_uster_carda_tbl_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_uster_carda_tbl_id_seq OWNER TO stc_user;

--
-- Name: tb_uster_carda_tbl_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_uster_carda_tbl_id_seq OWNED BY public.tb_uster_carda_tbl.id;


--
-- Name: tb_uster_carda_titulo_tbl; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_uster_carda_titulo_tbl (
    id bigint NOT NULL,
    testnr text NOT NULL,
    source_prefix text NOT NULL,
    repno integer NOT NULL,
    titulo numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.tb_uster_carda_titulo_tbl OWNER TO stc_user;

--
-- Name: tb_uster_carda_titulo_tbl_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_uster_carda_titulo_tbl_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_uster_carda_titulo_tbl_id_seq OWNER TO stc_user;

--
-- Name: tb_uster_carda_titulo_tbl_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_uster_carda_titulo_tbl_id_seq OWNED BY public.tb_uster_carda_titulo_tbl.id;


--
-- Name: tb_uster_par; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_uster_par (
    testnr text NOT NULL,
    nomcount text,
    maschnr text,
    lote text,
    laborant text,
    time_stamp text,
    matclass text,
    estiraje text,
    pasador text,
    obs text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tb_uster_par OWNER TO stc_user;

--
-- Name: tb_uster_tbl; Type: TABLE; Schema: public; Owner: stc_user
--

CREATE TABLE public.tb_uster_tbl (
    id bigint NOT NULL,
    testnr text NOT NULL,
    seqno integer,
    no_ text,
    u_percent numeric,
    cvm_percent numeric,
    indice_percent numeric,
    cvm_1m_percent numeric,
    cvm_3m_percent numeric,
    cvm_10m_percent numeric,
    titulo numeric,
    titulo_rel_perc numeric,
    h numeric,
    sh numeric,
    sh_1m numeric,
    sh_3m numeric,
    sh_10m numeric,
    delg_minus30_km numeric,
    delg_minus40_km numeric,
    delg_minus50_km numeric,
    delg_minus60_km numeric,
    grue_35_km numeric,
    grue_50_km numeric,
    grue_70_km numeric,
    grue_100_km numeric,
    neps_140_km numeric,
    neps_200_km numeric,
    neps_280_km numeric,
    neps_400_km numeric,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tb_uster_tbl OWNER TO stc_user;

--
-- Name: tb_uster_tbl_id_seq; Type: SEQUENCE; Schema: public; Owner: stc_user
--

CREATE SEQUENCE public.tb_uster_tbl_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tb_uster_tbl_id_seq OWNER TO stc_user;

--
-- Name: tb_uster_tbl_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: stc_user
--

ALTER SEQUENCE public.tb_uster_tbl_id_seq OWNED BY public.tb_uster_tbl.id;


--
-- Name: v_recent_syncs; Type: VIEW; Schema: public; Owner: stc_user
--

CREATE VIEW public.v_recent_syncs AS
 SELECT id,
    "timestamp",
    operation_type,
    table_name,
    description,
    columns_count,
    rows_affected,
    success,
    execution_time_ms
   FROM public.tb_sync_history
  ORDER BY "timestamp" DESC
 LIMIT 100;


ALTER VIEW public.v_recent_syncs OWNER TO stc_user;

--
-- Name: view_golden_batch_data; Type: VIEW; Schema: public; Owner: stc_user
--

CREATE VIEW public.view_golden_batch_data AS
 WITH paradas_exogenas AS (
         SELECT
                CASE
                    WHEN (tb_paradas.data_base ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}$'::text) THEN to_date(tb_paradas.data_base, 'DD/MM/YY'::text)
                    WHEN (tb_paradas.data_base ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'::text) THEN to_date(tb_paradas.data_base, 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END AS fecha_parada,
            tb_paradas.maquina AS maquina_parada,
            tb_paradas.turno AS turno_parada,
            sum(
                CASE
                    WHEN (tb_paradas.duracao ~ '^[0-9]+$'::text) THEN (tb_paradas.duracao)::numeric
                    ELSE (0)::numeric
                END) AS minutos_descuento
           FROM public.tb_paradas
          WHERE ((tb_paradas.motivo = ANY (ARRAY['401'::text, '352'::text, '301'::text, '202'::text])) AND (tb_paradas.processo = 'TEARES'::text))
          GROUP BY
                CASE
                    WHEN (tb_paradas.data_base ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}$'::text) THEN to_date(tb_paradas.data_base, 'DD/MM/YY'::text)
                    WHEN (tb_paradas.data_base ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'::text) THEN to_date(tb_paradas.data_base, 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END, tb_paradas.maquina, tb_paradas.turno
        ), produccion_ajustada AS (
         SELECT p."ROLADA",
            p."MAQUINA",
            p."DT_BASE_PRODUCAO",
            p."TURNO",
            p."ARTIGO",
            COALESCE(
                CASE
                    WHEN (p."PONTOS_LIDOS" ~ '^[0-9.,]+$'::text) THEN (replace(replace(p."PONTOS_LIDOS", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE (0)::numeric
                END, (0)::numeric) AS ptos_real,
            COALESCE(
                CASE
                    WHEN (p."PONTOS_100%" ~ '^[0-9.,]+$'::text) THEN (replace(replace(p."PONTOS_100%", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE (0)::numeric
                END, (0)::numeric) AS ptos_teorico,
            COALESCE(
                CASE
                    WHEN (p."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(p."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE (0)::numeric
                END, (0)::numeric) AS metros_real,
            COALESCE(
                CASE
                    WHEN (p."PARADA TEC URDUME" ~ '^[0-9.,]+$'::text) THEN (replace(replace(p."PARADA TEC URDUME", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE (0)::numeric
                END, (0)::numeric) AS paradas_urd,
            COALESCE(
                CASE
                    WHEN (p."PARADA TEC TRAMA" ~ '^[0-9.,]+$'::text) THEN (replace(replace(p."PARADA TEC TRAMA", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE (0)::numeric
                END, (0)::numeric) AS paradas_trama,
            COALESCE(
                CASE
                    WHEN (p."TOTAL MINUTOS TUR" ~ '^[0-9]+$'::text) THEN (p."TOTAL MINUTOS TUR")::numeric
                    ELSE (480)::numeric
                END, (480)::numeric) AS minutos_turno_total,
            COALESCE(pe.minutos_descuento, (0)::numeric) AS minutos_descuento
           FROM (public.tb_produccion p
             LEFT JOIN paradas_exogenas pe ON (((
                CASE
                    WHEN (p."DT_BASE_PRODUCAO" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}$'::text) THEN to_date(p."DT_BASE_PRODUCAO", 'DD/MM/YY'::text)
                    WHEN (p."DT_BASE_PRODUCAO" ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'::text) THEN to_date(p."DT_BASE_PRODUCAO", 'DD/MM/YYYY'::text)
                    ELSE NULL::date
                END = pe.fecha_parada) AND (p."MAQUINA" = pe.maquina_parada) AND (p."TURNO" = pe.turno_parada))))
          WHERE ((p."SELETOR" = 'TECELAGEM'::text) AND (p."FILIAL" = '05'::text))
        ), tejidos_agregado AS (
         SELECT produccion_ajustada."ROLADA",
                CASE
                    WHEN (max(produccion_ajustada."DT_BASE_PRODUCAO") ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'::text) THEN to_date(max(produccion_ajustada."DT_BASE_PRODUCAO"), 'DD/MM/YYYY'::text)
                    WHEN (max(produccion_ajustada."DT_BASE_PRODUCAO") ~ '^[0-9]{2}/[0-9]{2}/[0-9]{2}$'::text) THEN to_date(max(produccion_ajustada."DT_BASE_PRODUCAO"), 'DD/MM/YY'::text)
                    ELSE NULL::date
                END AS "DATA",
            max(produccion_ajustada."TURNO") AS "TURNO",
            max(produccion_ajustada."ARTIGO") AS "ARTICULO",
            sum(produccion_ajustada.metros_real) AS "TEJIDO_REAL_M",
                CASE
                    WHEN (sum(
                    CASE
                        WHEN (produccion_ajustada.minutos_descuento >= produccion_ajustada.minutos_turno_total) THEN (0)::numeric
                        ELSE (produccion_ajustada.ptos_teorico * ((produccion_ajustada.minutos_turno_total - produccion_ajustada.minutos_descuento) / NULLIF(produccion_ajustada.minutos_turno_total, (0)::numeric)))
                    END) = (0)::numeric) THEN (0)::numeric
                    ELSE ((sum(produccion_ajustada.ptos_real) / sum(
                    CASE
                        WHEN (produccion_ajustada.minutos_descuento >= produccion_ajustada.minutos_turno_total) THEN (0)::numeric
                        ELSE (produccion_ajustada.ptos_teorico * ((produccion_ajustada.minutos_turno_total - produccion_ajustada.minutos_descuento) / NULLIF(produccion_ajustada.minutos_turno_total, (0)::numeric)))
                    END)) * (100)::numeric)
                END AS efic_tej,
                CASE
                    WHEN (sum(produccion_ajustada.metros_real) = (0)::numeric) THEN (0)::numeric
                    ELSE ((sum(produccion_ajustada.paradas_urd) * 100000.0) / (sum(produccion_ajustada.metros_real) * 1000.0))
                END AS ru_105,
                CASE
                    WHEN (sum(produccion_ajustada.metros_real) = (0)::numeric) THEN (0)::numeric
                    ELSE ((sum(produccion_ajustada.paradas_trama) * 100000.0) / (sum(produccion_ajustada.metros_real) * 1000.0))
                END AS rt_105
           FROM produccion_ajustada
          WHERE ((produccion_ajustada.metros_real > (0)::numeric) OR (produccion_ajustada.ptos_real > (0)::numeric) OR (produccion_ajustada.minutos_descuento > (0)::numeric))
          GROUP BY produccion_ajustada."ROLADA"
        ), urdimbres_lote AS (
         SELECT tb_produccion."ROLADA",
            max((NULLIF(regexp_replace(tb_produccion."LOTE FIACAO", '[^0-9]'::text, ''::text, 'g'::text), ''::text))::bigint) AS lote_id,
                CASE
                    WHEN ((sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) = (0)::numeric) OR (max(
                    CASE
                        WHEN (tb_produccion."NUM_FIOS" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."NUM_FIOS", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) = (0)::numeric)) THEN (0)::numeric
                    ELSE ((sum(
                    CASE
                        WHEN (tb_produccion."RUPTURAS" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."RUPTURAS", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) * 1000000.0) / (sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) * max(
                    CASE
                        WHEN (tb_produccion."NUM_FIOS" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."NUM_FIOS", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (1)::numeric
                    END)))
                END AS rot_urd_urdidora
           FROM public.tb_produccion
          WHERE ((tb_produccion."SELETOR" = ANY (ARRAY['URDIDEIRA'::text, 'URDIDORA'::text])) AND (tb_produccion."LOTE FIACAO" IS NOT NULL))
          GROUP BY tb_produccion."ROLADA"
        ), indigo_info AS (
         SELECT tb_produccion."ROLADA",
            min(
                CASE
                    WHEN (tb_produccion."DT_INICIO" ~ '^[0-3][0-9]/[0-1][0-9]/[0-9]{4}'::text) THEN to_date(SUBSTRING(tb_produccion."DT_INICIO" FROM 1 FOR 10), 'DD/MM/YYYY'::text)
                    WHEN (tb_produccion."DT_INICIO" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'::text) THEN (SUBSTRING(tb_produccion."DT_INICIO" FROM 1 FOR 10))::date
                    ELSE NULL::date
                END) AS "INDIGO_FECHA",
            max(tb_produccion."BASE URDUME") AS "INDIGO_BASE",
            max(tb_produccion."COR") AS "INDIGO_COLOR",
                CASE
                    WHEN (sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) = (0)::numeric) THEN NULL::numeric
                    ELSE round(((sum(
                    CASE
                        WHEN (tb_produccion."RUPTURAS" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."RUPTURAS", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) * 1000.0) / NULLIF(sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END), (0)::numeric)), 2)
                END AS "INDIGO_R",
                CASE
                    WHEN (sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) = (0)::numeric) THEN NULL::numeric
                    ELSE round(((sum(
                    CASE
                        WHEN (tb_produccion."CAVALOS" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."CAVALOS", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) * 100000.0) / NULLIF(sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END), (0)::numeric)), 2)
                END AS "INDIGO_CAVALOS",
            max(
                CASE
                    WHEN (tb_produccion."VELOC" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."VELOC", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS "INDIGO_VEL_NOM",
                CASE
                    WHEN (sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END) = (0)::numeric) THEN NULL::numeric
                    ELSE round((sum((
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END * COALESCE(
                    CASE
                        WHEN (tb_produccion."VELOC" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."VELOC", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE NULL::numeric
                    END, (0)::numeric))) / NULLIF(sum(
                    CASE
                        WHEN (tb_produccion."METRAGEM" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_produccion."METRAGEM", '.'::text, ''::text), ','::text, '.'::text))::numeric
                        ELSE (0)::numeric
                    END), (0)::numeric)), 2)
                END AS "INDIGO_VEL_REAL"
           FROM public.tb_produccion
          WHERE (tb_produccion."SELETOR" = 'INDIGO'::text)
          GROUP BY tb_produccion."ROLADA"
        ), fibra_agregada AS (
         SELECT (NULLIF(regexp_replace(tb_calidad_fibra."LOTE_FIAC", '[^0-9]'::text, ''::text, 'g'::text), ''::text))::bigint AS lote_id,
            max(tb_calidad_fibra."LOTE_FIAC") AS "LOTE_FIBRA_TEXT",
            max(tb_calidad_fibra."MISTURA") AS "MISTURA",
            avg(
                CASE
                    WHEN (tb_calidad_fibra."SCI" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."SCI", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS sci,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."MST" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."MST", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS mst,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."MIC" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."MIC", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS mic,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."MAT" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."MAT", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS mat,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."UHML" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."UHML", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS uhml,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."UI" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."UI", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS ui,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."SF" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."SF", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS sf,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."STR" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."STR", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS str,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."ELG" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."ELG", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS elg,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."RD" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."RD", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS rd,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."PLUS_B" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."PLUS_B", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS plus_b,
            avg(
                CASE
                    WHEN (tb_calidad_fibra."TrCNT" ~ '^[0-9.,]+$'::text) THEN (replace(replace(tb_calidad_fibra."TrCNT", '.'::text, ''::text), ','::text, '.'::text))::numeric
                    ELSE NULL::numeric
                END) AS trcnt
           FROM public.tb_calidad_fibra
          WHERE (tb_calidad_fibra."SCI" IS NOT NULL)
          GROUP BY (NULLIF(regexp_replace(tb_calidad_fibra."LOTE_FIAC", '[^0-9]'::text, ''::text, 'g'::text), ''::text))::bigint
        )
 SELECT t."ROLADA",
    t."DATA",
    t."TURNO",
    t."ARTICULO",
    t."TEJIDO_REAL_M",
    t.efic_tej AS "EFIC_TEJ",
    t.ru_105 AS "RU_105",
    t.rt_105 AS "RT_105",
    t.ru_105 AS "RUB_105",
    u.rot_urd_urdidora AS "ROT_URD_URDI",
    i."INDIGO_FECHA",
    i."INDIGO_BASE",
    i."INDIGO_COLOR",
    i."INDIGO_R",
    i."INDIGO_CAVALOS",
    i."INDIGO_VEL_NOM",
    i."INDIGO_VEL_REAL",
    f."LOTE_FIBRA_TEXT",
    f."MISTURA",
    f.sci AS "SCI",
    f.str AS "STR",
    f.mic AS "MIC",
    f.mst,
    f.mat,
    f.uhml,
    f.ui,
    f.sf,
    f.elg,
    f.trcnt
   FROM (((tejidos_agregado t
     JOIN urdimbres_lote u ON ((t."ROLADA" = u."ROLADA")))
     LEFT JOIN indigo_info i ON ((t."ROLADA" = i."ROLADA")))
     JOIN fibra_agregada f ON ((u.lote_id = f.lote_id)));


ALTER VIEW public.view_golden_batch_data OWNER TO stc_user;

--
-- Name: calidad id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.calidad ALTER COLUMN id SET DEFAULT nextval('public.calidad_id_seq'::regclass);


--
-- Name: import_control id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.import_control ALTER COLUMN id SET DEFAULT nextval('public.import_control_id_seq'::regclass);


--
-- Name: produccion id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.produccion ALTER COLUMN id SET DEFAULT nextval('public.produccion_id_seq'::regclass);


--
-- Name: residuos_indigo id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.residuos_indigo ALTER COLUMN id SET DEFAULT nextval('public.residuos_indigo_id_seq'::regclass);


--
-- Name: tb_column_warnings_history id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_column_warnings_history ALTER COLUMN id SET DEFAULT nextval('public.tb_column_warnings_history_id_seq'::regclass);


--
-- Name: tb_config_hilos id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_config_hilos ALTER COLUMN id SET DEFAULT nextval('public.tb_config_hilos_id_seq'::regclass);


--
-- Name: tb_config_tolerancias id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_config_tolerancias ALTER COLUMN id SET DEFAULT nextval('public.tb_config_tolerancias_id_seq'::regclass);


--
-- Name: tb_est_mp id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_est_mp ALTER COLUMN id SET DEFAULT nextval('public.tb_est_mp_id_seq'::regclass);


--
-- Name: tb_historico_configuraciones id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_historico_configuraciones ALTER COLUMN id SET DEFAULT nextval('public.tb_historico_configuraciones_id_seq'::regclass);


--
-- Name: tb_hvi_detalles id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_hvi_detalles ALTER COLUMN id SET DEFAULT nextval('public.tb_hvi_detalles_id_seq'::regclass);


--
-- Name: tb_hvi_ensayos id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_hvi_ensayos ALTER COLUMN id SET DEFAULT nextval('public.tb_hvi_ensayos_id_seq'::regclass);


--
-- Name: tb_metas id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_metas ALTER COLUMN id SET DEFAULT nextval('public.tb_metas_id_seq'::regclass);


--
-- Name: tb_parametros_hvi id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_parametros_hvi ALTER COLUMN id SET DEFAULT nextval('public.tb_parametros_hvi_id_seq'::regclass);


--
-- Name: tb_schema_changes_log id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_schema_changes_log ALTER COLUMN id SET DEFAULT nextval('public.tb_schema_changes_log_id_seq'::regclass);


--
-- Name: tb_sync_history id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_sync_history ALTER COLUMN id SET DEFAULT nextval('public.tb_sync_history_id_seq'::regclass);


--
-- Name: tb_tensorapid_tbl id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_tensorapid_tbl ALTER COLUMN id SET DEFAULT nextval('public.tb_tensorapid_tbl_id_seq'::regclass);


--
-- Name: tb_uster_carda_tbl id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_tbl ALTER COLUMN id SET DEFAULT nextval('public.tb_uster_carda_tbl_id_seq'::regclass);


--
-- Name: tb_uster_carda_titulo_tbl id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_titulo_tbl ALTER COLUMN id SET DEFAULT nextval('public.tb_uster_carda_titulo_tbl_id_seq'::regclass);


--
-- Name: tb_uster_tbl id; Type: DEFAULT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_tbl ALTER COLUMN id SET DEFAULT nextval('public.tb_uster_tbl_id_seq'::regclass);


--
-- Name: calidad calidad_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.calidad
    ADD CONSTRAINT calidad_pkey PRIMARY KEY (id);


--
-- Name: import_control import_control_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.import_control
    ADD CONSTRAINT import_control_pkey PRIMARY KEY (id);


--
-- Name: import_control import_control_tabla_destino_key; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.import_control
    ADD CONSTRAINT import_control_tabla_destino_key UNIQUE (tabla_destino);


--
-- Name: produccion produccion_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.produccion
    ADD CONSTRAINT produccion_pkey PRIMARY KEY (id);


--
-- Name: residuos_indigo residuos_indigo_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.residuos_indigo
    ADD CONSTRAINT residuos_indigo_pkey PRIMARY KEY (id);


--
-- Name: tb_column_warnings_history tb_column_warnings_history_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_column_warnings_history
    ADD CONSTRAINT tb_column_warnings_history_pkey PRIMARY KEY (id);


--
-- Name: tb_config_hilos tb_config_hilos_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_config_hilos
    ADD CONSTRAINT tb_config_hilos_pkey PRIMARY KEY (id);


--
-- Name: tb_config_tolerancias tb_config_tolerancias_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_config_tolerancias
    ADD CONSTRAINT tb_config_tolerancias_pkey PRIMARY KEY (id);


--
-- Name: tb_est_mp tb_est_mp_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_est_mp
    ADD CONSTRAINT tb_est_mp_pkey PRIMARY KEY (id);


--
-- Name: tb_historico_configuraciones tb_historico_configuraciones_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_historico_configuraciones
    ADD CONSTRAINT tb_historico_configuraciones_pkey PRIMARY KEY (id);


--
-- Name: tb_hvi_detalles tb_hvi_detalles_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_hvi_detalles
    ADD CONSTRAINT tb_hvi_detalles_pkey PRIMARY KEY (id);


--
-- Name: tb_hvi_ensayos tb_hvi_ensayos_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_hvi_ensayos
    ADD CONSTRAINT tb_hvi_ensayos_pkey PRIMARY KEY (id);


--
-- Name: tb_import_metadata tb_import_metadata_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_import_metadata
    ADD CONSTRAINT tb_import_metadata_pkey PRIMARY KEY (table_name);


--
-- Name: tb_metas tb_metas_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_metas
    ADD CONSTRAINT tb_metas_pkey PRIMARY KEY (id);


--
-- Name: tb_parametros_hvi tb_parametros_hvi_codigo_key; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_parametros_hvi
    ADD CONSTRAINT tb_parametros_hvi_codigo_key UNIQUE (codigo);


--
-- Name: tb_parametros_hvi tb_parametros_hvi_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_parametros_hvi
    ADD CONSTRAINT tb_parametros_hvi_pkey PRIMARY KEY (id);


--
-- Name: tb_schema_changes_log tb_schema_changes_log_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_schema_changes_log
    ADD CONSTRAINT tb_schema_changes_log_pkey PRIMARY KEY (id);


--
-- Name: tb_sync_history tb_sync_history_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_sync_history
    ADD CONSTRAINT tb_sync_history_pkey PRIMARY KEY (id);


--
-- Name: tb_tensorapid_par tb_tensorapid_par_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_tensorapid_par
    ADD CONSTRAINT tb_tensorapid_par_pkey PRIMARY KEY (testnr);


--
-- Name: tb_tensorapid_tbl tb_tensorapid_tbl_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_tensorapid_tbl
    ADD CONSTRAINT tb_tensorapid_tbl_pkey PRIMARY KEY (id);


--
-- Name: tb_uster_carda_par tb_uster_carda_par_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_par
    ADD CONSTRAINT tb_uster_carda_par_pkey PRIMARY KEY (testnr, source_prefix);


--
-- Name: tb_uster_carda_tbl tb_uster_carda_tbl_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_tbl
    ADD CONSTRAINT tb_uster_carda_tbl_pkey PRIMARY KEY (id);


--
-- Name: tb_uster_carda_tbl tb_uster_carda_tbl_testnr_source_prefix_seqno_key; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_tbl
    ADD CONSTRAINT tb_uster_carda_tbl_testnr_source_prefix_seqno_key UNIQUE (testnr, source_prefix, seqno);


--
-- Name: tb_uster_carda_titulo_tbl tb_uster_carda_titulo_tbl_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_titulo_tbl
    ADD CONSTRAINT tb_uster_carda_titulo_tbl_pkey PRIMARY KEY (id);


--
-- Name: tb_uster_carda_titulo_tbl tb_uster_carda_titulo_tbl_testnr_source_prefix_repno_key; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_titulo_tbl
    ADD CONSTRAINT tb_uster_carda_titulo_tbl_testnr_source_prefix_repno_key UNIQUE (testnr, source_prefix, repno);


--
-- Name: tb_uster_par tb_uster_par_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_par
    ADD CONSTRAINT tb_uster_par_pkey PRIMARY KEY (testnr);


--
-- Name: tb_uster_tbl tb_uster_tbl_pkey; Type: CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_tbl
    ADD CONSTRAINT tb_uster_tbl_pkey PRIMARY KEY (id);


--
-- Name: idx_calidad_artigo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_artigo ON public.tb_calidad USING btree ("ARTIGO");


--
-- Name: idx_calidad_combined; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_combined ON public.calidad USING btree (fecha_produccion, filial);


--
-- Name: idx_calidad_dat_prod; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_dat_prod ON public.tb_calidad USING btree ("DAT_PROD");


--
-- Name: idx_calidad_etiqueta; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_etiqueta ON public.tb_calidad USING btree ("ETIQUETA");


--
-- Name: idx_calidad_fecha; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_fecha ON public.calidad USING btree (fecha_produccion DESC);


--
-- Name: idx_calidad_fibra_data; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_fibra_data ON public.tb_calidad_fibra USING btree ("DATA_MOVIMENTO");


--
-- Name: idx_calidad_fibra_fornecedor; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_fibra_fornecedor ON public.tb_calidad_fibra USING btree ("FORNECEDOR");


--
-- Name: idx_calidad_fibra_item; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_fibra_item ON public.tb_calidad_fibra USING btree ("ITEM");


--
-- Name: idx_calidad_fibra_lote; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_fibra_lote ON public.tb_calidad_fibra USING btree ("LOTE");


--
-- Name: idx_calidad_fibra_produtor; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_fibra_produtor ON public.tb_calidad_fibra USING btree ("PRODUTOR");


--
-- Name: idx_calidad_fibra_tipo_mov; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_fibra_tipo_mov ON public.tb_calidad_fibra USING btree ("TIPO_MOV");


--
-- Name: idx_calidad_partida; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_partida ON public.calidad USING btree (partida);


--
-- Name: idx_calidad_revisor; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_revisor ON public.calidad USING btree (revisor);


--
-- Name: idx_calidad_rolada; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_calidad_rolada ON public.calidad USING btree (rolada);


--
-- Name: idx_defectos_artigo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_defectos_artigo ON public.tb_defectos USING btree ("ARTIGO");


--
-- Name: idx_defectos_cod_def; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_defectos_cod_def ON public.tb_defectos USING btree ("COD_DEF");


--
-- Name: idx_defectos_data_prod; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_defectos_data_prod ON public.tb_defectos USING btree ("DATA_PROD");


--
-- Name: idx_defectos_etiqueta; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_defectos_etiqueta ON public.tb_defectos USING btree ("ETIQUETA");


--
-- Name: idx_defectos_partida; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_defectos_partida ON public.tb_defectos USING btree ("PARTIDA");


--
-- Name: idx_defectos_qualidade; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_defectos_qualidade ON public.tb_defectos USING btree ("QUALIDADE");


--
-- Name: idx_fichas_artigo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_fichas_artigo ON public.tb_fichas USING btree ("ARTIGO");


--
-- Name: idx_hvi_detalles_ensayo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_hvi_detalles_ensayo ON public.tb_hvi_detalles USING btree (ensayo_id);


--
-- Name: idx_hvi_ensayos_lote; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_hvi_ensayos_lote ON public.tb_hvi_ensayos USING btree (lote);


--
-- Name: idx_import_control_estado; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_import_control_estado ON public.import_control USING btree (estado);


--
-- Name: idx_import_control_tabla; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_import_control_tabla ON public.import_control USING btree (tabla_destino);


--
-- Name: idx_paradas_data; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_paradas_data ON public.tb_paradas USING btree (data_base);


--
-- Name: idx_paradas_data_base; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_paradas_data_base ON public.tb_paradas USING btree (data_base);


--
-- Name: idx_paradas_filial; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_paradas_filial ON public.tb_paradas USING btree (filial);


--
-- Name: idx_paradas_maquina; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_paradas_maquina ON public.tb_paradas USING btree (maquina);


--
-- Name: idx_paradas_motivo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_paradas_motivo ON public.tb_paradas USING btree (motivo);


--
-- Name: idx_paradas_partida; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_paradas_partida ON public.tb_paradas USING btree (partida);


--
-- Name: idx_paradas_turno; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_paradas_turno ON public.tb_paradas USING btree (turno);


--
-- Name: idx_parametros_hvi_codigo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_parametros_hvi_codigo ON public.tb_parametros_hvi USING btree (codigo);


--
-- Name: idx_proceso_artigo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_proceso_artigo ON public.tb_proceso USING btree ("ARTIGO");


--
-- Name: idx_proceso_dt_prod; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_proceso_dt_prod ON public.tb_proceso USING btree ("DT_PROD");


--
-- Name: idx_proceso_filial; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_proceso_filial ON public.tb_proceso USING btree ("FILIAL");


--
-- Name: idx_proceso_maquina; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_proceso_maquina ON public.tb_proceso USING btree ("MAQUINA");


--
-- Name: idx_proceso_partida; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_proceso_partida ON public.tb_proceso USING btree ("PARTIDA");


--
-- Name: idx_proceso_status; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_proceso_status ON public.tb_proceso USING btree ("STATUS");


--
-- Name: idx_produccion_artigo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_artigo ON public.produccion USING btree (artigo);


--
-- Name: idx_produccion_carda_data; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_carda_data ON public.tb_produccion_carda USING btree (data);


--
-- Name: idx_produccion_carda_item; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_carda_item ON public.tb_produccion_carda USING btree (item);


--
-- Name: idx_produccion_carda_maquina; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_carda_maquina ON public.tb_produccion_carda USING btree (maquina);


--
-- Name: idx_produccion_carda_turno; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_carda_turno ON public.tb_produccion_carda USING btree (t);


--
-- Name: idx_produccion_combined; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_combined ON public.produccion USING btree (fecha_produccion, filial, maquina);


--
-- Name: idx_produccion_dt_base; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_dt_base ON public.tb_produccion USING btree ("DT_BASE_PRODUCAO");


--
-- Name: idx_produccion_dt_inicio; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_dt_inicio ON public.tb_produccion USING btree ("DT_INICIO");


--
-- Name: idx_produccion_fecha; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_fecha ON public.produccion USING btree (fecha_produccion DESC);


--
-- Name: idx_produccion_filial; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_filial ON public.produccion USING btree (filial);


--
-- Name: idx_produccion_maquina; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_maquina ON public.produccion USING btree (maquina);


--
-- Name: idx_produccion_oe_data_producao; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_oe_data_producao ON public.tb_produccion_oe USING btree (data_producao);


--
-- Name: idx_produccion_oe_fecha; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_oe_fecha ON public.tb_produccion_oe USING btree (data_producao);


--
-- Name: idx_produccion_oe_filial; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_oe_filial ON public.tb_produccion_oe USING btree (filial);


--
-- Name: idx_produccion_oe_item; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_oe_item ON public.tb_produccion_oe USING btree (item);


--
-- Name: idx_produccion_oe_maquina; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_oe_maquina ON public.tb_produccion_oe USING btree (maquina);


--
-- Name: idx_produccion_oe_operador; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_oe_operador ON public.tb_produccion_oe USING btree (operador);


--
-- Name: idx_produccion_oe_turno; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_oe_turno ON public.tb_produccion_oe USING btree (turno);


--
-- Name: idx_produccion_partida; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_produccion_partida ON public.produccion USING btree (partida);


--
-- Name: idx_residuos_indigo_descricao; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_residuos_indigo_descricao ON public.tb_residuos_indigo USING btree ("DESCRICAO");


--
-- Name: idx_residuos_indigo_dt_mov; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_residuos_indigo_dt_mov ON public.tb_residuos_indigo USING btree ("DT_MOV");


--
-- Name: idx_residuos_indigo_fecha; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_residuos_indigo_fecha ON public.residuos_indigo USING btree (fecha DESC);


--
-- Name: idx_residuos_indigo_filial; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_residuos_indigo_filial ON public.residuos_indigo USING btree (filial);


--
-- Name: idx_residuos_indigo_setor; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_residuos_indigo_setor ON public.tb_residuos_indigo USING btree ("SETOR");


--
-- Name: idx_residuos_indigo_turno; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_residuos_indigo_turno ON public.tb_residuos_indigo USING btree ("TURNO");


--
-- Name: idx_sync_history_operation; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_sync_history_operation ON public.tb_sync_history USING btree (operation_type);


--
-- Name: idx_sync_history_table; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_sync_history_table ON public.tb_sync_history USING btree (table_name);


--
-- Name: idx_sync_history_timestamp; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_sync_history_timestamp ON public.tb_sync_history USING btree ("timestamp" DESC);


--
-- Name: idx_tb_calidad_emp_datprod; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_calidad_emp_datprod ON public.tb_calidad USING btree ("EMP", "DAT_PROD");


--
-- Name: idx_tb_calidad_emp_datprod_revisor; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_calidad_emp_datprod_revisor ON public.tb_calidad USING btree ("EMP", "DAT_PROD", "REVISOR FINAL");


--
-- Name: idx_tb_calidad_emp_partida_revisor_datprod; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_calidad_emp_partida_revisor_datprod ON public.tb_calidad USING btree ("EMP", "PARTIDA", "REVISOR FINAL", "DAT_PROD");


--
-- Name: idx_tb_column_warnings_history_detected_at; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_column_warnings_history_detected_at ON public.tb_column_warnings_history USING btree (detected_at DESC);


--
-- Name: idx_tb_column_warnings_history_table; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_column_warnings_history_table ON public.tb_column_warnings_history USING btree (table_name);


--
-- Name: idx_tb_defectos_etiqueta_trim; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_defectos_etiqueta_trim ON public.tb_defectos USING btree (btrim("ETIQUETA"));


--
-- Name: idx_tb_metas_dia_unique; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE UNIQUE INDEX idx_tb_metas_dia_unique ON public.tb_metas USING btree ("Dia");


--
-- Name: idx_tb_produccion_partida_tecelagem; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_produccion_partida_tecelagem ON public.tb_produccion USING btree ("PARTIDA") WHERE (("FILIAL" = '05'::text) AND ("SELETOR" = 'TECELAGEM'::text));


--
-- Name: idx_tb_schema_changes_log_applied_at; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tb_schema_changes_log_applied_at ON public.tb_schema_changes_log USING btree (applied_at DESC);


--
-- Name: idx_tensorapid_tbl_testnr; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_tensorapid_tbl_testnr ON public.tb_tensorapid_tbl USING btree (testnr);


--
-- Name: idx_testes_artigo; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_testes_artigo ON public.tb_testes USING btree (artigo);


--
-- Name: idx_testes_dt_prod; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_testes_dt_prod ON public.tb_testes USING btree (dt_prod);


--
-- Name: idx_testes_maquina; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_testes_maquina ON public.tb_testes USING btree (maquina);


--
-- Name: idx_testes_partida; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_testes_partida ON public.tb_testes USING btree (partida);


--
-- Name: idx_testes_turno; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_testes_turno ON public.tb_testes USING btree (turno);


--
-- Name: idx_uster_carda_par_lote; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_carda_par_lote ON public.tb_uster_carda_par USING btree (lote);


--
-- Name: idx_uster_carda_par_style; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_carda_par_style ON public.tb_uster_carda_par USING btree (style);


--
-- Name: idx_uster_carda_par_time; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_carda_par_time ON public.tb_uster_carda_par USING btree (time_stamp);


--
-- Name: idx_uster_carda_tbl_testnr; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_carda_tbl_testnr ON public.tb_uster_carda_tbl USING btree (testnr);


--
-- Name: idx_uster_carda_tbl_testnr_prefix; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_carda_tbl_testnr_prefix ON public.tb_uster_carda_tbl USING btree (testnr, source_prefix);


--
-- Name: idx_uster_carda_titulo_testnr_prefix; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_carda_titulo_testnr_prefix ON public.tb_uster_carda_titulo_tbl USING btree (testnr, source_prefix);


--
-- Name: idx_uster_tbl_testnr; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_tbl_testnr ON public.tb_uster_tbl USING btree (testnr);


--
-- Name: idx_uster_tbl_testnr_seqno; Type: INDEX; Schema: public; Owner: stc_user
--

CREATE INDEX idx_uster_tbl_testnr_seqno ON public.tb_uster_tbl USING btree (testnr, seqno);


--
-- Name: calidad calidad_updated_at; Type: TRIGGER; Schema: public; Owner: stc_user
--

CREATE TRIGGER calidad_updated_at BEFORE UPDATE ON public.calidad FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: import_control import_control_updated_at; Type: TRIGGER; Schema: public; Owner: stc_user
--

CREATE TRIGGER import_control_updated_at BEFORE UPDATE ON public.import_control FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: produccion produccion_updated_at; Type: TRIGGER; Schema: public; Owner: stc_user
--

CREATE TRIGGER produccion_updated_at BEFORE UPDATE ON public.produccion FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: residuos_indigo residuos_indigo_updated_at; Type: TRIGGER; Schema: public; Owner: stc_user
--

CREATE TRIGGER residuos_indigo_updated_at BEFORE UPDATE ON public.residuos_indigo FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: tb_parametros_hvi trg_update_parametros_hvi_timestamp; Type: TRIGGER; Schema: public; Owner: stc_user
--

CREATE TRIGGER trg_update_parametros_hvi_timestamp BEFORE UPDATE ON public.tb_parametros_hvi FOR EACH ROW EXECUTE FUNCTION public.update_parametros_hvi_timestamp();


--
-- Name: tb_hvi_detalles tb_hvi_detalles_ensayo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_hvi_detalles
    ADD CONSTRAINT tb_hvi_detalles_ensayo_id_fkey FOREIGN KEY (ensayo_id) REFERENCES public.tb_hvi_ensayos(id) ON DELETE CASCADE;


--
-- Name: tb_tensorapid_tbl tb_tensorapid_tbl_testnr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_tensorapid_tbl
    ADD CONSTRAINT tb_tensorapid_tbl_testnr_fkey FOREIGN KEY (testnr) REFERENCES public.tb_tensorapid_par(testnr) ON DELETE CASCADE;


--
-- Name: tb_uster_carda_tbl tb_uster_carda_tbl_testnr_source_prefix_fkey; Type: FK CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_tbl
    ADD CONSTRAINT tb_uster_carda_tbl_testnr_source_prefix_fkey FOREIGN KEY (testnr, source_prefix) REFERENCES public.tb_uster_carda_par(testnr, source_prefix) ON DELETE CASCADE;


--
-- Name: tb_uster_carda_titulo_tbl tb_uster_carda_titulo_tbl_testnr_source_prefix_fkey; Type: FK CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_carda_titulo_tbl
    ADD CONSTRAINT tb_uster_carda_titulo_tbl_testnr_source_prefix_fkey FOREIGN KEY (testnr, source_prefix) REFERENCES public.tb_uster_carda_par(testnr, source_prefix) ON DELETE CASCADE;


--
-- Name: tb_uster_tbl tb_uster_tbl_testnr_fkey; Type: FK CONSTRAINT; Schema: public; Owner: stc_user
--

ALTER TABLE ONLY public.tb_uster_tbl
    ADD CONSTRAINT tb_uster_tbl_testnr_fkey FOREIGN KEY (testnr) REFERENCES public.tb_uster_par(testnr) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict aulYzcU62h6ldveebETUdJdSCbkCkjJ37Ddql5eVgYpa5OicIiz8G4d8UEI8ZCl

