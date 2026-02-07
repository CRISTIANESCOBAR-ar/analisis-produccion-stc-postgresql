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

const columnsToDrop = [
  'fecha',
  'fiacao_meta',
  'fiacao_enc_urd',
  'indigo_meta',
  'indigo_enc_urd',
  'tecelagem_meta',
  'tecelagem_enc_urd',
  'acabamento_meta',
  'acabamento_enc_urd',
]

async function columnExists(columnName) {
  const res = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_metas' AND column_name=$1",
    [columnName]
  )
  return res.rowCount > 0
}

async function main() {
  for (const col of columnsToDrop) {
    const exists = await columnExists(col)
    if (!exists) {
      console.log(`Columna ya ausente: ${col}`)
      continue
    }
    await pool.query(`ALTER TABLE tb_metas DROP COLUMN IF EXISTS ${col}`)
    console.log(`✅ Eliminada columna: ${col}`)
  }
  await pool.end()
}

main().catch(err => {
  console.error('Error eliminando columnas:', err)
  process.exit(1)
})
