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

async function main(){
  const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_metas' ORDER BY ordinal_position")
  console.log(JSON.stringify(res.rows, null, 2))
  await pool.end()
}

main().catch(e=>{console.error(e); process.exit(1)})
