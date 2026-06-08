#!/usr/bin/env node
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026',
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 3000,
})

function usage() {
  console.log('Usage: node backend/scripts/check_metas_cli.mjs <YYYY-MM>')
}

async function main() {
  const arg = process.argv[2]
  if (!arg || !/^\d{4}-\d{2}$/.test(arg)) {
    usage()
    process.exit(1)
  }
  const [year, month] = arg.split('-')
  const monthStart = `${year}-${month}-01`
  const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate()
  const monthEnd = `${year}-${month}-${String(lastDay).padStart(2, '0')}`

  try {
    const res = await pool.query(
      `SELECT to_char("Dia", 'YYYY-MM-DD') AS dia, "Revision" FROM tb_metas WHERE "Dia" >= $1 AND "Dia" <= $2 ORDER BY "Dia"`,
      [monthStart, monthEnd]
    )
    console.log('Query range:', monthStart, '->', monthEnd)
    console.log('Rows returned:', res.rows.length)
    console.log(JSON.stringify(res.rows, null, 2))
  } catch (err) {
    console.error('Error querying tb_metas:', err.message)
  } finally {
    await pool.end()
  }
}

main()
