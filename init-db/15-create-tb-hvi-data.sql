-- =====================================================
-- Tabla: tb_hvi_ensayos (Cabecera)
-- =====================================================
CREATE TABLE IF NOT EXISTS tb_hvi_ensayos (
    id SERIAL PRIMARY KEY,
    tipo TEXT, -- 'Ent' o 'Mue'
    lote TEXT NOT NULL,
    proveedor TEXT,
    grado TEXT,
    fecha TEXT, -- Se guarda como texto para preservar el formato original del TXT
    muestra TEXT, -- Input manual del usuario
    archivo_fuente TEXT,
    creado_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hvi_ensayos_lote ON tb_hvi_ensayos(lote);

-- =====================================================
-- Tabla: tb_hvi_detalles (Resultados individuales)
-- =====================================================
CREATE TABLE IF NOT EXISTS tb_hvi_detalles (
    id SERIAL PRIMARY KEY,
    ensayo_id INTEGER REFERENCES tb_hvi_ensayos(id) ON DELETE CASCADE,
    fardo TEXT,
    sci NUMERIC,
    mst NUMERIC,
    mic NUMERIC,
    mat NUMERIC,
    uhml NUMERIC,
    ui NUMERIC,
    sf NUMERIC,
    str NUMERIC,
    elg NUMERIC,
    rd NUMERIC,
    plus_b NUMERIC,
    tipo TEXT, -- Grado de color formateado con coma
    tr_cnt NUMERIC,
    tr_ar NUMERIC,
    trid NUMERIC
);

CREATE INDEX IF NOT EXISTS idx_hvi_detalles_ensayo ON tb_hvi_detalles(ensayo_id);
