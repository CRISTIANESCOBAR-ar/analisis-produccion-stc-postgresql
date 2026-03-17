-- Tablas dedicadas para carga de Uster Cardas

CREATE TABLE IF NOT EXISTS tb_uster_carda_par (
  testnr TEXT PRIMARY KEY,
  source_prefix TEXT,
  catalog TEXT,
  sortiment TEXT,
  style TEXT,
  machine_family TEXT,
  nomcount NUMERIC,
  maschnr TEXT,
  lote TEXT,
  laborant TEXT,
  time_stamp TEXT,
  matclass TEXT,
  obs TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uster_carda_par_time ON tb_uster_carda_par(time_stamp);
CREATE INDEX IF NOT EXISTS idx_uster_carda_par_lote ON tb_uster_carda_par(lote);
CREATE INDEX IF NOT EXISTS idx_uster_carda_par_style ON tb_uster_carda_par(style);

CREATE TABLE IF NOT EXISTS tb_uster_carda_tbl (
  id BIGSERIAL PRIMARY KEY,
  testnr TEXT NOT NULL REFERENCES tb_uster_carda_par(testnr) ON DELETE CASCADE,
  seqno INTEGER NOT NULL,
  no_ NUMERIC,
  u_percent NUMERIC,
  cvm_percent NUMERIC,
  cvm_1m_percent NUMERIC,
  cvm_3m_percent NUMERIC,
  cvm_10m_percent NUMERIC,
  titulo_machine NUMERIC,
  titulo_rel_perc NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(testnr, seqno)
);

CREATE INDEX IF NOT EXISTS idx_uster_carda_tbl_testnr ON tb_uster_carda_tbl(testnr);

CREATE TABLE IF NOT EXISTS tb_uster_carda_titulo_tbl (
  id BIGSERIAL PRIMARY KEY,
  testnr TEXT NOT NULL REFERENCES tb_uster_carda_par(testnr) ON DELETE CASCADE,
  repno SMALLINT NOT NULL CHECK (repno BETWEEN 1 AND 3),
  titulo NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(testnr, repno)
);

CREATE INDEX IF NOT EXISTS idx_uster_carda_titulo_testnr ON tb_uster_carda_titulo_tbl(testnr);
