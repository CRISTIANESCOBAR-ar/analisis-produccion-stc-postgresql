// Test de conexión simple
console.log('🧪 Test de conexión a bases de datos\n');

async function testConnections() {
  // Test PostgreSQL
  console.log('1️⃣ Probando PostgreSQL...');
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: 'localhost',
      port: 5433,
      database: 'stc_produccion',
      user: 'stc_user',
      password: 'stc_password_2026'
    });
    const client = await pool.connect();
    const result = await client.query('SELECT COUNT(*) FROM tb_uster_par');
    console.log(`✅ PostgreSQL OK - tb_uster_par tiene ${result.rows[0].count} registros`);
    client.release();
    await pool.end();
  } catch (err) {
    console.error(`❌ PostgreSQL ERROR: ${err.message}`);
  }

  // Test Oracle
  console.log('\n2️⃣ Probando Oracle...');
  try {
    const oracledb = require('oracledb');
    const conn = await oracledb.getConnection({
      user: 'SYSTEM',
      password: 'Alfa1984',
      connectString: 'localhost/XE'
    });
    const result = await conn.execute('SELECT COUNT(*) FROM USTER_PAR');
    console.log(`✅ Oracle OK - USTER_PAR tiene ${result.rows[0][0]} registros`);
    await conn.close();
  } catch (err) {
    console.error(`❌ Oracle ERROR: ${err.message}`);
  }
}

testConnections().then(() => {
  console.log('\n✅ Test completado');
  process.exit(0);
}).catch(err => {
  console.error('\n❌ Error:', err);
  process.exit(1);
});
