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
  const detail = await pool.query(
    `SELECT "Dia"::date AS dia, "Revision" AS revision
     FROM tb_metas
     WHERE "Dia" >= '2026-02-01' AND "Dia" <= '2026-02-06'
     ORDER BY "Dia"`)

  const total = await pool.query(
    `SELECT COALESCE(SUM("Revision"), 0) AS acumulado
     FROM tb_metas
     WHERE "Dia" >= '2026-02-01' AND "Dia" <= '2026-02-06'`
  )

  console.log('Detalle 2026-02-01..06:')
  detail.rows.forEach(r => {
    console.log(`${r.dia.toISOString().slice(0, 10)}\t${r.revision ?? ''}`)
  })
  console.log('Acumulado:', total.rows[0].acumulado)

  await pool.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
