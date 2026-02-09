// Verificar estructura completa de USTER_PAR en Oracle
require('dotenv').config({ path: '../carga-datos-vue/server/.env' });
const oracledb = require('oracledb');

async function checkColumns() {
  let connection;
  try {
    connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER || 'SYSTEM',
      password: process.env.ORACLE_PASSWORD || 'Alfa1984',
      connectString: process.env.ORACLE_CONNECTIONSTRING || 'localhost:1521/XE'
    });

    const result = await connection.execute(
      `SELECT COLUMN_NAME, DATA_TYPE, DATA_LENGTH, NULLABLE
       FROM USER_TAB_COLUMNS 
       WHERE TABLE_NAME = 'USTER_PAR' 
       ORDER BY COLUMN_ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log('=== COLUMNAS EN ORACLE USTER_PAR ===\n');
    result.rows.forEach(row => {
      const nullable = row.NULLABLE === 'Y' ? 'NULL' : 'NOT NULL';
      console.log(`  ${row.COLUMN_NAME.padEnd(20)} ${row.DATA_TYPE.padEnd(12)} ${nullable}`);
    });
    console.log(`\nTotal: ${result.rows.length} columnas\n`);

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.close();
  }
}

checkColumns();
