-- ============================================
-- Script para recrear las tablas de USTER y TENSORAPID
-- Estas tablas faltaban en el esquema inicial de PostgreSQL
-- ============================================

DROP TABLE IF EXISTS tb_uster_par CASCADE;
CREATE TABLE tb_uster_par (
  testnr TEXT PRIMARY KEY,
  nomcount TEXT,
  maschnr TEXT,
  lote TEXT,
  laborant TEXT,
  time_stamp TEXT,
  matclass TEXT,
  estiraje TEXT,
  pasador TEXT,
  obs TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS tb_uster_tbl CASCADE;
CREATE TABLE tb_uster_tbl (
  id SERIAL PRIMARY KEY,
  testnr TEXT,
  seqno INTEGER,
  no_ TEXT,
  u_percent NUMERIC,
  cvm_percent NUMERIC,
  indice_percent NUMERIC,
  cvm_1m_percent NUMERIC,
  cvm_3m_percent NUMERIC,
  cvm_10m_percent NUMERIC,
  titulo NUMERIC,
  titulo_rel_perc NUMERIC,
  h NUMERIC,
  sh NUMERIC,
  sh_1m NUMERIC,
  sh_3m NUMERIC,
  sh_10m NUMERIC,
  delg_minus30_km NUMERIC,
  delg_minus40_km NUMERIC,
  delg_minus50_km NUMERIC,
  delg_minus60_km NUMERIC,
  grue_35_km NUMERIC,
  grue_50_km NUMERIC,
  grue_70_km NUMERIC,
  grue_100_km NUMERIC,
  neps_140_km NUMERIC,
  neps_200_km NUMERIC,
  neps_280_km NUMERIC,
  neps_400_km NUMERIC,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS tb_tensorapid_par CASCADE;
CREATE TABLE tb_tensorapid_par (
  testnr TEXT PRIMARY KEY,
  ne_titulo TEXT,
  titulo TEXT,
  comment_text TEXT,
  long_prueba TEXT,
  time_stamp TEXT,
  lote TEXT,
  ne_titulo_type TEXT,
  uster_testnr TEXT,
  catalog TEXT,
  "time" TEXT,
  sortiment TEXT,
  article TEXT,
  maschnr TEXT,
  matclass TEXT,
  nomcount TEXT,
  nomtwist TEXT,
  uscode TEXT,
  laborant TEXT,
  comment TEXT,
  tuname TEXT,
  groups TEXT,
  within TEXT,
  total TEXT,
  unspoolgroups TEXT,
  length TEXT,
  extspeed TEXT,
  pretension TEXT,
  clamppressure TEXT,
  cycleforcell TEXT,
  cycleforceul TEXT,
  nmbofforcecycles TEXT,
  cyclelongll TEXT,
  cyclelongul TEXT,
  nmbofelongcycles TEXT,
  forcef1rel TEXT,
  elongatione1rel TEXT,
  evaltimerel TEXT,
  preloadcyclesrel TEXT,
  forcef1ret TEXT,
  elongatione1ret TEXT,
  evaltimeret TEXT,
  preloadcyclesret TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS tb_tensorapid_tbl CASCADE;
CREATE TABLE tb_tensorapid_tbl (
  id SERIAL PRIMARY KEY,
  testnr TEXT,
  huso_number INTEGER,
  tiempo_rotura NUMERIC,
  fuerza_b NUMERIC,
  elongacion NUMERIC,
  tenacidad NUMERIC,
  trabajo NUMERIC,
  huso_ensayos TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uster_tbl_testnr ON tb_uster_tbl(testnr);
CREATE INDEX IF NOT EXISTS idx_tensorapid_tbl_testnr ON tb_tensorapid_tbl(testnr);
CREATE INDEX IF NOT EXISTS idx_uster_par_testnr ON tb_uster_par(testnr);
CREATE INDEX IF NOT EXISTS idx_tensorapid_par_testnr ON tb_tensorapid_par(testnr);

GRANT ALL PRIVILEGES ON TABLE tb_uster_par TO stc_user;
GRANT ALL PRIVILEGES ON TABLE tb_uster_tbl TO stc_user;
GRANT ALL PRIVILEGES ON TABLE tb_tensorapid_par TO stc_user;
GRANT ALL PRIVILEGES ON TABLE tb_tensorapid_tbl TO stc_user;
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO stc_user;
