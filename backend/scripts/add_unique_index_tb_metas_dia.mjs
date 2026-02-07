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
    "SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='tb_metas' AND indexname='idx_tb_metas_dia_unique'"
  )
  if (existsRes.rowCount > 0) {
    console.log('Indice unico ya existe: idx_tb_metas_dia_unique')
    await pool.end()
    return
  }

  await pool.query('CREATE UNIQUE INDEX idx_tb_metas_dia_unique ON tb_metas ("Dia")')
  console.log('✅ Indice unico creado en Dia')
  await pool.end()
}

main().catch(err => {
  console.error('Error creando indice unico:', err)
  process.exit(1)
})
