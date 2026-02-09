// Script para contar registros en Oracle
require('dotenv').config({ path: '../carga-datos-vue/server/.env' });
const oracledb = require('oracledb');

async function countRecords() {
  let connection;
  try {
    // Usar la configuración del proyecto carga-datos-vue
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER || 'SYSTEM',
      password: process.env.ORACLE_PASSWORD || 'Alfa1984',
      connectString: process.env.ORACLE_CONNECTIONSTRING || 'localhost:1521/XE'
    });

    console.log('✓ Conectado a Oracle\n');

    const result = await connection.execute(
      `SELECT 'USTER_PAR' AS tabla, COUNT(*) AS registros FROM USTER_PAR
       UNION ALL
       SELECT 'USTER_TBL', COUNT(*) FROM USTER_TBL
       UNION ALL
       SELECT 'TENSORAPID_PAR', COUNT(*) FROM TENSORAPID_PAR
       UNION ALL
       SELECT 'TENSORAPID_TBL', COUNT(*) FROM TENSORAPID_TBL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log('=== REGISTROS EN ORACLE ===');
    result.rows.forEach(row => {
      console.log(`${row.TABLA.padEnd(20)} ${row.REGISTROS}`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch (err) {
        console.error('Error cerrando conexión:', err.message);
      }
    }
  }
}

countRecords();
