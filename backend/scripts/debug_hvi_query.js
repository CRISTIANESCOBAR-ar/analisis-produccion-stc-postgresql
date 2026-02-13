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
    const lotes = ['104', '105', '106'] // Lotes que sabemos que existen en producción
    console.log('Testing lookup for lotes:', lotes)

    // Esta es la query exacta que puse en server.js
    const sql = `
        SELECT
          "LOTE" AS LOTE,
          "LOTE_FIAC" AS LOTE_FIAC,
          "MISTURA" AS MISTURA,
          "DT_ENTRADA_PROD" AS FECHA_INGRESO,
          "SCI", "MST"
        FROM tb_calidad_fibra
        WHERE "TIPO_MOV" = 'MIST'
          AND (
            "LOTE" = ANY($1::text[]) 
            OR CAST("LOTE_FIAC" AS INTEGER)::TEXT = ANY($1::text[])
          )
    `
    const res = await client.query(sql, [lotes])
    console.log('Rows found:', res.rowCount)
    if (res.rowCount > 0) {
        console.table(res.rows.slice(0, 10))
    } else {
        console.log('No rows found matching criteria')
        
        // Debug fallback: Buscar sin el filtro estricto para ver que tienen esos lotes
        console.log('--- Probing raw data for 104 ---')
        const probe = await client.query(`
            SELECT "LOTE", "LOTE_FIAC", "TIPO_MOV" 
            FROM tb_calidad_fibra 
            WHERE "LOTE_FIAC" LIKE '%104' OR "LOTE" = '104'
            LIMIT 5
        `)
        console.table(probe.rows)
    }

  } catch (e) {
    console.error('Query Error:', e)
  } finally {
    client.release()
    await pool.end()
  }
}
check()
