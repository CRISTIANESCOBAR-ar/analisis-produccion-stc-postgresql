const oracledb = require('oracledb');

async function run() {
  const conn = await oracledb.getConnection({
    user: 'SYSTEM',
    password: 'Alfa1984',
    connectString: 'localhost/XE'
  });
  
  console.log('Columnas USTER_PAR:');
  const r = await conn.execute(
    "SELECT column_name, data_type FROM all_tab_columns WHERE table_name = 'USTER_PAR' ORDER BY column_id"
  );
  r.rows.forEach(x => console.log('  ', x[0], '-', x[1]));
  
  console.log('\nColumnas USTER_TBL:');
  const r2 = await conn.execute(
    "SELECT column_name, data_type FROM all_tab_columns WHERE table_name = 'USTER_TBL' ORDER BY column_id"
  );
  r2.rows.forEach(x => console.log('  ', x[0], '-', x[1]));
  
  await conn.close();
}

run().catch(e => console.error(e));
