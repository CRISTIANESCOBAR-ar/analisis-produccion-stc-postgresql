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
  const res = await pool.query(
    `SELECT fecha::date AS fecha, COUNT(*) AS total
     FROM tb_metas
     WHERE fecha IS NOT NULL
     GROUP BY fecha::date
     HAVING COUNT(*) > 1
     ORDER BY fecha::date`
  )
  if (res.rowCount === 0) {
    console.log('Sin duplicados en fecha')
  } else {
    console.log('Duplicados en fecha:')
    console.log(res.rows)
  }
  await pool.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
