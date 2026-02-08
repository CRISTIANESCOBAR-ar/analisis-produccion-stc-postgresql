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
  connectionTimeoutMillis: 10000
})

async function run() {
  const sql = "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by table_name"
  const res = await pool.query(sql)
  for (const row of res.rows || []) {
    console.log(row.table_name)
  }
  await pool.end()
}

run().catch((err) => {
  console.error('Error listing tables:', err)
  process.exitCode = 1
})
