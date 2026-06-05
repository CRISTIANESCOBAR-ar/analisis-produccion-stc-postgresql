import pg from 'pg';
import 'dotenv/config';

const { Client } = pg;
const client = new Client({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5433,
  database: process.env.PG_DATABASE || 'stc_produccion',
  user: process.env.PG_USER || 'stc_user',
  password: process.env.PG_PASSWORD || 'stc_password_2026'
});

async function run() {
  await client.connect();
  const res = await client.query('SELECT * FROM tb_calidad LIMIT 1');
  console.log(Object.keys(res.rows[0]));
  await client.end();
}
run();
