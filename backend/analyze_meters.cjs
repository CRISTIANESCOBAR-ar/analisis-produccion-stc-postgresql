const { Pool } = require('pg')
const pool = new Pool({ host: '127.0.0.1', port: 5433, database: 'stc_produccion', user: 'stc_user', password: 'stc_password_2026' })

;(async () => {
  try {
    const r = await pool.query(`
      SELECT meter_pos, timestamp_ts, timestamp_end_ts, codigo, mensaje
      FROM tb_benninger_rtf_eventos
      WHERE source_file = 'ERR_230727_0045[INDIGO].rtf' AND section = 'AML'
      ORDER BY timestamp_ts ASC NULLS LAST
      LIMIT 40
    `)
    console.log('timestamp_inicio  | timestamp_fin    | meter_pos | codigo      | mensaje')
    console.log('------------------+------------------+-----------+-------------+------------------------------')
    for (const row of r.rows) {
      const ts = String(row.timestamp_ts || '').slice(11, 19).padEnd(16)
      const te = String(row.timestamp_end_ts || '').slice(11, 19).padEnd(16)
      const m = String(row.meter_pos ?? 'null').padStart(9)
      const cod = String(row.codigo || '').padEnd(11)
      const msg = String(row.mensaje || '').slice(0, 40)
      console.log(`${ts} | ${te} | ${m} | ${cod} | ${msg}`)
    }

    // Now check last 10 events (end of corrida)
    const r2 = await pool.query(`
      SELECT meter_pos, timestamp_ts, timestamp_end_ts, codigo, mensaje
      FROM tb_benninger_rtf_eventos
      WHERE source_file = 'ERR_230727_0045[INDIGO].rtf' AND section = 'AML'
      ORDER BY timestamp_ts DESC NULLS LAST
      LIMIT 10
    `)
    console.log('\n--- ULTIMOS 10 EVENTOS (fin de corrida) ---')
    for (const row of r2.rows) {
      const ts = String(row.timestamp_ts || '').slice(11, 19).padEnd(16)
      const m = String(row.meter_pos ?? 'null').padStart(9)
      const cod = String(row.codigo || '').padEnd(11)
      const msg = String(row.mensaje || '').slice(0, 45)
      console.log(`${ts} | ${m} | ${cod} | ${msg}`)
    }
  } finally {
    await pool.end()
  }
})()
