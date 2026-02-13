import pg from 'pg'
const { Pool } = pg

const pool = new Pool({
  user: 'stc_user',
  host: 'localhost',
  database: 'stc_produccion',
  password: 'stc_password_2026',
  port: 5433,
})

async function check() {
  const client = await pool.connect()
  try {
    // Check specific rows for LOTE/LOTE_FIAC '104' that are relevant (MISTURA not null)
    // Print PESO raw value
    const res = await client.query(`
      SELECT "LOTE", "LOTE_FIAC", "MISTURA", "PESO", "TIPO_MOV"
      FROM tb_calidad_fibra
      WHERE "TIPO_MOV" = 'MIST'
        AND ("LOTE" = '104' OR "LOTE_FIAC" LIKE '%104' OR "LOTE_FIAC" = '104')
      LIMIT 20
    `)
    console.table(res.rows)
    
  } catch (e) {
    console.error(e)
  } finally {
    client.release()
    await pool.end()
  }
}
check()
