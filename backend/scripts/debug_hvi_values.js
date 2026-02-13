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
    console.log('Connected to DB')
    
    // Explicit check for Lote 104
    try {
        const res104 = await client.query(`
          SELECT "LOTE", "LOTE_FIAC", "MISTURA"
          FROM tb_calidad_fibra
          WHERE "LOTE_FIAC" LIKE '%104%' OR "LOTE" LIKE '%104%'
        `)
        console.log('--- Searching for 104 ---')
        console.table(res104.rows)
    } catch(e) {
        console.log("Error searching 104:", e.message)
    }
    
  } catch (e) {
    console.error(e)
  } finally {
    client.release()
    await pool.end()
  }
}
check()
