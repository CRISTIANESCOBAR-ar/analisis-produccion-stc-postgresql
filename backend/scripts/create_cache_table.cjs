require('dotenv/config');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
});

async function run() {
  try {
    await pool.query(`ALTER TABLE tb_narrativa_cache ADD COLUMN IF NOT EXISTS origen VARCHAR(100) DEFAULT 'Desconocido'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tb_narrativa_cache_key_origen ON tb_narrativa_cache (cache_key, origen);`);
    console.log("Table tb_narrativa_cache altered.");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
