import 'dotenv/config'
import { Pool } from 'pg'

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT ? Number(process.env.PG_PORT) : 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 2,
})

async function main() {
  try {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_produccion' ORDER BY ordinal_position`)
    console.log(JSON.stringify(res.rows.map(r => r.column_name), null, 2))
  } catch (err) {
    console.error('ERROR-COLS:', err.message || err)
    process.exit(2)
  } finally {
    await pool.end()
  }
}

main()
