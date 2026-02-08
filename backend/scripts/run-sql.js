import 'dotenv/config'
import fs from 'fs/promises'
import pg from 'pg'

const { Pool } = pg

const sqlPath = process.argv[2]
if (!sqlPath) {
  console.error('Usage: node run-sql.js <path-to-sql>')
  process.exit(1)
}

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

async function run() {
  const sql = await fs.readFile(sqlPath, 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log(`OK: executed ${sqlPath}`)
  } catch (err) {
    await client.query('ROLLBACK')
    console.error(`Error executing ${sqlPath}:`, err)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

run()
