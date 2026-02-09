// Verificar estructura de TENSORAPID_PAR
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
      `SELECT COLUMN_NAME, DATA_TYPE 
       FROM USER_TAB_COLUMNS 
       WHERE TABLE_NAME = 'TENSORAPID_PAR' 
       ORDER BY COLUMN_ID`,
      [], { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    console.log('Columnas en TENSORAPID_PAR:');
    result.rows.forEach(row => {
      console.log(`  ${row.COLUMN_NAME} (${row.DATA_TYPE})`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (connection) await connection.close();
  }
}

checkColumns();
