import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 1,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})

async function main() {
  const client = await pool.connect()
  try {
    const res = await client.query('SELECT COUNT(*)::int AS cnt FROM tb_metas WHERE "Dia" BETWEEN $1 AND $2', ['2026-06-01', '2026-06-30'])
    console.log('rows_jun_2026:', res.rows[0].cnt)
    const sample = await client.query('SELECT "Dia", "Indigo", "Meta_Eficiencia_INDIGO" FROM tb_metas WHERE "Dia" = $1', ['2026-06-01'])
    if (sample.rows.length) console.log('sample row:', sample.rows[0])
  } catch (err) {
    console.error('Error querying tb_metas:', err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

main()
