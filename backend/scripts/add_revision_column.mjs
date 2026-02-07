import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
})

async function main() {
  const existsRes = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_metas' AND column_name='revision'"
  )
  if (existsRes.rowCount > 0) {
    console.log('La columna revision ya existe en tb_metas.')
    await pool.end()
    return
  }

  await pool.query('ALTER TABLE tb_metas ADD COLUMN revision numeric')
  console.log('✅ Columna revision agregada a tb_metas')
  await pool.end()
}

main().catch(err => {
  console.error('Error agregando columna revision:', err)
  process.exit(1)
})
