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
  const res = await pool.query('SELECT COUNT(*) AS total, MIN(fecha) AS min_fecha, MAX(fecha) AS max_fecha FROM tb_metas')
  console.log(res.rows[0])
  await pool.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
