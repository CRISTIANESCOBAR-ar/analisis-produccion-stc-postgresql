
const { Client } = require('pg');

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://stc_user:stc_pass@localhost:5432/stc_produccion_v2'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM tb_calidad_fibra LIMIT 1');
  console.log('Columns:', Object.keys(res.rows[0]));
  console.log('Row:', res.rows[0]);
  await client.end();
}

run().catch(console.error);
