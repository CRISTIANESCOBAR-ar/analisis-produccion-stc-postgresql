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

const desiredColumns = [
  { name: 'Dia', type: 'date' },
  { name: 'Indigo', type: 'numeric' },
  { name: 'Meta_Eficiencia_INDIGO', type: 'numeric' },
  { name: 'Meta_Rotura_INDIGO', type: 'numeric' },
  { name: 'Meta_Estopa_Azul', type: 'numeric' },
  { name: 'Tejeduria', type: 'numeric' },
  { name: 'RU105', type: 'numeric' },
  { name: 'RT105', type: 'numeric' },
  { name: 'EFI_Percent', type: 'numeric' },
  { name: 'Meta_Estopa_Azul_Tejeduria', type: 'numeric' },
  { name: 'Integrada', type: 'numeric' },
  { name: 'Meta_Velocidad_Integrada', type: 'numeric' },
  { name: 'Meta_ENC_URD_Integrada', type: 'numeric' },
  { name: 'Revision', type: 'numeric' },
  { name: 'Dia_Invertido', type: 'integer' },
]

async function columnExists(columnName) {
  const res = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tb_metas' AND column_name=$1",
    [columnName]
  )
  return res.rowCount > 0
}

async function main() {
  for (const col of desiredColumns) {
    const exists = await columnExists(col.name)
    if (!exists) {
      await pool.query(`ALTER TABLE tb_metas ADD COLUMN \"${col.name}\" ${col.type}`)
      console.log(`Agregada columna ${col.name}`)
    }
  }

  // Backfill basico desde columnas existentes
  await pool.query(`UPDATE tb_metas SET \"Dia\" = fecha WHERE \"Dia\" IS NULL AND fecha IS NOT NULL`)
  await pool.query(`UPDATE tb_metas SET \"Indigo\" = indigo_meta WHERE \"Indigo\" IS NULL AND indigo_meta IS NOT NULL`)
  await pool.query(`UPDATE tb_metas SET \"Meta_Eficiencia_INDIGO\" = indigo_enc_urd WHERE \"Meta_Eficiencia_INDIGO\" IS NULL AND indigo_enc_urd IS NOT NULL`)
  await pool.query(`UPDATE tb_metas SET \"Tejeduria\" = tecelagem_meta WHERE \"Tejeduria\" IS NULL AND tecelagem_meta IS NOT NULL`)
  await pool.query(`UPDATE tb_metas SET \"Meta_Estopa_Azul_Tejeduria\" = tecelagem_enc_urd WHERE \"Meta_Estopa_Azul_Tejeduria\" IS NULL AND tecelagem_enc_urd IS NOT NULL`)
  await pool.query(`UPDATE tb_metas SET \"Integrada\" = acabamento_meta WHERE \"Integrada\" IS NULL AND acabamento_meta IS NOT NULL`)
  await pool.query(`UPDATE tb_metas SET \"Meta_ENC_URD_Integrada\" = acabamento_enc_urd WHERE \"Meta_ENC_URD_Integrada\" IS NULL AND acabamento_enc_urd IS NOT NULL`)
  await pool.query(`UPDATE tb_metas SET \"Revision\" = revision WHERE \"Revision\" IS NULL AND revision IS NOT NULL`)

  console.log('Backfill completado')
  await pool.end()
}

main().catch(err => {
  console.error('Error alineando esquema tb_metas:', err)
  process.exit(1)
})
